import { test, expect } from '../fixtures/auth'

test('Quick Sort postpone shortcut closes only the popup and uses opaque feedback', async ({ page }) => {
  await page.goto('/#/tasks')
  await page.waitForLoadState('networkidle')
  await page.goto('/#/quick-sort')
  await expect(page.locator('.quick-sort-view')).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: /Next 3 days/ }).click()
  await page.getByRole('button', { name: 'Start sorting' }).click()
  await expect(page.locator('.stack-active')).toBeVisible({ timeout: 10_000 })

  await page.keyboard.press('e')
  await expect(page.getByText('Postpone')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next weekend' })).toBeVisible()
  await page.screenshot({ path: '/tmp/qs-postpone-desktop.png' })

  const firstTaskTitle = await page.locator('.edit-panel-title').textContent()
  await page.getByRole('button', { name: 'Next weekend' }).click()
  const feedback = page.getByText('Moved to next weekend').locator('..')
  await expect(feedback).toBeVisible()
  await expect(feedback).toHaveCSS('background-color', /rgb\(/)
  await expect(page.locator('.edit-panel-title')).not.toBeVisible()
  await expect(page.locator('.task-title')).toHaveText(firstTaskTitle ?? '')
})
