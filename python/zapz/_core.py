from __future__ import annotations

import json
import os
import random
import socket
import time
import uuid
import urllib.error
import urllib.request
from typing import Any, Dict, Optional
from urllib.parse import urlencode

from ._errors import APIConnectionError, ZapZError, error_from_response
from ._version import VERSION

DEFAULT_BASE_URL = "https://api.zapz.dev"


def _backoff(attempt: int) -> float:
    return min(8.0, 0.5 * 2 ** attempt) * (0.75 + random.random() * 0.5)


class ZapZCore:
    """HTTP layer shared by every resource (stdlib only)."""

    def __init__(self, api_key: Optional[str] = None, *, base_url: Optional[str] = None,
                 timeout: float = 30.0, max_retries: int = 2) -> None:
        key = api_key or os.environ.get("ZAPZ_API_KEY")
        if not key:
            raise ZapZError("Missing API key: pass api_key=... or set ZAPZ_API_KEY.")
        self._api_key = key
        url = (base_url or os.environ.get("ZAPZ_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.base_url = url[:-3] if url.endswith("/v1") else url
        self.timeout = timeout
        self.max_retries = max_retries

    @property
    def is_sandbox(self) -> bool:
        """True for sk_test_ keys (sandbox: nothing reaches WhatsApp)."""
        return self._api_key.startswith("sk_test_")

    def request(self, method: str, path: str, *, body: Any = None, query: Optional[Dict[str, Any]] = None,
                auto_client_message_id: bool = False, timeout: Optional[float] = None,
                max_retries: Optional[int] = None) -> Any:
        if auto_client_message_id and isinstance(body, dict) and not body.get("clientMessageId"):
            body = {**body, "clientMessageId": str(uuid.uuid4())}
        url = self.base_url + "/v1" + path
        q = {k: ("true" if v is True else "false" if v is False else v) for k, v in (query or {}).items() if v is not None}
        if q:
            url += "?" + urlencode(q)
        data = json.dumps(body).encode() if body is not None else None
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
            "User-Agent": f"zapz-python/{VERSION}",
        }
        if data is not None:
            headers["Content-Type"] = "application/json"
        # a retry is safe when the request is idempotent or carries an idempotency key
        idempotent = method in ("GET", "DELETE") or bool(isinstance(body, dict) and body.get("clientMessageId"))
        retries = self.max_retries if max_retries is None else max_retries

        attempt = 0
        while True:
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=timeout or self.timeout) as res:  # noqa: S310
                    return _parse(res.read())
            except urllib.error.HTTPError as e:
                status = e.code
                payload = _parse(e.read())
                err = error_from_response(status, payload, e.headers.get("Retry-After"))
                refused = status in (429, 503)  # nothing was processed
                transient = status in (502, 504)
                if attempt < retries and (refused or (transient and idempotent)):
                    wait = err.retry_after if err.retry_after else _backoff(attempt)
                    if wait <= 60:
                        time.sleep(wait)
                        attempt += 1
                        continue
                raise err from None
            except (urllib.error.URLError, socket.timeout, ConnectionError, TimeoutError) as e:
                if idempotent and attempt < retries:
                    time.sleep(_backoff(attempt))
                    attempt += 1
                    continue
                reason = getattr(e, "reason", e)
                raise APIConnectionError(f"Connection error: {reason}") from None


def _parse(raw: bytes) -> Any:
    if not raw:
        return None
    text = raw.decode("utf-8", errors="replace")
    try:
        return json.loads(text)
    except ValueError:
        return text
