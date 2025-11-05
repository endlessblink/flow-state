import { test, expect } from '../utils/phase2-test-helpers'
import { testProjects, testTasks, phase2Helpers } from '../utils/phase2-test-helpers'

test.describe('Phase 2: Performance Benchmarking - Enhanced Composables', () => {
  test.beforeEach(async ({ page, navigateToWorktree }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
  })

  test.describe('Task Loading Performance', () => {
    test('should load 100 tasks efficiently', async ({ page }) => {
      const taskCount = 100
      const tasks: string[] = []

      // Measure task creation time
      const creationTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 1; i <= taskCount; i++) {
          const taskName = `Performance Test Task ${i}`
          tasks.push(taskName)

          await page.fill('[data-testid="quick-task-input"]', taskName)
          await page.press('[data-testid="quick-task-input"]', 'Enter')

          // Small delay to prevent overwhelming the system
          if (i % 10 === 0) {
            await page.waitForTimeout(100)
          }
        }
      })

      console.log(`Created ${taskCount} tasks in ${creationTime}ms`)
      console.log(`Average time per task: ${(creationTime / taskCount).toFixed(2)}ms`)

      // Should complete within reasonable time
      expect(creationTime).toBeLessThan(15000) // 15 seconds for 100 tasks
      expect(creationTime / taskCount).toBeLessThan(150) // 150ms per task average

      // Measure view loading time with many tasks
      const views = ['board', 'calendar', 'canvas', 'tasks'] as const
      const viewTimings: Record<string, number> = {}

      for (const view of views) {
        const viewTime = await phase2Helpers.measureTiming(page, async () => {
          await phase2Helpers.navigateToView(page, view)
        })
        viewTimings[view] = viewTime
        console.log(`${view} view loaded in ${viewTime}ms with ${taskCount} tasks`)
        expect(viewTime).toBeLessThan(1000) // 1 second per view
      }

      // Test task filtering performance
      const filteringTime = await phase2Helpers.measureTiming(page, async () => {
        await page.click('[data-testid="uncategorized-filter"]')
        await page.waitForTimeout(500)
        await page.click('[data-testid="uncategorized-filter"]') // Reset
        await page.waitForTimeout(500)
      })

      console.log(`Task filtering completed in ${filteringTime}ms`)
      expect(filteringTime).toBeLessThan(500) // 500ms for filtering

      // Memory usage check (basic)
      const browserContext = page.context()
      const memoryInfo = await browserContext.evaluate(() => {
        return {
          usedJSHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
          totalJSHeapSize: (performance as any).memory?.totalJSHeapSize || 0
        }
      })

      console.log('Memory usage after creating tasks:', {
        used: `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        total: `${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`
      })

      // Should not use excessive memory (<100MB for task storage)
      expect(memoryInfo.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024)
    })

    test('should handle project operations efficiently with many tasks', async ({
      page,
      createTestProjects
    }) => {
      await createTestProjects(testProjects)
      await page.waitForTimeout(1000)

      // Create tasks distributed across projects
      const taskCount = 50
      const projectCreationTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 1; i <= taskCount; i++) {
          const taskName = `Project Task ${i}`
          const projectIndex = (i - 1) % testProjects.length

          await page.fill('[data-testid="quick-task-input"]', taskName)
          await page.press('[data-testid="quick-task-input"]', 'Enter')
          await page.waitForTimeout(100)

          // Edit task to assign to project
          await page.click(`[data-testid="task-${taskName}"]`)
          await page.waitForSelector('[data-testid="task-edit-modal"]')

          await page.selectOption('[data-testid="task-project-select"]', testProjects[projectIndex].name)
          await page.click('[data-testid="save-task-button"]')
          await page.waitForTimeout(200)
        }
      })

      console.log(`Created and assigned ${taskCount} tasks to projects in ${projectCreationTime}ms`)
      expect(projectCreationTime).toBeLessThan(20000) // 20 seconds for project assignment

      // Test project counting performance
      const countingTime = await phase2Helpers.measureTiming(page, async () => {
        for (const project of testProjects) {
          const projectElement = page.locator(`[data-testid="project-${project.name}"]`)
          if (await projectElement.isVisible()) {
            const countBadge = projectElement.locator('[data-testid="task-count"]')
            await countBadge.isVisible() // This should be fast
          }
        }
      })

      console.log(`Project counting completed in ${countingTime}ms`)
      expect(countingTime).toBeLessThan(200) // 200ms for counting

      // Test project filtering performance
      const filteringTime = await phase2Helpers.measureTiming(page, async () => {
        // Switch between projects
        for (const project of testProjects) {
          const projectElement = page.locator(`[data-testid="project-${project.name}"]`)
          if (await projectElement.isVisible()) {
            await projectElement.click()
            await page.waitForTimeout(100)
          }
        }
      })

      console.log(`Project filtering completed in ${filteringTime}ms`)
      expect(filteringTime).toBeLessThan(1000) // 1 second for all projects
    })
  })

  test.describe('Enhanced Composables Performance', () => {
    test('should process uncategorized task detection efficiently', async ({
      page,
      createTestProjects,
      createTestTasks
    }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)

      // Measure uncategorized detection performance
      const detectionTime = await phase2Helpers.measureTiming(page, async () => {
        await page.click('[data-testid="uncategorized-filter"]')
        await page.waitForSelector('[data-testid="uncategorized-task"]', { timeout: 5000 })
      })

      console.log(`Uncategorized task detection completed in ${detectionTime}ms`)
      expect(detectionTime).toBeLessThan(500) // 500ms for detection

      // Test repeated filtering
      const repeatedFilteringTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 0; i < 10; i++) {
          await page.click('[data-testid="uncategorized-filter"]')
          await page.waitForTimeout(100)
          await page.click('[data-testid="uncategorized-filter"]')
          await page.waitForTimeout(100)
        }
      })

      console.log(`Repeated filtering (10 cycles) completed in ${repeatedFilteringTime}ms`)
      expect(repeatedFilteringTime).toBeLessThan(2000) // 2 seconds for 10 cycles
    })

    test('should handle project display name resolution efficiently', async ({
      page,
      createTestProjects,
      createTestTasks
    }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)

      // Test project name resolution in different contexts
      const contexts = ['sidebar', 'task-edit', 'task-list'] as const
      const resolutionTimes: Record<string, number> = {}

      for (const context of contexts) {
        const resolutionTime = await phase2Helpers.measureTiming(page, async () => {
          switch (context) {
            case 'sidebar':
              // Check project names in sidebar
              for (const project of testProjects) {
                await page.locator(`[data-testid="project-${project.name}"]`).isVisible()
              }
              break
            case 'task-edit':
              // Edit a task and check project dropdown
              await page.click('[data-testid="task-Alpha Task 1"]')
              await page.waitForSelector('[data-testid="task-edit-modal"]')
              await page.locator('[data-testid="task-project-select"]').isVisible()
              await page.click('[data-testid="cancel-task-edit"]')
              break
            case 'task-list':
              // Check project badges in task list
              await phase2Helpers.navigateToView(page, 'tasks')
              await page.locator('[data-testid="task-Alpha Task 1"]').isVisible()
              break
          }
        })
        resolutionTimes[context] = resolutionTime
        console.log(`${context} project name resolution completed in ${resolutionTime}ms`)
        expect(resolutionTime).toBeLessThan(300) // 300ms per context
      }

      // Test rapid context switching
      const rapidSwitchingTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 0; i < 5; i++) {
          await phase2Helpers.navigateToView(page, 'board')
          await phase2Helpers.navigateToView(page, 'calendar')
          await phase2Helpers.navigateToView(page, 'canvas')
          await phase2Helpers.navigateToView(page, 'tasks')
        }
      })

      console.log(`Rapid context switching (20 view changes) completed in ${rapidSwitchingTime}ms`)
      expect(rapidSwitchingTime).toBeLessThan(4000) // 4 seconds for 20 view changes
    })
  })

  test.describe('Real-time Performance', () => {
    test('should handle concurrent operations efficiently', async ({
      page,
      createTestProjects
    }) => {
      await createTestProjects(testProjects)
      await page.waitForTimeout(1000)

      // Test concurrent task creation and filtering
      const concurrentTime = await phase2Helpers.measureTiming(page, async () => {
        const promises: Promise<void>[] = []

        // Start task creation
        for (let i = 1; i <= 10; i++) {
          promises.push(
            page.fill('[data-testid="quick-task-input"]', `Concurrent Task ${i}`).then(() =>
              page.press('[data-testid="quick-task-input"]', 'Enter')
            )
          )
        }

        // Start filtering operations
        promises.push(
          page.click('[data-testid="uncategorized-filter"]').then(() =>
            page.waitForTimeout(500)
          )
        )

        await Promise.all(promises)
      })

      console.log(`Concurrent operations completed in ${concurrentTime}ms`)
      expect(concurrentTime).toBeLessThan(3000) // 3 seconds for concurrent operations

      // Verify all tasks were created
      const taskCount = await page.locator('[data-testid^="task-Concurrent Task"]').count()
      expect(taskCount).toBe(10)
    })

    test('should maintain performance during rapid state changes', async ({
      page,
      createTestProjects,
      createTestTasks
    }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)

      // Test rapid task editing and project changes
      const rapidChangesTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 1; i <= 5; i++) {
          await page.click('[data-testid="task-Uncategorized Task 1"]')
          await page.waitForSelector('[data-testid="task-edit-modal"]')

          // Change project assignment
          const projectIndex = i % testProjects.length
          await page.selectOption('[data-testid="task-project-select"]', testProjects[projectIndex].name)
          await page.click('[data-testid="save-task-button"]')
          await page.waitForTimeout(200)
        }
      })

      console.log(`Rapid state changes (5 edits) completed in ${rapidChangesTime}ms`)
      expect(rapidChangesTime).toBeLessThan(5000) // 5 seconds for 5 rapid edits

      // Test rapid view switching with active filters
      const rapidViewSwitchingTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 0; i < 10; i++) {
          await page.click('[data-testid="uncategorized-filter"]')
          await phase2Helpers.navigateToView(page, 'board')
          await page.click('[data-testid="uncategorized-filter"]')
          await phase2Helpers.navigateToView(page, 'calendar')
        }
      })

      console.log(`Rapid view switching with filters completed in ${rapidViewSwitchingTime}ms`)
      expect(rapidViewSwitchingTime).toBeLessThan(4000) // 4 seconds for 10 cycles
    })
  })

  test.describe('Memory and Resource Management', () => {
    test('should manage memory efficiently during extended use', async ({ page }) => {
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })

      console.log(`Initial memory usage: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`)

      // Create and delete tasks repeatedly to test memory management
      const cycles = 5
      const tasksPerCycle = 20

      for (let cycle = 1; cycle <= cycles; cycle++) {
        // Create tasks
        for (let i = 1; i <= tasksPerCycle; i++) {
          await page.fill('[data-testid="quick-task-input"]', `Memory Test Task ${cycle}-${i}`)
          await page.press('[data-testid="quick-task-input"]', 'Enter')
          await page.waitForTimeout(50)
        }

        // Delete some tasks to test cleanup
        for (let i = 1; i <= 5; i++) {
          const taskElement = page.locator(`[data-testid="task-Memory Test Task ${cycle}-${i}"]`)
          if (await taskElement.isVisible()) {
            await taskElement.click({ button: 'right' })
            await page.click('[data-testid="delete-task"]')
            await page.click('[data-testid="confirm-delete"]')
            await page.waitForTimeout(100)
          }
        }

        // Check memory usage
        if (cycle % 2 === 0) {
          const currentMemory = await page.evaluate(() => {
            return (performance as any).memory?.usedJSHeapSize || 0
          })
          const memoryIncrease = currentMemory - initialMemory
          console.log(`Cycle ${cycle} memory usage: ${(currentMemory / 1024 / 1024).toFixed(2)}MB (+${(memoryIncrease / 1024 / 1024).toFixed(2)}MB)`)

          // Memory increase should be reasonable (<50MB after multiple cycles)
          expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
        }
      }

      // Final memory check
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })
      const totalMemoryIncrease = finalMemory - initialMemory

      console.log(`Final memory usage: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`Total memory increase: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB`)

      // Total memory increase should be reasonable (<100MB)
      expect(totalMemoryIncrease).toBeLessThan(100 * 1024 * 1024)
    })

    test('should handle DOM efficiently with many elements', async ({ page }) => {
      const elementCount = 50
      const domCreationTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 1; i <= elementCount; i++) {
          await page.fill('[data-testid="quick-task-input"]', `DOM Test Task ${i}`)
          await page.press('[data-testid="quick-task-input"]', 'Enter')
          await page.waitForTimeout(50)
        }
      })

      console.log(`Created ${elementCount} DOM elements in ${domCreationTime}ms`)

      // Test DOM query performance
      const queryTime = await phase2Helpers.measureTiming(page, async () => {
        for (let i = 1; i <= 10; i++) {
          await page.locator('[data-testid^="task-DOM Test Task"]').count()
        }
      })

      console.log(`DOM queries (10 cycles) completed in ${queryTime}ms`)
      expect(queryTime).toBeLessThan(1000) // 1 second for DOM queries

      // Test DOM manipulation performance
      const manipulationTime = await phase2Helpers.measureTiming(page, async () => {
        // Filter and unfilter repeatedly
        for (let i = 0; i < 5; i++) {
          await page.click('[data-testid="uncategorized-filter"]')
          await page.waitForTimeout(100)
          await page.click('[data-testid="uncategorized-filter"]')
          await page.waitForTimeout(100)
        }
      })

      console.log(`DOM manipulation (10 filter changes) completed in ${manipulationTime}ms`)
      expect(manipulationTime).toBeLessThan(2000) // 2 seconds for DOM manipulation
    })
  })

  test.describe('Performance Regression Testing', () => {
    test('should meet baseline performance requirements', async ({ page, createTestProjects, createTestTasks }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)

      // Baseline performance requirements
      const requirements = {
        taskCreation: 200, // 200ms per task
        viewSwitching: 500, // 500ms per view
        projectFiltering: 100, // 100ms per filter operation
        uncategorizedDetection: 300, // 300ms for detection
        projectCounting: 50 // 50ms for counting
      }

      // Test task creation performance
      const taskCreationTime = await phase2Helpers.measureTiming(page, async () => {
        await page.fill('[data-testid="quick-task-input"]', 'Performance Baseline Task')
        await page.press('[data-testid="quick-task-input"]', 'Enter')
      })

      console.log(`Task creation: ${taskCreationTime}ms (requirement: <${requirements.taskCreation}ms)`)
      expect(taskCreationTime).toBeLessThan(requirements.taskCreation)

      // Test view switching performance
      const viewSwitchingTime = await phase2Helpers.measureTiming(page, async () => {
        await phase2Helpers.navigateToView(page, 'calendar')
        await phase2Helpers.navigateToView(page, 'board')
      })

      console.log(`View switching: ${viewSwitchingTime}ms (requirement: <${requirements.viewSwitching}ms)`)
      expect(viewSwitchingTime).toBeLessThan(requirements.viewSwitching)

      // Test project filtering performance
      const projectFilteringTime = await phase2Helpers.measureTiming(page, async () => {
        await page.locator('[data-testid="project-Alpha Project"]').click()
        await page.waitForTimeout(100)
        await page.locator('[data-testid="project-Beta Project"]').click()
        await page.waitForTimeout(100)
      })

      console.log(`Project filtering: ${projectFilteringTime}ms (requirement: <${requirements.projectFiltering}ms)`)
      expect(projectFilteringTime).toBeLessThan(requirements.projectFiltering)

      // Test uncategorized detection performance
      const uncategorizedDetectionTime = await phase2Helpers.measureTiming(page, async () => {
        await page.click('[data-testid="uncategorized-filter"]')
        await page.waitForTimeout(200)
        await page.click('[data-testid="uncategorized-filter"]')
      })

      console.log(`Uncategorized detection: ${uncategorizedDetectionTime}ms (requirement: <${requirements.uncategorizedDetection}ms)`)
      expect(uncategorizedDetectionTime).toBeLessThan(requirements.uncategorizedDetection)

      // Test project counting performance
      const projectCountingTime = await phase2Helpers.measureTiming(page, async () => {
        for (const project of testProjects) {
          await page.locator(`[data-testid="project-${project.name}"] [data-testid="task-count"]`).isVisible()
        }
      })

      console.log(`Project counting: ${projectCountingTime}ms (requirement: <${requirements.projectCounting}ms)`)
      expect(projectCountingTime).toBeLessThan(requirements.projectCounting)

      // All requirements met
      console.log('✅ All baseline performance requirements met')
    })
  })
})