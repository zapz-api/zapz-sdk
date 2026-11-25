# zapz (Ruby)

Official Ruby 3.0+ SDK for the [ZapZ](https://zapz.dev) WhatsApp API. Standard library only.

Documentation: https://zapz.dev/#/docs

```bash
gem install zapz
```

```ruby
require "zapz"

zapz = ZapZ::Client.new # reads ZAPZ_API_KEY
msg = zapz.messages.send_text("INSTANCE_ID", { to: "5511999999999", text: "Hello!" })
puts msg["status"]
```

- Errors: `ZapZ::Error` (`status`, `code`, `retry_after`) and subclasses `ZapZ::NotFoundError`, `ZapZ::RateLimitError`…
- Webhooks (Rails): `ZapZ.verify_webhook(request.raw_post, request.headers, ENV["ZAPZ_WEBHOOK_SECRET"])`.

## License

MIT
