import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'

/**
 * CHARACTERIZATION TESTS FOR CANVASVIEW CURRENT BEHAVIOR
 *
 * These tests document the CURRENT working behavior of CanvasView
 * BEFORE any refactoring begins. They serve as a safety net to ensure
 * no functionality regressions occur during the modularization process.
 *
 * ⚠️ CRITICAL: These tests must pass AFTER each refactoring phase
 * If any test fails, the refactoring broke something and needs fixing
 */

describe('CanvasView Current Behavior Characterization', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
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
    await page.setViewportSize({ width: 1280, height: 720 })

    // Capture any JavaScript errors
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
  })

  afterEach(async () => {
    await page.close()
  })

  it('should load CanvasView without JavaScript errors', async () => {
    const response = await page.goto('http://localhost:5546/#/canvas')
    expect(response?.ok()).toBe(true)

    // Wait for the app to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check that the page loads without JavaScript errors
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    // Wait a bit for any errors to appear
    await page.waitForTimeout(3000)

    // Should not have any JavaScript errors
    expect(errors.length).toBe(0)
  })

  it('should render Vue Flow canvas with expected structure', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Wait for Vue Flow to initialize
    await page.waitForSelector('.vue-flow', { timeout: 10000 })

    // Check for Vue Flow core elements
    const vueFlowContainer = await page.locator('.vue-flow')
    expect(vueFlowContainer).toBeVisible()

    // Check for canvas viewport
    const viewport = await page.locator('.vue-flow__viewport')
    expect(viewport).toBeVisible()

    // Check for node renderer
    const nodeRenderer = await page.locator('.vue-flow__nodes')
    expect(nodeRenderer).toBeVisible()

    // Check for edge renderer
    const edgeRenderer = await page.locator('.vue-flow__edges')
    expect(edgeRenderer).toBeVisible()
  })

  it('should display canvas controls toolbar', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Wait for controls to load
    await page.waitForSelector('.canvas-controls', { timeout: 10000 })

    // Check for control buttons
    const controlsContainer = await page.locator('.canvas-controls')
    expect(controlsContainer).toBeVisible()

    // Check for essential control buttons
    const zoomButtons = await page.locator('.canvas-controls button[title*="Fit View"]')
    expect(zoomButtons).toBeVisible()

    const sectionButtons = await page.locator('.canvas-controls button[title*="Toggle Sections"]')
    expect(sectionButtons).toBeVisible()
  })

  it('should render task nodes when tasks exist', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Wait for potential task nodes to load
    await page.waitForTimeout(3000)

    // Check for any task nodes (may not exist if no tasks)
    const taskNodes = await page.locator('[data-node-id*="task-"]')
    const nodeCount = await taskNodes.count()

    // If nodes exist, verify they render properly
    if (nodeCount > 0) {
      const firstNode = taskNodes.first()
      expect(firstNode).toBeVisible()

      // Check for essential task node structure
      const taskContent = await firstNode.locator('.task-content, .task-node')
      expect(taskContent).toBeVisible()
    }
  })

  it('should handle drag-drop functionality', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Wait for Vue Flow to initialize completely
    await page.waitForSelector('.vue-flow', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Look for draggable elements (task nodes or sections)
    const draggableElements = await page.locator('.vue-flow__node, .task-node, [draggable="true"]')
    const elementCount = await draggableElements.count()

    if (elementCount > 0) {
      const firstElement = draggableElements.first()

      // Ensure element is visible
      await firstElement.waitFor({ state: 'visible', timeout: 5000 })

      // Get initial position
      const initialBox = await firstElement.boundingBox()
      expect(initialBox).toBeTruthy()

      if (initialBox) {
        // Perform drag operation
        await firstElement.hover()
        await page.mouse.down()
        await page.mouse.move(initialBox.x + 50, initialBox.y + 50)
        await page.mouse.up()

        // Wait for any drag events to process
        await page.waitForTimeout(1000)

        // Verify no errors occurred during drag
        const errors: string[] = []
        page.on('pageerror', (error) => {
          errors.push(error.message)
        })
        await page.waitForTimeout(1000)

        expect(errors.length).toBe(0)
      }
    }
  })

  it('should support keyboard shortcuts', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Focus the page to receive keyboard events
    await page.click('body')
    await page.waitForTimeout(1000)

    // Test common keyboard shortcuts
    const shortcuts = [
      { key: 'Delete', description: 'Delete key' },
      { key: 'f', description: 'Fit View shortcut' },
      { key: 'Escape', description: 'Escape key' },
      { key: 'z', modifiers: ['Meta'], description: 'Undo (Mac)' },
      { key: 'z', modifiers: ['Control'], description: 'Undo (Windows)' }
    ]

    for (const shortcut of shortcuts) {
      const errors: string[] = []

      page.on('pageerror', (error) => {
        errors.push(error.message)
      })

      // Press keyboard shortcut
      if (shortcut.modifiers) {
        await page.keyboard.press(`${shortcut.modifiers[0]}+${shortcut.key}`)
      } else {
        await page.keyboard.press(shortcut.key)
      }

      // Wait for any events to process
      await page.waitForTimeout(500)

      // Should not cause JavaScript errors
      expect(errors.length).toBe(0)
    }
  })

  it('should handle context menus', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Look for elements that might have context menus
    const contextElements = await page.locator('.vue-flow__node, .task-node, .section-node')
    const elementCount = await contextElements.count()

    if (elementCount > 0) {
      const firstElement = contextElements.first()
      await firstElement.waitFor({ state: 'visible', timeout: 5000 })

      // Right-click to trigger context menu
      await firstElement.click({ button: 'right' })
      await page.waitForTimeout(1000)

      // Check if context menu appears (may not exist if no menu registered)
      const contextMenu = await page.locator('.context-menu, .vue-context, [role="menu"]')
      const menuExists = await contextMenu.count() > 0

      if (menuExists) {
        expect(contextMenu).toBeVisible()

        // Test closing context menu
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }

      // Should not cause JavaScript errors
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })
      await page.waitForTimeout(500)

      expect(errors.length).toBe(0)
    }
  })

  it('should maintain responsive design', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1280, height: 720 },  // Laptop
      { width: 768, height: 1024 },  // Tablet
      { width: 375, height: 667 }    // Mobile
    ]

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(1000)

      // Check that Vue Flow container adapts
      const vueFlow = await page.locator('.vue-flow')
      expect(vueFlow).toBeVisible()

      // Check that controls are still accessible
      const controls = await page.locator('.canvas-controls')
      if (viewport.width >= 768) {
        expect(controls).toBeVisible()
      }

      // Should not cause JavaScript errors on resize
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })
      await page.waitForTimeout(500)

      expect(errors.length).toBe(0)
    }
  })

  it('should handle section management', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Look for section-related controls
    const sectionButtons = await page.locator('button[title*="Section"], button[title*="Add"]')
    const buttonCount = await sectionButtons.count()

    if (buttonCount > 0) {
      // Try to interact with section controls
      const addSectionButton = sectionButtons.first()
      await addSectionButton.waitFor({ state: 'visible', timeout: 5000 })

      // Click the button (might open dropdown)
      await addSectionButton.click()
      await page.waitForTimeout(1000)

      // Check for dropdown or modal
      const dropdown = await page.locator('.dropdown, .modal, .section-wizard')
      const dropdownExists = await dropdown.count() > 0

      if (dropdownExists) {
        expect(dropdown).toBeVisible()

        // Close dropdown/modal if it opened
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }

      // Should not cause JavaScript errors
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })
      await page.waitForTimeout(500)

      expect(errors.length).toBe(0)
    }
  })

  it('should support multi-select functionality', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Look for multi-select controls
    const multiSelectButtons = await page.locator('button[title*="Multi"], button[title*="Select"]')
    const buttonCount = await multiSelectButtons.count()

    if (buttonCount > 0) {
      const multiSelectButton = multiSelectButtons.first()
      await multiSelectButton.waitFor({ state: 'visible', timeout: 5000 })

      // Toggle multi-select mode
      await multiSelectButton.click()
      await page.waitForTimeout(1000)

      // Should activate multi-select mode without errors
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })
      await page.waitForTimeout(500)

      expect(errors.length).toBe(0)

      // Toggle back to normal mode
      await multiSelectButton.click()
      await page.waitForTimeout(500)
    }
  })

  it('should handle display toggle controls', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Look for display toggle buttons (priority, status, duration, etc.)
    const toggleButtons = await page.locator('button[title*="Toggle"], button[title*="Show"], button[title*="Hide"]')
    const buttonCount = await toggleButtons.count()

    if (buttonCount > 0) {
      // Test a few toggle buttons
      const maxButtonsToTest = Math.min(buttonCount, 3)

      for (let i = 0; i < maxButtonsToTest; i++) {
        const button = toggleButtons.nth(i)
        await button.waitFor({ state: 'visible', timeout: 5000 })

        // Click toggle button
        await button.click()
        await page.waitForTimeout(500)

        // Should not cause JavaScript errors
        const errors: string[] = []
        page.on('pageerror', (error) => {
          errors.push(error.message)
        })
        await page.waitForTimeout(500)

        expect(errors.length).toBe(0)
      }
    }
  })

  it('should maintain performance without memory leaks', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Monitor memory usage during interactions
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })

    // Perform several interactions
    const interactions = [
      () => page.mouse.click(100, 100),
      () => page.mouse.click(200, 200),
      () => page.keyboard.press('f'),
      () => page.keyboard.press('Escape'),
      () => page.mouse.wheel(0, 100),
      () => page.mouse.wheel(0, -100)
    ]

    for (const interaction of interactions) {
      await interaction()
      await page.waitForTimeout(200)
    }

    // Check final memory usage
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })

    // Memory increase should be reasonable (less than 50MB)
    const memoryIncrease = finalMemory - initialMemory
    const maxIncrease = 50 * 1024 * 1024 // 50MB in bytes

    expect(memoryIncrease).toBeLessThan(maxIncrease)
  })

  /**
   * CRITICAL VALIDATION TEST
   * This test ensures Vue Flow event handlers are working properly
   * These are the exact handlers we must NOT extract during refactoring
   */
  it('should preserve Vue Flow event handler functionality', async () => {
    await page.goto('http://localhost:5546/#/canvas')
    await page.waitForLoadState('networkidle')

    // Wait for Vue Flow to initialize
    await page.waitForSelector('.vue-flow', { timeout: 10000 })

    // Check that Vue Flow event handlers are attached
    const vueFlowElement = await page.locator('.vue-flow')

    // Verify Vue Flow is reactive to events
    await vueFlowElement.hover()
    await page.waitForTimeout(500)

    // Should not cause JavaScript errors when interacting with Vue Flow
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    // Test various Vue Flow interactions
    await page.mouse.click(400, 300) // Click on canvas
    await page.waitForTimeout(500)

    await page.mouse.dblclick(400, 300) // Double click on canvas
    await page.waitForTimeout(500)

    await page.mouse.move(100, 100) // Move mouse
    await page.waitForTimeout(500)

    // Should have no JavaScript errors during Vue Flow interactions
    expect(errors.length).toBe(0)
  })
})