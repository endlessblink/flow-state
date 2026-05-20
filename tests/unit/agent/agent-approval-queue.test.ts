import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAgentApprovalQueueStore } from '@/stores/agent/approvalQueue'

describe('agent approval queue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('enqueues successful dry-run write results for one-time approval', () => {
    const queue = useAgentApprovalQueueStore()

    const request = queue.enqueueDryRun({
      requestId: 'request-1',
      actor: { id: 'agent', name: 'Agent', transport: 'stdio' },
      workspace: { type: 'personal' },
      dryRun: true,
      idempotencyKey: 'idem-1',
    }, 'flowstate_soft_delete_task', {
      status: 'success',
      command: 'flowstate_soft_delete_task',
      operation: 'dry_run',
      workspace: { type: 'personal', workspaceId: null, label: 'Personal' },
      diff: [{ path: '/tasks/task-1/_soft_deleted', before: false, after: true }],
      audit: {
        operation: 'dry_run',
        command: 'flowstate_soft_delete_task',
        workspace: { type: 'personal', workspaceId: null, label: 'Personal' },
        affectedEntityType: 'task',
        affectedEntityIds: ['task-1'],
      },
    })

    expect(request).toMatchObject({
      id: 'flowstate_soft_delete_task:idem-1',
      status: 'pending',
      risk: 'high',
      affectedEntityIds: ['task-1'],
      resultFingerprint: expect.any(String),
      syncStatus: 'synced',
    })
    expect(queue.pendingRequests).toHaveLength(1)
  })

  it('treats equivalent duplicate dry-runs as idempotent', () => {
    const queue = useAgentApprovalQueueStore()
    const context = {
      requestId: 'request-1',
      actor: { id: 'agent', name: 'Agent', transport: 'stdio' as const },
      workspace: { type: 'personal' as const },
      dryRun: true,
      idempotencyKey: 'idem-1',
    }
    const result = {
      status: 'success' as const,
      command: 'flowstate_create_task' as const,
      operation: 'dry_run' as const,
      workspace: { type: 'personal' as const, workspaceId: null, label: 'Personal' as const },
      diff: [{ path: '/tasks/-', before: null, after: { title: 'Draft' } }],
      audit: {
        operation: 'dry_run' as const,
        command: 'flowstate_create_task' as const,
        workspace: { type: 'personal' as const, workspaceId: null, label: 'Personal' as const },
        affectedEntityType: 'task' as const,
        affectedEntityIds: ['agent-preview-idem-1'],
      },
    }

    const first = queue.enqueueDryRun(context, 'flowstate_create_task', result)
    const second = queue.enqueueDryRun(context, 'flowstate_create_task', result)

    expect(second).toStrictEqual(first)
    expect(queue.pendingRequests).toHaveLength(1)
    expect(queue.getIdempotencyConflict(context, 'flowstate_create_task', result)).toBeNull()
  })

  it('detects conflicting reuse of an idempotency key', () => {
    const queue = useAgentApprovalQueueStore()
    const context = {
      requestId: 'request-1',
      actor: { id: 'agent', name: 'Agent', transport: 'stdio' as const },
      workspace: { type: 'personal' as const },
      dryRun: true,
      idempotencyKey: 'idem-1',
    }
    const firstResult = {
      status: 'success' as const,
      command: 'flowstate_create_task' as const,
      operation: 'dry_run' as const,
      workspace: { type: 'personal' as const, workspaceId: null, label: 'Personal' as const },
      diff: [{ path: '/tasks/-', before: null, after: { title: 'Draft' } }],
      audit: {
        operation: 'dry_run' as const,
        command: 'flowstate_create_task' as const,
        workspace: { type: 'personal' as const, workspaceId: null, label: 'Personal' as const },
        affectedEntityType: 'task' as const,
        affectedEntityIds: ['agent-preview-idem-1'],
      },
    }
    const conflictingResult = {
      ...firstResult,
      diff: [{ path: '/tasks/-', before: null, after: { title: 'Different draft' } }],
    }

    queue.enqueueDryRun(context, 'flowstate_create_task', firstResult)

    expect(queue.getIdempotencyConflict(context, 'flowstate_create_task', conflictingResult)).toMatchObject({
      id: 'flowstate_create_task:idem-1',
    })
  })

  it('does not enqueue denied or validation-error write results', () => {
    const queue = useAgentApprovalQueueStore()

    const request = queue.enqueueDryRun({
      requestId: 'request-1',
      actor: { id: 'agent', name: 'Agent', transport: 'stdio' },
      workspace: { type: 'personal' },
      dryRun: true,
      idempotencyKey: 'idem-1',
    }, 'flowstate_create_task', {
      status: 'validation_error',
      command: 'flowstate_create_task',
      operation: 'dry_run',
      workspace: { type: 'personal', workspaceId: null, label: 'Personal' },
      audit: {
        operation: 'dry_run',
        command: 'flowstate_create_task',
        workspace: { type: 'personal', workspaceId: null, label: 'Personal' },
        affectedEntityIds: [],
      },
      error: { code: 'title_required', message: 'Task title is required.' },
    })

    expect(request).toBeNull()
    expect(queue.requests).toHaveLength(0)
  })

  it('moves pending requests to approved or denied exactly once', () => {
    const queue = useAgentApprovalQueueStore()
    queue.enqueueDryRun({
      requestId: 'request-1',
      actor: { id: 'agent', name: 'Agent', transport: 'stdio' },
      workspace: { type: 'personal' },
      dryRun: true,
      idempotencyKey: 'idem-1',
    }, 'flowstate_create_task', {
      status: 'success',
      command: 'flowstate_create_task',
      operation: 'dry_run',
      workspace: { type: 'personal', workspaceId: null, label: 'Personal' },
      diff: [{ path: '/tasks/-', before: null, after: { title: 'Draft' } }],
      audit: {
        operation: 'dry_run',
        command: 'flowstate_create_task',
        workspace: { type: 'personal', workspaceId: null, label: 'Personal' },
        affectedEntityType: 'task',
        affectedEntityIds: ['agent-preview-idem-1'],
      },
    })

    expect(queue.approveOnce('flowstate_create_task:idem-1')).toBe(true)
    expect(queue.approveOnce('flowstate_create_task:idem-1')).toBe(false)
    expect(queue.deny('flowstate_create_task:idem-1')).toBe(false)
    expect(queue.pendingRequests).toHaveLength(0)
    expect(queue.resolvedRequests[0].status).toBe('approved')
  })
})
