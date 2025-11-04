import { test, expect } from '../utils/phase2-test-helpers'
import { testProjects, testTasks, phase2Helpers } from '../utils/phase2-test-helpers'

test.describe('Phase 2: Cross-View Consistency - Project Assignment', () => {
  test.beforeEach(async ({ page, navigateToWorktree, createTestProjects, createTestTasks }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)
  })

  test('should maintain consistent project display across all views', async ({ page }) => {
    const testTask = 'Alpha Task 1'
    const expectedProject = 'Alpha Project'

    // Check Board View
    await phase2Helpers.navigateToView(page, 'board')
    const boardTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(boardTask).toBeVisible()
    const boardProjectBadge = boardTask.locator('[data-testid="task-project-badge"]')
    await expect(boardProjectBadge).toContainText(expectedProject)

    // Check Calendar View
    await phase2Helpers.navigateToView(page, 'calendar')
    const calendarTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(calendarTask).toBeVisible()
    const calendarProjectBadge = calendarTask.locator('[data-testid="task-project-badge"]')
    await expect(calendarProjectBadge).toContainText(expectedProject)

    // Check Canvas View
    await phase2Helpers.navigateToView(page, 'canvas')
    const canvasTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(canvasTask).toBeVisible()
    const canvasProjectBadge = canvasTask.locator('[data-testid="task-project-badge"]')
    await expect(canvasProjectBadge).toContainText(expectedProject)

    // Check All Tasks View
    await phase2Helpers.navigateToView(page, 'tasks')
    const allTasksTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(allTasksTask).toBeVisible()
    const allTasksProjectBadge = allTasksTask.locator('[data-testid="task-project-badge"]')
    await expect(allTasksProjectBadge).toContainText(expectedProject)
  })

  test('should show consistent uncategorized task display across views', async ({ page }) => {
    const uncategorizedTasks = ['Uncategorized Task 1', 'Uncategorized Task 2', 'Uncategorized Task 3', 'Legacy Default Task']

    for (const taskTitle of uncategorizedTasks) {
      // Check Board View
      await phase2Helpers.navigateToView(page, 'board')
      const boardTask = page.locator(`[data-testid="task-${taskTitle}"]`)
      if (await boardTask.isVisible()) {
        const boardProjectBadge = boardTask.locator('[data-testid="task-project-badge"]')
        if (await boardProjectBadge.isVisible()) {
          const boardProjectText = await boardProjectBadge.textContent()
          expect(boardProjectText).toMatch(/Unknown Project|My Tasks/i)
        }
      }

      // Check Calendar View
      await phase2Helpers.navigateToView(page, 'calendar')
      const calendarTask = page.locator(`[data-testid="task-${taskTitle}"]`)
      if (await calendarTask.isVisible()) {
        const calendarProjectBadge = calendarTask.locator('[data-testid="task-project-badge"]')
        if (await calendarProjectBadge.isVisible()) {
          const calendarProjectText = await calendarProjectBadge.textContent()
          expect(calendarProjectText).toMatch(/Unknown Project|My Tasks/i)
        }
      }

      // Check Canvas View
      await phase2Helpers.navigateToView(page, 'canvas')
      const canvasTask = page.locator(`[data-testid="task-${taskTitle}"]`)
      if (await canvasTask.isVisible()) {
        const canvasProjectBadge = canvasTask.locator('[data-testid="task-project-badge"]')
        if (await canvasProjectBadge.isVisible()) {
          const canvasProjectText = await canvasProjectBadge.textContent()
          expect(canvasProjectText).toMatch(/Unknown Project|My Tasks/i)
        }
      }

      // Check All Tasks View
      await phase2Helpers.navigateToView(page, 'tasks')
      const allTasksTask = page.locator(`[data-testid="task-${taskTitle}"]`)
      if (await allTasksTask.isVisible()) {
        const allTasksProjectBadge = allTasksTask.locator('[data-testid="task-project-badge"]')
        if (await allTasksProjectBadge.isVisible()) {
          const allTasksProjectText = await allTasksProjectBadge.textContent()
          expect(allTasksProjectText).toMatch(/Unknown Project|My Tasks/i)
        }
      }
    }
  })

  test('should update project assignments consistently across views in real-time', async ({ page }) => {
    const testTask = 'Uncategorized Task 1'
    const targetProject = 'Alpha Project'

    // Start in Board View
    await phase2Helpers.navigateToView(page, 'board')
    const boardTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(boardTask).toBeVisible()

    // Edit task to assign to project
    await boardTask.click()
    await page.waitForSelector('[data-testid="task-edit-modal"]')

    await page.selectOption('[data-testid="task-project-select"]', targetProject)
    await page.click('[data-testid="save-task-button"]')
    await page.waitForTimeout(1000)

    // Verify assignment updated in Board View
    const updatedBoardTask = page.locator(`[data-testid="task-${testTask}"]`)
    const boardProjectBadge = updatedBoardTask.locator('[data-testid="task-project-badge"]')
    await expect(boardProjectBadge).toContainText(targetProject)

    // Check Calendar View - should also be updated
    await phase2Helpers.navigateToView(page, 'calendar')
    const calendarTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(calendarTask).toBeVisible()
    const calendarProjectBadge = calendarTask.locator('[data-testid="task-project-badge"]')
    await expect(calendarProjectBadge).toContainText(targetProject)

    // Check Canvas View - should also be updated
    await phase2Helpers.navigateToView(page, 'canvas')
    const canvasTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(canvasTask).toBeVisible()
    const canvasProjectBadge = canvasTask.locator('[data-testid="task-project-badge"]')
    await expect(canvasProjectBadge).toContainText(targetProject)

    // Check All Tasks View - should also be updated
    await phase2Helpers.navigateToView(page, 'tasks')
    const allTasksTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(allTasksTask).toBeVisible()
    const allTasksProjectBadge = allTasksTask.locator('[data-testid="task-project-badge"]')
    await expect(allTasksProjectBadge).toContainText(targetProject)
  })

  test('should maintain consistent project counts across views', async ({ page }) => {
    const expectedProjectCounts = {
      'Alpha Project': 2,
      'Beta Project': 1,
      'Gamma Project': 0
    }

    // Check project counts in each view
    const views = ['board', 'calendar', 'canvas', 'tasks'] as const

    for (const view of views) {
      await phase2Helpers.navigateToView(page, view)

      for (const [projectName, expectedCount] of Object.entries(expectedProjectCounts)) {
        const projectElement = page.locator(`[data-testid="project-${projectName}"]`)
        if (await projectElement.isVisible()) {
          const taskCountBadge = projectElement.locator('[data-testid="task-count"]')
          if (expectedCount > 0) {
            await expect(taskCountBadge).toBeVisible()
            const actualCount = parseInt(await taskCountBadge.textContent() || '0', 10)
            expect(actualCount).toBe(expectedCount)
          } else {
            // Projects with no tasks might not show a badge
            const isVisible = await taskCountBadge.isVisible()
            if (isVisible) {
              const actualCount = parseInt(await taskCountBadge.textContent() || '0', 10)
              expect(actualCount).toBe(0)
            }
          }
        }
      }
    }
  })

  test('should handle project deletion consistently across views', async ({ page }) => {
    const projectToDelete = 'Beta Project'
    const taskInProject = 'Beta Task 1'

    // Verify task exists and is assigned to Beta Project in all views
    const views = ['board', 'calendar', 'canvas', 'tasks'] as const

    for (const view of views) {
      await phase2Helpers.navigateToView(page, view)
      const task = page.locator(`[data-testid="task-${taskInProject}"]`)
      await expect(task).toBeVisible()
    }

    // Delete the project
    const projectElement = page.locator(`[data-testid="project-${projectToDelete}"]`)
    await projectElement.click({ button: 'right' })
    await page.click('[data-testid="delete-project"]')
    await page.click('[data-testid="confirm-delete"]')
    await page.waitForTimeout(1000)

    // Verify task becomes uncategorized in all views
    for (const view of views) {
      await phase2Helpers.navigateToView(page, view)
      const task = page.locator(`[data-testid="task-${taskInProject}"]`)
      await expect(task).toBeVisible()

      const projectBadge = task.locator('[data-testid="task-project-badge"]')
      if (await projectBadge.isVisible()) {
        const projectText = await projectBadge.textContent()
        expect(projectText).toMatch(/Unknown Project|My Tasks/i)
      }
    }

    // Verify project is removed from sidebar in all views
    for (const view of views) {
      await phase2Helpers.navigateToView(page, view)
      const deletedProject = page.locator(`[data-testid="project-${projectToDelete}"]`)
      await expect(deletedProject).not.toBeVisible()
    }
  })
})

