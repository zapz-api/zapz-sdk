"""Integration smoke test against a running API with a sk_test_ key:

    ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056 python -m unittest discover -s tests
"""
import hashlib
import hmac
import json
import os
import time
import unittest

from zapz import NotFoundError, WebhookVerificationError, ZapZ, verify_webhook


class WebhookTest(unittest.TestCase):
    def test_round_trip(self):
        secret = "whsec_test"
        body = json.dumps({"event": "message_status", "data": {"status": "read"}})
        ts = str(int(time.time()))
        sig = "sha256=" + hmac.new(secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
        ev = verify_webhook(body, {"X-Webhook-Timestamp": ts, "X-Webhook-Signature-V2": sig}, secret)
        self.assertEqual(ev["event"], "message_status")
        with self.assertRaises(WebhookVerificationError):
            verify_webhook(body + " ", {"x-webhook-timestamp": ts, "x-webhook-signature-v2": sig}, secret)
        with self.assertRaises(WebhookVerificationError):
            verify_webhook(body, {"x-webhook-timestamp": "1", "x-webhook-signature-v2": sig}, secret)


@unittest.skipUnless(os.environ.get("ZAPZ_API_KEY"), "set ZAPZ_API_KEY (sk_test_) to run")
class SandboxFlowTest(unittest.TestCase):
    def test_flow(self):
        zapz = ZapZ()
        self.assertTrue(zapz.is_sandbox)
        instances = zapz.instances.list()
        inst = next((i for i in instances if i.get("sandbox")), instances[0])

        msg = zapz.messages.send_text(inst["id"], {"to": "5511999990001", "text": "Olá do SDK Python"})
        self.assertTrue(msg["id"])
        again = zapz.messages.send_text(inst["id"], {"to": "5511999990001", "text": "Olá do SDK Python", "clientMessageId": msg["id"]})
        self.assertTrue(again.get("duplicate"))
        self.assertEqual(zapz.messages.get(inst["id"], msg["id"])["id"], msg["id"])

        hook = zapz.webhooks.create({"url": "https://example.com/zapz-sdk-python", "events": ["message_status"], "secret": "whsec_sdk_python_123"})
        self.assertTrue(any(w["id"] == hook["id"] for w in zapz.webhooks.list()))
        zapz.webhooks.delete(hook["id"])

        with self.assertRaises(NotFoundError):
            zapz.messages.get(inst["id"], "does-not-exist")


if __name__ == "__main__":
    unittest.main()
