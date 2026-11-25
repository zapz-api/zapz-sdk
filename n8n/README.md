# @zapz/n8n-nodes-zapz

n8n nodes for the [ZapZ](https://zapz.dev) WhatsApp API.

Documentation: https://zapz.dev/#/docs

- **ZapZ**: every API operation (instances, messages, contacts, groups, webhooks, sandbox). The body of each operation comes filled in with an example; the `clientMessageId` is generated automatically on sends.
- **ZapZ Trigger**: starts the workflow on WhatsApp events (`new_message`, `message_read`, `disconnected`…). When activated, it creates the webhook on ZapZ with its own secret and checks the signature of each delivery; when deactivated, it removes the webhook.

Installation: in **Settings → Community Nodes → Install**, enter `@zapz/n8n-nodes-zapz`. Credential: an API key (`sk_live_` or `sk_test_`) and the API URL.

The operations come from `nodes/ZapZ/operations.ts`, generated from `openapi.json` (`python3 generator/generate.py`).

## License

MIT
