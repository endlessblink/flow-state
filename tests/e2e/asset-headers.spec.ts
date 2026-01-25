import { test, expect } from '@playwright/test'

/**
 * Asset Header Tests
 *
 * These tests verify that critical HTTP headers are set correctly on static assets.
 * This prevents the Cloudflare cache MIME type bug (SOP-032) where Chromium browsers
 * fail to load CSS/JS due to missing Vary header.
 *
 * Run with: npx playwright test tests/e2e/asset-headers.spec.ts
 */

const PRODUCTION_URL = process.env.TEST_URL || 'https://in-theflow.com'
const IS_PRODUCTION = PRODUCTION_URL.includes('in-theflow.com')

test.describe('Asset Headers (Cloudflare Cache Prevention)', () => {
  test.describe.configure({ mode: 'parallel' })

  test('CSS assets have correct headers', async ({ request }) => {
    // First, get the index.html to find the actual CSS filename
    const indexResponse = await request.get(PRODUCTION_URL)
    const html = await indexResponse.text()

    // Extract CSS filename from HTML
    const cssMatch = html.match(/href="(\/assets\/index-[a-zA-Z0-9_-]+\.css)"/)
    expect(cssMatch, 'CSS file reference should exist in index.html').toBeTruthy()

    const cssUrl = `${PRODUCTION_URL}${cssMatch![1]}`

    // Fetch CSS headers
    const cssResponse = await request.head(cssUrl)

    // Verify Content-Type
    const contentType = cssResponse.headers()['content-type']
    expect(contentType).toContain('text/css')

    // CRITICAL: Verify Vary header includes Accept (prevents Cloudflare cache bug)
    const vary = cssResponse.headers()['vary']
    expect(vary, 'Vary header must be present').toBeTruthy()
    expect(vary!.toLowerCase()).toContain('accept')

    // Verify Cache-Control for immutable assets
    const cacheControl = cssResponse.headers()['cache-control']
    expect(cacheControl).toContain('public')
    expect(cacheControl).toContain('max-age=31536000')

    // Verify X-Content-Type-Options
    const xcto = cssResponse.headers()['x-content-type-options']
    expect(xcto).toBe('nosniff')
  })

  test('JavaScript assets have correct headers', async ({ request }) => {
    // First, get the index.html to find the actual JS filename
    const indexResponse = await request.get(PRODUCTION_URL)
    const html = await indexResponse.text()

    // Extract JS filename from HTML
    const jsMatch = html.match(/src="(\/assets\/index-[a-zA-Z0-9_-]+\.js)"/)
    expect(jsMatch, 'JS file reference should exist in index.html').toBeTruthy()

    const jsUrl = `${PRODUCTION_URL}${jsMatch![1]}`

    // Fetch JS headers
    const jsResponse = await request.head(jsUrl)

    // Verify Content-Type
    const contentType = jsResponse.headers()['content-type']
    expect(contentType).toMatch(/javascript|application\/javascript/)

    // CRITICAL: Verify Vary header includes Accept (prevents Cloudflare cache bug)
    const vary = jsResponse.headers()['vary']
    expect(vary, 'Vary header must be present').toBeTruthy()
    expect(vary!.toLowerCase()).toContain('accept')

    // Verify Cache-Control for immutable assets
    const cacheControl = jsResponse.headers()['cache-control']
    expect(cacheControl).toContain('public')
    expect(cacheControl).toContain('max-age=31536000')

    // Verify X-Content-Type-Options
    const xcto = jsResponse.headers()['x-content-type-options']
    expect(xcto).toBe('nosniff')
  })

  test('index.html should not be cached long-term', async ({ request }) => {
    const response = await request.head(PRODUCTION_URL)

    // index.html should have no-cache or short cache
    const cacheControl = response.headers()['cache-control'] || ''

    // Either no-cache, or if cached, must have revalidation
    if (cacheControl) {
      const hasNoCache = cacheControl.includes('no-cache') || cacheControl.includes('no-store')
      const hasRevalidate = cacheControl.includes('must-revalidate')
      const hasShortMaxAge = /max-age=([0-9]+)/.test(cacheControl) &&
        parseInt(cacheControl.match(/max-age=([0-9]+)/)![1]) < 3600

      expect(
        hasNoCache || hasRevalidate || hasShortMaxAge,
        `index.html should not be cached long-term. Got: ${cacheControl}`
      ).toBeTruthy()
    }
    // If no cache-control header, that's also acceptable (will use browser defaults)
  })

  test('Service worker should never be cached', async ({ request }) => {
    const swUrl = `${PRODUCTION_URL}/sw.js`
    const response = await request.head(swUrl)

    if (response.ok()) {
      const cacheControl = response.headers()['cache-control'] || ''
      expect(
        cacheControl.includes('no-cache') || cacheControl.includes('no-store'),
        `Service worker must have no-cache. Got: ${cacheControl}`
      ).toBeTruthy()
    }
    // If sw.js doesn't exist (404), that's also fine
  })

  test('assets load correctly in browser context', async ({ page }) => {
    // This test verifies that assets actually load in a real browser
    // which would catch the MIME type issue that curl doesn't detect

    const errors: string[] = []

    // Collect any resource loading errors
    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`)
    })

    page.on('requestfailed', (request) => {
      if (request.url().includes('/assets/')) {
        errors.push(`Failed to load: ${request.url()} - ${request.failure()?.errorText}`)
      }
    })

    // Navigate to the page
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' })

    // Wait a bit for any lazy-loaded resources
    await page.waitForTimeout(2000)

    // Check for MIME type errors in console
    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('MIME')) {
        consoleLogs.push(msg.text())
      }
    })

    // Verify no asset loading errors
    expect(errors, `Asset loading errors: ${errors.join(', ')}`).toHaveLength(0)

    // Verify no MIME type errors in console
    expect(consoleLogs, `MIME errors in console: ${consoleLogs.join(', ')}`).toHaveLength(0)

    // Verify the page actually rendered (CSS loaded)
    const bodyVisible = await page.isVisible('body')
    expect(bodyVisible).toBeTruthy()

    // Check that main styles are applied (not unstyled content)
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })
    // If CSS didn't load, background would be default white
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
  })
})

test.describe('CORS Headers (API)', () => {
  const API_URL = process.env.API_URL || 'https://api.in-theflow.com'

  test('OPTIONS preflight returns correct CORS headers', async ({ request }) => {
    const response = await request.fetch(`${API_URL}/rest/v1/tasks`, {
      method: 'OPTIONS',
      headers: {
        'Origin': PRODUCTION_URL,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'apikey, authorization, content-type'
      }
    })

    // Should return 204 No Content for preflight
    expect([200, 204]).toContain(response.status())

    // Check CORS headers
    const allowOrigin = response.headers()['access-control-allow-origin']
    expect(allowOrigin).toBeTruthy()

    const allowMethods = response.headers()['access-control-allow-methods']
    expect(allowMethods).toBeTruthy()
    expect(allowMethods!.toLowerCase()).toContain('get')

    const allowHeaders = response.headers()['access-control-allow-headers']
    expect(allowHeaders).toBeTruthy()
  })
})
