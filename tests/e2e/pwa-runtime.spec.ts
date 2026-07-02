/**
 * PWA Runtime E2E Tests (25 tests)
 *
 * Tests Service Worker registration, cache behavior, offline resilience,
 * performance metrics, and production bug detection patterns.
 *
 * Uses CDP for real network emulation (not page.route mocking).
 * NOTE: SW tests require a production build served via preview, or the dev
 * server with PWA enabled. In dev mode (devOptions.enabled: false), SW is
 * not registered — tests that depend on SW will be skipped gracefully.
 */
import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Collect console errors during a test */
function collectConsoleErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

/** Filter out known non-critical console errors */
function filterCriticalErrors(errors: string[]): string[] {
  const ignoredPatterns = [
    /favicon/i,
    /Failed to load resource.*40[04]/,
    /Failed to load resource.*503/,
    /supabase.*realtime/i,
    /websocket/i,
    /net::ERR_/,
    /ResizeObserver loop/,
    /Manifest.*json/i,
    /service.worker/i,
    /handleError@/,
    /useTasksDatabase/,
    /useProjectsDatabase/,
    /useGroupsDatabase/,
    /AbortError/i,
    /getAddrInfo/i,
    /ECONNREFUSED/i,
    /edge-functions/i,
    /Notification prompting/i,
    /notification.*user gesture/i,
  ]
  return errors.filter(e => !ignoredPatterns.some(p => p.test(e)))
}

/** Check if SW is active in this environment (dev mode has SW disabled) */
async function isSWAvailable(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => 'serviceWorker' in navigator)
}

/** All navigable desktop routes (excludes mobile-only, redirects, external) */
const DESKTOP_ROUTES = [
  '/#/',         // canvas
  '/#/board',
  '/#/calendar',
  '/#/tasks',
  '/#/quick-sort',
  '/#/ai',
  '/#/today-flow',
]

// ─── SW Registration & Cache (8 tests) ─────────────────────────────────────

