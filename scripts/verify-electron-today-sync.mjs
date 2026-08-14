import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CDP_URL = process.env.ELECTRON_CDP_URL || 'http://127.0.0.1:9224'
const BASE_URL = process.env.ELECTRON_TEST_URL || 'http://127.0.0.1:5546'
const GROUP_ID = 'e1000000-0000-4000-8000-000000000001'
const TASKS = [
  { id: 'e1000000-0000-4000-8000-000000000001', title: 'Electron Today first', order: 0, x: 120, y: 120 },
  { id: 'e1000000-0000-4000-8000-000000000002', title: 'Electron Today second', order: 1, x: 420, y: 120 },
  { id: 'e1000000-0000-4000-8000-000000000003', title: 'Electron Today third', order: 2, x: 120, y: 360 },
]
const TASK_IDS = TASKS.map((task) => task.id)

function localDateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

async function seed(admin, userId) {
  const today = localDateKey()
  await admin.from('tasks').delete().in('id', TASK_IDS)
  await admin.from('groups').delete().eq('id', GROUP_ID)
  await admin.from('tombstones').delete().in('entity_id', [...TASK_IDS, GROUP_ID])
  await admin.from('groups').insert({ id: GROUP_ID, user_id: userId, name: 'Today', type: 'custom', color: '#F59E0B', position_json: { x: 3000, y: 3000, width: 1000, height: 900 }, layout: 'freeform' })
  const { error } = await admin.from('tasks').insert(TASKS.map((task) => ({
    id: task.id, user_id: userId, title: task.title, status: 'planned', priority: 'medium', is_in_inbox: false,
    due_date: `${today}T09:00:00+03:00`, order: task.order,
    position: { x: task.x, y: task.y, format: 'absolute' }, position_version: 1,
  })))
  if (error) throw error
}

async function idsInDocumentOrder(page) {
  return page.locator('[data-task-id]').evaluateAll((elements, expected) => {
    const allowed = new Set(expected)
    const rows = elements.map((element) => ({ id: element.getAttribute('data-task-id'), rect: element.getBoundingClientRect() }))
      .filter((item) => item.id && allowed.has(item.id))
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)
    return [...new Set(rows.map((row) => row.id))]
  }, TASK_IDS)
}

if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
const auth = JSON.parse(await fs.readFile('tests/.auth/user.json', 'utf8'))
const origin = auth.origins.find((entry) => entry.origin.includes('127.0.0.1'))
const authItems = origin?.localStorage || []
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: { user } } = await admin.auth.admin.getUserById(JSON.parse(authItems.find((item) => item.name === 'flowstate-supabase-auth-identity-v1')?.value || '{}').id)
if (!user) throw new Error('Authenticated test user was not found')
await seed(admin, user.id)

const browser = await chromium.connectOverCDP(CDP_URL)
const context = browser.contexts()[0]
const page = context.pages()[0]
if (!page) throw new Error('Electron did not expose a browser window')
await page.goto(`${BASE_URL}/#/canvas`)
await page.evaluate((items) => items.forEach(({ name, value }) => localStorage.setItem(name, value)), authItems)
await page.reload()
await page.waitForFunction(() => !!(document.querySelector('#app')?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks')), null, { timeout: 30_000 })
await page.addInitScript(() => {
  localStorage.setItem('flowstate:board-view-type', 'date')
  localStorage.setItem('flowstate:all-tasks-group-by', 'dueDate')
  localStorage.setItem('flowstate:all-tasks-sort-by', 'manual')
})

const evidence = { expected: TASK_IDS }
await page.goto(`${BASE_URL}/#/board`)
console.log(JSON.stringify({ electronUrl: page.url(), electronTitle: await page.title(), body: (await page.locator('body').innerText()).slice(0, 500), storageKeys: await page.evaluate(() => Object.keys(localStorage)) }))
await page.waitForSelector('.task-card[data-task-id]', { timeout: 30_000 })
evidence.board = await idsInDocumentOrder(page)
await page.screenshot({ path: 'test-results/electron-today-sync-board.png', fullPage: true })
await page.goto(`${BASE_URL}/#/catalog`)
await page.waitForSelector('.all-tasks-view', { timeout: 30_000 })
evidence.catalogue = await idsInDocumentOrder(page)
await page.screenshot({ path: 'test-results/electron-today-sync-catalogue.png', fullPage: true })
await page.goto(`${BASE_URL}/#/canvas`)
await page.waitForSelector(`[data-task-id="${TASK_IDS[0]}"]`, { timeout: 30_000 })
evidence.canvas = await idsInDocumentOrder(page)
await page.screenshot({ path: 'test-results/electron-today-sync-canvas.png', fullPage: true })

console.log(JSON.stringify(evidence))
for (const view of ['board', 'catalogue', 'canvas']) {
  if (JSON.stringify(evidence[view]) !== JSON.stringify(TASK_IDS)) throw new Error(`${view} mismatch: ${JSON.stringify(evidence[view])}`)
}
await browser.close()
await admin.from('tasks').delete().in('id', TASK_IDS)
await admin.from('groups').delete().eq('id', GROUP_ID)
await admin.from('tombstones').delete().in('entity_id', [...TASK_IDS, GROUP_ID])
