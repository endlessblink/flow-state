import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AGENT_AUDIT_LOG_STORAGE_KEY, getAgentAuditLog, handleRendererAgentReadRequest } from '@/domain/agent'
import { useAgentApprovalQueueStore } from '@/stores/agent/approvalQueue'
import { useTaskStore } from '@/stores/tasks'

describe('renderer agent bridge workspace validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem(AGENT_AUDIT_LOG_STORAGE_KEY)
  })

  it('denies malformed workspace scopes instead of falling back to active workspace', async () => {
    const result = await handleRendererAgentReadRequest({
      requestId: 'request-1',
      command: 'flowstate_search_tasks',
      arguments: { workspace: { type: 'workspace' } },
    })

    expect(result).toEqual({
      status: 'denied',
      code: 'invalid_workspace_scope',
      message: 'Agent request included an invalid workspace scope.',
    })

    expect(getAgentAuditLog()[0]).toMatchObject({
      requestId: 'request-1',
      command: 'flowstate_search_tasks',
      operation: 'denied',
      status: 'denied',
      errorCode: 'invalid_workspace_scope',
    })
  })

  it('denies MCP write commands without an explicit workspace scope', async () => {
    const result = await handleRendererAgentReadRequest({
      requestId: 'request-2',
      command: 'flowstate_create_task',
      arguments: { dryRun: true, idempotencyKey: 'idem-1', title: 'Draft task' },
    })

    expect(result).toEqual({
      status: 'denied',
      code: 'invalid_workspace_scope',
      message: 'MCP write tools require an explicit workspace scope.',
    })

    expect(getAgentAuditLog()[0]).toMatchObject({
      requestId: 'request-2',
      command: 'flowstate_create_task',
      operation: 'denied',
      status: 'denied',
      errorCode: 'invalid_workspace_scope',
    })
  })

  it('queues successful dry-run write requests for in-app approval', async () => {
    const result = await handleRendererAgentReadRequest({
      requestId: 'request-3',
      command: 'flowstate_create_task',
      arguments: {
        workspace: { type: 'personal' },
        dryRun: true,
        idempotencyKey: 'idem-3',
        title: 'Draft task',
      },
    })

    expect(result).toMatchObject({
      status: 'success',
      command: 'flowstate_create_task',
      operation: 'dry_run',
    })
    expect(useAgentApprovalQueueStore().pendingRequests).toHaveLength(1)
    expect(useAgentApprovalQueueStore().pendingRequests[0]).toMatchObject({
      id: 'flowstate_create_task:idem-3',
      command: 'flowstate_create_task',
      status: 'pending',
      workspace: { type: 'personal', label: 'Personal' },
    })
  })

  it('returns conflict when an idempotency key is reused for a different write preview', async () => {
    await handleRendererAgentReadRequest({
      requestId: 'request-4',
      command: 'flowstate_create_task',
      arguments: {
        workspace: { type: 'personal' },
        dryRun: true,
        idempotencyKey: 'idem-4',
        title: 'Draft task',
      },
    })

    const conflict = await handleRendererAgentReadRequest({
      requestId: 'request-5',
      command: 'flowstate_create_task',
      arguments: {
        workspace: { type: 'personal' },
        dryRun: true,
        idempotencyKey: 'idem-4',
        title: 'Different draft task',
      },
    })

    expect(conflict).toMatchObject({
      status: 'conflict',
      error: { code: 'idempotency_conflict' },
    })
    expect(useAgentApprovalQueueStore().pendingRequests).toHaveLength(1)
  })

  it('returns conflict when affected tasks already have pending local writes', async () => {
    const taskStore = useTaskStore()
    taskStore.rawTasks.push({
      id: 'task-1',
      title: 'Existing task',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: '',
      projectId: '',
      isInInbox: true,
      workspaceId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    taskStore.addPendingWrite('task-1')

    const conflict = await handleRendererAgentReadRequest({
      requestId: 'request-6',
      command: 'flowstate_update_task',
      arguments: {
        workspace: { type: 'personal' },
        dryRun: true,
        idempotencyKey: 'idem-6',
        taskId: 'task-1',
        changes: { title: 'Agent title' },
      },
    })

    expect(conflict).toMatchObject({
      status: 'conflict',
      error: { code: 'pending_write_conflict' },
    })
    expect(useAgentApprovalQueueStore().pendingRequests).toHaveLength(0)
  })
})
