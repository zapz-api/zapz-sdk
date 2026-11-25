# ZapZ SDKs

Official SDKs for the [ZapZ](https://zapz.dev) WhatsApp API. Documentation: https://zapz.dev/#/docs

| Language | Folder | Package |
|---|---|---|
| Node.js / TypeScript (18+) | [`node/`](node) | [`@zapz/sdk`](https://www.npmjs.com/package/@zapz/sdk) |
| Python (3.8+) | [`python/`](python) | [`zapz`](https://pypi.org/project/zapz/) |
| PHP (8.1+) | [`php/`](php) | [`zapz/sdk`](https://packagist.org/packages/zapz/sdk) |
| Go (1.21+) | [`go/`](go) | [`github.com/zapz-api/zapz-sdk/go`](https://pkg.go.dev/github.com/zapz-api/zapz-sdk/go) |
| Java (17+) | [`java/`](java) | [`dev.zapz:zapz-java`](https://central.sonatype.com/artifact/dev.zapz/zapz-java) |
| C# / .NET (8+) | [`csharp/`](csharp) | [`ZapZ`](https://www.nuget.org/packages/ZapZ) |
| Ruby (3.0+) | [`ruby/`](ruby) | [`zapz`](https://rubygems.org/gems/zapz) |

None of them has runtime dependencies.

Extras:

- [`postman/`](postman): Postman / Insomnia collection with every route.
- [`n8n/`](n8n): n8n nodes (actions + trigger on signed webhooks), [`n8n-nodes-zapz`](https://www.npmjs.com/package/n8n-nodes-zapz).
- [`mcp/`](mcp): MCP server for AI assistants (stdio and HTTP), [`@zapz/mcp`](https://www.npmjs.com/package/@zapz/mcp).

## How it works

- `openapi.json` is the public specification, served by the API at `GET /v1/openapi.json` (generated from the `zapz-api` DTOs).
- `generator/generate.py` reads the specification and generates the methods and types of each SDK (`*/generated`, `zapz/_generated`, `php/src/Resources`). Do not edit these files by hand.
- The rest (HTTP, retries, errors, webhook verification) is written by hand in each SDK.

After an API change:

```bash
python3 generator/generate.py --fetch http://localhost:3056/v1/openapi.json
```

## Tests

Each SDK has a smoke test that runs against a real API with a test key (`sk_test_`, nothing goes out through WhatsApp):

```bash
export ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056
(cd node && npm run build && npm test)
(cd python && python3 -m unittest discover -s tests)
(cd php && composer dump-autoload && php tests/smoke.php)
(cd go && go test ./...)
(cd n8n && npm run build && npm test)
(cd mcp && npm run build && npm test)
# Java, .NET and Ruby (through Docker, host network to reach the local API)
docker run --rm --network host -v "$PWD/java":/w -w /w -e ZAPZ_API_KEY -e ZAPZ_BASE_URL eclipse-temurin:17-jdk \
  sh -c 'mkdir -p /tmp/o && javac -d /tmp/o $(find src -name "*.java") && java -cp /tmp/o com.zapz.Smoke'
docker run --rm --network host -v "$PWD/csharp":/w -w /w -e ZAPZ_API_KEY -e ZAPZ_BASE_URL mcr.microsoft.com/dotnet/sdk:8.0 dotnet run --project tests/Smoke
docker run --rm --network host -v "$PWD/ruby":/w -w /w -e ZAPZ_API_KEY -e ZAPZ_BASE_URL ruby:3.3-slim ruby -Ilib test/smoke.rb
```

Without `ZAPZ_API_KEY`, only the offline tests (webhook signature) run.

## Releasing

All SDKs share one version. GitHub Actions (`.github/workflows/release-*.yml`) publishes each SDK when a `<sdk>/vX.Y.Z` tag is pushed, and each workflow fails when the tag differs from its manifest.

1. Set the version everywhere (manifests and the `VERSION` constant each client sends), then merge it to `main`:
   ```bash
   scripts/set-version.sh 0.1.4
   ```
2. On an up-to-date `main`, push every tag (`--dry-run` only checks and lists them):
   ```bash
   scripts/release.sh 0.1.4
   ```
   The script stops when a file has another version, when `main` differs from `origin/main` or when a tag already exists. It pushes the tags one by one, because GitHub starts no workflow for a push that creates more than 3 tags.

| Tag | Registry | Authentication |
|---|---|---|
| `node/v*`, `mcp/v*`, `n8n/v*` | npm (`@zapz/sdk`, `@zapz/mcp`, `n8n-nodes-zapz`) and `ghcr.io/zapz-api/zapz-mcp` | Trusted Publishing (OIDC) |
| `python/v*` | PyPI (`zapz`) | Trusted Publishing (OIDC), environment `pypi` |
| `ruby/v*` | RubyGems (`zapz`) | Trusted Publishing (OIDC); variable `RUBYGEMS_OWNER_ID` for the first push only |
| `csharp/v*` | NuGet (`ZapZ`) | Trusted Publishing (OIDC), secret `NUGET_USER` |
| `php/v*` | Packagist (`zapz/sdk`) through the `zapz-api/zapz-php` repository | secret `PHP_SPLIT_DEPLOY_KEY` |
| `go/v*` | proxy.golang.org (`github.com/zapz-api/zapz-sdk/go`) | none |
| `java/v*` | Maven Central (`dev.zapz:zapz-java`) | secrets `CENTRAL_USERNAME`, `CENTRAL_PASSWORD`, `GPG_PRIVATE_KEY`, `GPG_PASSPHRASE` |
| `postman/v*` | GitHub Release | `GITHUB_TOKEN` |

To release one SDK alone, push its tag: `git tag node/v0.1.4 && git push origin node/v0.1.4`.

## License

MIT
