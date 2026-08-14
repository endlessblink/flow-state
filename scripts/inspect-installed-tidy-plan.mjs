import { chromium } from 'playwright'

const cdpUrl = process.env.ELECTRON_CDP_URL || 'http://127.0.0.1:9256'
const browser = await chromium.connectOverCDP(cdpUrl)
const page = browser.contexts()[0].pages()[0]
if (!page) throw new Error('No Electron window available')

await page.addInitScript(() => { window.PLAYWRIGHT_TEST = true })
await page.goto('https://in-theflow.com/#/canvas')
await page.waitForFunction(() => document.querySelectorAll('.vue-flow__node [data-task-id]').length > 0, null, { timeout: 30_000 })
await page.waitForTimeout(2_000)

const result = await page.evaluate(async () => {
  const debug = window.__POMO_FLOW_DEBUG__
  if (!debug?.debugTidyPlanOnlyToClipboard) return { available: false, flag: window.PLAYWRIGHT_TEST, debugKeys: debug ? Object.keys(debug) : [] }
  const planJson = await debug.debugTidyPlanOnlyToClipboard()
  return { available: true, plan: JSON.parse(planJson) }
})

console.log(JSON.stringify(result, null, 2))
if (!result.available) throw new Error('Tidy plan debug hook was not exposed')
await browser.close()
