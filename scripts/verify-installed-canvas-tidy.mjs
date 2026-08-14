import { chromium } from 'playwright'

const cdpUrl = process.env.ELECTRON_CDP_URL || 'http://127.0.0.1:9252'
const browser = await chromium.connectOverCDP(cdpUrl)
const page = browser.contexts()[0].pages()[0]
if (!page) throw new Error('No Electron window available')

await page.goto('https://in-theflow.com/#/canvas')
await page.waitForFunction(() => document.querySelectorAll('.vue-flow__node [data-task-id]').length > 0, null, { timeout: 30_000 })
await page.locator('[aria-label="Tidy day-group layout"]').click()
await page.waitForTimeout(5_000)
await page.screenshot({ path: 'test-results/installed-electron-canvas-tidy.png', fullPage: true })

const result = await page.evaluate(() => {
  const tasks = [...document.querySelectorAll('.vue-flow__node [data-task-id]')].map((element) => {
    const wrapper = element.closest('.vue-flow__node')
    const rect = wrapper.getBoundingClientRect()
    return { id: element.getAttribute('data-task-id'), x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  const overlaps = []
  for (let index = 0; index < tasks.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < tasks.length; otherIndex += 1) {
      const first = tasks[index]
      const second = tasks[otherIndex]
      if (first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y) overlaps.push([first.id, second.id])
    }
  }
  return { taskCount: tasks.length, overlapCount: overlaps.length, overlaps: overlaps.slice(0, 20) }
})

console.log(JSON.stringify(result, null, 2))
if (!result.taskCount || result.overlapCount) throw new Error(`Tidy left ${result.overlapCount} rendered task overlaps`)
await browser.close()
