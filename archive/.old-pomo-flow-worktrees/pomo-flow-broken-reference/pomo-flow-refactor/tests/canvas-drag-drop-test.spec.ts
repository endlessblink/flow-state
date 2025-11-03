import { test, expect } from '@playwright/test'

test.describe('Canvas Drag and Drop Verification', () => {
  test('Complete drag and drop workflow', async ({ page }) => {
    // Navigate to canvas
    await page.goto('http://localhost:5550/#/canvas', {
      waitUntil: 'networkidle',
      timeout: 10000
    })

    // Wait for canvas to be visible
    await page.waitForSelector('.vue-flow', { timeout: 5000 })

    // Take initial screenshot
    await page.screenshot({
      path: '.playwright-mcp/canvas-drag-drop-1-initial.png',
      fullPage: true
    })

    // Close any open modals first (Escape key)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Close modal if it exists
    const closeButton = page.locator('button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"]')
    const closeButtonExists = await closeButton.count() > 0
    if (closeButtonExists) {
      await closeButton.first().click()
      await page.waitForTimeout(500)
    }

    // Look for the inbox panel - it should have a chevron to expand it
    // The inbox panel is typically on the left side of the canvas
    const inboxPanel = page.locator('[data-testid="inbox-panel"], .inbox-panel')
    const inboxExists = await inboxPanel.count() > 0

    console.log(`\n=== INBOX PANEL ===`)
    console.log(`Inbox panel found: ${inboxExists}`)

    if (!inboxExists) {
      // Try to find the chevron/arrow button to expand inbox
      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first()
      const chevronExists = await chevronButton.count() > 0

      if (chevronExists) {
        console.log('Clicking chevron to expand inbox...')
        await chevronButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Take screenshot after attempting to open inbox
    await page.screenshot({
      path: '.playwright-mcp/canvas-drag-drop-2-after-toggle.png',
      fullPage: true
    })

    // Look for inbox tasks - try multiple selectors
    const inboxTaskSelectors = [
      '[data-testid="inbox-task"]',
      '.inbox-task',
      '.inbox-panel [draggable="true"]',
      '[class*="inbox"] [draggable="true"]'
    ]

    let taskCount = 0
    let taskLocator

    for (const selector of inboxTaskSelectors) {
      taskLocator = page.locator(selector)
      taskCount = await taskLocator.count()
      if (taskCount > 0) {
        console.log(`Found ${taskCount} tasks using selector: ${selector}`)
        break
      }
    }

    console.log(`\n=== INBOX TASKS ===`)
    console.log(`Total draggable tasks found: ${taskCount}`)

    if (taskCount === 0) {
      console.log('⚠️  No tasks found in inbox.')
      console.log('This is expected if all tasks have canvas positions.')
      console.log('Skipping drag test.')
      test.skip()
      return
    }

    // Get canvas bounding box for drop target
    const canvas = await page.locator('.vue-flow').boundingBox()
    if (!canvas) {
      throw new Error('Canvas not found')
    }

    console.log(`\n=== DRAG TEST ===`)
    console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`)

    // Get the first task
    const firstTask = taskLocator!.first()
    const taskText = await firstTask.textContent()
    console.log(`Dragging task: "${taskText?.substring(0, 50).trim()}..."`)

    // Check if any modals are still blocking
    const modalOverlay = page.locator('.modal-overlay, [class*="modal"]')
    const modalCount = await modalOverlay.count()
    console.log(`Modal overlays visible: ${modalCount}`)

    if (modalCount > 0) {
      console.log('⚠️  Modal still blocking, pressing Escape again...')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }

    // Perform drag to canvas center using mouse actions
    const taskBox = await firstTask.boundingBox()
    if (!taskBox) {
      throw new Error('Could not get task bounding box')
    }

    console.log(`Task position: ${taskBox.x}, ${taskBox.y}`)
    console.log(`Dragging to canvas center: ${canvas.x + canvas.width / 2}, ${canvas.y + canvas.height / 2}`)

    // Use mouse actions instead of dragTo for more control
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(100)
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2, { steps: 10 })
    await page.waitForTimeout(100)
    await page.mouse.up()

    // Wait for drag to complete
    await page.waitForTimeout(2000)

    // Take screenshot after drag
    await page.screenshot({
      path: '.playwright-mcp/canvas-drag-drop-3-after-drag.png',
      fullPage: true
    })

    // Check if task now appears on canvas
    const canvasTaskNodes = page.locator('[data-type="taskNode"]')
    const canvasTaskCount = await canvasTaskNodes.count()

    console.log(`\n=== RESULT ===`)
    console.log(`Task nodes on canvas after drag: ${canvasTaskCount}`)

    // Take final screenshot showing result
    await page.screenshot({
      path: '.playwright-mcp/canvas-drag-drop-4-final.png',
      fullPage: true
    })

    // Assert that task appeared on canvas
    expect(canvasTaskCount).toBeGreaterThan(0)
  })
})
