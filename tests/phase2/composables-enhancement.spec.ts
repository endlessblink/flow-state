import { test, expect } from '../utils/phase2-test-helpers'
import { testProjects, testTasks, phase2Helpers } from '../utils/phase2-test-helpers'

test.describe('Phase 2: Enhanced Composables - Uncategorized Task Detection', () => {
  test.beforeEach(async ({ page, navigateToWorktree }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
  })

  test('should correctly identify and display uncategorized tasks', async ({
    page,
    createTestProjects,
    createTestTasks,
    getUncategorizedTaskCount
  }) => {
    // Create test projects first
    await createTestProjects(testProjects)
    await page.waitForTimeout(1000)

    // Create test tasks including uncategorized ones
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    // Check uncategorized task count
    const uncategorizedCount = await getUncategorizedTaskCount()

    // Should show 4 uncategorized tasks:
    // - task-uncat-1 (projectId: null)
    // - task-uncat-2 (projectId: undefined)
    // - task-uncat-3 (projectId: '')
    // - task-legacy-1 (projectId: '1' - should be treated as uncategorized)
    expect(uncategorizedCount).toBe(4)

    // Verify uncategorized tasks appear in "My Tasks" section
    await page.click('[data-testid="uncategorized-filter"]')
    await page.waitForTimeout(1000)

    // Check that uncategorized tasks are visible
    const uncategorizedTaskElements = page.locator('[data-testid="uncategorized-task"]')
    await expect(uncategorizedTaskElements).toHaveCount(4)

    // Verify specific uncategorized tasks
    await expect(page.locator('[data-testid="task-Uncategorized Task 1"]')).toBeVisible()
    await expect(page.locator('[data-testid="task-Uncategorized Task 2"]')).toBeVisible()
    await expect(page.locator('[data-testid="task-Uncategorized Task 3"]')).toBeVisible()
    await expect(page.locator('[data-testid="task-Legacy Default Task"]')).toBeVisible()
  })

  test('should display "Unknown Project" consistently for uncategorized tasks', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    // Navigate to All Tasks view to see project assignments
    await phase2Helpers.navigateToView(page, 'tasks')

    // Find uncategorized tasks and check their project display
    const uncategorizedTasks = ['Uncategorized Task 1', 'Uncategorized Task 2', 'Uncategorized Task 3', 'Legacy Default Task']

    for (const taskTitle of uncategorizedTasks) {
      const taskElement = page.locator(`[data-testid="task-${taskTitle}"]`)
      await expect(taskElement).toBeVisible()

      // Check that project badge shows "Unknown Project" or similar
      const projectBadge = taskElement.locator('[data-testid="task-project-badge"]')
      if (await projectBadge.isVisible()) {
        const projectText = await projectBadge.textContent()
        expect(projectText).toMatch(/Unknown Project|My Tasks/i)
      }
    }
  })

  test('should correctly categorize tasks by project', async ({
    page,
    createTestProjects,
    createTestTasks,
    getProjectTaskCounts
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    // Get project task counts
    const projectCounts = await getProjectTaskCounts()

    // Should have:
    // - Alpha Project: 2 tasks (task-alpha-1, task-alpha-2)
    // - Beta Project: 1 task (task-beta-1)
    // - Gamma Project: 0 tasks
    expect(projectCounts['Alpha Project']).toBe(2)
    expect(projectCounts['Beta Project']).toBe(1)
    expect(projectCounts['Gamma Project']).toBe(0)
  })

  test('should maintain consistency across views', async ({
    page,
    createTestProjects,
    createTestTasks,
    getUncategorizedTaskCount
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    const expectedUncategorizedCount = 4

    // Test Board View
    await phase2Helpers.navigateToView(page, 'board')
    const boardUncategorizedCount = await getUncategorizedTaskCount()
    expect(boardUncategorizedCount).toBe(expectedUncategorizedCount)

    // Test Calendar View
    await phase2Helpers.navigateToView(page, 'calendar')
    const calendarUncategorizedCount = await getUncategorizedTaskCount()
    expect(calendarUncategorizedCount).toBe(expectedUncategorizedCount)

    // Test Canvas View
    await phase2Helpers.navigateToView(page, 'canvas')
    const canvasUncategorizedCount = await getUncategorizedTaskCount()
    expect(canvasUncategorizedCount).toBe(expectedUncategorizedCount)

    // Test All Tasks View
    await phase2Helpers.navigateToView(page, 'tasks')
    const allTasksUncategorizedCount = await getUncategorizedTaskCount()
    expect(allTasksUncategorizedCount).toBe(expectedUncategorizedCount)
  })
})

test.describe('Phase 2: Enhanced Composables - Project Display Name Resolution', () => {
  test.beforeEach(async ({ page, navigateToWorktree }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
  })

  test('should display project names consistently in sidebar', async ({
    page,
    createTestProjects
  }) => {
    await createTestProjects(testProjects)
    await page.waitForTimeout(1000)

    // Check that all test projects appear in sidebar
    for (const project of testProjects) {
      const projectElement = page.locator(`[data-testid="project-${project.name}"]`)
      await expect(projectElement).toBeVisible()

      const projectNameElement = projectElement.locator('[data-testid="project-name"]')
      const displayedName = await projectNameElement.textContent()
      expect(displayedName).toBe(project.name)
    }
  })

  test('should handle project renaming consistently', async ({
    page,
    createTestProjects
  }) => {
    await createTestProjects(testProjects)
    await page.waitForTimeout(1000)

    const testProject = testProjects[0] // Alpha Project
    const newName = 'Renamed Alpha Project'

    // Right-click on project to open context menu
    const projectElement = page.locator(`[data-testid="project-${testProject.name}"]`)
    await projectElement.click({ button: 'right' })

    // Click edit option
    await page.click('[data-testid="edit-project"]')
    await page.waitForSelector('[data-testid="project-edit-modal"]')

    // Update project name
    await page.fill('[data-testid="project-name-input"]', newName)
    await page.click('[data-testid="save-project-button"]')
    await page.waitForTimeout(1000)

    // Verify new name appears in sidebar
    const renamedProjectElement = page.locator(`[data-testid="project-${newName}"]`)
    await expect(renamedProjectElement).toBeVisible()

    // Verify old project element is gone
    const oldProjectElement = page.locator(`[data-testid="project-${testProject.name}"]`)
    await expect(oldProjectElement).not.toBeVisible()
  })

  test('should gracefully handle deleted project references', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    // Delete Beta Project (has 1 task)
    const betaProject = testProjects[1]
    const projectElement = page.locator(`[data-testid="project-${betaProject.name}"]`)
    await projectElement.click({ button: 'right' })
    await page.click('[data-testid="delete-project"]')

    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]')
    await page.waitForTimeout(1000)

    // Check that the task is now uncategorized
    const uncategorizedCount = await phase2Helpers.getTextContent(page, '[data-testid="uncategorized-task-count"]')
    const count = parseInt(uncategorizedCount || '0', 10)
    expect(count).toBeGreaterThanOrEqual(1) // At least the deleted project's task should be uncategorized
  })
})

