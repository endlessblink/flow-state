import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WriteOperation } from '@/types/sync'

const writeQueueMocks = vi.hoisted(() => ({
  getOperationsForEntity: vi.fn(),
  deleteOperation: vi.fn(),
  updateOperation: vi.fn(),
}))

vi.mock('@/services/offline/writeQueueDB', () => writeQueueMocks)

import { coalesceOperationsForEntity } from '@/services/offline/operationCoalescer'

function makeOperation(partial: Partial<WriteOperation>): WriteOperation {
  return {
    id: partial.id ?? 1,
    entityType: partial.entityType ?? 'task',
    operation: partial.operation ?? 'update',
    entityId: partial.entityId ?? 'task-1',
    payload: partial.payload ?? {},
    status: partial.status ?? 'pending',
    retryCount: partial.retryCount ?? 0,
    createdAt: partial.createdAt ?? 1,
    userId: partial.userId ?? 'user-1',
    workspaceId: partial.workspaceId ?? null,
    baseVersion: partial.baseVersion,
    lastAttemptAt: partial.lastAttemptAt,
    lastError: partial.lastError,
    nextRetryAt: partial.nextRetryAt,
    canonicalTaskPatch: partial.canonicalTaskPatch,
    doneForNow: partial.doneForNow,
  }
}

describe('coalesceOperationsForEntity durable identities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves a queued done-for-now operation when same-task updates are also pending', async () => {
    const earlierUpdate = makeOperation({
      id: 10,
      createdAt: 10,
      payload: { title: 'Earlier update' },
    })
    const doneForNow = makeOperation({
      id: 11,
      createdAt: 11,
      payload: {},
      doneForNow: {
        requestId: 'done-for-now-request',
        nextDueDate: '2026-07-24',
      },
    })

    writeQueueMocks.getOperationsForEntity.mockResolvedValue([earlierUpdate, doneForNow])

    const result = await coalesceOperationsForEntity('task', 'task-1')

    expect(result).toEqual({
      operation: earlierUpdate,
      mergedOperationIds: [],
      description: 'Done-for-now operation identity preserved',
    })
    expect(writeQueueMocks.deleteOperation).not.toHaveBeenCalled()
    expect(writeQueueMocks.updateOperation).not.toHaveBeenCalled()
  })
})
