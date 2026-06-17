import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'

/**
 * BUG-1872 / TASK-1873: typing a description (incl. a bullet list) must persist and must NOT
 * reset/duplicate after autosave + the realtime echo round-trip through the markdown serializer.
 */
async function openModal(page: import('@playwright/test').Page, title: string) {
  // The tasks view is a table with row-hover actions; hover the row, then click "Edit task".
  const cell = page.getByText(title, { exact: false }).first()
  await cell.scrollIntoViewIfNeeded()
  await cell.hover()
  const row = page.locator('tr, [role="row"], [class*="task-row"], [class*="TaskRow"]').filter({ hasText: title }).first()
  await row.getByRole('button', { name: 'Edit task' }).click()
  await page.waitForSelector('.modal-content', { timeout: 5000 })
}

test('description with a bullet list round-trips without resetting (BUG-1872/TASK-1873)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  })
  await page.goto('/#/tasks')
  await page.waitForLoadState('networkidle')

  await openModal(page, TEST_TASKS.designLandingPage.title)
  const editor = page.locator('.tiptap').first()
  await expect(editor).toBeVisible()

  // Type a bullet list — the exact shape that drifted the old regex converter.
  await editor.click()
  await page.keyboard.type('- one\n- two\n- three')

  // Wait past the 500ms autosave + give the realtime echo time to arrive.
  await page.waitForTimeout(2500)

  // Content must still be intact (no reset, no duplicated/empty paragraphs).
  await expect(editor).toContainText('one')
  await expect(editor).toContainText('two')
  await expect(editor).toContainText('three')

  // Close and reopen — the saved description must come back.
  await page.getByRole('button', { name: /Cancel|No Changes/i }).first().click().catch(() => {})
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(800)

  await openModal(page, TEST_TASKS.designLandingPage.title)
  const reopened = page.locator('.tiptap').first()
  await expect(reopened).toBeVisible()
  await expect(reopened).toContainText('one')
  await expect(reopened).toContainText('three')
})
