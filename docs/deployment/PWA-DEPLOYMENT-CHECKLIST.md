# PWA Deployment Verification Checklist

**Document Type**: Deployment Verification Procedures
**Target Environment**: VPS (Ubuntu 22.04+, Nginx, SSL)
**Application**: Pomo-Flow PWA
**Last Updated**: January 7, 2026

---

## Overview

This document provides executable checklists for deploying Pomo-Flow PWA to production. Unlike database migrations, PWA deployments require verification of service workers, caching headers, SSL configuration, and installability criteria.

**Deployment Stack:**
- Ubuntu 22.04+ VPS
- Nginx with Let's Encrypt SSL
- GitHub Actions CI/CD
- Static Vue 3 PWA (Vite build)

---

## Pre-Deployment Checklist

### 1. Service Worker Versioning

| Check | Command/Action | Expected Result |
|-------|----------------|-----------------|
| SW version incremented | Check `vite.config.ts` or `sw.ts` | Version string differs from production |
| Precache manifest updated | `npm run build && cat dist/sw.js \| grep -c "precache"` | Contains updated file hashes |
| No hardcoded API URLs in SW | `grep -r "http://" src/sw.ts 2>/dev/null \|\| echo "OK"` | No hardcoded HTTP URLs |
| Workbox config valid | `npm run build` completes without SW errors | Build succeeds |

**Version Verification Script:**
```bash
#!/bin/bash
# scripts/verify-sw-version.sh

BUILD_DIR="dist"
SW_FILE="$BUILD_DIR/sw.js"

if [ ! -f "$SW_FILE" ]; then
  echo "ERROR: Service worker not found at $SW_FILE"
  exit 1
fi

# Extract version from SW (adjust pattern based on your setup)
SW_VERSION=$(grep -oP "CACHE_VERSION\s*=\s*['\"]([^'\"]+)['\"]" "$SW_FILE" | head -1)
echo "Service Worker Version: $SW_VERSION"

# Check precache entries
PRECACHE_COUNT=$(grep -c '"url"' "$BUILD_DIR/workbox-*.js" 2>/dev/null || echo "0")
echo "Precached files: $PRECACHE_COUNT"

if [ "$PRECACHE_COUNT" -lt "5" ]; then
  echo "WARNING: Low precache count. Verify workbox config."
fi
```

### 2. Web App Manifest Validation

| Check | Command/Action | Expected Result |
|-------|----------------|-----------------|
| Manifest exists | `ls dist/manifest.webmanifest` | File exists |
| Name correct | `jq '.name' dist/manifest.webmanifest` | "Pomo-Flow" |
| Start URL valid | `jq '.start_url' dist/manifest.webmanifest` | "/" or "/?source=pwa" |
| Display mode | `jq '.display' dist/manifest.webmanifest` | "standalone" |
| Icons present | `jq '.icons \| length' dist/manifest.webmanifest` | >= 4 icons |
| Theme color set | `jq '.theme_color' dist/manifest.webmanifest` | "#4F46E5" (or configured) |
| Background color set | `jq '.background_color' dist/manifest.webmanifest` | "#ffffff" |

**Manifest Validation Script:**
```bash
#!/bin/bash
# scripts/validate-manifest.sh

MANIFEST="dist/manifest.webmanifest"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: Manifest not found at $MANIFEST"
  exit 1
fi

echo "=== Manifest Validation ==="

# Required fields
REQUIRED_FIELDS=("name" "short_name" "icons" "start_url" "display" "theme_color" "background_color")

for field in "${REQUIRED_FIELDS[@]}"; do
  VALUE=$(jq -r ".$field // \"MISSING\"" "$MANIFEST")
  if [ "$VALUE" = "MISSING" ] || [ "$VALUE" = "null" ]; then
    echo "ERROR: Missing required field: $field"
    exit 1
  fi
  echo "OK: $field = $VALUE"
done

# Validate icon sizes
ICON_SIZES=$(jq -r '.icons[].sizes' "$MANIFEST")
REQUIRED_SIZES=("192x192" "512x512")

for size in "${REQUIRED_SIZES[@]}"; do
  if ! echo "$ICON_SIZES" | grep -q "$size"; then
    echo "ERROR: Missing required icon size: $size"
    exit 1
  fi
done

echo ""
echo "=== All manifest checks passed ==="
```

