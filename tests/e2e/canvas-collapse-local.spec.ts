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
const UNPARENTED_INSIDE_TASK = { id: 'task-collapse-unparented-inside', title: 'Unparented inside task', x: 260, y: 360 }
const PARENT_TASK = { id: 'task-collapse-parent', title: 'Parent task', x: 40, y: 150 }

const seedCanvas = async (page: Page) => {
  await page.evaluate(async ({ GROUP, TASK, UNPARENTED_INSIDE_TASK, PARENT_TASK }) => {
    const root = document.querySelector('#app') as any
    const pinia = root.__vue_app__._context.config.globalProperties.$pinia
    const taskStore = pinia._s.get('tasks')!
    const canvasStore = pinia._s.get('canvas')!
    taskStore.clearAll()
    canvasStore.clearAll()
    canvasStore.setViewport?.({ x: 0, y: 0, zoom: 1 })
    canvasStore.setGroups([{
      id: GROUP.id, name: GROUP.name, type: 'custom', isVisible: true, isCollapsed: false,
      parentGroupId: null, linkedParentTaskId: PARENT_TASK.id, positionVersion: 1, positionFormat: 'absolute',
      position: { x: GROUP.x, y: GROUP.y, width: GROUP.width, height: GROUP.height },
    }], true)
    await taskStore.createTask({
      id: PARENT_TASK.id, title: PARENT_TASK.title, status: 'todo', priority: 'medium',
      isInInbox: false, parentId: null,
      canvasPosition: { x: PARENT_TASK.x, y: PARENT_TASK.y }, positionFormat: 'absolute',
    })
    await taskStore.createTask({
      id: TASK.id, title: TASK.title, status: 'todo', priority: 'medium',
      isInInbox: false, parentId: TASK.parentId,
      canvasPosition: { x: TASK.x, y: TASK.y }, positionFormat: 'absolute',
    })
    await taskStore.createTask({
      id: UNPARENTED_INSIDE_TASK.id, title: UNPARENTED_INSIDE_TASK.title, status: 'todo', priority: 'medium',
      isInInbox: false, parentId: null,
      canvasPosition: { x: UNPARENTED_INSIDE_TASK.x, y: UNPARENTED_INSIDE_TASK.y }, positionFormat: 'absolute',
    })
    await canvasStore.requestSync?.('user:manual')
  }, { GROUP, TASK, UNPARENTED_INSIDE_TASK, PARENT_TASK })

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
  const unparentedInsideEl = document.querySelector(`[data-id="task-collapse-unparented-inside"]`) as HTMLElement | null
  const unparentedInsideVisible = !!unparentedInsideEl && unparentedInsideEl.offsetParent !== null && !unparentedInsideEl.hidden
    && getComputedStyle(unparentedInsideEl).display !== 'none' && getComputedStyle(unparentedInsideEl).visibility !== 'hidden'
  const groupBox = nodeEl?.getBoundingClientRect()
  const parentNode = document.querySelector(`[data-id="task-collapse-parent"]`) as HTMLElement | null
  const edge = document.querySelector(`[aria-label="Edge from task-collapse-parent to section-${id}"]`)
  const groupHandle = nodeEl?.querySelector('.group-link-handle') as HTMLElement | null
  const handleStyle = groupHandle ? getComputedStyle(groupHandle) : null
  return {
    storeIsCollapsed: !!group?.isCollapsed,
    domHasCollapsedClass: !!sectionNode?.classList.contains('collapsed'),
    bodyVisible: !!nodeEl?.querySelector('.section-body'),
    childVisible,
    unparentedInsideVisible,
    groupHeight: groupBox?.height ?? null,
    resizeControlCount: nodeEl?.querySelectorAll('.vue-flow__resize-control').length ?? 0,
    edgeVisible: !!edge,
    groupHandleDisplay: handleStyle?.display ?? null,
    parentSelected: !!parentNode?.classList.contains('selected'),
    groupSelected: !!nodeEl?.classList.contains('selected'),
  }
}, GROUP.id)

// Drives the (singleton) canvas operation-state machine into drag-settling via the
// DEV test seam, which closes the syncNodes remote-update guard
// (canAcceptRemoteUpdate=false) for DRAG_SETTLE_TIMEOUT_MS (3s). A synthetic Vue
// Flow mouse drag does not reliably fire onNodeDragStart in headless, so we exercise
// the real state transitions directly.
const enterDragSettling = (page: Page) => page.evaluate(() => {
  const op = (window as { __canvasOpState?: { startDrag: (ids: string[]) => unknown; endDrag: (ids: string[]) => unknown } }).__canvasOpState
  if (!op) throw new Error('__canvasOpState seam not found (DEV build expected)')
  op.startDrag(['settle-probe'])
  op.endDrag(['settle-probe'])
})

