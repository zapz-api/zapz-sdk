package com.zapz;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Verifies ZapZ webhook deliveries (X-Webhook-Signature-V2). */
public final class Webhook {
    private Webhook() {}

    /**
     * Checks the signature against the RAW body and returns the parsed event.
     *
     * @param headers request headers (any case)
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> verify(String rawBody, Map<String, String> headers, String secret) {
        return verify(rawBody, headers, secret, 300);
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> verify(String rawBody, Map<String, String> headers, String secret, long toleranceSeconds) {
        String ts = header(headers, "x-webhook-timestamp");
        String sig = header(headers, "x-webhook-signature-v2");
        if (ts == null || sig == null || !ts.matches("\\d+")) {
            throw new ZapZException.WebhookVerificationException("Missing X-Webhook-Timestamp or X-Webhook-Signature-V2 header");
        }
        if (Math.abs(System.currentTimeMillis() / 1000 - Long.parseLong(ts)) > toleranceSeconds) {
            throw new ZapZException.WebhookVerificationException("Webhook timestamp outside the tolerance window");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String expected = "sha256=" + HexFormat.of().formatHex(mac.doFinal((ts + "." + rawBody).getBytes(StandardCharsets.UTF_8)));
            if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), sig.getBytes(StandardCharsets.UTF_8))) {
                throw new ZapZException.WebhookVerificationException("Invalid webhook signature");
            }
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
        Object ev = Json.parse(rawBody);
        if (!(ev instanceof Map)) throw new ZapZException.WebhookVerificationException("Webhook body is not a JSON object");
        return (Map<String, Object>) ev;
    }

    private static String header(Map<String, String> headers, String name) {
        for (Map.Entry<String, String> e : headers.entrySet()) {
            if (e.getKey() != null && e.getKey().equalsIgnoreCase(name)) return e.getValue();
        }
        return null;
    }
}
