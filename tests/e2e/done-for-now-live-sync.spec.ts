import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { ensureAuthUser } from '../fixtures/auth'

const TASK_ID = 'd0f00000-0000-4000-8000-00000000e2e1'
const TITLE = 'Disposable recurring UI sync fixture'
const EMAIL = 'playwright@test.flowstate'
const PASSWORD = 'pw-playwright-e2e-2026!'

test.describe.serial('recurring Done for now live UI synchronization', () => {
  test('advances the living task without restart across Search, Today, Inbox, and Canvas', async ({ page }) => {
    const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
    expect(serviceKey).not.toBe('')
    expect(anonKey).not.toBe('')

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const userId = (await ensureAuthUser(admin, {
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })).id
    expect(userId).toBeTruthy()

    const current = new Date()
    current.setDate(current.getDate() - 1)
    const next = new Date()
    next.setDate(next.getDate() + 1)
    const dateKey = (date: Date) => date.toISOString().slice(0, 10)
    const currentDate = dateKey(current)
    const nextDate = dateKey(next)

    await admin.from('flowstate_action_receipts').delete().eq('user_id', userId!).eq('operation', 'done_for_now')
    await admin.from('tasks').delete().eq('id', TASK_ID)
    const { error: seedError } = await admin.from('tasks').insert({
      id: TASK_ID,
      user_id: userId,
      title: TITLE,
      status: 'planned',
      due_date: `${currentDate}T20:00:00+03:00`,
      due_time: '20:00',
      estimated_duration: 25,
      recurrence_rule: { pattern: 'daily', interval: 1, endType: 'never' },
      recurrence_parent_id: TASK_ID,
      recurrence_count: 0,
      is_completion_record: false,
      is_deleted: false,
      is_in_inbox: true,
      instances: [{
        id: 'd0f00000-0000-4000-8000-00000000e2e2',
        taskId: TASK_ID,
        scheduledDate: currentDate,
        scheduledTime: '20:00',
        duration: 25,
        status: 'scheduled',
      }],
    })
    expect(seedError).toBeNull()

    try {
      await page.goto('/#/tasks')
      await page.waitForLoadState('networkidle')

      const userClient = createClient(url, anonKey, { auth: { persistSession: false } })
      const { error: authError } = await userClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
      expect(authError).toBeNull()
      const { data: preview, error: previewError } = await userClient.rpc('flowstate_done_for_now', {
        p_task_id: TASK_ID,
        p_preview: true,
        p_next_due_date: nextDate,
        p_request_id: null,
        p_preview_version: null,
        p_workspace_id: null,
      })
      expect(previewError).toBeNull()
      expect(preview.ok).toBe(true)

      const applyPayload = {
        p_task_id: TASK_ID,
        p_preview: false,
        p_next_due_date: nextDate,
        p_request_id: `e2e-${Date.now()}`,
        p_preview_version: preview.previewVersion,
        p_workspace_id: null,
        ...(typeof preview.requestHash === 'string' ? { p_request_hash: preview.requestHash } : {}),
      }

      const { data: receipt, error: applyError } = await userClient.rpc('flowstate_done_for_now', applyPayload)
      expect(applyError).toBeNull()
      expect(receipt.nextOccurrence.dueDate).toBe(nextDate)

      const { data: persistedTask, error: persistedTaskError } = await admin
        .from('tasks')
        .select('id,due_date,status,is_completion_record,is_deleted,recurrence_count')
        .eq('id', TASK_ID)
        .single()
      expect(persistedTaskError).toBeNull()
      expect(persistedTask).toEqual(expect.objectContaining({
        id: TASK_ID,
        status: 'planned',
        is_completion_record: false,
        is_deleted: false,
        recurrence_count: 1,
      }))
      expect(String(persistedTask?.due_date).slice(0, 10)).toBe(nextDate)

      const { data: completionRecords, error: completionRecordsError } = await admin
        .from('tasks')
        .select('id,status,is_completion_record,recurrence_parent_id')
        .eq('recurrence_parent_id', TASK_ID)
        .eq('is_completion_record', true)
      expect(completionRecordsError).toBeNull()
      expect(completionRecords).toHaveLength(1)
      expect(completionRecords?.[0]).toEqual(expect.objectContaining({
        status: 'done',
        is_completion_record: true,
        recurrence_parent_id: TASK_ID,
      }))

      const { data: persistedReceipt, error: persistedReceiptError } = await admin
        .from('flowstate_action_receipts')
        .select('operation,receipt')
        .eq('user_id', userId!)
        .eq('operation', 'done_for_now')
        .contains('receipt', { taskId: TASK_ID })
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      expect(persistedReceiptError).toBeNull()
      expect(persistedReceipt).toEqual(expect.objectContaining({
        operation: 'done_for_now',
        receipt: expect.objectContaining({ taskId: TASK_ID, ok: true }),
      }))

      const searchButton = page.getByRole('button', { name: 'Search tasks' }).first()
      await expect(searchButton).toBeVisible({ timeout: 10_000 })
      await searchButton.click()
      const search = page.locator('.search-modal-content input.search-input').first()
      await search.fill(TITLE)
      const result = page.locator('.search-modal-content .result-item').filter({ hasText: TITLE })
      await expect(result).toBeVisible({ timeout: 15_000 })
      await expect(result.locator('.result-due')).toHaveText('Tomorrow')

      await page.getByRole('button', { name: 'Today' }).click()
      await expect(result).not.toBeVisible()
      await page.locator('.search-modal-overlay').click({ position: { x: 5, y: 5 } })

      await page.goto('/#/canvas')
      await page.waitForLoadState('networkidle')
      const expandInbox = page.getByRole('button', { name: /expand inbox/i })
      if (await expandInbox.isVisible().catch(() => false)) await expandInbox.click()
      // A future occurrence with a scheduled instance is intentionally excluded
      // from the unscheduled Inbox and free Canvas; Search remains its discovery path.
      await expect(page.locator('.unified-inbox-panel').getByText(TITLE)).toHaveCount(0)
      await expect(page.locator('.canvas-container').getByText(TITLE)).toHaveCount(0)

      await page.reload()
      await page.waitForLoadState('networkidle')
      const reloadedSearchButton = page.getByRole('button', { name: 'Search tasks' }).first()
      await expect(reloadedSearchButton).toBeVisible({ timeout: 10_000 })
      await reloadedSearchButton.click()
      const reloadedSearch = page.locator('.search-modal-content input.search-input').first()
      await reloadedSearch.fill(TITLE)
      const reloadedResult = page.locator('.search-modal-content .result-item').filter({ hasText: TITLE })
      await expect(reloadedResult).toBeVisible({ timeout: 15_000 })
      await expect(reloadedResult.locator('.result-due')).toHaveText('Tomorrow')
    } finally {
      await admin.from('tasks').delete().eq('recurrence_parent_id', TASK_ID)
      await admin.from('tasks').delete().eq('id', TASK_ID)
      await admin.from('flowstate_action_receipts').delete().eq('user_id', userId!).eq('operation', 'done_for_now')
    }
  })
})
