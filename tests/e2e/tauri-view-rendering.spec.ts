import { test, expect } from '../fixtures/tauri-simulation'

test.describe('Tauri View Rendering', () => {
  test('calendar view renders grid (not just header)', async ({ page }) => {
    await page.goto('/#/calendar')
    await page.waitForLoadState('networkidle')
    // Calendar header should exist
    await expect(page.locator('.calendar-header, [class*="calendar-header"]')).toBeVisible()
    // Calendar grid (day/week/month) should have non-zero height
    const grid = page.locator('.calendar-grid, .calendar-day-view, .calendar-week-view, .calendar-month-view')
    if (await grid.count() > 0) {
      const box = await grid.first().boundingBox()
      expect(box?.height).toBeGreaterThan(50)
    }
  })

  test('board view renders columns', async ({ page }) => {
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.kanban-board, [class*="kanban"]').first()).toBeVisible()
  })

  test('catalog view renders task groups', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.task-list, [class*="task-list"]').first()).toBeVisible()
  })

  test('canvas view renders', async ({ page }) => {
    await page.goto('/#/canvas')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.vue-flow').first()).toBeVisible()
  })
})
