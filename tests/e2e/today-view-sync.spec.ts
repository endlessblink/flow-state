/**
 * High visual gate for the Today projection across Board, Canvas, and Catalogue.
 *
 * The same seeded task IDs must appear in the same top-to-bottom / row-major
 * order in every view. Screenshots are retained as review evidence.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { test, expect, type Page } from '@playwright/test'
import { ensureAuthUser, TEST_USER } from '../fixtures/auth'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GROUP_ID = 'e1000000-0000-4000-8000-000000000001'
const TASKS = [
  { id: 'e1000000-0000-4000-8000-000000000001', title: 'Today sync first', order: 0, x: 120, y: 120 },
  { id: 'e1000000-0000-4000-8000-000000000002', title: 'Today sync second', order: 1, x: 420, y: 120 },
  { id: 'e1000000-0000-4000-8000-000000000003', title: 'Today sync third', order: 2, x: 120, y: 360 },
]
const TASK_IDS = TASKS.map((task) => task.id)

function localDateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as any
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    return !!pinia?._s.get('tasks')
  }, { timeout: 30_000 })
}

async function idsInDocumentOrder(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements, expected) => {
    const ids = new Set(expected as string[])
    const ordered = elements
      .map((element) => ({ id: element.getAttribute('data-task-id'), top: element.getBoundingClientRect().top, left: element.getBoundingClientRect().left }))
      .filter((item): item is { id: string, top: number, left: number } => !!item.id && ids.has(item.id))
      .sort((a, b) => a.top - b.top || a.left - b.left)
    return [...new Set(ordered.map((item) => item.id))]
  }, TASK_IDS)
}

async function seedTodayTasks(admin: SupabaseClient, userId: string) {
  const today = localDateKey()
  await admin.from('tasks').delete().in('id', TASK_IDS)
  await admin.from('groups').delete().eq('id', GROUP_ID)
  await admin.from('tombstones').delete().in('entity_id', [...TASK_IDS, GROUP_ID])
  await admin.from('groups').insert({
    id: GROUP_ID,
    user_id: userId,
    name: 'Today',
    type: 'custom',
    color: '#F59E0B',
    position_json: { x: 3000, y: 3000, width: 1000, height: 900 },
    layout: 'freeform',
  })
  const { error } = await admin.from('tasks').insert(TASKS.map((task) => ({
    id: task.id,
    user_id: userId,
    title: task.title,
    status: 'planned',
    priority: 'medium',
    is_in_inbox: false,
    due_date: `${today}T09:00:00+03:00`,
    order: task.order,
    position: { x: task.x, y: task.y, format: 'absolute' },
    position_version: 1,
  })))
  if (error) throw error
}

test.describe('Today view sync visual gate', () => {
  test.skip(!SERVICE_ROLE_KEY, 'requires SUPABASE_SERVICE_ROLE_KEY (set by scripts/run-e2e.sh)')
  test.describe.configure({ mode: 'serial', timeout: 90_000 })

  let admin: SupabaseClient
  let userId: string

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    const user = await ensureAuthUser(admin, { ...TEST_USER, email_confirm: true })
    userId = user.id
    await seedTodayTasks(admin, userId)
  })

  test.afterAll(async () => {
    await admin?.from('tasks').delete().in('id', TASK_IDS)
    await admin?.from('groups').delete().eq('id', GROUP_ID)
    await admin?.from('tombstones').delete().in('entity_id', [...TASK_IDS, GROUP_ID])
  })

  test('Board, Canvas, and Catalogue show the exact Today set in one order', async ({ page }) => {
    const evidence: Record<string, unknown> = { expected: TASK_IDS }

    await page.addInitScript(() => {
      localStorage.setItem('flowstate:board-view-type', 'date')
      localStorage.setItem('flowstate:all-tasks-group-by', 'dueDate')
      localStorage.setItem('flowstate:all-tasks-sort-by', 'manual')
    })

    await page.goto('/#/board')
    await page.waitForSelector('.board-view-wrapper', { timeout: 30_000 })
    await page.waitForSelector('.task-card[data-task-id]', { timeout: 30_000 })
    await waitForApp(page)
    const boardIds = await idsInDocumentOrder(page, '.task-card[data-task-id]')
    evidence.board = boardIds
    await page.screenshot({ path: 'test-results/today-sync-board.png', fullPage: true })

    await page.goto('/#/catalog')
    await page.waitForSelector('.all-tasks-view', { timeout: 30_000 })
    await waitForApp(page)
    const catalogueIds = await idsInDocumentOrder(page, '[data-task-id]')
    evidence.catalogue = catalogueIds
    await page.screenshot({ path: 'test-results/today-sync-catalogue.png', fullPage: true })

    await page.goto('/#/canvas')
    await waitForApp(page)
    await page.waitForSelector(`[data-task-id="${TASK_IDS[0]}"]`, { timeout: 30_000 })
    const canvasIds = await idsInDocumentOrder(page, '[data-task-id]')
    evidence.canvas = canvasIds
    await page.screenshot({ path: 'test-results/today-sync-canvas.png', fullPage: true })

    expect(boardIds).toEqual(TASK_IDS)
    expect(catalogueIds).toEqual(TASK_IDS)
    expect(canvasIds).toEqual(TASK_IDS)
    expect(evidence).toMatchObject({ expected: TASK_IDS, board: TASK_IDS, catalogue: TASK_IDS, canvas: TASK_IDS })
  })
})
