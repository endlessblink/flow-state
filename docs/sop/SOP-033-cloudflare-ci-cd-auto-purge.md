# SOP-033: Cloudflare CI/CD Automatic Cache Purge

**Created**: 2026-01-25
**Related Task**: BUG-1069
**Status**: Active
**Depends On**: [SOP-032](./SOP-032-cloudflare-cache-mime-prevention.md) (Origin headers)

## Problem

Even with correct `Vary` and `Cache-Control` headers on the origin (SOP-032), users can still see stale content after deployments because:

1. Old cache entries remain at Cloudflare edge until TTL expires
2. Manual purging is error-prone and easily forgotten
3. `index.html` caching causes browsers to request old asset filenames

## Solution

Automatic Cloudflare cache purge integrated into the CI/CD deploy workflow.

### Prerequisites

Add these secrets to GitHub repository:

| Secret | Where to Get |
|--------|--------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard → Profile → API Tokens → Create Token |
| `CLOUDFLARE_ZONE_ID` | Cloudflare Dashboard → Your Domain → Overview → API section |

**API Token Permissions (Least Privilege):**
- Permission: `Zone` → `Cache Purge` → `Purge`
- Zone Resources: `Include` → `Specific zone` → `your-domain.com`

### Workflow Step

Add to `.github/workflows/deploy.yml` after file deployment:

```yaml
# Purge Cloudflare cache for mutable content (index.html only)
# Fingerprinted assets auto-invalidate via hash change
- name: Purge Cloudflare Cache
  run: |
      echo "Purging Cloudflare cache for index.html..."

      RESPONSE=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
        -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
        -H "Content-Type: application/json" \
        --data '{"files":["https://your-domain.com/","https://your-domain.com/index.html"]}')

      SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
      if [ "$SUCCESS" != "true" ]; then
        echo "✗ Cloudflare cache purge failed!"
        echo "$RESPONSE" | jq .
        exit 1
      fi

      echo "✓ Cloudflare cache purged successfully"

      # Verify cache status
      CF_STATUS=$(curl -sI "https://your-domain.com/" | grep -i "cf-cache-status")
      echo "  $CF_STATUS"
```

### What Gets Purged

| Content | Purge? | Why |
|---------|--------|-----|
| `/` (root) | Yes | SPA entry point, must be fresh |
| `/index.html` | Yes | Same as root |
| `/assets/index-*.js` | No | Fingerprinted, auto-invalidates |
| `/assets/index-*.css` | No | Fingerprinted, auto-invalidates |
| `/sw.js` | No | Already has `no-cache` header |

### Verification

Check deploy logs for:
```
Purging Cloudflare cache for index.html...
✓ Cloudflare cache purged successfully
  cf-cache-status: DYNAMIC
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `success: false` | Invalid API token or Zone ID | Regenerate token with correct permissions |
| `403 Forbidden` | Token missing Cache Purge permission | Add `Zone → Cache Purge → Purge` |
| Users still see old content | Browser cache or Service Worker | User must clear site data manually |

## Related

- [SOP-032](./SOP-032-cloudflare-cache-mime-prevention.md) - Origin header configuration
- `.github/workflows/deploy.yml` - CI/CD workflow

## Key Files

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | Deploy workflow with purge step |
| `/etc/caddy/Caddyfile` (VPS) | Origin headers (`no-cache` for `/` and `/index.html`) |
