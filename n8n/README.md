# n8n-nodes-zapz

Nós do n8n para a API de WhatsApp da ZapZ.

- **ZapZ**: todas as operações da API (instâncias, mensagens, contatos, grupos, webhooks, sandbox). O corpo de cada operação já vem preenchido com um exemplo; o `clientMessageId` é gerado sozinho nos envios.
- **ZapZ Trigger**: dispara o workflow em eventos do WhatsApp (`new_message`, `message_read`, `disconnected`…). Ao ativar, cria o webhook na ZapZ com um segredo próprio e valida a assinatura de cada entrega; ao desativar, remove o webhook.

Instalação: em **Settings → Community Nodes → Install**, use `n8n-nodes-zapz`. Credencial: API key (`sk_live_` ou `sk_test_`) e a URL da API.

As operações vêm de `nodes/ZapZ/operations.ts`, gerado de `openapi.json` (`python3 generator/generate.py`).
