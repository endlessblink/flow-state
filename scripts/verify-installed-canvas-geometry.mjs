import { chromium } from 'playwright'

const cdpUrl = process.env.ELECTRON_CDP_URL || 'http://127.0.0.1:9251'
const browser = await chromium.connectOverCDP(cdpUrl)
const page = browser.contexts()[0].pages()[0]
if (!page) throw new Error('No Electron window available')

await page.goto('https://in-theflow.com/#/canvas')
await page.waitForFunction(() => document.querySelectorAll('.vue-flow__node [data-task-id]').length > 0, null, { timeout: 30_000 })
await page.waitForTimeout(2_000)

const result = await page.evaluate(() => {
  const root = document.querySelector('#app')
  const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
  const taskStore = pinia?._s.get('tasks')
  const storeTasks = taskStore?.rawTasks || taskStore?.tasks || []
  const taskById = new Map(storeTasks.map((task) => [task.id, task]))
  const tasks = [...document.querySelectorAll('.vue-flow__node')]
    .map((element) => {
      const rect = element.getBoundingClientRect()
      const taskId = element.querySelector('[data-task-id]')?.getAttribute('data-task-id')
      const task = taskById.get(taskId)
      return taskId ? { id: taskId, title: task?.title, parentId: task?.parentId, savedX: task?.canvasPosition?.x, savedY: task?.canvasPosition?.y, x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
    })
    .filter(Boolean)

  const overlaps = []
  const sameParentOverlaps = []
  for (let index = 0; index < tasks.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < tasks.length; otherIndex += 1) {
      const first = tasks[index]
      const second = tasks[otherIndex]
      if (first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y) {
        overlaps.push([first.id, second.id])
        if (first.parentId === second.parentId) sameParentOverlaps.push([first.id, second.id])
      }
    }
  }

  return {
    url: location.href,
    taskCount: tasks.length,
    overlapCount: overlaps.length,
    sameParentOverlapCount: sameParentOverlaps.length,
    overlaps: overlaps.slice(0, 20),
    sameParentOverlaps: sameParentOverlaps.slice(0, 20),
    overlapDetails: overlaps.slice(0, 20).map(([firstId, secondId]) => [tasks.find((task) => task.id === firstId), tasks.find((task) => task.id === secondId)]),
    tidyButton: Boolean(document.querySelector('[aria-label="Tidy day-group layout"]')),
    groupNames: pinia?._s.get('canvas')?.groups?.map((group) => group.name) ?? [],
    canvasSetupKeys: Object.keys(document.querySelector('.canvas-layout')?.__vueParentComponent?.setupState ?? {}).filter((key) => /tidy|repair|node/i.test(key)),
  }
})

console.log(JSON.stringify({ url: result.url, taskCount: result.taskCount, overlapCount: result.overlapCount, sameParentOverlapCount: result.sameParentOverlapCount, tidyButton: result.tidyButton, groupNames: result.groupNames, canvasSetupKeys: result.canvasSetupKeys, overlaps: result.overlaps, sameParentOverlaps: result.sameParentOverlaps }, null, 2))
if (!result.taskCount || !result.tidyButton) throw new Error('Canvas was empty or Tidy control was missing')
if (result.overlapCount) throw new Error(`Canvas has ${result.overlapCount} rendered task overlaps`)
await browser.close()
