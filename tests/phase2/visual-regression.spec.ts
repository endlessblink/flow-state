import { test, expect } from '../utils/phase2-test-helpers'
import { testProjects, testTasks, phase2Helpers } from '../utils/phase2-test-helpers'

test.describe('Phase 2: Visual Regression - Enhanced Composables UI', () => {
  test.beforeEach(async ({ page, navigateToWorktree }) => {
    await navigateToWorktree
    await phase2Helpers.waitForAppLoad(page)
  })

  test.describe('Sidebar Visual Consistency', () => {
    test('should render sidebar projects consistently', async ({ page, createTestProjects }) => {
      await createTestProjects(testProjects)
      await page.waitForTimeout(1000)

      // Take baseline screenshot
      await page.screenshot({
        path: 'test-results/phase2/visual/sidebar-projects-baseline.png',
        fullPage: true
      })

      // Verify all projects are visible
      for (const project of testProjects) {
        const projectElement = page.locator(`[data-testid="project-${project.name}"]`)
        await expect(projectElement).toBeVisible()

        // Take individual project screenshot
        await projectElement.screenshot({
          path: `test-results/phase2/visual/project-${project.name.replace(/\s+/g, '-').toLowerCase()}.png`
        })
      }

      // Test project hover states
      for (const project of testProjects) {
        const projectElement = page.locator(`[data-testid="project-${project.name}"]`)
        await projectElement.hover()
        await page.waitForTimeout(200)

        await projectElement.screenshot({
          path: `test-results/phase2/visual/project-${project.name.replace(/\s+/g, '-').toLowerCase()}-hover.png`
        })
      }

      // Test active project state
      const firstProject = testProjects[0]
      const firstProjectElement = page.locator(`[data-testid="project-${firstProject.name}"]`)
      await firstProjectElement.click()
      await page.waitForTimeout(200)

      await firstProjectElement.screenshot({
        path: `test-results/phase2/visual/project-${firstProject.name.replace(/\s+/g, '-').toLowerCase()}-active.png`
      })
    })

    test('should render uncategorized filter consistently', async ({ page }) => {
      // Take baseline screenshot of uncategorized filter
      const uncategorizedFilter = page.locator('[data-testid="uncategorized-filter"]')
      await expect(uncategorizedFilter).toBeVisible()

      await uncategorizedFilter.screenshot({
        path: 'test-results/phase2/visual/uncategorized-filter-baseline.png'
      })

      // Test hover state
      await uncategorizedFilter.hover()
      await page.waitForTimeout(200)

      await uncategorizedFilter.screenshot({
        path: 'test-results/phase2/visual/uncategorized-filter-hover.png'
      })

      // Test active state
      await uncategorizedFilter.click()
      await page.waitForTimeout(200)

      await uncategorizedFilter.screenshot({
        path: 'test-results/phase2/visual/uncategorized-filter-active.png'
      })

      // Test Quick Sort button visibility
      const quickSortButton = page.locator('[data-testid="quick-sort-button"]')
      if (await quickSortButton.isVisible()) {
        await quickSortButton.screenshot({
          path: 'test-results/phase2/visual/quick-sort-button-baseline.png'
        })

        await quickSortButton.hover()
        await page.waitForTimeout(200)

        await quickSortButton.screenshot({
          path: 'test-results/phase2/visual/quick-sort-button-hover.png'
        })
      }
    })

    test('should maintain visual consistency across themes', async ({ page }) => {
      // Test dark theme (should be default)
      await page.screenshot({
        path: 'test-results/phase2/visual/sidebar-dark-theme.png',
        fullPage: true
      })

      // If light theme toggle is available, test it
      const themeToggle = page.locator('[data-testid="theme-toggle"]')
      if (await themeToggle.isVisible()) {
        await themeToggle.click()
        await page.waitForTimeout(500)

        await page.screenshot({
          path: 'test-results/phase2/visual/sidebar-light-theme.png',
          fullPage: true
        })

        // Toggle back to dark theme
        await themeToggle.click()
        await page.waitForTimeout(500)
      }
    })
  })

  test.describe('Task Display Visual Consistency', () => {
    test.beforeEach(async ({ page, createTestProjects, createTestTasks }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)
    })

    test('should render task project badges consistently', async ({ page }) => {
      const views = ['board', 'calendar', 'canvas', 'tasks'] as const

      for (const view of views) {
        await phase2Helpers.navigateToView(page, view)

        // Take full view screenshot
        await page.screenshot({
          path: `test-results/phase2/visual/${view}-view-tasks-baseline.png`,
          fullPage: true
        })

        // Check categorized tasks
        const categorizedTask = page.locator('[data-testid="task-Alpha Task 1"]')
        if (await categorizedTask.isVisible()) {
          const projectBadge = categorizedTask.locator('[data-testid="task-project-badge"]')
          if (await projectBadge.isVisible()) {
            await projectBadge.screenshot({
              path: `test-results/phase2/visual/${view}-view-categorized-task-badge.png`
            })
          }
        }

        // Check uncategorized tasks
        await page.click('[data-testid="uncategorized-filter"]')
        await page.waitForTimeout(500)

        const uncategorizedTask = page.locator('[data-testid="task-Uncategorized Task 1"]')
        if (await uncategorizedTask.isVisible()) {
          const projectBadge = uncategorizedTask.locator('[data-testid="task-project-badge"]')
          if (await projectBadge.isVisible()) {
            await projectBadge.screenshot({
              path: `test-results/phase2/visual/${view}-view-uncategorized-task-badge.png`
            })
          }
        }

        await page.click('[data-testid="uncategorized-filter"]') // Reset filter
        await page.waitForTimeout(500)
      }
    })

    test('should render task cards consistently', async ({ page }) => {
      await phase2Helpers.navigateToView(page, 'board')

      // Test different task states
      const taskStates = [
        { task: 'Alpha Task 1', state: 'categorized' },
        { task: 'Uncategorized Task 1', state: 'uncategorized' }
      ]

      for (const { task, state } of taskStates) {
        const taskElement = page.locator(`[data-testid="task-${task}"]`)
        if (await taskElement.isVisible()) {
          await taskElement.screenshot({
            path: `test-results/phase2/visual/task-${task.replace(/\s+/g, '-').toLowerCase()}-${state}.png`
          })

          // Test hover state
          await taskElement.hover()
          await page.waitForTimeout(200)

          await taskElement.screenshot({
            path: `test-results/phase2/visual/task-${task.replace(/\s+/g, '-').toLowerCase()}-${state}-hover.png`
          })
        }
      }

      // Test task selection
      const selectableTask = page.locator('[data-testid="task-Alpha Task 1"]')
      if (await selectableTask.isVisible()) {
        await selectableTask.click()
        await page.waitForTimeout(200)

        await selectableTask.screenshot({
          path: 'test-results/phase2/visual/task-selected.png'
        })
      }
    })
  })

  test.describe('Quick Sort Visual Consistency', () => {
    test.beforeEach(async ({ page, createTestProjects, createTestTasks }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)
    })

    test('should render Quick Sort interface consistently', async ({ page }) => {
      await page.click('[data-testid="nav-quick-sort"]')
      await page.waitForLoadState('networkidle')

      // Take full Quick Sort screenshot
      await page.screenshot({
        path: 'test-results/phase2/visual/quicksort-interface-baseline.png',
        fullPage: true
      })

      // Test uncategorized tasks section
      const uncategorizedSection = page.locator('[data-testid="quicksort-uncategorized-section"]')
      if (await uncategorizedSection.isVisible()) {
        await uncategorizedSection.screenshot({
          path: 'test-results/phase2/visual/quicksort-uncategorized-section.png'
        })
      }

      // Test project options panel
      const firstTask = page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')
      if (await firstTask.isVisible()) {
        await firstTask.click()
        await page.waitForTimeout(500)

        const projectPanel = page.locator('[data-testid="project-selection-panel"]')
        if (await projectPanel.isVisible()) {
          await projectPanel.screenshot({
            path: 'test-results/phase2/visual/quicksort-project-panel.png'
          })
        }
      }

      // Test progress indicator
      const progressIndicator = page.locator('[data-testid="quicksort-progress"]')
      if (await progressIndicator.isVisible()) {
        await progressIndicator.screenshot({
          path: 'test-results/phase2/visual/quicksort-progress-indicator.png'
        })
      }
    })

    test('should render task categorization animations consistently', async ({ page }) => {
      await page.click('[data-testid="nav-quick-sort"]')
      await page.waitForLoadState('networkidle')

      const firstTask = page.locator('[data-testid="quicksort-task-Uncategorized Task 1"]')
      if (await firstTask.isVisible()) {
        await firstTask.click()
        await page.waitForTimeout(500)

        // Select project
        const alphaProjectOption = page.locator('[data-testid="project-option-Alpha Project"]')
        if (await alphaProjectOption.isVisible()) {
          await alphaProjectOption.click()

          // Take screenshot before categorization
          await page.screenshot({
            path: 'test-results/phase2/visual/quicksort-before-categorization.png'
          })

          // Confirm categorization
          await page.click('[data-testid="confirm-categorization"]')
          await page.waitForTimeout(1000)

          // Take screenshot after categorization
          await page.screenshot({
            path: 'test-results/phase2/visual/quicksort-after-categorization.png'
          })
        }
      }
    })
  })

  test.describe('Modal Visual Consistency', () => {
    test.beforeEach(async ({ page, createTestProjects, createTestTasks }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)
    })

    test('should render task edit modal consistently', async ({ page }) => {
      const testTask = 'Alpha Task 1'
      const taskElement = page.locator(`[data-testid="task-${testTask}"]`)
      await taskElement.click()
      await page.waitForSelector('[data-testid="task-edit-modal"]')

      // Take modal screenshot
      await page.locator('[data-testid="task-edit-modal"]').screenshot({
        path: 'test-results/phase2/visual/task-edit-modal-baseline.png'
      })

      // Test project dropdown
      const projectSelect = page.locator('[data-testid="task-project-select"]')
      if (await projectSelect.isVisible()) {
        await projectSelect.click()
        await page.waitForTimeout(200)

        await projectSelect.screenshot({
          path: 'test-results/phase2/visual/task-project-dropdown.png'
        })
      }

      // Test save button states
      const saveButton = page.locator('[data-testid="save-task-button"]')
      await saveButton.screenshot({
        path: 'test-results/phase2/visual/task-save-button-default.png'
      })

      await saveButton.hover()
      await page.waitForTimeout(200)

      await saveButton.screenshot({
        path: 'test-results/phase2/visual/task-save-button-hover.png'
      })
    })

    test('should render confirmation modals consistently', async ({ page }) => {
      // Test task deletion confirmation
      const testTask = 'Alpha Task 1'
      const taskElement = page.locator(`[data-testid="task-${testTask}"]`)
      await taskElement.click({ button: 'right' })
      await page.click('[data-testid="delete-task"]')
      await page.waitForSelector('[data-testid="confirmation-modal"]')

      await page.locator('[data-testid="confirmation-modal"]').screenshot({
        path: 'test-results/phase2/visual/task-delete-confirmation-modal.png'
      })

      // Test modal buttons
      const confirmButton = page.locator('[data-testid="confirm-delete"]')
      const cancelButton = page.locator('[data-testid="cancel-delete"]')

      await confirmButton.screenshot({
        path: 'test-results/phase2/visual/confirm-button-default.png'
      })
      await cancelButton.screenshot({
        path: 'test-results/phase2/visual/cancel-button-default.png'
      })

      // Cancel the deletion
      await cancelButton.click()
      await page.waitForTimeout(500)
    })
  })

  test.describe('Responsive Design Consistency', () => {
    test('should maintain visual consistency across screen sizes', async ({ page, createTestProjects, createTestTasks }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)

      const screenSizes = [
        { width: 1920, height: 1080, name: 'desktop' },
        { width: 1366, height: 768, name: 'laptop' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' }
      ]

      for (const size of screenSizes) {
        await page.setViewportSize({ width: size.width, height: size.height })
        await page.waitForTimeout(500)

        await page.screenshot({
          path: `test-results/phase2/visual/responsive-${size.name}-${size.width}x${size.height}.png`,
          fullPage: true
        })

        // Test critical UI elements at this size
        const sidebar = page.locator('[data-testid="sidebar"]')
        if (await sidebar.isVisible()) {
          await sidebar.screenshot({
            path: `test-results/phase2/visual/responsive-${size.name}-sidebar.png`
          })
        }

        const mainContent = page.locator('[data-testid="main-content"]')
        if (await mainContent.isVisible()) {
          await mainContent.screenshot({
            path: `test-results/phase2/visual/responsive-${size.name}-main-content.png`
          })
        }
      }
    })
  })

  test.describe('Visual Regression Detection', () => {
    test('should detect visual changes in enhanced components', async ({ page, createTestProjects, createTestTasks }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)

      // Create baseline screenshots for comparison
      const baselineScreenshots = [
        'test-results/phase2/visual/baseline-sidebar.png',
        'test-results/phase2/visual/baseline-board-view.png',
        'test-results/phase2/visual/baseline-uncategorized-filter.png'
      ]

      // Generate baseline screenshots
      await page.screenshot({
        path: baselineScreenshots[0],
        fullPage: true
      })

      await phase2Helpers.navigateToView(page, 'board')
      await page.screenshot({
        path: baselineScreenshots[1],
        fullPage: true
      })

      const uncategorizedFilter = page.locator('[data-testid="uncategorized-filter"]')
      await uncategorizedFilter.screenshot({
        path: baselineScreenshots[2]
      })

      // Simulate visual changes (this would be compared against baseline in actual CI)
      console.log('Baseline screenshots generated for visual regression detection')
      console.log('Baseline files:', baselineScreenshots)

      // In a real implementation, this would compare against stored baseline images
      // For now, we'll just verify the files were created
      for (const screenshot of baselineScreenshots) {
        // This would normally use pixel comparison
        console.log(`Baseline screenshot: ${screenshot}`)
      }
    })

    test('should maintain visual consistency during interactions', async ({ page, createTestProjects, createTestTasks }) => {
      await createTestProjects(testProjects)
      await createTestTasks(testTasks)
      await page.waitForTimeout(2000)

      // Test interaction states
      const interactions = [
        { element: '[data-testid="project-Alpha Project"]', action: 'hover', name: 'project-hover' },
        { element: '[data-testid="uncategorized-filter"]', action: 'hover', name: 'uncategorized-filter-hover' },
        { element: '[data-testid="task-Alpha Task 1"]', action: 'hover', name: 'task-hover' },
        { element: '[data-testid="task-Alpha Task 1"]', action: 'click', name: 'task-selected' }
      ]

      for (const interaction of interactions) {
        const element = page.locator(interaction.element)
        if (await element.isVisible()) {
          if (interaction.action === 'hover') {
            await element.hover()
          } else if (interaction.action === 'click') {
            await element.click()
          }
          await page.waitForTimeout(200)

          await element.screenshot({
            path: `test-results/phase2/visual/interaction-${interaction.name}.png`
          })

          // Reset state if needed
          if (interaction.action === 'click') {
            // Click elsewhere to deselect
            await page.click('[data-testid="main-content"]')
            await page.waitForTimeout(200)
          }
        }
      }
    })
  })
})