# SOP-032: Cloudflare Cache MIME Type Prevention

**Created**: 2026-01-25
**Status**: Active
**Related Task**: BUG-1063 (Cloudflare Cache MIME Type Error)
**Severity**: Critical (breaks app for all Chromium users)

## Executive Summary

This SOP documents a critical class of bugs where Cloudflare's edge cache serves static assets (CSS/JS) with incorrect MIME types, causing Chromium-based browsers to reject them. Firefox browsers work correctly, making this issue particularly insidious to diagnose.

**Time to diagnose**: 4+ hours (due to contradictory evidence)
**Time to fix**: 15 minutes (once understood)
**Prevention effort**: One-time 15-minute setup

---

## Part 1: Understanding the Problem

### The Bug Manifestation

**Symptoms (All must be present):**
1. Chromium browsers (Chrome, Brave, Edge) fail to load CSS/JS
2. Firefox-based browsers work correctly
3. `curl` returns correct MIME types
4. Direct URL navigation in browser shows correct content
5. Module/stylesheet loading fails with MIME errors

**Error Messages:**
```
Refused to apply style from 'https://example.com/assets/index.css'
because its MIME type ('text/html') is not a supported stylesheet MIME type

Failed to load module script: Expected a JavaScript module script but the
server responded with a MIME type of "text/html"
```

### The Contradiction That Confuses Debugging

| Test Method | Result | Why |
|-------------|--------|-----|
| `curl -I` | ✅ Correct MIME type | Standard HTTP request |
| Direct browser navigation | ✅ Correct content | Standard navigation request |
| DevTools Network tab | ❌ `text/html` | Preload scanner request |
| Module `<script>` | ❌ MIME error | Different Accept header |
| `<link rel="stylesheet">` | ❌ MIME error | Different Accept header |

This contradiction is why this bug takes hours to diagnose - every direct verification method shows correct behavior.

### Root Cause: Preload Scanner + Edge Cache

**The Technical Chain:**

```
1. User visits page
2. Chromium's preload scanner finds <link href="app.css">
3. Preload scanner sends request with:
   Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
4. Cloudflare sees this Accept header
5. Cloudflare finds cached entry (from a previous HTML request with same URL pattern)
6. Cloudflare returns that cached entry (which is HTML, not CSS)
7. Browser receives content-type: text/html
8. Browser rejects CSS because MIME type mismatch
```

**Why Firefox Works:**
- Different preload scanner behavior
- Different Accept header handling
- May bypass Cloudflare's cache due to timing

### Why Standard Cache Purging Doesn't Work

| Action | Why It Fails |
|--------|--------------|
| Clear browser cache | Edge cache still has wrong entry |
| Incognito mode | Still gets wrong entry from edge |
| New browser install | Still gets wrong entry from edge |
| Cloudflare purge without Vary | Same cache key, repopulates wrong |
| Hard refresh (Ctrl+Shift+R) | Preload scanner still makes separate request |

---

## Part 2: The Three-Layer Defense

### Layer 1: Origin Server Headers (Caddy)

**Critical Header: `Vary: Accept`**

This tells Cloudflare to create separate cache entries for requests with different `Accept` headers.

**Complete Caddyfile Configuration:**
```caddyfile
in-theflow.com {
    tls /etc/caddy/certs/cloudflare-origin.pem /etc/caddy/certs/cloudflare-origin.key
    root * /var/www/flowstate
    encode gzip

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }

    # Service worker - NEVER cache (causes stale SW issues)
    @sw path /sw.js
    header @sw Cache-Control "no-cache, no-store, must-revalidate"

    # Static assets - CRITICAL: Include Vary header for Cloudflare
    @static path /assets/*
    header @static Cache-Control "public, max-age=31536000, immutable"
    header @static Vary "Accept-Encoding, Accept"
    header @static X-Content-Type-Options "nosniff"

    # index.html - prevent stale HTML causing wrong asset references
    @html path /index.html
    header @html Cache-Control "no-cache, no-store, must-revalidate"
    header @html Vary "Accept"

    # Workbox manifest - don't cache
    @manifest path /manifest.webmanifest
    header @manifest Cache-Control "no-cache"

    try_files {path} /index.html
    file_server
}
```

**Header Explanation:**

| Header | Value | Purpose |
|--------|-------|---------|
| `Vary` | `Accept-Encoding, Accept` | Cache key includes Accept header |
| `Cache-Control` | `immutable` | Fingerprinted assets never change |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing attacks |

