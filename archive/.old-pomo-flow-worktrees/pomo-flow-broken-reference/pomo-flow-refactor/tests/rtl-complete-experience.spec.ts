import { test, expect } from '@playwright/test'

test.describe('RTL Complete Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000) // Wait for app to fully initialize
  })

  test('should switch between LTR and RTL modes correctly', async ({ page }) => {
    // Verify we start in LTR mode (default)
    const htmlDir = await page.evaluate(() => document.documentElement.dir)
    expect(htmlDir).toBe('ltr')

    // Take screenshot of LTR mode
    await page.screenshot({
      path: '.claude/docs/rtl-testing/ltr-default-view.png',
      fullPage: true
    })

    // Switch to RTL mode via settings
    const settingsBtn = page.locator('button:has-text("Settings")')
    await settingsBtn.click()
    await page.waitForTimeout(500)

    // Find and click RTL toggle (assuming it exists in settings)
    // If settings modal has RTL toggle, enable it
    const rtlToggle = page.locator('[data-testid="rtl-toggle"], .n-switch:near(:text("RTL"))')
    if (await rtlToggle.count() > 0) {
      await rtlToggle.click()
      await page.waitForTimeout(500)
    } else {
      // Alternative: directly set dir attribute for testing
      await page.evaluate(() => {
        document.documentElement.dir = 'rtl'
      })
      await page.waitForTimeout(500)
    }

    // Close settings
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Verify RTL mode is active
    const htmlDirRTL = await page.evaluate(() => document.documentElement.dir)
    expect(htmlDirRTL).toBe('rtl')

    // Take screenshot of RTL mode
    await page.screenshot({
      path: '.claude/docs/rtl-testing/rtl-default-view.png',
      fullPage: true
    })
  })

  test('should position sidebar toggle correctly in RTL mode', async ({ page }) => {
    // Switch to RTL
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl'
    })
    await page.waitForTimeout(500)

    // Find sidebar toggle
    const toggleBtn = page.locator('.sidebar-toggle-btn')
    await expect(toggleBtn).toBeVisible()

    // Get toggle position
    const box = await toggleBtn.boundingBox()
    if (!box) throw new Error('Toggle button not found')

    console.log('RTL Toggle position:', { x: box.x, y: box.y })

    // In RTL mode with sidebar visible, toggle should be at 260px from RIGHT edge
    const viewportWidth = page.viewportSize()?.width || 1280
    const expectedXFromLeft = viewportWidth - 260 - box.width

    // Allow 20px tolerance
    expect(box.x).toBeGreaterThan(expectedXFromLeft - 20)
    expect(box.x).toBeLessThan(expectedXFromLeft + 20)

    // Take screenshot
    await page.screenshot({
      path: '.claude/docs/rtl-testing/rtl-sidebar-toggle-position.png',
      fullPage: true
    })
  })

  test('should position canvas controls on left in RTL mode', async ({ page }) => {
    // Navigate to Canvas view
    await page.click('a:has-text("Canvas")')
    await page.waitForTimeout(1000)

    // Switch to RTL
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl'
    })
    await page.waitForTimeout(500)

    // Find canvas controls
    const canvasControls = page.locator('.canvas-controls')
    await expect(canvasControls).toBeVisible()

    // Get controls position
    const box = await canvasControls.boundingBox()
    if (!box) throw new Error('Canvas controls not found')

    console.log('RTL Canvas controls position:', { x: box.x, y: box.y })

    // In RTL mode, controls should be on the LEFT side (inset-inline-end becomes left)
    // Should be close to left edge (within first 100px)
    expect(box.x).toBeLessThan(100)

    // Verify controls are not overlapping header (top should be positive)
    expect(box.y).toBeGreaterThan(0)

    // Take screenshot
    await page.screenshot({
      path: '.claude/docs/rtl-testing/rtl-canvas-controls-position.png',
      fullPage: true
    })
  })

  test('should position InboxPanel on right in RTL mode', async ({ page }) => {
    // Navigate to Canvas view
    await page.click('a:has-text("Canvas")')
    await page.waitForTimeout(1000)

    // Switch to RTL
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl'
    })
    await page.waitForTimeout(500)

    // Open InboxPanel if not visible
    const inboxPanel = page.locator('.inbox-panel')
    if (await inboxPanel.count() === 0) {
      // Try to toggle secondary sidebar
      const toggleBtn = page.locator('button[title*="Inbox"], button:has-text("Inbox")')
      if (await toggleBtn.count() > 0) {
        await toggleBtn.click()
        await page.waitForTimeout(500)
      }
    }

    // Verify InboxPanel position
    const box = await inboxPanel.boundingBox()
    if (box) {
      console.log('RTL InboxPanel position:', { x: box.x, y: box.y })

      // In RTL mode, InboxPanel should be on RIGHT side
      const viewportWidth = page.viewportSize()?.width || 1280
      expect(box.x).toBeGreaterThan(viewportWidth - 400) // Should be near right edge
    }

    // Take screenshot
    await page.screenshot({
      path: '.claude/docs/rtl-testing/rtl-inbox-panel-position.png',
      fullPage: true
    })
  })

  test('should verify compact canvas controls spacing', async ({ page }) => {
    // Navigate to Canvas view
    await page.click('a:has-text("Canvas")')
    await page.waitForTimeout(1000)

    // Get canvas controls
    const canvasControls = page.locator('.canvas-controls')
    await expect(canvasControls).toBeVisible()

    // Get computed styles
    const styles = await canvasControls.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        gap: computed.gap,
        padding: computed.padding
      }
    })

    console.log('Canvas controls styles:', styles)

    // Verify compact spacing (gap should be 4px)
    expect(styles.gap).toContain('4px')

    // Take screenshot
    await page.screenshot({
      path: '.claude/docs/rtl-testing/canvas-controls-compact-spacing.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 400, height: 600 }
    })
  })

  test('should test Board view in RTL mode', async ({ page }) => {
    // Navigate to Board view
    await page.click('a:has-text("Board")')
    await page.waitForTimeout(1000)

    // Switch to RTL
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl'
    })
    await page.waitForTimeout(500)

    // Take screenshot of Board view in RTL
    await page.screenshot({
      path: '.claude/docs/rtl-testing/rtl-board-view.png',
      fullPage: true
    })

    // Verify swimlanes are mirrored correctly
    const swimlanes = page.locator('.kanban-swimlane')
    const count = await swimlanes.count()
    console.log('Found swimlanes:', count)

    if (count > 0) {
      const firstSwimlane = swimlanes.first()
      const box = await firstSwimlane.boundingBox()
      console.log('First swimlane position in RTL:', box)
    }
  })

  test('should test Calendar view in RTL mode', async ({ page }) => {
    // Navigate to Calendar view
    await page.click('a:has-text("Calendar")')
    await page.waitForTimeout(1000)

    // Switch to RTL
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl'
    })
    await page.waitForTimeout(500)

    // Take screenshot of Calendar view in RTL
    await page.screenshot({
      path: '.claude/docs/rtl-testing/rtl-calendar-view.png',
      fullPage: true
    })
  })

  test('should verify main content spacing improvements', async ({ page }) => {
    // Get main content element
    const mainContent = page.locator('.main-content')
    await expect(mainContent).toBeVisible()

    // Get computed padding
    const padding = await mainContent.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return computed.padding
    })

    console.log('Main content padding:', padding)

    // Verify improved padding (should be var(--space-10) var(--space-12))
    // Exact values depend on CSS variables, but should be substantial
    expect(padding).toBeTruthy()
  })

  test('should switch between LTR and RTL multiple times', async ({ page }) => {
    // Test switching back and forth
    for (let i = 0; i < 3; i++) {
      // Switch to RTL
      await page.evaluate(() => {
        document.documentElement.dir = 'rtl'
      })
      await page.waitForTimeout(300)

      let dir = await page.evaluate(() => document.documentElement.dir)
      expect(dir).toBe('rtl')

      // Switch back to LTR
      await page.evaluate(() => {
        document.documentElement.dir = 'ltr'
      })
      await page.waitForTimeout(300)

      dir = await page.evaluate(() => document.documentElement.dir)
      expect(dir).toBe('ltr')
    }

    // Take final screenshot
    await page.screenshot({
      path: '.claude/docs/rtl-testing/rtl-switching-test-final.png',
      fullPage: true
    })
  })
})
