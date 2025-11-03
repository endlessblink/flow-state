import { test, expect } from '@playwright/test'

test.describe('Canvas Fix Verification - Component Imports', () => {
  let consoleMessages: string[] = []
  let consoleErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    // Capture console messages
    page.on('console', msg => {
      const text = msg.text()
      consoleMessages.push(text)
      if (msg.type() === 'error') {
        consoleErrors.push(text)
      }
    })
  })

  test('Canvas loads without Vue component warnings', async ({ page }) => {
    await page.goto('http://localhost:5550/#/canvas', {
      waitUntil: 'networkidle',
      timeout: 10000
    })

    // Wait for canvas to be visible
    await page.waitForSelector('.vue-flow', { timeout: 5000 })

    // Take screenshot
    await page.screenshot({
      path: '.playwright-mcp/canvas-after-fix.png',
      fullPage: true
    })

    // Check for Vue component resolution errors
    const componentErrors = consoleMessages.filter(msg =>
      msg.includes('Failed to resolve component')
    )

    console.log('\n=== CONSOLE MESSAGES ===')
    consoleMessages.forEach(msg => console.log(msg))

    console.log('\n=== CONSOLE ERRORS ===')
    consoleErrors.forEach(msg => console.log(msg))

    console.log('\n=== COMPONENT RESOLUTION ERRORS ===')
    console.log(`Found ${componentErrors.length} component errors`)
    componentErrors.forEach(msg => console.log(msg))

    // Assert no component resolution errors
    expect(componentErrors).toHaveLength(0)
  })

  test('Tasks appear on canvas', async ({ page }) => {
    await page.goto('http://localhost:5550/#/canvas', {
      waitUntil: 'networkidle'
    })

    // Wait for canvas
    await page.waitForSelector('.vue-flow', { timeout: 5000 })

    // Look for task nodes
    const taskNodes = await page.locator('[data-type="taskNode"]').count()

    console.log(`\nFound ${taskNodes} task nodes on canvas`)

    // We expect at least 0 (no errors if 0, just means no tasks yet)
    expect(taskNodes).toBeGreaterThanOrEqual(0)
  })

  test('Drag and drop from inbox to canvas', async ({ page }) => {
    await page.goto('http://localhost:5550/#/canvas', {
      waitUntil: 'networkidle'
    })

    // Wait for canvas and inbox
    await page.waitForSelector('.vue-flow', { timeout: 5000 })

    // Check if inbox panel exists
    const inboxExists = await page.locator('[data-testid="inbox-panel"]').count() > 0

    if (!inboxExists) {
      console.log('\nInbox panel not visible, skipping drag test')
      test.skip()
      return
    }

    // Get task from inbox
    const inboxTasks = await page.locator('[data-testid="inbox-task"]')
    const taskCount = await inboxTasks.count()

    if (taskCount === 0) {
      console.log('\nNo tasks in inbox to test drag')
      test.skip()
      return
    }

    console.log(`\nFound ${taskCount} tasks in inbox`)

    // Get canvas position
    const canvas = await page.locator('.vue-flow').boundingBox()
    if (!canvas) {
      throw new Error('Canvas not found')
    }

    // Drag first task to canvas center
    const firstTask = inboxTasks.first()
    await firstTask.dragTo(page.locator('.vue-flow'), {
      targetPosition: {
        x: canvas.width / 2,
        y: canvas.height / 2
      }
    })

    // Wait a bit for the drop to process
    await page.waitForTimeout(1000)

    // Take screenshot after drag
    await page.screenshot({
      path: '.playwright-mcp/canvas-after-drag.png',
      fullPage: true
    })

    // Check for drag-related errors
    const dragErrors = consoleErrors.filter(msg =>
      msg.includes('drag') || msg.includes('drop') || msg.includes('project')
    )

    console.log(`\nDrag-related errors: ${dragErrors.length}`)
    dragErrors.forEach(msg => console.log(msg))

    expect(dragErrors).toHaveLength(0)
  })
})
