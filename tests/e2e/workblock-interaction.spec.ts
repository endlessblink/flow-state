import { expect, test } from '../fixtures/auth'
import type { Page } from '@playwright/test'

const dismissWelcome = async (page: Page) => {
  const getStarted = page.getByRole('button', { name: 'Get Started' })
  if (await getStarted.isVisible().catch(() => false)) await getStarted.click()
}

const hideSidebar = async (page: Page) => {
  const button = page.getByRole('button', { name: 'Hide sidebar' })
  if (await button.isVisible().catch(() => false)) await button.click()
}

const createCanvasTask = async (page: Page, title: string) => {
  await page.goto('/#/canvas')
  await page.waitForLoadState('networkidle')
  await dismissWelcome(page)
  await hideSidebar(page)

  await page.getByRole('button', { name: 'Add new task' }).first().click()
  await page.getByRole('textbox', { name: 'Task name' }).fill(title)
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 })
}

test('canvas work block picker sets duration', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await createCanvasTask(page, `Canvas work block ${Date.now()}`)

  const trigger = page.getByRole('button', { name: 'Set work block length' }).first()
  await expect(trigger).toBeVisible({ timeout: 10_000 })

  await trigger.dispatchEvent('click')

  const option = page.getByRole('button', { name: '30m' }).first()
  await expect(option).toBeVisible()
  // The popover can render outside the viewport on the canvas (like the trigger
  // above); dispatch the click directly to bypass Playwright's viewport check.
  await option.dispatchEvent('click')

  await expect(page.getByRole('button', { name: 'Change work block length' }).first()).toContainText('Work 30m')
})

test('kanban work block picker sets duration', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const title = `Kanban work block ${Date.now()}`
  await createCanvasTask(page, title)

  await page.goto('/#/board')
  await page.waitForLoadState('networkidle')
  await hideSidebar(page)

  const card = page.locator('.task-card', { hasText: title }).first()
  await expect(card).toBeVisible({ timeout: 10_000 })

  await card.getByRole('button', { name: 'Set work block length' }).click()
  await card.getByRole('button', { name: '30m' }).click()

  await expect(card.getByRole('button', { name: 'Change work block length' })).toContainText('30m')
})
