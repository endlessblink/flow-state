import { test, expect } from '../../fixtures/auth'
import {
  dismissBlockingModals,
  registerModalHandlers,
  suppressOnboarding,
  MOBILE_PHONE_OPTIONS,
} from './mobile-helpers'

test.describe('Mobile Calendar View', () => {
  test.use(MOBILE_PHONE_OPTIONS)

  test.beforeEach(async ({ page }) => {
    await registerModalHandlers(page)
    await suppressOnboarding(page)
  })

  // Navigate to calendar via mobile nav (ensures app is fully initialized)
  async function navigateToCalendar(page: import('@playwright/test').Page) {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: 'Calendar' }).click()
    await expect(page).toHaveURL(/#\/mobile-calendar$/, { timeout: 10000 })
    await expect(page.locator('.mobile-calendar')).toBeVisible({ timeout: 10000 })
  }

  test('renders mobile calendar with time grid', async ({ page }) => {
    await navigateToCalendar(page)

    // Calendar header with date navigation
    const header = page.locator('.calendar-header')
    await expect(header).toBeVisible()

    // Date label should show current date
    const dateLabel = page.locator('.date-label .date-text')
    await expect(dateLabel).toBeVisible()
    const dateText = await dateLabel.textContent()
    expect(dateText?.trim().length).toBeGreaterThan(0)

    // Time grid should be rendered
    const timeGrid = page.locator('.time-grid')
    await expect(timeGrid).toBeVisible()
  })

  test('date navigation arrows change the displayed date', async ({ page }) => {
    await navigateToCalendar(page)

    const dateText = page.locator('.date-label .date-text')
    await expect(dateText).toBeVisible()

    const initialDate = await dateText.textContent()

    // Navigate to next day
    const nextBtn = page.locator('.date-nav .nav-btn').last()
    await nextBtn.click()

    // Date should change
    await expect(dateText).not.toHaveText(initialDate!)
  })

  test('previous day navigation works', async ({ page }) => {
    await navigateToCalendar(page)

    const dateText = page.locator('.date-label .date-text')
    await expect(dateText).toBeVisible()

    const initialDate = await dateText.textContent()

    // Navigate to previous day
    const prevBtn = page.locator('.date-nav .nav-btn').first()
    await prevBtn.click()

    await expect(dateText).not.toHaveText(initialDate!)
  })

  test('today badge appears when viewing today', async ({ page }) => {
    await navigateToCalendar(page)

    const todayBadge = page.locator('.today-badge')
    await expect(todayBadge).toBeVisible()
    await expect(todayBadge).toHaveText('Today')
  })

  test('task count is displayed in header', async ({ page }) => {
    await navigateToCalendar(page)

    const taskCount = page.locator('.task-count')
    await expect(taskCount).toBeVisible()
    const countText = await taskCount.textContent()
    expect(countText).toMatch(/\d+ tasks?/)
  })

  test('time rows show hour labels', async ({ page }) => {
    await navigateToCalendar(page)

    const timeRows = page.locator('.time-row')
    await expect(timeRows.first()).toBeVisible()

    const rowCount = await timeRows.count()
    expect(rowCount).toBeGreaterThanOrEqual(12)

    const firstLabel = timeRows.first().locator('.time-label')
    await expect(firstLabel).toBeVisible()
  })

  test('go-to-today button resets to current date', async ({ page }) => {
    await navigateToCalendar(page)

    // Navigate away from today
    const nextBtn = page.locator('.date-nav .nav-btn').last()
    await nextBtn.click()
    await nextBtn.click()

    // Today badge should be gone
    await expect(page.locator('.today-badge')).toBeHidden()

    // Click the date label to go back to today
    await page.locator('.date-label').click()

    // Today badge should reappear
    await expect(page.locator('.today-badge')).toBeVisible()
  })
})
