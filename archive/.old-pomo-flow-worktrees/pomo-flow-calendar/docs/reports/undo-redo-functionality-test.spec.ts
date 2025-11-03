import { test, expect } from '@playwright/test'

test.describe('Undo/Redo Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8888')

    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 10000 })

    // Wait for any loading states to complete
    await page.waitForTimeout(2000)

    // Open console to monitor undo/redo messages
    page.on('console', (msg) => {
      console.log('Console:', msg.type(), msg.text())
    })
  })

  test('undo/redo system initializes correctly', async ({ page }) => {
    // Check that the undo/redo system initializes
    const consoleMessages: string[] = []
    page.on('console', (msg) => {
      if (msg.text().includes('UndoRedo')) {
        consoleMessages.push(msg.text())
      }
    })

    // Wait a bit for initialization
    await page.waitForTimeout(3000)

    // Check for any undo/redo related messages
    const hasUndoRedoMessage = consoleMessages.some(msg =>
      msg.includes('UndoRedo') ||
      msg.includes('keyboard handler') ||
      msg.includes('shortcuts')
    )

    if (hasUndoRedoMessage) {
      console.log('✅ Found undo/redo initialization messages:', consoleMessages.filter(msg =>
        msg.includes('UndoRedo') ||
        msg.includes('keyboard handler') ||
        msg.includes('shortcuts')
      ))
    }

    // Should not see error messages about undo/redo not being available
    const hasUndoRedoError = consoleMessages.some(msg =>
      msg.includes('Undo/Redo system not available') ||
      msg.includes('Cannot find module')
    )

    expect(hasUndoRedoError).toBeFalsy()

    if (hasUndoRedoError) {
      console.log('❌ Found undo/redo error messages:', consoleMessages.filter(msg =>
        msg.includes('Undo/Redo system not available') ||
        msg.includes('Cannot find module')
      ))
    }
  })

  test('can create a task and undo it with Ctrl+Z', async ({ page }) => {
    // Navigate to Board view
    await page.click('[data-testid="board-view"]')
    await page.waitForTimeout(1000)

    // Get initial task count
    const initialTaskElements = await page.locator('.task-card').count()

    // Create a new task using the + button
    await page.click('[data-testid="add-task-button"]')
    await page.waitForTimeout(500)

    // Fill in task details
    await page.fill('[data-testid="task-title-input"]', 'Test Undo Task')
    await page.fill('[data-testid="task-description-input"]', 'This is a test task for undo functionality')

    // Save the task
    await page.click('[data-testid="save-task-button"]')
    await page.waitForTimeout(1000)

    // Verify task was created
    const afterCreateCount = await page.locator('.task-card').count()
    expect(afterCreateCount).toBe(initialTaskElements + 1)

    // Press Ctrl+Z to undo
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(1000)

    // Verify task was undone
    const afterUndoCount = await page.locator('.task-card').count()
    expect(afterUndoCount).toBe(initialTaskElements)
  })

  test('can redo a task with Ctrl+Shift+Z', async ({ page }) => {
    // Navigate to Board view
    await page.click('[data-testid="board-view"]')
    await page.waitForTimeout(1000)

    // Get initial task count
    const initialTaskElements = await page.locator('.task-card').count()

    // Create a new task
    await page.click('[data-testid="add-task-button"]')
    await page.waitForTimeout(500)

    await page.fill('[data-testid="task-title-input"]', 'Test Redo Task')
    await page.fill('[data-testid="task-description-input"]', 'This is a test task for redo functionality')

    await page.click('[data-testid="save-task-button"]')
    await page.waitForTimeout(1000)

    // Verify task was created
    const afterCreateCount = await page.locator('.task-card').count()
    expect(afterCreateCount).toBe(initialTaskElements + 1)

    // Press Ctrl+Z to undo
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(1000)

    // Verify task was undone
    const afterUndoCount = await page.locator('.task-card').count()
    expect(afterUndoCount).toBe(initialTaskElements)

    // Press Ctrl+Shift+Z to redo
    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(1000)

    // Verify task was redone
    const afterRedoCount = await page.locator('.task-card').count()
    expect(afterRedoCount).toBe(initialTaskElements + 1)
  })

  test('can redo with Ctrl+Y alternative shortcut', async ({ page }) => {
    // Navigate to Board view
    await page.click('[data-testid="board-view"]')
    await page.waitForTimeout(1000)

    // Get initial task count
    const initialTaskElements = await page.locator('.task-card').count()

    // Create a new task
    await page.click('[data-testid="add-task-button"]')
    await page.waitForTimeout(500)

    await page.fill('[data-testid="task-title-input"]', 'Test Ctrl+Y Redo')
    await page.fill('[data-testid="task-description-input"]', 'This tests Ctrl+Y redo functionality')

    await page.click('[data-testid="save-task-button"]')
    await page.waitForTimeout(1000)

    // Verify task was created
    const afterCreateCount = await page.locator('.task-card').count()
    expect(afterCreateCount).toBe(initialTaskElements + 1)

    // Press Ctrl+Z to undo
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(1000)

    // Verify task was undone
    const afterUndoCount = await page.locator('.task-card').count()
    expect(afterUndoCount).toBe(initialTaskElements)

    // Press Ctrl+Y to redo
    await page.keyboard.press('Control+y')
    await page.waitForTimeout(1000)

    // Verify task was redone
    const afterRedoCount = await page.locator('.task-card').count()
    expect(afterRedoCount).toBe(initialTaskElements + 1)
  })

  test('multiple undo/redo operations work correctly', async ({ page }) => {
    // Navigate to Board view
    await page.click('[data-testid="board-view"]')
    await page.waitForTimeout(1000)

    // Get initial task count
    const initialTaskElements = await page.locator('.task-card').count()

    // Create multiple tasks
    const tasksToCreate = ['Task 1', 'Task 2', 'Task 3']

    for (const taskTitle of tasksToCreate) {
      await page.click('[data-testid="add-task-button"]')
      await page.waitForTimeout(500)

      await page.fill('[data-testid="task-title-input"]', taskTitle)
      await page.fill('[data-testid="task-description-input"]', `Description for ${taskTitle}`)

      await page.click('[data-testid="save-task-button"]')
      await page.waitForTimeout(1000)
    }

    // Verify all tasks were created
    const afterCreateCount = await page.locator('.task-card').count()
    expect(afterCreateCount).toBe(initialTaskElements + tasksToCreate.length)

    // Undo all tasks one by one
    for (let i = 0; i < tasksToCreate.length; i++) {
      await page.keyboard.press('Control+z')
      await page.waitForTimeout(1000)

      const currentCount = await page.locator('.task-card').count()
      expect(currentCount).toBe(initialTaskElements + tasksToCreate.length - i - 1)
    }

    // Redo all tasks one by one
    for (let i = 0; i < tasksToCreate.length; i++) {
      await page.keyboard.press('Control+Shift+z')
      await page.waitForTimeout(1000)

      const currentCount = await page.locator('.task-card').count()
      expect(currentCount).toBe(initialTaskElements + i + 1)
    }

    // Final verification - all tasks should be restored
    const finalCount = await page.locator('.task-card').count()
    expect(finalCount).toBe(initialTaskElements + tasksToCreate.length)
  })

  test('undo/redo works with task editing', async ({ page }) => {
    // Navigate to Board view
    await page.click('[data-testid="board-view"]')
    await page.waitForTimeout(1000)

    // Create a task first
    await page.click('[data-testid="add-task-button"]')
    await page.waitForTimeout(500)

    await page.fill('[data-testid="task-title-input"]', 'Original Task Title')
    await page.fill('[data-testid="task-description-input"]', 'Original description')

    await page.click('[data-testid="save-task-button"]')
    await page.waitForTimeout(1000)

    // Find and edit the task
    const taskCard = page.locator('.task-card').first()
    await taskCard.click()
    await page.waitForTimeout(500)

    // Edit the task title
    const titleInput = page.locator('[data-testid="task-title-input"]')
    await titleInput.clear()
    await titleInput.fill('Modified Task Title')

    // Save the edit
    await page.click('[data-testid="save-task-button"]')
    await page.waitForTimeout(1000)

    // Verify the change
    expect(await taskCard.locator('h3').textContent()).toContain('Modified Task Title')

    // Undo the edit
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(1000)

    // Verify original title is restored
    expect(await taskCard.locator('h3').textContent()).toContain('Original Task Title')

    // Redo the edit
    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(1000)

    // Verify modified title is restored
    expect(await taskCard.locator('h3').textContent()).toContain('Modified Task Title')
  })

  test('undo/redo console messages appear correctly', async ({ page }) => {
    const consoleMessages: string[] = []
    page.on('console', (msg) => {
      if (msg.text().includes('UndoRedo')) {
        consoleMessages.push(msg.text())
      }
    })

    // Navigate to Board view
    await page.click('[data-testid="board-view"]')
    await page.waitForTimeout(1000)

    // Create a task
    await page.click('[data-testid="add-task-button"]')
    await page.waitForTimeout(500)

    await page.fill('[data-testid="task-title-input"]', 'Console Test Task')
    await page.click('[data-testid="save-task-button"]')
    await page.waitForTimeout(1000)

    // Check for executed message
    expect(consoleMessages.some(msg =>
      msg.includes('Executed')
    )).toBeTruthy()

    // Undo the task
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(1000)

    // Check for undo messages
    expect(consoleMessages.some(msg =>
      msg.includes('Undid')
    )).toBeTruthy()
    expect(consoleMessages.some(msg =>
      msg.includes('Undo shortcut triggered')
    )).toBeTruthy()

    // Redo the task
    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(1000)

    // Check for redo messages
    expect(consoleMessages.some(msg =>
      msg.includes('Redid')
    )).toBeTruthy()
    expect(consoleMessages.some(msg =>
      msg.includes('Redo shortcut triggered')
    )).toBeTruthy()
  })
})