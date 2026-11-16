#!/usr/bin/env node
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createZapZServer, VERSION } from './server.js';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const value = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

if (flag('--help') || flag('-h')) {
  process.stdout.write(`zapz-mcp ${VERSION}: MCP server for the ZapZ WhatsApp API

  zapz-mcp                     stdio (Claude Desktop, Claude Code, Cursor…); key from ZAPZ_API_KEY
  zapz-mcp --http [--port 3333] Streamable HTTP at /mcp; each request sends "Authorization: Bearer <api key>"

Options / environment:
  --read-only   | ZAPZ_MCP_READ_ONLY=true   only tools that read (no sends or changes)
  --base-url U  | ZAPZ_BASE_URL             API URL
  --sandbox-base-url U | ZAPZ_SANDBOX_BASE_URL  API URL for sk_test_ keys, when the sandbox runs apart
`);
  process.exit(0);
}

const baseUrl = value('--base-url') ?? process.env.ZAPZ_BASE_URL;
// separate sandbox deployment: sk_test_ keys go here (otherwise to baseUrl)
const sandboxBaseUrl = value('--sandbox-base-url') ?? process.env.ZAPZ_SANDBOX_BASE_URL;
const readOnly = flag('--read-only') || /^(1|true|yes)$/i.test(process.env.ZAPZ_MCP_READ_ONLY ?? '');

if (flag('--http')) {
  const port = Number(value('--port') ?? process.env.PORT ?? 3333);
  const http = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: 'ok', version: VERSION }));
      return;
    }
    if (url.pathname !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    // stateless: every request carries its own API key, so one process serves many accounts
    const auth = String(req.headers.authorization ?? '');
    const apiKey = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    if (!/^sk_(live|test)_/.test(apiKey)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' })
        .end(JSON.stringify({ error: 'Send your ZapZ API key as Authorization: Bearer sk_live_... (or sk_test_...)' }));
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'POST' }).end();
      return;
    }
    const server = createZapZServer({ apiKey, baseUrl, sandboxBaseUrl, readOnly });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: (err as Error).message }));
    }
  });
  http.listen(port, () => process.stderr.write(`zapz-mcp ${VERSION} listening on http://localhost:${port}/mcp\n`));
} else {
  const apiKey = process.env.ZAPZ_API_KEY ?? '';
  if (!apiKey) {
    process.stderr.write('zapz-mcp: set ZAPZ_API_KEY (sk_live_... or sk_test_...)\n');
    process.exit(1);
  }
  const server = createZapZServer({ apiKey, baseUrl, sandboxBaseUrl, readOnly });
  await server.connect(new StdioServerTransport());
}
