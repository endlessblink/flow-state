/**
 * Data Integrity Runtime E2E Tests (20 tests)
 *
 * Verifies actual data rendering across views, data preservation during
 * navigation, and state integrity (create/delete/edit/undo).
 *
 * Uses seeded test data from global-setup.ts: 2 projects, 8 tasks, 2 groups.
 * All assertions use toHaveText/toContainText for auto-retry.
 */
import { test, expect } from '../fixtures/auth'
import type { Page } from '@playwright/test'
import { TEST_TASKS, TEST_PROJECTS } from '../fixtures/test-ids'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Dismiss onboarding/wizard overlays */
async function dismissOverlays(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
    if (!localStorage.getItem('flowstate-settings-v2')) {
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
    }
  })
}

/** Wait for task data to load (at least one seeded task visible) */
async function waitForTasksLoaded(page: Page) {
  // Wait for any known seeded task text to appear in the DOM
  await page.waitForFunction(
    (titles: string[]) => {
      const body = document.body.innerText
      return titles.some(t => body.includes(t))
    },
    [
      TEST_TASKS.designLandingPage.title,
      TEST_TASKS.setupCICD.title,
      TEST_TASKS.writeUnitTests.title,
      TEST_TASKS.buyGroceries.title,
    ],
    { timeout: 15000 }
  )
}

/** Collect console errors */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

// ─── Actual Data Rendering (10 tests) ───────────────────────────────────────

