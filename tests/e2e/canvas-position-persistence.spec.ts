/**
 * Canvas Position Persistence — TASK-131 / TASK-142 regression guard.
 *
 * TASK-131 (Jan 2026): a competing `deep:true` watcher in canvas.ts re-synced
 * the canvas on ANY task property change, overwriting drag-locked positions.
 * TASK-142: the canvas store loaded groups from localStorage before auth was
 * ready, so geometry saved to Supabase was lost on refresh.
 *
 * These guard the INVARIANT both fixes protect — a task/group position, once
 * set, is not reset by a subsequent field update or by a page reload. Asserted
 * at store-truth level (Pinia canvasPosition / group.position), which is the
 * value the renderer draws from; deterministic, no pixel-level mouse drag.
 *
 * Relocated into tests/e2e/ (2026-07-03) so the suite actually discovers it —
 * the original tests/canvas-position-persistence.spec.ts sat outside testDir
 * and had never run, rotting from six months of UI drift.
 */

import { test, expect } from '../fixtures/auth'

const gotoCanvas = async (page: import('@playwright/test').Page) => {
  await page.goto('/#/canvas')
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } } } | null
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    return !!pinia?._s.get('tasks') && !!pinia?._s.get('canvas') && !!document.querySelector('.vue-flow__pane')
  }, { timeout: 30000 })
}

const taskCanvasPos = (page: import('@playwright/test').Page, id: string) =>
  page.evaluate((taskId) => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { rawTasks?: Array<{ id: string; canvasPosition?: { x: number; y: number } }>; tasks: Array<{ id: string; canvasPosition?: { x: number; y: number } }> }> } } } } } }
    const t = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
    const task = (t.rawTasks || t.tasks).find(x => x.id === taskId)
    return task?.canvasPosition ?? null
  }, id)

test.describe('Canvas Position Persistence (TASK-131 / TASK-142 regression guard)', () => {

// TASK-1906: environment gate — shares the one seeded test user; under parallel
// workers another spec file mutates the same user's data (Supabase realtime)
// and clobbers this pack's create/reload state. Green with --workers=1.
test.beforeEach(() => {
  test.skip(test.info().config.workers > 1, 'TASK-1906: shared-test-user interference under parallel workers — run with --workers=1')
})

  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await gotoCanvas(page)
  })

  test('TASK-131: a task field update does not reset its canvas position', async ({ page }) => {
    const id = await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { createTask: (t: Record<string, unknown>) => Promise<{ id: string }> }> } } } } } }
      const t = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = await t.createTask({ title: 'Position Persistence Test', status: 'planned', canvasPosition: { x: 500, y: 300 }, positionFormat: 'absolute' })
      return task.id
    })
    expect(id).toBeTruthy()

    expect(await taskCanvasPos(page, id)).toEqual(expect.objectContaining({ x: 500, y: 300 }))

    // The TASK-131 trigger: a non-geometry field update must NOT reset position
    await page.evaluate((taskId) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { updateTask: (id: string, u: Record<string, unknown>) => Promise<void> }> } } } } } }
      return root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!.updateTask(taskId, { title: 'Position Persistence Test — Updated' })
    }, id)
    await page.waitForTimeout(1500)

    expect(
      await taskCanvasPos(page, id),
      'a title update reset the canvas position (TASK-131 competing-watcher regression)'
    ).toEqual(expect.objectContaining({ x: 500, y: 300 }))

    await page.evaluate((taskId) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { deleteTask: (id: string) => Promise<void> }> } } } } } }
      return root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!.deleteTask(taskId)
    }, id).catch(() => {})
  })

  test('TASK-131: rapid field updates do not reset a canvas position', async ({ page }) => {
    const id = await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { createTask: (t: Record<string, unknown>) => Promise<{ id: string }>; updateTask: (id: string, u: Record<string, unknown>) => Promise<void> }> } } } } } }
      const t = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = await t.createTask({ title: 'Rapid Update Test', status: 'planned', canvasPosition: { x: 600, y: 400 }, positionFormat: 'absolute' })
      for (let i = 0; i < 5; i++) await t.updateTask(task.id, { description: `Update ${i} @ ${i * 7}` })
      return task.id
    })
    await page.waitForTimeout(1500)

    expect(
      await taskCanvasPos(page, id),
      'rapid updates reset the canvas position (competing-sync regression)'
    ).toEqual(expect.objectContaining({ x: 600, y: 400 }))

    await page.evaluate((taskId) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { deleteTask: (id: string) => Promise<void> }> } } } } } }
      return root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!.deleteTask(taskId)
    }, id).catch(() => {})
  })

  test('TASK-142: a task canvas position persists across a page reload', async ({ page }) => {
    const id = await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { createTask: (t: Record<string, unknown>) => Promise<{ id: string }> }> } } } } } }
      const t = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = await t.createTask({ title: 'Refresh Persistence Test', status: 'planned', canvasPosition: { x: 420, y: 260 }, positionFormat: 'absolute' })
      return task.id
    })
    // Let the offline-first queue persist to Supabase before reloading
    await page.waitForTimeout(3000)

    await page.reload()
    await gotoCanvas(page)
    await page.waitForTimeout(2000)

    expect(
      await taskCanvasPos(page, id),
      'task canvas position was lost across reload (TASK-142 auth-timing regression)'
    ).toEqual(expect.objectContaining({ x: 420, y: 260 }))

    await page.evaluate((taskId) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { deleteTask: (id: string) => Promise<void> }> } } } } } }
      return root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!.deleteTask(taskId)
    }, id).catch(() => {})
  })

  test('TASK-142: a group position persists across a page reload', async ({ page }) => {
    const id = await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { createGroup: (g: Record<string, unknown>) => Promise<{ id: string }> }> } } } } } }
      const c = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
      const g = await c.createGroup({ name: 'Persistence Group', type: 'custom', color: '#4ECDC4', position: { x: 720, y: 360, width: 360, height: 500 } })
      return g.id
    })
    await page.waitForTimeout(3000)

    await page.reload()
    await gotoCanvas(page)
    await page.waitForTimeout(2000)

    const pos = await page.evaluate((groupId) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { groups: Array<{ id: string; position?: { x: number; y: number } }> }> } } } } } }
      const g = (root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!.groups || []).find(x => x.id === groupId)
      return g?.position ? { x: g.position.x, y: g.position.y } : null
    }, id)
    expect(pos, 'group position was lost across reload (TASK-142)').toEqual(expect.objectContaining({ x: 720, y: 360 }))

    await page.evaluate((groupId) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { deleteGroup?: (id: string) => Promise<void> }> } } } } } }
      return root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!.deleteGroup?.(groupId)
    }, id).catch(() => {})
  })
})
