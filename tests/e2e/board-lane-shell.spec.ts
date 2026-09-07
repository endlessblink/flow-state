import { expect, test } from '@playwright/test'

const seedFocusedTimeline = async (page: import('@playwright/test').Page, locale = 'en') => {
  await page.goto('/src/main.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ locale }) => {
    const now = new Date().toISOString()
    const titles = ['Shape the release', 'Build the focused timeline', 'Review the shipped experience']
    const priorities = ['medium', 'high', 'low']
    const tasks = titles.map((title, index) => ({
      id: `task2068-synthetic-${index + 1}`,
      title,
      description: 'Synthetic TASK-2068 acceptance data only.',
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
  }, { locale })
}

test('TASK-2068 renders the Board as a focused task sequence', async ({ page }) => {
  await seedFocusedTimeline(page)
  await page.goto('/#/board')
  await expect(page.locator('.board-view-wrapper')).toBeVisible({ timeout: 30_000 })
  await page.locator('.view-type-btn').first().click()

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

  await page.screenshot({ path: 'docs/previews/task-2068/board-focus-timeline-ltr.png', fullPage: true })
})

test('TASK-2068 keeps the timeline usable in RTL', async ({ page }) => {
  await seedFocusedTimeline(page, 'he')
  await page.goto('/#/board')

  const board = page.locator('.board-view-wrapper')
  await expect(board).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.locator('.view-type-btn').first().click()
  const timeline = page.locator('.task-focus-timeline')
  await expect(timeline).toBeVisible({ timeout: 30_000 })
  await timeline.getByRole('button', { name: 'המשימה הבאה', exact: true }).click()
  await expect(timeline.locator('.task-focus-card--active')).toContainText('Build the focused timeline')
  await expect(timeline.locator('.task-focus-card--previous')).toBeVisible()
  await expect(timeline.locator('.task-focus-card--next')).toBeVisible()

  await page.screenshot({ path: 'docs/previews/task-2068/board-focus-timeline-rtl.png', fullPage: true })
})
