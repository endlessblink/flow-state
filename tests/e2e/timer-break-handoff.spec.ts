import { test, expect } from '../fixtures/auth'
import { registerModalHandlers, suppressOnboarding } from './mobile/mobile-helpers'

test.describe('Timer break handoff', () => {
  test.beforeEach(async ({ page }) => {
    await registerModalHandlers(page)
    await suppressOnboarding(page)
    await page.clock.install({ time: new Date('2026-08-24T10:00:00.000Z') })
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.timer-display')).toBeVisible({ timeout: 10000 })

    const stopButton = page.locator('button.timer-stop')
    if (await stopButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stopButton.click()
      await expect(stopButton).toBeHidden({ timeout: 5000 })
    }
  })

  test('offers a break, then starts work after a skipped 90-second break window', async ({ page }) => {
    await page.getByTitle('Start 25-min work timer').click()
    await expect(page.locator('.timer-display')).toHaveClass(/timer-active/, { timeout: 5000 })

    await page.clock.fastForward(1_503_000)
    await expect(page.locator('.timer-display')).not.toHaveClass(/timer-active/, { timeout: 5000 })

    const breakButton = page.getByTestId('timer-start-break')
    await expect(breakButton).toHaveClass(/timer-break-recommended/)
    await expect(breakButton).toHaveAttribute('title', 'Start break now (recommended)')

    await page.clock.fastForward(90_000)
    await expect(page.locator('.timer-display')).toHaveClass(/timer-active/, { timeout: 5000 })
    await expect(page.locator('.timer-display')).not.toHaveClass(/timer-break/)
  })
})