test.describe('Phase 2: Cross-View Consistency - Uncategorized Task Visibility', () => {
  test.beforeEach(async ({ page, navigateToWorktree, createTestProjects, createTestTasks }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)
  })

  test('should show uncategorized task filter consistently across views', async ({ page }) => {
    const views = ['board', 'calendar', 'canvas', 'tasks'] as const

    for (const view of views) {
      await phase2Helpers.navigateToView(page, view)

      // Check uncategorized filter exists
      const uncategorizedFilter = page.locator('[data-testid="uncategorized-filter"]')
      await expect(uncategorizedFilter).toBeVisible()

      // Check uncategorized count badge
      const uncategorizedBadge = uncategorizedFilter.locator('[data-testid="uncategorized-task-count"]')
      await expect(uncategorizedBadge).toBeVisible()
      const count = parseInt(await uncategorizedBadge.textContent() || '0', 10)
      expect(count).toBe(4) // Should show 4 uncategorized tasks

      // Click filter to show uncategorized tasks
      await uncategorizedFilter.click()
      await page.waitForTimeout(1000)

      // Verify uncategorized tasks are visible
      await expect(page.locator('[data-testid="task-Uncategorized Task 1"]')).toBeVisible()
      await expect(page.locator('[data-testid="task-Uncategorized Task 2"]')).toBeVisible()
      await expect(page.locator('[data-testid="task-Uncategorized Task 3"]')).toBeVisible()
      await expect(page.locator('[data-testid="task-Legacy Default Task"]')).toBeVisible()

      // Verify categorized tasks are not visible
      await expect(page.locator('[data-testid="task-Alpha Task 1"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="task-Beta Task 1"]')).not.toBeVisible()

      // Reset filter
      await uncategorizedFilter.click()
      await page.waitForTimeout(500)
    }
  })

  test('should maintain uncategorized task visibility in Smart Views', async ({ page }) => {
    const views = ['board', 'calendar', 'canvas', 'tasks'] as const

    for (const view of views) {
      await phase2Helpers.navigateToView(page, view)

      // Test "My Tasks" smart view (uncategorized tasks)
      await page.click('[data-testid="uncategorized-filter"]')
      await page.waitForTimeout(1000)

      // Should show Quick Sort button when uncategorized tasks exist
      const quickSortButton = page.locator('[data-testid="quick-sort-button"]')
      await expect(quickSortButton).toBeVisible()

      // Quick Sort button should show correct count
      const quickSortBadge = quickSortButton.locator('[data-testid="quicksort-task-count"]')
      if (await quickSortBadge.isVisible()) {
        const count = parseInt(await quickSortBadge.textContent() || '0', 10)
        expect(count).toBe(4)
      }

      // Reset for next view
      await page.click('[data-testid="uncategorized-filter"]')
      await page.waitForTimeout(500)
    }
  })

  test('should handle task re-categorization consistently across views', async ({ page }) => {
    const testTask = 'Uncategorized Task 1'
    const targetProject = 'Alpha Project'

    // Categorize task in Board View
    await phase2Helpers.navigateToView(page, 'board')
    await page.click('[data-testid="uncategorized-filter"]')
    await page.waitForTimeout(1000)

    const task = page.locator(`[data-testid="task-${testTask}"]`)
    await task.click()
    await page.waitForSelector('[data-testid="task-edit-modal"]')

    await page.selectOption('[data-testid="task-project-select"]', targetProject)
    await page.click('[data-testid="save-task-button"]')
    await page.waitForTimeout(1000)

    // Verify task is no longer in uncategorized filter
    await expect(page.locator(`[data-testid="task-${testTask}"]`)).not.toBeVisible()

    // Reset filter
    await page.click('[data-testid="uncategorized-filter"]')
    await page.waitForTimeout(500)

    // Verify task appears as categorized
    await expect(page.locator(`[data-testid="task-${testTask}"]`)).toBeVisible()
    const projectBadge = page.locator(`[data-testid="task-${testTask}"] [data-testid="task-project-badge"]`)
    await expect(projectBadge).toContainText(targetProject)

    // Check other views - task should be categorized there too
    await phase2Helpers.navigateToView(page, 'calendar')
    const calendarTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(calendarTask).toBeVisible()
    const calendarProjectBadge = calendarTask.locator('[data-testid="task-project-badge"]')
    await expect(calendarProjectBadge).toContainText(targetProject)

    await phase2Helpers.navigateToView(page, 'canvas')
    const canvasTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(canvasTask).toBeVisible()
    const canvasProjectBadge = canvasTask.locator('[data-testid="task-project-badge"]')
    await expect(canvasProjectBadge).toContainText(targetProject)

    await phase2Helpers.navigateToView(page, 'tasks')
    const allTasksTask = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(allTasksTask).toBeVisible()
    const allTasksProjectBadge = allTasksTask.locator('[data-testid="task-project-badge"]')
    await expect(allTasksProjectBadge).toContainText(targetProject)
  })
})

