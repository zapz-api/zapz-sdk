<?php

declare(strict_types=1);

namespace ZapZ\Exception;

/** 403: the key lacks a scope, the IP is not allowed or the account is suspended. */
final class PermissionDeniedException extends ZapZException
{
}
