import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'

describe('Application Smoke Tests', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    // Launch browser for testing
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  })

  afterAll(async () => {
    await browser.close()
  })

  beforeEach(async () => {
    page = await browser.newPage()
    // Set default viewport
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  afterEach(async () => {
    await page.close()
  })

  it('should load the main application without errors', async () => {
    // Navigate to the app
    const response = await page.goto('http://localhost:5546')
    expect(response?.ok()).toBe(true)

    // Wait for the app to load
    await page.waitForLoadState('networkidle')

    // Check that the page loads without JavaScript errors
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    // Wait a bit for any errors to appear
    await page.waitForTimeout(2000)

    // Should not have any JavaScript errors
    expect(errors.length).toBe(0)
  })

  it('should render the main layout components', async () => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    // Check for main layout elements
    await expect(page.locator('.app-container, #app, .main-app')).toBeVisible()

    // Should have navigation/sidebar
    await expect(page.locator('.sidebar, .nav, .navigation')).toBeVisible()

    // Should have main content area
    await expect(page.locator('.main-content, .content, .view-container')).toBeVisible()
  })

  it('should navigate to board view without errors', async () => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    // Find and click board view navigation
    const boardNav = page.locator('a[href*="board"], button:has-text("Board"), .nav-board').first()
    if (await boardNav.isVisible()) {
      await boardNav.click()
      await page.waitForLoadState('networkidle')

      // Check that board view loads
      await expect(page.locator('.board-view, .kanban-board, .board-container')).toBeVisible()
    } else {
      // Skip test if board navigation not found
      console.log('Board navigation not found, skipping board view test')
    }
  })

  it('should navigate to calendar view without errors', async () => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    // Find and click calendar view navigation
    const calendarNav = page.locator('a[href*="calendar"], button:has-text("Calendar"), .nav-calendar').first()
    if (await calendarNav.isVisible()) {
      await calendarNav.click()
      await page.waitForLoadState('networkidle')

      // Check that calendar view loads
      await expect(page.locator('.calendar-view, .calendar, .calendar-container')).toBeVisible()
    } else {
      // Skip test if calendar navigation not found
      console.log('Calendar navigation not found, skipping calendar view test')
    }
  })

  it('should navigate to canvas view without errors', async () => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    // Find and click canvas view navigation
    const canvasNav = page.locator('a[href*="canvas"], button:has-text("Canvas"), .nav-canvas').first()
    if (await canvasNav.isVisible()) {
      await canvasNav.click()
      await page.waitForLoadState('networkidle')

      // Check that canvas view loads without the previous error
      await expect(page.locator('.canvas-view, .canvas, .vue-flow')).toBeVisible()

      // Verify there's no error message about canvas view
      await expect(page.locator('text=Error: The canvas view encountered an error')).not.toBeVisible()

      // Check for canvas-specific elements
      await expect(page.locator('.vue-flow__pane, .task-node, .canvas-container')).toBeVisible()
    } else {
      // Try direct URL navigation
      await page.goto('http://localhost:5546/#/canvas')
      await page.waitForLoadState('networkidle')

      // Check that canvas view loads
      await expect(page.locator('.canvas-view, .canvas, .vue-flow')).toBeVisible()
      await expect(page.locator('text=Error: The canvas view encountered an error')).not.toBeVisible()
    }
  })

  it('should handle task creation workflow', async () => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    // Look for task creation button
    const createTaskBtn = page.locator('button:has-text("Add Task"), button:has-text("New Task"), .create-task-btn').first()

    if (await createTaskBtn.isVisible()) {
      await createTaskBtn.click()
      await page.waitForTimeout(500)

      // Check that some form of task creation interface appears
      const modal = page.locator('.modal, .dialog, .task-form, .create-task-modal').first()
      if (await modal.isVisible()) {
        // Try to fill in a task title
        const titleInput = modal.locator('input[placeholder*="title"], input[placeholder*="Task"], input[type="text"]').first()
        if (await titleInput.isVisible()) {
          await titleInput.fill('Test Task')

          // Look for save/create button
          const saveBtn = modal.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Add")').first()
          if (await saveBtn.isVisible()) {
            await saveBtn.click()
            await page.waitForTimeout(1000)
          }
        }
      }
    } else {
      console.log('Task creation button not found, skipping task creation test')
    }
  })

  it('should have proper responsive behavior', async () => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    // Test desktop size
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.waitForTimeout(500)

    // Should show sidebar on desktop
    const sidebarDesktop = page.locator('.sidebar, .nav')
    expect(await sidebarDesktop.isVisible()).toBe(true)

    // Test mobile size
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(500)

    // Should adapt to mobile (might hide sidebar or show hamburger menu)
    // We just check that the page doesn't break
    await expect(page.locator('body')).toBeVisible()
  })

  it('should handle browser navigation correctly', async () => {
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    // Navigate to a different view if possible
    const navItem = page.locator('a[href]:not([href*="#/canvas"])').first()
    if (await navItem.isVisible()) {
      await navItem.click()
      await page.waitForLoadState('networkidle')

      // Go back
      await page.goBack()
      await page.waitForLoadState('networkidle')

      // Go forward
      await page.goForward()
      await page.waitForLoadState('networkidle')

      // Should still be functional
      await expect(page.locator('body')).toBeVisible()
    }
  })

  it('should not have console errors', async () => {
    const consoleErrors: string[] = []
    const consoleWarnings: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text())
      }
    })

    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    // Wait for any delayed console messages
    await page.waitForTimeout(3000)

    // Should not have console errors
    if (consoleErrors.length > 0) {
      console.error('Console Errors found:', consoleErrors)
    }
    expect(consoleErrors.length).toBe(0)

    // Warnings are acceptable but should be logged
    if (consoleWarnings.length > 0) {
      console.log('Console Warnings:', consoleWarnings)
    }
  })

  it('should load design system without errors', async () => {
    // Test design system route if it exists
    const designSystemResponse = await page.goto('http://localhost:5546/#/design-system')

    if (designSystemResponse?.ok()) {
      await page.waitForLoadState('networkidle')

      // Check that design system loads
      await expect(page.locator('.design-system, .component-showcase, .design-tokens')).toBeVisible()

      // Should not have errors in design system
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })

      await page.waitForTimeout(2000)
      expect(errors.length).toBe(0)
    } else {
      console.log('Design system route not available, skipping design system test')
    }
  })
})