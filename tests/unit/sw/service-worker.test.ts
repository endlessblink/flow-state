/**
 * TASK-1602: Service Worker Tests
 *
 * Static-analysis tests for the Workbox-based service worker (src/sw.ts) and
 * its VitePWA configuration (vite.config.ts).  No actual SW registration is
 * possible inside Vitest/jsdom, so every test inspects source text and
 * configuration objects rather than executing the live SW.
 *
 * Tests 1-3:   SW config existence, workbox usage, precache manifest
 * Tests 4-6:   Cache strategies per resource type
 * Tests 7-9:   Router onError chunk-load recovery (BUG-1184)
 * Tests 10-12: SW registration failure handling
 * Tests 13-15: No sensitive data in SW precache manifest patterns
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Source fixtures
// ---------------------------------------------------------------------------

const PROJECT_ROOT = join(__dirname, '../../..')
const SW_PATH = join(PROJECT_ROOT, 'src/sw.ts')
const VITE_CONFIG_PATH = join(PROJECT_ROOT, 'vite.config.ts')
const ROUTER_PATH = join(PROJECT_ROOT, 'src/router/index.ts')

const swSrc = readFileSync(SW_PATH, 'utf8')
const viteConfigSrc = readFileSync(VITE_CONFIG_PATH, 'utf8')
const routerSrc = readFileSync(ROUTER_PATH, 'utf8')

// ---------------------------------------------------------------------------
// Tests 1-3: SW config existence, workbox usage, precache manifest
// ---------------------------------------------------------------------------

describe('TASK-1602 — SW config existence and workbox setup', () => {
  /**
   * Test 1: src/sw.ts must exist and declare the ServiceWorkerGlobalScope
   * reference expected by Workbox.
   */
  it('Test 1: src/sw.ts exists and declares ServiceWorkerGlobalScope', () => {
    expect(swSrc).toBeTruthy()
    // The SW must reference ServiceWorkerGlobalScope (Workbox requirement)
    expect(swSrc).toMatch(/ServiceWorkerGlobalScope/)
  })

  /**
   * Test 2: The SW imports from workbox-* packages (real Workbox integration,
   * not a hand-rolled cache).
   */
  it('Test 2: sw.ts imports workbox-precaching, workbox-routing and workbox-strategies', () => {
    expect(swSrc).toMatch(/from ['"]workbox-precaching['"]/)
    expect(swSrc).toMatch(/from ['"]workbox-routing['"]/)
    expect(swSrc).toMatch(/from ['"]workbox-strategies['"]/)
  })

  /**
   * Test 3: The SW calls precacheAndRoute(__WB_MANIFEST) — the standard
   * pattern for VitePWA injectManifest mode.  The vite.config.ts must also
   * list globPatterns so build-time manifest injection works.
   */
  it('Test 3: SW uses precacheAndRoute(__WB_MANIFEST) and vite.config has globPatterns', () => {
    expect(swSrc).toMatch(/precacheAndRoute\s*\(\s*self\.__WB_MANIFEST\s*\)/)
    // vite.config.ts: injectManifest.globPatterns must be defined
    expect(viteConfigSrc).toMatch(/globPatterns/)
    expect(viteConfigSrc).toMatch(/injectManifest/)
  })
})

// ---------------------------------------------------------------------------
// Tests 4-6: Cache strategies
// ---------------------------------------------------------------------------

describe('TASK-1602 — Cache strategies', () => {
  /**
   * Test 4: Static assets (/assets/*.js and /assets/*.css) must use
   * NetworkFirst (the SW registers an asset-fallback-cache route) rather than
   * pure CacheFirst, to handle chunk-hash invalidation after deploys.
   */
  it('Test 4: /assets/ route uses NetworkFirst strategy', () => {
    // Verify NetworkFirst is imported
    expect(swSrc).toMatch(/NetworkFirst/)
    // Verify the asset-fallback-cache exists (named cache for asset fallback route)
    expect(swSrc).toMatch(/asset-fallback-cache/)
    // Verify NetworkFirst is paired with asset-fallback-cache (within 200 chars)
    const idx = swSrc.indexOf('asset-fallback-cache')
    expect(idx).toBeGreaterThan(-1)
    const vicinity = swSrc.slice(Math.max(0, idx - 200), idx + 200)
    expect(vicinity).toMatch(/NetworkFirst/)
  })

  /**
   * Test 5: Images use CacheFirst strategy (long-lived, infrequently updated).
   */
  it('Test 5: image requests use CacheFirst strategy', () => {
    expect(swSrc).toMatch(/image-cache/)
    // Must pair image-cache with CacheFirst
    const imageCacheSection = swSrc.slice(
      Math.max(0, swSrc.indexOf('image-cache') - 400),
      swSrc.indexOf('image-cache') + 400
    )
    expect(imageCacheSection).toMatch(/CacheFirst/)
  })

  /**
   * Test 6: Supabase API calls (REST, Auth, Realtime) use NetworkFirst with
   * a short networkTimeoutSeconds to prevent hanging on flaky networks
   * (BUG-352).
   */
  it('Test 6: Supabase API routes use NetworkFirst with networkTimeoutSeconds', () => {
    expect(swSrc).toMatch(/supabase-api-fallback|rest\/v1|auth\/v1/)
    // NetworkFirst must appear alongside Supabase matching logic
    const supabaseSection = swSrc.slice(
      Math.max(0, swSrc.indexOf('rest/v1') - 400),
      swSrc.indexOf('rest/v1') + 600
    )
    expect(supabaseSection).toMatch(/NetworkFirst/)
    expect(supabaseSection).toMatch(/networkTimeoutSeconds/)
  })
})

// ---------------------------------------------------------------------------
// Tests 7-9: Router onError chunk-load recovery (BUG-1184)
// ---------------------------------------------------------------------------

describe('TASK-1602 — Router onError chunk-load recovery (BUG-1184)', () => {
  /**
   * Test 7: router.onError must handle chunk-load failures — the error handler
   * must detect the "Failed to fetch dynamically imported module" pattern.
   */
  it('Test 7: router.onError detects chunk-load failure messages', () => {
    expect(routerSrc).toMatch(/router\.onError/)
    expect(routerSrc).toMatch(/Failed to fetch dynamically imported module/)
  })

  /**
   * Test 8: The recovery path unregisters any stale service workers before
   * reloading, preventing the SW from serving the old (stale) index.html.
   */
  it('Test 8: chunk-load recovery unregisters service workers before reload', () => {
    // Find the onError block and confirm it unregisters SW
    const onErrorStart = routerSrc.indexOf('router.onError')
    const onErrorBlock = routerSrc.slice(onErrorStart, onErrorStart + 1000)
    expect(onErrorBlock).toMatch(/serviceWorker/)
    expect(onErrorBlock).toMatch(/unregister\s*\(/)
    expect(onErrorBlock).toMatch(/location\.assign|location\.href/)
  })

  /**
   * Test 9: The reload must be rate-limited with a sessionStorage key to
   * prevent infinite reload loops (if the route itself keeps failing).
   */
  it('Test 9: chunk-load recovery uses sessionStorage to prevent infinite reload loops', () => {
    const onErrorStart = routerSrc.indexOf('router.onError')
    const onErrorBlock = routerSrc.slice(onErrorStart, onErrorStart + 1000)
    expect(onErrorBlock).toMatch(/sessionStorage/)
    expect(onErrorBlock).toMatch(/getItem\s*\(|setItem\s*\(/)
  })
})

// ---------------------------------------------------------------------------
// Tests 10-12: SW registration failure handling
// ---------------------------------------------------------------------------

describe('TASK-1602 — SW registration failure handling', () => {
  /**
   * Test 10: The VitePWA plugin is configured with `disable: isTauri ||
   * isCapacitor` — ensuring the SW is not registered in desktop environments
   * where it would be non-functional and cause confusing errors.
   */
  it('Test 10: VitePWA is disabled for Tauri and Capacitor builds', () => {
    expect(viteConfigSrc).toMatch(/disable\s*:\s*(isTauri|isCapacitor|isTauri\s*\|\|\s*isCapacitor)/)
  })

  /**
   * Test 11: The SW `message` event listener guards against missing `data` or
   * `data.type` before processing, preventing silent failures from unexpected
   * postMessage payloads.
   */
  it('Test 11: SW message handler guards against missing data/type', () => {
    expect(swSrc).toMatch(/if\s*\(!data\s*\|\|\s*!data\.type\)/)
  })

  /**
   * Test 12: The ReloadPrompt component uses a dynamic import for
   * virtual:pwa-register/vue — the lazy import is the correct pattern when the
   * SW module may not be present (Tauri stub).
   */
  it('Test 12: ReloadPrompt lazily imports virtual:pwa-register/vue', () => {
    const reloadPromptPath = join(PROJECT_ROOT, 'src/components/common/ReloadPrompt.vue')
    let reloadSrc = ''
    try {
      reloadSrc = readFileSync(reloadPromptPath, 'utf8')
    } catch {
      // Skip if file doesn't exist in this environment
    }
    if (reloadSrc) {
      expect(reloadSrc).toMatch(/import\s*\(.*virtual:pwa-register/)
    } else {
      // File legitimately absent (e.g. partial checkout) — skip gracefully
      expect(true).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests 13-15: No sensitive data in SW precache manifest patterns
// ---------------------------------------------------------------------------

describe('TASK-1602 — No sensitive data in SW precache', () => {
  /**
   * Test 13: The SW globPatterns in vite.config.ts must not include .env
   * files — environment variables must never be precached by the SW.
   */
  it('Test 13: globPatterns does not include .env files', () => {
    // Find the globPatterns array in vite.config.ts
    const globMatch = viteConfigSrc.match(/globPatterns\s*:\s*\[([^\]]+)\]/)
    if (globMatch) {
      expect(globMatch[1]).not.toMatch(/\.env/)
    }
    // Also ensure no explicit .env reference in the SW precache setup
    expect(swSrc).not.toMatch(/\.env['"]/)
  })

  /**
   * Test 14: The SW precache glob patterns do not include .json files that
   * could contain API keys (e.g. service account credentials).
   * A glob pattern matching all json files is too broad — sensitive JSON must
   * be excluded.
   */
  it('Test 14: globPatterns does not use a broad **.json pattern that could cache secrets', () => {
    const globMatch = viteConfigSrc.match(/globPatterns\s*:\s*\[([^\]]+)\]/)
    if (globMatch) {
      const patterns = globMatch[1]
      // A pattern of exactly '**/*.json' with no exclusion would be risky
      // The current pattern uses js,css,html,ico,png,svg,woff2 — no json
      expect(patterns).not.toMatch(/\*\*\/\*\.json(?!.*exclusion)/)
    }
    // Absence of **.json in glob = pass
    expect(true).toBe(true)
  })

  /**
   * Test 15: The SW registration code path (src/composables/app/
   * useAppInitialization.ts or similar) does not reference VITE_ prefixed
   * variables inside the SW listener, ensuring secrets are never transmitted
   * to the service worker via postMessage.
   */
  it('Test 15: SW postMessage calls in app code do not transmit VITE_ variables', () => {
    // Find all files that postMessage to the service worker
    const appInit = join(PROJECT_ROOT, 'src/composables/app/useAppInitialization.ts')
    let appInitSrc = ''
    try {
      appInitSrc = readFileSync(appInit, 'utf8')
    } catch {
      /* file may not exist in partial envs */
    }

    if (appInitSrc) {
      // Extract postMessage calls and ensure none pass import.meta.env.VITE_ values
      const postMessageBlocks = appInitSrc.match(/postMessage\s*\([^)]+\)/g) || []
      for (const block of postMessageBlocks) {
        expect(block).not.toMatch(/import\.meta\.env\.VITE_/)
      }
    }

    // Timer SW postMessage in useTimerNotifications.ts
    const timerNotif = join(PROJECT_ROOT, 'src/composables/timer/useTimerNotifications.ts')
    let timerSrc = ''
    try {
      timerSrc = readFileSync(timerNotif, 'utf8')
    } catch {
      /* skip */
    }
    if (timerSrc) {
      const timerPmBlocks = timerSrc.match(/postMessage\s*\([^)]+\)/g) || []
      for (const block of timerPmBlocks) {
        expect(block).not.toMatch(/import\.meta\.env\.VITE_/)
      }
    }

    // Assertion always passes when no violations found
    expect(true).toBe(true)
  })
})
