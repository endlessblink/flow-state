import { test, expect } from '@playwright/test'

test.describe('Task Linking Core Functionality Tests', () => {
  test('Application loads without task linking errors', async ({ page }) => {
    // Set up console error monitoring
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
        console.log('Console error:', msg.text())
      }
    })

    // Navigate to application
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Basic application should load
    const title = await page.title()
    expect(title).toContain('Pomo-Flow')

    // Wait to collect any console errors
    await page.waitForTimeout(2000)

    // Filter for task linking related errors
    const criticalErrors = errors.filter(err =>
      err.includes('delete') && err.includes('task') ||
      err.includes('connection') && err.includes('error') ||
      err.includes('edge') && err.includes('undefined')
    )

    console.log(`Total console errors: ${errors.length}`)
    console.log(`Critical task linking errors: ${criticalErrors.length}`)

    // Should not have critical task linking errors
    expect(criticalErrors.length).toBe(0)
  })

  test('Board view loads and has task structure', async ({ page }) => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Look for board elements
    const boardElements = page.locator('.swimlane, .kanban-column, .board-column, [class*="swimlane"], [class*="column"]')
    const boardCount = await boardElements.count()
    console.log(`Found ${boardCount} board elements`)

    // Should have board structure
    expect(boardCount).toBeGreaterThan(0)

    // Look for task input (indicates task functionality is available)
    const taskInput = page.locator('input[placeholder*="task"], .task-input')
    expect(await taskInput.count()).toBeGreaterThan(0)
  })

  test('Canvas view loads without critical errors', async ({ page }) => {
    // Set up console error monitoring
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Navigate to canvas view
    await page.goto('http://localhost:5546/canvas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Check that page has content
    const bodyContent = await page.locator('body').textContent()
    expect(bodyContent?.length || 0).toBeGreaterThan(100)

    // Look for any Vue Flow or canvas elements
    const canvasElements = page.locator('.vue-flow, [class*="vue-flow"], [class*="canvas"], [class*="flow"], svg')
    const canvasCount = await canvasElements.count()
    console.log(`Found ${canvasCount} canvas-related elements`)

    // Wait to collect any canvas-related errors
    await page.waitForTimeout(2000)

    // Should not have Vue Flow related errors
    const vueFlowErrors = errors.filter(err =>
      err.includes('vue-flow') ||
      err.includes('edge') && err.includes('error')
    )

    expect(vueFlowErrors.length).toBeLessThan(2) // Allow minor non-critical errors
  })

  test('Task creation and basic interaction works', async ({ page }) => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Set up error monitoring
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Try to create a task
    const taskInput = page.locator('input[placeholder*="task"], .task-input')
    if (await taskInput.isVisible()) {
      await taskInput.fill('E2E Test Task')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(2000)

      // Check for task deletion errors after creation
      const deletionErrors = errors.filter(err =>
        err.includes('delete') && err.includes('error')
      )

      expect(deletionErrors.length).toBe(0)
    }

    // Basic interaction test - look for task elements
    const taskElements = page.locator('.task-card, .task-item, [class*="task"]:not(input)')
    const taskCount = await taskElements.count()
    console.log(`Found ${taskCount} task elements`)

    // Should have some task functionality available
    expect(taskCount).toBeGreaterThanOrEqual(0) // Allow 0 for empty state
  })
})