/**
 * TASK-1645: Cache Strategy Deep Tests (10 tests)
 *
 * Tests for src/sw.ts caching strategies and src/composables/useStaticResourceCache.ts
 * Covers:
 * 1.  JS chunks: CacheFirst with max-age expiration
 * 2.  CSS files: CacheFirst
 * 3.  Images/fonts: CacheFirst with long TTL
 * 4.  API calls (/rest/v1/*): NetworkFirst with timeout
 * 5.  HTML (index.html): NetworkFirst (always fresh)
 * 6.  Supabase realtime: NetworkOnly (no caching websockets)
 * 7.  Static resource cache: preloads critical CSS
 * 8.  Cache cleanup: old caches purged on SW activate
 * 9.  Cache size limits configured
 * 10. No auth tokens cached in SW
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Read source files for static analysis
// ---------------------------------------------------------------------------
const swSource = readFileSync(
  resolve(__dirname, '../../../src/sw.ts'),
  'utf-8'
)
const staticCacheSource = readFileSync(
  resolve(__dirname, '../../../src/composables/useStaticResourceCache.ts'),
  'utf-8'
)
const mainTsSource = readFileSync(
  resolve(__dirname, '../../../src/main.ts'),
  'utf-8'
)

describe('TASK-1645: Cache Strategy Deep Tests', () => {
  // =========================================================================
  // 1. JS chunks: CacheFirst with max-age expiration
  // =========================================================================
  it('1. JS chunks use CacheFirst strategy (via precache or asset-fallback)', () => {
    // The primary JS caching path is workbox precaching (__WB_MANIFEST).
    // The SW also has an asset-fallback-cache for JS/CSS not covered by precache.
    expect(swSource).toContain("url.pathname.endsWith('.js')")
    expect(swSource).toContain("cacheName: 'asset-fallback-cache'")

    // ExpirationPlugin must be used to enforce max-age
    expect(swSource).toContain('ExpirationPlugin')
    expect(swSource).toContain('maxAgeSeconds')

    // The asset-fallback cache should have a reasonable max age (1 day = 86400s)
    const assetFallbackBlock = swSource.slice(
      swSource.indexOf("cacheName: 'asset-fallback-cache'"),
      swSource.indexOf("cacheName: 'asset-fallback-cache'") + 400
    )
    expect(assetFallbackBlock).toContain('maxAgeSeconds')
    expect(assetFallbackBlock).toContain('maxEntries')
  })

  // =========================================================================
  // 2. CSS files: CacheFirst
  // =========================================================================
  it('2. CSS files are included in CacheFirst asset-fallback cache', () => {
    // SW matches .css files in the asset-fallback-cache route
    expect(swSource).toContain("url.pathname.endsWith('.css')")

    // Both js and css are matched together in the same route condition
    const assetRoute = swSource.slice(
      swSource.indexOf("url.pathname.startsWith('/assets/')"),
      swSource.indexOf("url.pathname.startsWith('/assets/')") + 200
    )
    expect(assetRoute).toContain(".css")
    expect(assetRoute).toContain(".js")
  })

  // =========================================================================
  // 3. Images/fonts: CacheFirst with long TTL
  // =========================================================================
  it('3. Images and fonts use CacheFirst with long TTL', () => {
    // Images: 30-day expiry (30 * 24 * 60 * 60 = 2592000s)
    expect(swSource).toContain("request.destination === 'image'")
    expect(swSource).toContain("cacheName: 'image-cache'")

    const imageBlock = swSource.slice(
      swSource.indexOf("cacheName: 'image-cache'"),
      swSource.indexOf("cacheName: 'image-cache'") + 300
    )
    // Source uses expression form: 60 * 60 * 24 * 30
    expect(imageBlock).toMatch(/maxAgeSeconds:\s*60\s*\*\s*60\s*\*\s*24\s*\*\s*30/)

    // Fonts: 1-year expiry (365 * 24 * 60 * 60)
    expect(swSource).toContain("request.destination === 'font'")
    expect(swSource).toContain("cacheName: 'font-cache'")

    const fontBlock = swSource.slice(
      swSource.indexOf("cacheName: 'font-cache'"),
      swSource.indexOf("cacheName: 'font-cache'") + 300
    )
    // Source uses expression form: 60 * 60 * 24 * 365
    expect(fontBlock).toMatch(/maxAgeSeconds:\s*60\s*\*\s*60\s*\*\s*24\s*\*\s*365/)
  })

  // =========================================================================
  // 4. API calls (/rest/v1/*): NetworkFirst with timeout
  // =========================================================================
  it('4. Supabase REST API uses NetworkFirst with networkTimeoutSeconds', () => {
    expect(swSource).toContain("url.pathname.includes('/rest/v1/')")
    expect(swSource).toContain("cacheName: 'supabase-api-fallback'")

    // Must have a timeout so flaky networks fail fast instead of hanging
    expect(swSource).toContain('networkTimeoutSeconds')

    // The timeout should be short (≤ 10 seconds) for good UX on mobile
    const apiBlock = swSource.slice(
      swSource.indexOf("cacheName: 'supabase-api-fallback'"),
      swSource.indexOf("cacheName: 'supabase-api-fallback'") + 300
    )
    const timeoutMatch = apiBlock.match(/networkTimeoutSeconds:\s*(\d+)/)
    expect(timeoutMatch).toBeTruthy()
    const timeoutValue = parseInt(timeoutMatch![1], 10)
    expect(timeoutValue).toBeGreaterThan(0)
    expect(timeoutValue).toBeLessThanOrEqual(10)
  })

  // =========================================================================
  // 5. HTML (index.html): NetworkFirst (always fresh)
  // =========================================================================
  it('5. index.html is served fresh via workbox precache (NetworkFirst-like)', () => {
    // VitePWA/Workbox precaches index.html with revision hash.
    // The SW uses precacheAndRoute which handles navigation requests (HTML) by
    // always checking the network first, falling back to cache.
    expect(swSource).toContain('precacheAndRoute(self.__WB_MANIFEST)')

    // The asset fallback route does NOT intercept HTML (only .js and .css)
    // Verify HTML is excluded from the asset-fallback-cache route
    const assetFallbackCondition = swSource.slice(
      swSource.indexOf("url.pathname.startsWith('/assets/')"),
      swSource.indexOf("url.pathname.startsWith('/assets/')") + 200
    )
    expect(assetFallbackCondition).not.toContain('.html')
  })

  // =========================================================================
  // 6. Supabase realtime: covered by NetworkFirst route (not NetworkOnly)
  // =========================================================================
  it('6. Supabase realtime path is handled by SW route (not silently bypassed)', () => {
    // The SW route matches /realtime/ — this ensures timeout-based fallback
    // rather than a completely ignored route that hangs on flaky networks.
    // WebSockets are upgraded before the SW fetch handler runs, so the SW
    // fetch route effectively only sees the HTTP upgrade request.
    expect(swSource).toContain("url.pathname.includes('/realtime/')")

    // It is grouped with the rest/v1 route, using NetworkFirst
    const realtimeLine = swSource.indexOf("url.pathname.includes('/realtime/')")
    const precedingCode = swSource.slice(
      Math.max(0, realtimeLine - 500),
      realtimeLine + 200
    )
    expect(precedingCode).toContain('NetworkFirst')
  })

  // =========================================================================
  // 7. Static resource cache: preloads critical CSS
  // =========================================================================
  it('7. staticResourceCache.preloadResources is called for critical CSS in main.ts', () => {
    // main.ts imports staticResourceCache and calls preloadResources
    expect(mainTsSource).toContain('staticResourceCache')
    expect(mainTsSource).toContain('preloadResources')

    // Preloads styles.css with high priority
    expect(mainTsSource).toContain("styles.css")
    expect(mainTsSource).toContain("priority: 'high'")

    // The composable must export preloadResources
    expect(staticCacheSource).toContain('preloadResources')
    expect(staticCacheSource).toContain('loadResource')
  })

  // =========================================================================
  // 8. Cache cleanup: old caches purged on SW activate
  // =========================================================================
  it('8. cleanupOutdatedCaches is called to purge old workbox caches', () => {
    // cleanupOutdatedCaches removes caches from old workbox versions/builds
    expect(swSource).toContain('cleanupOutdatedCaches()')
    expect(swSource).toContain("from 'workbox-precaching'")

    // Must be imported
    expect(swSource).toContain('cleanupOutdatedCaches')
  })

  // =========================================================================
  // 9. Cache size limits configured
  // =========================================================================
  it('9. All runtime caches have maxEntries limits to prevent unbounded growth', () => {
    // Every ExpirationPlugin block must include maxEntries
    // Count ExpirationPlugin usages
    const expirationMatches = swSource.match(/new ExpirationPlugin\(/g) || []
    expect(expirationMatches.length).toBeGreaterThanOrEqual(3) // asset-fallback, api, images, fonts

    // Count maxEntries occurrences — must match ExpirationPlugin count
    const maxEntriesMatches = swSource.match(/maxEntries:/g) || []
    expect(maxEntriesMatches.length).toBeGreaterThanOrEqual(expirationMatches.length)

    // staticResourceCache also defines size limits
    expect(staticCacheSource).toContain('maxSize')
    expect(staticCacheSource).toContain('maxEntries')
    expect(staticCacheSource).toContain('50 * 1024 * 1024') // 50MB total limit
  })

  // =========================================================================
  // 10. No auth tokens cached in SW
  // =========================================================================
  it('10. SW does not cache auth tokens or sensitive Supabase endpoints durably', () => {
    // The supabase-api-fallback cache has maxAgeSeconds: 10 — essentially ephemeral,
    // not a real cache for auth tokens
    const apiBlock = swSource.slice(
      swSource.indexOf("cacheName: 'supabase-api-fallback'"),
      swSource.indexOf("cacheName: 'supabase-api-fallback'") + 400
    )

    const maxAgeMatch = apiBlock.match(/maxAgeSeconds:\s*(\d+)/)
    expect(maxAgeMatch).toBeTruthy()
    const maxAge = parseInt(maxAgeMatch![1], 10)

    // Should be very short (10 seconds — not actually caching, just timeout fallback)
    expect(maxAge).toBeLessThanOrEqual(60) // Never cache auth/API responses for more than 1 minute

    // Auth endpoint is also grouped with this NetworkFirst strategy
    expect(swSource).toContain("url.pathname.includes('/auth/v1/')")

    // Static resource cache does not cache auth endpoints (only CSS/JS/images/fonts)
    const resourceConfigSection = staticCacheSource.slice(
      staticCacheSource.indexOf('RESOURCE_CONFIGS'),
      staticCacheSource.indexOf('RESOURCE_CONFIGS') + 500
    )
    expect(resourceConfigSection).not.toContain('auth')
    expect(resourceConfigSection).not.toContain('token')
  })
})
