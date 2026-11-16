// Package zapz is the official Go SDK for the ZapZ WhatsApp API.
//
//	client := zapz.New("sk_live_...")
//	msg, err := client.Messages.SendText(ctx, "INSTANCE_ID", zapz.SendTextParams{To: "5511999999999", Text: "Olá!"})
package zapz

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	mrand "math/rand"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	// DefaultBaseURL is the production API.
	DefaultBaseURL = "https://api.zapz.com"
	// Version of this SDK.
	Version = "0.1.0"
)

// Client talks to the ZapZ API. Create it with New.
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	maxRetries int

	Instances *InstancesService
	Messages  *MessagesService
	Contacts  *ContactsService
	Groups    *GroupsService
	Webhooks  *WebhooksService
	Sandbox   *SandboxService
}

// Option configures a Client.
type Option func(*Client)

// WithBaseURL points the client at another environment (e.g. the sandbox URL).
func WithBaseURL(u string) Option { return func(c *Client) { c.baseURL = u } }

// WithHTTPClient replaces the HTTP client (timeouts, proxies, tests).
func WithHTTPClient(h *http.Client) Option { return func(c *Client) { c.httpClient = h } }

// WithMaxRetries sets retries for 429/503 and safe network failures (default 2).
func WithMaxRetries(n int) Option { return func(c *Client) { c.maxRetries = n } }

// New creates a client. An empty apiKey reads ZAPZ_API_KEY; ZAPZ_BASE_URL overrides the URL.
func New(apiKey string, opts ...Option) *Client {
	if apiKey == "" {
		apiKey = os.Getenv("ZAPZ_API_KEY")
	}
	base := os.Getenv("ZAPZ_BASE_URL")
	if base == "" {
		base = DefaultBaseURL
	}
	c := &Client{apiKey: apiKey, baseURL: base, httpClient: &http.Client{Timeout: 30 * time.Second}, maxRetries: 2}
	for _, o := range opts {
		o(c)
	}
	c.baseURL = strings.TrimSuffix(strings.TrimRight(c.baseURL, "/"), "/v1")
	c.Instances = &InstancesService{c}
	c.Messages = &MessagesService{c}
	c.Contacts = &ContactsService{c}
	c.Groups = &GroupsService{c}
	c.Webhooks = &WebhooksService{c}
	c.Sandbox = &SandboxService{c}
	return c
}

// IsSandbox reports whether the key is a sk_test_ key (nothing reaches WhatsApp).
func (c *Client) IsSandbox() bool { return strings.HasPrefix(c.apiKey, "sk_test_") }

func (c *Client) do(ctx context.Context, method, path string, query url.Values, body any, out any) error {
	if c.apiKey == "" {
		return &Error{Message: "missing API key: pass it to zapz.New or set ZAPZ_API_KEY"}
	}
	var payload []byte
	if body != nil {
		var err error
		if payload, err = json.Marshal(body); err != nil {
			return err
		}
	}
	u := c.baseURL + "/v1" + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	// a retry is safe when the request is idempotent or carries an idempotency key
	idempotent := method == http.MethodGet || method == http.MethodDelete || bytes.Contains(payload, []byte(`"clientMessageId"`))

	for attempt := 0; ; attempt++ {
		var rdr io.Reader
		if payload != nil {
			rdr = bytes.NewReader(payload)
		}
		req, err := http.NewRequestWithContext(ctx, method, u, rdr)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "zapz-go/"+Version)
		if payload != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		res, err := c.httpClient.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if idempotent && attempt < c.maxRetries {
				sleep(ctx, backoff(attempt))
				continue
			}
			return &Error{Message: "connection error: " + err.Error(), Connection: true}
		}
		raw, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode >= 200 && res.StatusCode < 300 {
			if out == nil || len(bytes.TrimSpace(raw)) == 0 {
				return nil
			}
			return json.Unmarshal(raw, out)
		}
		apiErr := errorFromResponse(res.StatusCode, raw, res.Header.Get("Retry-After"))
		refused := res.StatusCode == 429 || res.StatusCode == 503
		transient := res.StatusCode == 502 || res.StatusCode == 504
		if attempt < c.maxRetries && (refused || (transient && idempotent)) {
			wait := backoff(attempt)
			if apiErr.RetryAfter > 0 {
				wait = time.Duration(apiErr.RetryAfter * float64(time.Second))
			}
			if wait <= time.Minute {
				sleep(ctx, wait)
				continue
			}
		}
		return apiErr
	}
}

