/**
 * Regression guards for BUG-1781 + BUG-1782 (shipped 2026-05-03 in v1.4.10).
 *
 * BUG-1781 — Canvas "Hide overdue tasks" toggle flipped state without
 *            re-filtering visible task nodes. Root cause: a plain-object
 *            getter wrapper around `taskStore` in useCanvasOrchestrator.
 *
 * BUG-1782 — Canvas Tidy button silently no-op'd for users without
 *            day-of-week / Today / Tomorrow groups. Root cause: a
 *            keyword filter in useTidyLayout that excluded custom groups.
 *
 * Bug C (BUG-1783, RecurrenceDeleteModal contrast) is covered by a unit
 * test at tests/unit/recurrence-delete-modal-styles.test.ts since opening
 * the modal via the seeded user requires triggering a recurring-task
 * delete flow that's out of scope for an e2e regression guard.
 *
 * All seeding mutates the seeded Playwright test user (playwright@test.flowstate)
 * — production data is never touched.
 */
import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'

// All tests here mutate the one shared Playwright user's canvas data. Under
// fullyParallel:true, two tests from this file would otherwise run on separate
// workers and clobber each other's seed state. Force them to run serially within
// the file. (This does NOT prevent a *different* canvas spec file from running
// concurrently on another worker — see the cross-file note in the suite report.)
test.describe.configure({ mode: 'serial' })

// Reuse two pre-seeded tasks to avoid realtime races with newly-inserted rows.
// The afterEach below restores them to canonical seed shape.
const OVERDUE_TASK_ID = TEST_TASKS.designLandingPage.id
const FUTURE_TASK_ID = TEST_TASKS.setupCICD.id
// Custom groups are created via `canvasStore.createGroup()` which assigns
// UUIDs at runtime. Tests capture the IDs from the returned promise rather
// than hard-coding them.

// Helpers -------------------------------------------------------------------

const ensureStoresReady = async (page: import('@playwright/test').Page) => {
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } } } | null
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    return !!pinia?._s.get('tasks') && !!pinia?._s.get('canvas')
  }, { timeout: 30000 })
}

const pinia = (page: import('@playwright/test').Page) =>
  page.evaluateHandle(() => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: unknown } } } } }
    return root.__vue_app__._context.config.globalProperties.$pinia
  })

// Spec A — BUG-1781: hide-overdue toggle reactively re-filters --------------

test.describe('BUG-1781 — Canvas hide-overdue toggle reactively re-filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('flowstate-settings-v2')) {
        localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
      }
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })
    await page.goto('/#/canvas')
    await ensureStoresReady(page)

    // Mutate two existing seeded tasks to give one a past dueDate (overdue)
    // and one a future dueDate, both with canvasPositions inside the default
    // viewport. Using existing tasks avoids realtime-echo races on freshly-
    // inserted rows. afterEach restores them to the canonical seed shape.
    await page.waitForFunction(({ a, b }) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { _rawTasks?: { id: string }[] }> } } } } } }
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!._rawTasks
      return !!tasks?.find(t => t.id === a) && !!tasks?.find(t => t.id === b)
    }, { a: OVERDUE_TASK_ID, b: FUTURE_TASK_ID }, { timeout: 30000 })

    await page.evaluate(async ({ overdueId, futureId }) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { updateTask?: (id: string, patch: Record<string, unknown>) => Promise<void> | void }> } } } } } }
      const taskStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!

      const today = new Date()
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
      const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      await taskStore.updateTask!(overdueId, { dueDate: fmt(yesterday), canvasPosition: { x: 100, y: 200 } })
      await taskStore.updateTask!(futureId,  { dueDate: fmt(nextWeek),  canvasPosition: { x: 500, y: 200 } })
    }, { overdueId: OVERDUE_TASK_ID, futureId: FUTURE_TASK_ID })

    // Wait for both nodes to be present in the Vue Flow node list
    await page.waitForFunction(({ overdueId, futureId }) => {
      return !!document.querySelector(`[data-id="${overdueId}"]`)
        && !!document.querySelector(`[data-id="${futureId}"]`)
    }, { overdueId: OVERDUE_TASK_ID, futureId: FUTURE_TASK_ID }, { timeout: 15000 })
  })

  test.afterEach(async ({ page }) => {
    // Restore overdue flag + clear test-induced canvas positions / dueDates
    await page.evaluate(async ({ overdueId, futureId }) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { hideCanvasOverdueTasks?: boolean; toggleCanvasOverdueTasks?: () => void; updateTask?: (id: string, patch: Record<string, unknown>) => Promise<void> | void }> } } } } } }
      const taskStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      if (taskStore.hideCanvasOverdueTasks) taskStore.toggleCanvasOverdueTasks!()
      await taskStore.updateTask?.(overdueId, { dueDate: '', canvasPosition: undefined })
      await taskStore.updateTask?.(futureId,  { dueDate: '', canvasPosition: undefined })
    }, { overdueId: OVERDUE_TASK_ID, futureId: FUTURE_TASK_ID }).catch(() => { /* ignore on close */ })
  })

  test('clicking Hide-overdue removes overdue task from the canvas', async ({ page }) => {
    // Sanity: both nodes present
    await expect(page.locator(`[data-id="${OVERDUE_TASK_ID}"]`)).toHaveCount(1)
    await expect(page.locator(`[data-id="${FUTURE_TASK_ID}"]`)).toHaveCount(1)

    // Click the hide-overdue toolbar button via its title attr
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll<HTMLButtonElement>('.canvas-toolbar-edge button'))
        .find(b => /overdue/i.test(b.title || ''))
      if (!btn) throw new Error('hide-overdue button not found')
      btn.click()
    })

    // Wait for the overdue node to leave the DOM (Vue Flow re-renders nodes on filter change)
    await expect(page.locator(`[data-id="${OVERDUE_TASK_ID}"]`)).toHaveCount(0, { timeout: 5000 })

    // Future node should still be present
    await expect(page.locator(`[data-id="${FUTURE_TASK_ID}"]`)).toHaveCount(1)

    // Store flag reflects the click
    const flag = await page.evaluate(() => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { hideCanvasOverdueTasks?: boolean }> } } } } } }
      return root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!.hideCanvasOverdueTasks
    })
    expect(flag).toBe(true)
  })

  test('clicking Hide-overdue twice restores the overdue task', async ({ page }) => {
    const clickToggle = () => page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll<HTMLButtonElement>('.canvas-toolbar-edge button'))
        .find(b => /overdue/i.test(b.title || ''))
      btn?.click()
    })

    await clickToggle()
    await expect(page.locator(`[data-id="${OVERDUE_TASK_ID}"]`)).toHaveCount(0, { timeout: 5000 })

    await clickToggle()
    await expect(page.locator(`[data-id="${OVERDUE_TASK_ID}"]`)).toHaveCount(1, { timeout: 5000 })
  })
})

