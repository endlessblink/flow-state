import { test as base, expect } from '@playwright/test'

// Re-export expect for test files
export { expect }

// Test ports for comparison testing
export const WORKTREE_PORT = 5549
export const MAIN_BRANCH_PORT = 5550
export const BASE_URL = 'http://localhost'

// Test data for Phase 2 enhanced composables
export interface TestProject {
  id: string
  name: string
  color?: string
  description?: string
}

export interface TestTask {
  id: string
  title: string
  description?: string
  projectId?: string | null
  status?: string
  priority?: string
  dueDate?: string
}

// Enhanced test fixtures for Phase 2 testing
export const testProjects: TestProject[] = [
  {
    id: 'proj-alpha',
    name: 'Alpha Project',
    color: '#3b82f6',
    description: 'First test project'
  },
  {
    id: 'proj-beta',
    name: 'Beta Project',
    color: '#10b981',
    description: 'Second test project'
  },
  {
    id: 'proj-gamma',
    name: 'Gamma Project',
    color: '#f59e0b',
    description: 'Third test project'
  }
]

export const testTasks: TestTask[] = [
  // Uncategorized tasks (projectId: null or undefined)
  {
    id: 'task-uncat-1',
    title: 'Uncategorized Task 1',
    description: 'First uncategorized task',
    projectId: null
  },
  {
    id: 'task-uncat-2',
    title: 'Uncategorized Task 2',
    description: 'Second uncategorized task',
    projectId: undefined
  },
  {
    id: 'task-uncat-3',
    title: 'Uncategorized Task 3',
    description: 'Third uncategorized task',
    projectId: ''
  },
  // Categorized tasks
  {
    id: 'task-alpha-1',
    title: 'Alpha Task 1',
    description: 'First alpha project task',
    projectId: 'proj-alpha'
  },
  {
    id: 'task-alpha-2',
    title: 'Alpha Task 2',
    description: 'Second alpha project task',
    projectId: 'proj-alpha'
  },
  {
    id: 'task-beta-1',
    title: 'Beta Task 1',
    description: 'First beta project task',
    projectId: 'proj-beta'
  },
  // Legacy tasks with projectId: '1' (should be treated as uncategorized)
  {
    id: 'task-legacy-1',
    title: 'Legacy Default Task',
    description: 'Task with legacy default project',
    projectId: '1'
  }
]

// Custom test fixture with Phase 2 specific helpers
export const test = base.extend({
  // Navigate to specific port for comparison testing
  navigateToWorktree: async ({ page }, use) => {
    await page.goto(`${BASE_URL}:${WORKTREE_PORT}`)
    await page.waitForLoadState('networkidle')
    await use(page)
  },

  navigateToMainBranch: async ({ page }, use) => {
    await page.goto(`${BASE_URL}:${MAIN_BRANCH_PORT}`)
    await page.waitForLoadState('networkidle')
    await use(page)
  },

  // Create test projects
  createTestProjects: async ({ page }, use) => {
    const createProjects = async (projects: TestProject[]) => {
      for (const project of projects) {
        await page.click('[data-testid="create-project-button"]', { timeout: 10000 })
        await page.fill('[data-testid="project-name-input"]', project.name)
        if (project.description) {
          await page.fill('[data-testid="project-description-input"]', project.description)
        }
        if (project.color) {
          await page.click(`[data-testid="color-${project.color}"]`)
        }
        await page.click('[data-testid="save-project-button"]')
        await page.waitForTimeout(500) // Wait for project creation
      }
    }
    await use(createProjects)
  },

  // Create test tasks
  createTestTasks: async ({ page }, use) => {
    const createTasks = async (tasks: TestTask[]) => {
      for (const task of tasks) {
        // Quick task creation
        await page.fill('[data-testid="quick-task-input"]', task.title)
        await page.press('[data-testid="quick-task-input"]', 'Enter')
        await page.waitForTimeout(500)

        // Edit task to set proper properties
        await page.click(`[data-testid="task-${task.title}"]`, { timeout: 10000 })
        await page.waitForSelector('[data-testid="task-edit-modal"]')

        if (task.description) {
          await page.fill('[data-testid="task-description"]', task.description)
        }

        if (task.projectId !== undefined) {
          if (task.projectId === null) {
            // Select "Unknown Project" or leave unassigned
            await page.selectOption('[data-testid="task-project-select"]', { label: 'Unknown Project' })
          } else if (task.projectId === '1') {
            // Legacy default project - this should appear as uncategorized
            await page.selectOption('[data-testid="task-project-select"]', { label: 'My Tasks' })
          } else {
            // Find and select the test project
            const project = testProjects.find(p => p.id === task.projectId)
            if (project) {
              await page.selectOption('[data-testid="task-project-select"]', project.name)
            }
          }
        }

        await page.click('[data-testid="save-task-button"]')
        await page.waitForTimeout(500)
      }
    }
    await use(createTasks)
  },

  // Get uncategorized task count
  getUncategorizedTaskCount: async ({ page }, use) => {
    const getUncategorizedCount = async () => {
      const badge = page.locator('[data-testid="uncategorized-task-count"]')
      if (await badge.isVisible()) {
        const text = await badge.textContent()
        return parseInt(text || '0', 10)
      }
      return 0
    }
    await use(getUncategorizedCount)
  },

  // Get project task counts
  getProjectTaskCounts: async ({ page }, use) => {
    const getProjectCounts = async () => {
      const counts: Record<string, number> = {}

      for (const project of testProjects) {
        const projectElement = page.locator(`[data-testid="project-${project.name}"]`)
        if (await projectElement.isVisible()) {
          const badge = projectElement.locator('[data-testid="task-count"]')
          if (await badge.isVisible()) {
            const text = await badge.textContent()
            counts[project.name] = parseInt(text || '0', 10)
          }
        }
      }

      return counts
    }
    await use(getProjectCounts)
  },

  // Take comparison screenshots
  takeComparisonScreenshot: async ({ page }, use) => {
    const takeScreenshot = async (name: string) => {
      await page.screenshot({
        path: `test-results/phase2/comparisons/${name}.png`,
        fullPage: true
      })
    }
    await use(takeScreenshot)
  }
})

