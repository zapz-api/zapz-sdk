# zapz/sdk (PHP)

Official PHP 8.1+ SDK for the [ZapZ](https://zapz.dev) WhatsApp API. Needs only `ext-curl`.

Documentation: https://zapz.dev/#/docs

```bash
composer require zapz/sdk
```

```php
$zapz = new ZapZ\ZapZ(getenv('ZAPZ_API_KEY'));
$msg = $zapz->messages->sendText('INSTANCE_ID', ['to' => '5511999999999', 'text' => 'Hello!']);
echo $msg['id'];
```

Resources: `instances`, `messages`, `contacts`, `groups`, `webhooks`, `sandbox`. The shape of each parameter is in the PHPDoc (array shapes), which PhpStorm and PHPStan understand.

Options: `new ZapZ($key, ['baseUrl' => ..., 'timeout' => 30.0, 'maxRetries' => 2])`.

Exceptions extend `ZapZ\Exception\ZapZException` (`status`, `errorCode`, `retryAfter`, `body`).

## Webhooks (Laravel)

```php
$event = ZapZ\Webhook::verify($request->getContent(), $request->headers->all(), env('ZAPZ_WEBHOOK_SECRET'));
```

## License

MIT
