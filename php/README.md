# zapz/zapz-php

SDK oficial da API de WhatsApp da ZapZ para PHP 8.1+. Só precisa de `ext-curl`.

```bash
composer require zapz/zapz-php
```

```php
$zapz = new ZapZ\ZapZ(getenv('ZAPZ_API_KEY'));
$msg = $zapz->messages->sendText('INSTANCE_ID', ['to' => '5511999999999', 'text' => 'Olá!']);
echo $msg['id'];
```

Recursos: `instances`, `messages`, `contacts`, `groups`, `webhooks`, `sandbox`. O formato de cada parâmetro está no PHPDoc (array shapes), útil com PhpStorm e PHPStan.

Opções: `new ZapZ($key, ['baseUrl' => ..., 'timeout' => 30.0, 'maxRetries' => 2])`.

Exceções herdam de `ZapZ\Exception\ZapZException` (`status`, `errorCode`, `retryAfter`, `body`).

## Webhooks (Laravel)

```php
$event = ZapZ\Webhook::verify($request->getContent(), $request->headers->all(), env('ZAPZ_WEBHOOK_SECRET'));
```