### 3. Build Artifacts Verification

| Check | Command/Action | Expected Result |
|-------|----------------|-----------------|
| Build completes | `npm run build` | Exit code 0 |
| Index.html exists | `ls dist/index.html` | File exists |
| JS bundle exists | `ls dist/assets/*.js \| wc -l` | >= 1 files |
| CSS bundle exists | `ls dist/assets/*.css \| wc -l` | >= 1 files |
| Service worker exists | `ls dist/sw.js` | File exists |
| Icons directory | `ls dist/icons/ \| wc -l` | >= 4 files |
| No source maps in prod | `ls dist/**/*.map 2>/dev/null \| wc -l` | 0 (or as configured) |
| Gzip size acceptable | `du -sh dist/` | < 5MB uncompressed |

**Build Verification Script:**
```bash
#!/bin/bash
# scripts/verify-build.sh

BUILD_DIR="dist"
MAX_SIZE_MB=5

echo "=== Build Artifact Verification ==="

# Check required files
REQUIRED_FILES=(
  "$BUILD_DIR/index.html"
  "$BUILD_DIR/sw.js"
  "$BUILD_DIR/manifest.webmanifest"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERROR: Required file missing: $file"
    exit 1
  fi
  echo "OK: $file exists"
done

# Check JS bundles
JS_COUNT=$(ls "$BUILD_DIR/assets/"*.js 2>/dev/null | wc -l)
if [ "$JS_COUNT" -lt 1 ]; then
  echo "ERROR: No JS bundles found"
  exit 1
fi
echo "OK: $JS_COUNT JS bundles found"

# Check bundle sizes
TOTAL_SIZE=$(du -sm "$BUILD_DIR" | cut -f1)
if [ "$TOTAL_SIZE" -gt "$MAX_SIZE_MB" ]; then
  echo "WARNING: Build size ${TOTAL_SIZE}MB exceeds ${MAX_SIZE_MB}MB target"
else
  echo "OK: Build size ${TOTAL_SIZE}MB"
fi

# Check for source maps (should not exist in production)
MAP_COUNT=$(find "$BUILD_DIR" -name "*.map" 2>/dev/null | wc -l)
if [ "$MAP_COUNT" -gt 0 ]; then
  echo "WARNING: $MAP_COUNT source maps found in production build"
fi

echo ""
echo "=== Build verification complete ==="
```

### 4. Environment Configuration

| Check | Action | Expected Result |
|-------|--------|-----------------|
| Production env vars set | Review `.env.production` | All required vars present |
| API URLs are HTTPS | `grep -r "http://" .env.production` | No HTTP URLs (except localhost) |
| Secrets not in build | `grep -r "secret\|password" dist/` | No matches |
| CSP headers planned | Review nginx config | CSP header defined |

**Environment Checklist:**
```bash
#!/bin/bash
# scripts/verify-env.sh

echo "=== Environment Verification ==="

# Check production env file
if [ ! -f ".env.production" ]; then
  echo "WARNING: .env.production not found"
else
  # Required variables (adjust based on your app)
  REQUIRED_VARS=("VITE_SUPABASE_URL" "VITE_SUPABASE_ANON_KEY")

  for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^$var=" .env.production; then
      echo "ERROR: Missing required var: $var"
    else
      echo "OK: $var is set"
    fi
  done
fi

# Check for secrets in build output
echo ""
echo "Checking for exposed secrets in build..."
SENSITIVE_PATTERNS=("password" "secret" "private" "sk_live" "api_key")

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  MATCHES=$(grep -ri "$pattern" dist/ 2>/dev/null | grep -v "node_modules" | wc -l)
  if [ "$MATCHES" -gt 0 ]; then
    echo "WARNING: Found '$pattern' in build output ($MATCHES occurrences)"
  fi
done

echo ""
echo "=== Environment verification complete ==="
```

---

## Deployment Steps

### Deploy Sequence

```
1. Pre-deploy verification complete
   |
2. Create backup of current deployment
   |
3. Upload new build to VPS
   |
4. Update nginx configuration (if changed)
   |
5. Test SSL certificate validity
   |
6. Reload nginx
   |
7. Run post-deploy verification
   |
8. Monitor for 15 minutes
   |
9. Close deployment or rollback
```

