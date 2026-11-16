<?php
// Integration smoke test against a running API with a sk_test_ key:
//   ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 php tests/smoke.php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use ZapZ\Exception\NotFoundException;
use ZapZ\Exception\WebhookVerificationException;
use ZapZ\Webhook;
use ZapZ\ZapZ;

function check(bool $ok, string $what): void
{
    echo ($ok ? "✔ " : "✖ ") . $what . "\n";
    if (!$ok) {
        exit(1);
    }
}

// webhook signature round trip
$secret = 'whsec_test';
$body = json_encode(['event' => 'message_status', 'data' => ['status' => 'read']]);
$ts = (string) time();
$sig = 'sha256=' . hash_hmac('sha256', "{$ts}.{$body}", $secret);
$ev = Webhook::verify($body, ['X-Webhook-Timestamp' => $ts, 'X-Webhook-Signature-V2' => $sig], $secret);
check($ev['event'] === 'message_status', 'webhook verified');
try {
    Webhook::verify($body . ' ', ['x-webhook-timestamp' => $ts, 'x-webhook-signature-v2' => $sig], $secret);
    check(false, 'tampered body rejected');
} catch (WebhookVerificationException) {
    check(true, 'tampered body rejected');
}

if (!getenv('ZAPZ_API_KEY')) {
    echo "- sandbox flow skipped (set ZAPZ_API_KEY)\n";
    exit(0);
}

$zapz = new ZapZ();
check($zapz->http->isSandbox(), 'sandbox key');
$instances = $zapz->instances->list();
$inst = array_values(array_filter($instances, fn ($i) => !empty($i['sandbox'])))[0] ?? $instances[0];

$msg = $zapz->messages->sendText($inst['id'], ['to' => '5511999990001', 'text' => 'Olá do SDK PHP']);
check(!empty($msg['id']), 'clientMessageId generated');
$again = $zapz->messages->sendText($inst['id'], ['to' => '5511999990001', 'text' => 'Olá do SDK PHP', 'clientMessageId' => $msg['id']]);
check(($again['duplicate'] ?? false) === true, 'duplicate detected');
check($zapz->messages->get($inst['id'], $msg['id'])['id'] === $msg['id'], 'get message');

$hook = $zapz->webhooks->create(['url' => 'https://example.com/zapz-sdk-php', 'events' => ['message_status'], 'secret' => 'whsec_sdk_php_123']);
check((bool) array_filter($zapz->webhooks->list(), fn ($w) => $w['id'] === $hook['id']), 'webhook listed');
$zapz->webhooks->delete($hook['id']);

try {
    $zapz->messages->get($inst['id'], 'does-not-exist');
    check(false, '404 raises NotFoundException');
} catch (NotFoundException) {
    check(true, '404 raises NotFoundException');
}
echo "all good\n";
