import { test, expect } from '../fixtures/auth'

/**
 * Taskbar Nanny E2E test
 *
 * Verifies the nanny composable is wired up and the toast fires
 * after the configured threshold when no task is chosen.
 *
 * Uses a low threshold override (10s) via window.__NANNY_THRESHOLD_MINUTES
 * to avoid waiting 5 real minutes.
 */
test.describe('Taskbar Nanny', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('flowstate-settings-v2')) {
        localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
      }
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
      // Override nanny threshold to 10 seconds for testing
      ;(window as any).__NANNY_THRESHOLD_MINUTES = 10 / 60
    })
  })

  test('nanny shows warning toast after threshold without a chosen task', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')

    // Wait for threshold (10s) + force fallback buffer (up to 120s extra)
    // The toast appears when the user goes idle (3s) after threshold is crossed.
    // In Playwright with no mouse/keyboard activity, the user is always "idle",
    // so the toast should fire right at the 10s mark.
    // Wait 15s to be safe.
    await page.waitForTimeout(15000)

    // The toast appends to #toast-container in document.body
    const toastContainer = page.locator('#toast-container')
    const toastText = toastContainer.getByText('without a task')
    await expect(toastText).toBeVisible({ timeout: 5000 })
  })
})
