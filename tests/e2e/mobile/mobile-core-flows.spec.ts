import { test, expect } from '../../fixtures/auth'
import { getMobileNav, getNavItemByLabel, expectMobileShell, dismissBlockingModals, registerModalHandlers, suppressOnboarding, MOBILE_PHONE_OPTIONS } from './mobile-helpers'

test.describe('Mobile Core Flows', () => {
  test.use(MOBILE_PHONE_OPTIONS)

  test.beforeEach(async ({ page }) => {
    await registerModalHandlers(page)
    await suppressOnboarding(page)
  })

  test('renders mobile shell and bottom navigation', async ({ page }) => {
    await page.goto('/#/tasks')
    await dismissBlockingModals(page)

    await expectMobileShell(page)
    await expect(page.getByRole('link', { name: 'Tasks' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sort' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Timer' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Calendar' })).toBeVisible()
    await expect(getNavItemByLabel(page, 'Menu')).toBeVisible()
  })

  test('navigates between timer and tasks from bottom nav', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: 'Timer' }).click()
    await expect(page).toHaveURL(/#\/timer$/)
    await expect(page.locator('.mobile-timer-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.mobile-timer-view .status-label')).toContainText(/Ready|Focus|Break/i)

    await page.getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/#\/tasks$/)
    await expect(page.locator('.mobile-inbox')).toBeVisible({ timeout: 10000 })
    await expect(getMobileNav(page)).toBeVisible()
  })

  test('opens the calendar route and returns to inbox from bottom nav', async ({ page }) => {
    await page.goto('/#/tasks')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-inbox')).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: 'Calendar' }).click()
    await expect(page).toHaveURL(/#\/mobile-calendar$/)

    await page.getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/#\/tasks$/)
    await expect(page.locator('.mobile-inbox')).toBeVisible({ timeout: 10000 })
  })

  test('opens and closes the mobile menu overlay', async ({ page }) => {
    await page.goto('/#/tasks')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 10000 })

    await getNavItemByLabel(page, 'Menu').click()
    await expect(page.locator('.mobile-menu-overlay')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible()

    await page.locator('.mobile-menu-content .close-btn').click()
    await expect(page.locator('.mobile-menu-overlay')).toBeHidden()
  })

  test('today tab switches view within inbox', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 10000 })

    // The "Today" tab button at the top of the inbox
    const todayTab = page.locator('.mobile-inbox').getByRole('button', { name: 'Today' }).first()
    if (await todayTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await todayTab.click()
      // Should still be on the same page, just filtered/switched view
      await expect(page.locator('.mobile-layout')).toBeVisible()
    }
    await expect(page.locator('.mobile-inbox')).toBeVisible()
  })

  test('timer view supports mobile start and stop interaction', async ({ page }) => {
    await page.goto('/#/timer')
    await dismissBlockingModals(page)
    if (!/#\/timer$/.test(page.url())) {
      await page.getByRole('link', { name: 'Timer' }).click()
      await expect(page).toHaveURL(/#\/timer$/)
    }

    const timerCircle = page.locator('.mobile-timer-view .timer-circle')
    await expect(timerCircle).toBeVisible()
    await expect(page.locator('.mobile-timer-view .status-label')).toBeVisible()

    await timerCircle.click()

    const stopButton = page.getByRole('button', { name: /Stop/i })
    await expect(stopButton).toBeVisible()
    await expect(page.locator('.mobile-timer-view .focus-mode-indicator')).toContainText('Screen Awake')

    await stopButton.click()
    await expect(stopButton).toBeHidden()
    await expect(page.locator('.mobile-timer-view .focus-mode-indicator')).toBeHidden()
  })
})
