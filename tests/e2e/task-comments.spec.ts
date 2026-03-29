import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const TEST_WORKSPACE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

test.describe('Task Comments (TASK-1553)', () => {
  test.beforeAll(async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: users } = await supabase.auth.admin.listUsers()
    const testUser = users?.users?.find(u => u.email === 'playwright@test.flowstate')
    if (!testUser) throw new Error('Test user not found')
    const userId = testUser.id

    // Create workspace
    await supabase.from('workspaces').upsert({
      id: TEST_WORKSPACE_ID,
      name: 'Test Workspace',
      owner_id: userId,
      color: '#4ECDC4',
    })

    // Add user as owner
    await supabase.from('workspace_members').upsert(
      { workspace_id: TEST_WORKSPACE_ID, user_id: userId, role: 'owner' },
      { onConflict: 'workspace_id,user_id' }
    )

    // Assign "Set up CI/CD pipeline" to this workspace (it's in_progress, more visible)
    await supabase.from('tasks')
      .update({ workspace_id: TEST_WORKSPACE_ID, updated_at: new Date().toISOString() })
      .eq('id', TEST_TASKS.setupCICD.id)
  })

  test('comments section visible for workspace task', async ({ page }) => {
    // Use Board view where task cards open modal on click
    await page.goto('/#/tasks')
    await page.waitForTimeout(3000)

    // Switch to Test Workspace
    const switcher = page.locator('.workspace-switcher .switcher-trigger')
    if (await switcher.isVisible().catch(() => false)) {
      await switcher.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: '.dev/screenshots/comments-1-switcher.png' })

      const wsOption = page.getByText('Test Workspace', { exact: true }).first()
      if (await wsOption.isVisible().catch(() => false)) {
        await wsOption.click()
        await page.waitForTimeout(2000)
      }
    }

    await page.screenshot({ path: '.dev/screenshots/comments-2-workspace.png' })

    // Switch to Board view
    await page.locator('text=Board').first().click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: '.dev/screenshots/comments-3-board.png' })

    // Find and click on the "Set up CI/CD pipeline" task card
    const taskCard = page.getByText('Set up CI/CD', { exact: false }).first()
    const cardVisible = await taskCard.isVisible({ timeout: 5000 }).catch(() => false)
    console.log('Task card visible:', cardVisible)

    if (cardVisible) {
      await taskCard.click()
      await page.waitForTimeout(1500)
    } else {
      // Fallback: try the task title in table view
      const taskTitle = page.locator('.task-title, .kanban-card-title, .task-card').filter({ hasText: 'CI/CD' }).first()
      await taskTitle.click()
      await page.waitForTimeout(1500)
    }

    await page.screenshot({ path: '.dev/screenshots/comments-4-after-click.png' })

    // Check if modal or edit panel opened
    const modal = page.locator('.modal-overlay, .modal-content, .task-edit-modal')
    const modalVisible = await modal.first().isVisible().catch(() => false)
    console.log('Modal visible:', modalVisible)

    if (!modalVisible) {
      // Maybe we need to double-click or click edit button
      // Try finding and clicking the edit icon on the task row
      await page.screenshot({ path: '.dev/screenshots/comments-5-no-modal.png' })

      // Try clicking the task title text directly
      const titleEl = page.locator('.task-row__title, .card-title, [class*="title"]').filter({ hasText: 'CI/CD' }).first()
      if (await titleEl.isVisible().catch(() => false)) {
        await titleEl.dblclick() // Try double-click
        await page.waitForTimeout(1500)
      }
      await page.screenshot({ path: '.dev/screenshots/comments-6-dblclick.png' })
    }

    // Final modal check
    const finalModal = page.locator('.modal-overlay')
    const finalModalVisible = await finalModal.isVisible().catch(() => false)
    console.log('Final modal visible:', finalModalVisible)

    if (finalModalVisible) {
      // Scroll to bottom of modal to find comments
      const modalContent = page.locator('.modal-content')
      await modalContent.evaluate(el => el.scrollTop = el.scrollHeight)
      await page.waitForTimeout(500)
      await page.screenshot({ path: '.dev/screenshots/comments-7-scrolled.png' })

      const commentsToggle = page.locator('button.section-toggle').filter({ hasText: 'Comments' })
      const commentsVisible = await commentsToggle.isVisible().catch(() => false)
      console.log('Comments section visible:', commentsVisible)
      expect(commentsVisible).toBe(true)
    } else {
      await page.screenshot({ path: '.dev/screenshots/comments-8-still-no-modal.png' })
      // Fail with clear message
      expect(finalModalVisible, 'Task edit modal did not open — check screenshots in .dev/screenshots/').toBe(true)
    }
  })
})
