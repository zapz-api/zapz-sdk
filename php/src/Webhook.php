<?php

declare(strict_types=1);

namespace ZapZ;

use ZapZ\Exception\WebhookVerificationException;

/** Verifies ZapZ webhook deliveries (X-Webhook-Signature-V2). */
final class Webhook
{
    /**
     * Checks the signature and returns the decoded event.
     * Pass the RAW body: file_get_contents('php://input') or $request->getContent() in Laravel.
     *
     * @param array<string, string|list<string>> $headers request headers (any case), e.g. getallheaders()
     * @return array<string, mixed>
     */
    public static function verify(string $rawBody, array $headers, string $secret, int $toleranceSeconds = 300, ?int $now = null): array
    {
        $ts = self::header($headers, 'x-webhook-timestamp');
        $sig = self::header($headers, 'x-webhook-signature-v2');
        if ($ts === null || $sig === null || !ctype_digit($ts)) {
            throw new WebhookVerificationException('Missing X-Webhook-Timestamp or X-Webhook-Signature-V2 header');
        }
        if (abs(($now ?? time()) - (int) $ts) > $toleranceSeconds) {
            throw new WebhookVerificationException('Webhook timestamp outside the tolerance window');
        }
        $expected = 'sha256=' . hash_hmac('sha256', $ts . '.' . $rawBody, $secret);
        if (!hash_equals($expected, $sig)) {
            throw new WebhookVerificationException('Invalid webhook signature');
        }
        $event = json_decode($rawBody, true);
        if (!is_array($event)) {
            throw new WebhookVerificationException('Webhook body is not valid JSON');
        }
        return $event;
    }

    /** @param array<string, string|list<string>> $headers */
    private static function header(array $headers, string $name): ?string
    {
        foreach ($headers as $k => $v) {
            if (strtolower((string) $k) === $name) {
                return is_array($v) ? (string) ($v[0] ?? '') : (string) $v;
            }
        }
        return null;
    }
}
