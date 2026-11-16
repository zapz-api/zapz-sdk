#nullable enable
using System;
using System.Linq;
using System.Text.Json;

namespace ZapZ;

/// <summary>Thrown for every failed request. Subclasses tell the common cases apart.</summary>
public class ZapZException : Exception
{
    /// <summary>HTTP status (0 for connection errors).</summary>
    public int Status { get; }
    /// <summary>Machine-readable code from the API, e.g. INSTANCE_NOT_CONNECTED.</summary>
    public string? Code { get; }
    /// <summary>Seconds to wait before retrying, when the API says so.</summary>
    public double? RetryAfter { get; }
    public string? Body { get; }

    public ZapZException(string message, int status = 0, string? code = null, double? retryAfter = null, string? body = null) : base(message)
    {
        Status = status;
        Code = code;
        RetryAfter = retryAfter;
        Body = body;
    }

    internal static ZapZException FromResponse(int status, string text, double? retryHeader)
    {
        string message = $"HTTP {status}";
        string? code = null;
        double? retry = retryHeader;
        try
        {
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object)
            {
                if (root.TryGetProperty("message", out var m))
                    message = m.ValueKind == JsonValueKind.Array ? string.Join("; ", m.EnumerateArray().Select(x => x.ToString())) : m.ToString();
                if (root.TryGetProperty("error", out var e) && e.ValueKind == JsonValueKind.String) code = e.GetString();
                if (root.TryGetProperty("retryAfter", out var r) && r.ValueKind == JsonValueKind.Number) retry = r.GetDouble();
            }
        }
        catch (JsonException) { }
        return status switch
        {
            400 or 422 => new ValidationException(message, status, code, retry, text),
            401 => new AuthenticationException(message, status, code, retry, text),
            403 => new PermissionDeniedException(message, status, code, retry, text),
            404 => new NotFoundException(message, status, code, retry, text),
            409 => new ConflictException(message, status, code, retry, text),
            429 => new RateLimitException(message, status, code, retry, text),
            >= 500 => new InternalServerException(message, status, code, retry, text),
            _ => new ZapZException(message, status, code, retry, text),
        };
    }
}

public sealed class ApiConnectionException(string m) : ZapZException(m);
public sealed class ValidationException(string m, int s, string? c, double? r, string? b) : ZapZException(m, s, c, r, b);
public sealed class AuthenticationException(string m, int s, string? c, double? r, string? b) : ZapZException(m, s, c, r, b);
public sealed class PermissionDeniedException(string m, int s, string? c, double? r, string? b) : ZapZException(m, s, c, r, b);
public sealed class NotFoundException(string m, int s, string? c, double? r, string? b) : ZapZException(m, s, c, r, b);
public sealed class ConflictException(string m, int s, string? c, double? r, string? b) : ZapZException(m, s, c, r, b);
public sealed class RateLimitException(string m, int s, string? c, double? r, string? b) : ZapZException(m, s, c, r, b);
public sealed class InternalServerException(string m, int s, string? c, double? r, string? b) : ZapZException(m, s, c, r, b);
public sealed class WebhookVerificationException(string m) : ZapZException(m);
