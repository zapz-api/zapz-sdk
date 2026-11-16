<?php

declare(strict_types=1);

namespace ZapZ\Exception;

/** The delivery is not signed by ZapZ (or is too old). */
final class WebhookVerificationException extends ZapZException
{
}
