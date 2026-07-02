/**
 * TASK-1773 slice 2: floating toolbar on selected mini-canvas node.
 *
 * Verifies that selecting a SubtaskNode or NoteNode reveals the floating
 * toolbar with the correct buttons and that each button triggers the
 * expected store action.
 *
 * Uses the seeded Playwright test user (tests/global-setup.ts), so this
 * spec NEVER mutates production data.
 */
import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'

// TASK-1906: environment gate — all E2E specs share ONE seeded test user; under
// parallel workers another spec file mutates the same user's data concurrently
// (Supabase realtime) and clobbers this file's seed state. Runs green with
// --workers=1; skipped in multi-worker suites until per-worker test users land.
test.beforeEach(() => {
  test.skip(
    test.info().config.workers > 1,
    'TASK-1906: shared-test-user interference under parallel workers — run with --workers=1'
  )
})


const TASK_ID = TEST_TASKS.designLandingPage.id

test.describe('TASK-1773 — mini-canvas floating toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('flowstate-settings-v2')) {
        localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
      }
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })
    await page.goto('/#/tasks')

    // Wait for stores to register AND for the seeded test task to appear in the store
    // (the store is hydrated asynchronously from Supabase after auth completes).
    await page.waitForFunction((id) => {
      const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { _rawTasks?: { id: string }[] }> } } } } } } | null
      const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
      const taskStore = pinia?._s.get('tasks')
      const modalsReady = !!pinia?._s.get('canvasModals')
      return modalsReady && !!taskStore?._rawTasks?.find?.(t => t.id === id)
    }, TASK_ID, { timeout: 30000 })

    // Open mini-canvas (empty state initially)
    await page.evaluate((id) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { openMiniCanvas?: (id: string) => void }> } } } } } }
      root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvasModals')!.openMiniCanvas!(id)
    }, TASK_ID)
    await expect(page.locator('.mini-canvas-overlay')).toBeVisible({ timeout: 10000 })

    // Create two subtasks via the mini-canvas's own action (bypasses realtime sync races).
    // useMiniCanvas exposes addSubtask — we invoke it directly through the existing top
    // toolbar's Add Subtask button twice. This is also closer to a real user flow.
    await page.locator('.mini-canvas-overlay >> button[title*="subtask" i], button:has-text("Subtask")').first().click({ force: true })
    await page.waitForTimeout(300)
    await page.locator('.mini-canvas-overlay >> button[title*="subtask" i], button:has-text("Subtask")').first().click({ force: true })
    await page.waitForTimeout(300)

    // At least one subtask node should now render
    await expect(page.locator('.vue-flow__node-subtaskNode').first()).toBeVisible({ timeout: 10000 })
  })

  test.afterEach(async ({ page }) => {
    // Restore the seeded task to its original (subtask-less) state so other specs
    // see the canonical fixture data.
    await page.evaluate((id) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { updateTask: (id: string, patch: Record<string, unknown>) => void }> } } } } } }
      const pinia = root.__vue_app__._context.config.globalProperties.$pinia
      pinia._s.get('tasks')?.updateTask(id, { subtasks: [], planningNotes: [] })
    }, TASK_ID).catch(() => { /* ignore if page is closed */ })
  })

  // Click a toolbar button by title via dispatchEvent — bypasses Playwright's
  // viewport check (NodeToolbar can render off-screen when the node is panned out).
  const clickToolbarButton = async (page: import('@playwright/test').Page, title: string) => {
    await page.evaluate((t) => {
      const btn = document.querySelector<HTMLButtonElement>(
        `.mini-canvas-floating-toolbar button[title="${t}"]`
      )
      if (!btn) throw new Error(`toolbar button "${t}" not found`)
      btn.click()
    }, title)
    await page.waitForTimeout(300)
  }

  const clickFirstSubtaskCorner = async (page: import('@playwright/test').Page) => {
    // Vue Flow's @node-click can be flaky to trigger via real mouse coords (handles intercept,
    // textarea steals focus). Most reliable: dispatch a synthetic click on the node element
    // — bubbles to Vue Flow's listener which fires @node-click. force option bypasses
    // pointer-event interception checks.
    await page.evaluate(() => {
      const node = document.querySelector('.vue-flow__node-subtaskNode') as HTMLElement | null
      if (!node) throw new Error('subtask node not found')
      const rect = node.getBoundingClientRect()
      const x = rect.x + rect.width / 2
      const y = rect.y + 6
      node.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }))
      node.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }))
      node.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }))
    })
    await page.waitForTimeout(400)
  }

  test('selecting a subtask reveals 4 toolbar buttons', async ({ page }) => {
    await clickFirstSubtaskCorner(page)
    const toolbar = page.locator('.mini-canvas-floating-toolbar')
    await expect(toolbar).toBeVisible()
    await expect(toolbar).toHaveAttribute('role', 'toolbar')
    await expect(toolbar).toHaveAttribute('aria-label', 'Selected node actions')
    await expect(toolbar.locator('button')).toHaveCount(4)
  })

  test('edit button focuses the subtask title textarea', async ({ page }) => {
    await clickFirstSubtaskCorner(page)
    await clickToolbarButton(page, 'Edit')
    await expect.poll(async () => page.evaluate(() => {
      const ae = document.activeElement as HTMLElement | null
      return ae?.tagName + ':' + (ae?.closest('.vue-flow__node-subtaskNode') ? 'in-subtask' : 'elsewhere')
    })).toBe('TEXTAREA:in-subtask')
  })

  test('add-child button creates a new subtask', async ({ page }) => {
    const before = await page.evaluate((id) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { _rawTasks: { id: string; subtasks?: unknown[] }[] }> } } } } } }
      return root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!._rawTasks.find(t => t.id === id)!.subtasks!.length
    }, TASK_ID)
    await clickFirstSubtaskCorner(page)
    await clickToolbarButton(page, 'Add child')
    await expect.poll(async () => page.evaluate((id) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { _rawTasks: { id: string; subtasks?: unknown[] }[] }> } } } } } }
      return root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!._rawTasks.find(t => t.id === id)!.subtasks!.length
    }, TASK_ID)).toBe(before + 1)
  })

  test('toggle-complete button flips isCompleted', async ({ page }) => {
    await clickFirstSubtaskCorner(page)
    await clickToolbarButton(page, 'Mark complete')
    await expect.poll(async () => page.evaluate((id) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { _rawTasks: { id: string; subtasks?: { isCompleted: boolean }[] }[] }> } } } } } }
      return root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!._rawTasks.find(t => t.id === id)!.subtasks![0].isCompleted
    }, TASK_ID)).toBe(true)
  })

  test('delete button removes the subtask and hides the toolbar', async ({ page }) => {
    await clickFirstSubtaskCorner(page)
    await clickToolbarButton(page, 'Delete')
    await expect(page.locator('.mini-canvas-floating-toolbar')).not.toBeVisible()
    const remaining = await page.evaluate((id) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { _rawTasks: { id: string; subtasks?: unknown[] }[] }> } } } } } }
      return root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!._rawTasks.find(t => t.id === id)!.subtasks!.length
    }, TASK_ID)
    expect(remaining).toBe(1)
  })

  test('right-click on a node shows context menu and hides the toolbar', async ({ page }) => {
    await clickFirstSubtaskCorner(page)
    await page.evaluate(() => {
      const node = document.querySelector('.vue-flow__node-subtaskNode') as HTMLElement
      const r = node.getBoundingClientRect()
      node.dispatchEvent(new MouseEvent('contextmenu', { clientX: r.x + 6, clientY: r.y + 6, bubbles: true, button: 2 }))
    })
    await expect(page.locator('.mini-canvas-context-menu')).toBeVisible()
    await expect(page.locator('.mini-canvas-floating-toolbar')).not.toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('Escape clears selection but keeps the canvas open', async ({ page }) => {
    await clickFirstSubtaskCorner(page)
    await expect(page.locator('.mini-canvas-floating-toolbar')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.mini-canvas-floating-toolbar')).not.toBeVisible()
    await expect(page.locator('.mini-canvas-overlay')).toBeVisible()
  })

  test('note nodes get 3 buttons (no toggle)', async ({ page }) => {
    // Add a planning note far from the subtasks so click coords are unambiguous
    await page.evaluate((id) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { _rawTasks: { id: string; planningNotes?: unknown[] }[]; updateTask: (id: string, patch: Record<string, unknown>) => void }> } } } } } }
      const taskStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const t = taskStore._rawTasks.find(x => x.id === id)!
      const note = {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01',
        title: 'Test note',
        description: '',
        canvasPosition: { x: 600, y: -200 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      taskStore.updateTask(id, { planningNotes: [...(t.planningNotes || []), note] })
    }, TASK_ID)

    await page.locator('.vue-flow__node-noteNode').first().waitFor()
    await page.evaluate(() => {
      const node = document.querySelector('.vue-flow__node-noteNode') as HTMLElement
      const rect = node.getBoundingClientRect()
      const x = rect.x + rect.width / 2
      const y = rect.y + 6
      node.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }))
      node.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }))
      node.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }))
    })
    await page.waitForTimeout(400)

    const toolbar = page.locator('.mini-canvas-floating-toolbar')
    await expect(toolbar).toBeVisible()
    await expect(toolbar.locator('button')).toHaveCount(3)
    await expect(toolbar.locator('button[title="Mark complete"]')).toHaveCount(0)
    await expect(toolbar.locator('button[title="Mark incomplete"]')).toHaveCount(0)
  })
})
