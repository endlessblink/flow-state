# Production & CDN Debugging Reference

## Overview

This reference covers debugging issues that occur specifically in production environments with CDNs (Cloudflare), reverse proxies (Caddy), and edge caching. These issues are notoriously difficult to diagnose because local development works perfectly.

---

## Cloudflare Cache MIME Type Issues

### Symptoms
- Chromium browsers fail to load CSS/JS with MIME type errors
- Firefox works correctly
- `curl` returns correct MIME types
- Direct URL navigation shows correct content

### The Contradiction
```bash
# This works (returns correct content-type):
curl -sI "https://example.com/assets/app.css" | grep content-type
# content-type: text/css; charset=utf-8

# But browser DevTools shows:
# content-type: text/html  # WRONG!
```

### Root Cause
Cloudflare caches by URL only. Chromium's preload scanner sends `Accept: text/html` for CSS/JS requests, and Cloudflare serves a cached HTML response.

### Fix
Add `Vary: Accept` header to static assets in Caddy:

```caddyfile
@static path /assets/*
header @static Vary "Accept-Encoding, Accept"
```

### Full SOP
See `docs/sop/SOP-032-cloudflare-cache-mime-prevention.md`

---

## Debugging Production Issues by Layer

### Layer 1: DNS & SSL (Cloudflare → Origin)

```bash
# Check DNS resolution
dig +short example.com

# Check SSL certificate chain
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null | openssl x509 -noout -dates

# Check Cloudflare is proxying (should see cf-ray header)
curl -sI https://example.com | grep cf-ray
```

### Layer 2: Origin Server (Caddy)

```bash
# SSH to VPS
ssh root@YOUR_VPS

# Check Caddy status
systemctl status caddy

# View Caddy logs (live)
journalctl -u caddy -f

# Validate Caddy config
caddy validate --config /etc/caddy/Caddyfile

# Reload Caddy config
systemctl reload caddy
```

### Layer 3: Static Files

```bash
# Check files exist on server
ls -la /var/www/flowstate/assets/

# Check file contents
head /var/www/flowstate/index.html

# Compare local and remote hashes
local_hash=$(md5sum dist/assets/index-*.js | cut -d' ' -f1)
remote_hash=$(curl -s https://example.com/assets/index-*.js | md5sum | cut -d' ' -f1)
echo "Local: $local_hash, Remote: $remote_hash"
```

### Layer 4: Response Headers

```bash
# Check all headers
curl -sI https://example.com/assets/app.css

# Check specific critical headers
curl -sI https://example.com/assets/app.css | grep -iE "content-type|cache-control|vary|cf-cache-status"

# Expected for assets:
# content-type: text/css; charset=utf-8
# cache-control: public, max-age=31536000, immutable
# vary: Accept-Encoding, Accept
# cf-cache-status: HIT
```

---

## Common Production Issues

### Stale Assets After Deploy

**Symptom**: Old JavaScript/CSS still being served after deployment.

**Causes**:
1. Cloudflare edge cache not purged
2. index.html cached with old asset references
3. Service Worker serving cached versions

**Fix**:
```bash
# 1. Purge Cloudflare cache (Dashboard or API)
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# 2. Ensure index.html has no-cache
# In Caddyfile:
@html path /index.html
header @html Cache-Control "no-cache, no-store, must-revalidate"

# 3. Clear Service Worker (client-side)
# Users need to manually clear via DevTools → Application → Service Workers → Unregister
```

### CORS Errors

**Symptom**: API calls fail with CORS errors in browser.

**Diagnostic**:
```bash
# Test preflight
curl -X OPTIONS "https://api.example.com/endpoint" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -I
```

**Fix in Caddyfile**:
```caddyfile
@options method OPTIONS
handle @options {
    header Access-Control-Allow-Origin "*"
    header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    header Access-Control-Allow-Headers "*"
    respond 204
}
```

### WebSocket Connection Failures

**Symptom**: Supabase realtime subscriptions fail to connect.

**Diagnostic**:
```bash
# Check WebSocket upgrade headers
curl -sI "https://api.example.com/realtime/v1/websocket" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade"
```

**Fix in Caddyfile**:
```caddyfile
reverse_proxy localhost:8000 {
    header_up Upgrade {http.request.header.Upgrade}
    header_up Connection {http.request.header.Connection}
}
```

### 502 Bad Gateway

**Symptom**: Intermittent 502 errors from Cloudflare.

**Causes**:
1. Upstream (Caddy/backend) not responding
2. Connection timeout
3. SSL handshake failure between Cloudflare and origin

