package com.zapz;

import java.util.Map;

/** Thrown for every failed request. Subclasses tell the common cases apart. */
public class ZapZException extends RuntimeException {
    private final int status;
    private final String code;
    private final Double retryAfter;
    private final Object body;

    public ZapZException(String message, int status, String code, Double retryAfter, Object body) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryAfter = retryAfter;
        this.body = body;
    }

    /** HTTP status (0 for connection errors). */
    public int getStatus() { return status; }
    /** Machine-readable code from the API, e.g. INSTANCE_NOT_CONNECTED. */
    public String getCode() { return code; }
    /** Seconds to wait before retrying, when the API says so. */
    public Double getRetryAfter() { return retryAfter; }
    public Object getBody() { return body; }

    public static final class ApiConnectionException extends ZapZException {
        public ApiConnectionException(String m) { super(m, 0, null, null, null); }
    }
    public static final class ValidationException extends ZapZException {
        ValidationException(String m, int s, String c, Double r, Object b) { super(m, s, c, r, b); }
    }
    public static final class AuthenticationException extends ZapZException {
        AuthenticationException(String m, int s, String c, Double r, Object b) { super(m, s, c, r, b); }
    }
    public static final class PermissionDeniedException extends ZapZException {
        PermissionDeniedException(String m, int s, String c, Double r, Object b) { super(m, s, c, r, b); }
    }
    public static final class NotFoundException extends ZapZException {
        NotFoundException(String m, int s, String c, Double r, Object b) { super(m, s, c, r, b); }
    }
    public static final class ConflictException extends ZapZException {
        ConflictException(String m, int s, String c, Double r, Object b) { super(m, s, c, r, b); }
    }
    public static final class RateLimitException extends ZapZException {
        RateLimitException(String m, int s, String c, Double r, Object b) { super(m, s, c, r, b); }
    }
    public static final class InternalServerException extends ZapZException {
        InternalServerException(String m, int s, String c, Double r, Object b) { super(m, s, c, r, b); }
    }
    public static final class WebhookVerificationException extends ZapZException {
        public WebhookVerificationException(String m) { super(m, 0, null, null, null); }
    }

    static ZapZException fromResponse(int status, Object body, String retryHeader) {
        Map<?, ?> m = body instanceof Map<?, ?> mm ? mm : Map.of();
        Object msg = m.get("message");
        String message = msg instanceof java.util.List<?> l ? String.join("; ", l.stream().map(String::valueOf).toList())
                : msg != null ? String.valueOf(msg) : "HTTP " + status;
        String code = m.get("error") instanceof String s ? s : null;
        Double retry = null;
        Object ra = m.get("retryAfter");
        if (ra instanceof Number n) retry = n.doubleValue();
        else if (retryHeader != null) {
            try { retry = Double.parseDouble(retryHeader); } catch (NumberFormatException ignored) { }
        }
        if (status == 400 || status == 422) return new ValidationException(message, status, code, retry, body);
        if (status == 401) return new AuthenticationException(message, status, code, retry, body);
        if (status == 403) return new PermissionDeniedException(message, status, code, retry, body);
        if (status == 404) return new NotFoundException(message, status, code, retry, body);
        if (status == 409) return new ConflictException(message, status, code, retry, body);
        if (status == 429) return new RateLimitException(message, status, code, retry, body);
        if (status >= 500) return new InternalServerException(message, status, code, retry, body);
        return new ZapZException(message, status, code, retry, body);
    }
}