### Step-by-Step Commands

```bash
# 1. On local machine - Build and verify
npm run build
bash scripts/verify-build.sh
bash scripts/validate-manifest.sh

# 2. On VPS - Create backup
ssh deploy@your-vps.com
sudo cp -r /var/www/pomoflow/dist /var/www/pomoflow/dist.backup.$(date +%Y%m%d_%H%M%S)

# 3. Upload new build (via rsync or GitHub Actions)
rsync -avz --delete dist/ deploy@your-vps.com:/var/www/pomoflow/dist/

# 4. Verify nginx config (if updated)
sudo nginx -t

# 5. Test SSL
openssl s_client -connect pomoflow.yourdomain.com:443 -servername pomoflow.yourdomain.com < /dev/null 2>/dev/null | openssl x509 -noout -dates

# 6. Reload nginx
sudo systemctl reload nginx

# 7. Run post-deploy verification (see next section)
```

---

## Post-Deployment Verification

### 1. SSL/HTTPS Verification

| Check | Command/Action | Expected Result |
|-------|----------------|-----------------|
| HTTPS redirect works | `curl -I http://pomoflow.yourdomain.com` | 301/302 redirect to HTTPS |
| SSL certificate valid | `curl -vI https://pomoflow.yourdomain.com 2>&1 \| grep "SSL certificate verify ok"` | Verification passes |
| Certificate not expiring soon | `echo \| openssl s_client -servername pomoflow.yourdomain.com -connect pomoflow.yourdomain.com:443 2>/dev/null \| openssl x509 -noout -dates` | Expires > 14 days |
| HSTS header present | `curl -sI https://pomoflow.yourdomain.com \| grep -i strict-transport` | Header present |
| No mixed content | Browser dev tools | No console warnings |

**SSL Verification Script:**
```bash
#!/bin/bash
# scripts/verify-ssl.sh

DOMAIN="pomoflow.yourdomain.com"

echo "=== SSL/HTTPS Verification for $DOMAIN ==="

# Test HTTPS redirect
echo "Testing HTTP -> HTTPS redirect..."
REDIRECT=$(curl -sI -o /dev/null -w "%{http_code}" "http://$DOMAIN")
if [ "$REDIRECT" = "301" ] || [ "$REDIRECT" = "302" ]; then
  echo "OK: HTTP redirects to HTTPS (status: $REDIRECT)"
else
  echo "WARNING: No HTTPS redirect (status: $REDIRECT)"
fi

# Test SSL certificate
echo ""
echo "Checking SSL certificate..."
CERT_INFO=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
if [ $? -eq 0 ]; then
  echo "OK: SSL certificate valid"
  echo "$CERT_INFO"
else
  echo "ERROR: SSL certificate check failed"
  exit 1
fi

# Check certificate expiry
EXPIRY_DATE=$(echo "$CERT_INFO" | grep "notAfter" | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

if [ "$DAYS_LEFT" -lt 14 ]; then
  echo "WARNING: Certificate expires in $DAYS_LEFT days!"
else
  echo "OK: Certificate expires in $DAYS_LEFT days"
fi

# Check HSTS header
echo ""
echo "Checking security headers..."
HSTS=$(curl -sI "https://$DOMAIN" | grep -i "strict-transport-security")
if [ -n "$HSTS" ]; then
  echo "OK: HSTS header present"
else
  echo "WARNING: HSTS header missing"
fi

echo ""
echo "=== SSL verification complete ==="
```

### 2. Caching Headers Verification

| Check | Command | Expected Result |
|-------|---------|-----------------|
| HTML no-cache | `curl -sI https://pomoflow.yourdomain.com/ \| grep -i cache-control` | no-cache or max-age=0 |
| JS immutable cache | `curl -sI https://pomoflow.yourdomain.com/assets/[hash].js \| grep -i cache-control` | max-age=31536000, immutable |
| CSS immutable cache | `curl -sI https://pomoflow.yourdomain.com/assets/[hash].css \| grep -i cache-control` | max-age=31536000, immutable |
| SW no-cache | `curl -sI https://pomoflow.yourdomain.com/sw.js \| grep -i cache-control` | no-store or no-cache |
| Manifest cached | `curl -sI https://pomoflow.yourdomain.com/manifest.webmanifest \| grep -i cache-control` | max-age < 86400 |