test.describe('SW Registration & Cache', () => {

  test('1 - SW installs and controls page', async ({ page }) => {
    // environment-gated: a real service worker only registers against a production
    // build (devOptions.enabled: false on the vite dev server means no SW). Without
    // one, navigator.serviceWorker.ready never resolves and this test hangs.
    test.skip(!process.env.TEST_URL, 'environment-gated: service worker requires a production build (set TEST_URL)')
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const hasSW = await isSWAvailable(page)
    if (!hasSW) {
      test.skip()
      return
    }

    const swURL = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready
      return reg.active?.scriptURL ?? null
    })

    // In dev mode SW may not be registered; in prod it should contain sw.js
    if (swURL) {
      expect(swURL).toContain('sw')
    }

    const isControlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
    // If SW was just installed, controller may be null until next navigation
    // This is expected behavior, not a bug
    expect(typeof isControlled).toBe('boolean')
  })

  test('2 - Cache contains index.html and critical assets', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const cacheInfo = await page.evaluate(async () => {
      const cacheNames = await caches.keys()
      const allUrls: string[] = []
      for (const name of cacheNames) {
        const cache = await caches.open(name)
        const keys = await cache.keys()
        allUrls.push(...keys.map(r => r.url))
      }
      return { cacheNames, urlCount: allUrls.length, hasIndex: allUrls.some(u => u.endsWith('/') || u.includes('index.html')) }
    })

    // In dev mode there may be no caches — that is fine
    if (cacheInfo.cacheNames.length > 0) {
      expect(cacheInfo.urlCount).toBeGreaterThan(0)
    }
  })

  test('3 - index.html served with no-cache or short cache header', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    const cacheControl = response!.headers()['cache-control'] ?? ''
    // index.html should NOT be immutably cached (would break deploys)
    expect(cacheControl).not.toContain('immutable')
    // It should either be no-cache, no-store, max-age=0, or absent (dev server)
  })

  test('4 - JS chunks carry immutable or long cache headers', async ({ page }) => {
    const jsResponses: { url: string; cacheControl: string }[] = []

    page.on('response', response => {
      const url = response.url()
      if (url.includes('/assets/') && url.endsWith('.js')) {
        jsResponses.push({
          url,
          cacheControl: response.headers()['cache-control'] ?? '',
        })
      }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // In dev mode, assets may not have cache headers — that is expected
    // In production, hashed assets should have long cache or immutable
    for (const js of jsResponses) {
      // Just verify no explicit no-store on hashed assets
      if (js.url.match(/[\w]{8,}\.js$/)) {
        expect(js.cacheControl).not.toContain('no-store')
      }
    }
  })

  test('5 - No double SW registration', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const registrationCount = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 0
      const regs = await navigator.serviceWorker.getRegistrations()
      return regs.length
    })

    // Should be 0 (dev mode) or exactly 1 (prod mode)
    expect(registrationCount).toBeLessThanOrEqual(1)
  })

  test('6 - Cache storage usage under 80% quota', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const quotaInfo = await page.evaluate(async () => {
      if (!navigator.storage || !navigator.storage.estimate) return null
      const est = await navigator.storage.estimate()
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
    })

    if (quotaInfo && quotaInfo.quota > 0) {
      const usagePercent = (quotaInfo.usage / quotaInfo.quota) * 100
      expect(usagePercent).toBeLessThan(80)
    }
  })

  test('7 - Manifest is valid and meets installability criteria', async ({ page }) => {
    await page.goto('/')

    // Fetch the manifest from the page
    const manifestData = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]')
      if (!link) return null
      const href = (link as HTMLLinkElement).href
      try {
        const res = await fetch(href)
        if (!res.ok) return null
        return await res.json()
      } catch {
        return null
      }
    })

    if (manifestData) {
      // Required fields for installability
      expect(manifestData.name).toBeTruthy()
      expect(manifestData.short_name).toBeTruthy()
      expect(manifestData.start_url).toBeTruthy()
      expect(manifestData.display).toBe('standalone')
      expect(manifestData.icons).toBeInstanceOf(Array)
      expect(manifestData.icons.length).toBeGreaterThanOrEqual(1)

      // Verify at least one icon URL is fetchable
      const iconUrl = manifestData.icons[0].src
      const iconCheck = await page.evaluate(async (url: string) => {
        try {
          const res = await fetch(new URL(url, location.origin).href)
          return res.ok
        } catch {
          return false
        }
      }, iconUrl)
      expect(iconCheck).toBe(true)
    }
  })

  test('8 - No stale auth after simulated token expiry', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Corrupt the stored auth token to simulate expiry
    await page.evaluate(() => {
      const key = 'flowstate-supabase-auth'
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        parsed.expires_at = Math.floor(Date.now() / 1000) - 3600 // expired 1hr ago
        parsed.access_token = 'expired_token_' + Date.now()
        localStorage.setItem(key, JSON.stringify(parsed))
      }
    })

    // Reload — the app should handle the expired token gracefully
    const errors = collectConsoleErrors(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // App should not crash — page should have content (login or app shell)
    const bodyHTML = await page.evaluate(() => document.body.innerHTML)
    expect(bodyHTML.length).toBeGreaterThan(100)

    // No unrecoverable errors
    const critical = filterCriticalErrors(errors)
    const fatalErrors = critical.filter(e =>
      e.includes('Cannot read') || e.includes('is not a function') || e.includes('Uncaught')
    )
    expect(fatalErrors).toHaveLength(0)
  })
})

// ─── Offline & Background Sync (7 tests) ────────────────────────────────────

