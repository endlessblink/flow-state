import { chromium } from 'playwright'

const browser = await chromium.connectOverCDP(process.env.ELECTRON_CDP_URL || 'http://127.0.0.1:9260')
const page = browser.contexts()[0].pages().find((candidate) => !candidate.url().startsWith('devtools://'))
if (!page) throw new Error('No Electron window available')
const appOrigin = process.env.ELECTRON_APP_URL || 'https://in-theflow.com'

const group = { id: 'installed-f2-today', name: 'Today', x: 0, y: 20, width: 420, height: 900 }
const tasks = [
  { id: 'installed-f2-a', title: 'F2-A', x: 40, y: 100, order: 0 },
  { id: 'installed-f2-b', title: 'F2-B', x: 40, y: 220, order: 1 },
  { id: 'installed-f2-c', title: 'F2-C', x: 40, y: 340, order: 2 },
]
const today = new Date().toISOString().slice(0, 10)

await page.goto(`${appOrigin}/#/canvas`)
const onboarding = page.locator('.onboarding-overlay .primary-btn')
if (await onboarding.isVisible().catch(() => false)) await onboarding.click()
await page.waitForFunction(() => {
  const pinia = document.querySelector('#app')?.__vue_app__?._context.config.globalProperties.$pinia
  return !!pinia?._s.get('tasks') && !!pinia?._s.get('canvas') && !!document.querySelector('.vue-flow__pane')
}, null, { timeout: 30_000 })
await page.evaluate(async ({ group, tasks, today }) => {
  const pinia = document.querySelector('#app').__vue_app__._context.config.globalProperties.$pinia
  const taskStore = pinia._s.get('tasks')
  const canvasStore = pinia._s.get('canvas')
  taskStore.clearAll()
  canvasStore.clearAll()
  canvasStore.setGroups([{ id: group.id, name: group.name, type: 'custom', isVisible: true, isCollapsed: false, parentGroupId: null, positionVersion: 1, positionFormat: 'absolute', position: { x: group.x, y: group.y, width: group.width, height: group.height } }], true)
  for (const task of tasks) {
    await taskStore.createTask({ id: task.id, title: task.title, status: 'todo', priority: 'medium', isInInbox: false, parentId: group.id, dueDate: today, canvasPosition: { x: task.x, y: task.y }, positionFormat: 'absolute', order: task.order })
  }
}, { group, tasks, today })
await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`.vue-flow__node[data-id="${id}"]`)), tasks.map((task) => task.id), { timeout: 30_000 })
await page.waitForTimeout(2_000)

const node = page.locator('.vue-flow__node[data-id="installed-f2-b"]')
const dragTarget = node.locator('.task-node')
await dragTarget.scrollIntoViewIfNeeded()
await page.bringToFront()
const box = await dragTarget.boundingBox()
if (!box) throw new Error('F2 target node was not rendered')
await page.keyboard.down('F2')
try {
  const startX = box.x + box.width / 2
  const startY = box.y + Math.min(box.height / 2, 60)
  await dragTarget.hover()
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY - 180, { steps: 16 })
  await page.mouse.up()
} finally {
  await page.keyboard.up('F2')
}

await page.waitForTimeout(1_500)
const canvasOrder = await page.evaluate(() => [...document.querySelectorAll('.vue-flow__node[data-id^="installed-f2-"]')]
  .map((element) => ({ id: element.getAttribute('data-id'), top: element.getBoundingClientRect().top }))
  .sort((a, b) => a.top - b.top)
  .map((item) => item.id))
if (JSON.stringify(canvasOrder) !== JSON.stringify(['installed-f2-b', 'installed-f2-a', 'installed-f2-c'])) throw new Error(`F2 Canvas order failed: ${JSON.stringify(canvasOrder)}`)

await page.reload()
await page.waitForFunction(() => document.querySelectorAll('.vue-flow__node[data-id^="installed-f2-"]').length === 3, null, { timeout: 30_000 })
const persistedOrder = await page.evaluate(() => [...document.querySelectorAll('.vue-flow__node[data-id^="installed-f2-"]')]
  .map((element) => ({ id: element.getAttribute('data-id'), top: element.getBoundingClientRect().top }))
  .sort((a, b) => a.top - b.top)
  .map((item) => item.id))
if (JSON.stringify(persistedOrder) !== JSON.stringify(canvasOrder)) throw new Error(`F2 reload order failed: ${JSON.stringify(persistedOrder)}`)
await page.screenshot({ path: 'test-results/installed-guest-f2-canvas.png', fullPage: true })

async function readView(route, view) {
  if (view === 'board') await page.evaluate(() => localStorage.setItem('flowstate:board-view-type', 'date'))
  if (view === 'catalogue') await page.evaluate(() => {
    localStorage.setItem('flowstate:all-tasks-group-by', 'dueDate')
    localStorage.setItem('flowstate:all-tasks-sort-by', 'manual')
  })
  await page.goto(`${appOrigin}/#/${route}`)
  await page.waitForTimeout(1_500)
  return page.evaluate((viewName) => {
    const scope = viewName === 'board'
      ? [...document.querySelectorAll('.kanban-column')].find((column) => column.querySelector('.column-title')?.textContent?.trim() === 'Today')
      : [...document.querySelectorAll('.task-group')].find((group) => group.querySelector('.group-name')?.textContent?.trim() === 'Today')
    const rendered = [...(scope || document).querySelectorAll('[data-task-id]')]
      .filter((element) => element.getAttribute('data-task-id')?.startsWith('installed-f2-'))
      .map((element) => ({ id: element.getAttribute('data-task-id'), top: element.getBoundingClientRect().top, left: element.getBoundingClientRect().left }))
      .sort((a, b) => a.top - b.top || a.left - b.left)
    const order = [...new Set(rendered.map((item) => item.id))]
    const labels = order.map((id) => ({ id, title: (scope || document).querySelector(`[data-task-id="${id}"] .task-row__title-text, [data-task-id="${id}"] .task-title`)?.textContent?.trim() || '' }))
    const firstTask = (scope || document).querySelector('[data-task-id^="installed-f2-"]')
    firstTask?.scrollIntoView({ block: 'center', inline: 'center' })
    return { scopeFound: !!scope, order, labels }
  }, view)
}

const board = await readView('board', 'board')
await page.screenshot({ path: 'test-results/installed-guest-f2-board.png', fullPage: true })
const catalogue = await readView('catalog', 'catalogue')
await page.screenshot({ path: 'test-results/installed-guest-f2-catalogue.png', fullPage: true })
if (!board.scopeFound || !catalogue.scopeFound) throw new Error(`Today group was not rendered in a required view: ${JSON.stringify({ board, catalogue })}`)
if (JSON.stringify(board.order) !== JSON.stringify(persistedOrder)) throw new Error(`Board order mismatch: ${JSON.stringify(board)}`)
if (JSON.stringify(catalogue.order) !== JSON.stringify(persistedOrder)) throw new Error(`Catalogue order mismatch: ${JSON.stringify(catalogue)}`)
const expectedLabels = { 'installed-f2-b': 'F2-B', 'installed-f2-a': 'F2-A', 'installed-f2-c': 'F2-C' }
for (const [view, result] of [['board', board], ['catalogue', catalogue]]) {
  const actualLabels = result.labels.map((item) => item.title)
  const expected = result.order.map((id) => expectedLabels[id])
  if (JSON.stringify(actualLabels) !== JSON.stringify(expected)) throw new Error(`${view} visible labels mismatch: ${JSON.stringify(result)}`)
}
console.log(JSON.stringify({ canvasOrder, persistedOrder, board, catalogue }, null, 2))
await browser.close()
