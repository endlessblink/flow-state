import { test, expect } from '@playwright/test'

test('capture current layout for verification', async ({ page }) => {
  // Navigate to app on the current dev server port
  await page.goto('http://localhost:5548/')

  // Wait for any main content to load (using a more generic selector)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // Take full page screenshot
  await page.screenshot({
    path: '.claude/docs/debug/layout-fixed-full-page.png',
    fullPage: true
  })

  console.log('✅ Full page screenshot saved to .claude/docs/debug/layout-fixed-full-page.png')

  // Try to find and screenshot the right sidebar specifically
  const sidebar = page.locator('.task-manager-sidebar, [class*="sidebar"]').first()
  if (await sidebar.isVisible().catch(() => false)) {
    await sidebar.screenshot({
      path: '.claude/docs/debug/right-sidebar-fixed.png'
    })
    console.log('✅ Right sidebar screenshot saved to .claude/docs/debug/right-sidebar-fixed.png')
  }

  // Get viewport info
  const viewportSize = page.viewportSize()
  console.log('Viewport size:', viewportSize)

  // Log any visible panel widths
  const panels = await page.locator('[class*="panel"], [class*="sidebar"]').all()
  for (const panel of panels) {
    const box = await panel.boundingBox()
    if (box) {
      console.log('Panel dimensions:', { width: box.width, height: box.height, x: box.x, y: box.y })
    }
  }
})
