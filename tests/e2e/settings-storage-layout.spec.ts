import { expect, test } from '@playwright/test'

const openStorageSettings = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  })

  await page.goto('/#/tasks')
  const settingsButton = page.locator('.settings-mini-btn, [aria-label*="Settings"], [title*="Settings"]').first()
  await expect(settingsButton).toBeVisible({ timeout: 10_000 })
  await settingsButton.click()

  await expect(page.locator('.settings-modal')).toBeVisible({ timeout: 10_000 })
  await page.locator('.tab-btn').filter({ hasText: 'Data' }).click()
  await expect(page.locator('.storage-settings-tab')).toBeVisible()
  await expect(page.getByText('Remove done tasks by due date')).toBeVisible()
  await expect(page.getByText('Fix corrupted data that may cause sync errors')).toBeVisible()
}

test.describe('storage settings cleanup layout', () => {
  test('keeps done-task cleanup separate from corrupted-data cleanup', async ({ page }) => {
    await openStorageSettings(page)

    const taskCleanupSection = page.locator('.settings-section', { hasText: 'Task Cleanup' })
    const dataCleanupSection = page.locator('.settings-section', { hasText: 'Data Cleanup' })

    await expect(taskCleanupSection).toBeVisible()
    await expect(dataCleanupSection).toBeVisible()
    await expect(taskCleanupSection.locator('.done-cleanup-panel')).toBeVisible()
    await expect(dataCleanupSection.locator('.done-cleanup-panel')).toHaveCount(0)

    const overlaps = await page.evaluate(() => {
      const doneControls = document.querySelector('.done-cleanup-controls')?.getBoundingClientRect()
      const cleanupActions = document.querySelector('.cleanup-actions')?.getBoundingClientRect()
      if (!doneControls || !cleanupActions) return true
      return (doneControls.left < cleanupActions.right &&
        doneControls.right > cleanupActions.left &&
        doneControls.top < cleanupActions.bottom &&
        doneControls.bottom > cleanupActions.top)
    })

    expect(overlaps).toBe(false)
  })

  test('wraps done-task cleanup controls without collision on narrow viewports', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 })
    await openStorageSettings(page)

    const hasOverlap = await page.evaluate(() => {
      const input = document.querySelector('.done-cleanup-field input')?.getBoundingClientRect()
      const button = document.querySelector('.done-cleanup-controls .cleanup-btn')?.getBoundingClientRect()
      const panel = document.querySelector('.done-cleanup-panel')?.getBoundingClientRect()
      if (!input || !button || !panel) return true

      const insidePanel =
        input.left >= panel.left &&
        input.right <= panel.right &&
        button.left >= panel.left &&
        button.right <= panel.right

      const overlap =
        input.left < button.right &&
        input.right > button.left &&
        input.top < button.bottom &&
        input.bottom > button.top

      return !insidePanel || overlap
    })

    expect(hasOverlap).toBe(false)
  })
})