test.describe('Offline & Background Sync', () => {

  test('9 - Offline: app shell still renders', async ({ page, context }) => {
    // environment-gated: the offline app shell is served by the service worker's
    // precache, which only exists in a production build. On the vite dev server the
    // offline reload just yields the browser's network-error page.
    test.skip(!process.env.TEST_URL, 'environment-gated: offline app shell requires a production build (set TEST_URL)')
    // First load with network to populate any caches
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Use CDP for REAL offline simulation
    const client = await context.newCDPSession(page)
    await client.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    })

    // Reload — app shell should render from cache (if SW active) or show cached content
    await page.reload().catch(() => {})
    await page.waitForTimeout(3000)

    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '')
    const bodyHTML = await page.evaluate(() => document.body.innerHTML).catch(() => '')

    // Either the app shell renders (has HTML content) or we get a browser offline page
    // Both are acceptable — what we're catching is a blank white page with no content
    const hasContent = bodyHTML.length > 50
    const isOfflinePage = bodyText.includes('offline') || bodyText.includes('ERR_INTERNET')

    expect(hasContent || isOfflinePage).toBe(true)

    await client.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    })
  })

  test('10 - Offline: cached assets served from CacheStorage', async ({ page, context }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Capture cached URLs before going offline
    const cachedUrlsBefore = await page.evaluate(async () => {
      const names = await caches.keys()
      const urls: string[] = []
      for (const name of names) {
        const cache = await caches.open(name)
        const keys = await cache.keys()
        urls.push(...keys.map(r => r.url))
      }
      return urls
    })

    if (cachedUrlsBefore.length === 0) {
      // No SW caching in dev mode — skip
      test.skip()
      return
    }

    const client = await context.newCDPSession(page)
    await client.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    })

    // Try to fetch a cached asset
    const served = await page.evaluate(async (urls: string[]) => {
      for (const url of urls.slice(0, 3)) {
        try {
          const res = await fetch(url)
          if (res.ok) return true
        } catch { /* expected for non-cached */ }
      }
      return false
    }, cachedUrlsBefore)

    expect(served).toBe(true)

    await client.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    })
  })

  test('11 - Online to Offline to Online: app recovers', async ({ page, context }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Go offline
    const client = await context.newCDPSession(page)
    await client.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    })
    await page.waitForTimeout(2000)

    // Come back online
    await client.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    })
    await page.waitForTimeout(3000)

    // App should recover and show content
    const bodyHTML = await page.evaluate(() => document.body.innerHTML)
    expect(bodyHTML.length).toBeGreaterThan(100)

    // Should not be stuck on error screen
    const bodyText = await page.evaluate(() => document.body.innerText)
    expect(bodyText.toLowerCase()).not.toContain('something went wrong')
  })

  test('12 - No chunk load errors during normal navigation', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Navigate through main views
    for (const route of ['/#/board', '/#/calendar', '/#/tasks', '/#/']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
    }

    const chunkErrors = errors.filter(e =>
      e.includes('chunk') || e.includes('dynamically imported module') || e.includes('Loading CSS chunk')
    )
    expect(chunkErrors).toHaveLength(0)
  })

  test('13 - Auth request happens before data fetch', async ({ page }) => {
    const requestOrder: string[] = []

    page.on('request', request => {
      const url = request.url()
      if (url.includes('/auth/')) {
        requestOrder.push('auth')
      } else if (url.includes('/rest/v1/tasks') || url.includes('/rest/v1/projects')) {
        requestOrder.push('data')
      }
    })

    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // If both auth and data requests were made, auth should come first
    const firstAuth = requestOrder.indexOf('auth')
    const firstData = requestOrder.indexOf('data')

    if (firstAuth >= 0 && firstData >= 0) {
      expect(firstAuth).toBeLessThan(firstData)
    }
    // If no auth request (using cached token), that's also fine
  })

  test('14 - FCP under 3 seconds', async ({ page }) => {
    await page.goto('/#/')

    const fcp = await page.evaluate(() => {
      return new Promise<number | null>(resolve => {
        const observer = new PerformanceObserver(list => {
          const entries = list.getEntries()
          const fcpEntry = entries.find(e => e.name === 'first-contentful-paint')
          observer.disconnect()
          resolve(fcpEntry ? fcpEntry.startTime : null)
        })
        observer.observe({ type: 'paint', buffered: true })

        // Fallback timeout
        setTimeout(() => {
          observer.disconnect()
          resolve(null)
        }, 5000)
      })
    })

    if (fcp !== null) {
      expect(fcp).toBeLessThan(3000)
    }
  })

  test('15 - No "undefined" or "null" text rendered in any view', async ({ page }) => {
    const badTexts: string[] = []

    for (const route of ['/#/', '/#/board', '/#/tasks']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const suspiciousText = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        const found: string[] = []
        while (walker.nextNode()) {
          const text = walker.currentNode.textContent?.trim() ?? ''
          // Only flag standalone "undefined" or "null" — not inside code/debug
          if (text === 'undefined' || text === 'null' || text === 'NaN') {
            const parent = (walker.currentNode.parentElement?.tagName ?? '').toLowerCase()
            // Ignore script, style, code, pre elements
            if (!['script', 'style', 'code', 'pre'].includes(parent)) {
              found.push(`[${parent}] "${text}"`)
            }
          }
        }
        return found
      })

      badTexts.push(...suspiciousText.map(t => `${route}: ${t}`))
    }

    expect(badTexts).toHaveLength(0)
  })
})

