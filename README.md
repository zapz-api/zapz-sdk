# ZapZ SDKs

SDKs oficiais da API de WhatsApp da ZapZ.

| Linguagem | Pasta | Pacote (planejado) |
|---|---|---|
| Node.js / TypeScript (18+) | [`node/`](node) | `@zapz/sdk` |
| Python (3.8+) | [`python/`](python) | `zapz` |
| PHP (8.1+) | [`php/`](php) | `zapz/zapz-php` |

Nenhum dos três tem dependência em tempo de execução (fetch nativo, stdlib, ext-curl).

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
```

Sem `ZAPZ_API_KEY`, só os testes offline (assinatura de webhook) rodam.
