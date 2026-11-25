#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

namespace ZapZ;

/// <summary>
/// ZapZ API client. Bodies are anonymous objects or dictionaries; responses are <see cref="JsonElement"/>.
/// <code>
/// var zapz = new ZapZClient("sk_live_...");
/// var msg = await zapz.Messages.SendTextAsync("INSTANCE_ID", new { to = "5511999999999", text = "Olá!" });
/// </code>
/// </summary>
public sealed class ZapZClient : IDisposable
{
    public const string DefaultBaseUrl = "https://api.zapz.dev";
    public const string Version = "0.1.4";

    private readonly string _apiKey;
    private readonly HttpClient _http;
    private readonly bool _ownsHttp;
    private readonly int _maxRetries;

    public string BaseUrl { get; }
    public InstancesResource Instances { get; }
    public MessagesResource Messages { get; }
    public ContactsResource Contacts { get; }
    public GroupsResource Groups { get; }
    public WebhooksResource Webhooks { get; }
    public SandboxResource Sandbox { get; }

    /// <param name="apiKey">null reads ZAPZ_API_KEY.</param>
    /// <param name="baseUrl">null reads ZAPZ_BASE_URL, then production. Use the sandbox URL with sk_test_ keys.</param>
    /// <param name="maxRetries">Retries for 429/503 and safe network failures.</param>
    public ZapZClient(string? apiKey = null, string? baseUrl = null, TimeSpan? timeout = null, int maxRetries = 2, HttpClient? httpClient = null)
    {
        _apiKey = apiKey ?? Environment.GetEnvironmentVariable("ZAPZ_API_KEY")
            ?? throw new ZapZException("Missing API key: pass it or set ZAPZ_API_KEY.");
        var url = (baseUrl ?? Environment.GetEnvironmentVariable("ZAPZ_BASE_URL") ?? DefaultBaseUrl).TrimEnd('/');
        BaseUrl = url.EndsWith("/v1") ? url[..^3] : url;
        _maxRetries = maxRetries;
        _ownsHttp = httpClient is null;
        _http = httpClient ?? new HttpClient { Timeout = timeout ?? TimeSpan.FromSeconds(30) };
        Instances = new InstancesResource(this);
        Messages = new MessagesResource(this);
        Contacts = new ContactsResource(this);
        Groups = new GroupsResource(this);
        Webhooks = new WebhooksResource(this);
        Sandbox = new SandboxResource(this);
    }

    /// <summary>True for sk_test_ keys (nothing reaches WhatsApp).</summary>
    public bool IsSandbox => _apiKey.StartsWith("sk_test_", StringComparison.Ordinal);

    internal static string Encode(string v) => Uri.EscapeDataString(v);

    internal async Task<JsonElement> RequestAsync(string method, string path, object? body, IDictionary<string, object?>? query, bool autoClientMessageId, CancellationToken ct)
    {
        JsonNode? node = body is null ? null : JsonSerializer.SerializeToNode(body);
        if (autoClientMessageId && node is JsonObject obj && (obj["clientMessageId"] is null || obj["clientMessageId"]!.ToString() == ""))
            obj["clientMessageId"] = Guid.NewGuid().ToString();
        var payload = node?.ToJsonString();

        var url = new StringBuilder(BaseUrl).Append("/v1").Append(path);
        var q = query?.Where(kv => kv.Value is not null)
            .Select(kv => Encode(kv.Key) + "=" + Encode(kv.Value is bool b ? (b ? "true" : "false") : Convert.ToString(kv.Value, System.Globalization.CultureInfo.InvariantCulture)!))
            .ToList();
        if (q is { Count: > 0 }) url.Append('?').Append(string.Join("&", q));

        // a retry is safe when the request is idempotent or carries an idempotency key
        var idempotent = method is "GET" or "DELETE" || (node is JsonObject o2 && o2["clientMessageId"] is not null);

        for (var attempt = 0; ; attempt++)
        {
            using var req = new HttpRequestMessage(new HttpMethod(method), url.ToString());
            req.Headers.TryAddWithoutValidation("Authorization", "Bearer " + _apiKey);
            req.Headers.TryAddWithoutValidation("Accept", "application/json");
            req.Headers.TryAddWithoutValidation("User-Agent", "zapz-dotnet/" + Version);
            if (payload is not null) req.Content = new StringContent(payload, Encoding.UTF8, "application/json");

            HttpResponseMessage res;
            try
            {
                res = await _http.SendAsync(req, ct).ConfigureAwait(false);
            }
            catch (Exception e) when (e is HttpRequestException || (e is TaskCanceledException && !ct.IsCancellationRequested))
            {
                if (idempotent && attempt < _maxRetries)
                {
                    await Task.Delay(Backoff(attempt), ct).ConfigureAwait(false);
                    continue;
                }
                throw new ApiConnectionException("Connection error: " + e.Message);
            }

            using (res)
            {
                var text = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                var status = (int)res.StatusCode;
                if (status is >= 200 and < 300)
                {
                    if (string.IsNullOrWhiteSpace(text)) return default;
                    using var doc = JsonDocument.Parse(text);
                    return doc.RootElement.Clone();
                }
                var retryHeader = res.Headers.RetryAfter?.Delta?.TotalSeconds;
                var err = ZapZException.FromResponse(status, text, retryHeader);
                var refused = status is 429 or 503;
                var transientErr = status is 502 or 504;
                if (attempt < _maxRetries && (refused || (transientErr && idempotent)))
                {
                    var wait = err.RetryAfter is double s ? TimeSpan.FromSeconds(s) : Backoff(attempt);
                    if (wait <= TimeSpan.FromMinutes(1))
                    {
                        await Task.Delay(wait, ct).ConfigureAwait(false);
                        continue;
                    }
                }
                throw err;
            }
        }
    }

    private static TimeSpan Backoff(int attempt) =>
        TimeSpan.FromSeconds(Math.Min(8, 0.5 * Math.Pow(2, attempt)) * (0.75 + Random.Shared.NextDouble() * 0.5));

    public void Dispose()
    {
        if (_ownsHttp) _http.Dispose();
    }
}
