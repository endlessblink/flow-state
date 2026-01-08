import { test, expect } from '@playwright/test'

/**
 * Markdown Editor E2E Tests
 *
 * Tests for the Milkdown-based markdown editor (TASK-109, BUG-005 regression tests)
 * Tests validate: basic editing, toolbar buttons, race conditions, and performance
 */
test.describe('Markdown Editor', () => {
  let consoleErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    // Reset console error tracking
    consoleErrors = []

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Capture page errors
    page.on('pageerror', error => {
      consoleErrors.push(error.message)
    })

    // Navigate to the application
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')
  })

  /**
   * Helper to open task edit modal with markdown editor
   */
  async function openTaskEditModal(page: import('@playwright/test').Page) {
    // First create a task or find existing one to edit
    // Try to find quick add button first
    const quickAddBtn = page.locator('[data-testid="quick-add-task"], button:has-text("Add Task"), .quick-add-button').first()

    if (await quickAddBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quickAddBtn.click()
      await page.waitForTimeout(500)
    } else {
      // Fall back to creating via input
      const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="add"], .quick-task-input').first()
      if (await taskInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await taskInput.fill('Test Task for Editor')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(1000)

        // Now click to edit the task
        const taskCard = page.locator('.task-card, .task-item').filter({ hasText: 'Test Task for Editor' }).first()
        if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          await taskCard.click()
        }
      }
    }

    // Wait for editor to appear
    const editor = page.locator('.ProseMirror, .milkdown-editor, .milkdown').first()
    await editor.waitFor({ state: 'visible', timeout: 10000 })
    return editor
  }

  test('Scenario 1: Basic text editing', async ({ page }) => {
    const editor = await openTaskEditModal(page)

    // Click on editor to focus
    await editor.click()

    // Type text using pressSequentially for rich text editors
    await editor.pressSequentially('Hello world', { delay: 30 })

    // Verify content
    await expect(editor).toContainText('Hello')

    // Press Enter to create new paragraph
    await page.keyboard.press('Enter')
    await page.waitForTimeout(100)

    // Type more text
    await editor.pressSequentially('New paragraph', { delay: 30 })

    // Verify both texts appear
    await expect(editor).toContainText('Hello')
    await expect(editor).toContainText('New paragraph')

    // Filter out DevTools and extension-related errors
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('DevTools') &&
      !e.includes('Extension') &&
      !e.includes('favicon')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('Scenario 2: Bold toolbar button works', async ({ page }) => {
    const editor = await openTaskEditModal(page)
    await editor.click()

    // Type some text
    await editor.pressSequentially('Bold text', { delay: 30 })

    // Select all
    await page.keyboard.press('Control+A')

    // Find and click bold button
    const boldBtn = page.locator('button[title*="Bold"], [data-testid="toolbar-bold"], .toolbar-btn:has(svg)').first()
    if (await boldBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await boldBtn.click()
      await page.waitForTimeout(300)

      // Verify bold formatting (strong or b tag)
      const boldText = editor.locator('strong, b').first()
      await expect(boldText).toBeVisible({ timeout: 3000 })
    }

    // No console errors
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('DevTools') &&
      !e.includes('Extension')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('Scenario 3: TaskList toolbar creates checkbox', async ({ page }) => {
    const editor = await openTaskEditModal(page)
    await editor.click()

    // Find TaskList/checkbox toolbar button
    const taskListBtn = page.locator('button[title*="Task"], button[title*="Check"], [data-testid="toolbar-tasklist"]').first()

    if (await taskListBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskListBtn.click()
      await page.waitForTimeout(500)

      // Type task item text
      await editor.pressSequentially('My task item', { delay: 30 })

      // Verify checkbox was created (input[type=checkbox] or checkbox-like element)
      const checkbox = editor.locator('input[type="checkbox"], .task-list-item, [data-type="taskListItem"]').first()

      // Give it time to render
      await page.waitForTimeout(500)

      // Check that we have either checkbox or task list structure
      const hasCheckbox = await checkbox.isVisible({ timeout: 5000 }).catch(() => false)
      const hasTaskText = await editor.locator('text=[ ]').isVisible({ timeout: 1000 }).catch(() => false)

      // Either visual checkbox or markdown syntax should be present
      expect(hasCheckbox || hasTaskText).toBe(true)
    }

    // Critical: No private field access errors
    const privateFieldErrors = consoleErrors.filter(e =>
      e.includes('private') ||
      e.includes('Cannot read') ||
      e.includes('TypeError')
    )
    expect(privateFieldErrors).toHaveLength(0)
  })

  test('Scenario 4: Rapid modal open/close (race condition test)', async ({ page }) => {
    // Find any button that opens a modal with editor
    const openModalBtn = page.locator('[data-testid="quick-add-task"], button:has-text("Add"), .quick-add-button').first()

    if (!await openModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip()
      return
    }

    // Rapid open/close cycles to test race conditions
    for (let i = 0; i < 5; i++) {
      await openModalBtn.click()
      await page.waitForTimeout(50) // Less than editor init time
      await page.keyboard.press('Escape')
      await page.waitForTimeout(30)
    }

    // Final open - should still work correctly
    await openModalBtn.click()

    const editor = page.locator('.ProseMirror, .milkdown-editor').first()
    await editor.waitFor({ state: 'visible', timeout: 5000 })

    // Type and verify
    await editor.click()
    await editor.pressSequentially('Still works!', { delay: 30 })
    await expect(editor).toContainText('Still works!')

    // Critical: No private field or initialization errors
    const criticalErrors = consoleErrors.filter(e =>
      e.includes('private') ||
      e.includes('Cannot read') ||
      (e.includes('TypeError') && !e.includes('Extension'))
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('Scenario 5: Large content handling (1000+ chars)', async ({ page }) => {
    const editor = await openTaskEditModal(page)
    await editor.click()

    // Measure performance
    const startTime = Date.now()

    // Generate 1000+ chars of content
    const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20) // ~1100 chars

    // Use fill for large content (faster than pressSequentially)
    await editor.fill(content)

    const fillTime = Date.now() - startTime
    console.log(`Large content fill time: ${fillTime}ms`)

    // Should complete within 3 seconds
    expect(fillTime).toBeLessThan(3000)

    // Verify content was inserted
    await expect(editor).toContainText('Lorem ipsum')

    // No errors during large content handling
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('DevTools') &&
      !e.includes('Extension')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('No console errors on clean unmount', async ({ page }) => {
    const editor = await openTaskEditModal(page)
    await editor.click()
    await editor.pressSequentially('Test content', { delay: 30 })

    // Close modal to trigger unmount
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Filter for unmount-related errors (private field access, etc.)
    const unmountErrors = consoleErrors.filter(e =>
      e.includes('private') ||
      (e.includes('Cannot read') && e.includes('null'))
    )

    expect(unmountErrors).toHaveLength(0)
  })
})
