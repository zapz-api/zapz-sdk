# frozen_string_literal: true

# Smoke test: ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 ruby -Ilib test/smoke.rb
require "zapz"

def check(ok, what)
  puts "#{ok ? '✔' : '✖'} #{what}"
  exit 1 unless ok
end

secret = "whsec_test"
body = JSON.generate({ event: "message_status", data: { status: "read" } })
ts = Time.now.to_i.to_s
sig = "sha256=" + OpenSSL::HMAC.hexdigest("SHA256", secret, "#{ts}.#{body}")
ev = ZapZ.verify_webhook(body, { "X-Webhook-Timestamp" => ts, "X-Webhook-Signature-V2" => sig }, secret)
check(ev["event"] == "message_status", "webhook verified")
begin
  ZapZ.verify_webhook(body + " ", { "HTTP_X_WEBHOOK_TIMESTAMP" => ts, "HTTP_X_WEBHOOK_SIGNATURE_V2" => sig }, secret)
  check(false, "tampered body rejected")
rescue ZapZ::WebhookVerificationError
  check(true, "tampered body rejected")
end

unless ENV["ZAPZ_API_KEY"]
  puts "- sandbox flow skipped (set ZAPZ_API_KEY)"
  exit 0
end

zapz = ZapZ::Client.new
check(zapz.sandbox?, "sandbox key")
instances = zapz.instances.list
inst = instances.find { |i| i["sandbox"] } || instances.first
msg = zapz.messages.send_text(inst["id"], { to: "5511999990001", text: "Olá do SDK Ruby" })
check(!msg["id"].to_s.empty?, "clientMessageId generated")
again = zapz.messages.send_text(inst["id"], { to: "5511999990001", text: "Olá do SDK Ruby", clientMessageId: msg["id"] })
check(again["duplicate"] == true, "duplicate detected")
check(zapz.messages.get(inst["id"], msg["id"])["id"] == msg["id"], "get message")
hook = zapz.webhooks.create({ url: "https://example.com/zapz-sdk-ruby", events: ["message_status"], secret: "whsec_sdk_ruby_123" })
check(zapz.webhooks.list.any? { |w| w["id"] == hook["id"] }, "webhook listed")
zapz.webhooks.delete(hook["id"])
begin
  zapz.messages.get(inst["id"], "does-not-exist")
  check(false, "404 raises NotFoundError")
rescue ZapZ::NotFoundError
  check(true, "404 raises NotFoundError")
end
puts "all good"
