import { chromium } from 'playwright'

const cdpUrl = process.env.ELECTRON_CDP_URL || 'http://127.0.0.1:9229'
const browser = await chromium.connectOverCDP(cdpUrl)
const page = browser.contexts()[0].pages()[0]
if (!page) throw new Error('No Electron window available')

async function ready(route, storage = {}) {
  await page.goto(`https://in-theflow.com/#/${route}`)
  await page.evaluate((entries) => Object.entries(entries).forEach(([key, value]) => localStorage.setItem(key, value)), storage)
  if (Object.keys(storage).length) await page.reload()
  await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks'), null, { timeout: 30_000 })
  await page.waitForTimeout(2_000)
}

async function extractToday() {
  return page.evaluate(() => {
    const root = document.querySelector('#app')
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    const store = pinia?._s.get('tasks')
    const taskList = store?.rawTasks || store?.tasks || []
    const today = new Date().toLocaleDateString('en-CA')
    const todayTasks = taskList
      .filter((task) => typeof task.dueDate === 'string' && task.dueDate.slice(0, 10) === today && task.status !== 'done')
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    const expected = todayTasks.map((task) => task.id)
    const allowed = new Set(expected)
    const rendered = [...document.querySelectorAll('[data-task-id]')]
      .map((element) => ({ id: element.getAttribute('data-task-id'), top: element.getBoundingClientRect().top, left: element.getBoundingClientRect().left }))
      .filter((item) => item.id && allowed.has(item.id))
      .sort((a, b) => a.top - b.top || a.left - b.left)
    return {
      expected,
      actual: [...new Set(rendered.map((item) => item.id))],
      todayLabel: today,
      todayCount: todayTasks.length,
      visibleTodayLabels: todayTasks.map((task) => task.title),
      taskDetails: todayTasks.map((task) => ({ id: task.id, status: task.status, order: task.order, x: task.canvasPosition?.x, y: task.canvasPosition?.y, parentId: task.parentId })),
    }
  })
}

await ready('board', { 'flowstate:board-view-type': 'date' })
const board = await extractToday()
await ready('catalog', { 'flowstate:all-tasks-group-by': 'dueDate', 'flowstate:all-tasks-sort-by': 'manual' })
const catalogue = await extractToday()
await ready('canvas')
const canvas = await extractToday()
console.log(JSON.stringify({ url: page.url(), board, catalogue, canvas }, null, 2))
for (const [name, result] of Object.entries({ board, catalogue, canvas })) {
  if (JSON.stringify(result.expected) !== JSON.stringify(result.actual)) throw new Error(`${name} Today mismatch: ${JSON.stringify(result)}`)
}
if (JSON.stringify(board.expected) !== JSON.stringify(catalogue.expected) || JSON.stringify(board.expected) !== JSON.stringify(canvas.expected)) throw new Error('Today source order differs across views')
await page.screenshot({ path: 'test-results/installed-electron-today-sync.png', fullPage: true })
await browser.close()