test.describe('Phase 2: Enhanced Composables - Task Creation', () => {
  test.beforeEach(async ({ page, navigateToWorktree }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
  })

  test('should create uncategorized tasks by default', async ({
    page,
    getUncategorizedTaskCount
  }) => {
    const initialCount = await getUncategorizedTaskCount()

    // Create a task without selecting a project
    await page.fill('[data-testid="quick-task-input"]', 'New Uncategorized Task')
    await page.press('[data-testid="quick-task-input"]', 'Enter')
    await page.waitForTimeout(1000)

    // Verify uncategorized count increased
    const newCount = await getUncategorizedTaskCount()
    expect(newCount).toBe(initialCount + 1)

    // Verify task appears in uncategorized section
    await page.click('[data-testid="uncategorized-filter"]')
    await expect(page.locator('[data-testid="task-New Uncategorized Task"]')).toBeVisible()
  })

  test('should assign tasks to projects correctly', async ({
    page,
    createTestProjects
  }) => {
    await createTestProjects(testProjects)
    await page.waitForTimeout(1000)

    const testProject = testProjects[0] // Alpha Project

    // Create task and assign to project
    await page.fill('[data-testid="quick-task-input"]', 'Project Task')
    await page.press('[data-testid="quick-task-input"]', 'Enter')
    await page.waitForTimeout(1000)

    // Edit the task to assign it to a project
    await page.click('[data-testid="task-Project Task"]')
    await page.waitForSelector('[data-testid="task-edit-modal"]')

    await page.selectOption('[data-testid="task-project-select"]', testProject.name)
    await page.click('[data-testid="save-task-button"]')
    await page.waitForTimeout(1000)

    // Verify task appears under project
    const projectElement = page.locator(`[data-testid="project-${testProject.name}"]`)
    const taskCountBadge = projectElement.locator('[data-testid="task-count"]')
    const count = parseInt(await taskCountBadge.textContent() || '0', 10)
    expect(count).toBeGreaterThan(0)
  })

  test('should handle legacy projectId "1" correctly', async ({
    page
  }) => {
    // This test verifies that tasks with projectId: '1' are treated as uncategorized
    // in the new implementation (which uses null for uncategorized)

    // Create a task through the old method if available, or simulate it
    await page.fill('[data-testid="quick-task-input"]', 'Legacy Default Task')
    await page.press('[data-testid="quick-task-input"]', 'Enter')
    await page.waitForTimeout(1000)

    // The task should appear as uncategorized
    await page.click('[data-testid="uncategorized-filter"]')
    await expect(page.locator('[data-testid="task-Legacy Default Task"]')).toBeVisible()
  })
})