const clickCollapseBtn = (page: Page) => page.evaluate((id) => {
  const nodeEl = document.querySelector(`[data-id="section-${id}"]`)
  const btn = nodeEl?.querySelector('.collapse-btn') as HTMLButtonElement | null
  btn?.click()
}, GROUP.id)

// TASK-1821: collapse was unreliable on the Electron desktop app. Cause: the
// orchestrator collapse watcher re-synced via batchedSyncNodes() WITHOUT force, so
// syncNodes() dropped it whenever the canvas was inside the drag-settling /
// remote-update guard window (canAcceptRemoteUpdate=false). Because it is a
// signature watcher, a dropped fire never recovers — children stay visible until
// the next toggle. Electron realtime storms (BUG-1799) keep that guard closed far
// more often than a quiet browser, which is why the existing test (realtime off,
// guard always open) passed while the desktop app failed. This test reproduces the
// guarded window and asserts collapse still hides children.
test('group collapse hides children during the drag-settling guard window (TASK-1821)', async ({ page }) => {
  await setupCanvas(page)
  await seedCanvas(page)

  const before = await readState(page)
  expect(before.storeIsCollapsed).toBe(false)
  expect(before.childVisible).toBe(true)
  expect(before.unparentedInsideVisible).toBe(true)

  // Push the canvas into the 3s drag-settling window.
  await enterDragSettling(page)

  // Sanity: we are actually inside the guarded settling window.
  const settling = await page.evaluate(() => (window as { __FlowStateIsSettling?: boolean }).__FlowStateIsSettling === true)
  expect(settling, 'expected canvas to be in the drag-settling window').toBe(true)

  // Collapse during the settling window — the path that silently no-ops without the fix.
  await clickCollapseBtn(page)

  // Give the forced resync a nextTick to flush, then assert WHILE still settling so
  // the only thing that could have hidden the child is the force:true resync (a
  // post-settle resync would not prove the fix).
  await page.waitForTimeout(500)
  const stillSettling = await page.evaluate(() => (window as { __FlowStateIsSettling?: boolean }).__FlowStateIsSettling === true)
  expect(stillSettling, 'settle window should still be open — adjust test timing if this fails').toBe(true)

  const after = await readState(page)
  console.log('COLLAPSE-DURING-SETTLE state:', JSON.stringify(after))
  expect(after.storeIsCollapsed).toBe(true)
  expect(after.domHasCollapsedClass).toBe(true)
  expect(after.childVisible, 'collapse must hide child even inside the settling guard window').toBe(false)
  expect(after.unparentedInsideVisible).toBe(false)
})

test('group collapse preserves cable target and allows selecting another node', async ({ page }) => {
  await setupCanvas(page)
  await seedCanvas(page)

  const before = await readState(page)
  await page.screenshot({ path: '.dev/screenshots/collapse-before.png' })

  // Sanity: starts expanded with the child task visible
  expect(before.storeIsCollapsed).toBe(false)
  expect(before.bodyVisible).toBe(true)
  expect(before.childVisible).toBe(true)
  expect(before.unparentedInsideVisible).toBe(true)

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
  // A task can be visually inside a group even when its persisted parentId is
  // stale/null; collapse must hide the visible contents, not only strict
  // parent-chain descendants.
  expect(after.unparentedInsideVisible).toBe(false)
  // The cable target must still be measurable; display:none handles break
  // existing group edge anchors.
  expect(after.edgeVisible).toBe(true)
  expect(after.groupHandleDisplay).not.toBe('none')
  // A collapsed selected group must not leave its resize overlay stretched over
  // the old expanded bounds, which was intercepting clicks on nearby nodes.
  expect(after.resizeControlCount).toBe(0)
  expect(after.groupHeight).not.toBeNull()
  expect(after.groupHeight!).toBeLessThan(80)

  await page.locator(`[data-id="${PARENT_TASK.id}"]`).click({ position: { x: 20, y: 20 } })
  const afterParentClick = await readState(page)
  expect(afterParentClick.parentSelected).toBe(true)
  expect(afterParentClick.groupSelected).toBe(false)

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
  expect(reExpanded.unparentedInsideVisible).toBe(true)
})
