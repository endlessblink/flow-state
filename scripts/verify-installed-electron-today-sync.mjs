import { chromium } from 'playwright'

const cdpUrl = process.env.ELECTRON_CDP_URL || 'http://127.0.0.1:9229'
const browser = await chromium.connectOverCDP(cdpUrl)
const page = browser.contexts()[0].pages()[0]
if (!page) throw new Error('No Electron window available')

if (process.env.AUTH_SOURCE_CDP) {
  const sourceBrowser = await chromium.connectOverCDP(process.env.AUTH_SOURCE_CDP)
  const sourcePage = sourceBrowser.contexts()[0].pages()[0]
  if (!sourcePage) throw new Error('No authenticated source Electron window available')
  const authStorage = await sourcePage.evaluate(() => Object.entries(localStorage))
  await page.goto('https://in-theflow.com/#/canvas')
  await page.evaluate((entries) => entries.forEach(([key, value]) => localStorage.setItem(key, value)), authStorage)
  await page.reload()
  await sourceBrowser.close()
}

async function ready(route, storage = {}) {
  await page.goto(`https://in-theflow.com/#/${route}`)
  await page.evaluate((entries) => Object.entries(entries).forEach(([key, value]) => localStorage.setItem(key, value)), storage)
  if (Object.keys(storage).length) await page.reload()
  await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks'), null, { timeout: 30_000 })
  await page.waitForTimeout(2_000)
  if (route === 'canvas') {
    await page.waitForFunction(() => document.querySelectorAll('.vue-flow__node [data-task-id]').length > 0, null, { timeout: 30_000 })
  }
}

async function extractToday(view) {
  return page.evaluate((viewName) => {
    const root = document.querySelector('#app')
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    const store = pinia?._s.get('tasks')
    const taskList = store?.rawTasks || store?.tasks || []
    const today = new Date().toLocaleDateString('en-CA')
    const todayTasks = taskList
      .filter((task) => typeof task.dueDate === 'string' && task.dueDate.slice(0, 10) === today && task.status !== 'done')
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0) || (a.canvasPosition?.y ?? Number.POSITIVE_INFINITY) - (b.canvasPosition?.y ?? Number.POSITIVE_INFINITY) || (a.canvasPosition?.x ?? Number.POSITIVE_INFINITY) - (b.canvasPosition?.x ?? Number.POSITIVE_INFINITY) || a.id.localeCompare(b.id))
    const expected = todayTasks.map((task) => task.id)
    const allowed = new Set(expected)
    const scope = viewName === 'board'
      ? [...document.querySelectorAll('.kanban-column')].find((column) => column.querySelector('.column-title')?.textContent?.trim() === 'Today')
      : viewName === 'catalogue'
        ? document.querySelector('[data-group-key="today"]')
        : document
    const selector = viewName === 'canvas' ? '.vue-flow__node [data-task-id]' : '[data-task-id]'
    const rendered = [...(scope || document).querySelectorAll(selector)]
      .map((element) => ({ id: element.getAttribute('data-task-id'), top: element.getBoundingClientRect().top, left: element.getBoundingClientRect().left }))
      .filter((item) => item.id && allowed.has(item.id))
      .sort((a, b) => a.top - b.top || a.left - b.left)
    return {
      expected,
      actual: [...new Set(rendered.map((item) => item.id))],
      scopeFound: !!scope,
      columnTitles: [...document.querySelectorAll('.column-title')].map((element) => element.textContent?.trim()).filter(Boolean),
      todayLabel: today,
      todayCount: todayTasks.length,
      visibleTodayLabels: todayTasks.map((task) => task.title),
      taskDetails: todayTasks.map((task) => ({ id: task.id, status: task.status, order: task.order, x: task.canvasPosition?.x, y: task.canvasPosition?.y, parentId: task.parentId })),
    }
  }, view)
}

await ready('board', { 'flowstate:board-view-type': 'date' })
const board = await extractToday('board')
await page.locator('.kanban-column').filter({ has: page.locator('.column-title', { hasText: 'Today' }) }).scrollIntoViewIfNeeded()
await page.screenshot({ path: 'test-results/installed-electron-today-board.png', fullPage: true })
await ready('catalog', { 'flowstate:all-tasks-group-by': 'dueDate', 'flowstate:all-tasks-sort-by': 'manual' })
const catalogue = await extractToday('catalogue')
await page.locator('.task-group[data-group-key="today"]').scrollIntoViewIfNeeded()
await page.screenshot({ path: 'test-results/installed-electron-today-catalogue.png', fullPage: true })
await ready('canvas')
const canvas = await extractToday('canvas')
await page.screenshot({ path: 'test-results/installed-electron-today-canvas.png', fullPage: true })
console.log(JSON.stringify({ url: page.url(), board, catalogue, canvas }, null, 2))
if (!board.todayCount || !catalogue.todayCount || !canvas.todayCount) throw new Error('Today gate was empty or unauthenticated')
for (const [name, result] of Object.entries({ board, catalogue, canvas })) {
  if (JSON.stringify(result.expected) !== JSON.stringify(result.actual)) throw new Error(`${name} Today mismatch: ${JSON.stringify(result)}`)
}
if (JSON.stringify(board.expected) !== JSON.stringify(catalogue.expected) || JSON.stringify(board.expected) !== JSON.stringify(canvas.expected)) throw new Error('Today source order differs across views')
await page.screenshot({ path: 'test-results/installed-electron-today-sync.png', fullPage: true })
await browser.close()
