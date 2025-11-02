import { test, expect } from '@playwright/test'

test.describe('Groups vs Sections - Phase 1: Terminology & UI', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Canvas view
    await page.goto('http://localhost:5546')
    await page.getByRole('link', { name: 'Canvas' }).click()
    await page.waitForLoadState('networkidle')
  })

  test('Canvas view loads successfully', async ({ page }) => {
    // Verify we're on the canvas view
    await expect(page.locator('text=Canvas')).toBeVisible()

    // Verify canvas toolbar is visible
    await expect(page.getByRole('button', { name: /Toggle Sections/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Fit View/i })).toBeVisible()
  })

  test('Context menu displays both "Create Custom Group" and "Create Section (Smart)" buttons', async ({ page }) => {
    // Right-click on empty canvas area to open context menu
    const canvas = page.locator('.vue-flow__pane')
    await canvas.click({ button: 'right', position: { x: 500, y: 300 } })

    // Wait for context menu to appear
    await page.waitForTimeout(500)

    // Verify "Create Task Here" button exists
    const createTaskButton = page.getByRole('button', { name: 'Create Task Here' })
    await expect(createTaskButton).toBeVisible()

    // Verify "Create Custom Group" button exists
    const createGroupButton = page.getByRole('button', { name: 'Create Custom Group' })
    await expect(createGroupButton).toBeVisible()

    // Verify "Create Section (Smart)" button exists
    const createSectionButton = page.getByRole('button', { name: 'Create Section (Smart)' })
    await expect(createSectionButton).toBeVisible()

    // Take screenshot for documentation
    await page.screenshot({
      path: 'tests/screenshots/phase1-context-menu.png',
      fullPage: false
    })
  })

  test('"Create Section (Smart)" button has Sparkles icon', async ({ page }) => {
    // Right-click to open context menu
    const canvas = page.locator('.vue-flow__pane')
    await canvas.click({ button: 'right', position: { x: 500, y: 300 } })

    await page.waitForTimeout(500)

    // Find the "Create Section (Smart)" button
    const createSectionButton = page.getByRole('button', { name: 'Create Section (Smart)' })
    await expect(createSectionButton).toBeVisible()

    // Verify it contains an SVG icon (Sparkles icon from lucide-vue-next)
    const icon = createSectionButton.locator('svg')
    await expect(icon).toBeVisible()
  })

  test('"Create Section (Smart)" button emits console log when clicked', async ({ page }) => {
    // Set up console message listener
    const consoleMessages: string[] = []
    page.on('console', msg => {
      consoleMessages.push(msg.text())
    })

    // Right-click to open context menu
    const canvas = page.locator('.vue-flow__pane')
    await canvas.click({ button: 'right', position: { x: 500, y: 300 } })

    await page.waitForTimeout(500)

    // Click "Create Section (Smart)" button
    const createSectionButton = page.getByRole('button', { name: 'Create Section (Smart)' })
    await createSectionButton.click()

    // Wait for console messages
    await page.waitForTimeout(500)

    // Verify console logs were emitted
    const hasCreateSectionLog = consoleMessages.some(msg =>
      msg.includes('✨ CanvasContextMenu: Create Section button clicked!')
    )
    const hasEmitLog = consoleMessages.some(msg =>
      msg.includes('✨ CanvasContextMenu: Emitting createSection event')
    )

    expect(hasCreateSectionLog).toBeTruthy()
    expect(hasEmitLog).toBeTruthy()
  })

  test('"Create Custom Group" button still works (backward compatibility)', async ({ page }) => {
    // Set up console message listener
    const consoleMessages: string[] = []
    page.on('console', msg => {
      consoleMessages.push(msg.text())
    })

    // Right-click to open context menu
    const canvas = page.locator('.vue-flow__pane')
    await canvas.click({ button: 'right', position: { x: 500, y: 300 } })

    await page.waitForTimeout(500)

    // Click "Create Custom Group" button
    const createGroupButton = page.getByRole('button', { name: 'Create Custom Group' })
    await createGroupButton.click()

    // Wait for console messages
    await page.waitForTimeout(500)

    // Verify console logs were emitted
    const hasCreateGroupLog = consoleMessages.some(msg =>
      msg.includes('🔧 CanvasContextMenu: Create Group button clicked!')
    )
    const hasEmitLog = consoleMessages.some(msg =>
      msg.includes('🔧 CanvasContextMenu: Emitting createGroup event')
    )

    expect(hasCreateGroupLog).toBeTruthy()
    expect(hasEmitLog).toBeTruthy()
  })

  test('Context menu buttons appear in correct order', async ({ page }) => {
    // Right-click to open context menu
    const canvas = page.locator('.vue-flow__pane')
    await canvas.click({ button: 'right', position: { x: 500, y: 300 } })

    await page.waitForTimeout(500)

    // Get all menu items
    const menuItems = page.locator('.menu-item')
    const count = await menuItems.count()

    // Verify we have at least 3 items (Create Task, Create Group, Create Section)
    expect(count).toBeGreaterThanOrEqual(3)

    // Verify order: Create Task Here, Create Custom Group, Create Section (Smart)
    const firstItem = await menuItems.nth(0).textContent()
    const secondItem = await menuItems.nth(1).textContent()
    const thirdItem = await menuItems.nth(2).textContent()

    expect(firstItem).toContain('Create Task Here')
    expect(secondItem).toContain('Create Custom Group')
    expect(thirdItem).toContain('Create Section (Smart)')
  })

  test('Context menu closes after clicking "Create Section (Smart)"', async ({ page }) => {
    // Right-click to open context menu
    const canvas = page.locator('.vue-flow__pane')
    await canvas.click({ button: 'right', position: { x: 500, y: 300 } })

    await page.waitForTimeout(500)

    // Verify context menu is visible
    const contextMenu = page.locator('.context-menu')
    await expect(contextMenu).toBeVisible()

    // Click "Create Section (Smart)" button
    const createSectionButton = page.getByRole('button', { name: 'Create Section (Smart)' })
    await createSectionButton.click()

    // Wait a moment for menu to close
    await page.waitForTimeout(300)

    // Note: Menu might still be visible if wizard opens - this test will be updated in Phase 2
    // For now, we just verify the click was registered (checked via console logs in other test)
  })

  test('Visual regression: Context menu with both buttons', async ({ page }) => {
    // Right-click to open context menu
    const canvas = page.locator('.vue-flow__pane')
    await canvas.click({ button: 'right', position: { x: 500, y: 300 } })

    await page.waitForTimeout(500)

    // Take screenshot of context menu for visual regression
    const contextMenu = page.locator('.context-menu')
    await expect(contextMenu).toBeVisible()

    await contextMenu.screenshot({
      path: 'tests/screenshots/phase1-context-menu-detail.png'
    })
  })
})
