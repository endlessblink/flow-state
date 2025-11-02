import { test, expect } from '@playwright/test'

test.describe('Canvas Tasks Loading Debug', () => {
  test('should load canvas view and display tasks', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5552')

    // Wait for app to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check for console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Navigate to canvas view
    const canvasLink = page.locator('a[href="/canvas"]')
    if (await canvasLink.isVisible()) {
      await canvasLink.click()
    } else {
      // Try navigation menu
      await page.goto('http://localhost:5552/canvas')
    }

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/canvas-debug.png', fullPage: true })

    // Check for Vue Flow canvas
    const vueFlowCanvas = page.locator('.vue-flow')
    await expect(vueFlowCanvas).toBeVisible({ timeout: 10000 })

    // Check for task nodes
    const taskNodes = page.locator('[data-id^="task-"]')
    const taskCount = await taskNodes.count()

    console.log('Task nodes found:', taskCount)
    console.log('Console errors:', consoleErrors)

    // Check for sections
    const sections = page.locator('[data-id^="section-"]')
    const sectionCount = await sections.count()

    console.log('Section nodes found:', sectionCount)

    // Print any errors found
    if (consoleErrors.length > 0) {
      console.error('Console errors detected:')
      consoleErrors.forEach(err => console.error('  -', err))
    }
  })
})
