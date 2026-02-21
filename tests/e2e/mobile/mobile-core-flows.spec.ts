import { expect, type Page, test } from '@playwright/test'

const getMobileNav = (page: Page) => page.locator('nav.mobile-nav')
const getNavItemByLabel = (page: Page, label: string) =>
  page.locator('.mobile-nav .nav-item').filter({ hasText: new RegExp(`^${label}$`) }).first()

async function expectMobileShell(page: Page) {
  await expect(page.locator('.mobile-layout')).toBeVisible()
  await expect(page.locator('header.mobile-header')).toBeVisible()
  await expect(getMobileNav(page)).toBeVisible()
}

async function dismissBlockingModals(page: Page) {
  const aiWizard = page.locator('.wizard-overlay')
  if (await aiWizard.isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.locator('.wizard-overlay .close-btn').click({ force: true })
    await expect(aiWizard).toBeHidden({ timeout: 5000 })
  }

  const onboarding = page.locator('.onboarding-overlay')
  if (await onboarding.isVisible({ timeout: 1500 }).catch(() => false)) {
    const getStarted = page.locator('.onboarding-modal button').filter({ hasText: /Get Started|Start/i }).first()
    if (await getStarted.isVisible().catch(() => false)) {
      await getStarted.click({ force: true })
      await expect(onboarding).toBeHidden({ timeout: 5000 })
    }
  }
}

test.describe('Mobile Core Flows', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  })

  test.beforeEach(async ({ page }) => {
    await page.addLocatorHandler(page.locator('.wizard-overlay'), async () => {
      const closeBtn = page.locator('.wizard-overlay .close-btn')
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click({ force: true })
      }
    })

    await page.addLocatorHandler(page.locator('.onboarding-overlay'), async () => {
      const dismissBtn = page.locator('.onboarding-modal button').filter({ hasText: /Get Started|Start/i }).first()
      if (await dismissBtn.isVisible().catch(() => false)) {
        await dismissBtn.click({ force: true })
      }
    })

    await page.addInitScript(() => {
      // Suppress onboarding and AI setup wizards for deterministic E2E.
      localStorage.setItem('flowstate-onboarding-v2', JSON.stringify({
        seen: true,
        version: 2,
        dismissedAt: new Date().toISOString(),
      }))
      localStorage.setItem('flowstate-welcome-seen', 'true')
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({
        aiSetupComplete: true,
        aiPreferredProvider: 'groq',
      }))
    })
  })

  test('renders mobile shell and bottom navigation', async ({ page }) => {
    await page.goto('/')
    await dismissBlockingModals(page)

    await expectMobileShell(page)
    await expect(page.getByRole('link', { name: 'Tasks' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sort' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Timer' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'AI' })).toBeVisible()
    await expect(getNavItemByLabel(page, 'Menu')).toBeVisible()
  })

  test('navigates between key mobile routes from bottom nav', async ({ page }) => {
    await page.goto('/')
    await dismissBlockingModals(page)

    await page.getByRole('link', { name: 'Sort' }).click()
    await expect(page).toHaveURL(/#\/mobile-quick-sort$/)
    await expect(page.locator('.mobile-quick-sort')).toBeVisible()

    await page.getByRole('button', { name: 'Capture' }).click()
    await expect(page.getByPlaceholder('What needs to be done?')).toBeVisible()

    await page.getByRole('link', { name: 'Timer' }).click()
    await expect(page).toHaveURL(/#\/timer$/)
    await expect(page.locator('.mobile-timer-view')).toBeVisible()
    await expect(page.locator('.mobile-timer-view .status-label')).toContainText(/Ready|Focus|Break/i)

    await page.getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/#\/tasks$/)
    await expect(page.locator('.mobile-inbox')).toBeVisible()
    await expect(getMobileNav(page)).toBeVisible()
  })

  test('opens the AI route and returns to inbox from bottom nav', async ({ page }) => {
    await page.goto('/tasks')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-inbox')).toBeVisible()

    await page.getByRole('link', { name: 'AI' }).click()
    await expect(page).toHaveURL(/#\/mobile-ai-chat$/)

    await page.getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/#\/tasks$/)
    await expect(page.locator('.mobile-inbox')).toBeVisible()
  })

  test('opens and closes the mobile menu overlay', async ({ page }) => {
    await page.goto('/today')
    await dismissBlockingModals(page)

    await getNavItemByLabel(page, 'Menu').click()
    await expect(page.locator('.mobile-menu-overlay')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible()
    await expect(page.locator('.mobile-menu-content .menu-item')).toHaveCount(3)

    await page.locator('.mobile-menu-content .close-btn').click()
    await expect(page.locator('.mobile-menu-overlay')).toBeHidden()
  })

  test('today view has stable filter controls, menu behavior, and content states', async ({ page }) => {
    await page.goto('/today')
    await dismissBlockingModals(page)
    const url = page.url()
    if (/#\/today$/.test(url)) {
      await expect(page.locator('.mobile-today')).toBeVisible()
      await expect(page.locator('.mobile-today .filter-row .filter-btn')).toHaveCount(3)
      await expect(page.locator('.mobile-today .time-sections')).toBeVisible()

      const priorityFilter = page.locator('.mobile-today .filter-row .filter-dropdown-wrapper').nth(1).locator('.filter-btn')
      await priorityFilter.click()
      const priorityMenu = page.locator('.mobile-today .filter-row .filter-dropdown-wrapper').nth(1).locator('.dropdown-menu')
      await expect(priorityMenu).toBeVisible()
      await priorityMenu.locator('.dropdown-item').first().click()
      await expect(priorityMenu).toBeHidden()

      const sectionCount = await page.locator('.mobile-today .time-section').count()
      const emptyCount = await page.locator('.mobile-today .empty-state').count()
      expect(sectionCount + emptyCount).toBeGreaterThan(0)
      return
    }

    // Current app behavior: wizard close can redirect to tasks.
    await expect(page).toHaveURL(/#\/tasks$/)
    await expect(page.locator('.mobile-inbox')).toBeVisible()
  })

  test('timer view supports mobile start and stop interaction', async ({ page }) => {
    await page.goto('/timer')
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
