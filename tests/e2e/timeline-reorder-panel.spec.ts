/**
 * TASK-2104: the focused timeline "Up next" panel reorders reliably with
 * explicit controls. Mutates only the seeded Playwright test user.
 */
import { test, expect } from '../fixtures/auth'

test('Up next panel moves a task and keeps the new order', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  })
  await page.goto('/#/timeline')
  await page.getByRole('button', { name: /reorder tasks/i }).click()
  const panel = page.locator('.task-focus-queue')
  await expect(panel).toBeVisible()
  const titles = () => panel.locator('.task-focus-queue__text').allTextContents()
  const before = await titles()
  expect(before.length).toBeGreaterThan(2)
  await page.screenshot({ path: 'test-results/timeline-reorder-panel.png' })

  const third = panel.locator('.task-focus-queue__row').nth(2)
  await third.hover()
  await third.getByRole('button', { name: /move up/i }).click()
  await expect.poll(titles).toEqual([before[0], before[2], before[1], ...before.slice(3)])

  await page.waitForTimeout(4000)
  await page.reload()
  await page.getByRole('button', { name: /reorder tasks/i }).click()
  await expect.poll(titles, { timeout: 10000 }).toEqual([before[0], before[2], before[1], ...before.slice(3)])
})
