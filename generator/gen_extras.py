"""Postman collection and the n8n node operation table, both generated from the spec."""
from __future__ import annotations

import json
import re
from pathlib import Path

EXAMPLE_STRINGS = {
    "to": "5511999999999",
    "text": "Olá! Mensagem enviada pela ZapZ.",
    "url": "https://exemplo.com/webhook",
    "mediaUrl": "https://exemplo.com/imagem.jpg",
    "stickerUrl": "https://exemplo.com/sticker.webp",
    "imageUrl": "https://exemplo.com/imagem.jpg",
    "videoUrl": "https://exemplo.com/video.mp4",
    "secret": "um-segredo-com-16-chars",
    "name": "Atendimento",
    "subject": "Grupo de clientes",
    "messageId": "MESSAGE_ID",
    "code": "CODIGO_DO_CONVITE",
    "phone": "5511999999999",
    "emoji": "👍",
    "title": "Título",
    "description": "Descrição",
    "buttonText": "Ver opções",
    "displayText": "Abrir",
    "caption": "Legenda",
}


def example(spec, s: dict | None, key: str = "", depth: int = 0):
    from generate import ref_name
    if not s or depth > 4:
        return None
    if "$ref" in s:
        return example(spec, spec.schemas.get(ref_name(s["$ref"])), key, depth + 1)
    if "enum" in s:
        return s["enum"][0]
    t = s.get("type")
    if t == "object" or s.get("properties"):
        props = s.get("properties") or {}
        req = s.get("required") or []
        return {k: example(spec, props[k], k, depth + 1) for k in req if k in props}
    if t == "array":
        item = example(spec, s.get("items"), key.rstrip("s"), depth + 1)
        return [item] if item is not None else []
    if t == "integer":
        return max(1, int(s.get("minimum", 1)))
    if t == "number":
        return 0
    if t == "boolean":
        return False
    if t == "string":
        if key in EXAMPLE_STRINGS:
            return EXAMPLE_STRINGS[key]
        if s.get("format") == "uri":
            return "https://exemplo.com"
        if key.lower().endswith("jid"):
            return "5511999999999@s.whatsapp.net"
        return key or "texto"
    return None


def gen_postman(spec, root: Path) -> None:
    from generate import RESOURCES
    folders = []
    for tag in RESOURCES:
        items = []
        for op in [o for o in spec.ops if o["tag"] == tag]:
            raw_path = re.sub(r"{(\w+)}", lambda m: "{{" + ("instanceId" if m.group(1) == "id" and op["tag"] != "Webhooks" else ("webhookId" if m.group(1) == "id" else m.group(1))) + "}}", op["path"])
            segs = [p for p in ("v1" + raw_path).split("/") if p]
            url = {"raw": "{{baseUrl}}/" + "/".join(segs), "host": ["{{baseUrl}}"], "path": segs}
            if op["query"]:
                url["query"] = [{"key": q["name"], "value": "", "disabled": not q["required"]} for q in op["query"]]
                url["raw"] += "?" + "&".join(f"{q['name']}=" for q in op["query"])
            req = {"method": op["method"], "header": [], "url": url, "description": op["summary"]}
            body = spec.body(op)
            if body is not None:
                ex = example(spec, body)
                req["header"].append({"key": "Content-Type", "value": "application/json"})
                req["body"] = {"mode": "raw", "raw": json.dumps(ex if ex is not None else {}, indent=2, ensure_ascii=False), "options": {"raw": {"language": "json"}}}
            items.append({"name": op["summary"], "request": req})
        folders.append({"name": tag, "item": items})
    collection = {
        "info": {
            "name": "ZapZ API",
            "description": "WhatsApp API com proteção anti-bloqueio. Preencha as variáveis da coleção: baseUrl, apiKey e instanceId. Gerado de openapi.json.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{apiKey}}", "type": "string"}]},
        "variable": [
            {"key": "baseUrl", "value": "https://api.zapz.com"},
            {"key": "apiKey", "value": "sk_test_..."},
            {"key": "instanceId", "value": ""},
            {"key": "messageId", "value": ""},
            {"key": "groupId", "value": ""},
            {"key": "jid", "value": ""},
            {"key": "webhookId", "value": ""},
        ],
        "item": folders,
    }
    out = root / "postman"
    out.mkdir(exist_ok=True)
    (out / "zapz.postman_collection.json").write_text(json.dumps(collection, indent=2, ensure_ascii=False) + "\n")


def gen_n8n(spec, root: Path) -> None:
    """Operation table consumed by the hand-written n8n node."""
    from generate import RESOURCES
    ops = []
    for op in spec.ops:
        body = spec.body(op)
        ops.append({
            "resource": op["resource"],
            "operation": op["name"],
            "name": op["summary"],
            "method": op["method"],
            "path": op["path"],
            "pathParams": [{"name": p["name"], "arg": p["arg"]} for p in op["path_params"]],
            "query": [q["name"] for q in op["query"]],
            "body": body is not None,
            "bodyExample": example(spec, body) if body is not None else None,
            "autoClientMessageId": spec.auto_client_message_id(op),
        })
    resources = [{"value": prop, "name": tag} for tag, prop in RESOURCES.items()]
    out = root / "n8n" / "nodes" / "ZapZ"
    out.mkdir(parents=True, exist_ok=True)
    ts = "// Generated by generator/generate.py from openapi.json. Do not edit.\n\n"
    ts += "export interface ZapZOperation {\n  resource: string;\n  operation: string;\n  name: string;\n  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';\n  path: string;\n  pathParams: { name: string; arg: string }[];\n  query: string[];\n  body: boolean;\n  bodyExample: unknown;\n  autoClientMessageId: boolean;\n}\n\n"
    ts += "export const RESOURCES = " + json.dumps(resources, indent=2, ensure_ascii=False) + " as const;\n\n"
    ts += "export const OPERATIONS: ZapZOperation[] = " + json.dumps(ops, indent=2, ensure_ascii=False) + ";\n"
    (out / "operations.ts").write_text(ts)