### Layer 2: CDN Configuration (Cloudflare)

**Option A: Cloudflare Cache Rule (Recommended)**

1. Go to Cloudflare Dashboard → your domain → Rules → Cache Rules
2. Create rule:
   - **Name**: "Static Assets - Respect Vary"
   - **When**: `URI Path` starts with `/assets/`
   - **Then**:
     - Cache eligibility: Eligible for cache
     - Edge TTL: 1 year (31536000 seconds)
     - Browser TTL: 1 year
     - Cache key: Custom key
       - Include header: `Accept`
       - Query string: Include all

**Option B: Page Rules (Legacy)**
```
URL: example.com/assets/*
- Cache Level: Standard
- Edge Cache TTL: 1 year
- Browser Cache TTL: 1 year
```

**Option C: Workers (Maximum Control)**
```javascript
// Cloudflare Worker to add Vary header
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const response = await fetch(request)

  if (request.url.includes('/assets/')) {
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('Vary', 'Accept-Encoding, Accept')
    return newResponse
  }

  return response
}
```

### Layer 3: CI/CD Validation

**Validation Script:** `scripts/validate-asset-headers.sh`

```bash
#!/bin/bash
# Validate asset headers to prevent Cloudflare cache MIME type issues

set -e

DOMAIN="${DOMAIN:-https://in-theflow.com}"
FAILED=0

echo "=== Asset Header Validation ==="
echo "Domain: $DOMAIN"

# Function to check a URL for required headers
check_url() {
    local url="$1"
    local expected_type="$2"
    local name="$3"

    echo "Checking $name..."
    headers=$(curl -sI "$url" 2>/dev/null)

    # Check Content-Type
    content_type=$(echo "$headers" | grep -i "^content-type:" | tr -d '\r' | cut -d' ' -f2-)
    if [[ "$content_type" != *"$expected_type"* ]]; then
        echo "  ✗ Content-Type: expected '$expected_type', got '$content_type'"
        FAILED=1
    else
        echo "  ✓ Content-Type: $content_type"
    fi

    # Check Vary header (CRITICAL)
    vary=$(echo "$headers" | grep -i "^vary:" | tr -d '\r')
    if [[ -z "$vary" ]]; then
        echo "  ✗ Vary header missing (CRITICAL)"
        FAILED=1
    elif [[ "$vary" != *"Accept"* ]]; then
        echo "  ⚠ Vary header doesn't include 'Accept': $vary"
        FAILED=1
    else
        echo "  ✓ Vary: $vary"
    fi

    # Check Cache-Control
    cache_control=$(echo "$headers" | grep -i "^cache-control:" | tr -d '\r')
    echo "  ✓ Cache-Control: $cache_control"
}

# Get actual asset filenames from index.html
INDEX_HTML=$(curl -s "$DOMAIN/")

CSS_FILE=$(echo "$INDEX_HTML" | grep -oE 'href="/assets/index-[a-zA-Z0-9_-]+\.css"' | head -1 | sed 's/href="//;s/"//')
JS_FILE=$(echo "$INDEX_HTML" | grep -oE 'src="/assets/index-[a-zA-Z0-9_-]+\.js"' | head -1 | sed 's/src="//;s/"//')

[[ -n "$CSS_FILE" ]] && check_url "$DOMAIN$CSS_FILE" "text/css" "CSS Asset"
[[ -n "$JS_FILE" ]] && check_url "$DOMAIN$JS_FILE" "javascript" "JavaScript Asset"

if [[ $FAILED -eq 0 ]]; then
    echo "✓ All critical headers validated"
    exit 0
else
    echo "✗ Header validation failed"
    exit 1
fi
```

**GitHub Actions Integration:**
```yaml
# In .github/workflows/deploy.yml
- name: Validate Asset Headers
  run: |
      chmod +x ./scripts/validate-asset-headers.sh
      ./scripts/validate-asset-headers.sh
  env:
    DOMAIN: https://in-theflow.com
```

---

## Part 3: Emergency Response

### If This Bug Occurs in Production

**Immediate Fix (5 minutes):**

```bash
# 1. SSH to VPS and add Vary header
ssh root@YOUR_VPS "
sed -i '/header @static Cache-Control/a\    header @static Vary \"Accept-Encoding, Accept\"' /etc/caddy/Caddyfile
systemctl reload caddy
"

# 2. Purge Cloudflare cache
# Go to Cloudflare Dashboard → Caching → Purge Everything

# 3. Wait 30 seconds, then test
curl -sI "https://your-domain.com/assets/index-*.css" | grep -iE "content-type|vary"
```

