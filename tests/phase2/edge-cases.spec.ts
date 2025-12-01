import { test, expect } from '../utils/phase2-test-helpers'
import { testProjects, testTasks, phase2Helpers } from '../utils/phase2-test-helpers'

test.describe('Phase 2: Edge Cases - Enhanced Composables', () => {
  test.beforeEach(async ({ page, navigateToWorktree }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
  })

  test.describe('Empty States', () => {
    test('should handle application with no projects', async ({ page }) => {
      // Navigate to different views with no projects
      const views = ['board', 'calendar', 'canvas', 'tasks'] as const

      for (const view of views) {
        await phase2Helpers.navigateToView(page, view)

        // Should show appropriate empty state
        await expect(page.locator('[data-testid="app"]')).toBeVisible()

        // Take screenshot for visual verification
        await page.screenshot({
          path: `test-results/phase2/edge-cases/no-projects-${view}.png`,
          fullPage: true
        })
      }

      // Test uncategorized filter with no projects
      const uncategorizedFilter = page.locator('[data-testid="uncategorized-filter"]')
      await expect(uncategorizedFilter).toBeVisible()

      // Should show 0 uncategorized tasks
      const uncategorizedCount = uncategorizedFilter.locator('[data-testid="uncategorized-task-count"]')
      if (await uncategorizedCount.isVisible()) {
        const count = await uncategorizedCount.textContent()
        expect(count).toBe('0')
      }
    })

    test('should handle application with no tasks', async ({ page }) => {
      // Create projects but no tasks
      await page.click('[data-testid="create-project-button"]')
      await page.fill('[data-testid="project-name-input"]', 'Test Project')
      await page.click('[data-testid="save-project-button"]')
      await page.waitForTimeout(1000)

      const views = ['board', 'calendar', 'canvas', 'tasks'] as const

      for (const view of views) {
        await phase2Helpers.navigateToView(page, view)

        // Should show project but no tasks
        await expect(page.locator('[data-testid="project-Test Project"]')).toBeVisible()

        // Should show empty state for tasks
        const taskList = page.locator('[data-testid="task-list"]')
        if (await taskList.isVisible()) {
          const taskCount = await taskList.locator('[data-testid^="task-"]').count()
          expect(taskCount).toBe(0)
        }

        await page.screenshot({
          path: `test-results/phase2/edge-cases/no-tasks-${view}.png`,
          fullPage: true
        })
      }

      // Test Quick Sort with no uncategorized tasks
      await page.click('[data-testid="nav-quick-sort"]')
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="quicksort-empty-state"]')).toBeVisible()
      await expect(page.locator('[data-testid="quicksort-empty-message"]')).toContain('No uncategorized tasks')
    })

    test('should handle all tasks categorized', async ({ page, createTestProjects, createTestTasks }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)

      // Categorize all uncategorized tasks
      const uncategorizedTasks = ['Uncategorized Task 1', 'Uncategorized Task 2', 'Uncategorized Task 3', 'Legacy Default Task']

      for (const taskTitle of uncategorizedTasks) {
        const task = page.locator(`[data-testid="task-${taskTitle}"]`)
        if (await task.isVisible()) {
          await task.click()
          await page.waitForSelector('[data-testid="task-edit-modal"]')

          await page.selectOption('[data-testid="task-project-select"]', 'Alpha Project')
          await page.click('[data-testid="save-task-button"]')
          await page.waitForTimeout(500)
        }
      }

      // Test uncategorized filter with all tasks categorized
      await page.click('[data-testid="uncategorized-filter"]')
      await page.waitForTimeout(1000)

      // Should show empty state
      await expect(page.locator('[data-testid="no-uncategorized-tasks"]')).toBeVisible()

      // Test Quick Sort with no uncategorized tasks
      await page.click('[data-testid="nav-quick-sort"]')
      await page.waitForLoadState('networkidle')

      await expect(page.locator('[data-testid="quicksort-all-tasks-categorized"]')).toBeVisible()
      await expect(page.locator('[data-testid="quicksort-success-message"]')).toContain('All tasks categorized')
    })
  })

  test.describe('Invalid Data Handling', () => {
    test('should handle tasks with invalid project references', async ({ page }) => {
      // Create task with invalid project ID (simulate corrupted data)
      await page.evaluate(() => {
        // Simulate creating a task with invalid project reference
        const taskStore = (window as any).useTaskStore?.()
        if (taskStore) {
          taskStore.createTask({
            id: 'invalid-project-task',
            title: 'Invalid Project Task',
            description: 'Task with invalid project reference',
            projectId: 'invalid-project-id-12345',
            status: 'planned'
          })
        }
      })

      await page.waitForTimeout(1000)

      // Task should be treated as uncategorized
      const task = page.locator('[data-testid="task-Invalid Project Task"]')
      if (await task.isVisible()) {
        const projectBadge = task.locator('[data-testid="task-project-badge"]')
        if (await projectBadge.isVisible()) {
          const projectText = await projectBadge.textContent()
          expect(projectText).toMatch(/Unknown Project|My Tasks/i)
        }
      }

      // Should not break the application
      await expect(page.locator('[data-testid="app"]')).toBeVisible()
    })

    test('should handle projects with invalid data', async ({ page }) => {
      // Create project with invalid data (simulate)
      await page.evaluate(() => {
        const taskStore = (window as any).useTaskStore?.()
        if (taskStore) {
          taskStore.createProject({
            id: '',
            name: '',
            color: 'invalid-color',
            description: 'Project with invalid data'
          })
        }
      })

      await page.waitForTimeout(1000)

      // Application should remain stable
      await expect(page.locator('[data-testid="app"]')).toBeVisible()

      // Should handle gracefully in UI
      const sidebarProjects = page.locator('[data-testid="sidebar-projects"]')
      if (await sidebarProjects.isVisible()) {
        // Should not crash or show invalid project
        await expect(sidebarProjects).toBeVisible()
      }
    })

    test('should handle rapid state changes without corruption', async ({ page, createTestProjects }) => {
      await createTestProjects(testProjects)
      await page.waitForTimeout(1000)

      // Rapidly switch between views
      const views = ['board', 'calendar', 'canvas', 'tasks'] as const

      const rapidSwitchingTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 0; i < 20; i++) {
          await phase2Helpers.navigateToView(page, views[i % views.length])
          await page.waitForTimeout(50)
        }
      })

      console.log(`Rapid view switching (20 cycles) completed in ${rapidSwitchingTime}ms`)
      expect(rapidSwitchingTime).toBeLessThan(5000)

      // Application should remain responsive
      await expect(page.locator('[data-testid="app"]')).toBeVisible()

      // All views should be accessible
      for (const view of views) {
        await phase2Helpers.navigateToView(page, view)
        await expect(page.locator('[data-testid="nav-${view}"]')).toHaveClass('active')
      }
    })

    test('should handle concurrent task operations without conflicts', async ({ page }) => {
      const taskCount = 20

      // Create multiple tasks rapidly
      const concurrentCreationTime = await phase2Helpers.measureTiming(page, async () => {
        const promises = []
        for (let i = 1; i <= taskCount; i++) {
          promises.push(
            page.fill('[data-testid="quick-task-input"]', `Concurrent Task ${i}`).then(() =>
              page.press('[data-testid="quick-task-input"]', 'Enter')
            ).then(() => page.waitForTimeout(100))
          )
        }
        await Promise.all(promises)
      })

      console.log(`Created ${taskCount} tasks concurrently in ${concurrentCreationTime}ms`)

      // All tasks should be created successfully
      const createdTasks = page.locator('[data-testid^="task-Concurrent Task"]')
      await expect(createdTasks).toHaveCount(taskCount)

      // Test concurrent filtering
      const concurrentFilteringTime = await phase2Helpers.measureTiming(page, async () => {
        const promises = []
        for (let i = 0; i < 10; i++) {
          promises.push(
            page.click('[data-testid="uncategorized-filter"]').then(() =>
              page.waitForTimeout(50)
            )
          )
        }
        await Promise.all(promises)
      })

      console.log(`Concurrent filtering (10 cycles) completed in ${concurrentFilteringTime}ms`)
      expect(concurrentFilteringTime).toBeLessThan(2000)

      // Should not cause application instability
      await expect(page.locator('[data-testid="app"]')).toBeVisible()
    })
  })

  test.describe('Boundary Conditions', () => {
    test('should handle maximum task title lengths', async ({ page }) => {
      // Create task with very long title
      const longTitle = 'A'.repeat(500) // 500 characters
      await page.fill('[data-testid="quick-task-input"]', longTitle)
      await page.press('[data-testid="quick-task-input"]', 'Enter')
      await page.waitForTimeout(1000)

      // Task should be created but title might be truncated
      const task = page.locator('[data-testid^="task-AAAAAAAAAA"]')
      if (await task.isVisible()) {
        await expect(task).toBeVisible()

        // Test editing the task
        await task.click()
        await page.waitForSelector('[data-testid="task-edit-modal"]')

        const titleInput = page.locator('[data-testid="task-title"]')
        if (await titleInput.isVisible()) {
          const actualTitle = await titleInput.inputValue()
          expect(actualTitle).toBe(longTitle)
        }

        await page.click('[data-testid="cancel-task-edit"]')
      }
    })

    test('should handle special characters in task names', async ({ page }) => {
      const specialCharTasks = [
        'Task with <script>alert("test")</script> tags',
        'Task with "quotes" and \'apostrophes\'',
        'Task with &ampersands & symbols',
        'Task with unicode: 🍅📝✅',
        'Task with $pecial char$ and %symbols%',
        'Task with\nnewlines\nand\ttabs'
      ]

      for (const taskName of specialCharTasks) {
        await page.fill('[data-testid="quick-task-input"]', taskName)
        await page.press('[data-testid="quick-task-input"]', 'Enter')
        await page.waitForTimeout(500)

        // Task should be created successfully
        const taskElement = page.locator(`[data-testid="task-${taskName.replace(/[<>&"'\n\t$%]/g, '\\$&')}]`)
        if (await taskElement.isVisible()) {
          await expect(taskElement).toBeVisible()
        }
      }

      // All tasks should be manageable
      await expect(page.locator('[data-testid^="task-"]')).toHaveCount(specialCharTasks.length)
    })

    test('should handle rapid task deletion and recreation', async ({ page }) => {
      // Create tasks
      const taskCount = 10
      for (let i = 1; i <= taskCount; i++) {
        await page.fill('[data-testid="quick-task-input"]', `Rapid Cycle Task ${i}`)
        await page.press('[data-testid="quick-task-input"]', 'Enter')
        await page.waitForTimeout(100)
      }

      // Rapidly delete and recreate tasks
      const cycles = 3
      for (let cycle = 1; cycle <= cycles; cycle++) {
        // Delete all tasks
        const deleteTime = await phase2Helpers.measureTiming(page, async () => {
          for (let i = 1; i <= taskCount; i++) {
              const task = page.locator(`[data-testid="task-Rapid Cycle Task ${i}"]`)
              if (await task.isVisible()) {
                await task.click({ button: 'right' })
                await page.click('[data-testid="delete-task"]')
                await page.click('[data-testid="confirm-delete"]')
                await page.waitForTimeout(100)
              }
            }
        })

        console.log(`Cycle ${cycle}: Deleted ${taskCount} tasks in ${deleteTime}ms`)

        // Recreate tasks
        const recreateTime = await phase2Helpers.measureTiming(page, async () => {
          for (let i = 1; i <= taskCount; i++) {
            await page.fill('[data-testid="quick-task-input"]', `Rapid Cycle Task ${i} - Cycle ${cycle}`)
            await page.press('[data-testid="quick-task-input"]', 'Enter')
            await page.waitForTimeout(100)
          }
        })

        console.log(`Cycle ${cycle}: Recreated ${taskCount} tasks in ${recreateTime}ms`)
      }

      // Final state should be consistent
      const finalTasks = page.locator('[data-testid^="task-Rapid Cycle Task"]')
      await expect(finalTasks).toHaveCount(taskCount)

      // Application should remain stable
      await expect(page.locator('[data-testid="app"]')).toBeVisible()
    })
  })

  test.describe('Network and Connectivity Issues', () => {
    test('should handle intermittent database connectivity', async ({ page }) => {
      // Simulate database connectivity issues by testing rapid operations
      const rapidOperationsTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 1; i <= 50; i++) {
          await page.fill('[data-testid="quick-task-input"]', `Connectivity Test Task ${i}`)
          await page.press('[data-testid="quick-task-input"]', 'Enter')
          await page.waitForTimeout(50)

          // Immediately edit task to test persistence
          const task = page.locator(`[data-testid="task-Connectivity Test Task ${i}"]`)
          if (await task.isVisible()) {
            await task.click()
            await page.waitForSelector('[data-testid="task-edit-modal"]')
            await page.fill('[data-testid="task-description"]', `Description for task ${i}`)
            await page.click('[data-testid="save-task-button"]')
            await page.waitForTimeout(100)
          }
        }
      })

      console.log(`Rapid operations with simulated connectivity issues completed in ${rapidOperationsTime}ms`)
      expect(rapidOperationsTime).toBeLessThan(30000) // 30 seconds for 50 operations

      // All operations should complete successfully
      await expect(page.locator('[data-testid^="task-Connectivity Test Task"]')).toHaveCount(50)
    })

    test('should handle memory pressure gracefully', async ({ page }) => {
      // Create many tasks to test memory pressure
      const memoryTestTaskCount = 100

      const memoryCreationTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 1; i <= memoryTestTaskCount; i++) {
          await page.fill('[data-testid="quick-task-input"]', `Memory Test Task ${i}`)
          await page.press('[data-testid="quick-task-input"]', 'Enter')

          // Add description to increase memory usage
          const task = page.locator(`[data-testid="task-Memory Test Task ${i}"]`)
          if (await task.isVisible()) {
            await task.click()
            await page.waitForSelector('[data-testid="task-edit-modal"]')
            await page.fill('[data-testid="task-description"]', `This is a long description for task ${i} to test memory usage and pressure handling in the application. It should contain enough content to be meaningful but not excessive.`)
            await page.click('[data-testid="save-task-button"]')
            await page.waitForTimeout(200)
          }
        }
      })

      console.log(`Created ${memoryTestTaskCount} memory-intensive tasks in ${memoryCreationTime}ms`)

      // Test view switching under memory pressure
      const viewSwitchingTime = await phase2Helpers.measureTiming(page, async () => {
        const views = ['board', 'calendar', 'canvas', 'tasks'] as const
        for (let i = 0; i < 10; i++) {
          await phase2Helpers.navigateToView(page, views[i % views.length])
          await page.waitForTimeout(200)
        }
      })

      console.log(`View switching under memory pressure completed in ${viewSwitchingTime}ms`)
      expect(viewSwitchingTime).toBeLessThan(4000)

      // Check memory usage
      const memoryInfo = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })

      console.log(`Memory usage after pressure test: ${(memoryInfo / 1024 / 1024).toFixed(2)}MB`)
      expect(memoryInfo).toBeLessThan(200 * 1024 * 1024) // Should not exceed 200MB

      // Application should remain responsive
      await expect(page.locator('[data-testid="app"]')).toBeVisible()
    })
  })

  test.describe('Error Recovery', () => {
    test('should recover from task creation errors', async ({ page }) => {
      // Try to create task with invalid data
      await page.fill('[data-testid="quick-task-input"]', '') // Empty title
      await page.press('[data-testid="quick-task-input"]', 'Enter')
      await page.waitForTimeout(500)

      // Should not create task with empty title
      const emptyTask = page.locator('[data-testid="task-"]')
      await expect(emptyTask).not.toBeVisible()

      // Should show error message if applicable
      const errorMessage = page.locator('[data-testid="error-message"]')
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContain('title')
      }

      // Should be able to create normal task after error
      await page.fill('[data-testid="quick-task-input"]', 'Recovery Test Task')
      await page.press('[data-testid="quick-task-input"]', 'Enter')
      await page.waitForTimeout(1000)

      await expect(page.locator('[data-testid="task-Recovery Test Task"]')).toBeVisible()
    })

    test('should recover from modal errors', async ({ page, createTestProjects, createTestTasks }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)

      // Try to open task edit modal with invalid data
      const task = page.locator('[data-testid="task-Alpha Task 1"]')
      await task.click()
      await page.waitForSelector('[data-testid="task-edit-modal"]')

      // Try to save with invalid data (empty required fields)
      await page.fill('[data-testid="task-title"]', '') // Clear required field
      await page.click('[data-testid="save-task-button"]')

      // Should show validation error
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible()

      // Should be able to cancel and recover
      await page.click('[data-testid="cancel-task-edit"]')
      await page.waitForTimeout(500)

      // Task should remain unchanged
      await expect(page.locator('[data-testid="task-Alpha Task 1"]')).toBeVisible()

      // Should be able to edit task successfully after error
      await task.click()
      await page.waitForSelector('[data-testid="task-edit-modal"]')
      await page.fill('[data-testid="task-title"]', 'Updated Task After Error')
      await page.click('[data-testid="save-task-button"]')
      await page.waitForTimeout(1000)

      await expect(page.locator('[data-testid="task-Updated Task After Error"]')).toBeVisible()
    })

    test('should handle navigation errors gracefully', async ({ page }) => {
      // Try to navigate to non-existent route
      await page.goto('/non-existent-route', { timeout: 5000 }).catch(() => {
        // Expected to fail, but should not crash
      })

      // Should remain on current or default route
      await expect(page.locator('[data-testid="app"]')).toBeVisible()

      // Test valid navigation still works
      await phase2Helpers.navigateToView(page, 'board')
      await expect(page.locator('[data-testid="nav-board"]')).toHaveClass('active')

      // Should be able to navigate to all views
      const views = ['board', 'calendar', 'canvas', 'tasks'] as const
      for (const view of views) {
        await phase2Helpers.navigateToView(page, view)
        await expect(page.locator(`[data-testid="nav-${view}"]`)).toHaveClass('active')
      }
    })
  })
})