# ZapZ SDKs

SDKs oficiais da API de WhatsApp da ZapZ.

| Linguagem | Pasta | Pacote (planejado) |
|---|---|---|
| Node.js / TypeScript (18+) | [`node/`](node) | `@zapz/sdk` |
| Python (3.8+) | [`python/`](python) | `zapz` |
| PHP (8.1+) | [`php/`](php) | `zapz/zapz-php` |
| Go (1.21+) | [`go/`](go) | `github.com/zapz/zapz-go` |
| Java (17+) | [`java/`](java) | `com.zapz:zapz-java` |
| C# / .NET (8+) | [`csharp/`](csharp) | `ZapZ` (NuGet) |
| Ruby (3.0+) | [`ruby/`](ruby) | `zapz` (gem) |

Nenhum tem dependência em tempo de execução.

Extras:

- [`postman/`](postman): coleção Postman/Insomnia com todas as rotas.
- [`n8n/`](n8n): nós do n8n (ações + gatilho por webhook assinado).
- [`mcp/`](mcp): servidor MCP para assistentes de IA (stdio e HTTP).

## Como funciona

- `openapi.json` é a especificação pública, servida pela API em `GET /v1/openapi.json` (gerada dos DTOs do `zapz-api`).
- `generator/generate.py` lê a especificação e gera os métodos e tipos de cada SDK (`*/generated`, `zapz/_generated`, `php/src/Resources`). Não edite esses arquivos à mão.
- O resto (HTTP, retentativas, erros, verificação de webhook) é escrito à mão em cada SDK.

Depois de mudar a API:

```bash
python3 generator/generate.py --fetch http://localhost:3056/v1/openapi.json
```

## Testes

Cada SDK tem um teste de fumaça que roda contra uma API de verdade com chave de teste (`sk_test_`, nada sai pelo WhatsApp):

```bash
export ZAPZ_API_KEY=sk_test_... ZAPZ_BASE_URL=http://localhost:3056
(cd node && npm run build && npm test)
(cd python && python3 -m unittest discover -s tests)
(cd php && composer dump-autoload && php tests/smoke.php)
(cd go && go test ./...)
(cd n8n && npm run build && npm test)
(cd mcp && npm run build && npm test)
# Java, .NET e Ruby (via Docker, rede do host para alcançar a API local)
docker run --rm --network host -v "$PWD/java":/w -w /w -e ZAPZ_API_KEY -e ZAPZ_BASE_URL eclipse-temurin:17-jdk \
  sh -c 'mkdir -p /tmp/o && javac -d /tmp/o $(find src -name "*.java") && java -cp /tmp/o com.zapz.Smoke'
docker run --rm --network host -v "$PWD/csharp":/w -w /w -e ZAPZ_API_KEY -e ZAPZ_BASE_URL mcr.microsoft.com/dotnet/sdk:8.0 dotnet run --project tests/Smoke
docker run --rm --network host -v "$PWD/ruby":/w -w /w -e ZAPZ_API_KEY -e ZAPZ_BASE_URL ruby:3.3-slim ruby -Ilib test/smoke.rb
```

Sem `ZAPZ_API_KEY`, só os testes offline (assinatura de webhook) rodam.
