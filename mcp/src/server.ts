import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, type ToolDef } from './tools.generated.js';

export const VERSION = '0.1.0';
export const DEFAULT_BASE_URL = 'https://api.zapz.dev';
/** Responses larger than this are cut, so one big list does not flood the model's context. */
const MAX_RESULT_CHARS = 60_000;

export interface ZapZMcpOptions {
  apiKey: string;
  baseUrl?: string;
  /** Used instead of baseUrl for sk_test_ keys (separate sandbox deployment). */
  sandboxBaseUrl?: string;
  /** Expose only read-only tools (no sends, no changes). */
  readOnly?: boolean;
  fetch?: typeof fetch;
}

const INSTRUCTIONS = `ZapZ is a WhatsApp API. Typical flow:
1. instances_list to find the instance_id of the connected number (status "connected").
2. messages_send_* to send (text, media, list, poll, location…). Sends are queued with anti-ban pacing and return status "queued".
3. messages_get with the returned id to follow the status (sent, delivered, read, failed).
Phone numbers are digits only with country and area code, e.g. 5511999999999. Groups use their JID (…@g.us).
Ask the user before sending messages, deleting anything or changing group participants.
With a sk_test_ key everything runs in the sandbox: nothing reaches WhatsApp and statuses are simulated.`;

function visibleTools(readOnly: boolean): ToolDef[] {
  return readOnly ? TOOLS.filter((t) => t.annotations.readOnlyHint) : TOOLS;
}

/** One MCP server bound to one API key. */
export function createZapZServer(opts: ZapZMcpOptions): Server {
  const sandbox = opts.apiKey.startsWith('sk_test_');
  const baseUrl = ((sandbox && opts.sandboxBaseUrl) || opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '').replace(/\/v1$/, '');
  const doFetch = opts.fetch ?? fetch;
  const tools = visibleTools(!!opts.readOnly);
  const byName = new Map(tools.map((t) => [t.name, t]));

  const server = new Server(
    { name: 'zapz', version: VERSION },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS + (opts.apiKey.startsWith('sk_test_') ? '\nThis server is using a sandbox (sk_test_) key.' : '') },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName.get(req.params.name);
    if (!tool) return errorResult(`Unknown tool: ${req.params.name}`);
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;

    let path = tool.path;
    for (const p of tool.pathParams) {
      const v = args[p.arg];
      if (typeof v !== 'string' || !v.trim()) return errorResult(`Missing required argument: ${p.arg}`);
      path = path.replace(`{${p.name}}`, encodeURIComponent(v.trim()));
    }
    const url = new URL(`${baseUrl}/v1${path}`);
    for (const q of tool.query) {
      const v = args[q];
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(q, String(v));
    }
    let body: Record<string, unknown> | undefined;
    if (tool.bodyKeys) {
      body = {};
      for (const k of tool.bodyKeys) if (args[k] !== undefined) body[k] = args[k];
      if (tool.autoClientMessageId && !body.clientMessageId) body.clientMessageId = randomUUID();
    }

    try {
      const res = await doFetch(url, {
        method: tool.method,
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          Accept: 'application/json',
          'User-Agent': `zapz-mcp/${VERSION}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      const text = await res.text();
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : { ok: true };
      } catch {
        /* plain text */
      }
      if (!res.ok) {
        const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        const msg = Array.isArray(d.message) ? d.message.join('; ') : String(d.message ?? text ?? res.statusText);
        const retry = d.retryAfter ?? res.headers.get('retry-after');
        return errorResult(`HTTP ${res.status}${d.error ? ` ${d.error}` : ''}: ${msg}${retry ? ` (retry after ${retry}s)` : ''}`);
      }
      let out = JSON.stringify(data, null, 2);
      if (out.length > MAX_RESULT_CHARS) out = out.slice(0, MAX_RESULT_CHARS) + `\n… truncated (${out.length} chars). Use filters or limit to narrow the result.`;
      return { content: [{ type: 'text', text: out }] };
    } catch (err) {
      return errorResult(`Could not reach the ZapZ API at ${baseUrl}: ${(err as Error).message}`);
    }
  });

  return server;
}

function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}
