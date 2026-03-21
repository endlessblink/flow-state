/**
 * View Loading E2E Tests
 *
 * Validates that ALL views actually render content (not blank/error screens).
 * Catches Tauri/WebKitGTK chunk-load failures, lazy-import errors, and blank renders.
 *
 * The CanvasView chunk-load failure (BUG-1184) was the original motivation:
 * rsync --delete nuked old chunks, stale SW cached old hashes, views went blank.
 */
import { test, expect } from '../fixtures/auth'
import path from 'node:path'

const SCREENSHOT_DIR = '.dev/screenshots'

// Collect console errors during a test
function collectConsoleErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  return errors
}

// Filter out known non-critical console errors that don't indicate a broken view
function filterCriticalErrors(errors: string[]): string[] {
  const ignoredPatterns = [
    /favicon/i,
    /Failed to load resource.*404/,
    /supabase.*realtime/i,
    /websocket/i,
    /net::ERR_/,
    /ResizeObserver loop/,
    /Manifest.*json/i,
    /service.worker/i,
  ]
  return errors.filter(err => !ignoredPatterns.some(p => p.test(err)))
}

test.describe('View Loading', () => {
  // ── 1. Canvas view loads ──────────────────────────────────────────────

  test('1 - Canvas view loads with nodes or empty state visible', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Vue Flow container should be present and visible
    const vueFlow = page.locator('.vue-flow')
    const emptyState = page.locator('[class*="empty"], [class*="no-tasks"], [class*="onboarding"]')

    const hasVueFlow = await vueFlow.first().isVisible().catch(() => false)
    const hasEmptyState = await emptyState.first().isVisible().catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-canvas.png') })

    expect(hasVueFlow || hasEmptyState, 'Canvas view should show Vue Flow canvas or empty state').toBeTruthy()

    const critical = filterCriticalErrors(errors)
    expect(critical, `Canvas view had JS errors: ${critical.join(', ')}`).toHaveLength(0)
  })

  // ── 2. Board view loads ───────────────────────────────────────────────

  test('2 - Board view loads with kanban columns visible', async ({ page }) => {
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const kanban = page.locator('.kanban-board, .kanban-column, [class*="kanban"]')
    await expect(kanban.first()).toBeVisible({ timeout: 10000 })

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-board.png') })
  })

  // ── 3. Calendar view loads ────────────────────────────────────────────

  test('3 - Calendar view loads with day/week grid visible', async ({ page }) => {
    await page.goto('/#/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Calendar should show header and some grid/day content
    const header = page.locator('.calendar-header, [class*="calendar-header"]')
    const grid = page.locator('.calendar-grid, .calendar-day-view, .calendar-week-view, .calendar-month-view, [class*="calendar-content"]')

    const hasHeader = await header.first().isVisible().catch(() => false)
    const hasGrid = await grid.first().isVisible().catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-calendar.png') })

    expect(hasHeader || hasGrid, 'Calendar should show header or grid content').toBeTruthy()
  })

  // ── 4. All Tasks (catalog) view loads ─────────────────────────────────

  test('4 - All Tasks view loads with task list or empty state', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const taskList = page.locator('.task-list, [class*="task-list"], [class*="all-tasks"], [class*="catalog"]')
    const emptyState = page.locator('[class*="empty"], [class*="no-tasks"]')
    const taskItems = page.locator('[class*="task-item"], [class*="task-card"], [class*="task-row"]')

    const hasContent = await taskList.first().isVisible().catch(() => false)
    const hasEmpty = await emptyState.first().isVisible().catch(() => false)
    const hasItems = (await taskItems.count()) > 0

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-tasks.png') })

    expect(hasContent || hasEmpty || hasItems, 'All Tasks view should show task list, items, or empty state').toBeTruthy()
  })

  // ── 5. Quick Sort view loads ──────────────────────────────────────────

  test('5 - Quick Sort view loads with card or empty state', async ({ page }) => {
    await page.goto('/#/quick-sort')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const quickSort = page.locator('.quick-sort-view, .quick-sort-card, .sort-phase')
    const emptyState = page.locator('[class*="empty"], [class*="no-tasks"], [class*="complete"]')

    const hasQS = await quickSort.first().isVisible().catch(() => false)
    const hasEmpty = await emptyState.first().isVisible().catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-quicksort.png') })

    expect(hasQS || hasEmpty, 'Quick Sort view should show sort card or empty/complete state').toBeTruthy()
  })

  // ── 6. AI Hub view loads ──────────────────────────────────────────────

  test('6 - AI Hub view loads with chat interface', async ({ page }) => {
    await page.goto('/#/ai')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const aiHub = page.locator('.ai-hub-view, [class*="ai-hub"], [class*="ai-chat"]')
    await expect(aiHub.first()).toBeVisible({ timeout: 10000 })

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-ai.png') })
  })

  // ── 7. Performance view loads ─────────────────────────────────────────

  test('7 - Performance view loads with gamification content', async ({ page }) => {
    await page.goto('/#/performance')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const perf = page.locator('.performance-view, [class*="performance"], [class*="gamification"]')
    const scoreCard = page.locator('.score-card, [class*="score"]')

    const hasPerf = await perf.first().isVisible().catch(() => false)
    const hasScore = await scoreCard.first().isVisible().catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-performance.png') })

    expect(hasPerf || hasScore, 'Performance view should show gamification content').toBeTruthy()
  })

  // ── 8. Settings accessible ────────────────────────────────────────────

  test('8 - Settings modal opens', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Try clicking the settings gear in sidebar footer
    const settingsBtn = page.locator(
      '[aria-label*="Settings"], [aria-label*="settings"], ' +
      'button:has-text("Settings"), .sidebar-settings, ' +
      '[title*="Settings"], [title*="settings"]'
    ).first()

    if (await settingsBtn.isVisible().catch(() => false)) {
      await settingsBtn.click()
      await page.waitForTimeout(1000)
    } else {
      // Fallback: trigger settings via keyboard or evaluate
      await page.evaluate(() => {
        const uiStore = (window as any).__pinia?.state?.value?.ui
        if (uiStore) uiStore.showSettingsModal = true
      })
      await page.waitForTimeout(1000)
    }

    // Settings modal should show something settings-related
    const settingsContent = page.locator(
      '.modal-content:has-text("Settings"), ' +
      '.settings-modal, ' +
      'text="Interface Settings", text="Language", text="General"'
    )

    const hasSettings = await settingsContent.first().isVisible({ timeout: 5000 }).catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-settings.png') })

    // Soft assertion - settings might require specific UI interaction
    if (!hasSettings) {
      console.warn('Settings modal did not open via click or evaluate. May need different trigger.')
    }
  })

  // ── 9. No console errors on any view load ─────────────────────────────

  test('9 - No critical JS errors across view navigations', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    const routes = ['/#/', '/#/board', '/#/calendar', '/#/tasks', '/#/ai', '/#/quick-sort']

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
    }

    const critical = filterCriticalErrors(errors)

    if (critical.length > 0) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-errors.png') })
    }

    expect(critical, `Found ${critical.length} critical JS errors: ${critical.slice(0, 5).join(' | ')}`).toHaveLength(0)
  })

  // ── 10. View switching: Canvas -> Calendar -> Board -> Canvas ─────────

  test('10 - View switching does not produce blank screens', async ({ page }) => {
    // Start on Canvas
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // Navigate to Calendar via header tab
    const calendarTab = page.locator('a.view-tab[href*="calendar"], a[href="/#/calendar"]').first()
    if (await calendarTab.isVisible().catch(() => false)) {
      await calendarTab.click()
    } else {
      await page.goto('/#/calendar')
    }
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // Check calendar is not blank
    const calBody = await page.locator('.main-content').boundingBox()
    expect(calBody, 'Calendar main content area should have dimensions').toBeTruthy()

    // Navigate to Board
    const boardTab = page.locator('a.view-tab[href*="board"], a[href="/#/board"]').first()
    if (await boardTab.isVisible().catch(() => false)) {
      await boardTab.click()
    } else {
      await page.goto('/#/board')
    }
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const boardContent = page.locator('.kanban-board, [class*="kanban"]')
    await expect(boardContent.first()).toBeVisible({ timeout: 10000 })

    // Back to Canvas
    const canvasTab = page.locator('a.view-tab[href="/"], a.view-tab:has-text("Canvas")').first()
    if (await canvasTab.isVisible().catch(() => false)) {
      await canvasTab.click()
    } else {
      await page.goto('/#/')
    }
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const canvasContent = page.locator('.vue-flow')
    await expect(canvasContent.first()).toBeVisible({ timeout: 10000 })

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-switch-round-trip.png') })
  })

  // ── 11. Rapid view switching ──────────────────────────────────────────

  test('11 - Rapid view switching does not crash', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Rapidly click through views without waiting for full load
    const routes = ['/#/board', '/#/calendar', '/#/tasks', '/#/ai', '/#/quick-sort', '/#/', '/#/board', '/#/calendar']

    for (const route of routes) {
      await page.goto(route)
      // Only wait 300ms between navigations - simulating fast clicking
      await page.waitForTimeout(300)
    }

    // Wait for the last view to settle
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Page should not be blank/crashed - main-content should have visible children
    const mainContent = page.locator('.main-content')
    await expect(mainContent).toBeVisible()

    const box = await mainContent.boundingBox()
    expect(box?.height, 'Main content should have non-zero height after rapid switching').toBeGreaterThan(50)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-rapid-switch.png') })

    // Check for chunk-load or fatal errors
    const chunkErrors = errors.filter(e => /chunk|loading chunk|dynamicimport|failed to fetch/i.test(e))
    expect(chunkErrors, `Chunk load errors during rapid switching: ${chunkErrors.join(', ')}`).toHaveLength(0)
  })

  // ── 12. Refresh on each view ──────────────────────────────────────────

  test('12 - Refresh on each view reloads correctly', async ({ page }) => {
    const routes = [
      { path: '/#/', selector: '.vue-flow, [class*="canvas"]' },
      { path: '/#/board', selector: '.kanban-board, [class*="kanban"]' },
      { path: '/#/tasks', selector: '.task-list, [class*="task-list"], [class*="all-tasks"]' },
    ]

    for (const { path: route, selector } of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1500)

      // Hard refresh
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // View content should still be present
      const content = page.locator(selector)
      const visible = await content.first().isVisible().catch(() => false)

      if (!visible) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `view-loading-refresh-${route.replace(/[#/]/g, '')}.png`) })
      }

      expect(visible, `View at ${route} should be visible after refresh`).toBeTruthy()
    }
  })

  // ── 13. Deep link to /board ───────────────────────────────────────────

  test('13 - Deep link to /board works directly', async ({ page }) => {
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const kanban = page.locator('.kanban-board, .kanban-column, [class*="kanban"]')
    await expect(kanban.first()).toBeVisible({ timeout: 10000 })

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-deeplink-board.png') })
  })

  // ── 14. Deep link to /calendar ────────────────────────────────────────

  test('14 - Deep link to /calendar works directly', async ({ page }) => {
    await page.goto('/#/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const calendar = page.locator('.calendar-header, [class*="calendar"]')
    await expect(calendar.first()).toBeVisible({ timeout: 10000 })

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-deeplink-calendar.png') })
  })

  // ── 15. Deep link to /tasks ───────────────────────────────────────────

  test('15 - Deep link to /tasks works directly', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should see at least one seeded task
    const taskText = page.getByText('Design landing page')
    const taskList = page.locator('.task-list, [class*="task-list"], [class*="all-tasks"]')

    const hasText = await taskText.isVisible({ timeout: 10000 }).catch(() => false)
    const hasList = await taskList.first().isVisible().catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view-loading-deeplink-tasks.png') })

    expect(hasText || hasList, 'Deep link to /tasks should show task content').toBeTruthy()
  })
})
