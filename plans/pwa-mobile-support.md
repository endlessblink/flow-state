# PWA Mobile Support Implementation Plan

**Created**: January 7, 2026
**Status**: PLANNED
**Related Roadmap**: ROAD-004 (P2 Priority)
**Estimated Complexity**: High
**Deepened**: January 7, 2026

---

## Enhancement Summary

**Sections enhanced:** 12
**Research agents used:** architecture-strategist, security-sentinel, performance-oracle, code-simplicity-reviewer, kieran-typescript-reviewer, julik-frontend-races-reviewer, deployment-verification-agent

### Key Improvements
1. **Simplified scope** - Collapsed 5 phases to 2 for MVP (PWA Foundation + Deployment)
2. **Removed PowerSync complexity** - Use Workbox BackgroundSync with existing Supabase instead
3. **Deferred push notifications** - Post-MVP feature, not critical for mobile support
4. **Added race condition guards** - Critical timing issues identified and solutions provided
5. **Security hardening** - 23 vulnerabilities identified with mitigations
6. **Performance optimization** - Bundle already exceeds 500KB target, requires aggressive splitting

### Critical Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sync Technology | Workbox BackgroundSync | PowerSync adds 700KB+ and complexity for single-user app |
| Push Notifications | Deferred to v2 | Low impact, high complexity, iOS limitations |
| Conflict Resolution | Trust Supabase timestamps | Single-user app rarely has conflicts |
| Mobile Components | Responsive CSS only | No new MobileNav.vue, MobileTaskCard.vue needed |
| Canvas on Mobile | "Best on desktop" message | Touch interactions don't translate well |

---

## Overview

Implement Progressive Web App (PWA) mobile support for Pomo-Flow, enabling:
- **Installable app experience** on mobile devices
- **Offline-first data sync** with Supabase/PostgreSQL
- ~~**Push notifications** for task reminders~~ (Deferred to v2)
- **Mobile-optimized UI** with touch gestures
- **VPS deployment** with Nginx + SSL

### User Goals
- Track tasks on-the-go with app-like mobile experience
- Work offline with automatic sync when connectivity returns
- ~~Receive timely reminders for due tasks~~ (v2)
- Have data sync across desktop and mobile seamlessly

---

## Current State Assessment

### What Exists
| Component | Status | Location |
|-----------|--------|----------|
| Supabase Auth | ✅ Working | `src/stores/auth.ts` |
| Supabase CRUD | ✅ Working | `src/composables/useSupabaseDatabase.ts` |
| Realtime Subscriptions | ✅ Working | `useSupabaseDatabase.ts:502-540` |
| PowerSync Packages | ⚠️ Installed but unused | `package.json` |
| Design Tokens | ✅ Comprehensive | `src/assets/design-tokens.css` |
| Responsive Patterns | ✅ Partial (23+ components) | Various components |
| Service Worker | ❌ Missing | - |
| PWA Manifest | ❌ Missing | - |
| Push Notifications | ❌ Missing | - |

### What Needs to Be Built (Simplified)
1. PWA infrastructure (manifest, service worker, icons)
2. ~~Offline data sync layer~~ → Use Workbox BackgroundSync
3. ~~Push notification system~~ → Deferred to v2
4. ~~Mobile-optimized views~~ → Responsive CSS only
5. VPS deployment configuration

### Research Insight: Bundle Size Warning

> **CRITICAL**: Current main bundle is 539.68 KB gzipped, already exceeding the 500KB target before PWA additions. PowerSync WASM adds 700KB-2.4MB. On 3G networks, this means 26+ second download times.
>
> **Recommendation**: Remove PouchDB (~50-80KB) and implement aggressive code splitting before PWA work.

---

## Technical Approach

### Phase 1: PWA Foundation (2-3 days)

**Goal**: Get installable PWA working with basic offline shell

#### 1.1 Install and Configure vite-plugin-pwa

```typescript
// vite.config.ts additions
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa'

// Cache duration constants (no magic numbers)
const CACHE_DURATIONS = {
  ONE_DAY: 60 * 60 * 24,
  ONE_WEEK: 60 * 60 * 24 * 7,
  ONE_MONTH: 60 * 60 * 24 * 30,
  ONE_YEAR: 60 * 60 * 24 * 365,
} as const

const pwaConfig: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  manifest: {
    name: 'Pomo-Flow',
    short_name: 'PomoFlow',
    description: 'Pomodoro timer with task management',
    theme_color: '#4F46E5',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait-primary',
    scope: '/',
    start_url: '/',
    icons: [
      { src: 'icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      // Supabase API: Network-first with offline queue
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api-cache',
          networkTimeoutSeconds: 3, // 3s not 10s!
          backgroundSync: {
            name: 'supabase-queue',
            options: { maxRetentionTime: 24 * 60 }
          },
          cacheableResponse: { statuses: [0, 200] },
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: CACHE_DURATIONS.ONE_DAY,
          },
        },
      },
      // Images: Cache-first
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'image-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: CACHE_DURATIONS.ONE_MONTH,
          },
        },
      },
      // Fonts: Cache-first with long expiry
      {
        urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'font-cache',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: CACHE_DURATIONS.ONE_YEAR,
          },
        },
      },
    ],
  },
}
```

