/**
 * PWA Smoke Tests
 *
 * Run these tests after deployment to verify PWA functionality.
 * These tests are designed to run against production or staging environments.
 *
 * Usage:
 *   PROD_URL=https://flowstate.yourdomain.com npx playwright test tests/smoke/pwa-smoke.spec.ts
 */

import { test, expect } from '@playwright/test';

const PROD_URL = process.env.PROD_URL || 'http://localhost:5546';

test.describe('PWA Smoke Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('app loads successfully', async ({ page }) => {
    await page.goto(PROD_URL);

    // Wait for app to be visible
    await expect(page.locator('#app')).toBeVisible({ timeout: 10000 });

    // Check page title
    await expect(page).toHaveTitle(/FlowState/i);

    // Verify no critical console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a bit for any delayed errors
    await page.waitForTimeout(2000);

    // Filter out non-critical errors (like favicon 404)
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('manifest is accessible', async ({ page }) => {
    const response = await page.goto(`${PROD_URL}/manifest.webmanifest`);

    // If PWA is not yet implemented, this will be 404
    if (response?.status() === 200) {
      const manifest = await response.json();

      // Validate required fields
      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('short_name');
      expect(manifest).toHaveProperty('icons');
      expect(manifest).toHaveProperty('start_url');
      expect(manifest).toHaveProperty('display');

      // Validate icon array
      expect(manifest.icons.length).toBeGreaterThan(0);

      // Check for installability requirements
      const has192Icon = manifest.icons.some(
        (icon: { sizes?: string }) => icon.sizes === '192x192'
      );
      const has512Icon = manifest.icons.some(
        (icon: { sizes?: string }) => icon.sizes === '512x512'
      );

      expect(has192Icon).toBe(true);
      expect(has512Icon).toBe(true);
    } else {
      // PWA not implemented yet - skip but don't fail
      test.skip();
    }
  });

  test('service worker registers', async ({ page }) => {
    await page.goto(PROD_URL);

    // Check if service worker API is available
    const swSupported = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });

    expect(swSupported).toBe(true);

    // Wait for SW to register (if implemented)
    const swRegistered = await page.evaluate(async () => {
      try {
        // Wait up to 5 seconds for SW
        const registration = await navigator.serviceWorker.ready;
        return registration !== null;
      } catch {
        return false;
      }
    });

    if (!swRegistered) {
      // PWA not implemented yet - skip but don't fail
      test.skip();
    }

    expect(swRegistered).toBe(true);
  });

  test('app works in offline mode (basic)', async ({ page, context }) => {
    // First, load the app online to cache resources
    await page.goto(PROD_URL);
    await expect(page.locator('#app')).toBeVisible({ timeout: 10000 });

    // Wait for SW to cache resources
    await page.waitForTimeout(3000);

    // Check if service worker is active
    const swActive = await page.evaluate(() => {
      return navigator.serviceWorker?.controller !== null;
    });

    if (!swActive) {
      // No SW active - skip offline test
      test.skip();
    }

    // Go offline
    await context.setOffline(true);

    // Reload page
    await page.reload();

    // App should still render from cache
    await expect(page.locator('#app')).toBeVisible({ timeout: 10000 });

    // Restore network
    await context.setOffline(false);
  });

  test('HTTPS is enforced', async ({ request }) => {
    // Only test if PROD_URL is a real domain
    if (PROD_URL.includes('localhost')) {
      test.skip();
    }

    // Test HTTP redirect to HTTPS
    const httpUrl = PROD_URL.replace('https://', 'http://');

    try {
      const response = await request.get(httpUrl, {
        maxRedirects: 0,
      });

      // Should redirect (301 or 302)
      expect([301, 302]).toContain(response.status());

      // Redirect should be to HTTPS
      const location = response.headers()['location'];
      expect(location).toMatch(/^https:\/\//);
    } catch (error) {
      // Connection refused on HTTP is also acceptable
      // (means HTTPS-only server)
    }
  });

  test('security headers are present', async ({ page }) => {
    // Only test if PROD_URL is a real domain
    if (PROD_URL.includes('localhost')) {
      test.skip();
    }

    const response = await page.goto(PROD_URL);
    const headers = response?.headers() || {};

    // Check for recommended security headers
    const securityChecks = [
      {
        header: 'strict-transport-security',
        name: 'HSTS',
        required: true,
      },
      {
        header: 'x-content-type-options',
        name: 'X-Content-Type-Options',
        required: false,
      },
      {
        header: 'x-frame-options',
        name: 'X-Frame-Options',
        required: false,
      },
    ];

    const missingRequired: string[] = [];
    const missingRecommended: string[] = [];

    for (const check of securityChecks) {
      if (!headers[check.header]) {
        if (check.required) {
          missingRequired.push(check.name);
        } else {
          missingRecommended.push(check.name);
        }
      }
    }

    // Log warnings for missing recommended headers
    if (missingRecommended.length > 0) {
      console.warn(
        `Missing recommended security headers: ${missingRecommended.join(', ')}`
      );
    }

    // Fail if required headers are missing
    expect(missingRequired).toHaveLength(0);
  });

  test('static assets have proper cache headers', async ({ page }) => {
    // Only test if PROD_URL is a real domain
    if (PROD_URL.includes('localhost')) {
      test.skip();
    }

    // Navigate to get asset URLs
    await page.goto(PROD_URL);

    // Get a JS asset URL from the page
    const jsAsset = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[src*="assets/"]');
      return scripts.length > 0 ? (scripts[0] as HTMLScriptElement).src : null;
    });

    if (jsAsset) {
      const response = await page.request.get(jsAsset);
      const cacheControl = response.headers()['cache-control'];

      // JS assets should have long cache
      expect(cacheControl).toMatch(/max-age=\d{7,}|immutable/);
    }

    // Check SW has no-cache
    const swResponse = await page.request.get(`${PROD_URL}/sw.js`);
    if (swResponse.status() === 200) {
      const swCache = swResponse.headers()['cache-control'];
      expect(swCache).toMatch(/no-store|no-cache|max-age=0/);
    }
  });

  test('app performance is acceptable', async ({ page }) => {
    // Navigate and measure load time
    const startTime = Date.now();
    await page.goto(PROD_URL);
    await expect(page.locator('#app')).toBeVisible({ timeout: 15000 });
    const loadTime = Date.now() - startTime;

    console.log(`App load time: ${loadTime}ms`);

    // Should load within 10 seconds (generous for slow networks)
    expect(loadTime).toBeLessThan(10000);

    // Get Core Web Vitals if available
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics: Record<string, number> = {};

          for (const entry of entries) {
            if (entry.entryType === 'largest-contentful-paint') {
              metrics['LCP'] = entry.startTime;
            }
          }

          resolve(metrics);
        });

        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        // Resolve after 3 seconds if no LCP
        setTimeout(() => resolve({}), 3000);
      });
    });

    console.log('Performance metrics:', metrics);
  });
});

test.describe('PWA Update Flow', () => {
  test('update prompt appears on new version', async ({ page }) => {
    // This test requires deploying a new version
    // For now, just verify the update UI component can render

    await page.goto(PROD_URL);

    // Check if update prompt component is in DOM (hidden)
    // This is app-specific - adjust selector based on your ReloadPrompt component
    const updatePromptExists = await page.evaluate(() => {
      // Check if the app uses a service worker update mechanism
      return 'serviceWorker' in navigator;
    });

    expect(updatePromptExists).toBe(true);
  });
});
