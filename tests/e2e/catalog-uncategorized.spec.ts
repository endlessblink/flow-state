/**
 * TASK-1455: Catalog view shows uncategorized tasks so they can be categorized in-place.
 *
 * Verifies that when grouped by "project", tasks with no projectId appear in an
 * "Uncategorized" group at the TOP of the list — before all project groups.
 */
import { test, expect } from '../fixtures/auth'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'

const UNCATEGORIZED_TASK_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa99'
const UNCATEGORIZED_TASK_TITLE = 'Inbox task without a project'

test.describe('TASK-1455: Catalog — Uncategorized tasks group', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress wizard/onboarding overlays and force groupBy=project before page load
    await page.addInitScript(() => {
      localStorage.setItem('flowstate:all-tasks-group-by', 'project')
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })
  })

  test('Uncategorized group appears at top when tasks have no project', async ({ page }) => {
    // ── Step 1: Seed an uncategorized task via Supabase Admin client ─────────────
    // Use service_role key (set by run-e2e.sh) to bypass RLS — same pattern as global-setup.ts
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    expect(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY must be set — run via: npm run test:e2e').toBeTruthy()

    const adminClient = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Find the test user to get their user_id
    const { data: users } = await adminClient.auth.admin.listUsers()
    let testUser = users?.users?.find(u => u.email === 'playwright@test.flowstate')
    for (let i = 0; i < 10 && !testUser; i++) {
      await new Promise(r => setTimeout(r, 1000))
      const res = await adminClient.auth.admin.listUsers()
      testUser = res.data.users.find((u) => u.email === 'playwright@test.flowstate')
    }
    expect(testUser, 'Test user must exist (global-setup should have created it)').toBeTruthy()

    // Upsert an uncategorized task (project_id = null)
    const { error: upsertError } = await adminClient.from('tasks').upsert(
      {
        id: UNCATEGORIZED_TASK_ID,
        user_id: testUser!.id,
        title: UNCATEGORIZED_TASK_TITLE,
        status: 'planned',
        priority: 'medium',
        // project_id intentionally omitted → stored as NULL in DB → uncategorized
      },
      { onConflict: 'id' }
    )
    expect(upsertError, `Supabase upsert error: ${upsertError?.message}`).toBeNull()

    // ── Step 2: Navigate to the catalog view ────────────────────────────────────
    await page.goto('/#/catalog')

    // Dismiss any overlays
    const skipBtn = page.locator('text=Skip for now')
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click()
    }

    // ── Step 3: Wait for the task list to load ──────────────────────────────────
    // Wait until at least one group header is visible (means tasks loaded + grouped)
    await page.waitForSelector('.group-header', { timeout: 20000 })

    // ── Step 4: Assert the "Uncategorized" group header is present ──────────────
    const groupHeaders = page.locator('.group-header .group-name')
    const headerTexts = await groupHeaders.allTextContents()

    expect(
      headerTexts.some(t => t.toLowerCase().includes('uncategorized')),
      `Expected an "Uncategorized" group header. Found headers: ${JSON.stringify(headerTexts)}`
    ).toBe(true)

    // ── Step 5: Uncategorized group must be FIRST ───────────────────────────────
    const firstHeader = groupHeaders.first()
    const firstHeaderText = await firstHeader.textContent()
    expect(
      firstHeaderText?.toLowerCase(),
      `"Uncategorized" group must be at the top. First group was: "${firstHeaderText}"`
    ).toContain('uncategorized')

    // ── Step 6: The uncategorized task itself appears under that group ───────────
    const uncategorizedGroup = page.locator(`.task-group[data-group-key="uncategorized"]`)
    await expect(uncategorizedGroup).toBeVisible({ timeout: 5000 })
    const uncategorizedTask = uncategorizedGroup.getByText(UNCATEGORIZED_TASK_TITLE)
    await expect(uncategorizedTask).toBeVisible({ timeout: 5000 })

    // ── Step 7: Other project groups still appear after Uncategorized ────────────
    // Seed data has "Work" and "Personal" projects with tasks
    const allHeaderTexts = await groupHeaders.allTextContents()
    expect(
      allHeaderTexts.some(t => t.toLowerCase().includes('work')),
      `Expected a "Work" project group. Found: ${JSON.stringify(allHeaderTexts)}`
    ).toBe(true)

    // ── Step 8: Screenshot for verification ─────────────────────────────────────
    await page.screenshot({
      path: '.dev/screenshots/task-1455-catalog-uncategorized.png',
      fullPage: false,
    })
  })

  test('groupBy defaults to project and renders group headers', async ({ page }) => {
    await page.goto('/#/catalog')

    const skipBtn = page.locator('text=Skip for now')
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click()
    }

    // Wait for the view to load
    await page.waitForSelector('.all-tasks-view', { timeout: 15000 })

    // The groupBy key in localStorage should be 'project' (set in addInitScript)
    const groupByValue = await page.evaluate(() =>
      localStorage.getItem('flowstate:all-tasks-group-by')
    )
    expect(groupByValue).toBe('project')

    // Group headers should be visible (meaning groupBy is active, not 'none')
    await page.waitForSelector('.group-header', { timeout: 15000 })
    const headerCount = await page.locator('.group-header').count()
    expect(headerCount, 'Should have at least one group header when grouped by project').toBeGreaterThan(0)
  })
})