**Caching Headers Script:**
```bash
#!/bin/bash
# scripts/verify-caching.sh

DOMAIN="https://pomoflow.yourdomain.com"

echo "=== Cache Header Verification ==="

# Function to check cache header
check_cache() {
  local URL=$1
  local EXPECTED=$2
  local NAME=$3

  CACHE=$(curl -sI "$URL" | grep -i "cache-control" | tr -d '\r')

  if [ -z "$CACHE" ]; then
    echo "WARNING: $NAME - No cache-control header"
  else
    echo "$NAME: $CACHE"
  fi
}

# Check index.html (should not be cached long)
check_cache "$DOMAIN/" "no-cache" "index.html"

# Check service worker (must not be cached)
check_cache "$DOMAIN/sw.js" "no-store" "sw.js"

# Check manifest
check_cache "$DOMAIN/manifest.webmanifest" "max-age" "manifest"

# Check a JS asset (get actual filename from build)
JS_ASSET=$(curl -s "$DOMAIN/" | grep -oP 'assets/[^"]+\.js' | head -1)
if [ -n "$JS_ASSET" ]; then
  check_cache "$DOMAIN/$JS_ASSET" "immutable" "JS bundle"
fi

# Check a CSS asset
CSS_ASSET=$(curl -s "$DOMAIN/" | grep -oP 'assets/[^"]+\.css' | head -1)
if [ -n "$CSS_ASSET" ]; then
  check_cache "$DOMAIN/$CSS_ASSET" "immutable" "CSS bundle"
fi

echo ""
echo "=== Cache header verification complete ==="
```

### 3. PWA Installability Verification

| Check | Tool/Method | Expected Result |
|-------|-------------|-----------------|
| Manifest linked | Browser DevTools > Application > Manifest | Manifest detected |
| Service worker registered | DevTools > Application > Service Workers | SW active |
| Install prompt available | Chrome Desktop/Android | "Install app" option shows |
| Lighthouse PWA score | `npx lighthouse https://pomoflow.yourdomain.com --only-categories=pwa --output=json` | Score >= 90 |
| iOS Add to Home Screen | Safari > Share > Add to Home Screen | Works correctly |

**PWA Verification Script (Lighthouse):**
```bash
#!/bin/bash
# scripts/verify-pwa.sh

DOMAIN="https://pomoflow.yourdomain.com"
OUTPUT_DIR="lighthouse-reports"

mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== PWA Installability Verification ==="

# Run Lighthouse PWA audit
echo "Running Lighthouse PWA audit..."
npx lighthouse "$DOMAIN" \
  --only-categories=pwa,performance,accessibility \
  --output=html,json \
  --output-path="$OUTPUT_DIR/lighthouse-$TIMESTAMP" \
  --chrome-flags="--headless --no-sandbox" \
  --quiet

# Parse results
if [ -f "$OUTPUT_DIR/lighthouse-$TIMESTAMP.report.json" ]; then
  PWA_SCORE=$(jq '.categories.pwa.score * 100' "$OUTPUT_DIR/lighthouse-$TIMESTAMP.report.json")
  PERF_SCORE=$(jq '.categories.performance.score * 100' "$OUTPUT_DIR/lighthouse-$TIMESTAMP.report.json")

  echo ""
  echo "=== Lighthouse Results ==="
  echo "PWA Score: $PWA_SCORE"
  echo "Performance Score: $PERF_SCORE"
  echo "Report: $OUTPUT_DIR/lighthouse-$TIMESTAMP.report.html"

  if (( $(echo "$PWA_SCORE < 90" | bc -l) )); then
    echo "WARNING: PWA score below 90"
  else
    echo "OK: PWA score meets target"
  fi
else
  echo "ERROR: Lighthouse report not generated"
fi
```

### 4. Functional Smoke Tests

| Test | Action | Expected Result |
|------|--------|-----------------|
| App loads | Navigate to domain | Main view renders |
| Auth flow | Try login | Login succeeds |
| Task creation | Create a task | Task appears in list |
| Offline indicator | Disconnect network | Offline status shows |
| SW update prompt | Deploy new version, refresh | Update prompt appears |

