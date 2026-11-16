import { createHmac, timingSafeEqual } from 'node:crypto';
import { ZapZError } from './errors';
import type { WebhookEvent } from './models';

export class WebhookVerificationError extends ZapZError {}

type HeaderBag = Record<string, string | string[] | undefined> | { get(name: string): string | null };

function header(headers: HeaderBag, name: string): string | undefined {
  if (typeof (headers as any).get === 'function') return (headers as any).get(name) ?? undefined;
  const bag = headers as Record<string, string | string[] | undefined>;
  const key = Object.keys(bag).find((k) => k.toLowerCase() === name);
  const v = key ? bag[key] : undefined;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Checks the `X-Webhook-Signature-V2` header of a ZapZ delivery and returns the parsed event.
 * Pass the RAW request body (string or Buffer), exactly as received.
 *
 * ```ts
 * app.post('/zapz', express.raw({ type: 'application/json' }), (req, res) => {
 *   const event = verifyWebhook(req.body, req.headers, process.env.ZAPZ_WEBHOOK_SECRET!);
 *   res.sendStatus(200);
 * });
 * ```
 */
export function verifyWebhook<T = Record<string, unknown>>(
  rawBody: string | Buffer | Uint8Array,
  headers: HeaderBag,
  secret: string,
  opts: { toleranceSeconds?: number; now?: number } = {},
): WebhookEvent<T> {
  const body = typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody).toString('utf8');
  const ts = header(headers, 'x-webhook-timestamp');
  const sig = header(headers, 'x-webhook-signature-v2');
  if (!ts || !sig || !/^\d+$/.test(ts)) throw new WebhookVerificationError('Missing X-Webhook-Timestamp or X-Webhook-Signature-V2 header');
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (Math.abs(now - Number(ts)) > (opts.toleranceSeconds ?? 300)) throw new WebhookVerificationError('Webhook timestamp outside the tolerance window');
  const expected = 'sha256=' + createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new WebhookVerificationError('Invalid webhook signature');
  try {
    return JSON.parse(body) as WebhookEvent<T>;
  } catch {
    throw new WebhookVerificationError('Webhook body is not valid JSON');
  }
}
