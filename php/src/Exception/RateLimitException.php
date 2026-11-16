<?php

declare(strict_types=1);

namespace ZapZ\Exception;

/** 429: rate limit or anti-ban pacing. See $retryAfter. */
final class RateLimitException extends ZapZException
{
}
