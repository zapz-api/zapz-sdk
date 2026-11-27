// End-to-end: spawns the server and talks MCP to it.
//   ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 npm run build && npm test
import test from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const live = !!process.env.ZAPZ_API_KEY;
const env = { ...process.env };
const text = (r) => r.content.map((c) => c.text).join('');

async function stdioClient(extraArgs = []) {
  const client = new Client({ name: 'zapz-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/index.js', ...extraArgs], env }));
  return client;
}

test('stdio: lists tools with schemas and annotations', { skip: !live && 'set ZAPZ_API_KEY' }, async () => {
  const client = await stdioClient();
  const { tools } = await client.listTools();
  assert.equal(tools.length, 67);
  const send = tools.find((t) => t.name === 'messages_send_text');
  assert.deepEqual(send.inputSchema.required.sort(), ['instance_id', 'text', 'to']);
  assert.equal(tools.find((t) => t.name === 'instances_delete').annotations.destructiveHint, true);
  assert.match(client.getInstructions() ?? '', /instances_list/);
  await client.close();
});

test('stdio: read-only mode hides writes', { skip: !live && 'set ZAPZ_API_KEY' }, async () => {
  const client = await stdioClient(['--read-only']);
  const { tools } = await client.listTools();
  assert.ok(tools.length > 10 && tools.every((t) => t.annotations.readOnlyHint));
  assert.ok(!tools.some((t) => t.name === 'messages_send_text'));
  await client.close();
});

test('stdio: send, follow status, errors', { skip: !live && 'set ZAPZ_API_KEY' }, async () => {
  const client = await stdioClient();
  const list = JSON.parse(text(await client.callTool({ name: 'instances_list', arguments: {} })));
  const inst = list.find((i) => i.sandbox) ?? list[0];
  const sent = await client.callTool({ name: 'messages_send_text', arguments: { instance_id: inst.id, to: '5511999990001', text: 'Olá do MCP' } });
  assert.ok(!sent.isError, text(sent));
  const msg = JSON.parse(text(sent));
  assert.ok(msg.id);
  const got = JSON.parse(text(await client.callTool({ name: 'messages_get', arguments: { instance_id: inst.id, message_id: msg.id } })));
  assert.equal(got.id, msg.id);
  const missing = await client.callTool({ name: 'messages_get', arguments: { instance_id: inst.id, message_id: 'nope' } });
  assert.equal(missing.isError, true);
  assert.match(text(missing), /HTTP 404/);
  const noArg = await client.callTool({ name: 'messages_get', arguments: { instance_id: inst.id } });
  assert.equal(noArg.isError, true);
  await client.close();
});

test('http: key per request, 401 without it', { skip: !live && 'set ZAPZ_API_KEY' }, async () => {
  const port = 3399;
  const proc = spawn(process.execPath, ['dist/index.js', '--http', '--port', String(port)], { env: { ...env, ZAPZ_API_KEY: '' }, stdio: ['ignore', 'ignore', 'pipe'] });
  await new Promise((r) => proc.stderr.once('data', r));
  try {
    const unauth = await fetch(`http://localhost:${port}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(unauth.status, 401);
    const client = new Client({ name: 'zapz-test', version: '0.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${port}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${process.env.ZAPZ_API_KEY}` } },
    }));
    const { tools } = await client.listTools();
    assert.equal(tools.length, 67);
    const list = await client.callTool({ name: 'instances_list', arguments: {} });
    assert.ok(!list.isError, text(list));
    await client.close();
  } finally {
    proc.kill();
  }
});
