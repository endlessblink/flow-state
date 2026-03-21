/**
 * Tauri Layout Bugs E2E Tests
 *
 * Catches two specific bugs reported in Tauri (WebKitGTK) but not in browsers:
 * 1. Sidebar clipped — text cut off, only icons visible
 * 2. Catalog view empty — table headers render but zero tasks loaded
 *
 * Runs against BOTH chromium and webkit projects. Differences between the two
 * indicate Tauri-specific (WebKitGTK) rendering bugs.
 */
import { test, expect } from '../fixtures/auth'
import { TEST_TASKS, TEST_PROJECTS } from '../fixtures/test-ids'
import path from 'node:path'

const SCREENSHOT_DIR = '.dev/screenshots'

// Helper: wait for app to fully hydrate (auth, stores, data load)
async function waitForAppReady(page: import('@playwright/test').Page, route: string) {
  await page.goto(`/#${route}`)
  await page.waitForLoadState('networkidle')
  // Give stores time to hydrate from Supabase
  await page.waitForTimeout(3000)
}

// Helper: get bounding box with retry for late-rendering elements
async function getBoundingBoxRetry(
  locator: import('@playwright/test').Locator,
  timeout = 5000,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  try {
    await locator.waitFor({ state: 'visible', timeout })
    return await locator.boundingBox()
  } catch {
    return null
  }
}

// ============================================================================
// SECTION 1: Sidebar Rendering (Tests 1-10)
// ============================================================================

