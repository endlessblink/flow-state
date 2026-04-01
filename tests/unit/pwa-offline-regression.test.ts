/**
 * PWA Offline Regression Tests
 *
 * Prevents regressions of fixes from the "breaks to HTML" offline failures.
 * Tests configuration values that, if changed, would break offline reliability.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../..')

describe('PWA Offline Configuration (regression)', () => {

  describe('vite.config.ts — VitePWA settings', () => {
    const viteConfig = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf-8')

    it('uses registerType "prompt" (not "autoUpdate" which causes stale SW)', () => {
      expect(viteConfig).toContain("registerType: 'prompt'")
      expect(viteConfig).not.toContain("registerType: 'autoUpdate'")
    })

    it('uses injectManifest strategy for custom SW', () => {
      expect(viteConfig).toContain("strategies: 'injectManifest'")
    })

    it('sets maximumFileSizeToCacheInBytes >= 5MB to precache large chunks', () => {
      const match = viteConfig.match(/maximumFileSizeToCacheInBytes:\s*([\d*\s]+)/)
      expect(match).not.toBeNull()
      // Evaluate the expression (e.g., "5 * 1024 * 1024")
      const value = eval(match![1])
      expect(value).toBeGreaterThanOrEqual(5 * 1024 * 1024)
    })

    it('disables SW for Tauri and Capacitor builds', () => {
      expect(viteConfig).toContain('disable: isTauri || isCapacitor')
    })

    it('disables SW in dev mode (prevents infinite reload loop BUG-1112)', () => {
      expect(viteConfig).toContain('enabled: false')
    })
  })

  describe('src/sw.ts — Service Worker caching', () => {
    const swSource = readFileSync(resolve(ROOT, 'src/sw.ts'), 'utf-8')

    it('has NavigationRoute for offline SPA fallback', () => {
      expect(swSource).toContain('NavigationRoute')
      expect(swSource).toContain('createHandlerBoundToURL')
    })

    it('precaches all assets via __WB_MANIFEST', () => {
      expect(swSource).toContain('precacheAndRoute(self.__WB_MANIFEST)')
    })

    it('cleans up outdated caches', () => {
      expect(swSource).toContain('cleanupOutdatedCaches()')
    })

    it('does NOT cache Supabase auth endpoints (stale tokens cause auth failures)', () => {
      // The SW should only cache REST API GET requests, not auth
      expect(swSource).not.toMatch(/auth\/v1.*NetworkFirst|CacheFirst.*auth\/v1/)
      // Verify auth is in the NavigationRoute denylist
      // The denylist entries use regex literals (/\/auth\/v1\//) so backslashes are present in source
      expect(swSource).toMatch(/denylist[\s\S]*?auth/)
    })

    it('does NOT cache Supabase realtime endpoints (SSE/WS do not cache)', () => {
      expect(swSource).toMatch(/denylist.*realtime/)
    })

    it('only caches GET requests to Supabase REST API', () => {
      expect(swSource).toContain("request.method !== 'GET'")
      expect(swSource).toContain("url.pathname.includes('/rest/v1/')")
    })

    it('does NOT call skipWaiting() on install (controlled via SKIP_WAITING message)', () => {
      // The install listener should NOT contain skipWaiting
      // But SKIP_WAITING message handler should exist
      expect(swSource).toContain("case 'SKIP_WAITING':")
      expect(swSource).toContain('self.skipWaiting()')
      // Verify the install event doesn't auto-skip
      expect(swSource).toMatch(/addEventListener\('install'[\s\S]*?Removed:?\s*self\.skipWaiting/)
    })

    it('uses supabase-rest-cache (not supabase-api-fallback which cached auth)', () => {
      expect(swSource).toContain('supabase-rest-cache')
      expect(swSource).not.toContain('supabase-api-fallback')
    })
  })

  describe('Caddyfile — cache control headers', () => {
    const caddyfile = readFileSync(resolve(ROOT, 'Caddyfile'), 'utf-8')

    it('sets no-cache for index.html', () => {
      expect(caddyfile).toContain('/index.html')
      expect(caddyfile).toContain('no-cache')
    })

    it('sets no-cache for sw.js', () => {
      expect(caddyfile).toContain('/sw.js')
    })

    it('sets immutable cache for /assets/*', () => {
      expect(caddyfile).toContain('/assets/*')
      expect(caddyfile).toContain('immutable')
    })
  })

  describe('Mobile task creation — deleted task filtering', () => {
    const logicFile = readFileSync(
      resolve(ROOT, 'src/mobile/composables/useMobileInboxLogic.ts'), 'utf-8'
    )

    it('filters out deleted tasks defensively', () => {
      expect(logicFile).toContain('!t.isDeleted')
    })
  })
})
