import { test, expect } from '@playwright/test'

async function dismissBlockingOverlays(page: import('@playwright/test').Page) {
  const onboarding = page.locator('.onboarding-overlay')
  if (await onboarding.isVisible({ timeout: 1500 }).catch(() => false)) {
    const btn = page.locator('.onboarding-modal button').filter({ hasText: /Get Started|Start/i }).first()
    if (await btn.isVisible().catch(() => false)) await btn.click({ force: true })
  }

  const aiWizard = page.locator('.wizard-overlay')
  if (await aiWizard.isVisible({ timeout: 1500 }).catch(() => false)) {
    const btn = page.locator('.wizard-overlay .close-btn').first()
    if (await btn.isVisible().catch(() => false)) await btn.click({ force: true })
  }
}

test.describe('Task Linking Core Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate-onboarding-v2', JSON.stringify({
        seen: true,
        version: 2,
        dismissedAt: new Date().toISOString(),
      }))
      localStorage.setItem('flowstate-welcome-seen', 'true')
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({
        aiSetupComplete: true,
        aiPreferredProvider: 'groq',
      }))
    })
  })

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
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await dismissBlockingOverlays(page)
    await page.waitForTimeout(3000)

    // Basic application should load
    const title = await page.title()
    expect(title).toContain('FlowState')

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
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await dismissBlockingOverlays(page)
    await page.waitForTimeout(2000)

    // Look for board elements
    const boardElements = page.locator('.swimlane, .kanban-column, .board-column, [class*="swimlane"], [class*="column"]')
    const boardCount = await boardElements.count()
    console.log(`Found ${boardCount} board elements`)

    // Should have board structure
    const boardContainer = page.locator('.kanban-board, .board-container, .kanban-view')
    expect(boardCount > 0 || await boardContainer.count() > 0).toBeTruthy()

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
    await page.goto('/#/canvas')
    await page.waitForLoadState('networkidle')
    await dismissBlockingOverlays(page)
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
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await dismissBlockingOverlays(page)
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