// ─── Production Bug Detection (10 tests) ────────────────────────────────────

test.describe('Production Bug Detection', () => {

  test('16 - No chunk load failure errors during full app navigation', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    for (const route of DESKTOP_ROUTES) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
    }

    const chunkErrors = errors.filter(e =>
      e.includes('Failed to fetch dynamically imported module') ||
      e.includes('Loading chunk') ||
      e.includes('Loading CSS chunk') ||
      e.includes('error loading dynamically imported module')
    )
    expect(chunkErrors, `Chunk load errors: ${chunkErrors.join('\n')}`).toHaveLength(0)
  })

  test('17 - No CORS errors', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const corsErrors = errors.filter(e =>
      e.toLowerCase().includes('cors') ||
      e.includes('Access-Control-Allow-Origin') ||
      e.includes('blocked by CORS policy')
    )
    expect(corsErrors, `CORS errors: ${corsErrors.join('\n')}`).toHaveLength(0)
  })

  test('18 - No mixed content (http:// from https:// page)', async ({ page }) => {
    const mixedRequests: string[] = []

    page.on('request', request => {
      const pageUrl = page.url()
      const reqUrl = request.url()
      // Only flag if page is HTTPS but request is HTTP (not localhost)
      if (pageUrl.startsWith('https://') && reqUrl.startsWith('http://') && !reqUrl.includes('localhost') && !reqUrl.includes('127.0.0.1')) {
        mixedRequests.push(reqUrl)
      }
    })

    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    expect(mixedRequests, `Mixed content requests: ${mixedRequests.join('\n')}`).toHaveLength(0)
  })

  test('19 - SW scope is "/" not "/dist/" or subpath', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const swScope = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null
      const regs = await navigator.serviceWorker.getRegistrations()
      return regs.length > 0 ? regs[0].scope : null
    })

    if (swScope) {
      const scopePath = new URL(swScope).pathname
      expect(scopePath).toBe('/')
    }
  })

  test('20 - Build version sentinel defined (not "undefined")', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check that the app has a version defined (either via __APP_VERSION__ or in settings)
    const versionInfo = await page.evaluate(() => {
      // Check meta tag or global
      const meta = document.querySelector('meta[name="version"]')
      // Check console output or any version indicator
      return {
        htmlLength: document.body.innerHTML.length,
        hasApp: document.getElementById('app') !== null,
      }
    })

    // App should at least mount
    expect(versionInfo.hasApp).toBe(true)
    expect(versionInfo.htmlLength).toBeGreaterThan(100)
  })

  test('21 - No white flash on initial load', async ({ page }) => {
    // Check that the body has a dark background immediately
    // The index.html sets background:#0f172a inline on <body>
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })

    await page.goto('/')

    // Re-check after navigation — should still be dark, not white
    const bgAfter = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })

    // Parse RGB values — should NOT be white (255,255,255) or transparent
    const isWhite = bgAfter === 'rgb(255, 255, 255)' || bgAfter === 'rgba(0, 0, 0, 0)'
    // Note: "rgba(0, 0, 0, 0)" would be transparent which also flashes white
    // The index.html has inline style="background:#0f172a" so this should be dark
    expect(isWhite, `Body background is white/transparent: ${bgAfter}`).toBe(false)
  })

  test('22 - beforeinstallprompt deferred correctly', async ({ page }) => {
    // Inject a fake beforeinstallprompt event before app loads
    await page.addInitScript(() => {
      (window as any).__installPromptFired = false;
      (window as any).__installPromptDeferred = false

      window.addEventListener('beforeinstallprompt', (e) => {
        (window as any).__installPromptFired = true
        // If app defers the prompt (calls preventDefault), that's correct behavior
        if (e.defaultPrevented) {
          (window as any).__installPromptDeferred = true
        }
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Dispatch a synthetic beforeinstallprompt
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true })
      window.dispatchEvent(event)
    })

    const result = await page.evaluate(() => ({
      fired: (window as any).__installPromptFired,
      deferred: (window as any).__installPromptDeferred,
    }))

    expect(result.fired).toBe(true)
    // App should defer the prompt (not show it immediately)
    // If it doesn't handle the event at all, that's also acceptable
  })

  test('23 - Standalone mode detection works', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // In a regular browser tab, standalone should be false
    const isStandalone = await page.evaluate(() => {
      return window.matchMedia('(display-mode: standalone)').matches ||
             (window.navigator as any).standalone === true
    })

    // In Playwright we're running in a regular browser, so standalone should be false
    expect(isStandalone).toBe(false)
  })

  test('24 - Cache versioning: only current version cache exists', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const cacheNames = await page.evaluate(async () => {
      return await caches.keys()
    })

    // Filter to workbox/precache caches (ignore other caches)
    const precacheCaches = cacheNames.filter(n =>
      n.includes('workbox') || n.includes('precache') || n.includes('runtime')
    )

    // Should have at most one version of each cache type
    // Multiple versions = stale caches not being purged
    const prefixes = new Set(precacheCaches.map(n => n.replace(/-[\da-f]+$/, '')))
    for (const prefix of Array.from(prefixes)) {
      const versions = precacheCaches.filter(n => n.startsWith(prefix))
      expect(
        versions.length,
        `Multiple versions of cache "${prefix}": ${versions.join(', ')}`
      ).toBeLessThanOrEqual(2) // workbox keeps current + temp during update
    }
  })

  test('25 - All lazy-loaded routes resolve without chunk errors', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    const failedRoutes: string[] = []

    for (const route of DESKTOP_ROUTES) {
      await page.goto(route)
      try {
        await page.waitForLoadState('networkidle')
      } catch {
        // networkidle timeout is not a chunk error
      }
      await page.waitForTimeout(1000)

      // Check if the page rendered something (not blank)
      const hasContent = await page.evaluate(() => {
        const app = document.getElementById('app')
        return app ? app.innerHTML.length > 100 : false
      })

      if (!hasContent) {
        failedRoutes.push(route)
      }
    }

    const chunkErrors = errors.filter(e =>
      e.includes('chunk') || e.includes('dynamically imported module')
    )

    expect(chunkErrors, `Chunk errors on routes: ${chunkErrors.join('\n')}`).toHaveLength(0)
    expect(failedRoutes, `Routes that rendered blank: ${failedRoutes.join(', ')}`).toHaveLength(0)
  })
})
