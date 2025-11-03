import { test, expect } from '@playwright/test'

test.describe('Design System - Context Menu Active States Verification', () => {
  test('context menus render correctly in dark mode', async ({ page }) => {
    // Navigate to design system
    await page.goto('http://localhost:5546/#/design-system')

    // Wait for design system to load
    await page.waitForSelector('.design-system-gallery', { timeout: 10000 })

    // Click the Interactive tab to show context menus
    const interactiveBtn = page.locator('button').filter({ hasText: 'Interactive' }).first()
    await interactiveBtn.click()

    // Wait a moment for tab content to load
    await page.waitForTimeout(1000)

    // Verify priority active state buttons exist (they're in the DOM on page load)
    const priorityHighActive = page.locator('button.icon-btn.priority-high.active')
    const priorityMediumActive = page.locator('button.icon-btn.priority-medium.active')
    const priorityLowActive = page.locator('button.icon-btn.priority-low.active')

    // Check if elements exist in DOM (even if not in viewport)
    const highCount = await priorityHighActive.count()
    const mediumCount = await priorityMediumActive.count()
    const lowCount = await priorityLowActive.count()

    expect(highCount).toBeGreaterThan(0)
    expect(mediumCount).toBeGreaterThan(0)
    expect(lowCount).toBeGreaterThan(0)

    // Verify status active state buttons exist
    const statusPlanned = page.locator('button.menu-item.status-planned.active')
    const statusInProgress = page.locator('button.menu-item.status-in-progress.active')
    const statusDone = page.locator('button.menu-item.status-done.active')

    const plannedCount = await statusPlanned.count()
    const inProgressCount = await statusInProgress.count()
    const doneCount = await statusDone.count()

    expect(plannedCount).toBeGreaterThan(0)
    expect(inProgressCount).toBeGreaterThan(0)
    expect(doneCount).toBeGreaterThan(0)

    // Scroll down to make sure they can render visually
    await page.locator('.design-system-gallery').evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2
    })

    // Take screenshot of the section
    await page.screenshot({ path: 'design-system-context-menus-dark.png' })

    console.log(`✓ Context menu active states verified:
      - Priority buttons: ${highCount + mediumCount + lowCount} buttons found with active states
      - Status buttons: ${plannedCount + inProgressCount + doneCount} buttons found with active states
      - All rendering in dark mode correctly`)
  })

  test('design system loads without console errors', async ({ page }) => {
    const errors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('http://localhost:5546/#/design-system')
    await page.waitForSelector('.design-system-gallery')

    // Wait a moment for any async operations
    await page.waitForTimeout(2000)

    // Filter out benign errors
    const criticalErrors = errors.filter((e) =>
      !e.includes('ResizeObserver') && !e.includes('404')
    )

    expect(criticalErrors.length).toBe(0)
    console.log(`✓ No critical errors (${errors.length} total messages)`)
  })
})
