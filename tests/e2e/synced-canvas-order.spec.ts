/**
 * BUG-2106: the focused timeline starts with the first task on Canvas (left
 * group first), not the task with the lowest global order or top priority.
 * Mutates only the seeded Playwright test user.
 */
import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'

const LEFT_GROUP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01' // "To Do" at x=100
const RIGHT_GROUP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02' // "Completed" at x=500
const LEFT_TASK = TEST_TASKS.writeUnitTests.id
const RIGHT_TASK = TEST_TASKS.designLandingPage.id

test('timeline begins with the first task in the leftmost Canvas group', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
    // Simulate a previously persisted priority sort: it must be reset once.
    localStorage.setItem('flowstate:board-sort-option', JSON.stringify('priority_desc'))
  })
  await page.goto('/#/canvas')
  await page.waitForFunction((ids) => {
    const root = document.querySelector('#app') as unknown as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } } }
    const stores = root?.__vue_app__?._context.config.globalProperties.$pinia._s
    const tasks = (stores?.get('tasks') as { _rawTasks?: { id: string }[] } | undefined)?._rawTasks
    return !!stores?.get('canvas') && !!tasks?.find(t => t.id === ids.left) && !!tasks?.find(t => t.id === ids.right)
  }, { left: LEFT_TASK, right: RIGHT_TASK }, { timeout: 30000 })

  await page.evaluate(async ({ leftTask, rightTask, leftGroup, rightGroup }) => {
    const root = document.querySelector('#app') as unknown as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { updateTask: (id: string, patch: Record<string, unknown>) => Promise<void> }> } } } } } }
    const taskStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
    // The right-group task has the lowest global order and high priority.
    await taskStore.updateTask(rightTask, { parentId: rightGroup, canvasPosition: { x: 520, y: 170 }, order: -100, priority: 'high' })
    await taskStore.updateTask(leftTask, { parentId: leftGroup, canvasPosition: { x: 120, y: 170 }, order: 500, priority: 'low' })
  }, { leftTask: LEFT_TASK, rightTask: RIGHT_TASK, leftGroup: LEFT_GROUP, rightGroup: RIGHT_GROUP })

  await page.goto('/#/timeline')
  const activeTitle = page.locator('.task-focus-card--active')
  await expect(activeTitle).toContainText(TEST_TASKS.writeUnitTests.title, { timeout: 15000 })
  await expect(page.getByText('Synced order')).toBeVisible()
})
