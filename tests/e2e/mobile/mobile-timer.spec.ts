import { test, expect } from '../../fixtures/auth'
import { MOBILE_PHONE_OPTIONS, getNavItemByLabel, registerModalHandlers, suppressOnboarding } from './mobile-helpers'

test.describe('Mobile Timer View', () => {
  test.describe.configure({ mode: 'serial' })
  test.use(MOBILE_PHONE_OPTIONS)

  test.beforeEach(async ({ page }) => {
    await registerModalHandlers(page)
    await suppressOnboarding(page)
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await getNavItemByLabel(page, 'Timer').click()
    await expect(page.locator('.mobile-timer-view')).toBeVisible({ timeout: 10000 })

    // Ensure timer is stopped (a previous test may have left it running via Supabase sync)
    const stopBtn = page.locator('button.action-btn.stop')
    if (await stopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stopBtn.click()
      await expect(stopBtn).toBeHidden({ timeout: 5000 })
    }
  })

  test('renders timer view with circle and time display', async ({ page }) => {
    const timerView = page.locator('.mobile-timer-view')
    await expect(timerView).toBeVisible({ timeout: 10000 })

    const timerCircle = page.locator('.timer-circle')
    await expect(timerCircle).toBeVisible()

    const timeDisplay = page.locator('.time-display')
    await expect(timeDisplay).toBeVisible()

    // Time display should show a formatted time string (e.g. "25:00")
    const timeText = await timeDisplay.textContent()
    expect.soft(timeText).toMatch(/\d+:\d{2}/)
  })

  test('shows "Ready" status when timer is idle', async ({ page }) => {
    await expect(page.locator('.timer-circle')).toBeVisible({ timeout: 10000 })

    // Timer circle must NOT have is-active class in idle state
    const timerCircle = page.locator('.timer-circle')
    await expect(timerCircle).not.toHaveClass(/is-active/)

    const statusLabel = page.locator('.status-label')
    await expect(statusLabel).toBeVisible()
    await expect(statusLabel).toHaveText('Ready')
  })

  test('stop button is hidden when timer is not active', async ({ page }) => {
    await expect(page.locator('.timer-circle')).toBeVisible({ timeout: 10000 })

    // Stop button is conditionally rendered via v-if="timerStore.isTimerActive"
    const stopBtn = page.locator('button.action-btn.stop')
    await expect(stopBtn).toBeHidden()
  })

  test('timer circle is tappable and triggers timer start', async ({ page }) => {
    const timerCircle = page.locator('.timer-circle')
    await expect(timerCircle).toBeVisible({ timeout: 10000 })

    await timerCircle.click()

    // After clicking, the circle should eventually receive is-active class
    // Allow up to 5s for the async startTimer call to resolve
    await expect(timerCircle).toHaveClass(/is-active/, { timeout: 5000 })
  })

  test('timer circle gets .is-active class when running', async ({ page }) => {
    const timerCircle = page.locator('.timer-circle')
    await expect(timerCircle).toBeVisible({ timeout: 10000 })

    // Start the timer
    await timerCircle.click()
    await expect(timerCircle).toHaveClass(/is-active/, { timeout: 5000 })

    // Confirm the time display is still visible and status label changed from "Ready"
    await expect.soft(page.locator('.time-display')).toBeVisible()
    const statusLabel = page.locator('.status-label')
    await expect.soft(statusLabel).not.toHaveText('Ready')
  })

  test('stop button appears when timer is running', async ({ page }) => {
    const timerCircle = page.locator('.timer-circle')
    await expect(timerCircle).toBeVisible({ timeout: 10000 })

    // Confirm stop button is absent before starting
    await expect(page.locator('button.action-btn.stop')).toBeHidden()

    // Start the timer
    await timerCircle.click()
    await expect(timerCircle).toHaveClass(/is-active/, { timeout: 5000 })

    // Stop button and focus mode indicator should now be visible
    const stopBtn = page.locator('button.action-btn.stop')
    await expect(stopBtn).toBeVisible({ timeout: 3000 })

    expect.soft(await page.locator('.focus-mode-indicator').isVisible()).toBe(true)
  })

  test('clicking stop button stops the timer', async ({ page }) => {
    const timerCircle = page.locator('.timer-circle')
    await expect(timerCircle).toBeVisible({ timeout: 10000 })

    // Start the timer
    await timerCircle.click()
    await expect(timerCircle).toHaveClass(/is-active/, { timeout: 5000 })

    const stopBtn = page.locator('button.action-btn.stop')
    await expect(stopBtn).toBeVisible({ timeout: 3000 })

    // Stop the timer
    await stopBtn.click()

    // Timer circle should no longer carry is-active
    await expect(timerCircle).not.toHaveClass(/is-active/, { timeout: 5000 })

    // Stop button should disappear again (v-if removed)
    await expect(stopBtn).toBeHidden({ timeout: 3000 })

    // Status label should return to "Ready"
    await expect.soft(page.locator('.status-label')).toHaveText('Ready')
  })
})
