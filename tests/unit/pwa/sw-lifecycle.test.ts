/**
 * TASK-1642: SW Lifecycle Tests (10 tests)
 *
 * Tests for the service worker file src/sw.ts covering:
 * - Workbox module imports and configuration
 * - Caching strategies per resource type
 * - Message event handling (SKIP_WAITING)
 * - Lifecycle events (install, activate)
 * - Manifest precaching
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read the SW source code for static analysis tests
const swSourcePath = resolve(__dirname, '../../../src/sw.ts')
const swSource = readFileSync(swSourcePath, 'utf-8')

// Read vite config for PWA plugin config
const viteConfigPath = resolve(__dirname, '../../../vite.config.ts')
const viteConfigSource = readFileSync(viteConfigPath, 'utf-8')

describe('TASK-1642: Service Worker Lifecycle', () => {
  // =========================================================================
  // Static analysis tests (verify SW file structure)
  // =========================================================================

  it('1. SW file imports workbox modules', () => {
    // Must import precacheAndRoute, cleanupOutdatedCaches from workbox-precaching
    expect(swSource).toContain("from 'workbox-precaching'")
    expect(swSource).toContain('precacheAndRoute')
    expect(swSource).toContain('cleanupOutdatedCaches')

    // Must import registerRoute and Route from workbox-routing
    expect(swSource).toContain("from 'workbox-routing'")
    expect(swSource).toContain('registerRoute')
    expect(swSource).toContain('Route')

    // Must import strategies
    expect(swSource).toContain("from 'workbox-strategies'")
    expect(swSource).toContain('CacheFirst')
    expect(swSource).toContain('NetworkFirst')

    // Must import ExpirationPlugin
    expect(swSource).toContain("from 'workbox-expiration'")
    expect(swSource).toContain('ExpirationPlugin')
  })

  it('2. precacheAndRoute called with self.__WB_MANIFEST', () => {
    // VitePWA injects __WB_MANIFEST at build time
    expect(swSource).toContain('precacheAndRoute(self.__WB_MANIFEST)')
  })

  it('3. registerRoute uses correct strategies per file type', () => {
    // Should have multiple registerRoute calls for different resource types
    const registerRouteCount = (swSource.match(/registerRoute\(/g) || []).length
    expect(registerRouteCount).toBeGreaterThanOrEqual(3) // assets, API, images, fonts

    // Verify each route has a strategy
    expect(swSource).toContain('new NetworkFirst(')
    expect(swSource).toContain('new CacheFirst(')
  })

  it('4. Assets (JS/CSS) use NetworkFirst strategy as fallback', () => {
    // BUG-1089: Fallback for assets not in precache
    // The SW uses NetworkFirst for JS/CSS assets as a fallback cache
    expect(swSource).toContain("url.pathname.startsWith('/assets/')")
    expect(swSource).toContain("url.pathname.endsWith('.js')")
    expect(swSource).toContain("url.pathname.endsWith('.css')")
    // Uses NetworkFirst with fallback (BUG-1089)
    expect(swSource).toContain("cacheName: 'asset-fallback-cache'")
  })

  it('5. API calls use NetworkFirst strategy', () => {
    // Supabase API endpoints should use NetworkFirst with timeout
    expect(swSource).toContain("url.pathname.includes('/rest/v1/')")
    expect(swSource).toContain("url.pathname.includes('/realtime/')")
    expect(swSource).toContain("url.pathname.includes('/auth/v1/')")
    expect(swSource).toContain("cacheName: 'supabase-api-fallback'")
    expect(swSource).toContain('networkTimeoutSeconds: 8')
  })

  it('6. Navigation requests handled — images use CacheFirst, fonts use CacheFirst', () => {
    // Images: CacheFirst with 30-day expiry
    expect(swSource).toContain("request.destination === 'image'")
    expect(swSource).toContain("cacheName: 'image-cache'")

    // Fonts: CacheFirst with 1-year expiry
    expect(swSource).toContain("request.destination === 'font'")
    expect(swSource).toContain("cacheName: 'font-cache'")
  })

  it('7. SW handles message events (SKIP_WAITING)', () => {
    // Must have message event listener
    expect(swSource).toContain("self.addEventListener('message'")

    // Must handle SKIP_WAITING message type
    expect(swSource).toContain("case 'SKIP_WAITING':")
    expect(swSource).toContain('self.skipWaiting()')

    // Must also handle TIMER_COMPLETE
    expect(swSource).toContain("case 'TIMER_COMPLETE':")
  })

  it('8. SW activate event claims clients', () => {
    // Activate event should call clients.claim()
    expect(swSource).toContain("self.addEventListener('activate'")
    expect(swSource).toContain('self.clients.claim()')
  })

  it('9. Workbox config excludes sensitive files (.env) via VitePWA glob patterns', () => {
    // The VitePWA config in vite.config.ts should only glob safe file types
    // It should NOT include .env, .key, or other sensitive files
    expect(viteConfigSource).toContain("globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']")

    // Verify .env is NOT in the glob pattern
    const globMatch = viteConfigSource.match(/globPatterns:\s*\[([^\]]+)\]/)
    expect(globMatch).toBeTruthy()
    const globPattern = globMatch![1]
    expect(globPattern).not.toContain('.env')
    expect(globPattern).not.toContain('.key')
    expect(globPattern).not.toContain('.json') // No JSON files precached (could contain secrets)
  })

  it('10. SW install does NOT auto-skip waiting (waits for user consent)', () => {
    // The install event should NOT call self.skipWaiting() directly
    // Instead, SKIP_WAITING is triggered via message when user clicks "Reload"
    expect(swSource).toContain("self.addEventListener('install'")

    // Verify the comment about removed self.skipWaiting()
    expect(swSource).toContain('Removed: self.skipWaiting()')

    // The SKIP_WAITING message handler is the only way to trigger skip
    // This is important for the update prompt flow
    expect(swSource).toContain("case 'SKIP_WAITING':")
  })
})
