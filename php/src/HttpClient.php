<?php

declare(strict_types=1);

namespace ZapZ;

use ZapZ\Exception\ApiConnectionException;
use ZapZ\Exception\ZapZException;

/** HTTP layer shared by every resource (ext-curl, no other dependency). */
class HttpClient
{
    public const DEFAULT_BASE_URL = 'https://api.zapz.com';
    public const VERSION = '0.1.0';

    public readonly string $baseUrl;

    /**
     * @param array{baseUrl?: string, timeout?: float, maxRetries?: int} $options
     */
    public function __construct(private readonly string $apiKey, array $options = [])
    {
        $url = rtrim($options['baseUrl'] ?? (getenv('ZAPZ_BASE_URL') ?: self::DEFAULT_BASE_URL), '/');
        $this->baseUrl = str_ends_with($url, '/v1') ? substr($url, 0, -3) : $url;
        $this->timeout = (float) ($options['timeout'] ?? 30.0);
        $this->maxRetries = (int) ($options['maxRetries'] ?? 2);
    }

    private float $timeout;
    private int $maxRetries;

    /** True for sk_test_ keys (sandbox: nothing reaches WhatsApp). */
    public function isSandbox(): bool
    {
        return str_starts_with($this->apiKey, 'sk_test_');
    }

    /**
     * @param array<string, mixed>|null $body
     * @param array<string, mixed>      $query
     * @param array{timeout?: float, maxRetries?: int} $options
     * @return array<mixed>
     */
    public function request(string $method, string $path, ?array $body, array $query, array $options, bool $autoClientMessageId): array
    {
        if ($autoClientMessageId && is_array($body) && empty($body['clientMessageId'])) {
            $body['clientMessageId'] = self::uuid();
        }
        $url = $this->baseUrl . '/v1' . $path;
        $q = [];
        foreach ($query as $k => $v) {
            if ($v === null) {
                continue;
            }
            $q[$k] = is_bool($v) ? ($v ? 'true' : 'false') : $v;
        }
        if ($q) {
            $url .= '?' . http_build_query($q);
        }
        $payload = $body === null ? null : json_encode($body === [] ? new \stdClass() : $body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Accept: application/json',
            'User-Agent: zapz-php/' . self::VERSION,
        ];
        if ($payload !== null) {
            $headers[] = 'Content-Type: application/json';
        }
        // a retry is safe when the request is idempotent or carries an idempotency key
        $idempotent = in_array($method, ['GET', 'DELETE'], true) || !empty($body['clientMessageId']);
        $maxRetries = $options['maxRetries'] ?? $this->maxRetries;
        $timeout = (float) ($options['timeout'] ?? $this->timeout);

        for ($attempt = 0; ; $attempt++) {
            $ch = curl_init($url);
            $respHeaders = [];
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST => $method,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT_MS => (int) ($timeout * 1000),
                CURLOPT_CONNECTTIMEOUT_MS => (int) min(10000, $timeout * 1000),
                CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$respHeaders): int {
                    $parts = explode(':', $line, 2);
                    if (count($parts) === 2) {
                        $respHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                    }
                    return strlen($line);
                },
            ]);
            if ($payload !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            }
            $raw = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($raw === false) {
                if ($idempotent && $attempt < $maxRetries) {
                    usleep(self::backoff($attempt));
                    continue;
                }
                throw new ApiConnectionException('Connection error: ' . $curlError);
            }

            $data = $raw === '' ? null : json_decode($raw, true);
            if ($raw !== '' && json_last_error() !== JSON_ERROR_NONE) {
                $data = $raw;
            }
            if ($status >= 200 && $status < 300) {
                return is_array($data) ? $data : [];
            }

            $error = ZapZException::fromResponse($status, $data, $respHeaders['retry-after'] ?? null);
            $refused = $status === 429 || $status === 503; // nothing was processed
            $transient = $status === 502 || $status === 504;
            if ($attempt < $maxRetries && ($refused || ($transient && $idempotent))) {
                $wait = $error->retryAfter !== null ? (int) ($error->retryAfter * 1_000_000) : self::backoff($attempt);
                if ($wait <= 60_000_000) {
                    usleep($wait);
                    continue;
                }
            }
            throw $error;
        }
    }

    private static function backoff(int $attempt): int
    {
        $base = min(8.0, 0.5 * 2 ** $attempt);
        return (int) ($base * (0.75 + mt_rand() / mt_getrandmax() * 0.5) * 1_000_000);
    }

    private static function uuid(): string
    {
        $b = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
        $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }
}
