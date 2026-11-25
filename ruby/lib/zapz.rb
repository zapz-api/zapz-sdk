# frozen_string_literal: true

require "json"
require "net/http"
require "openssl"
require "securerandom"
require "uri"

# Official Ruby SDK for the ZapZ WhatsApp API (stdlib only).
#
#   zapz = ZapZ::Client.new(api_key: "sk_live_...")
#   zapz.messages.send_text("INSTANCE_ID", { to: "5511999999999", text: "Olá!" })
module ZapZ
  VERSION = "0.1.3"
  DEFAULT_BASE_URL = "https://api.zapz.dev"

  def self.escape(value)
    URI.encode_www_form_component(value.to_s).gsub("+", "%20")
  end

  # Base class for every error raised by the SDK.
  class Error < StandardError
    attr_reader :status, :code, :retry_after, :body

    def initialize(message, status: nil, code: nil, retry_after: nil, body: nil)
      super(message)
      @status = status
      @code = code
      @retry_after = retry_after
      @body = body
    end
  end

  class APIConnectionError < Error; end
  class ValidationError < Error; end
  class AuthenticationError < Error; end
  class PermissionDeniedError < Error; end
  class NotFoundError < Error; end
  class ConflictError < Error; end
  class RateLimitError < Error; end
  class InternalServerError < Error; end
  class WebhookVerificationError < Error; end

  def self.error_from_response(status, body, retry_header)
    data = body.is_a?(Hash) ? body : {}
    msg = data["message"]
    msg = msg.join("; ") if msg.is_a?(Array)
    message = msg ? msg.to_s : "HTTP #{status}"
    retry_after = data["retryAfter"] || (retry_header && Float(retry_header, exception: false))
    code = data["error"].is_a?(String) ? data["error"] : nil
    klass = case status
            when 400, 422 then ValidationError
            when 401 then AuthenticationError
            when 403 then PermissionDeniedError
            when 404 then NotFoundError
            when 409 then ConflictError
            when 429 then RateLimitError
            else status >= 500 ? InternalServerError : Error
            end
    klass.new(message, status: status, code: code, retry_after: retry_after&.to_f, body: body)
  end

  # Verifies X-Webhook-Signature-V2 against the RAW body and returns the parsed event.
  #   event = ZapZ.verify_webhook(request.raw_post, request.headers, ENV["ZAPZ_WEBHOOK_SECRET"])
  def self.verify_webhook(raw_body, headers, secret, tolerance: 300)
    find = lambda do |name|
      pair = headers.to_h.find { |k, _| k.to_s.downcase.tr("_", "-").sub(/\Ahttp-/, "") == name }
      pair && (pair[1].is_a?(Array) ? pair[1].first : pair[1])
    end
    ts = find.call("x-webhook-timestamp")
    sig = find.call("x-webhook-signature-v2")
    raise WebhookVerificationError, "Missing X-Webhook-Timestamp or X-Webhook-Signature-V2 header" unless ts && sig && ts.to_s.match?(/\A\d+\z/)
    raise WebhookVerificationError, "Webhook timestamp outside the tolerance window" if (Time.now.to_i - ts.to_i).abs > tolerance

    expected = "sha256=" + OpenSSL::HMAC.hexdigest("SHA256", secret, "#{ts}.#{raw_body}")
    raise WebhookVerificationError, "Invalid webhook signature" unless expected.bytesize == sig.bytesize && OpenSSL.fixed_length_secure_compare(expected, sig)

    JSON.parse(raw_body)
  rescue JSON::ParserError
    raise WebhookVerificationError, "Webhook body is not valid JSON"
  end
end

require_relative "zapz/client"
