package com.zapz;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Smoke test: ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 java ... com.zapz.Smoke */
public final class Smoke {
    static void check(boolean ok, String what) {
        System.out.println((ok ? "✔ " : "✖ ") + what);
        if (!ok) System.exit(1);
    }

    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        String secret = "whsec_test";
        String body = "{\"event\":\"message_status\",\"data\":{\"status\":\"read\"}}";
        String ts = String.valueOf(System.currentTimeMillis() / 1000);
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String sig = "sha256=" + HexFormat.of().formatHex(mac.doFinal((ts + "." + body).getBytes(StandardCharsets.UTF_8)));
        check("message_status".equals(Webhook.verify(body, Map.of("X-Webhook-Timestamp", ts, "X-Webhook-Signature-V2", sig), secret).get("event")), "webhook verified");
        try {
            Webhook.verify(body + " ", Map.of("x-webhook-timestamp", ts, "x-webhook-signature-v2", sig), secret);
            check(false, "tampered body rejected");
        } catch (ZapZException.WebhookVerificationException e) {
            check(true, "tampered body rejected");
        }
        if (System.getenv("ZAPZ_API_KEY") == null) {
            System.out.println("- sandbox flow skipped (set ZAPZ_API_KEY)");
            return;
        }
        ZapZ zapz = new ZapZ();
        check(zapz.isSandbox(), "sandbox key");
        List<Object> instances = (List<Object>) zapz.instances.list();
        Map<String, Object> inst = (Map<String, Object>) instances.get(0);
        for (Object o : instances) if (Boolean.TRUE.equals(((Map<String, Object>) o).get("sandbox"))) inst = (Map<String, Object>) o;
        String id = (String) inst.get("id");

        Map<String, Object> msg = zapz.messages.sendText(id, Map.of("to", "5511999990001", "text", "Olá do SDK Java"));
        check(msg.get("id") != null, "clientMessageId generated");
        Map<String, Object> again = zapz.messages.sendText(id, Map.of("to", "5511999990001", "text", "Olá do SDK Java", "clientMessageId", msg.get("id")));
        check(Boolean.TRUE.equals(again.get("duplicate")), "duplicate detected");
        check(msg.get("id").equals(zapz.messages.get(id, (String) msg.get("id")).get("id")), "get message");
        Map<String, Object> hook = zapz.webhooks.create(Map.of("url", "https://example.com/zapz-sdk-java", "events", List.of("message_status"), "secret", "whsec_sdk_java_123"));
        check(((List<Object>) zapz.webhooks.list()).stream().anyMatch(w -> hook.get("id").equals(((Map<String, Object>) w).get("id"))), "webhook listed");
        zapz.webhooks.delete((String) hook.get("id"));
        try {
            zapz.messages.get(id, "does-not-exist");
            check(false, "404 raises NotFoundException");
        } catch (ZapZException.NotFoundException e) {
            check(true, "404 raises NotFoundException");
        }
        System.out.println("all good");
    }
}
