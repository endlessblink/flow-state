import { chromium } from 'playwright'

const cdpUrl = process.env.ELECTRON_CDP_URL || 'http://127.0.0.1:9256'
const browser = await chromium.connectOverCDP(cdpUrl)
const page = browser.contexts()[0].pages()[0]
if (!page) throw new Error('No Electron window available')

if (!page.url().startsWith('file:')) throw new Error(`Expected packaged Electron page, got ${page.url()}`)
await page.addInitScript(() => { window.PLAYWRIGHT_TEST = true })
await page.reload()
await page.evaluate(() => { location.hash = '/canvas' })
await page.waitForFunction(() => document.querySelectorAll('.vue-flow__node [data-task-id]').length > 0, null, { timeout: 30_000 })
await page.waitForTimeout(2_000)

if (process.env.HIDE_DONE === '1') {
  const hideDoneButton = page.locator('[aria-label="Hide done tasks on canvas"]')
  if (await hideDoneButton.count()) {
    await hideDoneButton.click()
    await page.waitForTimeout(1_000)
  }
}

const result = await page.evaluate(async () => {
  const debug = window.__POMO_FLOW_DEBUG__
  if (!debug?.debugTidyPlanOnlyToClipboard) return { available: false, flag: window.PLAYWRIGHT_TEST, debugKeys: debug ? Object.keys(debug) : [] }
  const planJson = await debug.debugTidyPlanOnlyToClipboard()
  const pinia = document.querySelector('#app')?.__vue_app__?._context.config.globalProperties.$pinia
  const taskStore = pinia?._s.get('tasks')
  const canvasStore = pinia?._s.get('canvas')
  const tasks = taskStore?.rawTasks ?? []
  const groupIds = new Set((canvasStore?.groups ?? []).map((group) => group.id))
  const renderedIds = new Set([...document.querySelectorAll('[data-task-id]')].map((element) => element.getAttribute('data-task-id')))
  const classified = tasks.filter((task) => renderedIds.has(task.id)).map((task) => ({
    id: task.id,
    title: task.title,
    parentId: task.parentId ?? null,
    hasCanvasPosition: Boolean(task.canvasPosition),
    status: task.status,
    dueDate: task.dueDate ?? null,
    isPinned: Boolean(task.isPinned),
    canvasDismissed: Boolean(task.canvasDismissed),
    isCompletionRecord: Boolean(task.isCompletionRecord),
    softDeleted: Boolean(task._soft_deleted),
  }))
  return {
    available: true,
    plan: JSON.parse(planJson),
    diagnostics: {
      rendered: classified.length,
      hideCanvasDoneTasks: Boolean(taskStore?.hideCanvasDoneTasks),
      persistedFilters: JSON.parse(localStorage.getItem('flowstate-filters') || localStorage.getItem('flow-state-filters') || 'null'),
      noPosition: classified.filter((task) => !task.hasCanvasPosition).length,
      pinned: classified.filter((task) => task.isPinned).length,
      done: classified.filter((task) => task.status === 'done').length,
      doneWithValidParent: classified.filter((task) => task.status === 'done' && task.parentId && groupIds.has(task.parentId)).length,
      doneWithoutValidParent: classified.filter((task) => task.status === 'done' && (!task.parentId || !groupIds.has(task.parentId))).length,
      activeWithValidParent: classified.filter((task) => task.status !== 'done' && task.parentId && groupIds.has(task.parentId)).length,
      activeWithoutValidParent: classified.filter((task) => task.status !== 'done' && (!task.parentId || !groupIds.has(task.parentId))).length,
      planned: new Set(JSON.parse(planJson).planned.taskMoves.map((move) => move.taskId)).size,
      unplannedSample: classified.filter((task) => !JSON.parse(planJson).planned.taskMoves.some((move) => move.taskId === task.id)).slice(0, 20),
    },
  }
})

console.log(JSON.stringify({
  available: result.available,
  diagnostics: result.diagnostics,
  planned: result.plan ? {
    groupMoves: result.plan.planned.groupMoves.length,
    taskMoves: result.plan.planned.taskMoves.length,
  } : null,
}, null, 2))
if (!result.available) throw new Error('Tidy plan debug hook was not exposed')
await browser.close()
