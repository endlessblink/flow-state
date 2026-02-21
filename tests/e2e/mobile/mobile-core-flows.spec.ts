import { expect, type Page, test } from '@playwright/test'

const getMobileNav = (page: Page) => page.locator('nav.mobile-nav')
const getNavItemByLabel = (page: Page, label: string) =>
  page.locator('.mobile-nav .nav-item').filter({ hasText: new RegExp(`^${label}$`) }).first()

async function expectMobileShell(page: Page) {
  await expect(page.locator('.mobile-layout')).toBeVisible()
  await expect(page.locator('header.mobile-header')).toBeVisible()
  await expect(getMobileNav(page)).toBeVisible()
}

test.describe('Mobile Core Flows', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate-onboarding-v2', JSON.stringify({
        seen: true,
        version: 2,
        dismissedAt: new Date().toISOString(),
      }))
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })
  })

  test('renders mobile shell and bottom navigation', async ({ page }) => {
    await page.goto('/')

    await expectMobileShell(page)
    await expect(page.getByRole('link', { name: 'Tasks' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sort' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Timer' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'AI' })).toBeVisible()
    await expect(getNavItemByLabel(page, 'Menu')).toBeVisible()
  })

  test('navigates between key mobile routes from bottom nav', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Sort' }).click()
    await expect(page).toHaveURL(/#\/mobile-quick-sort$/)
    await expect(page.getByRole('heading', { name: 'Quick Sort' })).toBeVisible()

    await page.getByRole('button', { name: 'Capture' }).click()
    await expect(page.getByPlaceholder('What needs to be done?')).toBeVisible()

    await page.getByRole('link', { name: 'Timer' }).click()
    await expect(page).toHaveURL(/#\/timer$/)
    await expect(page.locator('.mobile-timer-view')).toBeVisible()
    await expect(page.locator('.mobile-timer-view .status-label')).toContainText(/Ready|Focus|Break/i)

    await page.getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/#\/tasks$/)
    await expect(page.locator('.mobile-inbox')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tasks' }).first()).toBeVisible()
  })

  test('opens the AI route and returns to inbox from bottom nav', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page.locator('.mobile-inbox')).toBeVisible()

    await page.getByRole('link', { name: 'AI' }).click()
    await expect(page).toHaveURL(/#\/mobile-ai-chat$/)

    await page.getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/#\/tasks$/)
    await expect(page.locator('.mobile-inbox')).toBeVisible()
  })

  test('opens and closes the mobile menu overlay', async ({ page }) => {
    await page.goto('/today')

    await getNavItemByLabel(page, 'Menu').click()
    await expect(page.locator('.mobile-menu-overlay')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible()
    await expect(page.locator('.mobile-menu-content .menu-item')).toHaveCount(3)

    await page.locator('.mobile-menu-content .close-btn').click()
    await expect(page.locator('.mobile-menu-overlay')).toBeHidden()
  })

  test('today view has stable filter controls, menu behavior, and content states', async ({ page }) => {
    await page.goto('/today')

    await expect(page.locator('.mobile-today')).toBeVisible()
    await expect(page.getByRole('button', { name: /All Projects/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /All Priorities/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /By Time|By Project|By Priority/i })).toBeVisible()
    await expect(page.locator('.mobile-today .time-sections')).toBeVisible()

    const priorityFilter = page.getByRole('button', { name: /All Priorities/i })
    await priorityFilter.click()
    await expect(page.getByRole('button', { name: /High \(P1\)/i })).toBeVisible()
    await page.getByRole('button', { name: /High \(P1\)/i }).click()

    const clearButton = page.getByRole('button', { name: /Clear/i })
    await expect(clearButton).toBeVisible()
    await clearButton.click()
    await expect(clearButton).toBeHidden()

    const sectionCount = await page.locator('.mobile-today .time-section').count()
    const emptyCount = await page.locator('.mobile-today .empty-state').count()
    expect(sectionCount + emptyCount).toBeGreaterThan(0)
  })

  test('timer view supports mobile start and stop interaction', async ({ page }) => {
    await page.goto('/timer')

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
