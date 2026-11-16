# frozen_string_literal: true

require_relative "resources"

module ZapZ
  # ZapZ API client. Bodies are hashes; responses are parsed JSON (hashes/arrays).
  class Client
    attr_reader :base_url, :instances, :messages, :contacts, :groups, :webhooks, :sandbox

    # api_key defaults to ZAPZ_API_KEY; base_url to ZAPZ_BASE_URL, then production.
    def initialize(api_key: nil, base_url: nil, timeout: 30, max_retries: 2)
      @api_key = api_key || ENV["ZAPZ_API_KEY"]
      raise Error, "Missing API key: pass api_key: or set ZAPZ_API_KEY." if @api_key.nil? || @api_key.empty?

      url = (base_url || ENV["ZAPZ_BASE_URL"] || DEFAULT_BASE_URL).sub(%r{/+\z}, "")
      @base_url = url.sub(%r{/v1\z}, "")
      @timeout = timeout
      @max_retries = max_retries
      @instances = InstancesResource.new(self)
      @messages = MessagesResource.new(self)
      @contacts = ContactsResource.new(self)
      @groups = GroupsResource.new(self)
      @webhooks = WebhooksResource.new(self)
      @sandbox = SandboxResource.new(self)
    end

    # True for sk_test_ keys (nothing reaches WhatsApp).
    def sandbox?
      @api_key.start_with?("sk_test_")
    end

    def request(method, path, body: nil, query: nil, auto_client_message_id: false)
      if auto_client_message_id && body.is_a?(Hash)
        cid = body[:clientMessageId] || body["clientMessageId"]
        body = body.merge(clientMessageId: SecureRandom.uuid) if cid.nil? || cid.to_s.empty?
      end
      uri = URI("#{@base_url}/v1#{path}")
      q = (query || {}).compact
      uri.query = URI.encode_www_form(q) unless q.empty?
      payload = body.nil? ? nil : JSON.generate(body)
      # a retry is safe when the request is idempotent or carries an idempotency key
      idempotent = %i[get delete].include?(method) || (body.is_a?(Hash) && (body[:clientMessageId] || body["clientMessageId"]))

      attempt = 0
      loop do
        req = Net::HTTPGenericRequest.new(method.to_s.upcase, !payload.nil?, true, uri.request_uri)
        req["Authorization"] = "Bearer #{@api_key}"
        req["Accept"] = "application/json"
        req["User-Agent"] = "zapz-ruby/#{VERSION}"
        if payload
          req["Content-Type"] = "application/json"
          req.body = payload
        end
        begin
          res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: [10, @timeout].min, read_timeout: @timeout) { |h| h.request(req) }
        rescue StandardError => e
          raise unless e.is_a?(IOError) || e.is_a?(SystemCallError) || e.is_a?(Timeout::Error) || e.is_a?(SocketError) || e.is_a?(OpenSSL::SSL::SSLError)

          if idempotent && attempt < @max_retries
            sleep(backoff(attempt))
            attempt += 1
            next
          end
          raise APIConnectionError, "Connection error: #{e.message}"
        end

        status = res.code.to_i
        data = parse(res.body)
        return data if status.between?(200, 299)

        err = ZapZ.error_from_response(status, data, res["Retry-After"])
        refused = [429, 503].include?(status)
        transient = [502, 504].include?(status)
        if attempt < @max_retries && (refused || (transient && idempotent))
          wait = err.retry_after || backoff(attempt)
          if wait <= 60
            sleep(wait)
            attempt += 1
            next
          end
        end
        raise err
      end
    end

    private

    def parse(raw)
      return nil if raw.nil? || raw.strip.empty?

      JSON.parse(raw)
    rescue JSON::ParserError
      raw
    end

    def backoff(attempt)
      [8.0, 0.5 * (2**attempt)].min * (0.75 + rand * 0.5)
    end
  end
end
