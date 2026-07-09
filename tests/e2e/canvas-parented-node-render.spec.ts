/**
 * BUG-1796 regression (end-to-end): the Canvas must render a task placed INSIDE a group.
 *
 * Root cause was a missing `toRelativePosition` import in useCanvasSync.ts: it threw a
 * ReferenceError the moment sync processed a node with a visible parent, aborting the whole
 * sync before setNodes() → completely empty canvas. This only triggers for a *parented* node.
 *
 * Unlike the in-memory seeding in canvas-geometry-local.spec.ts (which the DB realtime reload
 * wipes, clearing the child's parentId before the buggy line runs), this test seeds the group
 * and child task DIRECTLY IN THE DB so they survive sync and genuinely exercise the parented
 * render path. Fails on the pre-fix code (zero nodes), passes after.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { test, expect } from '../fixtures/auth'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const GROUP_ID = 'canvas-regression-group'
const TASK_ID = 'canvas-regression-task'

// Group large enough that the task center (220x100 default → +110,+50) sits well inside,
// so the spatial-containment guard keeps the parentId instead of reparenting to root.
// Placed far from the global-setup groups (which live at x=100/500) to avoid overlap so
// spatial auto-assignment doesn't steal the child into a different group.
const GROUP = { x: 3000, y: 3000, width: 800, height: 600 }
const TASK = { x: 3100, y: 3100 } // center (3210, 3150) ∈ [3000,3800]×[3000,3600]

let admin: SupabaseClient
let userId: string

test.describe('canvas renders a task placed inside a group (BUG-1796)', () => {
  test.skip(!SERVICE_ROLE_KEY, 'requires SUPABASE_SERVICE_ROLE_KEY (set by scripts/run-e2e.sh)')

  test.beforeAll(async () => {
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
      const res = await admin.auth.admin.createUser({ email: 'playwright@test.flowstate', password: 'pw-playwright-e2e-2026!', email_confirm: true })
      if (res.error) console.error('createUser error:', res.error.message)
      user = res.data?.user
      if (!user) {
        // Fallback: it might have been created by another test worker but listUsers was stale/paginated.
        // Let's just sign in to get the user object!
        const loginRes = await admin.auth.signInWithPassword({ email: 'playwright@test.flowstate', password: 'pw-playwright-e2e-2026!' })
        user = loginRes.data?.user
      }
      if (!user) throw new Error('Failed to create or find test user (rate limited or stale listUsers)')
    }
    userId = user.id

    // Clean any prior run + tombstones that would make sync skip our CREATE.
    await admin.from('tasks').delete().eq('id', TASK_ID)
    await admin.from('groups').delete().eq('id', GROUP_ID)
    await admin.from('tombstones').delete().in('entity_id', [TASK_ID, GROUP_ID])

    await admin.from('groups').insert({
      id: GROUP_ID,
      user_id: userId,
      name: 'Regression Group',
      type: 'custom',
      color: '#4ECDC4',
      position_json: { x: GROUP.x, y: GROUP.y, width: GROUP.width, height: GROUP.height },
      layout: 'freeform',
    })

    await admin.from('tasks').insert({
      id: TASK_ID,
      user_id: userId,
      title: 'Child of group',
      status: 'planned',
      priority: 'medium',
      is_in_inbox: false,
      // Canvas parent is read from position.parentId (supabaseMappers). Keep the task inside bounds.
      position: { x: TASK.x, y: TASK.y, format: 'absolute', parentId: GROUP_ID },
      position_version: 1,
    })
  })

  test.afterAll(async () => {
    if (!admin) return
    await admin.from('tasks').delete().eq('id', TASK_ID)
    await admin.from('groups').delete().eq('id', GROUP_ID)
    await admin.from('tombstones').delete().in('entity_id', [TASK_ID, GROUP_ID])
  })

  test('the group node and its child task node both render', async ({ page }) => {
    await page.goto('/#/canvas')

    // Wait for the canvas stores to be live.
    await page.waitForFunction(() => {
      const root = document.querySelector('#app') as any
      const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
      return !!pinia?._s.get('tasks') && !!pinia?._s.get('canvas')
    }, { timeout: 30_000 })

    // The group node must render…
    await expect(page.locator(`[data-id="section-${GROUP_ID}"]`)).toHaveCount(1, { timeout: 20_000 })
    // …and so must the child task node — this is the line-457 (toRelativePosition) path.
    await expect(page.locator(`[data-id="${TASK_ID}"]`)).toHaveCount(1, { timeout: 20_000 })

    // Sanity: Vue Flow actually painted nodes (would be 0 if sync threw).
    const nodeCount = await page.locator('.vue-flow__node').count()
    expect(nodeCount).toBeGreaterThanOrEqual(2)

    // The child must still be parented to the group in the store (not reparented to root).
    const childParentId = await page.evaluate((taskId) => {
      const root = document.querySelector('#app') as any
      const taskStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      return taskStore.rawTasks.find((t: any) => t.id === taskId)?.parentId ?? null
    }, TASK_ID)
    expect(childParentId).toBe(GROUP_ID)
  })
})
