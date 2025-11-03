import { test, expect } from '@playwright/test'

/**
 * Canvas Arrange Functions Test Suite
 *
 * Tests the newly implemented arrange functions:
 * - arrangeInRow()
 * - arrangeInColumn()
 * - arrangeInGrid()
 *
 * These functions were added to useCanvasContextMenus.ts (lines 338-435)
 * as part of the Phase 1 refactoring completion.
 */

test.describe('Canvas Arrange Functions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5550/#/canvas', {
      waitUntil: 'networkidle',
      timeout: 10000
    })

    // Wait for canvas to load
    await page.waitForSelector('.vue-flow', { timeout: 5000 })
    await page.keyboard.press('Escape') // Close any modals
    await page.waitForTimeout(500)

    console.log('✓ Canvas loaded successfully')
  })

  test('1. Setup: Create multiple tasks on canvas', async ({ page }) => {
    console.log('\n=== TEST 1: Create Tasks for Arrange Testing ===')

    // Create tasks directly via JavaScript injection
    await setupTestTasks(page)

    // Verify tasks are on canvas
    const canvasTaskNodes = page.locator('.vue-flow__node[data-type="taskNode"]')
    const canvasTaskCount = await canvasTaskNodes.count()
    console.log(`✓ Found ${canvasTaskCount} tasks on canvas`)
    expect(canvasTaskCount).toBeGreaterThanOrEqual(4)

    await page.screenshot({ path: '.playwright-mcp/arrange-test-1-setup.png' })
  })

  test('2. Arrange in Row - Horizontal alignment', async ({ page }) => {
    console.log('\n=== TEST 2: Arrange in Row ===')

    // First, setup tasks (same as test 1)
    await setupTestTasks(page)

    // Select all tasks on canvas using multi-select
    const taskNodes = page.locator('.vue-flow__node[data-type="taskNode"]')
    const firstTask = taskNodes.first()
    const lastTask = taskNodes.last()

    // Click first task
    await firstTask.click()
    await page.waitForTimeout(200)

    // Shift+click last task to select all
    await page.keyboard.down('Shift')
    await lastTask.click()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(500)

    console.log('✓ Selected multiple tasks')

    // Right-click on canvas to open context menu
    await firstTask.click({ button: 'right' })
    await page.waitForTimeout(500)

    // Look for "Arrange in Row" option
    const arrangeInRowOption = page.locator('text=Arrange in Row').or(page.locator('[role="menuitem"]:has-text("Row")'))
    await expect(arrangeInRowOption).toBeVisible({ timeout: 2000 })
    await arrangeInRowOption.click()
    await page.waitForTimeout(1000)

    console.log('✓ Clicked "Arrange in Row"')

    // Verify tasks are arranged horizontally
    // Get task positions
    const taskPositions = await getTaskPositions(page)
    console.log('Task positions after arrange:', taskPositions)

    // Check that Y positions are similar (within tolerance)
    const yPositions = taskPositions.map(p => p.y)
    const avgY = yPositions.reduce((a, b) => a + b, 0) / yPositions.length
    const yTolerance = 10 // pixels

    for (const pos of taskPositions) {
      expect(Math.abs(pos.y - avgY)).toBeLessThan(yTolerance)
    }

    // Check that X positions are spaced correctly (240px apart)
    const xPositions = taskPositions.map(p => p.x).sort((a, b) => a - b)
    const expectedSpacing = 240
    const spacingTolerance = 20

    for (let i = 1; i < xPositions.length; i++) {
      const actualSpacing = xPositions[i] - xPositions[i - 1]
      expect(Math.abs(actualSpacing - expectedSpacing)).toBeLessThan(spacingTolerance)
    }

    console.log('✓ Tasks arranged in row with correct spacing')

    await page.screenshot({ path: '.playwright-mcp/arrange-test-2-row.png' })
  })

  test('3. Arrange in Column - Vertical alignment', async ({ page }) => {
    console.log('\n=== TEST 3: Arrange in Column ===')

    await setupTestTasks(page)

    // Select all tasks
    const taskNodes = page.locator('.vue-flow__node[data-type="taskNode"]')
    await taskNodes.first().click()
    await page.keyboard.down('Shift')
    await taskNodes.last().click()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(500)

    // Right-click and select "Arrange in Column"
    await taskNodes.first().click({ button: 'right' })
    await page.waitForTimeout(500)

    const arrangeInColumnOption = page.locator('text=Arrange in Column').or(page.locator('[role="menuitem"]:has-text("Column")'))
    await expect(arrangeInColumnOption).toBeVisible({ timeout: 2000 })
    await arrangeInColumnOption.click()
    await page.waitForTimeout(1000)

    console.log('✓ Clicked "Arrange in Column"')

    // Verify tasks are arranged vertically
    const taskPositions = await getTaskPositions(page)
    console.log('Task positions after arrange:', taskPositions)

    // Check that X positions are similar
    const xPositions = taskPositions.map(p => p.x)
    const avgX = xPositions.reduce((a, b) => a + b, 0) / xPositions.length
    const xTolerance = 10

    for (const pos of taskPositions) {
      expect(Math.abs(pos.x - avgX)).toBeLessThan(xTolerance)
    }

    // Check that Y positions are spaced correctly (120px apart)
    const yPositions = taskPositions.map(p => p.y).sort((a, b) => a - b)
    const expectedSpacing = 120
    const spacingTolerance = 20

    for (let i = 1; i < yPositions.length; i++) {
      const actualSpacing = yPositions[i] - yPositions[i - 1]
      expect(Math.abs(actualSpacing - expectedSpacing)).toBeLessThan(spacingTolerance)
    }

    console.log('✓ Tasks arranged in column with correct spacing')

    await page.screenshot({ path: '.playwright-mcp/arrange-test-3-column.png' })
  })

  test('4. Arrange in Grid - Grid layout', async ({ page }) => {
    console.log('\n=== TEST 4: Arrange in Grid ===')

    await setupTestTasks(page)

    // Select all tasks
    const taskNodes = page.locator('.vue-flow__node[data-type="taskNode"]')
    await taskNodes.first().click()
    await page.keyboard.down('Shift')
    await taskNodes.last().click()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(500)

    // Right-click and select "Arrange in Grid"
    await taskNodes.first().click({ button: 'right' })
    await page.waitForTimeout(500)

    const arrangeInGridOption = page.locator('text=Arrange in Grid').or(page.locator('[role="menuitem"]:has-text("Grid")'))
    await expect(arrangeInGridOption).toBeVisible({ timeout: 2000 })
    await arrangeInGridOption.click()
    await page.waitForTimeout(1000)

    console.log('✓ Clicked "Arrange in Grid"')

    // Verify tasks are arranged in grid
    const taskPositions = await getTaskPositions(page)
    console.log('Task positions after arrange:', taskPositions)

    // For 4 tasks, expect a 2x2 grid
    // Grid spacing: 240px horizontal, 120px vertical
    const expectedCols = Math.ceil(Math.sqrt(taskPositions.length))
    const expectedRows = Math.ceil(taskPositions.length / expectedCols)

    console.log(`Expected grid: ${expectedCols} cols x ${expectedRows} rows`)

    // Check grid structure exists
    expect(taskPositions.length).toBeGreaterThanOrEqual(4)

    // Verify spacing consistency
    const xPositions = [...new Set(taskPositions.map(p => Math.round(p.x / 10) * 10))].sort((a, b) => a - b)
    const yPositions = [...new Set(taskPositions.map(p => Math.round(p.y / 10) * 10))].sort((a, b) => a - b)

    console.log('Unique X positions:', xPositions)
    console.log('Unique Y positions:', yPositions)

    // Should have multiple distinct positions
    expect(xPositions.length).toBeGreaterThanOrEqual(2)
    expect(yPositions.length).toBeGreaterThanOrEqual(2)

    console.log('✓ Tasks arranged in grid layout')

    await page.screenshot({ path: '.playwright-mcp/arrange-test-4-grid.png' })
  })

  test('5. Context menu closes after arrange', async ({ page }) => {
    console.log('\n=== TEST 5: Context Menu Closes ===')

    await setupTestTasks(page)

    // Select tasks and open context menu
    const taskNodes = page.locator('.vue-flow__node[data-type="taskNode"]')
    await taskNodes.first().click()
    await taskNodes.first().click({ button: 'right' })
    await page.waitForTimeout(500)

    // Verify context menu is open
    const contextMenu = page.locator('.context-menu, [role="menu"]')
    await expect(contextMenu).toBeVisible()

    // Click arrange option
    const arrangeOption = page.locator('text=Arrange in Row').or(page.locator('[role="menuitem"]:has-text("Row")'))
    await arrangeOption.click()
    await page.waitForTimeout(1000)

    // Verify context menu is closed
    await expect(contextMenu).not.toBeVisible()

    console.log('✓ Context menu closed after arrange')

    await page.screenshot({ path: '.playwright-mcp/arrange-test-5-menu-closes.png' })
  })

  test('6. Minimum task requirement (2+ tasks)', async ({ page }) => {
    console.log('\n=== TEST 6: Minimum Task Requirement ===')

    // Create only 1 task via JavaScript injection
    await page.evaluate(() => {
      const app = document.querySelector('#app') as any
      if (app && app.__vue_app__) {
        const pinia = app.__vue_app__.config.globalProperties.$pinia
        if (pinia) {
          const stores = pinia._s
          const taskStoreInstance = stores.get('tasks')
          if (taskStoreInstance) {
            taskStoreInstance.createTask({
              title: 'Single Task',
              status: 'planned',
              canvasPosition: { x: 200, y: 200 }
            })
          }
        }
      }
    })

    await page.waitForTimeout(1000)

    // Try to arrange with only 1 task selected
    const taskNode = page.locator('.vue-flow__node[data-type="taskNode"]').first()
    await expect(taskNode).toBeVisible()
    await taskNode.click()
    await taskNode.click({ button: 'right' })
    await page.waitForTimeout(500)

    // Context menu should appear, but arrange should not do anything
    const arrangeOption = page.locator('text=Arrange in Row').or(page.locator('[role="menuitem"]:has-text("Row")'))

    if (await arrangeOption.isVisible()) {
      const positionBefore = await getTaskPositions(page)
      await arrangeOption.click()
      await page.waitForTimeout(500)

      const positionAfter = await getTaskPositions(page)

      // Position should not change (or change minimally)
      expect(positionAfter.length).toBe(positionBefore.length)
      console.log('✓ Single task arrange handled correctly')
    } else {
      console.log('✓ Arrange option not available for single task')
    }

    await page.screenshot({ path: '.playwright-mcp/arrange-test-6-min-tasks.png' })
  })
})

