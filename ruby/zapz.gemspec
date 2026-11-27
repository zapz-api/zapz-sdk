# frozen_string_literal: true

Gem::Specification.new do |s|
  s.name = "zapz"
  s.version = "0.2.0"
  s.summary = "Official Ruby SDK for the ZapZ WhatsApp API"
  s.authors = ["ZapZ"]
  s.license = "MIT"
  s.files = Dir["lib/**/*.rb"] + ["README.md"]
  s.require_paths = ["lib"]
  s.homepage = "https://zapz.dev"
  s.metadata = {
    "documentation_uri" => "https://zapz.dev/#/docs",
    "source_code_uri" => "https://github.com/zapz-api/zapz-sdk/tree/main/ruby",
    "bug_tracker_uri" => "https://github.com/zapz-api/zapz-sdk/issues"
  }
  s.required_ruby_version = ">= 3.0"
end