**Automated Smoke Test (Playwright):**
```javascript
// tests/smoke/pwa-smoke.spec.js
import { test, expect } from '@playwright/test';

const PROD_URL = process.env.PROD_URL || 'https://pomoflow.yourdomain.com';

test.describe('PWA Smoke Tests', () => {
  test('app loads successfully', async ({ page }) => {
    await page.goto(PROD_URL);
    await expect(page).toHaveTitle(/Pomo/i);
    await expect(page.locator('#app')).toBeVisible();
  });

  test('manifest is valid', async ({ page }) => {
    const response = await page.goto(`${PROD_URL}/manifest.webmanifest`);
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.name).toBe('Pomo-Flow');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('service worker registers', async ({ page }) => {
    await page.goto(PROD_URL);

    // Wait for SW to register
    await page.waitForFunction(() => {
      return navigator.serviceWorker.controller !== null;
    }, { timeout: 10000 });

    const swState = await page.evaluate(() => {
      return navigator.serviceWorker.controller?.state;
    });

    expect(swState).toBe('activated');
  });

  test('app works offline (basic)', async ({ page, context }) => {
    // Load app first
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Reload should serve from cache
    await page.reload();
    await expect(page.locator('#app')).toBeVisible();

    // Restore network
    await context.setOffline(false);
  });
});
```

---

## Rollback Procedures

### Immediate Rollback (< 5 minutes post-deploy)

**Trigger Conditions:**
- App fails to load
- Critical JS errors in console
- Service worker registration fails
- Auth flow broken

**Rollback Steps:**
```bash
# On VPS
# 1. Identify latest backup
ls -la /var/www/pomoflow/dist.backup.*

# 2. Swap to backup
sudo mv /var/www/pomoflow/dist /var/www/pomoflow/dist.failed.$(date +%Y%m%d_%H%M%S)
sudo mv /var/www/pomoflow/dist.backup.[latest] /var/www/pomoflow/dist

# 3. Clear any nginx cache
sudo rm -rf /var/cache/nginx/*

# 4. Reload nginx
sudo systemctl reload nginx

# 5. Verify rollback
curl -I https://pomoflow.yourdomain.com
```

### Service Worker Rollback (Force Update)

If users have cached a broken service worker:

```bash
# Deploy emergency SW that clears caches
# In your emergency sw.js:
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => {
      return self.clients.claim();
    })
  );
});
```

### Rollback Decision Matrix

| Issue | Severity | Action |
|-------|----------|--------|
| App won't load | Critical | Immediate rollback |
| SW registration fails | Critical | Immediate rollback |
| Auth broken | Critical | Immediate rollback |
| Minor UI glitch | Low | Monitor, fix forward |
| Performance regression | Medium | Monitor 1h, then decide |
| Offline mode degraded | Medium | Fix forward with hotfix |

---

## Health Check Endpoints

### Application Health Check

Create a lightweight health check endpoint:

```typescript
// src/health.ts - served as /health
export const healthCheck = {
  status: 'ok',
  version: __APP_VERSION__,
  timestamp: new Date().toISOString(),
  environment: import.meta.env.MODE
};
```

**Nginx location for health check:**
```nginx
location /health {
    default_type application/json;
    return 200 '{"status":"ok","timestamp":"$time_iso8601"}';
}
```

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

DOMAIN="https://pomoflow.yourdomain.com"
TIMEOUT=10

echo "=== Health Check ==="

# Basic connectivity
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DOMAIN")
if [ "$HTTP_CODE" = "200" ]; then
  echo "OK: Site responding (HTTP $HTTP_CODE)"
else
  echo "ERROR: Site not responding (HTTP $HTTP_CODE)"
  exit 1
fi

# Health endpoint (if configured)
HEALTH=$(curl -s --max-time $TIMEOUT "$DOMAIN/health" 2>/dev/null)
if [ -n "$HEALTH" ]; then
  echo "OK: Health endpoint responding"
  echo "Response: $HEALTH"
fi

# Check critical resources
RESOURCES=(
  "/manifest.webmanifest"
  "/sw.js"
)

for resource in "${RESOURCES[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DOMAIN$resource")
  if [ "$CODE" = "200" ]; then
    echo "OK: $resource accessible"
  else
    echo "ERROR: $resource not accessible (HTTP $CODE)"
  fi
done

