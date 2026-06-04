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
const PARENT_TASK = { id: 'task-parent-connection', title: 'Parent connector', x: 40, y: 260 }

const seedCanvas = async (page: Page) => {
  await page.evaluate(async ({ GROUP, TASK, PARENT_TASK }) => {
    const root = document.querySelector('#app') as any
    const pinia = root.__vue_app__._context.config.globalProperties.$pinia
    const taskStore = pinia._s.get('tasks')!
    const canvasStore = pinia._s.get('canvas')!
    taskStore.clearAll()
    canvasStore.clearAll()
    canvasStore.setViewport?.({ x: 0, y: 0, zoom: 1 })
    canvasStore.setGroups([{
      id: GROUP.id, name: GROUP.name, type: 'custom', isVisible: true, isCollapsed: false,
      linkedParentTaskId: PARENT_TASK.id,
      parentGroupId: null, positionVersion: 1, positionFormat: 'absolute',
      position: { x: GROUP.x, y: GROUP.y, width: GROUP.width, height: GROUP.height },
    }], true)
    await taskStore.createTask({
      id: PARENT_TASK.id, title: PARENT_TASK.title, status: 'todo', priority: 'medium',
      isInInbox: false, canvasPosition: { x: PARENT_TASK.x, y: PARENT_TASK.y },
      positionFormat: 'absolute',
    })
    await taskStore.createTask({
      id: TASK.id, title: TASK.title, status: 'todo', priority: 'medium',
      isInInbox: false, parentId: TASK.parentId,
      canvasPosition: { x: TASK.x, y: TASK.y }, positionFormat: 'absolute',
    })
    await canvasStore.requestSync?.('user:manual')
  }, { GROUP, TASK, PARENT_TASK })

  await expect.poll(async () => page.evaluate((id) =>
    !!document.querySelector(`[data-id="section-${id}"]`), GROUP.id), { timeout: 15_000 }).toBe(true)
}

const readState = (page: Page) => page.evaluate(({ id, parentTaskId }) => {
  const root = document.querySelector('#app') as any
  const pinia = root.__vue_app__._context.config.globalProperties.$pinia
  const canvasStore = pinia._s.get('canvas')!
  const group = canvasStore.groups.find((g: any) => g.id === id)
  const nodeEl = document.querySelector(`[data-id="section-${id}"]`) as HTMLElement | null
  const sectionNode = nodeEl?.querySelector('.section-node') as HTMLElement | null
  const childEl = document.querySelector(`[data-id="task-collapse-1"]`) as HTMLElement | null
  const childVisible = !!childEl && childEl.offsetParent !== null && !childEl.hidden
    && getComputedStyle(childEl).display !== 'none' && getComputedStyle(childEl).visibility !== 'hidden'
  const groupHandle = nodeEl?.querySelector('.group-link-handle') as HTMLElement | null
  const resizeHandleCount = nodeEl?.querySelectorAll('.vue-flow__resize-control').length ?? 0
  const edge = document.querySelector(`[aria-label="Edge from ${parentTaskId} to section-${id}"]`) as SVGElement | null
  return {
    storeIsCollapsed: !!group?.isCollapsed,
    domHasCollapsedClass: !!sectionNode?.classList.contains('collapsed'),
    bodyVisible: !!nodeEl?.querySelector('.section-body'),
    childVisible,
    groupBox: nodeEl ? {
      width: Math.round(nodeEl.getBoundingClientRect().width),
      height: Math.round(nodeEl.getBoundingClientRect().height),
    } : null,
    groupHandleDisplay: groupHandle ? getComputedStyle(groupHandle).display : null,
    groupHandleVisible: !!groupHandle && groupHandle.offsetParent !== null && getComputedStyle(groupHandle).display !== 'none',
    resizeHandleCount,
    edgeVisible: !!edge,
  }
}, { id: GROUP.id, parentTaskId: PARENT_TASK.id })

test('group collapse chevron actually minimizes the group', async ({ page }) => {
  await setupCanvas(page)
  await seedCanvas(page)

  const before = await readState(page)
  await page.screenshot({ path: '.dev/screenshots/collapse-before.png' })

  // Sanity: starts expanded with the child task visible
  expect(before.storeIsCollapsed).toBe(false)
  expect(before.bodyVisible).toBe(true)
  expect(before.childVisible).toBe(true)

  // Click the collapse chevron with a REAL pointer interaction (mousedown→up),
  // exercising Vue Flow's drag/pointer interception — not a synthetic .click().
  await page.locator(`[data-id="section-${GROUP.id}"] .collapse-btn`).click()

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
  // Existing cable connections must keep a measurable handle/edge target.
  expect(after.groupHandleDisplay).not.toBe('none')
  expect(after.groupHandleVisible).toBe(true)
  expect(after.edgeVisible).toBe(true)
  // Collapsed selected groups must not leave resize controls or a full-height hitbox.
  expect(after.resizeHandleCount).toBe(0)
  expect(after.groupBox?.height).toBeLessThan(80)

  await page.locator(`[data-id="${PARENT_TASK.id}"]`).click()
  await expect.poll(async () => page.evaluate(({ groupId, taskId }) => {
    const root = document.querySelector('#app') as any
    const pinia = root.__vue_app__._context.config.globalProperties.$pinia
    const canvasStore = pinia._s.get('canvas')!
    return {
      selected: canvasStore.selectedNodeIds,
      parentSelected: document.querySelector(`[data-id="${taskId}"]`)?.classList.contains('selected') ?? false,
      groupSelected: document.querySelector(`[data-id="section-${groupId}"]`)?.classList.contains('selected') ?? false,
    }
  }, { groupId: GROUP.id, taskId: PARENT_TASK.id }), { timeout: 5_000 }).toMatchObject({
    selected: [PARENT_TASK.id],
    parentSelected: true,
    groupSelected: false,
  })

  // Expand again — must restore body + child task (real pointer click)
  await page.locator(`[data-id="section-${GROUP.id}"] .collapse-btn`).click()
  await page.waitForTimeout(600)
  const reExpanded = await readState(page)
  console.log('COLLAPSE STATE re-expanded:', JSON.stringify(reExpanded))
  expect(reExpanded.storeIsCollapsed).toBe(false)
  expect(reExpanded.bodyVisible).toBe(true)
  expect(reExpanded.childVisible).toBe(true)
})