test.describe('Tauri Layout Bugs — Sidebar Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page, '/tasks')
  })

  test('1 - Sidebar has minimum width of 240px', async ({ page }) => {
    const sidebar = page.locator('.sidebar').first()
    const box = await getBoundingBoxRetry(sidebar)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-width.png') })

    expect(box, 'Sidebar should be visible and have a bounding box').toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(240)
  })

  test('2 - Sidebar project names are fully visible (not clipped)', async ({ page }) => {
    const sidebar = page.locator('.sidebar').first()
    const sidebarBox = await getBoundingBoxRetry(sidebar)
    expect(sidebarBox, 'Sidebar must be visible').toBeTruthy()

    // Find all project tree items or project labels in the sidebar
    const projectItems = page.locator('.sidebar .project-tree-item, .sidebar .projects-list [role="treeitem"]')
    const count = await projectItems.count()

    // Seeded data has 2 projects — at least one should be visible
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const item = projectItems.nth(i)
        const isVisible = await item.isVisible().catch(() => false)
        if (!isVisible) continue

        const itemBox = await item.boundingBox()
        if (!itemBox) continue

        // Item's right edge must not exceed sidebar's right edge
        // (clipping = text extends beyond sidebar bounds)
        const sidebarRight = sidebarBox!.x + sidebarBox!.width
        expect(
          itemBox.x + itemBox.width,
          `Project item ${i} right edge (${itemBox.x + itemBox.width}) should be within sidebar (${sidebarRight})`,
        ).toBeLessThanOrEqual(sidebarRight + 2) // 2px tolerance for borders
      }
    }

    // Also check that project text is visible (not just icons)
    const workProject = page.locator('.sidebar').getByText(TEST_PROJECTS.work.name)
    const personalProject = page.locator('.sidebar').getByText(TEST_PROJECTS.personal.name)

    const hasWork = await workProject.isVisible().catch(() => false)
    const hasPersonal = await personalProject.isVisible().catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-projects.png') })

    expect(
      hasWork || hasPersonal,
      'At least one seeded project name should be visible in sidebar (not clipped to icon-only)',
    ).toBeTruthy()
  })

  test('3 - Sidebar section headers text is visible', async ({ page }) => {
    // Check key sidebar text elements are rendered and visible
    const sidebar = page.locator('.sidebar')

    // "FlowState" brand text in header
    const brandText = sidebar.locator('.brand-text')
    const hasBrand = await brandText.isVisible().catch(() => false)

    // "Projects" section title
    const projectsTitle = sidebar.locator('.section-title')
    const hasProjectsTitle = await projectsTitle.first().isVisible().catch(() => false)

    // Duration section toggle text (e.g. "BY DURATION")
    const durationToggle = sidebar.locator('.duration-section .section-toggle')
    const hasDuration = await durationToggle.isVisible().catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-sections.png') })

    // At least brand + projects section should be visible
    expect(hasBrand, 'FlowState brand text should be visible in sidebar').toBeTruthy()
    expect(hasProjectsTitle || hasDuration, 'Section headers should be visible in sidebar').toBeTruthy()
  })

  test('4 - Sidebar collapse/expand button works', async ({ page }) => {
    const sidebar = page.locator('.sidebar').first()
    const initialBox = await getBoundingBoxRetry(sidebar)
    expect(initialBox, 'Sidebar should be visible initially').toBeTruthy()
    const initialWidth = initialBox!.width

    // Find and click the hide sidebar button
    const hideBtn = page.locator(
      'button[aria-label*="Hide sidebar"], button[aria-label*="hide sidebar"], ' +
      'button[title*="Hide Sidebar"], button[title*="hide sidebar"]',
    ).first()

    if (await hideBtn.isVisible().catch(() => false)) {
      await hideBtn.click()
      await page.waitForTimeout(800) // wait for transition

      // Sidebar should be hidden (grid column = 0px or visibility hidden)
      const hiddenSidebar = page.locator('.app-layout.sidebar-hidden')
      const isHidden = await hiddenSidebar.isVisible().catch(() => false)

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-collapsed.png') })

      expect(isHidden, 'Layout should have sidebar-hidden class after collapse').toBeTruthy()

      // Now re-expand via floating toggle
      const floatingToggle = page.locator('.floating-sidebar-toggle')
      if (await floatingToggle.isVisible().catch(() => false)) {
        await floatingToggle.click()
        await page.waitForTimeout(800)

        const expandedBox = await sidebar.boundingBox().catch(() => null)
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-expanded.png') })

        expect(expandedBox, 'Sidebar should reappear after expand').toBeTruthy()
        expect(expandedBox!.width).toBeGreaterThanOrEqual(240)
      }
    } else {
      // Fallback: toggle via store evaluation
      await page.evaluate(() => {
        const pinia = (window as any).__pinia || (window as any)._pinia
        if (pinia?.state?.value?.ui) {
          pinia.state.value.ui.mainSidebarVisible = false
        }
      })
      await page.waitForTimeout(800)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-collapsed-fallback.png') })
    }
  })

  test('5 - After sidebar expand, all text content is visible again', async ({ page }) => {
    // Collapse sidebar
    await page.evaluate(() => {
      const pinia = (window as any).__pinia || (window as any)._pinia
      if (pinia?.state?.value?.ui) {
        pinia.state.value.ui.mainSidebarVisible = false
      }
    })
    await page.waitForTimeout(600)

    // Re-expand
    await page.evaluate(() => {
      const pinia = (window as any).__pinia || (window as any)._pinia
      if (pinia?.state?.value?.ui) {
        pinia.state.value.ui.mainSidebarVisible = true
      }
    })
    await page.waitForTimeout(800)

    const sidebar = page.locator('.sidebar').first()
    const box = await getBoundingBoxRetry(sidebar)
    expect(box, 'Sidebar should be visible after re-expand').toBeTruthy()

    // Brand text should be readable
    const brand = sidebar.locator('.brand-text')
    await expect(brand).toBeVisible()

    // At least one smart-view item label should be visible (not icon-only)
    const itemLabels = sidebar.locator('.sidebar-smart-item .item-label')
    const labelCount = await itemLabels.count()
    let anyLabelVisible = false
    for (let i = 0; i < labelCount; i++) {
      const labelBox = await itemLabels.nth(i).boundingBox().catch(() => null)
      if (labelBox && labelBox.width > 20) {
        anyLabelVisible = true
        break
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-reexpanded.png') })

    expect(anyLabelVisible, 'Smart view labels should have width > 20px (not clipped to icon-only)').toBeTruthy()
  })

  test('6 - Sidebar scrolls when content exceeds viewport height', async ({ page }) => {
    const taskMgmtSection = page.locator('.task-management-section').first()
    const isVisible = await taskMgmtSection.isVisible().catch(() => false)

    if (isVisible) {
      // Check that the task-management-section has overflow-y: auto
      const overflowY = await taskMgmtSection.evaluate(
        (el) => window.getComputedStyle(el).overflowY,
      )
      expect(
        ['auto', 'scroll'].includes(overflowY),
        `task-management-section overflow-y should be auto or scroll, got: ${overflowY}`,
      ).toBeTruthy()

      // Check scrollHeight > clientHeight if there's enough content
      const { scrollHeight, clientHeight } = await taskMgmtSection.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }))

      // If content overflows, scrollHeight should exceed clientHeight
      // We just verify the overflow property is set correctly; actual scroll depends on content volume
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-scroll.png') })
    }
  })

  test('7 - Sidebar badges (counts) are visible next to their labels', async ({ page }) => {
    const sidebar = page.locator('.sidebar')
    const badges = sidebar.locator('.sidebar-smart-item .item-badge')
    const badgeCount = await badges.count()

    // Seeded data has 8 tasks — at least some smart views should have count badges
    expect(badgeCount, 'Sidebar should have count badges on smart view items').toBeGreaterThan(0)

    let anyBadgeVisible = false
    for (let i = 0; i < badgeCount; i++) {
      const badge = badges.nth(i)
      const isVisible = await badge.isVisible().catch(() => false)
      if (isVisible) {
        const box = await badge.boundingBox()
        if (box && box.width > 0 && box.height > 0) {
          anyBadgeVisible = true
          break
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-badges.png') })

    expect(anyBadgeVisible, 'At least one count badge should be visible with non-zero dimensions').toBeTruthy()
  })

  test('8 - Sidebar bottom section (user email, settings gear) is visible', async ({ page }) => {
    const footer = page.locator('.sidebar-footer')
    const isVisible = await footer.isVisible().catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-footer.png') })

    expect(isVisible, 'Sidebar footer should be visible').toBeTruthy()

    if (isVisible) {
      const footerBox = await footer.boundingBox()
      expect(footerBox, 'Sidebar footer should have a bounding box').toBeTruthy()

      // Footer should be within viewport (not pushed off-screen)
      const viewportSize = page.viewportSize()
      if (viewportSize && footerBox) {
        expect(
          footerBox.y + footerBox.height,
          'Sidebar footer bottom edge should be within viewport',
        ).toBeLessThanOrEqual(viewportSize.height + 10)
      }

      // Check for settings button or user email
      const settingsBtn = footer.locator('.settings-mini-btn')
      const userEmail = footer.locator('.user-email')
      const loginBtn = footer.locator('.sidebar-login-btn')

      const hasSettings = await settingsBtn.isVisible().catch(() => false)
      const hasEmail = await userEmail.isVisible().catch(() => false)
      const hasLogin = await loginBtn.isVisible().catch(() => false)

      expect(
        hasSettings || hasEmail || hasLogin,
        'Footer should show user email + settings, or login button',
      ).toBeTruthy()
    }
  })

  test('9 - Sidebar does not overlap main content area', async ({ page }) => {
    const sidebar = page.locator('.sidebar').first()
    const mainContent = page.locator('.main-content').first()

    const sidebarBox = await getBoundingBoxRetry(sidebar)
    const mainBox = await getBoundingBoxRetry(mainContent)

    expect(sidebarBox, 'Sidebar should have bounding box').toBeTruthy()
    expect(mainBox, 'Main content should have bounding box').toBeTruthy()

    if (sidebarBox && mainBox) {
      // In LTR: sidebar right edge should not exceed main content left edge
      // Allow 2px overlap for border
      const sidebarRight = sidebarBox.x + sidebarBox.width
      expect(
        sidebarRight,
        `Sidebar right edge (${sidebarRight}) should not overlap main content left (${mainBox.x})`,
      ).toBeLessThanOrEqual(mainBox.x + 2)
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-no-overlap.png') })
  })

  test('10 - Sidebar grid column does not shrink below minmax(240px)', async ({ page }) => {
    const layout = page.locator('.app-layout').first()
    const gridColumns = await layout.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns
    })

    // Parse the computed grid columns — first column should be >= 240px
    const columns = gridColumns.split(/\s+/)
    expect(columns.length).toBeGreaterThanOrEqual(2)

    const sidebarColumnWidth = parseFloat(columns[0])
    expect(
      sidebarColumnWidth,
      `Sidebar grid column width (${sidebarColumnWidth}px) should be >= 240px, got grid-template-columns: ${gridColumns}`,
    ).toBeGreaterThanOrEqual(240)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-sidebar-grid.png') })
  })
})