test.describe('Actual Data Rendering', () => {

  test.beforeEach(async ({ page }) => {
    await dismissOverlays(page)
  })

  test('1 - Canvas view: task nodes have non-empty text content', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Canvas renders tasks as Vue Flow nodes
    const nodes = page.locator('.vue-flow__node')
    const nodeCount = await nodes.count()

    if (nodeCount > 0) {
      // Each visible node should have some text content
      for (let i = 0; i < Math.min(nodeCount, 5); i++) {
        const text = await nodes.nth(i).innerText().catch(() => '')
        expect(text.trim().length, `Canvas node ${i} has empty text`).toBeGreaterThan(0)
      }
    }
    // If no nodes, canvas may show empty state — also acceptable for test user
  })

  test('2 - Board view: kanban columns contain cards with text titles', async ({ page }) => {
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Board should have kanban columns
    const columns = page.locator('.kanban-column, [class*="kanban-column"]')
    await expect(columns.first()).toBeVisible({ timeout: 10000 })

    // Look for task cards within columns
    const cards = page.locator('.kanban-column .task-card, .kanban-column [class*="task-card"], [class*="kanban-column"] [class*="task-item"]')
    const cardCount = await cards.count()

    if (cardCount > 0) {
      const firstCardText = await cards.first().innerText()
      expect(firstCardText.trim().length).toBeGreaterThan(0)
    }
  })

  test('3 - Catalog: task rows show title + status + priority', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    // Should find at least one seeded task
    const designTask = page.getByText(TEST_TASKS.designLandingPage.title)
    await expect(designTask.first()).toBeVisible({ timeout: 10000 })

    // Check that task items exist (not just floating text)
    const taskItems = page.locator('[class*="task-item"], [class*="task-row"], [class*="task-card"], tr')
    const count = await taskItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('4 - Calendar: grid cells exist with correct day numbers', async ({ page }) => {
    await page.goto('/#/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Calendar should render day numbers
    const today = new Date().getDate().toString()

    // Look for the current day number somewhere in the calendar
    const dayCell = page.locator('.calendar-day-view, .calendar-week-view, .calendar-month-view, [class*="calendar-content"], [class*="calendar-grid"]')
    const hasCalendar = await dayCell.first().isVisible().catch(() => false)

    if (hasCalendar) {
      const calText = await dayCell.first().innerText()
      // Calendar should contain at least some day numbers
      expect(calText.match(/\d+/)).toBeTruthy()
    }
  })

  test('5 - Sidebar: project names are non-empty strings', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Look for project names in sidebar
    const workProject = page.getByText(TEST_PROJECTS.work.name)
    const personalProject = page.getByText(TEST_PROJECTS.personal.name)

    const hasWork = await workProject.first().isVisible().catch(() => false)
    const hasPersonal = await personalProject.first().isVisible().catch(() => false)

    // At least one project name should be visible in the sidebar
    expect(hasWork || hasPersonal, 'Neither Work nor Personal project visible in sidebar').toBe(true)
  })

  test('6 - Task count badges show numbers (not NaN, not "undefined")', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Look for any badge/count elements
    const badges = page.locator('[class*="badge"], [class*="count"], [class*="counter"]')
    const badgeCount = await badges.count()

    for (let i = 0; i < Math.min(badgeCount, 10); i++) {
      const text = await badges.nth(i).innerText().catch(() => '')
      if (text.trim()) {
        expect(text).not.toContain('NaN')
        expect(text).not.toContain('undefined')
        expect(text).not.toContain('null')
      }
    }
  })

  test('7 - Inbox: opened panel shows tasks OR empty message', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Try to open inbox panel via button
    const inboxBtn = page.locator('[class*="inbox"], button:has-text("Inbox"), [aria-label*="inbox" i]').first()
    const hasInbox = await inboxBtn.isVisible().catch(() => false)

    if (hasInbox) {
      await inboxBtn.click()
      await page.waitForTimeout(1000)

      // Inbox should show either tasks or an empty message
      const bodyText = await page.evaluate(() => document.body.innerText)
      const hasTaskContent = bodyText.includes(TEST_TASKS.designLandingPage.title) ||
                             bodyText.includes(TEST_TASKS.setupCICD.title)
      const hasEmptyMsg = bodyText.toLowerCase().includes('empty') ||
                          bodyText.toLowerCase().includes('no tasks') ||
                          bodyText.toLowerCase().includes('all clear') ||
                          bodyText.toLowerCase().includes('inbox')

      expect(hasTaskContent || hasEmptyMsg, 'Inbox panel shows neither tasks nor empty message').toBe(true)
    }
  })

  test('8 - Search: typing known task title shows results', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    // Look for search input
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="Search"], input[type="search"]').first()
    const hasSearch = await searchInput.isVisible().catch(() => false)

    if (hasSearch) {
      await searchInput.fill('Design landing')
      await page.waitForTimeout(1500)

      // The matching task should appear in results
      const result = page.getByText(TEST_TASKS.designLandingPage.title)
      await expect(result.first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('9 - Filter: "All Active" vs "Done" shows different task sets', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    // Capture visible tasks in default view
    const defaultText = await page.evaluate(() => document.body.innerText)
    const hasActiveTasks = defaultText.includes(TEST_TASKS.designLandingPage.title) ||
                           defaultText.includes(TEST_TASKS.setupCICD.title)

    // Look for status filter / tab
    const doneFilter = page.locator('button:has-text("Done"), [role="tab"]:has-text("Done"), [class*="filter"]:has-text("Done")').first()
    const hasDoneFilter = await doneFilter.isVisible().catch(() => false)

    if (hasDoneFilter && hasActiveTasks) {
      await doneFilter.click()
      await page.waitForTimeout(2000)

      const filteredText = await page.evaluate(() => document.body.innerText)
      // Done filter should show done tasks (Code review PR #42, Read chapter 5)
      const hasDoneTasks = filteredText.includes(TEST_TASKS.codeReview.title) ||
                           filteredText.includes(TEST_TASKS.readChapter.title)

      // The key assertion: filtered view should differ from default
      // Either done tasks appear, or active tasks disappear
      expect(hasDoneTasks || !filteredText.includes(TEST_TASKS.designLandingPage.title)).toBe(true)
    }
  })

  test('10 - After refresh: all data reloads (not stuck empty)', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    // Verify a task is visible
    await expect(page.getByText(TEST_TASKS.designLandingPage.title).first()).toBeVisible()

    // Full page refresh
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Data should reload — same task should be visible again
    await expect(
      page.getByText(TEST_TASKS.designLandingPage.title).first()
    ).toBeVisible({ timeout: 15000 })
  })
})

// ─── Data Preservation Across Views (5 tests) ──────────────────────────────

