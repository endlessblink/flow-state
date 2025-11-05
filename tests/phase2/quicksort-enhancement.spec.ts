import { test, expect } from '../utils/phase2-test-helpers'
import { testProjects, testTasks, phase2Helpers } from '../utils/phase2-test-helpers'

test.describe('Phase 2: Quick Sort Enhancement with New Uncategorized Logic', () => {
  test.beforeEach(async ({ page, navigateToWorktree }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
  })

  test('should detect uncategorized tasks correctly for Quick Sort', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    // Navigate to Quick Sort
    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Should see Quick Sort interface with uncategorized tasks
    await expect(page.locator('[data-testid="quick-sort-container"]')).toBeVisible()

    // Check that uncategorized tasks are loaded
    const uncategorizedTasks = page.locator('[data-testid="quicksort-uncategorized-task"]')
    await expect(uncategorizedTasks).toHaveCount(4) // Same 4 uncategorized tasks as before

    // Verify specific tasks are present
    await expect(page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')).toBeVisible()
    await expect(page.locator('[data-testid="quicksort-task-Uncategorized Task 2"]')).toBeVisible()
    await expect(page.locator('[data-testid="quicksort-task-Uncategorized Task 3"]')).toBeVisible()
    await expect(page.locator('[data-testid="quicksort-task-Legacy Default Task"]')).toBeVisible()
  })

  test('should show correct project options for categorization', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Select first uncategorized task
    const firstTask = page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')
    await firstTask.click()
    await page.waitForTimeout(500)

    // Should show project selection options
    await expect(page.locator('[data-testid="project-selection-panel"]')).toBeVisible()

    // Check that test projects are available as options
    for (const project of testProjects) {
      const projectOption = page.locator(`[data-testid="project-option-${project.name}"]`)
      await expect(projectOption).toBeVisible()
    }

    // Should NOT show "Unknown Project" as an option (that's where uncategorized tasks already are)
    await expect(page.locator('[data-testid="project-option-Unknown Project"]')).not.toBeVisible()
  })

  test('should categorize tasks correctly with enhanced logic', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Select and categorize first task
    const firstTask = page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')
    await firstTask.click()

    // Assign to Alpha Project
    const alphaProjectOption = page.locator('[data-testid="project-option-Alpha Project"]')
    await alphaProjectOption.click()

    // Should confirm categorization
    await expect(page.locator('[data-testid="categorization-confirmation"]')).toBeVisible()
    await page.click('[data-testid="confirm-categorization"]')
    await page.waitForTimeout(1000)

    // Task should move from uncategorized to categorized
    await expect(page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')).not.toBeVisible()

    // Should show in Alpha Project section
    const alphaProjectSection = page.locator('[data-testid="quicksort-project-Alpha Project"]')
    await expect(alphaProjectSection).toBeVisible()
    await expect(alphaProjectSection.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')).toBeVisible()

    // Check uncategorized count decreased
    const remainingUncategorized = page.locator('[data-testid="quicksort-uncategorized-task"]')
    await expect(remainingUncategorized).toHaveCount(3)
  })

  test('should handle batch categorization efficiently', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Select multiple uncategorized tasks
    const task1 = page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')
    const task2 = page.locator('[data-testid="quicksort-task-Uncategorized Task 2"]')

    await task1.click()
    await page.keyboard.down('Shift')
    await task2.click()
    await page.keyboard.up('Shift')

    // Should show multiple selection
    await expect(page.locator('[data-testid="multiple-task-selection"]')).toBeVisible()

    // Batch assign to Beta Project
    const betaProjectOption = page.locator('[data-testid="project-option-Beta Project"]')
    await betaProjectOption.click()
    await page.click('[data-testid="confirm-batch-categorization"]')
    await page.waitForTimeout(1000)

    // Both tasks should be categorized
    await expect(page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="quicksort-task-Uncategorized Task 2"]')).not.toBeVisible()

    // Should appear in Beta Project section
    const betaProjectSection = page.locator('[data-testid="quicksort-project-Beta Project"]')
    await expect(betaProjectSection.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')).toBeVisible()
    await expect(betaProjectSection.locator('[data-testid="quicksort-task-Uncategorized Task 2"]')).toBeVisible()
  })

  test('should provide progress tracking and motivation', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Check initial progress
    const progressText = await phase2Helpers.getTextContent(page, '[data-testid="quicksort-progress"]')
    expect(progressText).toContain('4') // 4 uncategorized tasks remaining

    // Categorize one task
    const firstTask = page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')
    await firstTask.click()
    const alphaProjectOption = page.locator('[data-testid="project-option-Alpha Project"]')
    await alphaProjectOption.click()
    await page.click('[data-testid="confirm-categorization"]')
    await page.waitForTimeout(1000)

    // Check updated progress
    const updatedProgressText = await phase2Helpers.getTextContent(page, '[data-testid="quicksort-progress"]')
    expect(updatedProgressText).toContain('3') // 3 tasks remaining

    // Should show motivational message
    const motivationMessage = page.locator('[data-testid="motivation-message"]')
    await expect(motivationMessage).toBeVisible()
  })

  test('should persist session and allow resuming', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Start categorization but don't complete
    const firstTask = page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')
    await firstTask.click()

    // Navigate away from Quick Sort
    await page.click('[data-testid="nav-board"]')
    await page.waitForLoadState('networkidle')

    // Return to Quick Sort
    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Should restore session state
    await expect(page.locator('[data-testid="quicksort-container"]')).toBeVisible()
    await expect(page.locator('[data-testid="quicksort-uncategorized-task"]')).toHaveCount(4) // All tasks still uncategorized

    // Should show resume option
    const resumeOption = page.locator('[data-testid="resume-session"]')
    if (await resumeOption.isVisible()) {
      await resumeOption.click()
    }
  })

  test('should integrate with all views after categorization', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    // Categorize a task in Quick Sort
    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    const firstTask = page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')
    await firstTask.click()
    const alphaProjectOption = page.locator('[data-testid="project-option-Alpha Project"]')
    await alphaProjectOption.click()
    await page.click('[data-testid="confirm-categorization"]')
    await page.waitForTimeout(1000)

    // Navigate to different views and verify categorization
    await phase2Helpers.navigateToView(page, 'board')
    await expect(page.locator('[data-testid="task-Uncategorized Task 1"]')).toHaveAttribute('data-project', 'Alpha Project')

    await phase2Helpers.navigateToView(page, 'calendar')
    await expect(page.locator('[data-testid="task-Uncategorized Task 1"]')).toHaveAttribute('data-project', 'Alpha Project')

    await phase2Helpers.navigateToView(page, 'canvas')
    await expect(page.locator('[data-testid="task-Uncategorized Task 1"]')).toHaveAttribute('data-project', 'Alpha Project')

    await phase2Helpers.navigateToView(page, 'tasks')
    await expect(page.locator('[data-testid="task-Uncategorized Task 1"]')).toHaveAttribute('data-project', 'Alpha Project')
  })

  test('should handle undo/redo functionality with enhanced categorization', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Categorize a task
    const firstTask = page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')
    await firstTask.click()
    const alphaProjectOption = page.locator('[data-testid="project-option-Alpha Project"]')
    await alphaProjectOption.click()
    await page.click('[data-testid="confirm-categorization"]')
    await page.waitForTimeout(1000)

    // Task should be categorized
    await expect(page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')).not.toBeVisible()

    // Test undo
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)

    // Task should be uncategorized again
    await expect(page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')).toBeVisible()

    // Test redo
    await page.keyboard.press('Control+y')
    await page.waitForTimeout(500)

    // Task should be categorized again
    await expect(page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')).not.toBeVisible()
  })
})

