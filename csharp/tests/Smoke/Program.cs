// Smoke test: ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 dotnet run --project tests/Smoke
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ZapZ;

static void Check(bool ok, string what)
{
    Console.WriteLine((ok ? "✔ " : "✖ ") + what);
    if (!ok) Environment.Exit(1);
}

var secret = "whsec_test";
var body = "{\"event\":\"message_status\",\"data\":{\"status\":\"read\"}}";
var ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
using (var mac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
{
    var sig = "sha256=" + Convert.ToHexString(mac.ComputeHash(Encoding.UTF8.GetBytes(ts + "." + body))).ToLowerInvariant();
    var headers = new Dictionary<string, string> { ["X-Webhook-Timestamp"] = ts, ["X-Webhook-Signature-V2"] = sig };
    Check(Webhook.Verify(body, headers, secret).GetProperty("event").GetString() == "message_status", "webhook verified");
    try { Webhook.Verify(body + " ", headers, secret); Check(false, "tampered body rejected"); }
    catch (WebhookVerificationException) { Check(true, "tampered body rejected"); }
}

if (Environment.GetEnvironmentVariable("ZAPZ_API_KEY") is null)
{
    Console.WriteLine("- sandbox flow skipped (set ZAPZ_API_KEY)");
    return;
}

using var zapz = new ZapZClient();
Check(zapz.IsSandbox, "sandbox key");
var instances = await zapz.Instances.ListAsync();
var inst = instances.EnumerateArray().FirstOrDefault(i => i.TryGetProperty("sandbox", out var s) && s.ValueKind == JsonValueKind.True);
var id = inst.GetProperty("id").GetString()!;

var msg = await zapz.Messages.SendTextAsync(id, new { to = "5511999990001", text = "Olá do SDK .NET" });
var msgId = msg.GetProperty("id").GetString()!;
Check(msgId != "", "clientMessageId generated");
var again = await zapz.Messages.SendTextAsync(id, new { to = "5511999990001", text = "Olá do SDK .NET", clientMessageId = msgId });
Check(again.GetProperty("duplicate").GetBoolean(), "duplicate detected");
Check((await zapz.Messages.GetAsync(id, msgId)).GetProperty("id").GetString() == msgId, "get message");
var hook = await zapz.Webhooks.CreateAsync(new { url = "https://example.com/zapz-sdk-dotnet", events = new[] { "message_status" }, secret = "whsec_sdk_dotnet_123" });
var hookId = hook.GetProperty("id").GetString()!;
Check((await zapz.Webhooks.ListAsync()).EnumerateArray().Any(w => w.GetProperty("id").GetString() == hookId), "webhook listed");
await zapz.Webhooks.DeleteAsync(hookId);
try { await zapz.Messages.GetAsync(id, "does-not-exist"); Check(false, "404 raises NotFoundException"); }
catch (NotFoundException) { Check(true, "404 raises NotFoundException"); }
Console.WriteLine("all good");