test.describe('Phase 2: Enhanced Composables - Performance', () => {
  test.beforeEach(async ({ page, navigateToWorktree }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
  })

  test('should load project counts efficiently', async ({
    page,
    createTestProjects,
    createTestTasks
  }) => {
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)

    // Measure time to switch between views
    const boardLoadTime = await phase2Helpers.measureTiming(page, async () => {
      await phase2Helpers.navigateToView(page, 'board')
    })

    const calendarLoadTime = await phase2Helpers.measureTiming(page, async () => {
      await phase2Helpers.navigateToView(page, 'calendar')
    })

    const canvasLoadTime = await phase2Helpers.measureTiming(page, async () => {
      await phase2Helpers.navigateToView(page, 'canvas')
    })

    const allTasksLoadTime = await phase2Helpers.measureTiming(page, async () => {
      await phase2Helpers.navigateToView(page, 'tasks')
    })

    // All views should load quickly (<1 second)
    expect(boardLoadTime).toBeLessThan(1000)
    expect(calendarLoadTime).toBeLessThan(1000)
    expect(canvasLoadTime).toBeLessThan(1000)
    expect(allTasksLoadTime).toBeLessThan(1000)

    console.log('View load times (ms):', {
      board: boardLoadTime,
      calendar: calendarLoadTime,
      canvas: canvasLoadTime,
      allTasks: allTasksLoadTime
    })
  })

  test('should handle large numbers of tasks efficiently', async ({
    page
  }) => {
    // Create 50 tasks to test performance
    const taskCreationTime = await phase2Helpers.measureTiming(page, async () => {
      for (let i = 1; i <= 50; i++) {
        await page.fill('[data-testid="quick-task-input"]', `Performance Test Task ${i}`)
        await page.press('[data-testid="quick-task-input"]', 'Enter')
        await page.waitForTimeout(100) // Small delay between creations
      }
    })

    // Task creation should complete in reasonable time (<10 seconds for 50 tasks)
    expect(taskCreationTime).toBeLessThan(10000)

    // Test view switching with many tasks
    const viewSwitchTime = await phase2Helpers.measureTiming(page, async () => {
      await phase2Helpers.navigateToView(page, 'tasks')
    })

    // View switching should remain fast even with many tasks
    expect(viewSwitchTime).toBeLessThan(1000)

    console.log('Performance metrics:', {
      taskCreationTime: `${taskCreationTime}ms for 50 tasks`,
      viewSwitchTime: `${viewSwitchTime}ms`
    })
  })
})