// Spec B — BUG-1782: Tidy works on custom-named groups ----------------------

test.describe('BUG-1782 — Canvas Tidy works on custom-named groups', () => {
  let createdIds: string[] = []

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('flowstate-settings-v2')) {
        localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
      }
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })
    await page.goto('/#/canvas')
    await ensureStoresReady(page)

    // Create 3 custom groups via the canonical store action (assigns UUIDs +
    // wires reactivity). Positions are deliberately non-canonical: different
    // Y values + uneven X spacing so Tidy MUST move at least one of them.
    createdIds = await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { createGroup?: (g: Record<string, unknown>) => Promise<{ id: string }> }> } } } } } }
      const canvasStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!

      const seeds = [
        { name: 'Project Alpha', position: { x: 1234, y: 999, width: 350, height: 1000 } },
        { name: 'Project Beta',  position: { x: 2345, y: 888, width: 350, height: 1000 } },
        { name: 'Project Gamma', position: { x: 3456, y: 777, width: 350, height: 1000 } },
      ]
      const results: string[] = []
      for (const seed of seeds) {
        const created = await canvasStore.createGroup!(seed)
        if (created?.id) results.push(created.id)
      }
      return results
    })

    expect(createdIds.length).toBe(3)

    // Wait for all 3 groups to settle in the store (realtime sync can briefly
    // remove freshly-pushed groups before the upsert echoes back).
    await page.waitForFunction((ids) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { groups?: { id: string }[] }> } } } } } }
      const groups = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!.groups || []
      return ids.every(id => groups.some(g => g.id === id))
    }, createdIds, { timeout: 10000 })
  })

  test.afterEach(async ({ page }) => {
    // Remove the test groups via the store deleteGroup action
    if (createdIds.length === 0) return
    await page.evaluate(async (ids) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { deleteGroup?: (id: string) => Promise<void> | void }> } } } } } }
      const canvasStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
      for (const id of ids) await canvasStore.deleteGroup?.(id)
    }, createdIds).catch(() => { /* ignore on close */ })
    createdIds = []
  })

  test('Tidy moves custom-named groups into a canonical single row', async ({ page }) => {
    const readPositions = (ids: string[]) => page.evaluate((ids) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { groups?: { id: string; position?: { x: number; y: number } }[] }> } } } } } }
      const groups = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!.groups || []
      return ids.map(id => {
        const g = groups.find(x => x.id === id)
        return g ? { id, x: g.position?.x, y: g.position?.y } : null
      }).filter(Boolean) as { id: string; x: number; y: number }[]
    }, ids)

    const before = await readPositions(createdIds)
    expect(before.length).toBe(3)
    // Sanity: seed uses different Y values
    const beforeYs = new Set(before.map(g => g.y))
    expect(beforeYs.size).toBeGreaterThan(1)

    // Wait for the canvas-side toolbar to render before trying to click Tidy
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll<HTMLButtonElement>('.canvas-toolbar-edge button'))
        .some(b => /tidy/i.test(b.title || ''))
    }, { timeout: 15000 })

    // Click Tidy
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll<HTMLButtonElement>('.canvas-toolbar-edge button'))
        .find(b => /tidy/i.test(b.title || ''))
      if (!btn) throw new Error('tidy button not found')
      btn.click()
    })

    // Poll until all 3 custom groups share the same Y (canonical row settled)
    await expect.poll(async () => {
      const positions = await readPositions(createdIds)
      const ys = positions.map(g => g.y).filter((v): v is number => typeof v === 'number')
      return new Set(ys).size
    }, { timeout: 8000 }).toBe(1)

    const after = await readPositions(createdIds)
    // X values should be ascending and evenly spaced
    const xs = [...after].sort((a, b) => a.x - b.x).map(g => g.x)
    const gap1 = xs[1] - xs[0]
    const gap2 = xs[2] - xs[1]
    expect(gap1).toBe(gap2)
  })
})
