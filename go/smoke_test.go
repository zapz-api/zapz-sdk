package zapz

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"os"
	"strconv"
	"testing"
	"time"
)

func TestVerifyWebhook(t *testing.T) {
	secret := "whsec_test"
	body := []byte(`{"event":"message_status","data":{"status":"read"}}`)
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + "." + string(body)))
	h := http.Header{}
	h.Set("X-Webhook-Timestamp", ts)
	h.Set("X-Webhook-Signature-V2", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	ev, err := VerifyWebhook(body, h, secret, 0)
	if err != nil || ev.Event != "message_status" {
		t.Fatalf("verify: %v %+v", err, ev)
	}
	if _, err := VerifyWebhook(append(body, ' '), h, secret, 0); err == nil {
		t.Fatal("tampered body accepted")
	}
}

// ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 go test ./...
func TestSandboxFlow(t *testing.T) {
	if os.Getenv("ZAPZ_API_KEY") == "" {
		t.Skip("set ZAPZ_API_KEY (sk_test_) to run")
	}
	ctx := context.Background()
	c := New("")
	if !c.IsSandbox() {
		t.Fatal("expected sk_test_ key")
	}
	list, err := c.Instances.List(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	items := list.([]any)
	inst := items[0].(map[string]any)
	for _, it := range items {
		if m := it.(map[string]any); m["sandbox"] == true {
			inst = m
		}
	}
	id := inst["id"].(string)

	msg, err := c.Messages.SendText(ctx, id, SendTextParams{To: "5511999990001", Text: "Olá do SDK Go"})
	if err != nil || msg.ID == "" {
		t.Fatalf("send: %v", err)
	}
	again, err := c.Messages.SendText(ctx, id, SendTextParams{To: "5511999990001", Text: "Olá do SDK Go", ClientMessageID: msg.ID})
	if err != nil || !again.Duplicate {
		t.Fatalf("duplicate: %v %+v", err, again)
	}
	got, err := c.Messages.Get(ctx, id, msg.ID)
	if err != nil || got.ID != msg.ID {
		t.Fatalf("get: %v", err)
	}
	hook, err := c.Webhooks.Create(ctx, CreateWebhookParams{URL: "https://example.com/zapz-sdk-go", Events: []string{"message_status"}, Secret: "whsec_sdk_go_123"})
	if err != nil || hook["id"] == nil {
		t.Fatalf("webhook: %v", err)
	}
	if _, err := c.Webhooks.Delete(ctx, hook["id"].(string)); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Messages.Get(ctx, id, "does-not-exist"); !IsNotFound(err) {
		t.Fatalf("expected 404, got %v", err)
	}
}
