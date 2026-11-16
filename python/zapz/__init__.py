"""Official Python SDK for the ZapZ WhatsApp API.

    from zapz import ZapZ
    zapz = ZapZ(api_key="sk_live_...")
    zapz.messages.send_text("INSTANCE_ID", {"to": "5511999999999", "text": "Olá!"})
"""
from __future__ import annotations

from typing import Optional

from ._core import DEFAULT_BASE_URL, ZapZCore
from ._errors import (
    APIConnectionError,
    AuthenticationError,
    ConflictError,
    InternalServerError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    ValidationError,
    ZapZError,
)
from ._generated import (
    ContactsResource,
    GroupsResource,
    InstancesResource,
    MessagesResource,
    SandboxResource,
    WebhooksResource,
)
from ._version import VERSION
from .models import Message, WebhookEvent
from .webhooks import WebhookVerificationError, verify_webhook


class ZapZ(ZapZCore):
    """ZapZ API client. ``api_key`` defaults to the ZAPZ_API_KEY environment variable."""

    def __init__(self, api_key: Optional[str] = None, *, base_url: Optional[str] = None,
                 timeout: float = 30.0, max_retries: int = 2) -> None:
        super().__init__(api_key, base_url=base_url, timeout=timeout, max_retries=max_retries)
        self.instances = InstancesResource(self)
        self.messages = MessagesResource(self)
        self.contacts = ContactsResource(self)
        self.groups = GroupsResource(self)
        self.webhooks = WebhooksResource(self)
        self.sandbox = SandboxResource(self)

    verify_webhook = staticmethod(verify_webhook)


__all__ = [
    "ZapZ", "VERSION", "DEFAULT_BASE_URL", "Message", "WebhookEvent", "verify_webhook",
    "ZapZError", "APIConnectionError", "ValidationError", "AuthenticationError", "PermissionDeniedError",
    "NotFoundError", "ConflictError", "RateLimitError", "InternalServerError", "WebhookVerificationError",
]