test.describe('Phase 2: Cross-View Consistency - Real-time Updates', () => {
  test.beforeEach(async ({ page, navigateToWorktree, createTestProjects, createTestTasks }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
    await createTestProjects(testProjects)
    await createTestTasks(testTasks)
    await page.waitForTimeout(2000)
  })

  test('should reflect changes immediately across all views', async ({ page }) => {
    const testTask = 'Alpha Task 1'
    const newProjectName = 'Updated Alpha Project'

    // Start with task in Alpha Project
    await phase2Helpers.navigateToView(page, 'board')
    const task = page.locator(`[data-testid="task-${testTask}"]`)
    await expect(task).toBeVisible()

    // Change project name
    const projectElement = page.locator('[data-testid="project-Alpha Project"]')
    await projectElement.click({ button: 'right' })
    await page.click('[data-testid="edit-project"]')
    await page.waitForSelector('[data-testid="project-edit-modal"]')

    await page.fill('[data-testid="project-name-input"]', newProjectName)
    await page.click('[data-testid="save-project-button"]')
    await page.waitForTimeout(1000)

    // Verify project name updated in Board View
    await expect(page.locator(`[data-testid="project-${newProjectName}"]`)).toBeVisible()
    await expect(page.locator('[data-testid="project-Alpha Project"]')).not.toBeVisible()

    // Check task project badge in Board View
    const updatedTask = page.locator(`[data-testid="task-${testTask}"]`)
    const projectBadge = updatedTask.locator('[data-testid="task-project-badge"]')
    await expect(projectBadge).toContainText(newProjectName)

    // Verify changes reflected in other views
    await phase2Helpers.navigateToView(page, 'calendar')
    await expect(page.locator(`[data-testid="project-${newProjectName}"]`)).toBeVisible()
    const calendarTask = page.locator(`[data-testid="task-${testTask}"]`)
    const calendarProjectBadge = calendarTask.locator('[data-testid="task-project-badge"]')
    await expect(calendarProjectBadge).toContainText(newProjectName)

    await phase2Helpers.navigateToView(page, 'canvas')
    await expect(page.locator(`[data-testid="project-${newProjectName}"]`)).toBeVisible()
    const canvasTask = page.locator(`[data-testid="task-${testTask}"]`)
    const canvasProjectBadge = canvasTask.locator('[data-testid="task-project-badge"]')
    await expect(canvasProjectBadge).toContainText(newProjectName)

    await phase2Helpers.navigateToView(page, 'tasks')
    await expect(page.locator(`[data-testid="project-${newProjectName}"]`)).toBeVisible()
    const allTasksTask = page.locator(`[data-testid="task-${testTask}"]`)
    const allTasksProjectBadge = allTasksTask.locator('[data-testid="task-project-badge"]')
    await expect(allTasksProjectBadge).toContainText(newProjectName)
  })

  test('should handle rapid project assignment changes across views', async ({ page }) => {
    const testTask = 'Uncategorized Task 1'
    const projects = ['Alpha Project', 'Beta Project', 'Gamma Project']

    // Start in Board View
    await phase2Helpers.navigateToView(page, 'board')

    for (let i = 0; i < projects.length; i++) {
      const targetProject = projects[i]

      // Edit task to assign to current project
      const task = page.locator(`[data-testid="task-${testTask}"]`)
      await task.click()
      await page.waitForSelector('[data-testid="task-edit-modal"]')

      await page.selectOption('[data-testid="task-project-select"]', targetProject)
      await page.click('[data-testid="save-task-button"]')
      await page.waitForTimeout(500)

      // Verify assignment in current view
      const updatedTask = page.locator(`[data-testid="task-${testTask}"]`)
      const projectBadge = updatedTask.locator('[data-testid="task-project-badge"]')
      await expect(projectBadge).toContainText(targetProject)

      // Quickly check another view to ensure consistency
      await phase2Helpers.navigateToView(page, i % 2 === 0 ? 'calendar' : 'tasks')
      const otherViewTask = page.locator(`[data-testid="task-${testTask}"]`)
      const otherViewProjectBadge = otherViewTask.locator('[data-testid="task-project-badge"]')
      await expect(otherViewProjectBadge).toContainText(targetProject)

      // Return to Board View for next iteration
      await phase2Helpers.navigateToView(page, 'board')
    }
  })
})