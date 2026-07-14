import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

function harness(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error })
  const notify = vi.fn()
  const { executeMergeTasks } = require('../../../server/local-api/merge-tasks.cjs') as {
    executeMergeTasks: (
      context: { supabase: { rpc: typeof rpc }; activeWorkspaceId: string | null },
      survivorId: string,
      body: Record<string, unknown>,
      notifyMutation: typeof notify,
    ) => Promise<{ status: number; body: unknown }>
  }
  return { executeMergeTasks, notify, rpc }
}

describe('Local API duplicate-task merge handler', () => {
  it('defaults to non-mutating preview and passes exact workspace scope', async () => {
    const preview = { ok: true, preview: true, previewVersion: 'merge-v1' }
    const { executeMergeTasks, notify, rpc } = harness(preview)

    await expect(executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: 'workspace-1' },
      'survivor-1',
      { duplicateTaskId: 'duplicate-1' },
      notify,
    )).resolves.toEqual({ status: 200, body: preview })

    expect(rpc).toHaveBeenCalledWith('flowstate_merge_tasks', {
      p_duplicate_task_id: 'duplicate-1',
      p_preview: true,
      p_preview_version: null,
      p_request_id: null,
      p_survivor_task_id: 'survivor-1',
      p_workspace_id: 'workspace-1',
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('routes an explicit canonical recurrence through the atomic reconciliation RPC', async () => {
    const preview = {
      ok: true,
      preview: true,
      previewVersion: 'recurrence-merge-v1',
      recurrenceResolution: { pattern: 'daily', interval: 3, endType: 'never' },
    }
    const { executeMergeTasks, notify, rpc } = harness(preview)

    await expect(executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: 'workspace-1' },
      'survivor-1',
      {
        duplicateTaskId: 'duplicate-1',
        recurrenceResolution: { pattern: 'daily', interval: 3, endType: 'never' },
      },
      notify,
    )).resolves.toEqual({ status: 200, body: preview })

    expect(rpc).toHaveBeenCalledWith('flowstate_merge_tasks_with_recurrence', {
      p_duplicate_task_id: 'duplicate-1',
      p_preview: true,
      p_preview_version: null,
      p_recurrence_resolution: { pattern: 'daily', interval: 3, endType: 'never' },
      p_request_id: null,
      p_survivor_task_id: 'survivor-1',
      p_workspace_id: 'workspace-1',
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('requires duplicate id and approval receipt for apply', async () => {
    const { executeMergeTasks, notify, rpc } = harness(null)
    await expect(executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', {}, notify,
    )).resolves.toMatchObject({ status: 400, body: { error: { code: 'invalid_request' } } })
    await expect(executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', { duplicateTaskId: 'duplicate-1', preview: false }, notify,
    )).resolves.toMatchObject({ status: 400, body: { error: { code: 'approval_receipt_required' } } })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('notifies survivor update and duplicate deletion only after apply succeeds', async () => {
    const receipt = {
      ok: true,
      preview: false,
      survivor: { id: 'survivor-1' },
      duplicate: { id: 'duplicate-1', status: 'archived' },
    }
    const { executeMergeTasks, notify, rpc } = harness(receipt)
    await expect(executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1',
      { duplicateTaskId: 'duplicate-1', preview: false, requestId: 'request-1', previewVersion: 'merge-v1' },
      notify,
    )).resolves.toEqual({ status: 200, body: receipt })
    expect(notify).toHaveBeenNthCalledWith(1, 'update', 'survivor-1')
    expect(notify).toHaveBeenNthCalledWith(2, 'delete', 'duplicate-1')
  })

  it.each([
    ['not_found', 404],
    ['idempotency_conflict', 409],
    ['state_conflict', 409],
    ['incompatible_task_context', 409],
    ['invalid_recurrence_resolution', 400],
    ['invalid_request', 400],
  ])('maps typed merge error %s to HTTP %s', async (code, status) => {
    const body = { ok: false, error: { code, message: 'safe message' } }
    const { executeMergeTasks, notify, rpc } = harness(body)
    await expect(executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', { duplicateTaskId: 'duplicate-1' }, notify,
    )).resolves.toEqual({ status, body })
  })

  it('turns an unresolved recurrence conflict into a stop-and-clarify action', async () => {
    const body = {
      ok: false,
      error: {
        code: 'incompatible_recurrence',
        message: 'Recurring definitions or chain identities are incompatible',
      },
    }
    const { executeMergeTasks, notify, rpc } = harness(body)

    await expect(executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1',
      { duplicateTaskId: 'duplicate-1' },
      notify,
    )).resolves.toEqual({
      status: 409,
      body: {
        ...body,
        action: 'stop_mutations_and_request_recurrence_resolution',
      },
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('turns established recurrence history into a stop-and-report action', async () => {
    const body = {
      ok: false,
      error: {
        code: 'recurrence_history_unsupported',
        message: 'Recurring task history requires an explicit series strategy',
      },
    }
    const { executeMergeTasks, notify, rpc } = harness(body)

    await expect(executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1',
      {
        duplicateTaskId: 'duplicate-1',
        recurrenceResolution: { pattern: 'daily', interval: 3, endType: 'never' },
      },
      notify,
    )).resolves.toEqual({
      status: 409,
      body: {
        ...body,
        action: 'stop_mutations_and_report_recurrence_history',
      },
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('sanitizes database failures', async () => {
    const { executeMergeTasks, notify, rpc } = harness(null, { message: 'private database detail' })
    await expect(executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', { duplicateTaskId: 'duplicate-1' }, notify,
    )).resolves.toEqual({
      status: 500,
      body: { ok: false, error: { code: 'merge_transaction_failed', message: 'Tasks could not be merged' } },
    })
  })
})
