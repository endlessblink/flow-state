/**
 * BUG-2115: after heavy enqueue/delete churn, status-index scans of an EMPTY
 * write queue took 60-700 ms each in LevelDB and ran several times a second,
 * keeping a CPU thread busy while FlowState sat idle in the background. Queue
 * stats must answer an empty queue without status-index scans, and still count
 * real work correctly.
 */
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAll,
  enqueueOperation,
  getPendingCount,
  getStats,
  getWriteQueueDB,
  isOperationsTableEmpty,
} from '@/services/offline/writeQueueDB'

describe('write queue empty fast path (BUG-2115)', () => {
  beforeEach(async () => {
    await clearAll()
    vi.restoreAllMocks()
  })

  it('answers an empty queue without status-index scans', async () => {
    const where = vi.spyOn(getWriteQueueDB().operations, 'where')

    expect(await isOperationsTableEmpty()).toBe(true)
    expect(await getPendingCount()).toBe(0)
    expect(await getStats()).toMatchObject({ totalOperations: 0, pendingCount: 0, failedCount: 0 })
    expect(where).not.toHaveBeenCalled()
  })

  it('still counts queued work', async () => {
    await enqueueOperation({ entityType: 'task', operation: 'update', entityId: 'task-1', payload: { id: 'task-1', title: 'A' }, userId: 'user-a', workspaceId: null })

    expect(await isOperationsTableEmpty()).toBe(false)
    expect(await getPendingCount()).toBe(1)
    expect(await getStats()).toMatchObject({ totalOperations: 1, pendingCount: 1 })
  })
})
