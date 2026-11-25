# zapz (Go)

Official Go 1.21+ SDK for the [ZapZ](https://zapz.dev) WhatsApp API. No dependencies.

Documentation: https://zapz.dev/#/docs · API reference: https://pkg.go.dev/github.com/zapz-api/zapz-sdk/go

```bash
go get github.com/zapz-api/zapz-sdk/go
```

```go
import zapz "github.com/zapz-api/zapz-sdk/go"

client := zapz.New("") // reads ZAPZ_API_KEY
msg, err := client.Messages.SendText(ctx, "INSTANCE_ID", zapz.SendTextParams{
	To:   "5511999999999",
	Text: "Hello!",
})
if zapz.IsRateLimited(err) { /* see err.(*zapz.Error).RetryAfter */ }
```

- Send parameters are typed structs (`SendTextParams`, `SendMediaParams`…); optional numeric/boolean fields are pointers (`zapz.Bool(true)`).
- Options: `zapz.WithBaseURL(...)`, `zapz.WithHTTPClient(...)`, `zapz.WithMaxRetries(n)`.
- Errors: `*zapz.Error` with `Status`, `Code`, `RetryAfter`; helpers `IsNotFound`, `IsRateLimited`, `IsUnauthorized`…
- Webhooks: `zapz.VerifyWebhook(rawBody, r.Header, secret, 0)`.

## License

MIT
