import { test, expect } from '../fixtures/auth'

test.describe('Taskbar Nanny', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('flowstate-settings-v2')) {
        localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
      }
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
      // Override nanny threshold to 0 — shouldNudge fires immediately (0 >= 0)
      ;(window as any).__NANNY_THRESHOLD_MINUTES = 0
    })
  })

  test('nanny shows warning toast after threshold without a chosen task', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')

    // With threshold=0, shouldNudge is true immediately (unchosenMinutes 0 >= 0)
    // NannyReminder renders as .nanny-reminder in MainLayout
    const nanny = page.locator('.nanny-reminder')
    await expect(nanny.getByText('pick a task')).toBeVisible({ timeout: 10000 })
  })
})
