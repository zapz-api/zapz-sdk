// Runs the node's execute() with a minimal fake n8n context against a real API:
//   ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 npm run build && npm test
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { ZapZ } = require('../dist/nodes/ZapZ/ZapZ.node.js');
const { ZapZTrigger } = require('../dist/nodes/ZapZTrigger/ZapZTrigger.node.js');

const live = !!process.env.ZAPZ_API_KEY;
const creds = { apiKey: process.env.ZAPZ_API_KEY, baseUrl: process.env.ZAPZ_BASE_URL || 'https://api.zapz.com' };

function fakeExec(params) {
  return {
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
    getCredentials: async () => creds,
    getNode: () => ({ name: 'ZapZ', type: 'zapZ' }),
    continueOnFail: () => false,
    helpers: {
      async httpRequestWithAuthentication(_cred, opts) {
        const url = new URL(opts.url);
        for (const [k, v] of Object.entries(opts.qs ?? {})) url.searchParams.set(k, String(v));
        const res = await fetch(url, {
          method: opts.method,
          headers: { Authorization: `Bearer ${creds.apiKey}`, 'Content-Type': 'application/json' },
          body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { httpCode: String(res.status), response: data });
        return data;
      },
    },
  };
}

test('node description is consistent', () => {
  const d = new ZapZ().description;
  const ops = d.properties.filter((p) => p.name === 'operation');
  assert.equal(ops.length, 6);
  assert.ok(ops.flatMap((p) => p.options).some((o) => o.value === 'sendText'));
});

test('trigger rejects unsigned and accepts signed deliveries', async () => {
  const secret = 'abc123';
  const body = { event: 'new_message', data: { text: 'oi' } };
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  let status = 200;
  const ctx = (headers) => ({
    getRequestObject: () => ({ headers, body, rawBody: Buffer.from(raw) }),
    getResponseObject: () => ({ status(c) { status = c; return this; }, send() {} }),
    getWorkflowStaticData: () => ({ secret }),
    helpers: { returnJsonArray: (b) => [{ json: b }] },
  });
  const t = new ZapZTrigger();
  const ok = await t.webhook.call(ctx({ 'x-webhook-timestamp': ts, 'x-webhook-signature-v2': sig }));
  assert.equal(ok.workflowData[0][0].json.event, 'new_message');
  const bad = await t.webhook.call(ctx({ 'x-webhook-timestamp': ts, 'x-webhook-signature-v2': 'sha256=00' }));
  assert.equal(bad.noWebhookResponse, true);
  assert.equal(status, 401);
});

test('execute against the sandbox', { skip: !live && 'set ZAPZ_API_KEY (sk_test_)' }, async () => {
  const node = new ZapZ();
  const [list] = await node.execute.call(fakeExec({ resource: 'instances', operation: 'list', query: {} }));
  const inst = list.map((r) => r.json).find((i) => i.sandbox) ?? list[0].json;
  const [sent] = await node.execute.call(fakeExec({
    resource: 'messages', operation: 'sendText', instanceId: inst.id,
    body: JSON.stringify({ to: '5511999990001', text: 'Olá do n8n' }),
  }));
  assert.ok(sent[0].json.id, 'clientMessageId generated');
  assert.equal(sent[0].json.to, '5511999990001');
  const [got] = await node.execute.call(fakeExec({ resource: 'messages', operation: 'get', instanceId: inst.id, messageId: sent[0].json.id }));
  assert.equal(got[0].json.id, sent[0].json.id);
});

test('trigger registers and removes its webhook', { skip: !live && 'set ZAPZ_API_KEY (sk_test_)' }, async () => {
  const staticData = {};
  const base = fakeExec({});
  const hook = {
    ...base,
    getNodeParameter: (name, fallback) => ({ events: ['new_message'], instanceId: '' })[name] ?? fallback,
    getNodeWebhookUrl: () => 'https://example.com/n8n-zapz-trigger-test',
    getWorkflowStaticData: () => staticData,
  };
  const m = new ZapZTrigger().webhookMethods.default;
  assert.equal(await m.checkExists.call(hook), false);
  assert.equal(await m.create.call(hook), true);
  assert.ok(staticData.webhookId && staticData.secret);
  assert.equal(await m.checkExists.call(hook), true);
  assert.equal(await m.delete.call(hook), true);
  assert.equal(staticData.webhookId, undefined);
});
