<?php

declare(strict_types=1);

namespace ZapZ\Exception;

/** Base class for every error thrown by the SDK. */
class ZapZException extends \RuntimeException
{
    /**
     * @param int|null    $status     HTTP status (null for network errors)
     * @param string|null $errorCode  machine-readable code from the API, e.g. INSTANCE_NOT_CONNECTED
     * @param float|null  $retryAfter seconds to wait before retrying, when the API says so
     * @param mixed       $body       parsed error body
     */
    public function __construct(
        string $message,
        public readonly ?int $status = null,
        public readonly ?string $errorCode = null,
        public readonly ?float $retryAfter = null,
        public readonly mixed $body = null,
    ) {
        parent::__construct($message, $status ?? 0);
    }

    public static function fromResponse(int $status, mixed $body, ?string $retryAfterHeader): self
    {
        $data = is_array($body) ? $body : [];
        $msg = $data['message'] ?? null;
        if (is_array($msg)) {
            $msg = implode('; ', array_map('strval', $msg));
        }
        $message = $msg ? (string) $msg : "HTTP {$status}";
        $retry = $data['retryAfter'] ?? $retryAfterHeader;
        $retryAfter = is_numeric($retry) ? (float) $retry : null;
        $code = isset($data['error']) && is_string($data['error']) ? $data['error'] : null;

        $class = match (true) {
            $status === 400, $status === 422 => ValidationException::class,
            $status === 401 => AuthenticationException::class,
            $status === 403 => PermissionDeniedException::class,
            $status === 404 => NotFoundException::class,
            $status === 409 => ConflictException::class,
            $status === 429 => RateLimitException::class,
            $status >= 500 => InternalServerException::class,
            default => self::class,
        };
        return new $class($message, $status, $code, $retryAfter, $body);
    }
}
