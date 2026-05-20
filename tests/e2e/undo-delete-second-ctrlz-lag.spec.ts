import { expect, test, type Page } from '@playwright/test'

const TASK_ID = 'undo-repeat-canvas-task'
const GROUP_ID = 'undo-repeat-group'

const setupApp = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('__UNDO_DEBUG', 'true')
    localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true, weekStartsOn: 1 }))
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  })

  await page.goto('/#/canvas')
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } } } | null
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    return !!pinia?._s.get('tasks') && !!pinia?._s.get('canvas')
  }, { timeout: 30_000 })
}

const seedCanvasTask = async (page: Page) => {
  await page.evaluate(async ({ taskId, groupId }) => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
    const pinia = root.__vue_app__._context.config.globalProperties.$pinia
    const taskStore = pinia._s.get('tasks')!
    const canvasStore = pinia._s.get('canvas')!

    taskStore.clearAll()
    canvasStore.clearAll()
    canvasStore.setViewport?.({ x: 0, y: 0, zoom: 1 })
    canvasStore.setGroups([{
      id: groupId,
      name: 'Undo Repeat',
      type: 'custom',
      isVisible: true,
      isCollapsed: false,
      parentGroupId: null,
      positionVersion: 1,
      positionFormat: 'absolute',
      position: { x: 120, y: 120, width: 420, height: 700 },
    }], true)

    await taskStore.createTask({
      id: taskId,
      title: 'Undo repeat canvas task',
      status: 'todo',
      priority: 'medium',
      isInInbox: false,
      parentId: groupId,
      canvasPosition: { x: 160, y: 240 },
      positionFormat: 'absolute',
    })

    await canvasStore.requestSync?.('user:manual')
  }, { taskId: TASK_ID, groupId: GROUP_ID })

  await expect(page.locator(`[data-id="${TASK_ID}"]`)).toHaveCount(1, { timeout: 15_000 })
}

const deleteWithUndo = async (page: Page) => {
  await page.evaluate(async (taskId) => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
    const taskStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
    await taskStore.deleteTaskWithUndo(taskId)
  }, TASK_ID)
}

const debugSnapshot = async (page: Page) => page.evaluate(async (taskId) => {
  return {
    task: await window.__inspectUndoTask?.(taskId),
    undo: await window.__undoDebugSnapshot?.(),
  }
}, TASK_ID)

test('second Ctrl+Z restores the same canvas task after repeated delete', async ({ page }) => {
  await setupApp(page)
  await seedCanvasTask(page)

  await deleteWithUndo(page)
  await expect(page.locator(`[data-id="${TASK_ID}"]`)).toHaveCount(0, { timeout: 5_000 })

  await page.keyboard.press('Control+Z')
  await expect(page.locator(`[data-id="${TASK_ID}"]`), JSON.stringify(await debugSnapshot(page), null, 2))
    .toHaveCount(1, { timeout: 2_000 })

  await deleteWithUndo(page)
  await expect(page.locator(`[data-id="${TASK_ID}"]`)).toHaveCount(0, { timeout: 5_000 })

  const start = performance.now()
  await page.keyboard.press('Control+Z')
  await expect(page.locator(`[data-id="${TASK_ID}"]`), JSON.stringify(await debugSnapshot(page), null, 2))
    .toHaveCount(1, { timeout: 2_000 })
  const secondUndoDurationMs = performance.now() - start

  expect(secondUndoDurationMs, JSON.stringify(await debugSnapshot(page), null, 2)).toBeLessThan(2_000)
})
