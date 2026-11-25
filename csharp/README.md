# ZapZ (.NET)

Official .NET 8+ SDK for the [ZapZ](https://zapz.dev) WhatsApp API. No dependencies.

Documentation: https://zapz.dev/#/docs

```bash
dotnet add package ZapZ
```

```csharp
using var zapz = new ZapZClient(); // reads ZAPZ_API_KEY
var msg = await zapz.Messages.SendTextAsync("INSTANCE_ID", new { to = "5511999999999", text = "Hello!" });
Console.WriteLine(msg.GetProperty("status").GetString());
```

- Body: anonymous object or dictionary; response: `JsonElement`. The fields of each method are in the XML comments.
- Errors: `ZapZException` (`Status`, `Code`, `RetryAfter`) and subclasses `NotFoundException`, `RateLimitException`…
- Webhooks: `Webhook.Verify(rawBody, headers, secret)`.

## License

MIT
