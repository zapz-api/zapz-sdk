# zapz-go

SDK oficial da API de WhatsApp da ZapZ para Go 1.21+. Sem dependências.

```bash
go get github.com/zapz-api/zapz-sdk/go
```

```go
client := zapz.New("") // lê ZAPZ_API_KEY
msg, err := client.Messages.SendText(ctx, "INSTANCE_ID", zapz.SendTextParams{
	To:   "5511999999999",
	Text: "Olá!",
})
if zapz.IsRateLimited(err) { /* veja err.(*zapz.Error).RetryAfter */ }
```

- Parâmetros de envio são structs tipadas (`SendTextParams`, `SendMediaParams`…); campos opcionais numéricos/booleanos usam ponteiro (`zapz.Bool(true)`).
- Opções: `zapz.WithBaseURL(...)`, `zapz.WithHTTPClient(...)`, `zapz.WithMaxRetries(n)`.
- Erros: `*zapz.Error` com `Status`, `Code`, `RetryAfter`; helpers `IsNotFound`, `IsRateLimited`, `IsUnauthorized`…
- Webhooks: `zapz.VerifyWebhook(rawBody, r.Header, secret, 0)`.