echo ""
echo "=== Health check complete ==="
```

---

## Monitoring Setup

### 1. Sentry Error Tracking

**Setup Steps:**
1. Create Sentry project (Vue, Browser JS)
2. Install `@sentry/vue` package
3. Initialize in `main.ts`

```typescript
// src/main.ts
import * as Sentry from "@sentry/vue";

if (import.meta.env.PROD) {
  Sentry.init({
    app,
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1, // 10% of transactions
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of error sessions
    environment: import.meta.env.MODE,
    release: __APP_VERSION__,
  });
}
```

**Sentry Alert Configuration:**
```yaml
# Recommended alerts
- name: "High Error Rate"
  condition: "error_count > 10 in 5 minutes"
  action: "Slack notification + Email"

- name: "New Error Type"
  condition: "First seen error"
  action: "Slack notification"

- name: "Performance Degradation"
  condition: "p95 latency > 3s for 5 minutes"
  action: "Email notification"
```

### 2. UptimeRobot Configuration

**Monitors to Create:**

| Monitor Name | Type | URL | Interval | Alert |
|-------------|------|-----|----------|-------|
| PomoFlow Main | HTTP(s) | https://pomoflow.yourdomain.com | 5 min | Email + Slack |
| PomoFlow Health | HTTP(s) | https://pomoflow.yourdomain.com/health | 5 min | Email |
| PomoFlow SW | HTTP(s) | https://pomoflow.yourdomain.com/sw.js | 15 min | Email |
| SSL Certificate | SSL | pomoflow.yourdomain.com | 1 day | Email (14 day warning) |

**Status Page:**
- Create public status page: `status.pomoflow.yourdomain.com`
- Include all monitors
- Enable incident management

### 3. GitHub Actions Lighthouse CI

```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI

on:
  deployment_status:
    states: [success]

jobs:
  lighthouse:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            https://pomoflow.yourdomain.com/
          uploadArtifacts: true
          temporaryPublicStorage: true

      - name: Check PWA Score
        run: |
          PWA_SCORE=$(cat .lighthouseci/lhr-*.json | jq '.categories.pwa.score * 100')
          echo "PWA Score: $PWA_SCORE"
          if (( $(echo "$PWA_SCORE < 90" | bc -l) )); then
            echo "::warning::PWA score below 90"
          fi
```

### 4. Custom Metrics Dashboard

**Metrics to Track:**

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Error Rate | Sentry | > 1% for 5 min |
| Uptime | UptimeRobot | < 99.9% monthly |
| Lighthouse PWA | GitHub Actions | < 90 |
| Lighthouse Performance | GitHub Actions | < 80 |
| Time to Interactive | Lighthouse | > 5s |
| SW Update Success | Custom analytics | < 95% |
| Install Conversions | Custom analytics | Tracking only |

---

## Go/No-Go Deployment Checklist

### Pre-Deploy (All Must Pass)

```markdown
## Pre-Deploy Checklist

### Build Verification
- [ ] `npm run build` completes without errors
- [ ] Service worker generated (`dist/sw.js` exists)
- [ ] Manifest generated (`dist/manifest.webmanifest` exists)
- [ ] All icons present in `dist/icons/`
- [ ] Bundle size within limits (< 5MB)

### Configuration
- [ ] `.env.production` reviewed - no secrets exposed
- [ ] API URLs use HTTPS
- [ ] Sentry DSN configured
- [ ] Version number updated

### Code Quality
- [ ] `npm run lint` passes
- [ ] `npm run test:safety` passes
- [ ] No console errors in local preview

### Staging Verification (if applicable)
- [ ] Staging deployment tested
- [ ] PWA installable on staging
- [ ] Offline mode works on staging
```

### Deploy Execution

```markdown
## Deploy Steps

- [ ] 1. Create VPS backup: `cp -r dist dist.backup.$(date +%Y%m%d_%H%M%S)`
- [ ] 2. Upload build artifacts to VPS
- [ ] 3. Verify nginx config: `sudo nginx -t`
- [ ] 4. Reload nginx: `sudo systemctl reload nginx`
- [ ] 5. Verify site loads: `curl -I https://pomoflow.yourdomain.com`
```

### Post-Deploy (Within 15 Minutes)

```markdown
## Post-Deploy Verification

