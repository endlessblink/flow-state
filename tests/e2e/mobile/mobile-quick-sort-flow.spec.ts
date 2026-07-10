import { test, expect } from '../../fixtures/auth'
import {
  dismissBlockingModals,
  registerModalHandlers,
  suppressOnboarding,
  MOBILE_PHONE_OPTIONS,
} from './mobile-helpers'

test.describe('Mobile Quick Sort Flow', () => {
  test.use(MOBILE_PHONE_OPTIONS)

  test.beforeEach(async ({ page }) => {
    await registerModalHandlers(page)
    await suppressOnboarding(page)
  })

  // Navigate to quick-sort via mobile nav (direct URL gets redirected by workspace guard)
  async function navigateToQuickSort(page: import('@playwright/test').Page) {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: 'Sort' }).click()
    await expect(page).toHaveURL(/#\/mobile-quick-sort$/, { timeout: 10000 })
    await expect(page.locator('.mobile-quick-sort')).toBeVisible({ timeout: 10000 })
  }

  test('renders quick sort view via nav', async ({ page }) => {
    await navigateToQuickSort(page)
  })

  test('shows the task pool picker before a new session', async ({ page }) => {
    await navigateToQuickSort(page)

    await expect(page.getByRole('heading', { name: 'Choose what to sort' })).toBeVisible()
    await expect(page.locator('.source-card')).toHaveCount(6)
    await expect(page.getByRole('button', { name: /Uncategorized/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('combines task pools before starting', async ({ page }) => {
    await navigateToQuickSort(page)

    const overdue = page.getByRole('button', { name: /Overdue/ })
    const today = page.getByRole('button', { name: /^Today/ })
    await overdue.click()
    await today.click()

    await expect(overdue).toHaveAttribute('aria-pressed', 'true')
    await expect(today).toHaveAttribute('aria-pressed', 'true')
  })

  test('capture button opens capture input', async ({ page }) => {
    await navigateToQuickSort(page)

    const captureBtn = page.getByRole('button', { name: 'Capture' })
    await expect(captureBtn).toBeVisible()
    await captureBtn.click()

    const captureInput = page.getByPlaceholder(/what needs to be done/i)
    await expect(captureInput).toBeVisible({ timeout: 5000 })
  })

  test('capture input accepts text', async ({ page }) => {
    await navigateToQuickSort(page)

    await page.getByRole('button', { name: 'Capture' }).click()

    const captureInput = page.getByPlaceholder(/what needs to be done/i)
    await expect(captureInput).toBeVisible({ timeout: 5000 })
    await captureInput.fill('New captured task from E2E')

    await expect(captureInput).toHaveValue('New captured task from E2E')
    await captureInput.press('Enter')
  })

  test('sort card shows swipe indicators when task is present', async ({ page }) => {
    await navigateToQuickSort(page)

    const card = page.locator('.task-card')
    const isCardVisible = await card.isVisible({ timeout: 5000 }).catch(() => false)

    if (isCardVisible) {
      const indicators = page.locator('.swipe-indicator')
      const indicatorCount = await indicators.count()
      expect(indicatorCount).toBeGreaterThanOrEqual(2)

      const title = card.locator('.task-title')
      await expect(title).toBeVisible()
    }
  })
})
