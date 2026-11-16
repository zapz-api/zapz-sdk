# Coleção Postman / Insomnia

`zapz.postman_collection.json` tem todas as rotas públicas, organizadas por recurso, com corpos de exemplo.

1. Postman: **Import** → arquivo. Insomnia: **Import** → arquivo (aceita coleção Postman v2.1).
2. Preencha as variáveis da coleção: `baseUrl`, `apiKey` e `instanceId`.

A coleção é gerada de `openapi.json`. O Insomnia e o Postman também importam a especificação direto de `GET /v1/openapi.json`.
