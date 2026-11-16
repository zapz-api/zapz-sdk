import { APIConnectionError, ZapZError, errorFromResponse } from './errors';

export const DEFAULT_BASE_URL = 'https://api.zapz.com';
export const VERSION = '0.1.0';

export interface ClientOptions {
  /** `sk_live_...` or `sk_test_...`. Defaults to the ZAPZ_API_KEY environment variable. */
  apiKey?: string;
  /** API base URL. Defaults to ZAPZ_BASE_URL, then the production URL. */
  baseUrl?: string;
  /** Per-request timeout in ms (default 30000). */
  timeout?: number;
  /** Retries for rate limits, 503 and safe network failures (default 2). */
  maxRetries?: number;
  /** Custom fetch (tests, proxies). Defaults to the global fetch (Node 18+). */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  timeout?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

export interface RequestSpec {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, unknown>;
  /** Fill `clientMessageId` when missing, so retries can never send twice. */
  autoClientMessageId?: boolean;
}

const env = (k: string): string | undefined =>
  typeof process !== 'undefined' && process.env ? process.env[k] : undefined;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function randomId(): string {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'sdk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

/** HTTP layer shared by every resource. */
export class ZapZCore {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    const apiKey = opts.apiKey ?? env('ZAPZ_API_KEY');
    if (!apiKey) throw new ZapZError('Missing API key: pass { apiKey } or set ZAPZ_API_KEY.');
    this.apiKey = apiKey;
    this.baseUrl = (opts.baseUrl ?? env('ZAPZ_BASE_URL') ?? DEFAULT_BASE_URL).replace(/\/+$/, '').replace(/\/v1$/, '');
    this.timeout = opts.timeout ?? 30_000;
    this.maxRetries = opts.maxRetries ?? 2;
    const f = opts.fetch ?? (globalThis as any).fetch;
    if (!f) throw new ZapZError('No fetch available: use Node 18+ or pass { fetch }.');
    this.fetchImpl = f.bind(globalThis);
  }

  /** True for sk_test_ keys (sandbox: nothing reaches WhatsApp). */
  get isSandbox(): boolean {
    return this.apiKey.startsWith('sk_test_');
  }

  async request<T = any>(spec: RequestSpec, options: RequestOptions = {}): Promise<T> {
    let body = spec.body;
    if (spec.autoClientMessageId && body && typeof body === 'object' && !(body as any).clientMessageId) {
      body = { ...(body as object), clientMessageId: randomId() };
    }
    const url = new URL(this.baseUrl + '/v1' + spec.path);
    for (const [k, v] of Object.entries(spec.query ?? {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    // a retry is safe when the request is idempotent or carries an idempotency key
    const idempotent = spec.method === 'GET' || spec.method === 'DELETE' || !!(body as any)?.clientMessageId;
    const maxRetries = options.maxRetries ?? this.maxRetries;

    for (let attempt = 0; ; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), options.timeout ?? this.timeout);
      const onAbort = () => ctrl.abort();
      options.signal?.addEventListener('abort', onAbort);
      let res: Response;
      try {
        res = await this.fetchImpl(url.toString(), {
          method: spec.method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
            'User-Agent': `zapz-node/${VERSION}`,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: ctrl.signal,
        });
      } catch (err: any) {
        if (options.signal?.aborted) throw err;
        if (idempotent && attempt < maxRetries) {
          await sleep(backoff(attempt));
          continue;
        }
        const msg = err?.name === 'AbortError' ? 'Request timed out' : `Connection error: ${err?.message ?? err}`;
        throw new APIConnectionError(msg);
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
      }

      const text = await res.text();
      let data: any = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (res.ok) return data as T;

      const error = errorFromResponse(res.status, data, res.headers.get('retry-after'));
      const refused = res.status === 429 || res.status === 503; // nothing was processed
      const transient = res.status === 502 || res.status === 504;
      if (attempt < maxRetries && (refused || (transient && idempotent))) {
        const wait = error.retryAfter ? error.retryAfter * 1000 : backoff(attempt);
        if (wait <= 60_000) {
          await sleep(wait);
          continue;
        }
      }
      throw error;
    }
  }
}

function backoff(attempt: number): number {
  return Math.min(8000, 500 * 2 ** attempt) * (0.75 + Math.random() * 0.5);
}
