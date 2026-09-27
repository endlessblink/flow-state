/**
 * BUG-2103: choosing a sidebar filter on Canvas must narrow the Canvas and
 * keep the user on Canvas (it used to jump to the catalogue from '/canvas').
 * Mutates only the seeded Playwright test user.
 */
import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'

test.describe.configure({ mode: 'serial' })

const TODAY_TASK_ID = TEST_TASKS.designLandingPage.id
const LATER_TASK_ID = TEST_TASKS.setupCICD.id

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('flowstate-settings-v2')) {
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
    }
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  })
  await page.goto('/#/canvas')
  await page.waitForFunction(({ a, b }) => {
    const root = document.querySelector('#app') as unknown as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { _rawTasks?: { id: string }[] }> } } } } } }
    const tasks = root?.__vue_app__?._context.config.globalProperties.$pinia._s.get('tasks')?._rawTasks
    return !!tasks?.find(t => t.id === a) && !!tasks?.find(t => t.id === b)
  }, { a: TODAY_TASK_ID, b: LATER_TASK_ID }, { timeout: 30000 })

  await page.evaluate(async ({ todayId, laterId }) => {
    const root = document.querySelector('#app') as unknown as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { updateTask: (id: string, patch: Record<string, unknown>) => Promise<void> }> } } } } } }
    const taskStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const later = new Date(); later.setDate(later.getDate() + 20)
    await taskStore.updateTask(todayId, { dueDate: fmt(new Date()), canvasPosition: { x: 100, y: 1600 } })
    await taskStore.updateTask(laterId, { dueDate: fmt(later), canvasPosition: { x: 500, y: 1600 } })
  }, { todayId: TODAY_TASK_ID, laterId: LATER_TASK_ID })

  await expect(page.locator(`.vue-flow__node[data-id="${LATER_TASK_ID}"]`)).toHaveCount(1, { timeout: 15000 })
})

test.afterEach(async ({ page }) => {
  await page.evaluate(async ({ todayId, laterId }) => {
    const root = document.querySelector('#app') as unknown as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { setSmartView: (v: string | null) => void; updateTask: (id: string, patch: Record<string, unknown>) => Promise<void> }> } } } } } }
    const taskStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
    taskStore.setSmartView(null)
    await taskStore.updateTask(todayId, { dueDate: '', canvasPosition: undefined })
    await taskStore.updateTask(laterId, { dueDate: '', canvasPosition: undefined })
  }, { todayId: TODAY_TASK_ID, laterId: LATER_TASK_ID }).catch(() => {})
})

test('Today filter narrows Canvas and stays on Canvas', async ({ page }) => {
  await page.locator('.smart-views-grid').getByText('Today', { exact: false }).first().click()

  await expect(page).toHaveURL(/#\/canvas/)
  await expect(page.locator(`.vue-flow__node[data-id="${LATER_TASK_ID}"]:visible`)).toHaveCount(0, { timeout: 5000 })
  await expect(page.locator(`.vue-flow__node[data-id="${TODAY_TASK_ID}"]:visible`)).toHaveCount(1)
})
