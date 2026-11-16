// Integration smoke test against a running API with a sk_test_ key:
//   ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 npm test
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { ZapZ, NotFoundError, verifyWebhook, WebhookVerificationError } = require('../dist');

const live = !!process.env.ZAPZ_API_KEY;

test('webhook signature round trip', () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ event: 'message_status', data: { status: 'read' } });
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  const ev = verifyWebhook(body, { 'X-Webhook-Timestamp': ts, 'X-Webhook-Signature-V2': sig }, secret);
  assert.equal(ev.event, 'message_status');
  assert.throws(() => verifyWebhook(body + ' ', { 'x-webhook-timestamp': ts, 'x-webhook-signature-v2': sig }, secret), WebhookVerificationError);
  assert.throws(() => verifyWebhook(body, { 'x-webhook-timestamp': '1', 'x-webhook-signature-v2': sig }, secret), WebhookVerificationError);
});

test('sandbox flow', { skip: !live && 'set ZAPZ_API_KEY (sk_test_) to run' }, async () => {
  const zapz = new ZapZ();
  assert.ok(zapz.isSandbox);
  const instances = await zapz.instances.list();
  const inst = instances.find((i) => i.sandbox) ?? instances[0];
  assert.ok(inst, 'sandbox instance');

  const msg = await zapz.messages.sendText(inst.id, { to: '5511999990001', text: 'Olá do SDK Node' });
  assert.ok(msg.id, 'clientMessageId generated');
  assert.equal(msg.to, '5511999990001');
  const again = await zapz.messages.sendText(inst.id, { to: '5511999990001', text: 'Olá do SDK Node', clientMessageId: msg.id });
  assert.equal(again.duplicate, true);
  const got = await zapz.messages.get(inst.id, msg.id);
  assert.equal(got.id, msg.id);

  const hook = await zapz.webhooks.create({ url: 'https://example.com/zapz-sdk-node', events: ['message_status'], secret: 'whsec_sdk_node_123' });
  assert.ok((await zapz.webhooks.list()).some((w) => w.id === hook.id));
  await zapz.webhooks.delete(hook.id);

  await assert.rejects(zapz.messages.get(inst.id, 'does-not-exist'), NotFoundError);
});
