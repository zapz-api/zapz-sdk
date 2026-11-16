package zapz

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"
)

// ErrInvalidWebhook is returned when a delivery is not signed by ZapZ or is too old.
var ErrInvalidWebhook = errors.New("zapz: invalid webhook signature")

// WebhookEvent is the body of every webhook delivery.
type WebhookEvent struct {
	Event      string         `json:"event"`
	InstanceID string         `json:"instanceId"`
	Timestamp  int64          `json:"timestamp"`
	Sandbox    bool           `json:"sandbox"`
	Data       map[string]any `json:"data"`
}

// VerifyWebhook checks X-Webhook-Signature-V2 against the RAW body and returns the event.
// tolerance 0 means 5 minutes.
func VerifyWebhook(rawBody []byte, header http.Header, secret string, tolerance time.Duration) (*WebhookEvent, error) {
	if tolerance == 0 {
		tolerance = 5 * time.Minute
	}
	ts := header.Get("X-Webhook-Timestamp")
	sig := header.Get("X-Webhook-Signature-V2")
	n, err := strconv.ParseInt(ts, 10, 64)
	if ts == "" || sig == "" || err != nil {
		return nil, ErrInvalidWebhook
	}
	if d := time.Since(time.Unix(n, 0)); d > tolerance || d < -tolerance {
		return nil, ErrInvalidWebhook
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + "."))
	mac.Write(rawBody)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(sig)) {
		return nil, ErrInvalidWebhook
	}
	ev := new(WebhookEvent)
	if err := json.Unmarshal(rawBody, ev); err != nil {
		return nil, err
	}
	return ev, nil
}
