/**
 * BUG-1935: Dragging a card between Board due-date columns must register.
 *
 * Two faults stacked on this gesture:
 *  1. Grouping keyed on calendar instances, so a drop that wrote only `dueDate` re-bucketed
 *     the card straight back to its origin column.
 *  2. `transform: ... !important` on `.task-card.sortable-fallback` outranked the inline
 *     transform SortableJS writes each frame, so the drag clone never left its origin.
 *
 * These need a real pointer: SortableJS runs in `forceFallback` mode, which emulates dragover
 * from raw mouse coordinates. `locator.dragTo()` fires HTML5 drag events and would miss both.
 */
import { createClient } from '@supabase/supabase-js'
import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'
import type { Page } from '@playwright/test'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const TASK_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-bbbbbbbb1935'
const TASK_TITLE = 'BUG-1935 stale-instance card'

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const dateKey = (offsetDays: number): string => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The seeded test user owns the fixture tasks; borrow its id rather than parsing localStorage. */
async function testUserId(): Promise<string> {
  const { data, error } = await admin()
    .from('tasks')
    .select('user_id')
    .eq('id', TEST_TASKS.designLandingPage.id)
    .single()
  if (error) throw new Error(`could not resolve test user: ${error.message}`)
  return data.user_id as string
}

/** The exact shape from the user's board: deadline in the past AND a stale calendar slot. */
async function seedStaleInstanceTask(userId: string) {
  const supabase = admin()
  await supabase.from('tasks').delete().eq('id', TASK_ID)
  const { error } = await supabase.from('tasks').insert({
    id: TASK_ID,
    user_id: userId,
    title: TASK_TITLE,
    status: 'planned',
    due_date: dateKey(-4),
    is_in_inbox: false,
    is_deleted: false,
    instances: [{ id: 'inst-1935', scheduledDate: dateKey(-4), scheduledTime: '18:30', duration: 60 }],
  })
  if (error) throw new Error(`seed failed: ${error.message}`)
}

/** Locate a due-date column by its header text. */
const column = (page: Page, title: string) =>
  page.locator('.kanban-column').filter({ has: page.locator('.column-title', { hasText: title }) })

/**
 * Press, move in steps (SortableJS needs several mousemove events to start and track a
 * fallback drag), then release. Returns the clone's translation while mid-drag.
 */
async function dragCardTo(page: Page, card: ReturnType<Page['locator']>, target: ReturnType<Page['locator']>) {
  const from = await card.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('missing bounding box')

  await page.mouse.move(from.x + from.width / 2, from.y + 20)
  await page.mouse.down()

  // First small move crosses fallbackTolerance and spawns the clone.
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + 28, { steps: 4 })

  const midX = to.x + to.width / 2
  const midY = to.y + 120
  await page.mouse.move(midX, midY, { steps: 12 })

  // Sample the clone BEFORE releasing — this is the half a unit test cannot see.
  const cloneTransform = await page.evaluate(() => {
    const clone = document.querySelector('.sortable-fallback')
    return clone ? getComputedStyle(clone).transform : null
  })

  await page.mouse.move(midX, midY + 4, { steps: 3 })
  await page.mouse.up()

  return cloneTransform
}

test.describe('BUG-1935: Board due-date column drags', () => {
  test.skip(!SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY required')

  test.beforeEach(async ({ page }) => {
    // Board remembers its grouping in localStorage; force the Due Date view.
    // VueUse's useStorage writes plain strings unquoted — NOT JSON.
    await page.addInitScript(() => {
      window.localStorage.setItem('flowstate:board-view-type', 'date')
    })
  })

  test.afterAll(async () => {
    if (SERVICE_ROLE_KEY) await admin().from('tasks').delete().eq('id', TASK_ID)
  })

  test('a card with a stale instance moves from Overdue to Today and stays there', async ({ page }) => {
    await seedStaleInstanceTask(await testUserId())
    await page.goto('/#/board')

    const card = page.locator(`[data-task-id="${TASK_ID}"]`)
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(column(page, 'Overdue').locator(`[data-task-id="${TASK_ID}"]`)).toBeVisible()

    const cloneTransform = await dragCardTo(page, card, column(page, 'Today'))

    // The clone must actually translate. Before the fix it was pinned to a bare
    // scale/rotate matrix (no translation components) for the entire drag.
    expect(cloneTransform, 'drag clone should exist while dragging').toBeTruthy()
    const [, , , , tx, ty] = cloneTransform!.replace(/matrix\(|\)/g, '').split(',').map(Number)
    expect(Math.abs(tx) + Math.abs(ty), 'clone must follow the cursor').toBeGreaterThan(20)

    // The drop must register in the UI...
    await expect(column(page, 'Today').locator(`[data-task-id="${TASK_ID}"]`)).toBeVisible({ timeout: 5_000 })
    await expect(column(page, 'Overdue').locator(`[data-task-id="${TASK_ID}"]`)).toHaveCount(0)

    // ...and survive a reload, which means it reached the database.
    await page.reload()
    await expect(column(page, 'Today').locator(`[data-task-id="${TASK_ID}"]`)).toBeVisible({ timeout: 15_000 })

    // ...and reach the database. The write is queued, so poll rather than assume it landed.
    await expect.poll(async () => {
      const { data } = await admin().from('tasks').select('due_date').eq('id', TASK_ID).single()
      return String(data?.due_date ?? '')
    }, { timeout: 15_000 }).toContain(dateKey(0))

    // The stale calendar slot was rebased onto today, keeping its time of day.
    const { data } = await admin().from('tasks').select('instances').eq('id', TASK_ID).single()
    expect(data!.instances[0]).toMatchObject({ scheduledDate: dateKey(0), scheduledTime: '18:30' })
  })
})
