import { test, expect } from '@playwright/test'

test('verify sidebar toggle button position with cache clear', async ({ page, context }) => {
  // Clear all browser cache
  await context.clearCookies()

  // Navigate with no cache
  await page.goto('http://localhost:5548/', {
    waitUntil: 'networkidle'
  })

  // Force hard reload
  await page.reload({ waitUntil: 'networkidle' })

  // Wait for app to fully load
  await page.waitForTimeout(2000)

  // Take screenshot
  await page.screenshot({
    path: '.claude/docs/debug/toggle-position-verification.png',
    fullPage: true
  })

  // Find the toggle button
  const toggleBtn = page.locator('.sidebar-toggle-btn')
  await expect(toggleBtn).toBeVisible()

  // Get its position
  const box = await toggleBtn.boundingBox()

  console.log('Toggle button position:', box)

  // Verify it's at the sidebar edge (260px), NOT at viewport edge (0px)
  if (box) {
    console.log(`Toggle button X position: ${box.x}`)
    console.log(`Expected: 260px (at sidebar edge)`)
    console.log(`Actual: ${box.x}px`)

    // Allow small margin for rounding
    expect(box.x).toBeGreaterThan(250)
    expect(box.x).toBeLessThan(270)
  }

  // Also compute the CSS value directly
  const computedLeft = await toggleBtn.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    return styles.insetInlineStart || styles.left
  })

  console.log('Computed inset-inline-start:', computedLeft)
})
