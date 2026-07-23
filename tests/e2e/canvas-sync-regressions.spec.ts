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
import { randomUUID } from 'node:crypto'
import { ensureAuthUser, TEST_USER } from '../fixtures/auth'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Canvas tasks seeded far from the global-setup groups (x=100/500) to avoid
// spatial auto-assignment stealing them into a group.
const ROOT_TASKS = [
  { id: 'd1000000-0000-4000-8000-000000000001', title: 'Sync Regr Root 1', x: 2000, y: 2000 },
  { id: 'd1000000-0000-4000-8000-000000000002', title: 'Sync Regr Root 2', x: 2400, y: 2000 },
  { id: 'd1000000-0000-4000-8000-000000000003', title: 'Sync Regr Root 3', x: 2200, y: 2400 },
]
const INBOX_TASK = { id: 'd1000000-0000-4000-8000-000000000004', title: 'Sync Regr Inbox 1' }
const CREATED_TASK = { id: 'd1000000-0000-4000-8000-000000000006', title: 'Absolute Existence Probe' }
const OFFLINE_TASK = { id: 'd1000000-0000-4000-8000-000000000007', title: 'Offline Reconnect Probe' }
const OFFLINE_RECURRING_TASK = {
  id: 'd1000000-0000-4000-8000-000000000008',
  title: 'Offline Recurring Completion Probe',
  x: 2800,
  y: 2200,
}
const OFFLINE_QUICK_CREATE_TITLE = 'Offline Quick Create Probe'
const DROP_TARGET = { x: 2600, y: 2600 }

const GROUP_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01' // real UUID — legacy IDs skip group sync
const GROUP = { x: 4000, y: 4000, width: 800, height: 600 }
const CHILD_TASK = { id: 'd1000000-0000-4000-8000-000000000005', title: 'Sync Regr Child 1', x: 4100, y: 4100 }

let admin: SupabaseClient
let userId: string

const ALL_IDS = [
  ...ROOT_TASKS.map((t) => t.id),
  INBOX_TASK.id,
  CHILD_TASK.id,
  CREATED_TASK.id,
  OFFLINE_TASK.id,
  OFFLINE_RECURRING_TASK.id,
]

async function gotoCanvasReady(page: Page) {
  const ready = () => {
    const root = document.querySelector('#app') as any
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    return !!pinia?._s.get('tasks') && !!pinia?._s.get('canvas')
  }
  await expect(async () => {
    await page.goto('/#/canvas')
  }).toPass({ timeout: 30_000 })
  await page.waitForFunction(ready, { timeout: 30_000 })
}

async function gotoCatalogReady(page: Page) {
  await page.goto('/#/catalog')
  await page.waitForSelector('.all-tasks-view', { timeout: 30_000 })
  await page.getByText('All Active', { exact: true }).click()
}

