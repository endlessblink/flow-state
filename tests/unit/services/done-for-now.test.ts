import { describe, expect, it, vi } from 'vitest'
import { runDoneForNow } from '@/services/tasks/doneForNow'

describe('recurring Done for now domain adapter', () => {
  it('previews and applies through the same canonical transaction contract', async () => {
    const preview = { ok: true, preview: true, previewVersion: 'v1' }
    const receipt = { ok: true, preview: false, requestId: 'request-1', taskId: 'task-1' }
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview, error: null })
      .mockResolvedValueOnce({ data: receipt, error: null })
    const client = { rpc }

    await expect(runDoneForNow(client, {
      taskId: 'task-1',
      preview: true,
      workspaceId: 'workspace-1',
    })).resolves.toEqual(preview)
    await expect(runDoneForNow(client, {
      taskId: 'task-1',
      preview: false,
      requestId: 'request-1',
      previewVersion: 'v1',
    })).resolves.toEqual(receipt)

    expect(rpc).toHaveBeenNthCalledWith(1, 'flowstate_done_for_now', {
      p_next_due_date: null,
      p_preview: true,
      p_preview_version: null,
      p_request_id: null,
      p_task_id: 'task-1',
      p_workspace_id: 'workspace-1',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'flowstate_done_for_now', {
      p_next_due_date: null,
      p_preview: false,
      p_preview_version: 'v1',
      p_request_id: 'request-1',
      p_task_id: 'task-1',
      p_workspace_id: null,
    })
  })

  it('preserves typed domain failures without exposing raw database errors', async () => {
    const typed = { ok: false, error: { code: 'not_recurring', message: 'task is not recurring' } }
    const typedClient = { rpc: vi.fn().mockResolvedValue({ data: typed, error: null }) }
    const failedClient = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'private database detail' } }) }

    await expect(runDoneForNow(typedClient, { taskId: 'task-1', preview: true })).rejects.toMatchObject({
      code: 'not_recurring',
      message: 'task is not recurring',
    })
    await expect(runDoneForNow(failedClient, { taskId: 'task-1', preview: true })).rejects.toMatchObject({
      code: 'recurrence_transaction_failed',
      message: 'Done for now could not be completed',
    })
  })
})
