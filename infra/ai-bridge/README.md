# FlowState AI Bridge (TASK-1814)

A tiny zero-dependency Node server that wraps the local `claude` and `codex`
CLIs so FlowState (web PWA + Electron) can use the user's **subscriptions** as a
first-class AI brain — no per-token API billing. Claude and Codex are equal,
switchable per AI action from the app.

```
app (web/electron)  ──HTTPS──▶  Caddy /ai-bridge  ──▶  127.0.0.1:8788 (this server)
                                                          ├─ claude -p           (CLAUDE_CODE_OAUTH_TOKEN)
                                                          └─ codex exec --json   (~/.codex/auth.json)
```

## Security
- Every `/v1/chat` request needs a valid Supabase access token (Bearer).
  Validated via `${SUPABASE_URL}/auth/v1/user` (server-side signature check;
  bridge only needs the **public** anon key). HS256-local mode also supported if
  `SUPABASE_JWT_SECRET` is set.
- CORS locked to `AI_BRIDGE_ALLOWED_ORIGIN`. Per-user rate limit (`AI_BRIDGE_RPM`).
- Binds `127.0.0.1` only — Caddy terminates TLS. Claude token never leaves the box.
- Dead brain token ⇒ `502 {error:"brain_unavailable"}` so the app falls back to Groq.

## Env (`/root/.flowstate-ai-bridge.env`, chmod 600)
```
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...   # from `claude setup-token`
SUPABASE_URL=https://api.in-theflow.com
SUPABASE_ANON_KEY=eyJ...                    # public anon key
AI_BRIDGE_ALLOWED_ORIGIN=https://in-theflow.com
# optional: AI_BRIDGE_PORT=8788  AI_BRIDGE_RPM=30  AI_BRIDGE_TIMEOUT_MS=120000
```

## Deploy
```bash
ssh root@VPS 'mkdir -p /opt/flowstate-ai-bridge'
scp infra/ai-bridge/server.mjs root@VPS:/opt/flowstate-ai-bridge/
scp infra/ai-bridge/ai-bridge.service root@VPS:/etc/systemd/system/
ssh root@VPS 'systemctl daemon-reload && systemctl enable --now ai-bridge && systemctl status ai-bridge --no-pager'
```

Caddy (add to the site block for `in-theflow.com`):
```
handle /ai-bridge/* {
    uri strip_prefix /ai-bridge
    reverse_proxy 127.0.0.1:8788
}
```

## Re-auth claude (when its token finally ages out)
```bash
ssh -t root@VPS claude setup-token          # authorize in browser, paste code
# then update CLAUDE_CODE_OAUTH_TOKEN in /root/.flowstate-ai-bridge.env and:
ssh root@VPS systemctl restart ai-bridge
```

## Health
`GET /ai-bridge/health` → `{ ok, brains:{claude,codex} }` (no model call, no quota).
