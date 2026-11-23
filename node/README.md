# @zapz-api/sdk

SDK oficial da API de WhatsApp da ZapZ para Node.js 18+ e TypeScript. Sem dependências.

```bash
npm install @zapz-api/sdk
```

```ts
import ZapZ from '@zapz-api/sdk';

const zapz = new ZapZ({ apiKey: process.env.ZAPZ_API_KEY });

const msg = await zapz.messages.sendText('INSTANCE_ID', { to: '5511999999999', text: 'Olá!' });
console.log(msg.id, msg.status);
```

Recursos: `instances`, `messages`, `contacts`, `groups`, `webhooks`, `sandbox`.

## Opções

| Opção | Padrão | |
|---|---|---|
| `apiKey` | `ZAPZ_API_KEY` | `sk_live_…` ou `sk_test_…` |
| `baseUrl` | `ZAPZ_BASE_URL` ou produção | use a URL do sandbox com chave de teste |
| `timeout` | `30000` | ms por tentativa |
| `maxRetries` | `2` | em 429/503 e falhas de rede seguras |

## Erros

Todas as exceções herdam de `ZapZError` (`status`, `code`, `retryAfter`, `body`):
`ValidationError`, `AuthenticationError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `InternalServerError`, `APIConnectionError`.

## Webhooks

```ts
app.post('/zapz', express.raw({ type: 'application/json' }), (req, res) => {
  const event = ZapZ.verifyWebhook(req.body, req.headers, process.env.ZAPZ_WEBHOOK_SECRET!);
  res.sendStatus(200);
});
```
