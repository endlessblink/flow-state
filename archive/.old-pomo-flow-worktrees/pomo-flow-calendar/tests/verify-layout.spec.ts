import { test, expect } from '@playwright/test'

test('verify sidebar layout is fixed', async ({ page }) => {
  // Navigate to app on the current dev server port
  await page.goto('http://localhost:5548/')

  // Wait for app to load
  await page.waitForSelector('.app-container', { timeout: 10000 })

  // Take full page screenshot
  await page.screenshot({
    path: '.claude/docs/debug/layout-after-fix.png',
    fullPage: true
  })

  // Verify sidebar toggle button positioning
  const toggleBtn = page.locator('.sidebar-toggle-btn')
  const toggleBox = await toggleBtn.boundingBox()

  console.log('Sidebar toggle button position:', toggleBox)

  // The button should be at the left edge (inset-inline-start: 0)
  expect(toggleBox?.x).toBeLessThan(50) // Should be near left edge

  // Verify right sidebar "My Tasks" panel
  const rightSidebar = page.locator('.task-manager-sidebar')
  await expect(rightSidebar).toBeVisible()

  // Check sidebar has proper width (should not be cramped)
  const sidebarBox = await rightSidebar.boundingBox()
  console.log('Right sidebar dimensions:', sidebarBox)

  // Sidebar should be at least 300px wide
  expect(sidebarBox?.width).toBeGreaterThan(280)

  // Take screenshot focused on right sidebar
  await rightSidebar.screenshot({
    path: '.claude/docs/debug/right-sidebar-after-fix.png'
  })

  // Check for console errors
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  await page.waitForTimeout(2000)

  if (errors.length > 0) {
    console.log('Console errors found:', errors)
  }

  expect(errors.length).toBe(0)
})
