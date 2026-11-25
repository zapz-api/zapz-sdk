# @zapz/sdk

Official Node.js 18+ and TypeScript SDK for the [ZapZ](https://zapz.dev) WhatsApp API. No dependencies.

Documentation: https://zapz.dev/#/docs

```bash
npm install @zapz/sdk
```

```ts
import ZapZ from '@zapz/sdk';

const zapz = new ZapZ({ apiKey: process.env.ZAPZ_API_KEY });

const msg = await zapz.messages.sendText('INSTANCE_ID', { to: '5511999999999', text: 'Hello!' });
console.log(msg.id, msg.status);
```

Resources: `instances`, `messages`, `contacts`, `groups`, `webhooks`, `sandbox`.

## Options

| Option | Default | |
|---|---|---|
| `apiKey` | `ZAPZ_API_KEY` | `sk_live_…` or `sk_test_…` |
| `baseUrl` | `ZAPZ_BASE_URL` or production | use the sandbox URL with a test key |
| `timeout` | `30000` | ms per attempt |
| `maxRetries` | `2` | on 429/503 and safe network failures |

## Errors

Every exception extends `ZapZError` (`status`, `code`, `retryAfter`, `body`):
`ValidationError`, `AuthenticationError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `InternalServerError`, `APIConnectionError`.

## Webhooks

```ts
app.post('/zapz', express.raw({ type: 'application/json' }), (req, res) => {
  const event = ZapZ.verifyWebhook(req.body, req.headers, process.env.ZAPZ_WEBHOOK_SECRET!);
  res.sendStatus(200);
});
```

## License

MIT