func backoff(attempt int) time.Duration {
	base := math.Min(8, 0.5*math.Pow(2, float64(attempt)))
	return time.Duration(base * (0.75 + mrand.Float64()*0.5) * float64(time.Second))
}

func sleep(ctx context.Context, d time.Duration) {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
	case <-t.C:
	}
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:]
}

func fmtAny(v any) string { return fmt.Sprint(v) }

// Bool returns a pointer, for optional boolean fields.
func Bool(v bool) *bool { return &v }

// Int returns a pointer, for optional integer fields.
func Int(v int) *int { return &v }

// Float returns a pointer, for optional number fields.
func Float(v float64) *float64 { return &v }

// String returns a pointer, for nullable string fields.
func String(v string) *string { return &v }

// Error is returned for every failed request. Use errors.As to inspect it.
type Error struct {
	// HTTP status (0 for connection errors).
	Status int
	// Machine-readable code from the API, e.g. INSTANCE_NOT_CONNECTED.
	Code    string
	Message string
	// Seconds to wait before retrying, when the API says so.
	RetryAfter float64
	Body       json.RawMessage
	Connection bool
}

func (e *Error) Error() string {
	if e.Status == 0 {
		return "zapz: " + e.Message
	}
	if e.Code != "" {
		return fmt.Sprintf("zapz: %d %s: %s", e.Status, e.Code, e.Message)
	}
	return fmt.Sprintf("zapz: %d: %s", e.Status, e.Message)
}

// IsNotFound, IsRateLimited, ... help branch on common cases.
func IsNotFound(err error) bool        { return hasStatus(err, 404) }
func IsRateLimited(err error) bool     { return hasStatus(err, 429) }
func IsUnauthorized(err error) bool    { return hasStatus(err, 401) }
func IsForbidden(err error) bool       { return hasStatus(err, 403) }
func IsConflict(err error) bool        { return hasStatus(err, 409) }
func IsValidationError(err error) bool { return hasStatus(err, 400) || hasStatus(err, 422) }

func hasStatus(err error, s int) bool {
	var e *Error
	return errors.As(err, &e) && e.Status == s
}

func errorFromResponse(status int, raw []byte, retryHeader string) *Error {
	e := &Error{Status: status, Body: raw, Message: fmt.Sprintf("HTTP %d", status)}
	var body struct {
		Error      any `json:"error"`
		Message    any `json:"message"`
		RetryAfter any `json:"retryAfter"`
	}
	if json.Unmarshal(raw, &body) == nil {
		if s, ok := body.Error.(string); ok {
			e.Code = s
		}
		switch m := body.Message.(type) {
		case string:
			e.Message = m
		case []any:
			parts := make([]string, 0, len(m))
			for _, p := range m {
				parts = append(parts, fmt.Sprint(p))
			}
			e.Message = strings.Join(parts, "; ")
		}
		if n, ok := body.RetryAfter.(float64); ok {
			e.RetryAfter = n
		}
	}
	if e.RetryAfter == 0 && retryHeader != "" {
		if n, err := strconv.ParseFloat(retryHeader, 64); err == nil {
			e.RetryAfter = n
		}
	}
	return e
}

// Message is returned by every send and message endpoint.
type Message struct {
	// Your clientMessageId (generated by the SDK when empty).
	ID          string  `json:"id"`
	ExternalID  *string `json:"externalId"`
	To          string  `json:"to"`
	Type        string  `json:"type"`
	Status      string  `json:"status"`
	Error       *string `json:"error"`
	ScheduledAt *string `json:"scheduledAt"`
	SentAt      *string `json:"sentAt"`
	DeliveredAt *string `json:"deliveredAt"`
	ReadAt      *string `json:"readAt"`
	EditedAt    *string `json:"editedAt"`
	RevokedAt   *string `json:"revokedAt"`
	CreatedAt   string  `json:"createdAt"`
	// True when the same clientMessageId was already accepted.
	Duplicate bool `json:"duplicate,omitempty"`
	// Set by Delete: "canceled" or "revoked".
	Action string `json:"action,omitempty"`
}
