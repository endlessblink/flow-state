import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { test, expect, type Page } from '@playwright/test'
import { ensureAuthUser, TEST_USER } from '../fixtures/auth'
import { randomUUID } from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const runSuffix = randomUUID().replace(/-/g, '').slice(0, 12)
const TASKS = [
  { id: `e2000000-0000-4000-8000-${runSuffix}`, title: 'Board immediate task', priority: 'immediate', recurrence_rule: null },
  { id: `e2000000-0000-4000-8000-${runSuffix.slice(0, 11)}1`, title: 'Board high task', priority: 'high', recurrence_rule: null },
  { id: `e2000000-0000-4000-8000-${runSuffix.slice(0, 11)}2`, title: 'Board recurring task', priority: 'medium', recurrence_rule: { pattern: 'daily', interval: 1, endType: 'never' } },
  { id: `e2000000-0000-4000-8000-${runSuffix.slice(0, 11)}3`, title: 'Board low task', priority: 'low', recurrence_rule: null },
  { id: `e2000000-0000-4000-8000-${runSuffix.slice(0, 11)}4`, title: 'Board relaxed task', priority: 'relaxed', recurrence_rule: null }
] as const
const TASK_IDS = TASKS.map(task => task.id)

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as any
    return !!root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks')
  }, { timeout: 30_000 })
}

test.describe('Board priority and recurring filters', () => {
  test.skip(!SERVICE_ROLE_KEY, 'requires SUPABASE_SERVICE_ROLE_KEY (set by scripts/run-e2e.sh)')
  test.describe.configure({ mode: 'serial', timeout: 90_000, workers: 1 })

  let admin: SupabaseClient
  let userId: string

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    userId = (await ensureAuthUser(admin, { ...TEST_USER, email_confirm: true })).id
    await admin.from('tasks').delete().in('id', TASK_IDS)
    const { error } = await admin.from('tasks').upsert(TASKS.map((task, index) => ({
      ...task,
      user_id: userId,
      status: 'planned',
      is_in_inbox: true,
      order: index
    })), { onConflict: 'id' })
    if (error) throw error
  })

  test.afterAll(async () => {
    await admin?.from('tasks').delete().in('id', TASK_IDS)
  })

  test('shows high-first sorting and filters priority and recurring tasks', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate:board-view-type', 'category')
      localStorage.setItem('flowstate:board-sort-option', 'manual')
      localStorage.setItem('flowstate:board-priority-filter', '')
      localStorage.setItem('flowstate:board-recurring-filter', 'all')
    })
    await page.goto('/#/board')
    await page.waitForSelector('.board-view-wrapper', { timeout: 30_000 })
    await waitForApp(page)

    const sortSelect = page.locator('.header-controls .custom-select').first()
    await sortSelect.locator('.select-trigger').click()
    await page.getByRole('option', { name: 'Priority: High to Low', exact: true }).click({ force: true })
    for (const task of TASKS) {
      await expect(page.locator(`[data-task-id="${task.id}"]`)).toBeVisible()
    }

    await page.locator('.filter-toggle').click()
    const filterSelects = page.locator('.filter-controls .custom-select')
    await filterSelects.nth(3).locator('.select-trigger').click()
    await expect(page.getByRole('option', { name: 'Immediate', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Relaxed', exact: true })).toBeVisible()
    await page.getByRole('option', { name: 'Immediate', exact: true }).click({ force: true })
    await expect(page.locator(`[data-task-id="${TASKS[0].id}"]`)).toBeVisible()
    await expect(page.locator(`[data-task-id="${TASKS[1].id}"]`)).toHaveCount(0)
    await expect(page.locator(`[data-task-id="${TASKS[4].id}"]`)).toHaveCount(0)

    await filterSelects.nth(3).locator('.select-trigger').click()
    await page.getByRole('option', { name: 'All Priorities', exact: true }).click({ force: true })
    await filterSelects.nth(4).locator('.select-trigger').click()
    await page.getByRole('option', { name: 'Recurring Only', exact: true }).click()
    await expect(page.locator(`[data-task-id="${TASKS[2].id}"]`)).toBeVisible()
    await expect(page.locator(`[data-task-id="${TASKS[1].id}"]`)).toHaveCount(0)
  })
})
