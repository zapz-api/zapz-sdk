#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ZapZ;

/// <summary>Verifies ZapZ webhook deliveries (X-Webhook-Signature-V2).</summary>
public static class Webhook
{
    /// <summary>Checks the signature against the RAW body and returns the parsed event.</summary>
    /// <param name="headers">Request headers (any case), e.g. Request.Headers in ASP.NET Core.</param>
    public static JsonElement Verify(string rawBody, IEnumerable<KeyValuePair<string, string>> headers, string secret, int toleranceSeconds = 300)
    {
        var list = headers.ToList();
        string? H(string n) => list.FirstOrDefault(h => string.Equals(h.Key, n, StringComparison.OrdinalIgnoreCase)).Value;
        var ts = H("x-webhook-timestamp");
        var sig = H("x-webhook-signature-v2");
        if (ts is null || sig is null || !long.TryParse(ts, out var t))
            throw new WebhookVerificationException("Missing X-Webhook-Timestamp or X-Webhook-Signature-V2 header");
        if (Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - t) > toleranceSeconds)
            throw new WebhookVerificationException("Webhook timestamp outside the tolerance window");
        using var mac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var expected = "sha256=" + Convert.ToHexString(mac.ComputeHash(Encoding.UTF8.GetBytes(ts + "." + rawBody))).ToLowerInvariant();
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(sig)))
            throw new WebhookVerificationException("Invalid webhook signature");
        using var doc = JsonDocument.Parse(rawBody);
        return doc.RootElement.Clone();
    }
}
