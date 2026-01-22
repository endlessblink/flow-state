# SOP-023: Cloudflare Tunnel with Local Supabase

> **Note**: Renumbered from SOP-013 to SOP-023 to resolve ID conflict with SOP-013-immutable-task-ids.md

## Problem Summary

When accessing FlowState PWA through a Cloudflare tunnel, the app couldn't connect to the local Supabase instance because:

1. **Network isolation**: Docker containers can't reach `127.0.0.1` on the host
2. **Hardcoded IP**: Caddyfile had hardcoded LAN IP that didn't work universally
3. **Relative URLs**: Supabase JS client requires full URLs, not relative paths like `/supabase`
4. **CORS**: Missing CORS headers for cross-origin requests from tunnel domain

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Phone                             │
│                              │                                   │
│                              ▼                                   │
│              https://xxx.trycloudflare.com                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge Network                       │
│                     (Tunnel Connector)                           │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Docker Network                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Tunnel     │───▶│    Caddy     │───▶│     App      │      │
│  │ (cloudflared)│    │   (proxy)    │    │   (Vite)     │      │
│  └──────────────┘    └──────┬───────┘    └──────────────┘      │
│                             │                                    │
│                             │ host.docker.internal:54321        │
│                             ▼                                    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Host Machine                                │
│                 Supabase (localhost:54321)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Solution Components

### 1. Docker Compose - Enable host.docker.internal

**File**: `docker-compose.yml`

```yaml
caddy:
  image: caddy:alpine
  extra_hosts:
    - "host.docker.internal:host-gateway"  # Maps to host's IP
  # ... rest of config
```

**Why**: On Linux, Docker doesn't automatically provide `host.docker.internal`. The `host-gateway` directive creates this mapping.

### 2. Caddyfile - Use host.docker.internal + CORS

**File**: `Caddyfile`

```caddyfile
handle_path /supabase/* {
    # CORS headers for cross-origin requests
    header Access-Control-Allow-Origin "*"
    header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    header Access-Control-Allow-Headers "apikey, authorization, content-type, x-client-info, x-supabase-api-version"
    header Access-Control-Expose-Headers "content-range, x-supabase-api-version"

    # Handle preflight OPTIONS requests
    @options method OPTIONS
    respond @options 204

    reverse_proxy http://host.docker.internal:54321 {
        header_up Host {upstream_hostport}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        # WebSocket support for Supabase Realtime
        header_up Connection {header.Connection}
        header_up Upgrade {header.Upgrade}
    }
}
```

**Why**:
- `host.docker.internal` resolves to the host machine from inside Docker
- CORS headers allow the tunnel domain to make requests
- WebSocket headers enable Supabase Realtime

### 3. Supabase Client - Dynamic URL Resolution

**File**: `src/services/auth/supabase.ts`

```typescript
function resolveSupabaseUrl(): string {
    if (isTauri) {
        return 'http://127.0.0.1:54321'
    }
    if (envUrl.startsWith('/') && typeof window !== 'undefined') {
        // Convert relative path to full URL using current page origin
        return `${window.location.origin}${envUrl}`
    }
    return envUrl
}
```

**Why**: Supabase JS client requires full URLs. This converts `/supabase` to `https://xxx.trycloudflare.com/supabase`.

### 4. Environment Variables

**File**: `docker-compose.yml` (app service)

```yaml
app:
  environment:
    VITE_SUPABASE_URL: "/supabase"
    VITE_SUPABASE_ANON_KEY: "your-anon-key"
```

**Why**: Overrides `.env.local` which has `http://127.0.0.1:54321` (won't work from phone).

## Verification Commands

```bash
# 1. Check Caddy can reach Supabase
docker exec flowstate_caddy wget -qO- http://host.docker.internal:54321/rest/v1/

# 2. Test CORS preflight
curl -I -X OPTIONS "https://xxx.trycloudflare.com/supabase/rest/v1/" \
  -H "Origin: https://xxx.trycloudflare.com"

# 3. Get tunnel URL
docker logs flowstate_tunnel 2>&1 | grep -o 'https://.*trycloudflare.com'

# 4. Test from isolated network (simulates external device)
docker run --rm --network=bridge alpine/curl \
  "https://xxx.trycloudflare.com/supabase/rest/v1/"
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Script error." on phone | CORS blocking or old cached JS | Clear browser cache, verify CORS headers |
| WebSocket to `127.0.0.1` | Old JS with hardcoded URL | Clear cache, check `resolveSupabaseUrl()` |
| Connection refused | `host.docker.internal` not working | Check `extra_hosts` in docker-compose.yml |
| 502 Bad Gateway | Supabase not running | Start Supabase: `supabase start` |

## Files Modified

| File | Change |
|------|--------|
| `docker-compose.yml` | Added `extra_hosts`, env vars for app |
| `Caddyfile` | CORS headers, `host.docker.internal`, WebSocket support |
| `src/services/auth/supabase.ts` | `resolveSupabaseUrl()` function |

## Related

- **SOP-011**: Tauri Distribution (includes Supabase detection fix, formerly SOP-014)
- **CLAUDE.md**: Supabase Architecture section

---
**Created**: 2026-01-21
**Author**: Claude Code
**Status**: Active