async function gotoBoardReady(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate:board-view-type', 'priority')
  })
  await page.goto('/#/board')
  await page.waitForSelector('.board-view-wrapper', { timeout: 30_000 })
  await page.waitForSelector('.task-card[data-task-id]', { timeout: 30_000 })
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
    const user = await ensureAuthUser(admin, { ...TEST_USER, email_confirm: true })
    userId = user.id

    await admin.from('tasks').delete().in('id', ALL_IDS)
    await admin.from('tasks').delete().eq('recurrence_parent_id', OFFLINE_RECURRING_TASK.id)
    await admin.from('tombstones').delete().eq('entity_id', OFFLINE_RECURRING_TASK.id)
    OFFLINE_RECURRING_TASK.id = randomUUID()
    await admin.from('tasks').delete().eq('user_id', userId).eq('title', OFFLINE_QUICK_CREATE_TITLE)
    await admin.from('groups').delete().eq('id', GROUP_ID)
    await admin.from('tombstones').delete().in('entity_id', [...ALL_IDS, GROUP_ID])

    // Root canvas tasks
    for (const t of ROOT_TASKS) {
      const { error } = await admin.from('tasks').insert({
        id: t.id, user_id: userId, title: t.title, status: 'planned', priority: 'medium',
        is_in_inbox: false,
        position: { x: t.x, y: t.y, format: 'absolute' }, position_version: 1,
      })
      expect(error, `Failed to seed ${t.title}: ${error?.message}`).toBeNull()
    }
    // One inbox task to drop onto the canvas
    const { error: inboxError } = await admin.from('tasks').insert({
      id: INBOX_TASK.id, user_id: userId, title: INBOX_TASK.title, status: 'planned',
      priority: 'medium', is_in_inbox: true, position_version: 1,
    })
    expect(inboxError, `Failed to seed inbox task: ${inboxError?.message}`).toBeNull()
    // A group with a child task (for the no-vanish delete test)
    const { error: groupError } = await admin.from('groups').insert({
      id: GROUP_ID, user_id: userId, name: 'Regr Group', type: 'custom', color: '#4ECDC4',
      position_json: { x: GROUP.x, y: GROUP.y, width: GROUP.width, height: GROUP.height },
      layout: 'freeform', position_version: 1,
    })
    expect(groupError, `Failed to seed regression group: ${groupError?.message}`).toBeNull()
    const { error: childError } = await admin.from('tasks').insert({
      id: CHILD_TASK.id, user_id: userId, title: CHILD_TASK.title, status: 'planned',
      priority: 'medium', is_in_inbox: false,
      position: { x: CHILD_TASK.x, y: CHILD_TASK.y, format: 'absolute', parentId: GROUP_ID },
      position_version: 1,
    })
    expect(childError, `Failed to seed child task: ${childError?.message}`).toBeNull()

    const currentOccurrence = new Date()
    currentOccurrence.setDate(currentOccurrence.getDate() - 1)
    const currentOccurrenceDate = currentOccurrence.toISOString().slice(0, 10)
    const { error: recurringError } = await admin.from('tasks').insert({
      id: OFFLINE_RECURRING_TASK.id,
      user_id: userId,
      title: OFFLINE_RECURRING_TASK.title,
      status: 'planned',
      priority: 'medium',
      due_date: `${currentOccurrenceDate}T09:00:00+03:00`,
      due_time: '09:00',
      estimated_duration: 25,
      recurrence_rule: { pattern: 'daily', interval: 1, endType: 'never' },
      recurrence_parent_id: OFFLINE_RECURRING_TASK.id,
      recurrence_count: 0,
      is_completion_record: false,
      is_deleted: false,
      is_in_inbox: false,
      position: {
        x: OFFLINE_RECURRING_TASK.x,
        y: OFFLINE_RECURRING_TASK.y,
        format: 'absolute',
      },
      position_version: 1,
    })
    expect(recurringError, `Failed to seed recurring task: ${recurringError?.message}`).toBeNull()
  })

  test.afterAll(async () => {
    if (!admin) return
    await admin.from('tasks').delete().in('id', ALL_IDS)
    await admin.from('tasks').delete().eq('recurrence_parent_id', OFFLINE_RECURRING_TASK.id)
    await admin.from('tombstones').delete().eq('entity_id', OFFLINE_RECURRING_TASK.id)
    await admin.from('tasks').delete().eq('user_id', userId).eq('title', OFFLINE_QUICK_CREATE_TITLE)
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
    await clientA.evaluate(({ drop, taskId }) => {
      const root = document.querySelector('#app') as any
      ;(window as any).__FlowStateGeometryWrites = []
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.updateTask(taskId, {
        isInInbox: false,
        canvasPosition: { x: drop.x, y: drop.y },
        positionFormat: 'absolute',
      }, 'USER')
    }, { drop: DROP_TARGET, taskId: INBOX_TASK.id })

    await clientA.waitForTimeout(1500)

    // Invariant: only the dropped task may receive a geometry write.
    const writes = await clientA.evaluate(() => (window as any).__FlowStateGeometryWrites ?? [])
    const movedOthers = (writes as any[]).filter((w) => w.entityId !== INBOX_TASK.id)
    expect(movedOthers, `Other entities got geometry writes on drop: ${JSON.stringify(movedOthers)}`).toEqual([])

    // And the existing nodes' rendered positions must be unchanged.
    const after = await readCanvasNodePositions(clientA)
    expectNoNodesMoved(before, after, { ignore: [INBOX_TASK.id] })
  })

  // ── R2: a field change on A propagates to an INDEPENDENT client B ──────────
  test('R2 - task field update on client A reaches independent client B via Realtime', async ({ clientA, clientB }) => {
    const clientBLogs: string[] = []
    clientB.on('console', message => {
      const text = message.text()
      if (text.includes('[REALTIME]') || text.includes('[HANDLER]') || text.includes('[CANONICAL-CATCHUP]')) {
        clientBLogs.push(text)
      }
    })
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)
    await waitForCanvasNodes(clientB, ROOT_TASKS.length)

    const newTitle = 'Sync Regr Root 1 — EDITED-A'
    // Also touch a non-core field (tags) — the field-completeness trap class.
    await clientA.evaluate(({ title, taskId }) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.updateTask(taskId, { title, tags: ['sync-probe'] }, 'USER')
    }, { title: newTitle, taskId: ROOT_TASKS[0].id })

    await expect(async () => {
      const { data, error } = await admin
        .from('tasks')
        .select('title,tags')
        .eq('id', ROOT_TASKS[0].id)
        .single()
      expect(error).toBeNull()
      expect(data?.title).toBe(newTitle)
      expect(data?.tags).toContain('sync-probe')
    }).toPass({ timeout: 12_000 })

    // Client B must reflect both the title AND the non-core field within ~10s.
    try {
      await expect(async () => {
        const state = await clientB.evaluate((taskId) => {
          const root = document.querySelector('#app') as any
          const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
          const t = tasks.rawTasks.find((x: any) => x.id === taskId)
          return { title: t?.title ?? null, tags: t?.tags ?? [] }
        }, ROOT_TASKS[0].id)
        expect(state.title).toBe(newTitle)
        expect(state.tags).toContain('sync-probe')
      }).toPass({ timeout: 12_000 })
    } finally {
      console.log(`R2 client B sync diagnostics:\n${clientBLogs.join('\n')}`)
    }
  })

  test('R9 - a created task exists in Supabase, reaches another client, and survives reload', async ({ clientA, clientB }) => {
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)

    const createdId = await clientA.evaluate(async (task) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const created = await tasks.createTask({
        id: task.id,
        title: task.title,
        description: 'Created through the real task store',
        status: 'planned',
        priority: 'high',
        tags: ['existence-probe'],
        isInInbox: true,
      })
      return created.id
    }, CREATED_TASK)
    expect(createdId).toBe(CREATED_TASK.id)

    await expect(async () => {
      const { data, error } = await admin
        .from('tasks')
        .select('id,title,description,status,priority,tags,is_deleted')
        .eq('id', CREATED_TASK.id)
        .single()
      expect(error).toBeNull()
      expect(data).toEqual(expect.objectContaining({
        id: CREATED_TASK.id,
        title: CREATED_TASK.title,
        description: 'Created through the real task store',
        status: 'planned',
        priority: 'high',
        is_deleted: false,
      }))
      expect(data?.tags).toContain('existence-probe')
    }).toPass({ timeout: 12_000 })

    await expect(async () => {
      const task = await clientB.evaluate((taskId) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        return tasks.rawTasks.find((candidate: any) => candidate.id === taskId) ?? null
      }, CREATED_TASK.id)
      expect(task).toEqual(expect.objectContaining({
        id: CREATED_TASK.id,
        title: CREATED_TASK.title,
        priority: 'high',
      }))
      expect(task.tags).toContain('existence-probe')
    }).toPass({ timeout: 12_000 })

    await clientB.reload()
    await gotoCanvasReady(clientB)

    await expect(async () => {
      const task = await clientB.evaluate((taskId) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        return tasks.rawTasks.find((candidate: any) => candidate.id === taskId) ?? null
      }, CREATED_TASK.id)
      expect(task).toEqual(expect.objectContaining({
        id: CREATED_TASK.id,
        title: CREATED_TASK.title,
        description: 'Created through the real task store',
        priority: 'high',
      }))
      expect(task.tags).toContain('existence-probe')
    }).toPass({ timeout: 12_000 })
  })

  test('R10 - a task created offline drains after reconnect, reaches another client, and survives reload', async ({ clientA, clientB }) => {
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)
    await clientA.context().setOffline(true)

    const createdId = await clientA.evaluate(async (task) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const created = await tasks.createTask({
        id: task.id,
        title: task.title,
        description: 'Created while the browser context was offline',
        status: 'planned',
        priority: 'medium',
        tags: ['offline-reconnect-probe'],
        isInInbox: true,
      })
      return created.id
    }, OFFLINE_TASK)
    expect(createdId).toBe(OFFLINE_TASK.id)

    const localWhileOffline = await clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId) ?? null
    }, OFFLINE_TASK.id)
    expect(localWhileOffline).toEqual(expect.objectContaining({
      id: OFFLINE_TASK.id,
      title: OFFLINE_TASK.title,
    }))

    await clientA.context().setOffline(false)

    await expect(async () => {
      const { data, error } = await admin
        .from('tasks')
        .select('id,title,description,status,priority,tags,is_deleted')
        .eq('id', OFFLINE_TASK.id)
        .single()
      expect(error).toBeNull()
      expect(data).toEqual(expect.objectContaining({
        id: OFFLINE_TASK.id,
        title: OFFLINE_TASK.title,
        description: 'Created while the browser context was offline',
        status: 'planned',
        priority: 'medium',
        is_deleted: false,
      }))
      expect(data?.tags).toContain('offline-reconnect-probe')
    }).toPass({ timeout: 20_000 })

    await expect(async () => {
      const task = await clientB.evaluate((taskId) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        return tasks.rawTasks.find((candidate: any) => candidate.id === taskId) ?? null
      }, OFFLINE_TASK.id)
      expect(task).toEqual(expect.objectContaining({
        id: OFFLINE_TASK.id,
        title: OFFLINE_TASK.title,
      }))
      expect(task.tags).toContain('offline-reconnect-probe')
    }).toPass({ timeout: 20_000 })

    await clientA.reload()
    await gotoCanvasReady(clientA)
    const taskAfterReload = await clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId) ?? null
    }, OFFLINE_TASK.id)
    expect(taskAfterReload).toEqual(expect.objectContaining({
      id: OFFLINE_TASK.id,
      title: OFFLINE_TASK.title,
    }))
  })

  test('R16 - workspace switching never hides, leaks, or loses newly created tasks', async ({ clientA, clientB }) => {
    const workspaceId = randomUUID()
    const personalTitle = `Personal existence ${randomUUID()}`
    const workspaceTitle = `Workspace existence ${randomUUID()}`
    const clientLogs: string[] = []
    clientA.on('console', message => {
      const text = message.text()
      if (/SYNC|WORKSPACE|Task could not be saved|Failed to queue/i.test(text)) {
        clientLogs.push(`${message.type()}: ${text}`)
      }
    })

    try {
      const { error: workspaceError } = await admin.from('workspaces').insert({
        id: workspaceId,
        name: 'Existence Boundary Workspace',
        owner_id: userId,
        color: '#4ECDC4',
      })
      expect(workspaceError).toBeNull()
      const { error: membershipError } = await admin.from('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: 'owner',
      })
      expect(membershipError).toBeNull()

      await gotoCatalogReady(clientA)
      await clientA.evaluate(async () => {
        const root = document.querySelector('#app') as any
        const pinia = root.__vue_app__._context.config.globalProperties.$pinia
        const workspace = pinia._s.get('workspace')!
        await workspace.loadWorkspaces()
        await workspace.switchWorkspace(null)
      })

      const quickCreate = clientA.getByPlaceholder(/Quick add task/i)
      await quickCreate.fill(personalTitle)
      await quickCreate.press('Enter')
      await expect(clientA.getByText(personalTitle, { exact: true })).toBeVisible()

      const switcher = clientA.locator('.workspace-switcher .switcher-trigger')
      await switcher.click()
      await clientA.locator('.workspace-menu .workspace-option')
        .filter({ hasText: 'Existence Boundary Workspace' })
        .click()

      await expect.poll(async () => clientA.evaluate(() => {
        const root = document.querySelector('#app') as any
        const workspace = root.__vue_app__._context.config.globalProperties.$pinia._s.get('workspace')!
        return workspace.activeWorkspaceId
      })).toBe(workspaceId)
      await expect(clientA.getByText(personalTitle, { exact: true })).toHaveCount(0)

      await quickCreate.fill(workspaceTitle)
      await quickCreate.press('Enter')
      await expect(clientA.getByText(workspaceTitle, { exact: true })).toBeVisible()

      try {
        await expect(async () => {
          const { data, error } = await admin
            .from('tasks')
            .select('id,title,workspace_id,is_deleted')
            .eq('user_id', userId)
            .in('title', [personalTitle, workspaceTitle])
          expect(error).toBeNull()
          expect(data).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: personalTitle, workspace_id: null, is_deleted: false }),
            expect.objectContaining({ title: workspaceTitle, workspace_id: workspaceId, is_deleted: false }),
          ]))
        }).toPass({ timeout: 20_000 })
      } catch (error) {
        const syncDiagnostics = await clientA.evaluate(async () => {
          const [{ useSyncOrchestrator }, { useWorkspaceStore }, { getFailedOperations }] = await Promise.all([
            import('/src/composables/sync/useSyncOrchestrator.ts'),
            import('/src/stores/workspace.ts'),
            import('/src/services/offline/writeQueueDB.ts'),
          ])
          const sync = useSyncOrchestrator()
          const workspace = useWorkspaceStore()
          return {
            activeWorkspaceId: workspace.activeWorkspaceId,
            isSwitchingWorkspace: workspace.isSwitchingWorkspace,
            status: sync.status.value,
            isOnline: sync.isOnline.value,
            lastError: sync.lastError.value,
            queue: await sync.getQueueStats(),
            failedOperations: (await getFailedOperations()).map(operation => ({
              entityId: operation.entityId,
              operation: operation.operation,
              workspaceId: operation.workspaceId,
              retryCount: operation.retryCount,
              error: operation.error,
            })),
          }
        })
        console.log(`R16 sync diagnostics:\n${JSON.stringify(syncDiagnostics, null, 2)}\n${clientLogs.join('\n')}`)
        throw error
      }

      await switcher.click()
      await clientA.locator('.workspace-menu .workspace-option').filter({ hasText: /Personal/i }).click()
      await expect(clientA.getByText(personalTitle, { exact: true })).toBeVisible()
      await expect(clientA.getByText(workspaceTitle, { exact: true })).toHaveCount(0)

      await clientA.reload()
      await gotoCatalogReady(clientA)
      await expect(clientA.getByText(personalTitle, { exact: true })).toBeVisible()

      await gotoCatalogReady(clientB)
      await clientB.evaluate(async () => {
        const root = document.querySelector('#app') as any
        const pinia = root.__vue_app__._context.config.globalProperties.$pinia
        const workspace = pinia._s.get('workspace')!
        await workspace.loadWorkspaces()
        await workspace.switchWorkspace(null)
      })
      await expect(clientB.getByText(personalTitle, { exact: true })).toBeVisible()
      await clientB.evaluate(async (id) => {
        const root = document.querySelector('#app') as any
        const workspace = root.__vue_app__._context.config.globalProperties.$pinia._s.get('workspace')!
        await workspace.switchWorkspace(id)
      }, workspaceId)
      await expect(clientB.getByText(workspaceTitle, { exact: true })).toBeVisible()
      await expect(clientB.getByText(personalTitle, { exact: true })).toHaveCount(0)
    } finally {
      await admin.from('tasks').delete().eq('user_id', userId).in('title', [personalTitle, workspaceTitle])
      await admin.from('workspace_members').delete().eq('workspace_id', workspaceId)
      await admin.from('workspaces').delete().eq('id', workspaceId)
    }
  })

  test('R13 - Quick Create works offline, drains after reconnect, reaches another client, and survives reload', async ({ clientA, clientB }) => {
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)

    const quickCreate = clientA.getByPlaceholder(/Quick add task/i)
    await expect(quickCreate).toBeVisible()
    await clientA.context().setOffline(true)
    await quickCreate.fill(OFFLINE_QUICK_CREATE_TITLE)
    await quickCreate.press('Enter')

    await expect.poll(async () => clientA.evaluate((title) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.title === title)?.id ?? null
    }, OFFLINE_QUICK_CREATE_TITLE), { timeout: 10_000 }).not.toBeNull()

    await clientA.context().setOffline(false)

    let persistedId = ''
    await expect(async () => {
      const { data, error } = await admin
        .from('tasks')
        .select('id,title,is_deleted')
        .eq('user_id', userId)
        .eq('title', OFFLINE_QUICK_CREATE_TITLE)
        .single()
      expect(error).toBeNull()
      expect(data).toEqual(expect.objectContaining({
        title: OFFLINE_QUICK_CREATE_TITLE,
        is_deleted: false,
      }))
      persistedId = data?.id ?? ''
      expect(persistedId).not.toBe('')
    }).toPass({ timeout: 20_000 })

    await expect(async () => {
      const task = await clientB.evaluate((title) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        return tasks.rawTasks.find((candidate: any) => candidate.title === title) ?? null
      }, OFFLINE_QUICK_CREATE_TITLE)
      expect(task).toEqual(expect.objectContaining({
        id: persistedId,
        title: OFFLINE_QUICK_CREATE_TITLE,
      }))
    }).toPass({ timeout: 20_000 })

    await clientA.reload()
    await gotoCanvasReady(clientA)
    await expect.poll(async () => clientA.evaluate((title) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.title === title)?.id ?? null
    }, OFFLINE_QUICK_CREATE_TITLE)).toBe(persistedId)
  })

  test('R14 - Catalog right-click completion works offline, drains after reconnect, reaches another client, and survives reload', async ({ clientA, clientB }) => {
    await gotoCatalogReady(clientA)
    await gotoCanvasReady(clientB)

    const task = ROOT_TASKS[0]
    const taskRow = clientA.locator('.hierarchical-task-row').filter({ hasText: task.title }).first()
    await expect(taskRow).toBeVisible()
    await clientA.context().setOffline(true)
    await taskRow.click({ button: 'right' })
    await clientA.getByText('Mark as Done', { exact: true }).click()

    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.status ?? null
    }, task.id)).toBe('done')
    await expect(taskRow).toBeHidden()

    await clientA.context().setOffline(false)

    await expect(async () => {
      const { data, error } = await admin
        .from('tasks')
        .select('id,status,is_deleted')
        .eq('id', task.id)
        .single()
      expect(error).toBeNull()
      expect(data).toEqual(expect.objectContaining({
        id: task.id,
        status: 'done',
        is_deleted: false,
      }))
    }).toPass({ timeout: 20_000 })

    await expect.poll(async () => clientB.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.status ?? null
    }, task.id), { timeout: 20_000 }).toBe('done')

    await clientA.reload()
    await clientA.waitForSelector('.all-tasks-view', { timeout: 30_000 })
    await clientA.getByText('All Active', { exact: true }).click()
    await expect(clientA.locator('.hierarchical-task-row').filter({ hasText: task.title })).toHaveCount(0)
    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.status ?? null
    }, task.id)).toBe('done')
  })

  test('R15 - Canvas next-occurrence completion works offline, commits once, converges, and survives reload', async ({ clientA, clientB }) => {
    const clientAErrors: string[] = []
    const clientBLogs: string[] = []
    clientA.on('console', message => {
      if (message.type() === 'error' || message.text().includes('[DONE-FOR-NOW]')) {
        clientAErrors.push(message.text())
      }
    })
    clientB.on('console', message => {
      const text = message.text()
      if (text.includes('[REALTIME]') || text.includes('[HANDLER]') || text.includes('[SYNC]')) {
        clientBLogs.push(text)
      }
    })
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)

    const initialDueDate = await clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.dueDate ?? null
    }, OFFLINE_RECURRING_TASK.id)
    expect(initialDueDate).toBeTruthy()

    const recurringNode = clientA.locator(
      `.task-node[data-task-id="${OFFLINE_RECURRING_TASK.id}"]`,
    )
    await expect(recurringNode).toBeVisible()
    await clientA.context().setOffline(true)
    await clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = tasks.rawTasks.find((candidate: any) => candidate.id === taskId)
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        button: 2,
        clientX: 400,
        clientY: 300,
      })
      window.dispatchEvent(new CustomEvent('task-context-menu', {
        detail: { event, taskId, task, context: 'canvas' },
      }))
    }, OFFLINE_RECURRING_TASK.id)
    await clientA.getByText('More', { exact: true }).click()
    await clientA.getByText('Done for now', { exact: true }).click()
    await clientA.getByText('Next occurrence', { exact: true }).click()

    await expect(clientA.getByText('Failed to complete task', { exact: true })).toHaveCount(0)
    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = tasks.rawTasks.find((candidate: any) => candidate.id === taskId)
      return {
        dueDate: task?.dueDate ?? null,
        recurrenceCount: task?.recurrenceCount ?? null,
        status: task?.status ?? null,
      }
    }, OFFLINE_RECURRING_TASK.id)).toEqual({
      dueDate: expect.not.stringMatching(initialDueDate),
      recurrenceCount: 1,
      status: 'todo',
    })

    await clientA.context().setOffline(false)

    try {
      await expect(async () => {
        const { data: livingTask, error: livingError } = await admin
          .from('tasks')
          .select('id,due_date,status,recurrence_count,is_completion_record,is_deleted')
          .eq('id', OFFLINE_RECURRING_TASK.id)
          .single()
        expect(livingError).toBeNull()
        expect(livingTask).toEqual(expect.objectContaining({
          id: OFFLINE_RECURRING_TASK.id,
          status: 'planned',
          recurrence_count: 1,
          is_completion_record: false,
          is_deleted: false,
        }))
        expect(String(livingTask?.due_date).slice(0, 10)).not.toBe(initialDueDate)

        const { data: completions, error: completionsError } = await admin
          .from('tasks')
          .select('id,status,is_completion_record,recurrence_parent_id')
          .eq('recurrence_parent_id', OFFLINE_RECURRING_TASK.id)
          .eq('is_completion_record', true)
        expect(completionsError).toBeNull()
        expect(completions).toHaveLength(1)
        expect(completions?.[0]).toEqual(expect.objectContaining({
          status: 'done',
          is_completion_record: true,
          recurrence_parent_id: OFFLINE_RECURRING_TASK.id,
        }))
      }).toPass({ timeout: 20_000 })
    } catch (error) {
      const queuedOperations = await clientA.evaluate(async (taskId) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('FlowStateSyncQueue')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        const operations = await new Promise<any[]>((resolve, reject) => {
          const request = database.transaction('operations', 'readonly').objectStore('operations').getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        database.close()
        return operations.filter(operation => operation.entityId === taskId)
      }, OFFLINE_RECURRING_TASK.id)
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nQueued operations: ${JSON.stringify(queuedOperations)}\nClient errors: ${JSON.stringify(clientAErrors)}`)
    }

    try {
      await expect.poll(async () => clientB.evaluate((taskId) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        const task = tasks.rawTasks.find((candidate: any) => candidate.id === taskId)
        return {
          dueDate: task?.dueDate ?? null,
          recurrenceCount: task?.recurrenceCount ?? null,
          status: task?.status ?? null,
        }
      }, OFFLINE_RECURRING_TASK.id), { timeout: 20_000 }).toEqual({
        dueDate: expect.not.stringMatching(initialDueDate),
        recurrenceCount: 1,
        status: 'todo',
      })
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nClient B sync logs: ${JSON.stringify(clientBLogs)}`)
    }

    await clientA.reload()
    await gotoCanvasReady(clientA)
    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = tasks.rawTasks.find((candidate: any) => candidate.id === taskId)
      return {
        dueDate: task?.dueDate ?? null,
        recurrenceCount: task?.recurrenceCount ?? null,
        status: task?.status ?? null,
      }
    }, OFFLINE_RECURRING_TASK.id)).toEqual({
      dueDate: expect.not.stringMatching(initialDueDate),
      recurrenceCount: 1,
      status: 'todo',
    })
  })

  test('R17 - Board right-click completion works offline, converges, and survives reload', async ({ clientA, clientB }) => {
    await gotoBoardReady(clientA)
    await gotoBoardReady(clientB)

    const task = ROOT_TASKS[1]
    const taskCard = clientA.locator(`.task-card[data-task-id="${task.id}"]`)
    await expect(taskCard).toBeVisible()

    await clientA.context().setOffline(true)
    await taskCard.click({ button: 'right' })
    await clientA.getByText('Mark as Done', { exact: true }).click()

    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.status ?? null
    }, task.id)).toBe('done')

    await clientA.context().setOffline(false)
    await expect(async () => {
      const { data, error } = await admin
        .from('tasks')
        .select('id,status,is_deleted')
        .eq('id', task.id)
        .single()
      expect(error).toBeNull()
      expect(data).toEqual(expect.objectContaining({
        id: task.id,
        status: 'done',
        is_deleted: false,
      }))
    }).toPass({ timeout: 20_000 })

    await expect.poll(async () => clientB.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.status ?? null
    }, task.id), { timeout: 20_000 }).toBe('done')

    await clientA.reload()
    await gotoBoardReady(clientA)
    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.status ?? null
    }, task.id)).toBe('done')
  })

  test('R18 - Board recurring next-occurrence completion works offline exactly once', async ({ clientA, clientB }) => {
    await gotoBoardReady(clientA)
    await gotoBoardReady(clientB)

    const initialDueDate = await clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.dueDate ?? null
    }, OFFLINE_RECURRING_TASK.id)
    expect(initialDueDate).toBeTruthy()

    const recurringCard = clientA.locator(`.task-card[data-task-id="${OFFLINE_RECURRING_TASK.id}"]`)
    await expect(recurringCard).toBeVisible()
    await clientA.context().setOffline(true)
    await recurringCard.click({ button: 'right' })
    await clientA.getByText('More', { exact: true }).click()
    await clientA.getByText('Done for now', { exact: true }).click()
    await clientA.getByText('Next occurrence', { exact: true }).click()

    await expect(clientA.getByText('Failed to complete task', { exact: true })).toHaveCount(0)
    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = tasks.rawTasks.find((candidate: any) => candidate.id === taskId)
      return {
        dueDate: task?.dueDate ?? null,
        recurrenceCount: task?.recurrenceCount ?? null,
        status: task?.status ?? null,
      }
    }, OFFLINE_RECURRING_TASK.id)).toEqual({
      dueDate: expect.not.stringMatching(initialDueDate),
      recurrenceCount: 1,
      status: 'todo',
    })

    await clientA.context().setOffline(false)
    await expect(async () => {
      const { data: livingTask, error: livingError } = await admin
        .from('tasks')
        .select('id,due_date,status,recurrence_count,is_completion_record,is_deleted')
        .eq('id', OFFLINE_RECURRING_TASK.id)
        .single()
      expect(livingError).toBeNull()
      expect(livingTask).toEqual(expect.objectContaining({
        id: OFFLINE_RECURRING_TASK.id,
        status: 'planned',
        recurrence_count: 1,
        is_completion_record: false,
        is_deleted: false,
      }))
      expect(String(livingTask?.due_date).slice(0, 10)).not.toBe(initialDueDate)

      const { data: completions, error: completionsError } = await admin
        .from('tasks')
        .select('id')
        .eq('recurrence_parent_id', OFFLINE_RECURRING_TASK.id)
        .eq('is_completion_record', true)
      expect(completionsError).toBeNull()
      expect(completions).toHaveLength(1)
    }).toPass({ timeout: 20_000 })

    await expect.poll(async () => clientB.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = tasks.rawTasks.find((candidate: any) => candidate.id === taskId)
      return {
        dueDate: task?.dueDate ?? null,
        recurrenceCount: task?.recurrenceCount ?? null,
        status: task?.status ?? null,
      }
    }, OFFLINE_RECURRING_TASK.id), { timeout: 20_000 }).toEqual({
      dueDate: expect.not.stringMatching(initialDueDate),
      recurrenceCount: 1,
      status: 'todo',
    })

    await clientA.reload()
    await gotoBoardReady(clientA)
    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = tasks.rawTasks.find((candidate: any) => candidate.id === taskId)
      return {
        dueDate: task?.dueDate ?? null,
        recurrenceCount: task?.recurrenceCount ?? null,
      }
    }, OFFLINE_RECURRING_TASK.id)).toEqual({
      dueDate: expect.not.stringMatching(initialDueDate),
      recurrenceCount: 1,
    })
  })

  test('R19 - Board right-click edit works offline, converges, and survives reload', async ({ clientA, clientB }) => {
    await gotoBoardReady(clientA)
    await gotoBoardReady(clientB)

    const task = ROOT_TASKS[2]
    const editedTitle = `${task.title} Board Offline Edit`
    const taskCard = clientA.locator(`.task-card[data-task-id="${task.id}"]`)
    await expect(taskCard).toBeVisible()

    await clientA.context().setOffline(true)
    await taskCard.click({ button: 'right' })
    await clientA.getByText('Edit', { exact: true }).click()

    const editModal = clientA.locator('.modal-content').filter({ hasText: 'Edit Task' })
    await expect(editModal).toBeVisible()
    await editModal.locator('input[placeholder="Task title"]').fill(editedTitle)
    await editModal.getByText('Save Changes', { exact: true }).click()

    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.title ?? null
    }, task.id)).toBe(editedTitle)

    await clientA.context().setOffline(false)
    await expect(async () => {
      const { data, error } = await admin
        .from('tasks')
        .select('id,title,is_deleted')
        .eq('id', task.id)
        .single()
      expect(error).toBeNull()
      expect(data).toEqual(expect.objectContaining({
        id: task.id,
        title: editedTitle,
        is_deleted: false,
      }))
    }).toPass({ timeout: 20_000 })

    await expect.poll(async () => clientB.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.title ?? null
    }, task.id), { timeout: 20_000 }).toBe(editedTitle)

    await clientA.reload()
    await gotoBoardReady(clientA)
    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.find((candidate: any) => candidate.id === taskId)?.title ?? null
    }, task.id)).toBe(editedTitle)
  })

  test('R20 - Board right-click delete works offline and cannot resurrect', async ({ clientA, clientB }) => {
    await gotoBoardReady(clientA)
    await gotoBoardReady(clientB)

    const task = ROOT_TASKS[0]
    const taskCard = clientA.locator(`.task-card[data-task-id="${task.id}"]`)
    await expect(taskCard).toBeVisible()

    await clientA.context().setOffline(true)
    await taskCard.click({ button: 'right' })
    await clientA.getByText('Delete', { exact: true }).click()
    const confirmation = clientA.getByRole('dialog')
    await expect(confirmation).toBeVisible()
    await confirmation.getByText('Delete', { exact: true }).click()

    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.some((candidate: any) => candidate.id === taskId && !candidate.isDeleted)
    }, task.id)).toBe(false)

    await clientA.context().setOffline(false)
    await expect(async () => {
      const { data, error } = await admin
        .from('tasks')
        .select('id,is_deleted')
        .eq('id', task.id)
        .single()
      expect(error).toBeNull()
      expect(data).toEqual(expect.objectContaining({
        id: task.id,
        is_deleted: true,
      }))
    }).toPass({ timeout: 20_000 })

    await expect.poll(async () => clientB.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.some((candidate: any) => candidate.id === taskId && !candidate.isDeleted)
    }, task.id), { timeout: 20_000 }).toBe(false)

    await clientA.reload()
    await gotoBoardReady(clientA)
    await expect.poll(async () => clientA.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.rawTasks.some((candidate: any) => candidate.id === taskId && !candidate.isDeleted)
    }, task.id)).toBe(false)
  })

  test('R11 - offline edit and completion drain after reconnect and survive reload', async ({ clientA, clientB }) => {
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)
    const taskId = ROOT_TASKS[1].id
    const updatedTitle = 'Offline Edit and Completion Probe'
    await clientA.context().setOffline(true)

    await clientA.evaluate(async ({ taskId, updatedTitle }) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      await tasks.updateTask(taskId, {
        title: updatedTitle,
        status: 'done',
        tags: ['offline-completion-probe'],
      }, 'USER')
    }, { taskId, updatedTitle })

    const localWhileOffline = await clientA.evaluate((id) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = tasks.rawTasks.find((candidate: any) => candidate.id === id)
      return { title: task?.title, status: task?.status, tags: task?.tags }
    }, taskId)
    expect(localWhileOffline).toEqual({
      title: updatedTitle,
      status: 'done',
      tags: ['offline-completion-probe'],
    })

    await clientA.context().setOffline(false)

    await expect(async () => {
      const { data, error } = await admin
        .from('tasks')
        .select('title,status,tags,is_deleted')
        .eq('id', taskId)
        .single()
      expect(error).toBeNull()
      expect(data).toEqual(expect.objectContaining({
        title: updatedTitle,
        status: 'done',
        is_deleted: false,
      }))
      expect(data?.tags).toContain('offline-completion-probe')
    }).toPass({ timeout: 20_000 })

    await expect(async () => {
      const state = await clientB.evaluate((id) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        const task = tasks.rawTasks.find((candidate: any) => candidate.id === id)
        return { title: task?.title, status: task?.status, tags: task?.tags }
      }, taskId)
      expect(state).toEqual({
        title: updatedTitle,
        status: 'done',
        tags: expect.arrayContaining(['offline-completion-probe']),
      })
    }).toPass({ timeout: 20_000 })

    await clientA.reload()
    await gotoCanvasReady(clientA)
    const afterReload = await clientA.evaluate((id) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const task = tasks.rawTasks.find((candidate: any) => candidate.id === id)
      return { title: task?.title, status: task?.status, tags: task?.tags }
    }, taskId)
    expect(afterReload).toEqual({
      title: updatedTitle,
      status: 'done',
      tags: expect.arrayContaining(['offline-completion-probe']),
    })
  })

  test('R12 - offline delete drains after reconnect and remains absent after reload', async ({ clientA, clientB }) => {
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)
    const taskId = ROOT_TASKS[2].id
    await clientA.context().setOffline(true)

    await clientA.evaluate(async (id) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      await tasks.deleteTask(id)
    }, taskId)
    const localVisibleOffline = await clientA.evaluate((id) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.tasks.some((candidate: any) => candidate.id === id)
    }, taskId)
    expect(localVisibleOffline).toBe(false)

    await clientA.context().setOffline(false)

    await expect(async () => {
      const { data, error } = await admin
        .from('tasks')
        .select('is_deleted,deleted_at')
        .eq('id', taskId)
        .single()
      expect(error).toBeNull()
      expect(data?.is_deleted).toBe(true)
      expect(data?.deleted_at).toBeTruthy()
    }).toPass({ timeout: 20_000 })

    await expect(async () => {
      const visible = await clientB.evaluate((id) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        return tasks.tasks.some((candidate: any) => candidate.id === id)
      }, taskId)
      expect(visible).toBe(false)
    }).toPass({ timeout: 20_000 })

    await clientA.reload()
    await gotoCanvasReady(clientA)
    const visibleAfterReload = await clientA.evaluate((id) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.tasks.some((candidate: any) => candidate.id === id)
    }, taskId)
    expect(visibleAfterReload).toBe(false)
  })

  // ── R5: moving a node on A propagates LIVE to independent client B ──────────
  test('R5 - moving a task on client A live-updates its position on client B', async ({ clientA, clientB }) => {
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)
    await waitForCanvasNodes(clientB, ROOT_TASKS.length)

    const target = { x: 2850, y: 2850 }
    // Real drag-equivalent: persist a new canvasPosition from A (source 'DRAG').
    await clientA.evaluate(({ pos, taskId }) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.updateTask(taskId, {
        canvasPosition: { x: pos.x, y: pos.y }, positionFormat: 'absolute',
      }, 'DRAG')
    }, { pos: target, taskId: ROOT_TASKS[0].id })

    // (1) B's STORE must receive the new position (realtime → updateTaskFromSync).
    await expect(async () => {
      const storePos = await clientB.evaluate((taskId) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        const t = tasks.rawTasks.find((x: any) => x.id === taskId)
        return t?.canvasPosition ?? null
      }, ROOT_TASKS[0].id)
      expect(storePos, 'B store never got the new position').toBeTruthy()
      expect(Math.abs(storePos.x - target.x)).toBeLessThan(2)
      expect(Math.abs(storePos.y - target.y)).toBeLessThan(2)
    }).toPass({ timeout: 12_000 })

    // (2) B's rendered NODE must actually move (no reload) — the live-canvas part.
    await expect(async () => {
      const positions = await readCanvasNodePositions(clientB)
      const node = positions[ROOT_TASKS[0].id]
      expect(node, `B node ${ROOT_TASKS[0].id} not rendered`).toBeTruthy()
      expect(Math.abs(node.x - target.x)).toBeLessThan(2)
      expect(Math.abs(node.y - target.y)).toBeLessThan(2)
    }).toPass({ timeout: 12_000 })
  })

  // ── R8: updates blocked by a local interaction replay after the guard clears ─
  test('R8 - client B replays latest remote geometry after its interaction guard clears', async ({ clientA, clientB }) => {
    await gotoCanvasReady(clientA)
    await gotoCanvasReady(clientB)
    await waitForCanvasNodes(clientB, ROOT_TASKS.length)

    const target = { x: 3250, y: 3250 }
    const lockAccepted = await clientB.evaluate(async () => {
      const { useCanvasOperationState } = await import('/src/composables/canvas/useCanvasOperationState.ts')
      return useCanvasOperationState().startDrag(['deterministic-remote-projection-lock'])
    })
    expect(lockAccepted).toBe(true)

    await clientA.evaluate(({ pos, taskId }) => {
      const root = document.querySelector('#app') as any
      const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return tasks.updateTask(taskId, {
        canvasPosition: { x: pos.x, y: pos.y }, positionFormat: 'absolute',
      }, 'DRAG')
    }, { pos: target, taskId: ROOT_TASKS[0].id })

    await expect(async () => {
      const storePos = await clientB.evaluate((taskId) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        return tasks.rawTasks.find((task: any) => task.id === taskId)?.canvasPosition ?? null
      }, ROOT_TASKS[0].id)
      expect(storePos).toEqual(target)
    }).toPass({ timeout: 12_000 })

    const blockedNode = (await readCanvasNodePositions(clientB))[ROOT_TASKS[0].id]
    expect(blockedNode).toBeTruthy()
    expect(Math.abs(blockedNode.x - target.x)).toBeGreaterThan(100)

    await clientB.evaluate(async () => {
      const { useCanvasOperationState } = await import('/src/composables/canvas/useCanvasOperationState.ts')
      useCanvasOperationState().resetToIdle()
    })

    await expect(async () => {
      const node = (await readCanvasNodePositions(clientB))[ROOT_TASKS[0].id]
      expect(node).toBeTruthy()
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