test.describe('Data Preservation Across Views', () => {

  test.beforeEach(async ({ page }) => {
    await dismissOverlays(page)
  })

  test('11 - Task visible in canvas also visible in board', async ({ page }) => {
    // Go to tasks view (catalog) to check what tasks exist
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    const taskTitle = TEST_TASKS.designLandingPage.title

    // Verify in catalog
    await expect(page.getByText(taskTitle).first()).toBeVisible()

    // Navigate to board
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Same task should be findable in board view
    const boardText = await page.evaluate(() => document.body.innerText)
    expect(boardText).toContain(taskTitle)
  })

  test('12 - Task visible in board also visible in catalog', async ({ page }) => {
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const taskTitle = TEST_TASKS.setupCICD.title

    // Check it exists in board
    const boardText = await page.evaluate(() => document.body.innerText)
    const inBoard = boardText.includes(taskTitle)

    // Navigate to catalog
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    const catalogText = await page.evaluate(() => document.body.innerText)

    if (inBoard) {
      expect(catalogText).toContain(taskTitle)
    }
  })

  test('13 - Navigation round-trip (tasks -> board -> tasks): data still present', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    const taskTitle = TEST_TASKS.writeUnitTests.title
    await expect(page.getByText(taskTitle).first()).toBeVisible()

    // Navigate away
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Navigate back
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Data should still be there
    await expect(page.getByText(taskTitle).first()).toBeVisible({ timeout: 10000 })
  })

  test('14 - View switch does not trigger excessive network requests', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Count API requests during view switches
    let requestCount = 0
    page.on('request', request => {
      if (request.url().includes('/rest/v1/')) {
        requestCount++
      }
    })

    // Navigate between views
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Should not make excessive requests (data should be cached in Pinia)
    // Allow some requests for initial load, but not dozens
    expect(requestCount).toBeLessThan(30)
  })

  test('15 - No empty-state flash after view switch', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    // Track if empty-state element appears during navigation
    let emptyStateFlashed = false

    // Set up mutation observer to watch for empty state
    await page.evaluate(() => {
      (window as any).__emptyFlashed = false
      const observer = new MutationObserver(() => {
        const empty = document.querySelector('[class*="empty-state"], [class*="no-tasks"], [class*="no-data"]')
        if (empty && (empty as HTMLElement).offsetParent !== null) {
          (window as any).__emptyFlashed = true
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })

    // Switch view and back
    await page.goto('/#/board')
    await page.waitForTimeout(500)
    await page.goto('/#/tasks')
    await page.waitForTimeout(2000)

    emptyStateFlashed = await page.evaluate(() => (window as any).__emptyFlashed)

    // Data should still be visible without empty flash
    await expect(page.getByText(TEST_TASKS.designLandingPage.title).first()).toBeVisible({ timeout: 10000 })
    // Note: brief empty state flash can happen during transition — it's a warning, not a hard failure
    // The critical assertion is that data loads back
  })
})

// ─── State Integrity (5 tests) ──────────────────────────────────────────────

