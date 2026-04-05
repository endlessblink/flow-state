import { test, expect } from '../../fixtures/auth'
import {
  dismissBlockingModals,
  expectMobileShell,
  registerModalHandlers,
  suppressOnboarding,
  MOBILE_PHONE_OPTIONS,
} from './mobile-helpers'

test.describe('Mobile Inbox', () => {
  test.use(MOBILE_PHONE_OPTIONS)

  test.beforeEach(async ({ page }) => {
    await registerModalHandlers(page)
    await suppressOnboarding(page)
  })

  test('renders mobile inbox layout', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)

    await expect(page.locator('.mobile-inbox')).toBeVisible({ timeout: 10000 })
    await expectMobileShell(page)
  })

  test('quick-add FAB opens task creation sheet', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-inbox')).toBeVisible({ timeout: 10000 })

    // FAB (floating action button) — labelled "Add task" per ARIA snapshot
    const fab = page.getByRole('button', { name: /add task/i })
    await expect(fab).toBeVisible()
    await fab.click()

    // Task creation sheet opens with "Task name" input
    const input = page.getByPlaceholder(/task name/i)
    await expect(input).toBeVisible({ timeout: 5000 })

    // Cancel to close the sheet
    const cancelBtn = page.getByRole('button', { name: /cancel/i })
    await cancelBtn.click()
  })

  test('filter chips are visible and interactive', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-inbox')).toBeVisible({ timeout: 10000 })

    // Filter chips — buttons like "All", "Today", "This Week", "Overdue"
    const allFilter = page.getByRole('button', { name: 'All' })
    await expect(allFilter).toBeVisible({ timeout: 5000 })

    const todayFilter = page.getByRole('button', { name: 'Today' }).nth(1) // nth(1) to skip the tab button
    await expect(todayFilter).toBeVisible()

    // Click a filter chip and verify it becomes active
    await todayFilter.click()
    await expect(todayFilter).toHaveClass(/active/)
  })

  test('group-by dropdown opens with options', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-inbox')).toBeVisible({ timeout: 10000 })

    const groupByBtn = page.locator('.group-by-control .control-btn')
    await expect(groupByBtn).toBeVisible({ timeout: 5000 })
    await groupByBtn.click()

    const dropdown = page.locator('.group-by-control .dropdown-menu')
    await expect(dropdown).toBeVisible()

    // Verify options exist
    const items = dropdown.locator('.dropdown-item')
    const count = await items.count()
    expect(count).toBeGreaterThanOrEqual(2)

    // Click somewhere else to dismiss
    await page.locator('.mobile-inbox').click({ position: { x: 10, y: 10 }, force: true })
  })

  test('canvas toggle button is visible', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-inbox')).toBeVisible({ timeout: 10000 })

    const canvasBtn = page.getByRole('button', { name: 'Canvas' })
    await expect(canvasBtn).toBeVisible()
  })

  test('hide-done toggle is accessible', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-inbox')).toBeVisible({ timeout: 10000 })

    // The toggle button shows/hides completed tasks
    const hideDoneBtn = page.locator('.hide-done-btn')
    await expect(hideDoneBtn).toBeVisible()
    await hideDoneBtn.click()
    // Button should still exist after toggle
    await expect(hideDoneBtn).toBeVisible()
  })
})
