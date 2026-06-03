import { expect, test, type Page } from '@playwright/test'

// Local, Supabase-free canvas harness (mirrors canvas-geometry-local.spec.ts):
// seeds groups/tasks straight into Pinia, then drives the collapse chevron.

const setupCanvas = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true, weekStartsOn: 1 }))
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  })

  await page.goto('/#/canvas')
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as any
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    return !!pinia?._s.get('tasks') && !!pinia?._s.get('canvas') && !!pinia?._s.get('settings')
      && !!document.querySelector('.vue-flow__pane')
  }, { timeout: 30_000 })
}

const GROUP = { id: 'group-collapse-test', name: 'Collapse Me', x: 200, y: 120, width: 400, height: 600 }
const TASK = { id: 'task-collapse-1', title: 'Child task', parentId: GROUP.id, x: 240, y: 220 }

const seedCanvas = async (page: Page) => {
  await page.evaluate(async ({ GROUP, TASK }) => {
    const root = document.querySelector('#app') as any
    const pinia = root.__vue_app__._context.config.globalProperties.$pinia
    const taskStore = pinia._s.get('tasks')!
    const canvasStore = pinia._s.get('canvas')!
    taskStore.clearAll()
    canvasStore.clearAll()
    canvasStore.setViewport?.({ x: 0, y: 0, zoom: 1 })
    canvasStore.setGroups([{
      id: GROUP.id, name: GROUP.name, type: 'custom', isVisible: true, isCollapsed: false,
      parentGroupId: null, positionVersion: 1, positionFormat: 'absolute',
      position: { x: GROUP.x, y: GROUP.y, width: GROUP.width, height: GROUP.height },
    }], true)
    await taskStore.createTask({
      id: TASK.id, title: TASK.title, status: 'todo', priority: 'medium',
      isInInbox: false, parentId: TASK.parentId,
      canvasPosition: { x: TASK.x, y: TASK.y }, positionFormat: 'absolute',
    })
    await canvasStore.requestSync?.('user:manual')
  }, { GROUP, TASK })

  await expect.poll(async () => page.evaluate((id) =>
    !!document.querySelector(`[data-id="section-${id}"]`), GROUP.id), { timeout: 15_000 }).toBe(true)
}

const readState = (page: Page) => page.evaluate((id) => {
  const root = document.querySelector('#app') as any
  const pinia = root.__vue_app__._context.config.globalProperties.$pinia
  const canvasStore = pinia._s.get('canvas')!
  const group = canvasStore.groups.find((g: any) => g.id === id)
  const nodeEl = document.querySelector(`[data-id="section-${id}"]`) as HTMLElement | null
  const sectionNode = nodeEl?.querySelector('.section-node') as HTMLElement | null
  const childEl = document.querySelector(`[data-id="task-collapse-1"]`) as HTMLElement | null
  const childVisible = !!childEl && childEl.offsetParent !== null && !childEl.hidden
    && getComputedStyle(childEl).display !== 'none' && getComputedStyle(childEl).visibility !== 'hidden'
  return {
    storeIsCollapsed: !!group?.isCollapsed,
    domHasCollapsedClass: !!sectionNode?.classList.contains('collapsed'),
    bodyVisible: !!nodeEl?.querySelector('.section-body'),
    childVisible,
  }
}, GROUP.id)

test('group collapse chevron actually minimizes the group', async ({ page }) => {
  await setupCanvas(page)
  await seedCanvas(page)

  const before = await readState(page)
  await page.screenshot({ path: '.dev/screenshots/collapse-before.png' })

  // Sanity: starts expanded with the child task visible
  expect(before.storeIsCollapsed).toBe(false)
  expect(before.bodyVisible).toBe(true)
  expect(before.childVisible).toBe(true)

  // Click the collapse chevron inside the group header
  await page.evaluate((id) => {
    const nodeEl = document.querySelector(`[data-id="section-${id}"]`)
    const btn = nodeEl?.querySelector('.collapse-btn') as HTMLButtonElement | null
    btn?.click()
  }, GROUP.id)

  await page.waitForTimeout(600)
  const after = await readState(page)
  await page.screenshot({ path: '.dev/screenshots/collapse-after.png' })

  console.log('COLLAPSE STATE before:', JSON.stringify(before), 'after:', JSON.stringify(after))

  // Store should have toggled...
  expect(after.storeIsCollapsed).toBe(true)
  // ...and the DOM should visibly reflect collapse (this is the part that breaks)
  expect(after.domHasCollapsedClass).toBe(true)
  expect(after.bodyVisible).toBe(false)
  // ...and the contained task must be hidden (the whole point of minimizing)
  expect(after.childVisible).toBe(false)

  // Expand again — must restore body + child task
  await page.evaluate((id) => {
    const nodeEl = document.querySelector(`[data-id="section-${id}"]`)
    const btn = nodeEl?.querySelector('.collapse-btn') as HTMLButtonElement | null
    btn?.click()
  }, GROUP.id)
  await page.waitForTimeout(600)
  const reExpanded = await readState(page)
  console.log('COLLAPSE STATE re-expanded:', JSON.stringify(reExpanded))
  expect(reExpanded.storeIsCollapsed).toBe(false)
  expect(reExpanded.bodyVisible).toBe(true)
  expect(reExpanded.childVisible).toBe(true)
})