**Diagnostic**:
```bash
# Check if backend is up
ssh root@VPS "curl -s http://localhost:8000/health"

# Check Caddy logs for errors
ssh root@VPS "journalctl -u caddy --since '1 hour ago' | grep -i error"

# Check if origin SSL is valid
openssl s_client -connect YOUR_VPS_IP:443 </dev/null 2>/dev/null
```

---

## Browser-Specific Debugging

### Chrome DevTools Network Tab

**Hidden Issues**:
- Cached responses may show (from disk cache) / (from ServiceWorker)
- "Disable cache" only affects main requests, not preload scanner
- Module scripts and stylesheets have stricter MIME checking

**Force Fresh Request**:
1. Open DevTools (F12)
2. Right-click Reload button
3. Select "Empty Cache and Hard Reload"

### Firefox DevTools

**Differences from Chrome**:
- Less aggressive preload scanning
- Different Accept headers for resource requests
- May work when Chrome fails (indicates cache/header issue)

### Incognito Mode Limitations

**Common Misconception**: "Incognito bypasses caching"

**Reality**:
- ✅ Bypasses browser cache
- ✅ No cookies/localStorage
- ❌ Does NOT bypass CDN/edge cache
- ❌ Does NOT bypass Service Worker (unless cleared)

---

## Cloudflare-Specific Debugging

### Cache Status Headers

| Header Value | Meaning |
|--------------|---------|
| `cf-cache-status: HIT` | Served from edge cache |
| `cf-cache-status: MISS` | Fetched from origin |
| `cf-cache-status: DYNAMIC` | Not cacheable (HTML) |
| `cf-cache-status: EXPIRED` | Cache entry expired |
| `cf-cache-status: BYPASS` | Cache bypassed (cookies) |

### Debugging Cache Behavior

```bash
# Check cache status
curl -sI https://example.com/assets/app.css | grep cf-cache-status

# Force cache miss (purge single URL)
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"files":["https://example.com/assets/app.css"]}'

# Check from different edge location (use VPN)
```

### Cloudflare Ray ID

Every Cloudflare response includes `cf-ray` header:
```
cf-ray: 8a1b2c3d4e5f6g7h-SJC
```

The suffix (e.g., `SJC`) indicates the edge location (San Jose in this case). Use this to:
- Track specific request in Cloudflare logs
- Compare behavior across different edge locations

---

## Quick Diagnostic Checklist

When production is broken:

1. **Check if it's CDN or origin**:
   ```bash
   # Bypass Cloudflare (direct to origin)
   curl -sI --resolve "example.com:443:YOUR_VPS_IP" https://example.com
   ```

2. **Check if it's browser-specific**:
   - Test Firefox vs Chrome
   - Test with `curl`

3. **Check cache status**:
   ```bash
   curl -sI https://example.com/problem-url | grep -i "cf-cache\|cache-control\|vary"
   ```

4. **Check headers are correct**:
   ```bash
   curl -sI https://example.com/assets/app.css | grep -iE "content-type|vary"
   ```

5. **Purge and retry**:
   - Cloudflare Dashboard → Caching → Purge Everything
   - Hard refresh browser (Ctrl+Shift+R)
   - Test in incognito

---

## Prevention

### Header Validation in CI/CD

Add to deploy workflow:
```yaml
- name: Validate Headers
  run: ./scripts/validate-asset-headers.sh
```

### Post-Deploy Smoke Test

```bash
#!/bin/bash
# Quick smoke test after deploy

DOMAIN="https://example.com"

# Check index.html loads
curl -sf "$DOMAIN" > /dev/null || { echo "❌ index.html failed"; exit 1; }

# Check CSS has correct MIME
CSS_TYPE=$(curl -sI "$DOMAIN/assets/index.css" | grep -i content-type)
[[ "$CSS_TYPE" == *"text/css"* ]] || { echo "❌ CSS MIME wrong: $CSS_TYPE"; exit 1; }

# Check Vary header present
VARY=$(curl -sI "$DOMAIN/assets/index.css" | grep -i "^vary:")
[[ "$VARY" == *"Accept"* ]] || { echo "❌ Vary header missing"; exit 1; }

echo "✓ Smoke test passed"
```

---

## Related SOPs

- `SOP-026-custom-domain-deployment.md` - VPS & Caddy setup
- `SOP-031-cors-configuration.md` - CORS headers for API
- `SOP-032-cloudflare-cache-mime-prevention.md` - MIME type issue prevention
