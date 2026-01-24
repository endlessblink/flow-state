# SOP-031: CORS Configuration for Self-Hosted Supabase

**Status**: Active
**Created**: 2026-01-24
**Related Task**: TASK-1059

## Overview

FlowState uses a self-hosted Supabase stack behind Caddy reverse proxy. CORS must be configured at the Caddy layer ONLY to prevent duplicate headers from Kong (Supabase's internal gateway).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CORS FLOW                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Browser (in-theflow.com)                                          │
│        │                                                             │
│        │  Preflight (OPTIONS)                                        │
│        │  + Access-Control-Request-Headers                           │
│        ▼                                                             │
│   Cloudflare CDN                                                     │
│        │                                                             │
│        ▼                                                             │
│   Caddy (api.in-theflow.com:443)  ◀── CORS HEADERS SET HERE         │
│        │                                                             │
│        │  Strips Kong CORS headers                                   │
│        │  header_down -Access-Control-*                              │
│        ▼                                                             │
│   Kong Gateway (localhost:8000)    ◀── CORS DISABLED/STRIPPED       │
│        │                                                             │
│        ▼                                                             │
│   Supabase Services (auth, rest, realtime, storage)                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Critical CORS Headers

| Header | Value | Why |
|--------|-------|-----|
| `Access-Control-Allow-Origin` | `{http.request.header.Origin}` | Dynamic origin (not `*` - breaks credentials) |
| `Access-Control-Allow-Credentials` | `true` | Required for cookies/auth tokens |
| `Access-Control-Allow-Methods` | `GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD` | All HTTP methods |
| `Access-Control-Allow-Headers` | See full list below | MUST include ALL headers the client sends |
| `Access-Control-Expose-Headers` | `content-range, range, x-total-count` | Pagination headers |
| `Access-Control-Max-Age` | `3600` | Cache preflight for 1 hour |

### Required Allowed Headers

These headers MUST be in `Access-Control-Allow-Headers`:

| Header | Source | Why |
|--------|--------|-----|
| `authorization` | Supabase SDK | JWT token |
| `apikey` | Supabase SDK | Anon/service key |
| `content-type` | HTTP standard | JSON body |
| `accept` | HTTP standard | Response format |
| `x-client-info` | Supabase SDK | Client metadata |
| `x-supabase-api-version` | Supabase SDK | API versioning |
| `accept-profile` | PostgREST | Schema selection |
| `content-profile` | PostgREST | Schema for writes |
| `prefer` | PostgREST | Return preferences |
| `range` | PostgREST | Pagination |
| `x-upsert` | PostgREST | Upsert flag |

**Important**: Include both lowercase and PascalCase versions for browser compatibility:
```
authorization, Authorization, content-type, Content-Type, accept-profile, Accept-Profile
```

## Caddy Configuration

**File**: `/etc/caddy/Caddyfile` on VPS

```caddyfile
api.in-theflow.com {
    tls /etc/caddy/certs/cloudflare-origin.pem /etc/caddy/certs/cloudflare-origin.key

    # Handle ALL CORS - Kong CORS is disabled
    header {
        Access-Control-Allow-Origin {http.request.header.Origin}
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD"
        Access-Control-Allow-Headers "authorization, content-type, apikey, x-client-info, x-supabase-api-version, accept, x-custom-header, prefer, accept-profile, content-profile, range, x-upsert, Authorization, Content-Type, Accept-Profile, Content-Profile, Range, X-Upsert"
        Access-Control-Expose-Headers "content-range, range, x-total-count, Content-Range, Range, X-Total-Count"
        Access-Control-Allow-Credentials "true"
        Access-Control-Max-Age "3600"
        defer
    }

    # Handle OPTIONS preflight - respond immediately
    @options method OPTIONS
    handle @options {
        respond 204
    }

    # Proxy to Kong - STRIP any CORS headers Kong adds
    handle {
        reverse_proxy localhost:8000 {
            header_up X-Forwarded-Proto https
            header_up X-Forwarded-Host api.in-theflow.com
            # CRITICAL: Remove Kong's CORS headers to prevent duplicates
            header_down -Access-Control-Allow-Origin
            header_down -Access-Control-Allow-Methods
            header_down -Access-Control-Allow-Headers
            header_down -Access-Control-Allow-Credentials
            header_down -Access-Control-Expose-Headers
            header_down -Access-Control-Max-Age
        }
    }
}
```

## Kong Configuration (DO NOT ADD CORS)

Kong's `kong.yml` should NOT have explicit CORS plugin config. The CORS plugins in Kong will still set headers, but Caddy strips them via `header_down`.

**If you need to disable Kong CORS entirely**, remove the `cors` plugin from all services in `kong.yml`, but this requires restarting Kong containers.

## Common CORS Errors and Fixes

### Error: "Authorization header is not covered when Access-Control-Allow-Headers is *"

**Cause**: Firefox requires explicit header listing, not `*`
**Fix**: List all headers explicitly in Caddy config

### Error: "accept-profile is not allowed"

**Cause**: PostgREST header not in allowed list
**Fix**: Add `accept-profile, Accept-Profile` to `Access-Control-Allow-Headers`

### Error: "x-supabase-api-version is not allowed"

**Cause**: New Supabase SDK header not in allowed list
**Fix**: Add `x-supabase-api-version` to `Access-Control-Allow-Headers`

### Error: Duplicate "Access-Control-Allow-Origin" values

**Cause**: Both Caddy AND Kong are setting CORS headers
**Fix**: Use `header_down -Access-Control-*` in Caddy to strip Kong headers

### Error: "Credentials flag is true but Access-Control-Allow-Origin is *"

**Cause**: Cannot use `*` origin with credentials
**Fix**: Use dynamic origin: `{http.request.header.Origin}`

## Validation

### Manual Testing

```bash
# Test preflight
curl -v -X OPTIONS https://api.in-theflow.com/rest/v1/ \
  -H "Origin: https://in-theflow.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,apikey,x-supabase-api-version"

# Check for single CORS header (not duplicates)
curl -sI -X OPTIONS https://api.in-theflow.com/rest/v1/ \
  -H "Origin: https://in-theflow.com" | grep -i "access-control"
```

### Automated Validation

```bash
# Run CORS validation script
./scripts/validate-cors.sh
```

## CI/CD Integration

Add to `.github/workflows/deploy.yml`:

```yaml
- name: Validate CORS Configuration
  run: ./scripts/validate-cors.sh
  env:
    API_URL: https://api.in-theflow.com
    ORIGIN: https://in-theflow.com
```

## Troubleshooting Checklist

1. [ ] Check Caddy logs: `sudo journalctl -u caddy -f`
2. [ ] Verify Kong is running: `docker ps | grep kong`
3. [ ] Test preflight with curl (not browser)
4. [ ] Check for duplicate headers in response
5. [ ] Verify dynamic origin is being set
6. [ ] Clear Cloudflare cache if using CDN
7. [ ] Hard refresh browser (Ctrl+Shift+R)
8. [ ] Try incognito/private window (no extensions)

## Browser-Specific Issues

### Brave Browser

Brave Shields can block:
- Cross-origin cookies
- localStorage for cross-origin requests
- WebSocket connections

**Fix**: Add `in-theflow.com` and `api.in-theflow.com` to Shields exceptions

### Firefox

Firefox is stricter about:
- Authorization header cannot use wildcard `*`
- Requires explicit header listing

## When Adding New Headers

If the Supabase SDK or PostgREST adds new headers:

1. Check browser console for "is not allowed" errors
2. Add the header to Caddy's `Access-Control-Allow-Headers`
3. Add both lowercase and PascalCase versions
4. Run `sudo systemctl reload caddy`
5. Clear Cloudflare cache (if applicable)
6. Update this SOP

## Related Files

| File | Purpose |
|------|---------|
| `/etc/caddy/Caddyfile` | VPS Caddy config (CORS source of truth) |
| `scripts/validate-cors.sh` | Automated CORS validation |
| `.github/workflows/deploy.yml` | CI/CD with CORS check |
