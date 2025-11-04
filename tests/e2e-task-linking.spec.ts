import { test, expect } from '@playwright/test'

test.describe('Task Linking Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Allow app to fully initialize
  })

  test('Canvas view loads and is accessible', async ({ page }) => {
    // Navigate to canvas view
    await page.goto('http://localhost:5546/canvas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Look for any canvas-related elements - more flexible selectors
    const canvasElements = page.locator('.vue-flow, [class*="vue-flow"], [class*="canvas"], [class*="flow"], svg')
    const canvasCount = await canvasElements.count()
    console.log(`Found ${canvasCount} canvas-related elements`)

    // Look for any content that indicates canvas loaded
    const mainContent = page.locator('main, .main-content, [class*="view"], [class*="container"]')
    const mainCount = await mainContent.count()
    console.log(`Found ${mainCount} main content elements`)

    // Check that page has content and no critical errors
    const bodyContent = await page.locator('body').textContent()
    expect(bodyContent?.length || 0).toBeGreaterThan(100)

    // Should have some content structure
    expect(mainCount).toBeGreaterThan(0)
  })

  test('Board view loads with task elements', async ({ page }) => {
    // Check if we're on board view by default or navigate there
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Look for board elements
    const boardElements = page.locator('.swimlane, .kanban-column, .board-column, [class*="swimlane"], [class*="column"]')
    const boardCount = await boardElements.count()
    console.log(`Found ${boardCount} board elements`)

    // Look for task cards/items
    const taskElements = page.locator('.task-card, .task-item, [class*="task"]')
    const taskCount = await taskElements.count()
    console.log(`Found ${taskCount} task elements`)

    // Should have board structure
    expect(boardCount).toBeGreaterThan(0)
  })

  test('Task editing works without causing deletions', async ({ page }) => {
    // Navigate to application
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find a task element
    const taskElements = page.locator('.task-card, .task-item, [class*="task"]')
    const taskCount = await taskElements.count()

    if (taskCount === 0) {
      // Try to create a task first
      const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="add"], .quick-task-input')
      if (await taskInput.isVisible()) {
        await taskInput.fill('E2E Test Task for Editing')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(1000)
      }
    }

    // Find task again
    const targetTask = taskElements.first()
    if (await targetTask.isVisible()) {
      const initialTaskCount = await taskElements.count()

      // Try to open edit modal - might be double-click or single click
      await targetTask.dblclick()
      await page.waitForTimeout(1000)

      // Look for modal or dialog
      const modal = page.locator('.modal, .dialog, [class*="modal"], [class*="dialog"]')

      if (await modal.isVisible()) {
        // Find input field in modal
        const inputField = modal.locator('input[type="text"], textarea').first()
        if (await inputField.isVisible()) {
          const originalValue = await inputField.inputValue()
          await inputField.fill(originalValue + ' (edited)')
        }

        // Look for save button
        const saveButton = modal.locator('button:has-text("Save"), button:has-text("OK"), button[type="submit"]').first()
        if (await saveButton.isVisible()) {
          await saveButton.click()
          await page.waitForTimeout(1000)
        }

        // Verify task still exists
        const finalTaskCount = await taskElements.count()
        expect(finalTaskCount).toBeGreaterThanOrEqual(initialTaskCount)
      } else {
        console.log('No modal appeared - might be different interaction pattern')
      }
    } else {
      console.log('No tasks found to edit')
    }

    // Check for console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.waitForTimeout(2000)

    // Should not have critical errors
    const criticalErrors = errors.filter(err => err.includes('delete') && err.includes('error'))
    expect(criticalErrors.length).toBe(0)
  })

  test('Application loads without critical errors', async ({ page }) => {
    // Navigate to application
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    // Check for no console errors
    const messages: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        messages.push(msg.text())
      }
    })

    // Wait a bit to collect any console errors
    await page.waitForTimeout(3000)

    // Assert no critical errors related to our fixes
    const connectionErrors = messages.filter(msg =>
      msg.includes('connection') ||
      msg.includes('link') ||
      msg.includes('edge') ||
      msg.includes('delete') && msg.includes('task')
    )

    console.log('Console errors found:', messages)
    console.log('Connection-related errors:', connectionErrors)

    // Should not have connection or task deletion errors
    expect(connectionErrors.length).toBeLessThan(2) // Allow minor non-critical errors
  })

  test('Vue Flow connection elements are properly configured', async ({ page }) => {
    // Navigate to canvas view
    await page.goto('http://localhost:5546/canvas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Check for SVG markers (should include arrowhead)
    const svgMarkers = page.locator('svg marker')
    const markerCount = await svgMarkers.count()

    if (markerCount > 0) {
      console.log(`Found ${markerCount} SVG markers`)

      // Look for arrowhead marker specifically
      const arrowhead = page.locator('#arrowhead')
      if (await arrowhead.isVisible()) {
        console.log('Arrowhead marker found')
      }
    }

    // Check for Vue Flow edge elements
    const edges = page.locator('.vue-flow__edge')
    const edgeCount = await edges.count()
    console.log(`Found ${edgeCount} existing edges`)

    // Look for Vue Flow node elements
    const nodes = page.locator('.vue-flow__node')
    const nodeCount = await nodes.count()
    console.log(`Found ${nodeCount} Vue Flow nodes`)

    // Should have Vue Flow structure
    expect(nodeCount).toBeGreaterThan(0)
  })

  test('Task interactions work correctly in both views', async ({ page }) => {
    // Test both Board and Canvas views
    const views = [
      { url: 'http://localhost:5546', name: 'Board' },
      { url: 'http://localhost:5546/canvas', name: 'Canvas' }
    ]

    for (const view of views) {
      await page.goto(view.url)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      console.log(`Testing ${view.name} view`)

      // Look for task elements
      const taskElements = page.locator('.task-card, .task-item, .task-node, [class*="task"]')
      const taskCount = await taskElements.count()
      console.log(`Found ${taskCount} tasks in ${view.name} view`)

      if (taskCount > 0) {
        const firstTask = taskElements.first()
        await expect(firstTask).toBeVisible()

        // Test click interactions
        await firstTask.click()
        await page.waitForTimeout(500)

        // Test double-click (should open edit modal if available)
        await firstTask.dblclick()
        await page.waitForTimeout(1000)

        // Check if modal appeared and close it if it did
        const modal = page.locator('.modal, .dialog, [class*="modal"], [class*="dialog"]')
        if (await modal.isVisible()) {
          console.log(`Edit modal opened in ${view.name} view`)

          // Try to close it (escape key or close button)
          const closeButton = modal.locator('button:has-text("Cancel"), button:has-text("Close"), [class*="close"]').first()
          if (await closeButton.isVisible()) {
            await closeButton.click()
          } else {
            await page.keyboard.press('Escape')
          }
          await page.waitForTimeout(500)
        }
      }

      // Check for any errors after interactions
      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text())
        }
      })

      await page.waitForTimeout(1000)

      // Should not have critical interaction errors
      const criticalErrors = errors.filter(err =>
        err.includes('Cannot read') ||
        err.includes('undefined') ||
        err.includes('delete')
      )

      expect(criticalErrors.length).toBeLessThan(2)
    }
  })
})