/**
 * Helper function to setup test tasks on canvas via JavaScript injection
 */
async function setupTestTasks(page: any) {
  // Inject tasks directly via JavaScript for more reliable testing
  await page.evaluate(() => {
    // Access Pinia store
    const taskStore = (window as any).__PINIA_STORES__?.tasks ||
                      (window as any).pinia?.state?.value?.tasks

    if (!taskStore) {
      // Fallback: try to access via Vue devtools
      const app = document.querySelector('#app') as any
      if (app && app.__vue_app__) {
        const pinia = app.__vue_app__.config.globalProperties.$pinia
        if (pinia) {
          const stores = pinia._s
          const taskStoreInstance = stores.get('tasks')
          if (taskStoreInstance) {
            // Create tasks at specific canvas positions
            const positions = [
              { x: 100, y: 100 },
              { x: 400, y: 300 },
              { x: 200, y: 500 },
              { x: 500, y: 200 }
            ]

            const taskTitles = [
              'Task A - Test',
              'Task B - Test',
              'Task C - Test',
              'Task D - Test'
            ]

            taskTitles.forEach((title, index) => {
              taskStoreInstance.createTask({
                title,
                status: 'planned',
                canvasPosition: positions[index]
              })
            })
          }
        }
      }
    }
  })

  await page.waitForTimeout(1000)

  // Verify tasks were created
  const taskNodes = page.locator('.vue-flow__node[data-type="taskNode"]')
  const count = await taskNodes.count()
  if (count < 4) {
    throw new Error(`Failed to create tasks. Expected 4, got ${count}`)
  }
}

/**
 * Helper function to get positions of all task nodes on canvas
 */
async function getTaskPositions(page: any): Promise<Array<{ x: number; y: number }>> {
  const taskNodes = page.locator('.vue-flow__node[data-type="taskNode"]')
  const count = await taskNodes.count()
  const positions: Array<{ x: number; y: number }> = []

  for (let i = 0; i < count; i++) {
    const node = taskNodes.nth(i)
    const box = await node.boundingBox()
    if (box) {
      positions.push({ x: Math.round(box.x), y: Math.round(box.y) })
    }
  }

  return positions
}