// Helper functions for Phase 2 testing
export const phase2Helpers = {
  // Wait for app to fully load
  waitForAppLoad: async (page: any) => {
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 })
    await page.waitForLoadState('networkidle')
  },

  // Navigate to specific view
  navigateToView: async (page: any, view: 'board' | 'calendar' | 'canvas' | 'tasks') => {
    await page.click(`[data-testid="nav-${view}"]`)
    await page.waitForLoadState('networkidle')
  },

  // Start Quick Sort session
  startQuickSort: async (page: any) => {
    await page.click('[data-testid="uncategorized-filter"]')
    await page.click('[data-testid="quick-sort-button"]')
    await page.waitForSelector('[data-testid="quick-sort-modal"]')
  },

  // Check if element has specific class or attribute
  hasElementState: async (page: any, selector: string, state: 'visible' | 'hidden' | 'enabled' | 'disabled') => {
    const element = page.locator(selector)
    switch (state) {
      case 'visible':
        return await element.isVisible()
      case 'hidden':
        return !(await element.isVisible())
      case 'enabled':
        return await element.isEnabled()
      case 'disabled':
        return !(await element.isEnabled())
      default:
        return false
    }
  },

  // Get text content safely
  getTextContent: async (page: any, selector: string) => {
    const element = page.locator(selector)
    if (await element.isVisible()) {
      return await element.textContent()
    }
    return null
  },

  // Measure performance timing
  measureTiming: async (page: any, action: () => Promise<void>) => {
    const start = Date.now()
    await action()
    return Date.now() - start
  }
}

// Custom matchers for Phase 2 testing
export const phase2Expect = {
  // Assert project display name consistency
  toHaveConsistentProjectName: async (page: any, projectName: string) => {
    const locations = [
      '[data-testid="sidebar-project-name"]',
      '[data-testid="page-title"]',
      '[data-testid="task-project-name"]'
    ]

    for (const selector of locations) {
      const element = page.locator(selector)
      if (await element.isVisible()) {
        const text = await element.textContent()
        expect(text).toContain(projectName)
      }
    }
  },

  // Assert uncategorized task count accuracy
  toHaveCorrectUncategorizedCount: async (page: any, expectedCount: number) => {
    const badge = page.locator('[data-testid="uncategorized-task-count"]')
    if (expectedCount > 0) {
      await expect(badge).toBeVisible()
      const actualCount = parseInt(await badge.textContent() || '0', 10)
      expect(actualCount).toBe(expectedCount)
    } else {
      await expect(badge).not.toBeVisible()
    }
  },

  // Assert project task count accuracy
  toHaveCorrectProjectCounts: async (page: any, expectedCounts: Record<string, number>) => {
    for (const [projectName, expectedCount] of Object.entries(expectedCounts)) {
      const projectElement = page.locator(`[data-testid="project-${projectName}"]`)
      if (await projectElement.isVisible()) {
        const badge = projectElement.locator('[data-testid="task-count"]')
        if (expectedCount > 0) {
          await expect(badge).toBeVisible()
          const actualCount = parseInt(await badge.textContent() || '0', 10)
          expect(actualCount).toBe(expectedCount)
        } else {
          await expect(badge).not.toBeVisible()
        }
      }
    }
  }
}