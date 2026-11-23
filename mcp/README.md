# @zapz/mcp

Servidor MCP (Model Context Protocol) da ZapZ: deixa assistentes de IA (Claude, Cursor, ChatGPT e outros clientes MCP) enviarem mensagens de WhatsApp e gerenciarem instâncias, contatos, grupos e webhooks.

- 66 ferramentas geradas de `openapi.json` (`instances_list`, `messages_send_text`, `groups_update_participants`…), com JSON Schema dos parâmetros e anotações (`readOnlyHint`, `destructiveHint`) para o cliente pedir confirmação antes do que altera ou apaga.
- `clientMessageId` gerado em cada envio: repetir uma chamada nunca manda a mensagem duas vezes.
- `--read-only`: só as ferramentas de leitura.
- Com chave `sk_test_` tudo roda no sandbox.

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

## HTTP (remoto)

```bash
npx @zapz/mcp --http --port 3333
```

Endpoint `POST /mcp` (Streamable HTTP, sem sessão). Cada requisição manda a própria chave em `Authorization: Bearer sk_live_...`, então um processo atende várias contas.

Variáveis: `ZAPZ_API_KEY`, `ZAPZ_BASE_URL`, `ZAPZ_SANDBOX_BASE_URL` (para chaves `sk_test_` quando o sandbox roda separado), `ZAPZ_MCP_READ_ONLY=true`.

Docker: `docker build -t zapz-mcp .` e `docker run -p 3333:3000 -e ZAPZ_BASE_URL=... zapz-mcp` (sobe em modo HTTP, com `GET /health`). Em produção ele roda como o serviço `zapz-mcp` do compose, atrás de `mcp.<domínio>`.

Conectar a um servidor remoto:

```bash
claude mcp add --transport http zapz https://mcp.zapz.dev/mcp --header "Authorization: Bearer sk_live_..."
```

Chaves com IPs permitidos não funcionam pelo servidor hospedado (a API vê o IP dele); nesse caso rode localmente.

Teste: `ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 npm run build && npm test`.