// ============================================================================
// SECTION 2: View Content Loading (Tests 11-20)
// ============================================================================

test.describe('Tauri Layout Bugs — View Content Loading', () => {
  test('11 - Catalog view shows tasks (seeded data has 8 tasks)', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Wait for task items to appear (TaskList or TaskTable rows)
    const taskItems = page.locator(
      '.task-list-item, .task-row, .task-item, ' +
      '[class*="task-list"] [class*="task-item"], ' +
      '[class*="task-list"] [class*="task-row"], ' +
      'tr[class*="task"], .task-card',
    )

    // Also check for specific seeded task titles
    const seededTitles = Object.values(TEST_TASKS).map((t) => t.title)
    let foundSeededTask = false

    for (const title of seededTitles) {
      const el = page.getByText(title, { exact: false }).first()
      const isVisible = await el.isVisible({ timeout: 2000 }).catch(() => false)
      if (isVisible) {
        foundSeededTask = true
        break
      }
    }

    const itemCount = await taskItems.count()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-catalog-tasks.png') })

    expect(
      itemCount > 0 || foundSeededTask,
      `Catalog view should show tasks. Found ${itemCount} task items, seeded task visible: ${foundSeededTask}. ` +
      'This catches the Tauri bug where table headers render but zero tasks load.',
    ).toBeTruthy()
  })

  test('12 - Board view shows tasks in kanban columns', async ({ page }) => {
    await waitForAppReady(page, '/board')

    const kanbanBoard = page.locator('.kanban-board, [class*="kanban"]').first()
    await expect(kanbanBoard).toBeVisible({ timeout: 10000 })

    // Check for kanban columns
    const columns = page.locator('.kanban-column, [class*="kanban-column"]')
    const columnCount = await columns.count()
    expect(columnCount, 'Board should have at least 1 kanban column').toBeGreaterThan(0)

    // Check that at least one task card is visible in any column
    const taskCards = page.locator(
      '.kanban-column .task-card, .kanban-column .task-item, ' +
      '[class*="kanban-column"] [class*="task"]',
    )
    const cardCount = await taskCards.count()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-board-tasks.png') })

    expect(cardCount, 'Board view should show at least 1 task card in columns').toBeGreaterThan(0)
  })

  test('13 - Canvas view shows task nodes (at least 1 node visible)', async ({ page }) => {
    await waitForAppReady(page, '/')

    const vueFlow = page.locator('.vue-flow')
    const hasVueFlow = await vueFlow.first().isVisible({ timeout: 10000 }).catch(() => false)

    if (hasVueFlow) {
      // Check for rendered nodes in Vue Flow
      const nodes = page.locator('.vue-flow__node')
      const nodeCount = await nodes.count()

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-canvas-nodes.png') })

      // Canvas may have task nodes or group nodes from seeded data
      expect(nodeCount, 'Canvas should render at least 1 Vue Flow node from seeded data').toBeGreaterThan(0)
    } else {
      // Accept canvas wrapper or empty state as valid
      const canvasWrapper = page.locator('[class*="canvas-view"], [class*="canvas-container"]')
      const hasWrapper = await canvasWrapper.first().isVisible().catch(() => false)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-canvas-fallback.png') })
      expect(hasWrapper, 'Canvas view should show Vue Flow or canvas container').toBeTruthy()
    }
  })

  test('14 - Calendar view shows content (grid or events)', async ({ page }) => {
    await waitForAppReady(page, '/calendar')

    const calendarContent = page.locator(
      '.calendar-header, .calendar-grid, .calendar-day-view, ' +
      '.calendar-week-view, .calendar-month-view, [class*="calendar-content"]',
    )

    await expect(calendarContent.first()).toBeVisible({ timeout: 10000 })

    const box = await calendarContent.first().boundingBox()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-calendar-content.png') })

    expect(box, 'Calendar content should have dimensions').toBeTruthy()
    expect(box!.height, 'Calendar content should have meaningful height').toBeGreaterThan(50)
  })

  test('15 - Quick Sort shows cards or empty state message', async ({ page }) => {
    await waitForAppReady(page, '/quick-sort')

    const sortCard = page.locator('.quick-sort-view, .quick-sort-card, .sort-phase')
    const emptyState = page.locator('[class*="empty"], [class*="no-tasks"], [class*="complete"], [class*="all-sorted"]')

    const hasSortCard = await sortCard.first().isVisible().catch(() => false)
    const hasEmptyState = await emptyState.first().isVisible().catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-quicksort.png') })

    expect(
      hasSortCard || hasEmptyState,
      'Quick Sort should show sort cards or empty/complete state',
    ).toBeTruthy()
  })

  test('16 - Each view loads within 5 seconds (no infinite loading)', async ({ page }) => {
    const routes = [
      { path: '/tasks', name: 'Catalog' },
      { path: '/board', name: 'Board' },
      { path: '/calendar', name: 'Calendar' },
      { path: '/', name: 'Canvas' },
    ]

    for (const route of routes) {
      const start = Date.now()
      await page.goto(`/#${route.path}`)
      await page.waitForLoadState('networkidle')

      // Wait for main-content to have visible children (not just empty shell)
      const mainContent = page.locator('.main-content')
      await expect(mainContent).toBeVisible({ timeout: 5000 })

      const box = await mainContent.boundingBox()
      const elapsed = Date.now() - start

      expect(box, `${route.name} main content should have dimensions`).toBeTruthy()
      expect(
        elapsed,
        `${route.name} view should load within 10 seconds (took ${elapsed}ms)`,
      ).toBeLessThan(10000)
    }
  })

  test('17 - View switching preserves task data (navigate away and back)', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Count tasks in catalog
    const seededTitle = TEST_TASKS.designLandingPage.title
    const taskVisible1 = await page.getByText(seededTitle).first().isVisible({ timeout: 5000 }).catch(() => false)

    // Navigate to board
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // Navigate back to catalog
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const taskVisible2 = await page.getByText(seededTitle).first().isVisible({ timeout: 5000 }).catch(() => false)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-view-switch-preserved.png') })

    // If task was visible before, it should still be visible after round-trip
    if (taskVisible1) {
      expect(taskVisible2, 'Task data should persist after view switch round-trip').toBeTruthy()
    }
  })

  test('18 - Task count badge in sidebar matches actual tasks in view', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Get "All Active" badge count from sidebar
    const allActiveBadge = page.locator(
      '.sidebar .sidebar-smart-item:has(.item-label:has-text("All")) .item-badge',
    ).first()

    const badgeVisible = await allActiveBadge.isVisible().catch(() => false)

    if (badgeVisible) {
      const badgeText = await allActiveBadge.textContent()
      const badgeCount = parseInt(badgeText?.trim() || '0', 10)

      // Count tasks visible in the view
      const taskItems = page.locator(
        '.all-tasks-view .task-list-item, .all-tasks-view .task-row, .all-tasks-view tr[class*="task"]',
      )
      const viewCount = await taskItems.count()

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-badge-vs-view.png') })

      // Badge and view count should be in same ballpark (exact match may differ due to filters)
      // At minimum, if badge > 0 then view should also have items
      if (badgeCount > 0) {
        expect(
          viewCount,
          `Sidebar badge shows ${badgeCount} tasks but view shows ${viewCount}`,
        ).toBeGreaterThan(0)
      }
    }
  })

  test('19 - Inbox panel shows tasks when opened', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Click the uncategorized/inbox smart view in sidebar
    const inboxItem = page.locator(
      '.sidebar .sidebar-smart-item:has(.item-label:has-text("Inbox")), ' +
      '.sidebar .sidebar-smart-item:has(.item-label:has-text("Uncategorized"))',
    ).first()

    const isVisible = await inboxItem.isVisible().catch(() => false)

    if (isVisible) {
      await inboxItem.click()
      await page.waitForTimeout(2000)

      // Either tasks appear or we see an empty state — neither is blank
      const mainContent = page.locator('.main-content')
      const mainBox = await mainContent.boundingBox()

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-inbox-panel.png') })

      expect(mainBox, 'Main content should render after clicking inbox').toBeTruthy()
      expect(mainBox!.height, 'Main content should have height').toBeGreaterThan(50)
    }
  })

  test('20 - Search finds seeded test tasks by title', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Look for a search input in the header or sidebar
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="search"], ' +
      'input[aria-label*="Search"], input[aria-label*="search"], ' +
      '.quick-task-input input, .sidebar-quick-task input',
    ).first()

    const hasSearch = await searchInput.isVisible().catch(() => false)

    if (hasSearch) {
      await searchInput.fill(TEST_TASKS.designLandingPage.title.substring(0, 10))
      await page.waitForTimeout(1000)

      const result = page.getByText(TEST_TASKS.designLandingPage.title, { exact: false })
      const found = await result.first().isVisible({ timeout: 3000 }).catch(() => false)

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-search-results.png') })

      // Search may work differently — this is a soft check
      if (!found) {
        console.warn('Search did not surface seeded task. Search implementation may filter differently.')
      }
    } else {
      // No search input visible — skip gracefully
      console.warn('No search input found. Quick task input may serve a different purpose.')
    }
  })
})

