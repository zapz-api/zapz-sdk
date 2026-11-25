# zapz

Official Python 3.8+ SDK for the [ZapZ](https://zapz.dev) WhatsApp API. No dependencies.

Documentation: https://zapz.dev/#/docs

```bash
pip install zapz
```

```python
from zapz import ZapZ

zapz = ZapZ()  # reads ZAPZ_API_KEY
msg = zapz.messages.send_text("INSTANCE_ID", {"to": "5511999999999", "text": "Hello!"})
print(msg["id"], msg["status"])
```

Resources: `instances`, `messages`, `contacts`, `groups`, `webhooks`, `sandbox`. Methods use snake_case (`send_text`, `update_participants`…); the parameters of each send are `TypedDict`s.

Client options: `api_key`, `base_url` (or `ZAPZ_BASE_URL`), `timeout` (seconds, default 30), `max_retries` (default 2).

Errors extend `ZapZError` (`status`, `code`, `retry_after`, `body`): `ValidationError`, `AuthenticationError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `InternalServerError`, `APIConnectionError`.

## Webhooks

```python
from zapz import verify_webhook

event = verify_webhook(request.get_data(), request.headers, os.environ["ZAPZ_WEBHOOK_SECRET"])
```

## License

MIT
