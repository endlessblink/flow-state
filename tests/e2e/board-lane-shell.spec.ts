import { expect, test } from '@playwright/test'

const seedBoardViews = async (page: import('@playwright/test').Page, locale = 'en') => {
  await page.goto('/src/main.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ locale }) => {
    const now = new Date().toISOString()
    const titles = ['Shape the release', 'Build the focused timeline', 'Review the shipped experience']
    const priorities = ['medium', 'high', 'low']
    const tasks = titles.map((title, index) => ({
      id: `bug2085-synthetic-${index + 1}`,
      title,
      description: 'Synthetic BUG-2085 acceptance data only.',
      status: 'todo',
      priority: priorities[index],
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '',
      projectId: 'uncategorized',
      isUncategorized: true,
      isInInbox: true,
      canvasDismissed: false,
      order: index,
      createdAt: now,
      updatedAt: now,
    }))

    localStorage.clear()
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
    localStorage.setItem('flowstate-guest-tasks', JSON.stringify(tasks))
    localStorage.setItem('flowstate-app-locale', locale)
    localStorage.setItem('flowstate:board-view-type', 'list')
  }, { locale })
}

test('BUG-2085 restores the Board Kanban and separates the focused timeline', async ({ page }) => {
  await seedBoardViews(page)
  await page.goto('/#/board')
  await expect(page.locator('.board-view-wrapper')).toBeVisible({ timeout: 30_000 })

  await expect(page.locator('.kanban-column').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.task-focus-timeline')).toHaveCount(0)
  await expect(page.locator('.view-type-switcher button')).toHaveCount(3)
  await expect(page.locator('.view-type-switcher')).toContainText('Priority')
  await expect(page.locator('.view-type-switcher')).toContainText('Due Date')
  await expect(page.locator('.view-type-switcher')).toContainText('Category')
  await expect(page.locator('.view-type-switcher')).not.toContainText('List')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('flowstate:board-view-type'))).toBe('priority')

  const mainNavigation = page.locator('.view-tabs')
  await expect(mainNavigation.locator('.view-tab-icon')).toHaveCount(6)
  await expect(mainNavigation.locator('.view-tab-label')).toHaveCount(6)
  await expect(page.getByRole('link', { name: 'Focused task timeline', exact: true })).toContainText('Timeline')

  await page.getByRole('link', { name: 'Focused task timeline', exact: true }).click()
  await expect(page).toHaveURL(/#\/timeline$/)

  const timeline = page.locator('.task-focus-timeline')
  await expect(timeline).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.kanban-column')).toHaveCount(0)

  const activeTask = timeline.locator('.task-focus-card--active')
  await expect(activeTask).toContainText('Shape the release')
  await expect(timeline.locator('.task-focus-card--previous')).toHaveCount(0)
  await expect(timeline.locator('.task-focus-card--next')).toContainText('Build the focused timeline')

  await timeline.getByRole('button', { name: 'Next task', exact: true }).click()
  await expect(activeTask).toContainText('Build the focused timeline')
  await expect(timeline.locator('.task-focus-card--previous')).toContainText('Shape the release')
  await expect(timeline.locator('.task-focus-card--next')).toContainText('Review the shipped experience')

  await page.screenshot({ path: 'test-results/bug-2085-board-focus-timeline-ltr.png', fullPage: true })
})

test('BUG-2085 keeps the separate focused timeline usable in RTL', async ({ page }) => {
  await seedBoardViews(page, 'he')
  await page.goto('/#/timeline')

  const board = page.locator('.board-view-wrapper')
  await expect(board).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const timeline = page.locator('.task-focus-timeline')
  await expect(timeline).toBeVisible({ timeout: 30_000 })
  await timeline.getByRole('button', { name: 'המשימה הבאה', exact: true }).click()
  await expect(timeline.locator('.task-focus-card--active')).toContainText('Build the focused timeline')
  await expect(timeline.locator('.task-focus-card--previous')).toBeVisible()
  await expect(timeline.locator('.task-focus-card--next')).toBeVisible()

  await page.screenshot({ path: 'test-results/bug-2085-board-focus-timeline-rtl.png', fullPage: true })
})