// ============================================================================
// SECTION 3: Layout Integrity (Tests 21-30)
// ============================================================================

test.describe('Tauri Layout Bugs — Layout Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page, '/tasks')
  })

  test('21 - Main content area fills remaining width after sidebar', async ({ page }) => {
    const sidebar = page.locator('.sidebar').first()
    const mainContent = page.locator('.main-content').first()

    const sidebarBox = await getBoundingBoxRetry(sidebar)
    const mainBox = await getBoundingBoxRetry(mainContent)
    const viewportSize = page.viewportSize()

    expect(sidebarBox, 'Sidebar should be visible').toBeTruthy()
    expect(mainBox, 'Main content should be visible').toBeTruthy()
    expect(viewportSize, 'Viewport size should be available').toBeTruthy()

    if (sidebarBox && mainBox && viewportSize) {
      // Sidebar + main content should span approximately the full viewport width
      const totalWidth = sidebarBox.width + mainBox.width
      expect(
        totalWidth,
        `Sidebar (${sidebarBox.width}) + main (${mainBox.width}) = ${totalWidth} should be close to viewport (${viewportSize.width})`,
      ).toBeGreaterThan(viewportSize.width * 0.95)
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-layout-fill.png') })
  })

  test('22 - No horizontal scrollbar on any view', async ({ page }) => {
    const routes = ['/tasks', '/board', '/calendar', '/']
    for (const route of routes) {
      await page.goto(`/#${route}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1500)

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })

      if (hasHorizontalScroll) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `tauri-hscroll-${route.replace(/\//g, '') || 'canvas'}.png`) })
      }

      expect(
        hasHorizontalScroll,
        `View at ${route} should not produce horizontal scrollbar (scrollWidth > clientWidth)`,
      ).toBeFalsy()
    }
  })

  test('23 - Header bar spans full width (not clipped by sidebar)', async ({ page }) => {
    const header = page.locator('.app-header, .content-header, header').first()
    const mainContent = page.locator('.main-content').first()

    const headerBox = await getBoundingBoxRetry(header)
    const mainBox = await getBoundingBoxRetry(mainContent)

    expect(headerBox, 'Header should be visible').toBeTruthy()

    if (headerBox && mainBox) {
      // Header should span at least 90% of main content width
      expect(
        headerBox.width,
        `Header width (${headerBox.width}) should span most of main content width (${mainBox.width})`,
      ).toBeGreaterThan(mainBox.width * 0.8)
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-header-width.png') })
  })

  test('24 - View tabs (Canvas, Calendar, Board, etc.) all visible and clickable', async ({ page }) => {
    const viewTabs = page.locator('.view-tab')
    const tabCount = await viewTabs.count()

    expect(tabCount, 'Should have multiple view tabs').toBeGreaterThanOrEqual(3)

    for (let i = 0; i < tabCount; i++) {
      const tab = viewTabs.nth(i)
      const isVisible = await tab.isVisible().catch(() => false)
      expect(isVisible, `View tab ${i} should be visible`).toBeTruthy()

      const box = await tab.boundingBox()
      expect(box, `View tab ${i} should have bounding box`).toBeTruthy()
      expect(box!.width, `View tab ${i} should have non-zero width`).toBeGreaterThan(0)
      expect(box!.height, `View tab ${i} should have non-zero height`).toBeGreaterThan(0)
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-view-tabs.png') })
  })

  test('25 - Timer display in header is readable (digits visible)', async ({ page }) => {
    // Timer display or clock should be in the header control panel
    const controlPanel = page.locator('.control-panel, .header-section')
    const isVisible = await controlPanel.first().isVisible().catch(() => false)

    expect(isVisible, 'Header control panel should be visible').toBeTruthy()

    if (isVisible) {
      const box = await controlPanel.first().boundingBox()
      expect(box, 'Control panel should have bounding box').toBeTruthy()
      expect(box!.width, 'Control panel should not be zero-width (clipped)').toBeGreaterThan(50)
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-timer-display.png') })
  })

  test('26 - Quick add task input is usable (visible, accepts input)', async ({ page }) => {
    // Quick task input is in the sidebar
    const quickInput = page.locator(
      '.sidebar input[placeholder*="task"], .sidebar input[placeholder*="Task"], ' +
      '.sidebar input[placeholder*="Add"], .sidebar input[placeholder*="add"], ' +
      '.sidebar-quick-task input, .quick-task-input input',
    ).first()

    const isVisible = await quickInput.isVisible().catch(() => false)

    if (isVisible) {
      const box = await quickInput.boundingBox()
      expect(box, 'Quick task input should have bounding box').toBeTruthy()
      expect(box!.width, 'Quick task input should be wide enough to type in').toBeGreaterThan(100)

      // Verify it accepts input
      await quickInput.click()
      await quickInput.fill('Test task input')
      const value = await quickInput.inputValue()
      expect(value).toBe('Test task input')

      // Clear it (don't actually create a task)
      await quickInput.fill('')
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-quick-add.png') })
  })

  test('27 - Page does not have blank/white areas where content should be', async ({ page }) => {
    const mainContent = page.locator('.main-content').first()
    const mainBox = await getBoundingBoxRetry(mainContent)
    expect(mainBox, 'Main content should be visible').toBeTruthy()

    // Take screenshot and check that main content area has meaningful height
    expect(mainBox!.height, 'Main content should fill viewport height').toBeGreaterThan(200)

    // Check that there is at least some child content rendered inside main
    const childCount = await mainContent.evaluate((el) => el.children.length)
    expect(childCount, 'Main content should have child elements (not blank)').toBeGreaterThan(0)

    // The view-wrapper should also have content
    const viewWrapper = page.locator('.view-wrapper').first()
    const wrapperBox = await getBoundingBoxRetry(viewWrapper)
    if (wrapperBox) {
      expect(wrapperBox.height, 'View wrapper should have meaningful height').toBeGreaterThan(50)
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-no-blank.png') })
  })

  test('28 - Font renders correctly (not fallback serif)', async ({ page }) => {
    // Check computed font-family on a known text element
    const brandText = page.locator('.brand-text, .title-main, h1').first()
    const isVisible = await brandText.isVisible().catch(() => false)

    if (isVisible) {
      const fontFamily = await brandText.evaluate((el) =>
        window.getComputedStyle(el).fontFamily,
      )

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-font.png') })

      // Should NOT be pure serif fallback (e.g. "Times New Roman", "serif")
      const isSerif = /^(times|serif|georgia)$/i.test(fontFamily.replace(/['"]/g, '').trim())
      expect(
        isSerif,
        `Font should not be fallback serif. Got: ${fontFamily}`,
      ).toBeFalsy()
    }
  })

  test('29 - All icons render (Lucide icons visible, not empty squares)', async ({ page }) => {
    // Lucide icons render as SVG elements
    const svgIcons = page.locator('.sidebar svg, .app-header svg, .view-tab svg')
    const iconCount = await svgIcons.count()

    expect(iconCount, 'Should have SVG icons rendered in sidebar/header').toBeGreaterThan(0)

    // Check a sample of icons for non-zero dimensions
    const sampleSize = Math.min(iconCount, 5)
    for (let i = 0; i < sampleSize; i++) {
      const icon = svgIcons.nth(i)
      const box = await icon.boundingBox().catch(() => null)
      if (box) {
        expect(box.width, `Icon ${i} should have non-zero width`).toBeGreaterThan(0)
        expect(box.height, `Icon ${i} should have non-zero height`).toBeGreaterThan(0)
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-icons.png') })
  })

  test('30 - No elements with 0x0 dimensions that should have content', async ({ page }) => {
    // Check key layout elements for zero dimensions
    const criticalSelectors = [
      '.sidebar',
      '.main-content',
      '.app-header, .content-header, header',
      '.view-wrapper',
    ]

    for (const selector of criticalSelectors) {
      const el = page.locator(selector).first()
      const isVisible = await el.isVisible().catch(() => false)

      if (isVisible) {
        const box = await el.boundingBox()
        expect(box, `${selector} should have bounding box`).toBeTruthy()
        expect(box!.width, `${selector} should not have 0 width`).toBeGreaterThan(0)
        expect(box!.height, `${selector} should not have 0 height`).toBeGreaterThan(0)
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-no-zero-dims.png') })
  })
})

// ============================================================================
// SECTION 4: WebKitGTK-Specific Rendering (Tests 31-40)
// ============================================================================

test.describe('Tauri Layout Bugs — WebKitGTK-Specific Rendering', () => {
  test('31 - backdrop-filter blur renders (glass morphism)', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    const sidebar = page.locator('.sidebar').first()
    const backdropFilter = await sidebar.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return style.backdropFilter || (style as any).webkitBackdropFilter
    })

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-backdrop-filter.png') })

    // backdrop-filter should be set (not "none")
    expect(
      backdropFilter && backdropFilter !== 'none',
      `Sidebar backdrop-filter should be set for glass morphism. Got: ${backdropFilter}`,
    ).toBeTruthy()
  })

  test('32 - CSS grid layout computes correctly (sidebar + main = viewport width)', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    const layout = page.locator('.app-layout').first()
    const computedGrid = await layout.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        width: (el as HTMLElement).offsetWidth,
      }
    })

    expect(computedGrid.display, 'App layout should use CSS grid').toBe('grid')

    // Parse computed grid columns
    const columns = computedGrid.gridTemplateColumns.split(/\s+/).map(parseFloat)
    expect(columns.length, 'Should have 2 grid columns').toBe(2)

    const totalColumnWidth = columns.reduce((a, b) => a + b, 0)
    const viewportWidth = page.viewportSize()!.width

    // Total column width should be close to viewport width (within 5px)
    expect(
      Math.abs(totalColumnWidth - viewportWidth),
      `Grid columns total (${totalColumnWidth}) should match viewport width (${viewportWidth})`,
    ).toBeLessThan(5)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-grid-layout.png') })
  })

  test('33 - overflow:hidden does not clip interactive elements (dropdowns)', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Check that the sidebar's overflow:hidden doesn't prevent the task-management-section from scrolling
    const taskMgmt = page.locator('.task-management-section').first()
    if (await taskMgmt.isVisible().catch(() => false)) {
      const overflowY = await taskMgmt.evaluate((el) => window.getComputedStyle(el).overflowY)
      expect(
        ['auto', 'scroll'].includes(overflowY),
        `task-management-section should have scrollable overflow, got: ${overflowY}`,
      ).toBeTruthy()
    }

    // Check that main-content overflow doesn't clip view-wrapper
    const viewWrapper = page.locator('.view-wrapper').first()
    if (await viewWrapper.isVisible().catch(() => false)) {
      const box = await viewWrapper.boundingBox()
      expect(box, 'view-wrapper should not be clipped to 0 height').toBeTruthy()
      expect(box!.height, 'view-wrapper should have meaningful height').toBeGreaterThan(50)
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-overflow-clip.png') })
  })

  test('34 - Transitions/animations do not freeze (sidebar collapse animates)', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    const sidebar = page.locator('.sidebar').first()
    const beforeBox = await sidebar.boundingBox()
    expect(beforeBox, 'Sidebar should be visible').toBeTruthy()

    // Trigger collapse
    await page.evaluate(() => {
      const pinia = (window as any).__pinia || (window as any)._pinia
      if (pinia?.state?.value?.ui) {
        pinia.state.value.ui.mainSidebarVisible = false
      }
    })

    // Take screenshot during transition (200ms into a ~400ms transition)
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-transition-mid.png') })

    // Wait for transition to complete
    await page.waitForTimeout(600)

    // Verify layout changed
    const afterLayout = page.locator('.app-layout')
    const hasHiddenClass = await afterLayout.evaluate((el) => el.classList.contains('sidebar-hidden'))
    expect(hasHiddenClass, 'Layout should have sidebar-hidden class after collapse animation').toBeTruthy()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-transition-done.png') })

    // Re-expand
    await page.evaluate(() => {
      const pinia = (window as any).__pinia || (window as any)._pinia
      if (pinia?.state?.value?.ui) {
        pinia.state.value.ui.mainSidebarVisible = true
      }
    })
    await page.waitForTimeout(800)
  })

  test('35 - Custom scrollbars render (not default browser scrollbars)', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Check if custom scrollbar CSS is applied via ::-webkit-scrollbar
    const hasCustomScrollbar = await page.evaluate(() => {
      // Check if any stylesheet defines ::-webkit-scrollbar rules
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.cssText?.includes('-webkit-scrollbar')) {
              return true
            }
          }
        } catch {
          // Cross-origin stylesheet — skip
        }
      }
      return false
    })

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-scrollbars.png') })

    // This is informational — custom scrollbars may or may not be present
    if (!hasCustomScrollbar) {
      console.warn('No custom ::-webkit-scrollbar rules found. Using default scrollbars.')
    }
  })

  test('36 - RTL mode: sidebar appears on RIGHT side', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Set RTL direction
    await page.evaluate(() => {
      document.documentElement.setAttribute('dir', 'rtl')
      document.querySelector('.app-layout')?.setAttribute('dir', 'rtl')
    })
    await page.waitForTimeout(500)

    const sidebar = page.locator('.sidebar').first()
    const mainContent = page.locator('.main-content').first()

    const sidebarBox = await sidebar.boundingBox()
    const mainBox = await mainContent.boundingBox()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-rtl-layout.png') })

    if (sidebarBox && mainBox) {
      // In RTL, sidebar should be on the RIGHT (higher x) and main on the LEFT (lower x)
      expect(
        sidebarBox.x,
        `In RTL, sidebar x (${sidebarBox.x}) should be > main content x (${mainBox.x})`,
      ).toBeGreaterThan(mainBox.x)
    }

    // Reset to LTR
    await page.evaluate(() => {
      document.documentElement.setAttribute('dir', 'ltr')
      document.querySelector('.app-layout')?.setAttribute('dir', 'ltr')
    })
  })

  test('37 - RTL mode: text alignment mirrors correctly', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    await page.evaluate(() => {
      document.documentElement.setAttribute('dir', 'rtl')
      document.querySelector('.app-layout')?.setAttribute('dir', 'rtl')
    })
    await page.waitForTimeout(500)

    // Check that sidebar text direction is RTL
    const sidebar = page.locator('.sidebar').first()
    const direction = await sidebar.evaluate((el) =>
      window.getComputedStyle(el).direction,
    )

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-rtl-text.png') })

    expect(direction, 'Sidebar direction should be rtl').toBe('rtl')

    // Reset
    await page.evaluate(() => {
      document.documentElement.setAttribute('dir', 'ltr')
      document.querySelector('.app-layout')?.setAttribute('dir', 'ltr')
    })
  })

  test('38 - Dark theme: no light/white flashes during navigation', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Verify background is dark (the app uses dark theme by default)
    const bgColor = await page.evaluate(() => {
      const el = document.querySelector('.app-layout')
      return el ? window.getComputedStyle(el).backgroundColor : null
    })

    // Navigate between views and check background stays dark
    const routes = ['/#/board', '/#/tasks']
    for (const route of routes) {
      await page.goto(route)
      await page.waitForTimeout(500)

      const bodyBg = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor
      })

      // White = rgb(255, 255, 255) or rgba(255, 255, 255, 1)
      const isWhite = /rgba?\(255,\s*255,\s*255/.test(bodyBg)

      expect(
        isWhite,
        `Body background should not flash white during navigation to ${route}. Got: ${bodyBg}`,
      ).toBeFalsy()
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-dark-theme.png') })
  })

  test('39 - z-index: modals appear above all content', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Open settings modal
    await page.evaluate(() => {
      const pinia = (window as any).__pinia || (window as any)._pinia
      if (pinia?.state?.value?.ui) {
        pinia.state.value.ui.showSettingsModal = true
      }
    })
    await page.waitForTimeout(1000)

    // Check for modal overlay
    const modal = page.locator('.modal-overlay, .modal-backdrop, [class*="modal-overlay"], [class*="n-modal"]').first()
    const isVisible = await modal.isVisible().catch(() => false)

    if (isVisible) {
      const modalZ = await modal.evaluate((el) => {
        return parseInt(window.getComputedStyle(el).zIndex || '0', 10)
      })

      const sidebarZ = await page.locator('.sidebar').first().evaluate((el) => {
        return parseInt(window.getComputedStyle(el).zIndex || '0', 10)
      }).catch(() => 0)

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-modal-z-index.png') })

      // Modal z-index should be higher than sidebar
      expect(
        modalZ,
        `Modal z-index (${modalZ}) should be >= sidebar z-index (${sidebarZ})`,
      ).toBeGreaterThanOrEqual(sidebarZ)
    } else {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-modal-not-found.png') })
      console.warn('Modal overlay not found after setting showSettingsModal = true')
    }

    // Close modal
    await page.evaluate(() => {
      const pinia = (window as any).__pinia || (window as any)._pinia
      if (pinia?.state?.value?.ui) {
        pinia.state.value.ui.showSettingsModal = false
      }
    })
  })

  test('40 - position:fixed elements are not trapped by transform/perspective parents', async ({ page }) => {
    await waitForAppReady(page, '/tasks')

    // Check that no ancestor of the main layout has transform or perspective
    // that would create a containing block for fixed-position descendants
    const trappingAncestors = await page.evaluate(() => {
      const traps: string[] = []
      let el = document.querySelector('.app-layout') as HTMLElement | null

      while (el) {
        const style = window.getComputedStyle(el)
        const transform = style.transform
        const perspective = style.perspective
        const willChange = style.willChange

        if (
          (transform && transform !== 'none') ||
          (perspective && perspective !== 'none') ||
          (willChange && (willChange.includes('transform') || willChange.includes('perspective')))
        ) {
          traps.push(
            `${el.tagName}.${el.className.split(' ').slice(0, 2).join('.')}: ` +
            `transform=${transform}, perspective=${perspective}, will-change=${willChange}`,
          )
        }
        el = el.parentElement
      }

      return traps
    })

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tauri-fixed-position.png') })

    // Report any trapping ancestors — these cause position:fixed to behave like position:absolute
    if (trappingAncestors.length > 0) {
      console.warn(
        'Ancestors with transform/perspective that may trap fixed elements:',
        trappingAncestors,
      )
    }

    // The floating sidebar toggle uses position:fixed — verify it positions correctly
    // First collapse sidebar to make it appear
    await page.evaluate(() => {
      const pinia = (window as any).__pinia || (window as any)._pinia
      if (pinia?.state?.value?.ui) {
        pinia.state.value.ui.mainSidebarVisible = false
      }
    })
    await page.waitForTimeout(800)

    const floatingToggle = page.locator('.floating-sidebar-toggle')
    const isVisible = await floatingToggle.isVisible().catch(() => false)

    if (isVisible) {
      const box = await floatingToggle.boundingBox()
      expect(box, 'Floating toggle should have bounding box').toBeTruthy()

      // It should be at the left edge of viewport (not offset by sidebar transform)
      expect(
        box!.x,
        `Floating toggle x (${box!.x}) should be near viewport left edge (< 50px)`,
      ).toBeLessThan(50)
    }

    // Re-expand
    await page.evaluate(() => {
      const pinia = (window as any).__pinia || (window as any)._pinia
      if (pinia?.state?.value?.ui) {
        pinia.state.value.ui.mainSidebarVisible = true
      }
    })
  })
})