test.describe('Phase 2: Quick Sort Performance and Edge Cases', () => {
  test.beforeEach(async ({ page, navigateToWorktree }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
  })

  test('should handle empty uncategorized list gracefully', async ({
    page,
    createTestProjects
  }) => {
    // Create projects but no uncategorized tasks
    await createTestProjects(testProjects)
    await page.waitForTimeout(1000)

    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Should show empty state
    await expect(page.locator('[data-testid="quicksort-empty-state"]')).toBeVisible()
    await expect(page.locator('[data-testid="quicksort-empty-message"]')).toContain('No uncategorized tasks')

    // Should show encouraging message
    await expect(page.locator('[data-testid="all-tasks-categorized-message"]')).toBeVisible()
  })

  test('should handle large numbers of uncategorized tasks efficiently', async ({
    page
  }) => {
    // Create 20 uncategorized tasks
    const taskCreationTime = await phase2Helpers.measureTiming(page, async () => {
      for (let i = 1; i <= 20; i++) {
        await page.fill('[data-testid="quick-task-input"]', `Quick Sort Test Task ${i}`)
        await page.press('[data-testid="quick-task-input"]', 'Enter')
        await page.waitForTimeout(50) // Small delay
      }
    })

    console.log(`Created 20 tasks in ${taskCreationTime}ms`)

    // Navigate to Quick Sort
    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Measure Quick Sort load time with many tasks
    const quickSortLoadTime = await phase2Helpers.measureTiming(page, async () => {
      await page.waitForSelector('[data-testid="quicksort-container"]')
    })

    // Should load quickly even with many tasks
    expect(quickSortLoadTime).toBeLessThan(2000)
    console.log(`Quick Sort loaded in ${quickSortLoadTime}ms with 20 tasks`)

    // Should display all uncategorized tasks
    const uncategorizedTasks = page.locator('[data-testid="quicksort-uncategorized-task"]')
    await expect(uncategorizedTasks).toHaveCount(20)

    // Test categorization performance
    const categorizationTime = await phase2Helpers.measureTiming(page, async () => {
      const firstTask = page.locator('[data-testid="quicksort-task-Quick Sort Test Task 1"]')
      await firstTask.click()
      // Note: Would need a project to categorize to, but testing performance of selection
    })

    expect(categorizationTime).toBeLessThan(500)
    console.log(`Task selection completed in ${categorizationTime}ms`)
  })

  test('should handle concurrent operations gracefully', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Test rapid task selection and categorization
    const rapidOperationsTime = await phase2Helpers.measureTiming(page, async () => {
      for (let i = 1; i <= 3; i++) {
        const task = page.locator(`[data-testid="quicksort-task-Uncategorized Task ${i}"]`)
        if (await task.isVisible()) {
          await task.click()
          await page.waitForTimeout(100)

          // Simulate project selection (without actual categorization to avoid race conditions)
          const projectOption = page.locator('[data-testid="project-option-Alpha Project"]')
          if (await projectOption.isVisible()) {
            await projectOption.hover()
            await page.waitForTimeout(100)
          }
        }
      }
    })

    expect(rapidOperationsTime).toBeLessThan(3000)
    console.log(`Rapid operations completed in ${rapidOperationsTime}ms`)

    // Should not have crashed or gotten into invalid state
    await expect(page.locator('[data-testid="quicksort-container"]')).toBeVisible()
  })

  test('should maintain data integrity during session', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Categorize some tasks
    const tasksToCategorize = ['Uncategorized Task 1', 'Uncategorized Task 2']

    for (const taskTitle of tasksToCategorize) {
      const task = page.locator(`[data-testid="quicksort-task-${taskTitle}"]`)
      await task.click()

      const alphaProjectOption = page.locator('[data-testid="project-option-Alpha Project"]')
      await alphaProjectOption.click()
      await page.click('[data-testid="confirm-categorization"]')
      await page.waitForTimeout(500)
    }

    // Navigate away and back to test persistence
    await page.click('[data-testid="nav-board"]')
    await page.waitForLoadState('networkidle')

    await page.click('[data-testid="nav-quick-sort"]')
    await page.waitForLoadState('networkidle')

    // Should maintain correct state
    await expect(page.locator('[data-testid="quicksort-uncategorized-task"]')).toHaveCount(2)
    await expect(page.locator('[data-testid="quicksort-project-Alpha Project"]')).toBeVisible()
    await expect(page.locator('[data-testid="quicksort-project-Alpha Project"] [data-testid="quicksort-task-Uncategorized Task 1"]')).toBeVisible()
    await expect(page.locator('[data-testid="quicksort-project-Alpha Project"] [data-testid="quicksort-task-Uncategorized Task 2"]')).toBeVisible()
  })
})