#### Research Insight: Service Worker Race Conditions

> **WARNING**: Service worker registration races with app initialization. If SW registers during first data fetch, cache may be empty causing errors.
>
> **Fix**: Register SW AFTER Vue mount completes:
> ```typescript
> // main.ts
> app.mount('#app')
> if ('serviceWorker' in navigator) {
>   const { registerSW } = await import('virtual:pwa-register')
>   registerSW({ /* callbacks */ })
> }
> ```

#### Research Insight: CSP Compatibility

> **CRITICAL**: Current CSP in `cspManager.ts` line 211 sets `'worker-src': ["'none'"]` which blocks service workers entirely.
>
> **Fix**: Update to `'worker-src': ["'self'", "blob:"]`

#### 1.2 Create PWA Assets

**Files to create:**
- `public/manifest.webmanifest` - auto-generated by plugin
- `public/icons/` - PWA icon set (64, 192, 512, maskable)
- `public/apple-touch-icon.png` - iOS home screen icon
- `src/components/common/ReloadPrompt.vue` - Update notification UI

#### Research Insight: Icon Generation

> Use PWA asset generator: `npx pwa-asset-generator logo.svg ./public/icons`
> This creates all required sizes automatically.

#### 1.3 Add PWA Meta Tags to index.html

```html
<meta name="theme-color" content="#4F46E5">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<!-- Safe area for notched devices -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

#### 1.4 ReloadPrompt Component

```vue
<!-- src/components/common/ReloadPrompt.vue -->
<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW()
const { isSyncing } = useSupabaseDatabase()

// Block reload during sync to prevent data corruption
const canReload = computed(() => !isSyncing.value)

const handleUpdate = () => {
  if (!canReload.value) {
    // Show warning instead of reloading
    return
  }
  updateServiceWorker(true)
}