### Immediate Checks (< 5 min)
- [ ] Site loads in browser
- [ ] No console errors
- [ ] Service worker registered (DevTools > Application)
- [ ] Manifest detected (DevTools > Application > Manifest)

### SSL/Security (< 10 min)
- [ ] HTTPS redirect works
- [ ] SSL certificate valid
- [ ] No mixed content warnings

### PWA Functionality (< 15 min)
- [ ] Install prompt appears (desktop Chrome)
- [ ] Install prompt appears (Android Chrome)
- [ ] iOS "Add to Home Screen" works
- [ ] App launches from home screen correctly

### Offline Test
- [ ] App loads when offline (airplane mode)
- [ ] Offline indicator shows
- [ ] Previously viewed data accessible

### Monitoring
- [ ] Sentry receiving events
- [ ] UptimeRobot showing UP
- [ ] No alerts triggered
```

### 24-Hour Monitoring

```markdown
## 24-Hour Post-Deploy Monitoring

### +1 Hour Check
- [ ] Error rate normal in Sentry
- [ ] No user complaints received
- [ ] Performance metrics stable

### +4 Hour Check
- [ ] SW update rate normal
- [ ] No memory leak indicators
- [ ] Mobile sessions working

### +24 Hour Check
- [ ] Lighthouse CI passed
- [ ] Uptime 100%
- [ ] Ready to archive backup
```

---

## Appendix: Nginx Configuration Reference

```nginx
# /etc/nginx/sites-available/pomoflow

server {
    listen 80;
    server_name pomoflow.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pomoflow.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/pomoflow.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pomoflow.yourdomain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    root /var/www/pomoflow/dist;
    index index.html;

    # Health check endpoint
    location /health {
        default_type application/json;
        return 200 '{"status":"ok","timestamp":"$time_iso8601"}';
    }

    # Service Worker - NEVER cache
    location /sw.js {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Manifest - Short cache
    location /manifest.webmanifest {
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }

    # Static assets - Long cache with immutable
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;

        # No cache for HTML
        add_header Cache-Control "no-cache";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

---

## Appendix: GitHub Actions Deploy Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'

env:
  VPS_HOST: ${{ secrets.VPS_HOST }}
  VPS_USER: deploy
  DEPLOY_PATH: /var/www/pomoflow/dist

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Safety tests
        run: npm run test:safety

      - name: Build
        run: npm run build
        env:
          VITE_SENTRY_DSN: ${{ secrets.SENTRY_DSN }}

      - name: Verify build
        run: |
          test -f dist/index.html
          test -f dist/sw.js
          test -f dist/manifest.webmanifest

      - name: Get version
        id: version
        run: echo "version=$(jq -r .version package.json)" >> $GITHUB_OUTPUT

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Deploy to VPS
        uses: easingthemes/ssh-deploy@main
        with:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          REMOTE_HOST: ${{ env.VPS_HOST }}
          REMOTE_USER: ${{ env.VPS_USER }}
          SOURCE: "dist/"
          TARGET: ${{ env.DEPLOY_PATH }}
          SCRIPT_BEFORE: |
            cp -r ${{ env.DEPLOY_PATH }} ${{ env.DEPLOY_PATH }}.backup.$(date +%Y%m%d_%H%M%S)
          SCRIPT_AFTER: |
            sudo systemctl reload nginx

  verify:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Health check
        run: |
          sleep 10
          HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://pomoflow.yourdomain.com)
          if [ "$HTTP_CODE" != "200" ]; then
            echo "Health check failed: HTTP $HTTP_CODE"
            exit 1
          fi
          echo "Health check passed"

      - name: Verify PWA resources
        run: |
          curl -sf https://pomoflow.yourdomain.com/sw.js > /dev/null
          curl -sf https://pomoflow.yourdomain.com/manifest.webmanifest > /dev/null
          echo "PWA resources verified"

  notify:
    needs: [build, deploy, verify]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Notify success
        if: needs.verify.result == 'success'
        run: |
          echo "Deployment successful: v${{ needs.build.outputs.version }}"
          # Add Slack/Discord notification here

      - name: Notify failure
        if: needs.verify.result == 'failure'
        run: |
          echo "Deployment failed! Rolling back..."
          # Add rollback trigger here
          # Add alert notification here
```

---

**Document Version**: 1.0
**Created**: January 7, 2026
**Author**: Deployment Verification Agent

