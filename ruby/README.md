# zapz (Ruby)

SDK oficial da API de WhatsApp da ZapZ para Ruby 3.0+. Só biblioteca padrão.

```bash
gem install zapz
```

```ruby
require "zapz"

zapz = ZapZ::Client.new # lê ZAPZ_API_KEY
msg = zapz.messages.send_text("INSTANCE_ID", { to: "5511999999999", text: "Olá!" })
puts msg["status"]
```

- Erros: `ZapZ::Error` (`status`, `code`, `retry_after`) e subclasses `ZapZ::NotFoundError`, `ZapZ::RateLimitError`…
- Webhooks (Rails): `ZapZ.verify_webhook(request.raw_post, request.headers, ENV["ZAPZ_WEBHOOK_SECRET"])`.
