# frozen_string_literal: true

Gem::Specification.new do |s|
  s.name = "zapz"
  s.version = "0.1.0"
  s.summary = "Official Ruby SDK for the ZapZ WhatsApp API"
  s.authors = ["ZapZ"]
  s.license = "MIT"
  s.files = Dir["lib/**/*.rb"] + ["README.md"]
  s.require_paths = ["lib"]
  s.required_ruby_version = ">= 3.0"
end
