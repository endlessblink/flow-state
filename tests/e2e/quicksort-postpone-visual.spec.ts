import { test, expect } from '../fixtures/auth'

test('Quick Sort postpone shortcut explains and advances in one click', async ({ page }) => {
  await page.goto('/#/tasks')
  await page.waitForLoadState('networkidle')
  await page.goto('/#/quick-sort')
  await expect(page.locator('.quick-sort-view')).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: /Next 3 days/ }).click()
  await page.getByRole('button', { name: 'Start sorting' }).click()
  await expect(page.locator('.stack-active')).toBeVisible({ timeout: 10_000 })

  await page.keyboard.press('e')
  await expect(page.getByText('then next')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next weekend' })).toBeVisible()
  await page.screenshot({ path: '/tmp/qs-postpone-desktop.png' })

  const firstTaskTitle = await page.locator('.edit-panel-title').textContent()
  await page.getByRole('button', { name: 'Next weekend' }).click()
  await expect(page.getByText('Moved to next weekend')).toBeVisible()
  await expect(page.locator('.edit-panel-title')).not.toBeVisible()
  await expect(page.locator('.task-title')).not.toHaveText(firstTaskTitle ?? '')
})
