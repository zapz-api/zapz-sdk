from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any, Mapping, Optional, Union

from ._errors import ZapZError
from .models import WebhookEvent


class WebhookVerificationError(ZapZError):
    """The delivery is not signed by ZapZ (or is too old)."""


def _header(headers: Any, name: str) -> Optional[str]:
    getter = getattr(headers, "get", None)
    if getter is not None:
        v = getter(name) or getter(name.title()) or getter(name.upper())
        if v:
            return v[0] if isinstance(v, (list, tuple)) else v
    if isinstance(headers, Mapping):
        for k, v in headers.items():
            if k.lower() == name:
                return v[0] if isinstance(v, (list, tuple)) else v
    return None


def verify_webhook(raw_body: Union[str, bytes], headers: Any, secret: str, *,
                   tolerance_seconds: int = 300, now: Optional[float] = None) -> WebhookEvent:
    """Check ``X-Webhook-Signature-V2`` and return the parsed event.

    Pass the RAW request body exactly as received, e.g. ``request.get_data()`` in Flask
    or ``await request.body()`` in FastAPI.
    """
    body = raw_body.decode("utf-8") if isinstance(raw_body, (bytes, bytearray)) else raw_body
    ts = _header(headers, "x-webhook-timestamp")
    sig = _header(headers, "x-webhook-signature-v2")
    if not ts or not sig or not str(ts).isdigit():
        raise WebhookVerificationError("Missing X-Webhook-Timestamp or X-Webhook-Signature-V2 header")
    current = int(now if now is not None else time.time())
    if abs(current - int(ts)) > tolerance_seconds:
        raise WebhookVerificationError("Webhook timestamp outside the tolerance window")
    expected = "sha256=" + hmac.new(secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, str(sig)):
        raise WebhookVerificationError("Invalid webhook signature")
    try:
        return json.loads(body)
    except ValueError:
        raise WebhookVerificationError("Webhook body is not valid JSON") from None