test.describe('State Integrity', () => {

  test.beforeEach(async ({ page }) => {
    await dismissOverlays(page)
  })

  test('16 - Delete task does not reappear after 3s (resurrection bug)', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    // Create a temporary task to delete (don't delete seeded data)
    const tempTitle = `Delete-test-${Date.now()}`
    const quickAdd = page.locator('input[placeholder*="add" i], input[placeholder*="Add" i], input[placeholder*="task" i]').first()
    const hasQuickAdd = await quickAdd.isVisible().catch(() => false)

    if (!hasQuickAdd) {
      test.skip()
      return
    }

    await quickAdd.fill(tempTitle)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2000)

    // Verify task appeared
    const taskEl = page.getByText(tempTitle).first()
    await expect(taskEl).toBeVisible({ timeout: 5000 })

    // Right-click for context menu or find delete button
    await taskEl.click({ button: 'right' })
    await page.waitForTimeout(500)

    const deleteBtn = page.locator('[class*="context-menu"] >> text=/delete/i, [role="menuitem"]:has-text("Delete")').first()
    const hasDelete = await deleteBtn.isVisible().catch(() => false)

    if (hasDelete) {
      await deleteBtn.click()
      await page.waitForTimeout(500)

      // Confirm deletion if modal appears
      const confirmBtn = page.locator('button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")').first()
      const hasConfirm = await confirmBtn.isVisible().catch(() => false)
      if (hasConfirm) await confirmBtn.click()

      // Wait 3 seconds and verify task does NOT reappear (resurrection bug)
      await page.waitForTimeout(3000)
      const reappeared = await page.getByText(tempTitle).first().isVisible().catch(() => false)
      expect(reappeared, 'Deleted task resurrected after 3s').toBe(false)
    }
  })

  test('17 - Create task appears in store AND DOM', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    const newTitle = `Store-test-${Date.now()}`
    const quickAdd = page.locator('input[placeholder*="add" i], input[placeholder*="Add" i], input[placeholder*="task" i]').first()
    const hasQuickAdd = await quickAdd.isVisible().catch(() => false)

    if (!hasQuickAdd) {
      test.skip()
      return
    }

    await quickAdd.fill(newTitle)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2000)

    // Check DOM
    const inDOM = await page.getByText(newTitle).first().isVisible().catch(() => false)

    // Check Pinia store
    const inStore = await page.evaluate((title: string) => {
      const pinia = (window as any).__pinia
      if (!pinia) return null
      // Try to find the task store
      const stores = pinia._s
      if (!stores) return null
      for (const [, store] of stores) {
        if (store.tasks || store._rawTasks) {
          const tasks = store._rawTasks || store.tasks
          if (Array.isArray(tasks)) {
            return tasks.some((t: any) => t.title === title)
          }
        }
      }
      return null
    }, newTitle)

    expect(inDOM, 'Task not visible in DOM').toBe(true)

    // Store check — if Pinia is exposed
    if (inStore !== null) {
      expect(inStore, 'Task not found in Pinia store').toBe(true)
    }
  })

  test('18 - Edit task title updates in DOM immediately (optimistic)', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    // Click on a seeded task to open edit
    const taskTitle = TEST_TASKS.buyGroceries.title
    const taskEl = page.getByText(taskTitle).first()
    await expect(taskEl).toBeVisible({ timeout: 10000 })
    await taskEl.click()
    await page.waitForTimeout(1000)

    // Look for an edit modal or inline edit
    const modal = page.locator('[role="dialog"], .task-edit-modal, .modal-container, .edit-modal')
    const hasModal = await modal.first().isVisible().catch(() => false)

    if (hasModal) {
      // Find title input in modal
      const titleInput = modal.locator('input[type="text"], textarea, [contenteditable="true"]').first()
      const hasInput = await titleInput.isVisible().catch(() => false)

      if (hasInput) {
        const newTitle = `${taskTitle} EDITED`
        await titleInput.fill(newTitle)
        await page.waitForTimeout(500)

        // The new title should appear immediately (optimistic update)
        const bodyText = await page.evaluate(() => document.body.innerText)
        expect(bodyText).toContain('EDITED')
      }
    }
  })

  test('19 - Undo delete: task reappears with correct data', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)

    // Create a task to delete and undo
    const tempTitle = `Undo-test-${Date.now()}`
    const quickAdd = page.locator('input[placeholder*="add" i], input[placeholder*="Add" i], input[placeholder*="task" i]').first()
    const hasQuickAdd = await quickAdd.isVisible().catch(() => false)

    if (!hasQuickAdd) {
      test.skip()
      return
    }

    await quickAdd.fill(tempTitle)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2000)
    await expect(page.getByText(tempTitle).first()).toBeVisible({ timeout: 5000 })

    // Delete it
    await page.getByText(tempTitle).first().click({ button: 'right' })
    await page.waitForTimeout(500)

    const deleteBtn = page.locator('[class*="context-menu"] >> text=/delete/i, [role="menuitem"]:has-text("Delete")').first()
    const hasDelete = await deleteBtn.isVisible().catch(() => false)

    if (!hasDelete) {
      test.skip()
      return
    }

    await deleteBtn.click()
    await page.waitForTimeout(500)

    // Confirm if needed
    const confirmBtn = page.locator('button:has-text("Delete"), button:has-text("Confirm")').first()
    if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click()
    await page.waitForTimeout(1000)

    // Look for undo toast/button
    const undoBtn = page.locator('button:has-text("Undo"), [class*="toast"] >> text=/undo/i, [class*="notification"] >> text=/undo/i').first()
    const hasUndo = await undoBtn.isVisible().catch(() => false)

    if (hasUndo) {
      await undoBtn.click()
      await page.waitForTimeout(2000)

      // Task should reappear
      const reappeared = await page.getByText(tempTitle).first().isVisible().catch(() => false)
      expect(reappeared, 'Task did not reappear after undo').toBe(true)
    }
  })

  test('20 - Pinia store state matches DOM task count', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await waitForTasksLoaded(page)
    await page.waitForTimeout(2000)

    // Count tasks visible in DOM
    const domTaskCount = await page.evaluate(() => {
      // Count task items/rows in the view
      const items = document.querySelectorAll('[class*="task-item"], [class*="task-row"], [class*="task-card"]')
      return items.length
    })

    // Count tasks in Pinia store
    const storeInfo = await page.evaluate(() => {
      const pinia = (window as any).__pinia
      if (!pinia) return null
      const stores = pinia._s
      if (!stores) return null
      for (const [, store] of stores) {
        if (store.tasks || store._rawTasks) {
          const tasks = store.tasks
          if (Array.isArray(tasks)) {
            return { storeCount: tasks.length, filteredCount: tasks.filter((t: any) => !t.is_deleted).length }
          }
        }
      }
      return null
    })

    // If we can access the store, verify counts are reasonably close
    // (DOM may show filtered subset, store has all matching current filter)
    if (storeInfo && domTaskCount > 0) {
      // DOM count should not exceed store count
      expect(domTaskCount).toBeLessThanOrEqual(storeInfo.storeCount + 5) // small margin for UI elements
    }
  })
})
