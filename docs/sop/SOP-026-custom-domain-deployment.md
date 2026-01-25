# SOP-026: Custom Domain Deployment (in-theflow.com)

**Created**: 2026-01-23
**Status**: Active
**Related Task**: TASK-1001

## Overview

This SOP documents the setup of custom domain `in-theflow.com` for FlowState PWA with:
- Cloudflare DNS (proxied)
- Cloudflare Origin Certificate (Full SSL)
- Caddy reverse proxy on VPS
- PWA deployment

## Architecture

```
User (HTTPS) → Cloudflare (SSL termination) → VPS Caddy (Origin Cert) → Supabase
                                                      ↓
                                              PWA Static Files
```

## Domain Configuration

| Domain | Purpose |
|--------|---------|
| `in-theflow.com` | PWA frontend |
| `api.in-theflow.com` | Supabase API |
| `www.in-theflow.com` | Redirect to main |

## Cloudflare Setup

### DNS Records (Proxied - Orange Cloud)

| Type | Name | Value |
|------|------|-------|
| A | @ | 84.46.253.137 |
| A | api | 84.46.253.137 |
| CNAME | www | in-theflow.com |

### SSL/TLS Settings

- **Mode**: Full (encrypts Cloudflare → Origin)
- **Origin Certificate**: 15-year validity (expires 2041-01-18)
- **Certificate Location**: `/etc/caddy/certs/` on VPS
- **Local Backup**: `~/secrets/in-theflow.com/`

## VPS Configuration

### Caddy Installation

```bash
# Install Caddy
apt-get update
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
```

### Caddyfile Location

`/etc/caddy/Caddyfile`

### Current Caddyfile

```caddyfile
# FlowState - in-theflow.com

api.in-theflow.com {
    tls /etc/caddy/certs/cloudflare-origin.pem /etc/caddy/certs/cloudflare-origin.key

    # Handle CORS preflight - allow all headers
    @options method OPTIONS
    handle @options {
        header Access-Control-Allow-Origin "*"
        header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        header Access-Control-Allow-Headers "*"
        header Access-Control-Expose-Headers "*"
        header Access-Control-Max-Age "86400"
        respond 204
    }

    # Proxy to Supabase
    handle {
        reverse_proxy localhost:8000 {
            header_up X-Forwarded-Proto https
            header_up X-Forwarded-Host api.in-theflow.com
        }
    }
}

in-theflow.com {
    tls /etc/caddy/certs/cloudflare-origin.pem /etc/caddy/certs/cloudflare-origin.key
    root * /var/www/flowstate
    encode gzip

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }

    @sw path /sw.js
    header @sw Cache-Control "no-cache, no-store, must-revalidate"

    @static path /assets/*
    header @static Cache-Control "public, max-age=31536000, immutable"
    header @static Vary "Accept-Encoding, Accept"

    # Also set proper no-cache for index.html to prevent Cloudflare caching stale HTML
    @html path /index.html
    header @html Cache-Control "no-cache, no-store, must-revalidate"

    try_files {path} /index.html
    file_server
}

www.in-theflow.com {
    tls /etc/caddy/certs/cloudflare-origin.pem /etc/caddy/certs/cloudflare-origin.key
    redir https://in-theflow.com{uri} permanent
}
```

### Certificate Files

```
/etc/caddy/certs/
├── cloudflare-origin.pem   # Certificate (644, owner: caddy)
└── cloudflare-origin.key   # Private key (600, owner: caddy)
```

## Supabase Configuration

Updated in `/opt/supabase/docker/.env`:

```bash
SITE_URL=https://in-theflow.com
API_EXTERNAL_URL=https://api.in-theflow.com
```

After changes, restart auth:
```bash
cd /opt/supabase/docker
docker compose restart auth kong
```

## PWA Deployment

### Production Environment

`.env.production`:
```bash
VITE_SUPABASE_URL=https://api.in-theflow.com
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Build & Deploy

```bash
# Build locally
npm run build

# Deploy to VPS
rsync -avz --delete dist/ root@84.46.253.137:/var/www/flowstate/

# Restart Caddy if config changed
ssh root@84.46.253.137 "systemctl restart caddy"
```

## Troubleshooting

### CORS Errors

1. Check Caddy is handling OPTIONS preflight
2. Verify `Access-Control-Allow-Headers` includes all needed headers:
   - `Authorization`, `Content-Type`, `apikey`
   - `x-client-info`, `x-supabase-api-version`
   - `Prefer`, `Range`, `Accept`

3. Clear browser cache after fixing (mobile browsers cache CORS failures)

### SSL Issues

1. Verify Cloudflare SSL mode is "Full" (not "Flexible")
2. Check origin cert hasn't expired
3. Verify cert permissions: `chown caddy:caddy /etc/caddy/certs/*`

### "Failed to Fetch" on Mobile

1. Clear site data in browser settings
2. Try incognito/private mode
3. Check Caddy logs: `journalctl -u caddy -f`

## Key Files

| Location | Purpose |
|----------|---------|
| `/etc/caddy/Caddyfile` | Caddy config |
| `/etc/caddy/certs/` | SSL certificates |
| `/var/www/flowstate/` | PWA static files |
| `/opt/supabase/docker/.env` | Supabase config |
| `~/secrets/in-theflow.com/` | Local cert backup |

## Commands Reference

```bash
# Restart Caddy
systemctl restart caddy

# Check Caddy status
systemctl status caddy

# View Caddy logs
journalctl -u caddy -f

# Test CORS
curl -X OPTIONS "https://api.in-theflow.com/rest/v1/tasks" \
  -H "Origin: https://in-theflow.com" \
  -H "Access-Control-Request-Method: GET" \
  -I

# Test API
curl -s "https://api.in-theflow.com/rest/v1/tasks?limit=1" \
  -H "apikey: YOUR_ANON_KEY"
```
