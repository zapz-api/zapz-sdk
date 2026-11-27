# @zapz/mcp

MCP (Model Context Protocol) server for the [ZapZ](https://zapz.dev) WhatsApp API. It lets AI assistants (Claude, Cursor, ChatGPT and other MCP clients) send WhatsApp messages and manage instances, contacts, groups and webhooks.

Documentation: https://zapz.dev/#/docs

- 67 tools generated from `openapi.json` (`instances_list`, `messages_send_text`, `groups_update_participants`…), with a JSON Schema for the parameters and annotations (`readOnlyHint`, `destructiveHint`) so the client asks for confirmation before anything that changes or deletes data.
- A `clientMessageId` is generated for each send: repeating a call never sends the message twice.
- `--read-only`: read tools only.
- With an `sk_test_` key everything runs in the sandbox.

## Claude Code

```bash
claude mcp add zapz -e ZAPZ_API_KEY=sk_live_... -- npx -y @zapz/mcp
```

## Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "zapz": {
      "command": "npx",
      "args": ["-y", "@zapz/mcp"],
      "env": { "ZAPZ_API_KEY": "sk_live_..." }
    }
  }
}
```

## HTTP (remote)

```bash
npx @zapz/mcp --http --port 3333
```

Endpoint `POST /mcp` (Streamable HTTP, stateless). Each request sends its own key in `Authorization: Bearer sk_live_...`, so one process serves many accounts.

Variables: `ZAPZ_API_KEY`, `ZAPZ_BASE_URL`, `ZAPZ_SANDBOX_BASE_URL` (for `sk_test_` keys when the sandbox runs separately), `ZAPZ_MCP_READ_ONLY=true`.

Docker: `docker run -p 3333:3000 -e ZAPZ_BASE_URL=... ghcr.io/zapz-api/zapz-mcp` (starts in HTTP mode, with `GET /health`).

Connect to the hosted server:

```bash
claude mcp add --transport http zapz https://mcp.zapz.dev/mcp --header "Authorization: Bearer sk_live_..."
```

Keys restricted to allowed IPs do not work through the hosted server (the API sees the server's IP); run it locally in that case.

Test: `ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 npm run build && npm test`.

## License

MIT
