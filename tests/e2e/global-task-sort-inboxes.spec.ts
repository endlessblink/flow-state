import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { test, expect, type Page } from '@playwright/test'
import { ensureAuthUser, TEST_USER } from '../fixtures/auth'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ID_PREFIX = 'e2088000-0000-4000-8000-00000000000'
const IDS = {
  tomorrow: `${ID_PREFIX}1`,
  canvas: `${ID_PREFIX}2`,
  calendar: `${ID_PREFIX}3`,
  immediate: `${ID_PREFIX}4`,
  high: `${ID_PREFIX}5`,
  medium: `${ID_PREFIX}6`,
}
const ALL_IDS = Object.values(IDS)

function localDateKey(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function idsInOrder(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements, expectedIds) => {
    const expected = new Set(expectedIds as string[])
    return [...new Set(elements
      .map(element => element.getAttribute('data-task-id'))
      .filter((id): id is string => !!id && expected.has(id)))]
  }, ALL_IDS)
}

async function waitForTaskStore(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as any
    return !!root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks')
  }, { timeout: 30_000 })
}

async function seedTasks(admin: SupabaseClient, userId: string) {
  const today = localDateKey()
  const tomorrow = localDateKey(1)
  await admin.from('tasks').delete().in('id', ALL_IDS)
  await admin.from('tombstones').delete().in('entity_id', ALL_IDS)

  const rows = [
    { id: IDS.tomorrow, title: 'Sort sync tomorrow', priority: 'immediate', due_date: `${tomorrow}T09:00:00+03:00`, order: 0 },
    { id: IDS.canvas, title: 'Sort sync on canvas', priority: 'immediate', due_date: `${today}T09:00:00+03:00`, order: 1, is_in_inbox: false, position: { x: 2800, y: 2800, format: 'absolute' }, position_version: 1 },
    { id: IDS.calendar, title: 'Sort sync on calendar', priority: 'immediate', due_date: `${today}T09:00:00+03:00`, order: 2, instances: [{ id: `${ID_PREFIX}7`, scheduledDate: today, scheduledTime: '14:00', duration: 30 }] },
    { id: IDS.immediate, title: 'Sort sync immediate', priority: 'immediate', due_date: `${today}T09:00:00+03:00`, order: 3 },
    { id: IDS.high, title: 'Sort sync high', priority: 'high', due_date: `${today}T09:00:00+03:00`, order: 4 },
    { id: IDS.medium, title: 'Sort sync medium', priority: 'medium', due_date: `${today}T09:00:00+03:00`, order: 5 },
  ].map(row => ({ user_id: userId, status: 'planned', is_in_inbox: true, ...row }))

  const { error } = await admin.from('tasks').insert(rows)
  if (error) throw error
}

test.describe('TASK-2088 global sort and inbox defaults', () => {
  test.skip(!SERVICE_ROLE_KEY, 'requires SUPABASE_SERVICE_ROLE_KEY (set by scripts/run-e2e.sh)')
  test.skip(({ browserName }) => browserName !== 'chromium', 'Electron acceptance uses Chromium')
  test.describe.configure({ mode: 'serial', timeout: 90_000 })

  let admin: SupabaseClient
  let userId: string

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    const user = await ensureAuthUser(admin, { ...TEST_USER, email_confirm: true })
    userId = user.id
    await seedTasks(admin, userId)
  })

  test.afterAll(async () => {
    await admin?.from('tasks').delete().in('id', ALL_IDS)
    await admin?.from('tombstones').delete().in('entity_id', ALL_IDS)
  })

  test('Catalog Priority becomes the main order and each Today inbox applies only its own exclusion', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate:all-tasks-group-by', 'none')
      localStorage.setItem('flowstate:all-tasks-sort-by', 'dueDate')
      localStorage.setItem('flowstate:all-tasks-sort-direction', 'asc')
      localStorage.setItem('flowstate:inbox-secondary-sort-canvas', 'none')
      localStorage.setItem('flowstate:calendar-inbox-secondary-sort', 'none')
      localStorage.removeItem('flowstate:inbox-time-filter-v2-canvas')
      localStorage.removeItem('flowstate:calendar-inbox-today-v2')
    })

    await page.goto('/#/catalog')
    await waitForTaskStore(page)
    await page.waitForSelector(`[data-task-id="${IDS.medium}"]`, { timeout: 30_000 })
    await expect(page.getByTestId('global-order-summary')).toContainText('Global order: Due date ↑')
    await expect(page.getByTestId('catalog-view-summary')).toContainText('Catalog view:')

    await page.getByTestId('catalog-view-summary').click()
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Group by')
    await expect(page.locator('[data-control="group"] .control-label')).toHaveText('Group by')
    await expect(page.locator('[data-control="sort"] .control-label')).toHaveText('Global order')

    await page.getByTestId('global-order-summary').click()
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Global order')
    await page.locator('.sortable-header').filter({ hasText: 'Priority' }).click()
    await expect(page.locator('.sortable-header--active').filter({ hasText: 'Priority' })).toBeVisible()
    await expect(page.getByTestId('global-order-summary')).toContainText('Global order: Priority ↑')
    expect(await idsInOrder(page, '.task-list [data-task-id]')).toEqual([
      IDS.tomorrow, IDS.canvas, IDS.calendar, IDS.immediate, IDS.high, IDS.medium,
    ])

    await page.goto('/#/canvas')
    await waitForTaskStore(page)
    const expandInbox = page.getByRole('button', { name: 'Expand Inbox' })
    await expandInbox.waitFor({ state: 'visible', timeout: 30_000 })
    await expandInbox.click()
    await page.waitForSelector(`.unified-inbox-panel [data-task-id="${IDS.medium}"]`, { timeout: 30_000 })
    await expect(page.locator('.unified-inbox-panel .time-filter-dropdown')).toContainText('Today')
    expect(await idsInOrder(page, '.unified-inbox-panel [data-task-id]')).toEqual([
      IDS.calendar, IDS.immediate, IDS.high, IDS.medium,
    ])

    await page.goto('/#/calendar')
    await waitForTaskStore(page)
    await page.waitForSelector(`.calendar-inbox-panel [data-task-id="${IDS.medium}"]`, { timeout: 30_000 })
    await expect(page.locator('.calendar-inbox-panel .today-quick-filter')).toHaveClass(/active/)
    expect(await idsInOrder(page, '.calendar-inbox-panel [data-task-id]')).toEqual([
      IDS.canvas, IDS.immediate, IDS.high, IDS.medium,
    ])
  })
})
