/** Base class for every error thrown by the SDK. */
export class ZapZError extends Error {
  /** HTTP status (undefined for network errors). */
  readonly status?: number;
  /** Machine-readable code from the API, e.g. `INSTANCE_NOT_CONNECTED`. */
  readonly code?: string;
  /** Seconds to wait before retrying, when the API says so. */
  readonly retryAfter?: number;
  /** Parsed error body. */
  readonly body?: unknown;

  constructor(message: string, init: { status?: number; code?: string; retryAfter?: number; body?: unknown } = {}) {
    super(message);
    this.name = new.target.name;
    this.status = init.status;
    this.code = init.code;
    this.retryAfter = init.retryAfter;
    this.body = init.body;
  }
}

/** Could not reach the API (DNS, TLS, timeout, connection reset). */
export class APIConnectionError extends ZapZError {}
/** 400 / 422: the request is invalid. */
export class ValidationError extends ZapZError {}
/** 401: missing, revoked or wrong-environment API key. */
export class AuthenticationError extends ZapZError {}
/** 403: the key lacks a scope, the IP is not allowed or the account is suspended. */
export class PermissionDeniedError extends ZapZError {}
/** 404 */
export class NotFoundError extends ZapZError {}
/** 409: e.g. the instance is not connected. */
export class ConflictError extends ZapZError {}
/** 429: rate limit or anti-ban pacing. See `retryAfter`. */
export class RateLimitError extends ZapZError {}
/** 5xx */
export class InternalServerError extends ZapZError {}

export function errorFromResponse(status: number, body: any, retryAfterHeader: string | null): ZapZError {
  const message = Array.isArray(body?.message) ? body.message.join('; ') : body?.message || `HTTP ${status}`;
  const retryAfter = Number(body?.retryAfter ?? retryAfterHeader) || undefined;
  const init = { status, code: typeof body?.error === 'string' ? body.error : undefined, retryAfter, body };
  if (status === 400 || status === 422) return new ValidationError(message, init);
  if (status === 401) return new AuthenticationError(message, init);
  if (status === 403) return new PermissionDeniedError(message, init);
  if (status === 404) return new NotFoundError(message, init);
  if (status === 409) return new ConflictError(message, init);
  if (status === 429) return new RateLimitError(message, init);
  if (status >= 500) return new InternalServerError(message, init);
  return new ZapZError(message, init);
}
