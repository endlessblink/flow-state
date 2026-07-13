import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

type RpcResult = { data: unknown; error: { message: string } | null }

function createHarness(result: RpcResult) {
  const rpc = vi.fn().mockResolvedValue(result)
  const notifyTaskMutation = vi.fn()
  const { executeDoneForNow } = require('../../../server/local-api/done-for-now.cjs') as {
    executeDoneForNow: (
      context: { supabase: { rpc: typeof rpc }; userId: string; activeWorkspaceId?: string | null },
      taskId: string,
      body: Record<string, unknown>,
      notify: typeof notifyTaskMutation,
    ) => Promise<{ status: number; body: Record<string, unknown> }>
  }

  return { executeDoneForNow, notifyTaskMutation, rpc }
}

describe('Local API recurring Done for now handler', () => {
  it('previews through the canonical RPC without writing or requiring a request id', async () => {
    const preview = {
      ok: true,
      preview: true,
      previewVersion: 'task-1:0:2026-07-12:v1',
      task: { id: 'task-1', title: 'Recurring fixture' },
      currentOccurrence: { dueDate: '2026-07-12', statusBefore: 'todo', statusAfter: 'done' },
      recurrence: { nextDueDateAfter: '2026-07-16', cadencePreserved: true },
    }
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: preview, error: null })

    const result = await executeDoneForNow(
      { supabase: { rpc }, userId: 'fixture-user', activeWorkspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      'task-1',
      { preview: true, nextDueDate: '2026-07-16' },
      notifyTaskMutation,
    )

    expect(result).toEqual({ status: 200, body: preview })
    expect(rpc).toHaveBeenCalledWith('flowstate_done_for_now', {
      p_next_due_date: '2026-07-16',
      p_preview: true,
      p_preview_version: null,
      p_request_id: null,
      p_task_id: 'task-1',
      p_workspace_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('passes null as the exact personal workspace scope', async () => {
    const preview = { ok: true, preview: true }
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: preview, error: null })

    await executeDoneForNow(
      { supabase: { rpc }, userId: 'fixture-user', activeWorkspaceId: null },
      'task-personal',
      { preview: true },
      notifyTaskMutation,
    )

    expect(rpc).toHaveBeenCalledWith('flowstate_done_for_now', expect.objectContaining({
      p_task_id: 'task-personal',
      p_workspace_id: null,
    }))
  })

  it('requires a stable request id and preview version before apply', async () => {
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: null, error: null })

    await expect(executeDoneForNow(
      { supabase: { rpc }, userId: 'fixture-user' },
      'task-1',
      { preview: false },
      notifyTaskMutation,
    )).resolves.toEqual({
      status: 400,
      body: { error: { code: 'approval_receipt_required', message: 'requestId and previewVersion are required for apply' }, ok: false },
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('applies once, returns real identifiers, and notifies the renderer for both affected rows', async () => {
    const receipt = {
      ok: true,
      preview: false,
      requestId: 'request-1',
      taskId: 'task-1',
      completedOccurrence: { id: 'history-1', status: 'done', completedAt: '2026-07-12T12:00:00Z' },
      nextOccurrence: { id: 'instance-2', taskId: 'task-1', status: 'todo', dueDate: '2026-07-16' },
    }
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: receipt, error: null })

    const result = await executeDoneForNow(
      { supabase: { rpc }, userId: 'fixture-user' },
      'task-1',
      { preview: false, previewVersion: 'v1', requestId: 'request-1' },
      notifyTaskMutation,
    )

    expect(result).toEqual({ status: 200, body: receipt })
    expect(notifyTaskMutation).toHaveBeenNthCalledWith(1, 'create', 'history-1')
    expect(notifyTaskMutation).toHaveBeenNthCalledWith(2, 'update', 'task-1')
  })

  it.each([
    ['not_found', 404],
    ['not_recurring', 409],
    ['already_completed', 409],
    ['idempotency_conflict', 409],
    ['state_conflict', 409],
    ['invalid_next_date', 400],
    ['recurrence_calculation_failed', 422],
    ['recurrence_exhausted', 409],
    ['not_authenticated', 401],
  ])('maps typed domain error %s to HTTP %s', async (code, status) => {
    const domainError = { ok: false, error: { code, message: 'safe message' } }
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: domainError, error: null })

    const result = await executeDoneForNow(
      { supabase: { rpc }, userId: 'fixture-user' },
      'task-1',
      { preview: true },
      notifyTaskMutation,
    )

    expect(result).toEqual({ status, body: domainError })
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('does not expose database error details', async () => {
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({
      data: null,
      error: { message: 'postgres internal details and identifiers' },
    })

    const result = await executeDoneForNow(
      { supabase: { rpc }, userId: 'fixture-user' },
      'task-1',
      { preview: true },
      notifyTaskMutation,
    )

    expect(result).toEqual({
      status: 500,
      body: { error: { code: 'recurrence_transaction_failed', message: 'Done for now could not be completed' }, ok: false },
    })
  })
})
