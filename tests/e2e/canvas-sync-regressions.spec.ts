/**
 * Recurring canvas & sync regressions — permanent behavioral guards (TASK-1871)
 * ============================================================================
 * These reproduce the bug CLASSES that keep resurfacing, at a level that fails
 * on the buggy behaviour and passes once the root cause is fixed:
 *
 *   R1  all-nodes-shift   — dropping/adding ONE canvas node must not move others.
 *   R2  sync-cut          — a field change on client A must reach an INDEPENDENT
 *                            client B over Realtime (incl. non-core fields).
 *   R3  no-auto-reposition— merely opening the canvas must not rewrite geometry.
 *   R4  no-vanish         — deleting a group must keep its child tasks visible.
 *
 * R2 uses two genuinely independent clients (separate context + websocket), the
 * only way to exercise multi-device Realtime races. R1/R3 lean on the
 * geometry-write instrumentation (window.__FlowStateGeometryWrites) so the
 * assertion is about WHICH entity got a geometry write, not a flaky pixel diff.
 *
 * Requires local Supabase (SUPABASE_SERVICE_ROLE_KEY) — set by scripts/run-e2e.sh.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { test, expect, readCanvasNodePositions, expectNoNodesMoved, waitForCanvasNodes } from '../fixtures/two-client'
import type { Page } from '@playwright/test'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Canvas tasks seeded far from the global-setup groups (x=100/500) to avoid
// spatial auto-assignment stealing them into a group.
const ROOT_TASKS = [
  { id: 'tsr-root-1', title: 'Sync Regr Root 1', x: 2000, y: 2000 },
  { id: 'tsr-root-2', title: 'Sync Regr Root 2', x: 2400, y: 2000 },
  { id: 'tsr-root-3', title: 'Sync Regr Root 3', x: 2200, y: 2400 },
]
const INBOX_TASK = { id: 'tsr-inbox-1', title: 'Sync Regr Inbox 1' }
const DROP_TARGET = { x: 2600, y: 2600 }

const GROUP_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01' // real UUID — legacy IDs skip group sync
const GROUP = { x: 4000, y: 4000, width: 800, height: 600 }
const CHILD_TASK = { id: 'tsr-child-1', title: 'Sync Regr Child 1', x: 4100, y: 4100 }

let admin: SupabaseClient
let userId: string

const ALL_IDS = [...ROOT_TASKS.map((t) => t.id), INBOX_TASK.id, CHILD_TASK.id]

async function gotoCanvasReady(page: Page) {
  const ready = () => {
    const root = document.querySelector('#app') as any
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    return !!pinia?._s.get('tasks') && !!pinia?._s.get('canvas')
  }
  await page.goto('/#/canvas')
  await page.waitForFunction(ready, { timeout: 30_000 })
}

test.describe('Recurring canvas/sync regressions (TASK-1871)', () => {
  // Serial: every test re-seeds the SAME fixed IDs in beforeEach. Under parallel
  // workers two tests would delete/insert the same rows concurrently and flake.
  // Longer timeout absorbs a one-time Vite cold-start reload on the first test.
  test.describe.configure({ mode: 'serial', timeout: 90_000 })
  test.skip(!SERVICE_ROLE_KEY, 'requires SUPABASE_SERVICE_ROLE_KEY (set by scripts/run-e2e.sh)')

  test.beforeEach(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await admin.auth.admin.listUsers()
    let user = data.users.find((u) => u.email === 'playwright@test.flowstate')
    for (let i = 0; i < 10 && !user; i++) {
      await new Promise(r => setTimeout(r, 1000))
      const res = await admin.auth.admin.listUsers()
      user = res.data.users.find((u) => u.email === 'playwright@test.flowstate')
    }
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({ email: 'playwright@test.flowstate', password: 'pw-playwright-e2e-2026!', email_confirm: true });
      if (error) {
        console.warn('Failed to create test user, falling back to listUsers retry...', error.message);
        for (let i = 0; i < 10 && !user; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const res = await admin.auth.admin.listUsers();
          if (res.data && res.data.users) {
            user = res.data.users.find((u) => u.email === 'playwright@test.flowstate');
          }
        }
      } else {
        user = data?.user;
      }
      if (!user) throw new Error(`Failed to create or fetch test user. Last error: ${error?.message}`);
    }
    userId = user.id

    await admin.from('tasks').delete().in('id', ALL_IDS)
    await admin.from('groups').delete().eq('id', GROUP_ID)
    await admin.from('tombstones').delete().in('entity_id', [...ALL_IDS, GROUP_ID])

    // Root canvas tasks
    for (const t of ROOT_TASKS) {
      await admin.from('tasks').insert({
        id: t.id, user_id: userId, title: t.title, status: 'planned', priority: 'medium',
        is_in_inbox: false,
        position: { x: t.x, y: t.y, format: 'absolute' }, position_version: 1,
      })
    }
    // One inbox task to drop onto the canvas
    await admin.from('tasks').insert({
      id: INBOX_TASK.id, user_id: userId, title: INBOX_TASK.title, status: 'planned',
      priority: 'medium', is_in_inbox: true, position_version: 1,
    })
    // A group with a child task (for the no-vanish delete test)
    await admin.from('groups').insert({
      id: GROUP_ID, user_id: userId, name: 'Regr Group', type: 'custom', color: '#4ECDC4',
      position_json: { x: GROUP.x, y: GROUP.y, width: GROUP.width, height: GROUP.height },
      layout: 'freeform', position_version: 1,
    })
    await admin.from('tasks').insert({
      id: CHILD_TASK.id, user_id: userId, title: CHILD_TASK.title, status: 'planned',
      priority: 'medium', is_in_inbox: false,
      position: { x: CHILD_TASK.x, y: CHILD_TASK.y, format: 'absolute', parentId: GROUP_ID },
      position_version: 1,
    })
  })

  test.afterAll(async () => {
    if (!admin) return
    await admin.from('tasks').delete().in('id', ALL_IDS)
    await admin.from('groups').delete().eq('id', GROUP_ID)
    await admin.from('groups').delete().eq('user_id', userId).eq('name', 'Monday') // R7 migrated group
    await admin.from('tombstones').delete().in('entity_id', [...ALL_IDS, GROUP_ID])
  })

  // ── R7: a legacy non-UUID group migrates to a synced UUID and reaches client B ─
  test('R7 - legacy day-group migrates to a UUID and syncs across clients', async ({ clientA, clientB }) => {
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)
    await waitForCanvasNodes(clientB, ROOT_TASKS.length)
    await admin.from('groups').delete().eq('user_id', userId).eq('name', 'Monday')

    // Client A has a LEGACY-id "Monday" day-column (never synced — toSupabaseGroup skips it).
    const legacyId = `legacy-monday-${ROOT_TASKS.length}`
    await clientA.evaluate(async (lid) => {
      const root = document.querySelector('#app') as any
      const canvas = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
      await canvas.createGroup({
        id: lid, name: 'Monday', type: 'custom', color: '#4ECDC4',
        position: { x: 5000, y: 5000, width: 800, height: 600 }, layout: 'freeform',
      })
    }, legacyId)

    // Run the migration.
    const res = await clientA.evaluate((uid) => {
      const root = document.querySelector('#app') as any
      const canvas = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
      return canvas.migrateLegacyGroupIds(uid)
    }, userId)
    expect((res as any).migrated).toBeGreaterThanOrEqual(1)

    // It now exists in the DB with a real UUID id (it never could before).
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    await expect(async () => {
      const { data } = await admin.from('groups').select('id,name').eq('user_id', userId).eq('name', 'Monday')
      expect((data ?? []).some((g: any) => UUID_RE.test(g.id)), 'no UUID Monday group in DB').toBe(true)
    }).toPass({ timeout: 12_000 })

    // And the independent client B receives it live.
    await expect(async () => {
      const hasMonday = await clientB.evaluate(() => {
        const root = document.querySelector('#app') as any
        const canvas = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
        return canvas.groups.some((g: any) => g.name === 'Monday')
      })
      expect(hasMonday, 'client B never received the migrated group').toBe(true)
    }).toPass({ timeout: 12_000 })
  })

  // ── R1: dropping one task onto the canvas must not move the others ──────────
  test('R1 - adding a task to the canvas does not shift existing nodes', async ({ clientA }) => {
    await gotoCanvasReady(clientA)
    await waitForCanvasNodes(clientA, ROOT_TASKS.length)

    const before = await readCanvasNodePositions(clientA)

    // Reset the geometry-write log, then perform the real "move inbox task to
    // canvas" path (what a sidebar drop does: updateTask with canvasPosition).
    await clientA.evaluate((drop) => {
      const root = document.querySelector('#app') as any
      ;(window as any).__FlowStateGeometryWrites = []
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.updateTask('tsr-inbox-1', {
        isInInbox: false,
        canvasPosition: { x: drop.x, y: drop.y },
        positionFormat: 'absolute',
      }, 'USER')
    }, DROP_TARGET)

    await clientA.waitForTimeout(1500)

    // Invariant: only the dropped task may receive a geometry write.
    const writes = await clientA.evaluate(() => (window as any).__FlowStateGeometryWrites ?? [])
    const movedOthers = (writes as any[]).filter((w) => w.entityId !== 'tsr-inbox-1')
    expect(movedOthers, `Other entities got geometry writes on drop: ${JSON.stringify(movedOthers)}`).toEqual([])

    // And the existing nodes' rendered positions must be unchanged.
    const after = await readCanvasNodePositions(clientA)
    expectNoNodesMoved(before, after, { ignore: ['tsr-inbox-1'] })
  })

  // ── R2: a field change on A propagates to an INDEPENDENT client B ──────────
  test('R2 - task field update on client A reaches independent client B via Realtime', async ({ clientA, clientB }) => {
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)
    await waitForCanvasNodes(clientB, ROOT_TASKS.length)

    const newTitle = 'Sync Regr Root 1 — EDITED-A'
    // Also touch a non-core field (tags) — the field-completeness trap class.
    await clientA.evaluate((title) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.updateTask('tsr-root-1', { title, tags: ['sync-probe'] }, 'USER')
    }, newTitle)

    // Client B must reflect both the title AND the non-core field within ~10s.
    await expect(async () => {
      const state = await clientB.evaluate(() => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        const t = tasks.rawTasks.find((x: any) => x.id === 'tsr-root-1')
        return { title: t?.title ?? null, tags: t?.tags ?? [] }
      })
      expect(state.title).toBe(newTitle)
      expect(state.tags).toContain('sync-probe')
    }).toPass({ timeout: 12_000 })
  })

  // ── R5: moving a node on A propagates LIVE to independent client B ──────────
  test('R5 - moving a task on client A live-updates its position on client B', async ({ clientA, clientB }) => {
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)
    await waitForCanvasNodes(clientB, ROOT_TASKS.length)

    const target = { x: 2850, y: 2850 }
    // Real drag-equivalent: persist a new canvasPosition from A (source 'DRAG').
    await clientA.evaluate((pos) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.updateTask('tsr-root-1', {
        canvasPosition: { x: pos.x, y: pos.y }, positionFormat: 'absolute',
      }, 'DRAG')
    }, target)

    // (1) B's STORE must receive the new position (realtime → updateTaskFromSync).
    await expect(async () => {
      const storePos = await clientB.evaluate(() => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        const t = tasks.rawTasks.find((x: any) => x.id === 'tsr-root-1')
        return t?.canvasPosition ?? null
      })
      expect(storePos, 'B store never got the new position').toBeTruthy()
      expect(Math.abs(storePos.x - target.x)).toBeLessThan(2)
      expect(Math.abs(storePos.y - target.y)).toBeLessThan(2)
    }).toPass({ timeout: 12_000 })

    // (2) B's rendered NODE must actually move (no reload) — the live-canvas part.
    await expect(async () => {
      const positions = await readCanvasNodePositions(clientB)
      const node = positions['tsr-root-1']
      expect(node, 'B node tsr-root-1 not rendered').toBeTruthy()
      expect(Math.abs(node.x - target.x)).toBeLessThan(2)
      expect(Math.abs(node.y - target.y)).toBeLessThan(2)
    }).toPass({ timeout: 12_000 })
  })

  // ── R6: moving a GROUP on A propagates LIVE to independent client B ─────────
  test('R6 - moving a group on client A live-updates its position on client B', async ({ clientA, clientB }) => {
    const bLogs: string[] = []
    clientB.on('console', (m) => {
      const t = m.text()
      if (/GROUP|HANDLER|REALTIME/i.test(t)) bLogs.push(t)
    })
    const aLogs: string[] = []
    clientA.on('console', (m) => {
      const t = m.text()
      if (/\[SYNC\]|GROUP|enqueue|DISCARD|conflict|LWW/i.test(t)) aLogs.push(t)
    })
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)
    await waitForCanvasNodes(clientB, ROOT_TASKS.length)

    const target = { x: 4500, y: 4500 }
    await clientA.evaluate(({ pos, gid }) => {
      const root = document.querySelector('#app') as any
      const canvas = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
      return canvas.updateGroup(gid, { position: { x: pos.x, y: pos.y, width: 800, height: 600 } })
    }, { pos: target, gid: GROUP_ID })

    // BISECT: did client A persist the move to the DB at all?
    await expect(async () => {
      const { data } = await admin.from('groups').select('position_json').eq('id', GROUP_ID).single()
      const dbx = (data?.position_json as any)?.x
      expect(dbx, `DB group x=${dbx} (want ${target.x}) — A never persisted the move.\nA SYNC logs:\n${aLogs.join('\n') || '(no sync logs)'}`).toBe(target.x)
    }).toPass({ timeout: 12_000 })

    await expect(async () => {
      const storePos = await clientB.evaluate((gid) => {
        const root = document.querySelector('#app') as any
        const canvas = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
        const g = canvas.groups.find((x: any) => x.id === gid)
        return g?.position ?? null
      }, GROUP_ID)
      expect(storePos).toBeTruthy()
      expect(
        Math.abs(storePos.x - target.x),
        `B group x=${storePos?.x} (want ${target.x}).\nB GROUP/HANDLER logs:\n${bLogs.join('\n') || '(none — onGroupChange never fired on B)'}`
      ).toBeLessThan(2)
    }).toPass({ timeout: 12_000 })
  })

  // ── R3: opening the canvas must not auto-reposition anything ────────────────
  test('R3 - opening the canvas performs no automated geometry writes', async ({ clientA }) => {
    // Capture geometry writes from the very first paint.
    await clientA.addInitScript(() => {
      ;(window as any).__FlowStateGeometryWrites = []
    })
    await gotoCanvasReady(clientA)
    await waitForCanvasNodes(clientA, ROOT_TASKS.length)
    await clientA.waitForTimeout(2500) // allow day-group rotation / catchup to fire if it would

    const autoWrites = await clientA.evaluate(() =>
      ((window as any).__FlowStateGeometryWrites ?? []).map((w: any) => ({ source: w.source, id: w.entityId }))
    )
    expect(autoWrites, `Opening the canvas wrote geometry (auto-reposition): ${JSON.stringify(autoWrites)}`).toEqual([])
  })

  // ── R4: deleting a group must not make its child tasks vanish ───────────────
  test('R4 - deleting a group keeps its child tasks on the canvas', async ({ clientA }) => {
    await gotoCanvasReady(clientA)
    await expect(clientA.locator(`[data-id="${CHILD_TASK.id}"]`)).toHaveCount(1, { timeout: 20_000 })

    await clientA.evaluate((groupId) => {
      const root = document.querySelector('#app') as any
      const canvas = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
      return canvas.deleteGroup(groupId)
    }, GROUP_ID)

    await clientA.waitForTimeout(1500)

    // The group node is gone…
    await expect(clientA.locator(`[data-id="section-${GROUP_ID}"]`)).toHaveCount(0)
    // …but the child task must survive (reparented to root), not vanish.
    await expect(clientA.locator(`[data-id="${CHILD_TASK.id}"]`)).toHaveCount(1)
    const childParent = await clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((t: any) => t.id === taskId)?.parentId ?? null
    }, CHILD_TASK.id)
    expect(childParent, 'Child task left with a dangling parentId').toBeFalsy()
  })
})
