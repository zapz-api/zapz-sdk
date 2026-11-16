from __future__ import annotations

from typing import Any, Optional


class ZapZError(Exception):
    """Base class for every error raised by the SDK."""

    def __init__(self, message: str, *, status: Optional[int] = None, code: Optional[str] = None,
                 retry_after: Optional[float] = None, body: Any = None) -> None:
        super().__init__(message)
        self.message = message
        #: HTTP status (None for network errors)
        self.status = status
        #: machine-readable code from the API, e.g. ``INSTANCE_NOT_CONNECTED``
        self.code = code
        #: seconds to wait before retrying, when the API says so
        self.retry_after = retry_after
        self.body = body

    def __str__(self) -> str:
        prefix = f"[{self.status}{' ' + self.code if self.code else ''}] " if self.status else ""
        return prefix + self.message


class APIConnectionError(ZapZError):
    """Could not reach the API (DNS, TLS, timeout, connection reset)."""


class ValidationError(ZapZError):
    """400 / 422: the request is invalid."""


class AuthenticationError(ZapZError):
    """401: missing, revoked or wrong-environment API key."""


class PermissionDeniedError(ZapZError):
    """403: the key lacks a scope, the IP is not allowed or the account is suspended."""


class NotFoundError(ZapZError):
    """404"""


class ConflictError(ZapZError):
    """409: e.g. the instance is not connected."""


class RateLimitError(ZapZError):
    """429: rate limit or anti-ban pacing. See ``retry_after``."""


class InternalServerError(ZapZError):
    """5xx"""


def error_from_response(status: int, body: Any, retry_after_header: Optional[str]) -> ZapZError:
    data = body if isinstance(body, dict) else {}
    msg = data.get("message")
    if isinstance(msg, list):
        msg = "; ".join(str(m) for m in msg)
    message = str(msg) if msg else f"HTTP {status}"
    retry_after: Optional[float] = None
    for v in (data.get("retryAfter"), retry_after_header):
        try:
            if v is not None:
                retry_after = float(v)
                break
        except (TypeError, ValueError):
            pass
    code = data.get("error") if isinstance(data.get("error"), str) else None
    kw = dict(status=status, code=code, retry_after=retry_after, body=body)
    if status in (400, 422):
        return ValidationError(message, **kw)
    if status == 401:
        return AuthenticationError(message, **kw)
    if status == 403:
        return PermissionDeniedError(message, **kw)
    if status == 404:
        return NotFoundError(message, **kw)
    if status == 409:
        return ConflictError(message, **kw)
    if status == 429:
        return RateLimitError(message, **kw)
    if status >= 500:
        return InternalServerError(message, **kw)
    return ZapZError(message, **kw)
