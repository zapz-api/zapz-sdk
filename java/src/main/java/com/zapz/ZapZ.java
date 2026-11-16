package com.zapz;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.StringJoiner;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * ZapZ API client (Java 17+, no dependencies).
 *
 * <pre>{@code
 * ZapZ zapz = new ZapZ("sk_live_...");
 * Map<String, Object> msg = zapz.messages.sendText("INSTANCE_ID", Map.of("to", "5511999999999", "text", "Olá!"));
 * }</pre>
 */
public final class ZapZ {
    public static final String DEFAULT_BASE_URL = "https://api.zapz.com";
    public static final String VERSION = "0.1.0";

    public final InstancesResource instances = new InstancesResource(this);
    public final MessagesResource messages = new MessagesResource(this);
    public final ContactsResource contacts = new ContactsResource(this);
    public final GroupsResource groups = new GroupsResource(this);
    public final WebhooksResource webhooks = new WebhooksResource(this);
    public final SandboxResource sandbox = new SandboxResource(this);

    private final String apiKey;
    private final String baseUrl;
    private final Duration timeout;
    private final int maxRetries;
    private final HttpClient http;

    /** Reads ZAPZ_API_KEY and ZAPZ_BASE_URL. */
    public ZapZ() {
        this(null);
    }

    public ZapZ(String apiKey) {
        this(apiKey, null, Duration.ofSeconds(30), 2);
    }

    /**
     * @param baseUrl    null for ZAPZ_BASE_URL or production; use the sandbox URL with sk_test_ keys
     * @param maxRetries retries for 429/503 and safe network failures
     */
    public ZapZ(String apiKey, String baseUrl, Duration timeout, int maxRetries) {
        String key = apiKey != null ? apiKey : System.getenv("ZAPZ_API_KEY");
        if (key == null || key.isEmpty()) throw new ZapZException("Missing API key: pass it or set ZAPZ_API_KEY.", 0, null, null, null);
        this.apiKey = key;
        String url = baseUrl != null ? baseUrl : System.getenv("ZAPZ_BASE_URL");
        if (url == null || url.isEmpty()) url = DEFAULT_BASE_URL;
        url = url.replaceAll("/+$", "");
        this.baseUrl = url.endsWith("/v1") ? url.substring(0, url.length() - 3) : url;
        this.timeout = timeout;
        this.maxRetries = maxRetries;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    /** True for sk_test_ keys (nothing reaches WhatsApp). */
    public boolean isSandbox() {
        return apiKey.startsWith("sk_test_");
    }

    static String encode(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8).replace("+", "%20");
    }

    Object request(String method, String path, Map<String, Object> body, Map<String, Object> query, boolean autoClientMessageId) {
        if (autoClientMessageId && body != null && (body.get("clientMessageId") == null || "".equals(body.get("clientMessageId")))) {
            body = new LinkedHashMap<>(body);
            body.put("clientMessageId", UUID.randomUUID().toString());
        }
        StringBuilder url = new StringBuilder(baseUrl).append("/v1").append(path);
        if (query != null && !query.isEmpty()) {
            StringJoiner q = new StringJoiner("&");
            query.forEach((k, v) -> {
                if (v != null) q.add(encode(k) + "=" + encode(String.valueOf(v)));
            });
            if (q.length() > 0) url.append('?').append(q);
        }
        String payload = body == null ? null : Json.stringify(body);
        // a retry is safe when the request is idempotent or carries an idempotency key
        boolean idempotent = method.equals("GET") || method.equals("DELETE") || (body != null && body.get("clientMessageId") != null);

        for (int attempt = 0; ; attempt++) {
            HttpRequest.Builder rb = HttpRequest.newBuilder(URI.create(url.toString()))
                    .timeout(timeout)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .header("User-Agent", "zapz-java/" + VERSION);
            if (payload != null) {
                rb.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(payload));
            } else {
                rb.method(method, HttpRequest.BodyPublishers.noBody());
            }
            HttpResponse<String> res;
            try {
                res = http.send(rb.build(), HttpResponse.BodyHandlers.ofString());
            } catch (IOException e) {
                if (idempotent && attempt < maxRetries) {
                    sleep(backoff(attempt));
                    continue;
                }
                throw new ZapZException.ApiConnectionException("Connection error: " + e.getMessage());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ZapZException.ApiConnectionException("Interrupted");
            }
            String text = res.body();
            Object data = null;
            if (text != null && !text.isBlank()) {
                try { data = Json.parse(text); } catch (RuntimeException e) { data = text; }
            }
            int status = res.statusCode();
            if (status >= 200 && status < 300) return data;
            ZapZException err = ZapZException.fromResponse(status, data, res.headers().firstValue("Retry-After").orElse(null));
            boolean refused = status == 429 || status == 503;
            boolean transientErr = status == 502 || status == 504;
            if (attempt < maxRetries && (refused || (transientErr && idempotent))) {
                long wait = err.getRetryAfter() != null ? (long) (err.getRetryAfter() * 1000) : backoff(attempt);
                if (wait <= 60_000) {
                    sleep(wait);
                    continue;
                }
            }
            throw err;
        }
    }

    private static long backoff(int attempt) {
        double base = Math.min(8.0, 0.5 * Math.pow(2, attempt));
        return (long) (base * (0.75 + ThreadLocalRandom.current().nextDouble() * 0.5) * 1000);
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
