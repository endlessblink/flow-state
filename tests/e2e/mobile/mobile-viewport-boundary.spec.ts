import { test, expect } from '../../fixtures/auth'
import {
  dismissBlockingModals,
  registerModalHandlers,
  suppressOnboarding,
} from './mobile-helpers'

test.describe('Mobile Viewport Boundary Detection', () => {
  test.beforeEach(async ({ page }) => {
    await registerModalHandlers(page)
    await suppressOnboarding(page)
  })

  test('767px width with touch shows mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 })
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)

    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('nav.mobile-nav')).toBeVisible()
  })

  test('exactly 768px with touch shows mobile layout (breakpoint boundary)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)

    // 768px is <= MOBILE_BREAKPOINT_PX (768), so with touch it should be mobile
    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 10000 })
  })

  test('769px width still shows mobile with mobile UA', async ({ page }) => {
    // When running under mobile-chrome/mobile-safari, the device preset injects
    // a mobile user agent string. The app's useMobileDetection checks UA first:
    // isMobileDevice || (isSmallScreen && isTouch). With a mobile UA,
    // isMobileDevice is always true, so the mobile layout shows at ANY viewport.
    // This test validates that behavior is consistent.
    await page.setViewportSize({ width: 769, height: 1024 })
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)

    // With mobile UA, still mobile layout
    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 10000 })
  })

  test('resize from large to small viewport keeps mobile active', async ({ page }) => {
    // Start at large viewport (still mobile because of UA)
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)

    // Mobile UA means layout is always mobile
    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 10000 })

    // Shrink to phone size
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(500)

    // Still mobile
    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('nav.mobile-nav')).toBeVisible()
  })

  test('mobile header remains visible across viewport changes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)

    await expect(page.locator('header.mobile-header')).toBeVisible({ timeout: 10000 })

    // Resize to tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)

    // Header should still be visible (mobile UA active)
    await expect(page.locator('header.mobile-header')).toBeVisible({ timeout: 5000 })
  })
})
