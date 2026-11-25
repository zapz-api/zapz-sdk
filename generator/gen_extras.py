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
            {"key": "baseUrl", "value": "https://api.zapz.dev"},
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
            "bodyJson": json.dumps(example(spec, body), indent=2, ensure_ascii=False) if body is not None else None,
            "autoClientMessageId": spec.auto_client_message_id(op),
        })
    resources = [{"value": prop, "name": tag} for tag, prop in RESOURCES.items()]
    out = root / "n8n" / "nodes" / "ZapZ"
    out.mkdir(parents=True, exist_ok=True)
    ts = "// Generated by generator/generate.py from openapi.json. Do not edit.\n\n"
    ts += "export interface ZapZOperation {\n  resource: string;\n  operation: string;\n  name: string;\n  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';\n  path: string;\n  pathParams: { name: string; arg: string }[];\n  query: string[];\n  body: boolean;\n  bodyJson: string | null;\n  autoClientMessageId: boolean;\n}\n\n"
    ts += "export const RESOURCES = " + json.dumps(resources, indent=2, ensure_ascii=False) + " as const;\n\n"
    ts += "export const OPERATIONS: ZapZOperation[] = " + json.dumps(ops, indent=2, ensure_ascii=False) + ";\n"
    (out / "operations.ts").write_text(ts)


# ------------------------------------------------------------------ MCP

MCP_PATH_ARG = {"instanceId": "instance_id", "messageId": "message_id", "groupId": "group_id", "jid": "jid", "webhookId": "webhook_id"}
MCP_PATH_DESC = {
    "instance_id": "Instance id (from instances_list)",
    "message_id": "Message id: the clientMessageId returned by a send, or the WhatsApp id",
    "group_id": "Group JID, e.g. 120363000000000000@g.us (from groups_list)",
    "jid": "Contact JID, e.g. 5511999999999@s.whatsapp.net",
    "webhook_id": "Webhook id (from webhooks_list)",
}
MCP_DESTRUCTIVE = {"deleteInstance", "clearInstanceSession", "deleteMessage", "deleteContact", "leaveGroup", "revokeGroupInvite", "deleteWebhook", "updateGroupParticipants"}
PHONE_HINT = "Phone numbers: country code + area code + number, digits only (e.g. 5511999999999); groups use their JID (…@g.us)."


def inline(spec, s, depth=0):
    from generate import ref_name
    if not isinstance(s, dict):
        return s
    if "$ref" in s:
        if depth > 6:
            return {"type": "object"}
        return inline(spec, spec.schemas.get(ref_name(s["$ref"]), {"type": "object"}), depth + 1)
    out = {}
    for k, v in s.items():
        if k == "nullable":
            continue
        if k == "properties":
            out[k] = {pk: inline(spec, pv, depth + 1) for pk, pv in v.items()}
        elif k == "items":
            out[k] = inline(spec, v, depth + 1)
        else:
            out[k] = v
    if s.get("nullable") and "type" in out:
        out["type"] = [out["type"], "null"]
    return out


def gen_mcp(spec, root: Path) -> None:
    from generate import snake
    tools = []
    for op in spec.ops:
        name = f"{op['resource']}_{snake(op['name'])}"
        props, required = {}, []
        for p in op["path_params"]:
            arg = MCP_PATH_ARG.get(p["arg"], snake(p["arg"]))
            props[arg] = {"type": "string", "description": MCP_PATH_DESC.get(arg, p["arg"])}
            required.append(arg)
        for q in op["query"]:
            props[q["name"]] = {**inline(spec, q["schema"]), **({"description": q["description"]} if q.get("description") else {})}
            if q["required"]:
                required.append(q["name"])
        body = spec.body(op)
        body_keys = []
        if body is not None:
            b = inline(spec, body)
            for k, v in (b.get("properties") or {}).items():
                if k in props:
                    raise SystemExit(f"MCP: {name} body field {k} clashes with a path/query argument")
                props[k] = v
                body_keys.append(k)
            required += [k for k in (b.get("required") or []) if k in body_keys]
        desc = f"{op['summary']}. ({op['method']} /v1{op['path']})"
        if op["name"].startswith("send") or op["id"] in ("checkPhones",):
            desc += " " + PHONE_HINT
        if spec.auto_client_message_id(op):
            desc += " A clientMessageId is generated when missing, so retrying never sends twice; pass your own to correlate webhooks."
        if op["tag"] == "Sandbox":
            desc += " Only works with sk_test_ keys."
        read = op["method"] == "GET"
        annotations = {
            "title": op["summary"],
            "readOnlyHint": read,
            "destructiveHint": (not read) and op["id"] in MCP_DESTRUCTIVE,
            "idempotentHint": op["method"] in ("GET", "DELETE", "PATCH", "PUT"),
            "openWorldHint": op["tag"] in ("Messages", "Groups") and not read,
        }
        tools.append({
            "name": name,
            "description": desc,
            "method": op["method"],
            "path": op["path"],
            "pathParams": [{"name": p["name"], "arg": MCP_PATH_ARG.get(p["arg"], snake(p["arg"]))} for p in op["path_params"]],
            "query": [q["name"] for q in op["query"]],
            "bodyKeys": body_keys if body is not None else None,
            "autoClientMessageId": spec.auto_client_message_id(op),
            "annotations": annotations,
            "inputSchema": {"type": "object", "properties": props, **({"required": required} if required else {}), "additionalProperties": False},
        })
    out = root / "mcp" / "src"
    out.mkdir(parents=True, exist_ok=True)
    ts = "// Generated by generator/generate.py from openapi.json. Do not edit.\n\n"
    ts += "export interface ToolDef {\n  name: string;\n  description: string;\n  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';\n  path: string;\n  pathParams: { name: string; arg: string }[];\n  query: string[];\n  bodyKeys: string[] | null;\n  autoClientMessageId: boolean;\n  annotations: { title: string; readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };\n  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties: false };\n}\n\n"
    ts += "export const TOOLS: ToolDef[] = " + json.dumps(tools, indent=2, ensure_ascii=False) + ";\n"
    (out / "tools.generated.ts").write_text(ts)