**Or use the automated script:**
```bash
./scripts/fix-cloudflare-cache.sh
```

### Verification After Fix

```bash
# 1. Check headers are correct
curl -sI "https://in-theflow.com/assets/index-CUxdMTCj.css" | grep -iE "content-type|vary|cache-control"

# Expected output:
# content-type: text/css; charset=utf-8
# vary: Accept-Encoding, Accept
# cache-control: public, max-age=31536000, immutable

# 2. Check from a different edge location (use VPN or ask friend in different region)

# 3. Test in fresh Chromium browser
# - Open Chrome
# - Ctrl+Shift+N (incognito)
# - Navigate to site
# - Open DevTools → Network tab
# - Refresh and check CSS/JS loads correctly
```

---

## Part 4: Prevention Checklist

### One-Time Setup

- [ ] Update Caddyfile with `Vary: Accept-Encoding, Accept` for `/assets/*`
- [ ] Add `Cache-Control: no-cache` for `index.html`
- [ ] Create Cloudflare Cache Rule (optional but recommended)
- [ ] Add `validate-asset-headers.sh` to repository
- [ ] Add header validation step to deploy workflow
- [ ] Document in project CLAUDE.md / README

### Per-Deployment Checklist

- [ ] Build completes successfully
- [ ] Assets are uploaded with correct MIME types
- [ ] Header validation passes in CI/CD
- [ ] Quick smoke test in Chrome after deploy

### Monitoring

Set up alerting for:
- HTTP 4xx/5xx spikes
- JavaScript error rate increase
- CSS not loaded (can detect via error boundary)

---

## Part 5: Technical Deep-Dive

### Why Chromium's Preload Scanner Causes This

The preload scanner is an optimization that looks ahead in HTML to start fetching resources before the main parser reaches them. However:

1. **Preload requests are speculative** - They use generic Accept headers
2. **Module scripts have strict MIME checking** - They reject `text/html`
3. **Stylesheets have strict MIME checking** - They reject `text/html`

### Cloudflare's Cache Key Algorithm

Default Cloudflare cache key includes:
- Full URL (including query string)
- Host header

Default cache key does NOT include:
- Accept header
- User-Agent
- Cookie

This means all requests to `/assets/app.css` hit the same cache entry, regardless of Accept header.

### The Vary Header Solution

`Vary: Accept` tells caches:
> "Different Accept header values should get different cache entries"

This creates separate cache entries for:
- `Accept: text/html,...` → One cache entry
- `Accept: text/css,...` → Different cache entry
- No Accept header → Another cache entry

### Browser Behavior Matrix

| Browser | Preload Scanner | Accept Header | Strict MIME | Affected |
|---------|-----------------|---------------|-------------|----------|
| Chrome | Aggressive | text/html,... | Yes | Yes |
| Brave | Same as Chrome | text/html,... | Yes | Yes |
| Edge | Same as Chrome | text/html,... | Yes | Yes |
| Firefox | Conservative | Varies | Yes | No |
| Safari | Unknown | Unknown | Yes | Unknown |

---

## Part 6: Related Issues and Similar Bugs

### Similar Cloudflare Cache Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| Stale HTML after deploy | Old asset hashes | `no-cache` on index.html |
| CORS on cached responses | Missing CORS headers | `Vary: Origin` |
| Auth on cached responses | Leaked private data | `Cache-Control: private` |
| Mixed content warnings | HTTP assets | Force HTTPS in Caddy |

### References

- [Cloudflare Cache Keys Documentation](https://developers.cloudflare.com/cache/how-to/create-cache-keys/)
- [HTTP Vary Header (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary)
- [Chrome Preload Scanner](https://developer.chrome.com/docs/lighthouse/performance/uses-rel-preload/)
- [MIME Type Strict Checking](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)

---

## Key Files

| File | Purpose |
|------|---------|
| `/etc/caddy/Caddyfile` | VPS Caddy configuration (edit on server) |
| `scripts/validate-asset-headers.sh` | CI/CD header validation |
| `scripts/fix-cloudflare-cache.sh` | Emergency fix script |
| `.github/workflows/deploy.yml` | Deployment workflow |
| `docs/sop/SOP-032-cloudflare-cache-mime-prevention.md` | This document |

---

## Change Log

| Date | Change |
|------|--------|
| 2026-01-25 | Initial creation after 4-hour debugging session |