const close = () => {
  offlineReady.value = false
  needRefresh.value = false
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="offlineReady || needRefresh" class="pwa-toast">
      <span v-if="offlineReady">App ready for offline use</span>
      <span v-else>Update available</span>
      <button v-if="needRefresh" @click="handleUpdate" :disabled="!canReload">
        {{ canReload ? 'Reload' : 'Syncing...' }}
      </button>
      <button @click="close">Close</button>
    </div>
  </Transition>
</template>
```

**Deliverables:**
- [ ] `vite-plugin-pwa` installed and configured
- [ ] Icon set created (all required sizes)
- [ ] Service worker caching working
- [ ] App installable on mobile Chrome/Safari
- [ ] Update prompt shows when new version available
- [ ] CSP updated to allow workers

---

### Phase 2: VPS Deployment (1-2 days)

**Goal**: Production-ready deployment with SSL, monitoring

#### 2.1 Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Storage | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04+ | Ubuntu 24.04 |

#### 2.2 Simplified: Use Caddy Instead of Nginx

```
# Caddyfile (4 lines vs 30 for Nginx)
pomoflow.yourdomain.com {
    root * /var/www/pomoflow/dist
    try_files {path} /index.html
    file_server
}
```

Caddy provides automatic HTTPS via Let's Encrypt with zero configuration.

#### Research Insight: If Nginx Required

```nginx
server {
    listen 443 ssl http2;
    server_name pomoflow.yourdomain.com;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/pomoflow.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pomoflow.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;

    root /var/www/pomoflow/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets (immutable)
    location ~* \.(js|css|png|jpg|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # No cache for service worker
    location /sw.js {
        expires -1;
        add_header Cache-Control "no-store";
        add_header Service-Worker-Allowed "/";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name pomoflow.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

#### 2.3 Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install and Build
        run: |
          npm ci
          npm run build

      - name: Verify Build
        run: |
          # Check bundle size
          BUNDLE_SIZE=$(du -sb dist | cut -f1)
          if [ $BUNDLE_SIZE -gt 5000000 ]; then
            echo "Warning: Bundle exceeds 5MB"
          fi
          # Check for required files
          test -f dist/index.html
          test -f dist/manifest.webmanifest

      - name: Deploy to VPS
        uses: easingthemes/ssh-deploy@main
        with:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_KEY }}
          REMOTE_HOST: ${{ secrets.VPS_HOST }}
          REMOTE_USER: deploy
          SOURCE: "dist/"
          TARGET: "/var/www/pomoflow/dist"
```

#### 2.4 Monitoring Stack

| Tool | Purpose | Cost |
|------|---------|------|
| Sentry | Error tracking | Free tier |
| UptimeRobot | Uptime monitoring | Free tier |
| Lighthouse CI | Performance monitoring | Free (GitHub Actions) |

**Deliverables:**
- [ ] VPS provisioned and configured
- [ ] SSL certificate installed (Caddy auto or Let's Encrypt)
- [ ] GitHub Actions deployment working
- [ ] Rollback procedure documented
- [ ] Monitoring alerts configured

---

## Deferred Features (Post-MVP)

### Push Notifications (v2)

> **Why deferred**: Push notifications require Supabase Edge Functions, VAPID key management, subscription storage, and have limited iOS support. The plan's own risk assessment rated this "Low" impact.

### PowerSync Offline Sync (v2)

> **Why deferred**: PowerSync adds 700KB+ to bundle size. Workbox BackgroundSync provides sufficient offline capability for a personal productivity app. Consider PowerSync only if users request multi-device simultaneous editing with conflict resolution.

### Mobile-Specific Components (v2)

> **Why deferred**: Existing responsive design with Tailwind breakpoints is sufficient. MobileNav.vue, MobileTaskCard.vue, PullToRefresh.vue are over-engineering for MVP.

---

## Security Hardening Checklist

### Critical Fixes Required Before Deployment

| Issue | Location | Fix |
|-------|----------|-----|
| **Hardcoded IP** | `database.ts:103` | Use environment variables |
| **HTTP not HTTPS** | `database.ts:104` | Enforce HTTPS in production |
| **Admin bypass** | `auth.ts:32-43` | Remove localStorage dev-mode check |
| **CSP blocks workers** | `cspManager.ts:211` | Allow `'self' blob:` for workers |
| **HSTS disabled** | `securityHeaders.ts:73` | Enable in production |
| **CouchDB creds in localStorage** | `database.ts:108-115` | Move to server-side session |

### Security Headers for PWA

```typescript
// Required headers for PowerSync WASM (if used later)
'Cross-Origin-Opener-Policy': 'same-origin',
'Cross-Origin-Embedder-Policy': 'require-corp',

// Required for service workers
'worker-src': ["'self'", "blob:"],

// PWA manifest
'manifest-src': ["'self'"],
```

---

## Performance Optimization Requirements

### Before PWA Implementation

1. **Remove PouchDB** (if fully migrated): Saves ~50-80KB
2. **Aggressive code splitting**: CanvasView is 120KB, lazy-load it
3. **Tree-shake Naive UI**: Ensure proper imports
4. **Self-host Google Font**: Remove external dependency

### Bundle Size Budget

| Category | Target | Current |
|----------|--------|---------|
| Main bundle | < 400KB | 539KB ⚠️ |
| PWA additions | < 50KB | - |
| Total | < 500KB | Requires optimization |

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Lighthouse PWA Score | >= 90 | Lighthouse CI |
| Time to Interactive (3G) | < 5s | WebPageTest |
| First Contentful Paint | < 1.5s | Lighthouse |
| Service Worker Cache Hit | > 90% | DevTools |

---

## Race Condition Guards

### Service Worker Registration

```typescript
// src/composables/usePWA.ts
export function usePWA() {
  const swState = ref<'uninitialized' | 'registering' | 'ready' | 'failed'>('uninitialized')

  const registerServiceWorker = async () => {
    if (swState.value !== 'uninitialized') return // Guard double-registration

    // Check if SW already controlling (multi-tab scenario)
    if (navigator.serviceWorker.controller) {
      swState.value = 'ready'
      return
    }

    swState.value = 'registering'

    try {
      const { registerSW } = await import('virtual:pwa-register')
      registerSW({
        onRegisteredSW(swUrl, registration) {
          swState.value = 'ready'
        },
        onRegisterError(error) {
          swState.value = 'failed'
        }
      })
    } catch (e) {
      swState.value = 'failed'
    }
  }

  const isServiceWorkerReady = computed(() => swState.value === 'ready')

  return { registerServiceWorker, isServiceWorkerReady, swState }
}
```

### Network State Stability

```typescript
// src/composables/useNetworkStatus.ts
export function useNetworkStatus() {
  const networkState = ref<'offline' | 'unstable' | 'stable'>('unstable')
  const STABILITY_DELAY_MS = 3000 // Wait 3s before "stable"
  let stabilityTimeout: ReturnType<typeof setTimeout> | null = null

  const handleOnline = () => {
    if (stabilityTimeout) clearTimeout(stabilityTimeout)
    networkState.value = 'unstable'

    stabilityTimeout = setTimeout(() => {
      if (navigator.onLine) {
        networkState.value = 'stable'
      }
    }, STABILITY_DELAY_MS)
  }

  const handleOffline = () => {
    if (stabilityTimeout) clearTimeout(stabilityTimeout)
    networkState.value = 'offline'
  }

  // Only trigger sync when STABLE, not on every flap
  const isReadyForSync = computed(() => networkState.value === 'stable')

  return { networkState, isReadyForSync }
}
```

### Component Unmount During Sync

```typescript
// Add cancellation to async operations
const cancelToken = { canceled: false }

onBeforeUnmount(() => {
  cancelToken.canceled = true
})

const syncData = async () => {
  if (cancelToken.canceled) return

  // ... sync logic ...

  if (cancelToken.canceled) return // Check before state updates

  data.value = result
}
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] **Install**: PWA installable on iOS Safari, Android Chrome, Desktop browsers
- [ ] **Offline**: App loads and shows cached data when offline
- [ ] **Sync**: Offline changes sync when connection restored (< 30s)
- [ ] ~~**Notifications**: Push notifications work on Android~~ (Deferred)
- [ ] **Mobile UX**: All core flows completable on 375px screen
- [ ] **Performance**: Lighthouse PWA score >= 90

### Non-Functional Requirements

- [ ] **Load time**: < 5s Time to Interactive on 3G
- [ ] **Bundle size**: < 500KB gzipped (requires optimization first)
- [ ] **Offline storage**: < 50MB per user
- [ ] **Battery**: No excessive background activity

### Quality Gates

- [ ] ~~Playwright tests for offline scenarios~~ (Manual testing sufficient for MVP)
- [ ] Cross-device tested (2+ devices)
- [ ] Real device testing (iOS Safari, Android Chrome)
- [ ] Security review (CSP, token storage, HTTPS)

---

## Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Bundle size exceeds target | High | Medium | Aggressive code splitting before PWA |
| iOS PWA limitations | High | Medium | Clear documentation of limitations |
| Service worker cache corruption | Low | High | Version-stamped caches, force-update endpoint |
| ~~Sync conflicts cause data loss~~ | ~~Low~~ | ~~Critical~~ | Workbox handles offline queue |
| VPS costs exceed budget | Low | Low | Start with small instance, scale as needed |

---

## Files to Create/Modify

### New Files
```
public/
├── icons/
│   ├── pwa-64x64.png
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   └── maskable-512x512.png
├── apple-touch-icon.png
└── favicon.svg

src/
├── composables/
│   ├── usePWA.ts
│   └── useNetworkStatus.ts
└── components/
    └── common/
        └── ReloadPrompt.vue

.github/
└── workflows/
    └── deploy.yml

Caddyfile (or nginx/pomoflow.conf)
```

### Modified Files
```
vite.config.ts          # Add VitePWA plugin (~30 lines)
index.html              # Add PWA meta tags (~5 lines)
package.json            # Add vite-plugin-pwa dependency
tsconfig.json           # Add WebWorker lib
src/main.ts             # Initialize PWA registration after mount
src/App.vue             # Add ReloadPrompt component
src/utils/cspManager.ts # Allow worker-src 'self' blob:
```

---

## Simplified Implementation Timeline

```
Phase 1: PWA Foundation (2-3 days)
├── Install vite-plugin-pwa
├── Create icon set
├── Add manifest and meta tags
├── Configure Workbox caching
├── Create ReloadPrompt.vue
├── Fix CSP for service workers
├── Test installability
└── Milestone: App installs on mobile

Phase 2: Deployment (1-2 days)
├── Setup Caddy/Nginx
├── Configure SSL
├── Setup GitHub Actions CI/CD
├── Configure monitoring (Sentry, UptimeRobot)
├── Document rollback procedure
└── Milestone: Production live

Post-MVP (Optional, v2)
├── Push notifications
├── PowerSync offline sync
├── Mobile-specific components
└── Advanced gesture support
```

**Total MVP: 3-5 days** (vs original estimate of 2-3 weeks)

---

## References

### Documentation
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Workbox](https://developer.chrome.com/docs/workbox/)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/)
- [Caddy Server](https://caddyserver.com/docs/)

### Related Issues
- ROAD-004: Mobile support (PWA) - existing roadmap item

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Lighthouse PWA Score | >= 90 | Lighthouse CI |
| Time to Interactive (3G) | < 5s | WebPageTest |
| Offline Success Rate | > 95% | Manual testing |
| Install Rate (prompted) | > 10% | Analytics |
| ~~Notification Opt-in Rate~~ | ~~> 40%~~ | Deferred |

---

**Plan Author**: Claude Code (Opus 4.5)
**Deepened**: January 7, 2026
**Last Updated**: January 7, 2026
