# zapz

SDK oficial da API de WhatsApp da ZapZ para Python 3.8+. Sem dependências.

```bash
pip install zapz
```

```python
from zapz import ZapZ

zapz = ZapZ()  # lê ZAPZ_API_KEY
msg = zapz.messages.send_text("INSTANCE_ID", {"to": "5511999999999", "text": "Olá!"})
print(msg["id"], msg["status"])
```

Recursos: `instances`, `messages`, `contacts`, `groups`, `webhooks`, `sandbox`. Métodos em snake_case (`send_text`, `update_participants`…); os parâmetros de cada envio são `TypedDict`.

Opções do cliente: `api_key`, `base_url` (ou `ZAPZ_BASE_URL`), `timeout` (s, padrão 30), `max_retries` (padrão 2).

Erros herdam de `ZapZError` (`status`, `code`, `retry_after`, `body`): `ValidationError`, `AuthenticationError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `InternalServerError`, `APIConnectionError`.

## Webhooks

```python
from zapz import verify_webhook

event = verify_webhook(request.get_data(), request.headers, os.environ["ZAPZ_WEBHOOK_SECRET"])
```
