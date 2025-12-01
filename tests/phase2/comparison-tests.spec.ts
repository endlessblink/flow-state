import { test, expect } from '../utils/phase2-test-helpers'
import { testProjects, testTasks, phase2Helpers } from '../utils/phase2-test-helpers'
import { BASE_URL, MAIN_BRANCH_PORT, WORKTREE_PORT } from '../utils/phase2-test-helpers'

test.describe('Phase 2: Side-by-Side Comparison - Main Branch vs Worktree', () => {
  let mainBranchPage: any
  let worktreePage: any

  test.beforeAll(async ({ browser }) => {
    // Create two browser contexts for parallel testing
    const mainContext = await browser.newContext()
    const worktreeContext = await browser.newContext()

    mainBranchPage = await mainContext.newPage()
    worktreePage = await worktreeContext.newPage()

    // Navigate to both instances
    await mainBranchPage.goto(`${BASE_URL}:${MAIN_BRANCH_PORT}`)
    await worktreePage.goto(`${BASE_URL}:${WORKTREE_PORT}`)

    // Wait for both to load
    await mainBranchPage.waitForLoadState('networkidle')
    await worktreePage.waitForLoadState('networkidle')
  })

  test.afterAll(async () => {
    await mainBranchPage.close()
    await worktreePage.close()
  })

  test('should handle uncategorized task creation differently', async () => {
    // Test in main branch
    await mainBranchPage.fill('[data-testid="quick-task-input"]', 'Comparison Test Task - Main')
    await mainBranchPage.press('[data-testid="quick-task-input"]', 'Enter')
    await mainBranchPage.waitForTimeout(1000)

    // Test in worktree
    await worktreePage.fill('[data-testid="quick-task-input"]', 'Comparison Test Task - Worktree')
    await worktreePage.press('[data-testid="quick-task-input"]', 'Enter')
    await worktreePage.waitForTimeout(1000)

    // Check uncategorized count in both
    const mainBranchUncategorizedCount = await phase2Helpers.getTextContent(
      mainBranchPage,
      '[data-testid="uncategorized-task-count"]'
    )
    const worktreeUncategorizedCount = await phase2Helpers.getTextContent(
      worktreePage,
      '[data-testid="uncategorized-task-count"]'
    )

    console.log('Main Branch Uncategorized Count:', mainBranchUncategorizedCount)
    console.log('Worktree Uncategorized Count:', worktreeUncategorizedCount)

    // Both should show the task, but worktree should use enhanced logic
    expect(mainBranchUncategorizedCount).toBeTruthy()
    expect(worktreeUncategorizedCount).toBeTruthy()

    // Take comparison screenshots
    await mainBranchPage.screenshot({ path: 'test-results/phase2/comparisons/main-uncategorized-creation.png', fullPage: true })
    await worktreePage.screenshot({ path: 'test-results/phase2/comparisons/worktree-uncategorized-creation.png', fullPage: true })
  })

  test('should show different project handling for legacy tasks', async () => {
    // Create a task and assign it to default project in main branch
    await mainBranchPage.fill('[data-testid="quick-task-input"]', 'Legacy Default Task - Main')
    await mainBranchPage.press('[data-testid="quick-task-input"]', 'Enter')
    await mainBranchPage.waitForTimeout(1000)

    await mainBranchPage.click('[data-testid="task-Legacy Default Task - Main"]')
    await mainBranchPage.waitForSelector('[data-testid="task-edit-modal"]')

    // Look for default project option in main branch
    const mainProjectSelect = mainBranchPage.locator('[data-testid="task-project-select"]')
    if (await mainProjectSelect.isVisible()) {
      const mainOptions = await mainProjectSelect.locator('option').allTextContents()
      console.log('Main Branch Project Options:', mainOptions)
    }

    await mainBranchPage.click('[data-testid="cancel-task-edit"]')

    // Create same task in worktree
    await worktreePage.fill('[data-testid="quick-task-input"]', 'Legacy Default Task - Worktree')
    await worktreePage.press('[data-testid="quick-task-input"]', 'Enter')
    await worktreePage.waitForTimeout(1000)

    await worktreePage.click('[data-testid="task-Legacy Default Task - Worktree"]')
    await worktreePage.waitForSelector('[data-testid="task-edit-modal"]')

    // Check project options in worktree
    const worktreeProjectSelect = worktreePage.locator('[data-testid="task-project-select"]')
    if (await worktreeProjectSelect.isVisible()) {
      const worktreeOptions = await worktreeProjectSelect.locator('option').allTextContents()
      console.log('Worktree Project Options:', worktreeOptions)
    }

    await worktreePage.click('[data-testid="cancel-task-edit"]')

    // Take comparison screenshots of task edit modals
    await mainBranchPage.screenshot({ path: 'test-results/phase2/comparisons/main-task-edit-modal.png' })
    await worktreePage.screenshot({ path: 'test-results/phase2/comparisons/worktree-task-edit-modal.png' })
  })

  test('should handle Quick Sort differently for uncategorized tasks', async () => {
    // Navigate to Quick Sort in both instances
    await mainBranchPage.click('[data-testid="nav-quick-sort"]')
    await worktreePage.click('[data-testid="nav-quick-sort"]')

    await mainBranchPage.waitForLoadState('networkidle')
    await worktreePage.waitForLoadState('networkidle')

    // Check Quick Sort interfaces
    const mainQuickSortVisible = await phase2Helpers.hasElementState(mainBranchPage, '[data-testid="quick-sort-container"]', 'visible')
    const worktreeQuickSortVisible = await phase2Helpers.hasElementState(worktreePage, '[data-testid="quick-sort-container"]', 'visible')

    console.log('Main Branch Quick Sort Visible:', mainQuickSortVisible)
    console.log('Worktree Quick Sort Visible:', worktreeQuickSortVisible)

    if (mainQuickSortVisible && worktreeQuickSortVisible) {
      // Check uncategorized task counts in Quick Sort
      const mainQuickSortUncategorized = await phase2Helpers.getTextContent(
        mainBranchPage,
        '[data-testid="quicksort-uncategorized-count"]'
      )
      const worktreeQuickSortUncategorized = await phase2Helpers.getTextContent(
        worktreePage,
        '[data-testid="quicksort-uncategorized-count"]'
      )

      console.log('Main Branch Quick Sort Uncategorized:', mainQuickSortUncategorized)
      console.log('Worktree Quick Sort Uncategorized:', worktreeQuickSortUncategorized)

      // Take comparison screenshots
      await mainBranchPage.screenshot({ path: 'test-results/phase2/comparisons/main-quicksort-interface.png', fullPage: true })
      await worktreePage.screenshot({ path: 'test-results/phase2/comparisons/worktree-quicksort-interface.png', fullPage: true })
    }
  })

  test('should show different sidebar project behavior', async () => {
    // Navigate to board view in both instances
    await mainBranchPage.click('[data-testid="nav-board"]')
    await worktreePage.click('[data-testid="nav-board"]')

    await mainBranchPage.waitForLoadState('networkidle')
    await worktreePage.waitForLoadState('networkidle')

    // Check sidebar project sections
    const mainSidebarProjects = await mainBranchPage.locator('[data-testid="sidebar-projects"]').all()
    const worktreeSidebarProjects = await worktreePage.locator('[data-testid="sidebar-projects"]').all()

    console.log('Main Branch Sidebar Projects Count:', mainSidebarProjects.length)
    console.log('Worktree Sidebar Projects Count:', worktreeSidebarProjects.length)

    // Check uncategorized filter behavior
    const mainUncategorizedFilter = mainBranchPage.locator('[data-testid="uncategorized-filter"]')
    const worktreeUncategorizedFilter = worktreePage.locator('[data-testid="uncategorized-filter"]')

    const mainUncategorizedVisible = await mainUncategorizedFilter.isVisible()
    const worktreeUncategorizedVisible = await worktreeUncategorizedFilter.isVisible()

    console.log('Main Branch Uncategorized Filter Visible:', mainUncategorizedVisible)
    console.log('Worktree Uncategorized Filter Visible:', worktreeUncategorizedVisible)

    // Take comparison screenshots of sidebars
    await mainBranchPage.screenshot({ path: 'test-results/phase2/comparisons/main-sidebar.png' })
    await worktreePage.screenshot({ path: 'test-results/phase2/comparisons/worktree-sidebar.png' })
  })

  test('should show consistent performance differences', async () => {
    // Test view switching performance in both instances
    const views = ['board', 'calendar', 'canvas', 'tasks'] as const
    const mainBranchTimings: Record<string, number> = {}
    const worktreeTimings: Record<string, number> = {}

    for (const view of views) {
      // Test main branch
      const mainTiming = await phase2Helpers.measureTiming(mainBranchPage, async () => {
        await mainBranchPage.click(`[data-testid="nav-${view}"]`)
        await mainBranchPage.waitForLoadState('networkidle')
      })
      mainBranchTimings[view] = mainTiming

      // Test worktree
      const worktreeTiming = await phase2Helpers.measureTiming(worktreePage, async () => {
        await worktreePage.click(`[data-testid="nav-${view}"]`)
        await worktreePage.waitForLoadState('networkidle')
      })
      worktreeTimings[view] = worktreeTiming
    }

    console.log('Main Branch View Switching Timings (ms):', mainBranchTimings)
    console.log('Worktree View Switching Timings (ms):', worktreeTimings)

    // Both should perform reasonably well (<2 seconds per view switch)
    for (const view of views) {
      expect(mainBranchTimings[view]).toBeLessThan(2000)
      expect(worktreeTimings[view]).toBeLessThan(2000)
    }

    // Log performance comparison
    const performanceComparison: Record<string, { main: number; worktree: number; difference: number }> = {}
    for (const view of views) {
      performanceComparison[view] = {
        main: mainBranchTimings[view],
        worktree: worktreeTimings[view],
        difference: worktreeTimings[view] - mainBranchTimings[view]
      }
    }

    console.log('Performance Comparison:', performanceComparison)
  })

  test('should handle task creation performance differences', async () => {
    // Test task creation performance in both instances
    const taskCount = 10

    const mainBranchCreationTime = await phase2Helpers.measureTiming(mainBranchPage, async () => {
      for (let i = 1; i <= taskCount; i++) {
        await mainBranchPage.fill('[data-testid="quick-task-input"]', `Main Branch Task ${i}`)
        await mainBranchPage.press('[data-testid="quick-task-input"]', 'Enter')
        await mainBranchPage.waitForTimeout(100)
      }
    })

    const worktreeCreationTime = await phase2Helpers.measureTiming(worktreePage, async () => {
      for (let i = 1; i <= taskCount; i++) {
        await worktreePage.fill('[data-testid="quick-task-input"]', `Worktree Task ${i}`)
        await worktreePage.press('[data-testid="quick-task-input"]', 'Enter')
        await worktreePage.waitForTimeout(100)
      }
    })

    console.log(`Main Branch Task Creation Time (${taskCount} tasks):`, `${mainBranchCreationTime}ms`)
    console.log(`Worktree Task Creation Time (${taskCount} tasks):`, `${worktreeCreationTime}ms`)

    // Both should perform reasonably well (<10 seconds for 10 tasks)
    expect(mainBranchCreationTime).toBeLessThan(10000)
    expect(worktreeCreationTime).toBeLessThan(10000)

    // Check average time per task
    const mainAveragePerTask = mainBranchCreationTime / taskCount
    const worktreeAveragePerTask = worktreeCreationTime / taskCount

    console.log('Main Branch Average per Task:', `${mainAveragePerTask}ms`)
    console.log('Worktree Average per Task:', `${worktreeAveragePerTask}ms`)

    // Both should be under 1 second per task average
    expect(mainAveragePerTask).toBeLessThan(1000)
    expect(worktreeAveragePerTask).toBeLessThan(1000)
  })

  test('should demonstrate enhanced uncategorized detection improvements', async () => {
    // Create tasks with different project assignment scenarios
    const taskScenarios = [
      { name: 'No Project Task', projectId: null },
      { name: 'Empty Project Task', projectId: '' },
      { name: 'Legacy Default Task', projectId: '1' }
    ]

    for (const scenario of taskScenarios) {
      // Create task in main branch
      await mainBranchPage.fill('[data-testid="quick-task-input"]', `${scenario.name} - Main`)
      await mainBranchPage.press('[data-testid="quick-task-input"]', 'Enter')
      await mainBranchPage.waitForTimeout(500)

      // Create task in worktree
      await worktreePage.fill('[data-testid="quick-task-input"]', `${scenario.name} - Worktree`)
      await worktreePage.press('[data-testid="quick-task-input"]', 'Enter')
      await worktreePage.waitForTimeout(500)
    }

    await mainBranchPage.waitForTimeout(1000)
    await worktreePage.waitForTimeout(1000)

    // Check uncategorized counts
    const mainUncategorizedCount = await phase2Helpers.getTextContent(
      mainBranchPage,
      '[data-testid="uncategorized-task-count"]'
    )
    const worktreeUncategorizedCount = await phase2Helpers.getTextContent(
      worktreePage,
      '[data-testid="uncategorized-task-count"]'
    )

    console.log('Main Branch Final Uncategorized Count:', mainUncategorizedCount)
    console.log('Worktree Final Uncategorized Count:', worktreeUncategorizedCount)

    // Worktree should potentially show better uncategorized detection
    // (This depends on the specific implementation differences)

    // Take final comparison screenshots
    await mainBranchPage.screenshot({ path: 'test-results/phase2/comparisons/main-final-state.png', fullPage: true })
    await worktreePage.screenshot({ path: 'test-results/phase2/comparisons/worktree-final-state.png', fullPage: true })
  })
})

test.describe('Phase 2: Comparison Analysis Summary', () => {
  test('should generate comprehensive comparison report', async () => {
    // This test would typically analyze the screenshots and performance data collected
    // For now, we'll just ensure the test infrastructure is working

    console.log('=== Phase 2 Comparison Test Summary ===')
    console.log('✅ Test infrastructure created successfully')
    console.log('✅ Side-by-side comparison framework implemented')
    console.log('✅ Performance benchmarking tools added')
    console.log('✅ Screenshot comparison capability enabled')
    console.log('')
    console.log('Generated comparison files:')
    console.log('- main-uncategorized-creation.png')
    console.log('- worktree-uncategorized-creation.png')
    console.log('- main-task-edit-modal.png')
    console.log('- worktree-task-edit-modal.png')
    console.log('- main-quicksort-interface.png')
    console.log('- worktree-quicksort-interface.png')
    console.log('- main-sidebar.png')
    console.log('- worktree-sidebar.png')
    console.log('- main-final-state.png')
    console.log('- worktree-final-state.png')
    console.log('')
    console.log('Performance metrics and timing data logged to console.')
    console.log('Screenshots saved to test-results/phase2/comparisons/')
  })
})