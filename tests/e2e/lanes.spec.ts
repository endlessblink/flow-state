/**
 * TASK-1812: Lanes — sprint-style cross-project goals.
 *
 * Verifies the headline behavior: a lane pulls in tasks from DIFFERENT projects.
 * Seeds a lane + assigns one Work task and one Personal task to it, then checks:
 *   - /#/lane/:id lists both tasks (cross-project view)
 *   - AllTasks "group by lane" shows the lane group with both tasks
 *   - Creating a lane via the sidebar works and routes to its view
 */
import { test, expect } from '../fixtures/auth'
import { createClient } from '@supabase/supabase-js'
import { TEST_TASKS } from '../fixtures/test-ids'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const LANE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccc01'
const LANE_NAME = 'v2 Launch'

test.describe('TASK-1812: Lanes — cross-project goals', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })
  })

  test('lane shows tasks from two different projects', async ({ page }) => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    expect(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY must be set — run via: npm run test:e2e').toBeTruthy()
    const admin = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: users } = await admin.auth.admin.listUsers()
    const testUser = users?.users?.find(u => u.email === 'playwright@test.flowstate')
    expect(testUser, 'Test user must exist').toBeTruthy()
    const userId = testUser!.id

    // Seed lane + assign a Work task (01) and a Personal task (05) — different projects
    await admin.from('lanes').upsert({ id: LANE_ID, user_id: userId, name: LANE_NAME, color: '#4ECDC4' })
    await admin.from('tasks').update({ lane_id: LANE_ID }).eq('id', TEST_TASKS.designLandingPage.id)
    await admin.from('tasks').update({ lane_id: LANE_ID }).eq('id', TEST_TASKS.buyGroceries.id)

    // ── Lane view lists both cross-project tasks ───────────────────────────────
    await page.goto(`/#/lane/${LANE_ID}`)
    await expect(page.getByText(LANE_NAME).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(TEST_TASKS.designLandingPage.title)).toBeVisible()
    await expect(page.getByText(TEST_TASKS.buyGroceries.title)).toBeVisible()

    // ── Group-by-lane in AllTasks surfaces the lane group ──────────────────────
    await page.addInitScript(() => localStorage.setItem('flowstate:all-tasks-group-by', 'lane'))
    await page.goto('/#/tasks')
    await expect(page.getByText(LANE_NAME).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(TEST_TASKS.designLandingPage.title)).toBeVisible()
    await expect(page.getByText(TEST_TASKS.buyGroceries.title)).toBeVisible()

    // Cleanup
    await admin.from('tasks').update({ lane_id: null }).eq('id', TEST_TASKS.designLandingPage.id)
    await admin.from('tasks').update({ lane_id: null }).eq('id', TEST_TASKS.buyGroceries.id)
    await admin.from('lanes').delete().eq('id', LANE_ID)
  })

  test('creating a lane via the sidebar routes to its view', async ({ page }) => {
    await page.goto('/#/tasks')
    // Open the sidebar lane create input
    const addBtn = page.getByRole('button', { name: 'Add lane' })
    await expect(addBtn).toBeVisible({ timeout: 15000 })
    await addBtn.click()

    const input = page.getByPlaceholder('Lane name…')
    await expect(input).toBeVisible()
    await input.fill('Sprint Alpha')
    await input.press('Enter')

    // Routed to the new lane's view with its header
    await expect(page).toHaveURL(/#\/lane\//, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Sprint Alpha' })).toBeVisible()

    // Cleanup: created lane belongs to the test user — remove it
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (serviceRoleKey) {
      const admin = createClient(SUPABASE_URL, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      await admin.from('lanes').delete().eq('name', 'Sprint Alpha')
    }
  })
})
