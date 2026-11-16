# ZapZ (.NET)

SDK oficial da API de WhatsApp da ZapZ para .NET 8+. Sem dependências.

```bash
dotnet add package ZapZ
```

```csharp
using var zapz = new ZapZClient(); // lê ZAPZ_API_KEY
var msg = await zapz.Messages.SendTextAsync("INSTANCE_ID", new { to = "5511999999999", text = "Olá!" });
Console.WriteLine(msg.GetProperty("status").GetString());
```

- Corpo: objeto anônimo ou dicionário; resposta: `JsonElement`. Os campos de cada método estão nos comentários XML.
- Erros: `ZapZException` (`Status`, `Code`, `RetryAfter`) e subclasses `NotFoundException`, `RateLimitException`…
- Webhooks: `Webhook.Verify(rawBody, headers, secret)`.
