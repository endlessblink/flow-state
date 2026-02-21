import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WriteOperation } from '@/types/sync'
import { coalesceAllOperations, coalesceOperationsForEntity, mergePayloads } from '@/services/offline/operationCoalescer'

const writeQueueMocks = vi.hoisted(() => ({
  getOperationsForEntity: vi.fn(),
  deleteOperation: vi.fn(),
  updateOperation: vi.fn()
}))

vi.mock('@/services/offline/writeQueueDB', () => ({
  getOperationsForEntity: writeQueueMocks.getOperationsForEntity,
  deleteOperation: writeQueueMocks.deleteOperation,
  updateOperation: writeQueueMocks.updateOperation
}))

function makeOp(partial: Partial<WriteOperation>): WriteOperation {
  return {
    id: partial.id ?? 1,
    entityType: partial.entityType ?? 'task',
    operation: partial.operation ?? 'update',
    entityId: partial.entityId ?? 'task-1',
    payload: partial.payload ?? {},
    baseVersion: partial.baseVersion,
    status: partial.status ?? 'pending',
    retryCount: partial.retryCount ?? 0,
    createdAt: partial.createdAt ?? Date.now(),
    userId: partial.userId
  }
}

describe('TASK-1168: sync conflict resolution edge-cases (operation coalescing)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cancels out create + delete for same entity and removes all related queued operations', async () => {
    const create = makeOp({ id: 10, operation: 'create', createdAt: 1000, payload: { title: 'draft' } })
    const update = makeOp({ id: 11, operation: 'update', createdAt: 1100, payload: { title: 'draft v2' } })
    const remove = makeOp({ id: 12, operation: 'delete', createdAt: 1200, payload: {} })

    writeQueueMocks.getOperationsForEntity.mockResolvedValue([create, update, remove])

    const result = await coalesceOperationsForEntity('task', 'task-1')

    expect(result.operation).toBeNull()
    expect(result.description).toBe('Create + Delete cancelled out')
    expect(result.mergedOperationIds).toEqual([10, 11, 12])
    expect(writeQueueMocks.deleteOperation).toHaveBeenCalledTimes(3)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(1, 10)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(2, 11)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(3, 12)
    expect(writeQueueMocks.updateOperation).not.toHaveBeenCalled()
  })

  it('collapses update chain into one update, preserving highest baseVersion', async () => {
    const first = makeOp({
      id: 21,
      operation: 'update',
      createdAt: 1000,
      baseVersion: 3,
      payload: { title: 'a', meta: { priority: 'low' } }
    })
    const second = makeOp({
      id: 22,
      operation: 'update',
      createdAt: 1100,
      baseVersion: 9,
      payload: { description: 'b', meta: { estimate: 30 } }
    })
    const third = makeOp({
      id: 23,
      operation: 'update',
      createdAt: 1200,
      baseVersion: 7,
      payload: { title: 'final', done: true }
    })

    writeQueueMocks.getOperationsForEntity.mockResolvedValue([first, second, third])

    const result = await coalesceOperationsForEntity('task', 'task-1')

    expect(result.operation).toMatchObject({
      id: 21,
      operation: 'update',
      baseVersion: 9,
      payload: {
        title: 'final',
        description: 'b',
        done: true,
        meta: {
          priority: 'low',
          estimate: 30
        }
      }
    })
    expect(result.description).toBe('Merged 3 updates into 1')
    expect(result.mergedOperationIds).toEqual([22, 23])

    expect(writeQueueMocks.deleteOperation).toHaveBeenCalledTimes(2)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(1, 22)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(2, 23)

    expect(writeQueueMocks.updateOperation).toHaveBeenCalledTimes(1)
    expect(writeQueueMocks.updateOperation).toHaveBeenCalledWith(21, {
      payload: {
        title: 'final',
        description: 'b',
        done: true,
        meta: {
          priority: 'low',
          estimate: 30
        }
      },
      baseVersion: 9
    })
  })

  it('merges updates into create and does not keep standalone update operations', async () => {
    const create = makeOp({ id: 31, operation: 'create', createdAt: 1000, payload: { title: 'initial', done: false } })
    const update1 = makeOp({ id: 32, operation: 'update', createdAt: 1100, payload: { description: 'details' } })
    const update2 = makeOp({ id: 33, operation: 'update', createdAt: 1200, payload: { done: true } })

    writeQueueMocks.getOperationsForEntity.mockResolvedValue([create, update1, update2])

    const result = await coalesceOperationsForEntity('task', 'task-1')

    expect(result.operation).toMatchObject({
      id: 31,
      operation: 'create',
      payload: {
        title: 'initial',
        description: 'details',
        done: true
      }
    })
    expect(result.description).toBe('Merged 2 updates into create')
    expect(result.mergedOperationIds).toEqual([32, 33])

    expect(writeQueueMocks.deleteOperation).toHaveBeenCalledTimes(2)
    expect(writeQueueMocks.updateOperation).toHaveBeenCalledTimes(1)
    expect(writeQueueMocks.updateOperation).toHaveBeenCalledWith(31, {
      payload: {
        title: 'initial',
        description: 'details',
        done: true
      }
    })
  })

  it('keeps delete as final operation and prunes earlier updates', async () => {
    const update1 = makeOp({ id: 41, operation: 'update', createdAt: 1000, payload: { title: 'A' } })
    const update2 = makeOp({ id: 42, operation: 'update', createdAt: 1100, payload: { title: 'B' } })
    const remove = makeOp({ id: 43, operation: 'delete', createdAt: 1200, payload: {} })

    writeQueueMocks.getOperationsForEntity.mockResolvedValue([update1, update2, remove])

    const result = await coalesceOperationsForEntity('task', 'task-1')

    expect(result.operation).toEqual(remove)
    expect(result.description).toBe('Merged 2 operations into delete')
    expect(result.mergedOperationIds).toEqual([41, 42])
    expect(writeQueueMocks.deleteOperation).toHaveBeenCalledTimes(2)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(1, 41)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(2, 42)
    expect(writeQueueMocks.updateOperation).not.toHaveBeenCalled()
  })

  it('ignores syncing/completed operations when resolving conflicts', async () => {
    const pending = makeOp({ id: 51, operation: 'update', status: 'pending', createdAt: 1000, payload: { title: 'pending' } })
    const failed = makeOp({ id: 52, operation: 'update', status: 'failed', createdAt: 1100, payload: { title: 'failed-win' } })
    const syncing = makeOp({ id: 53, operation: 'update', status: 'syncing', createdAt: 1200, payload: { title: 'syncing-ignored' } })
    const completed = makeOp({ id: 54, operation: 'update', status: 'completed', createdAt: 1300, payload: { title: 'completed-ignored' } })

    writeQueueMocks.getOperationsForEntity.mockResolvedValue([pending, failed, syncing, completed])

    const result = await coalesceOperationsForEntity('task', 'task-1')

    expect(result.operation).toMatchObject({
      id: 51,
      payload: { title: 'failed-win' }
    })
    expect(result.mergedOperationIds).toEqual([52])
    expect(writeQueueMocks.deleteOperation).toHaveBeenCalledTimes(1)
    expect(writeQueueMocks.deleteOperation).toHaveBeenCalledWith(52)
    expect(writeQueueMocks.updateOperation).toHaveBeenCalledTimes(1)
    expect(writeQueueMocks.updateOperation).toHaveBeenCalledWith(51, {
      payload: { title: 'failed-win' },
      baseVersion: 0
    })
  })

  it('mergePayloads keeps existing keys when override uses undefined', () => {
    const merged = mergePayloads(
      {
        title: 'keep-me',
        description: 'desc',
        meta: { priority: 'high', estimate: 45 }
      },
      {
        title: undefined,
        meta: { estimate: 60 }
      }
    )

    expect(merged).toEqual({
      title: 'keep-me',
      description: 'desc',
      meta: {
        priority: 'high',
        estimate: 60
      }
    })
  })

  it('returns null when entity only has syncing/completed operations', async () => {
    const syncing = makeOp({ id: 61, operation: 'update', status: 'syncing', createdAt: 1000, payload: { title: 'syncing' } })
    const completed = makeOp({ id: 62, operation: 'delete', status: 'completed', createdAt: 1100, payload: {} })

    writeQueueMocks.getOperationsForEntity.mockResolvedValue([syncing, completed])

    const result = await coalesceOperationsForEntity('task', 'task-1')

    expect(result).toEqual({
      operation: null,
      mergedOperationIds: [],
      description: 'No coalescing needed'
    })
    expect(writeQueueMocks.deleteOperation).not.toHaveBeenCalled()
    expect(writeQueueMocks.updateOperation).not.toHaveBeenCalled()
  })

  it('does not coalesce when exactly one pending/failed operation remains after filtering', async () => {
    const syncing = makeOp({ id: 71, operation: 'update', status: 'syncing', createdAt: 1000, payload: { title: 'ignore' } })
    const pending = makeOp({ id: 72, operation: 'update', status: 'pending', createdAt: 1100, payload: { title: 'keep' } })
    const completed = makeOp({ id: 73, operation: 'update', status: 'completed', createdAt: 1200, payload: { title: 'ignore-2' } })

    writeQueueMocks.getOperationsForEntity.mockResolvedValue([syncing, pending, completed])

    const result = await coalesceOperationsForEntity('task', 'task-1')

    expect(result).toEqual({
      operation: pending,
      mergedOperationIds: [],
      description: 'No coalescing needed'
    })
    expect(writeQueueMocks.deleteOperation).not.toHaveBeenCalled()
    expect(writeQueueMocks.updateOperation).not.toHaveBeenCalled()
  })

  it('when multiple deletes exist, keeps the earliest delete after sorting and removes the rest', async () => {
    const update = makeOp({ id: 81, operation: 'update', createdAt: 1000, payload: { title: 'A' } })
    const firstDelete = makeOp({ id: 82, operation: 'delete', createdAt: 1100, payload: {} })
    const secondDelete = makeOp({ id: 83, operation: 'delete', createdAt: 1200, payload: {} })

    writeQueueMocks.getOperationsForEntity.mockResolvedValue([secondDelete, update, firstDelete])

    const result = await coalesceOperationsForEntity('task', 'task-1')

    expect(result.operation).toEqual(firstDelete)
    expect(result.mergedOperationIds).toEqual([81, 83])
    expect(result.description).toBe('Merged 2 operations into delete')
    expect(writeQueueMocks.deleteOperation).toHaveBeenCalledTimes(2)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(1, 81)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(2, 83)
    expect(writeQueueMocks.updateOperation).not.toHaveBeenCalled()
  })

  it('merges failed and pending updates into create while ignoring syncing updates', async () => {
    const create = makeOp({ id: 91, operation: 'create', status: 'pending', createdAt: 1000, payload: { title: 'initial' } })
    const failedUpdate = makeOp({ id: 92, operation: 'update', status: 'failed', createdAt: 1100, payload: { notes: 'keep' } })
    const syncingUpdate = makeOp({ id: 93, operation: 'update', status: 'syncing', createdAt: 1200, payload: { notes: 'ignore' } })
    const pendingUpdate = makeOp({ id: 94, operation: 'update', status: 'pending', createdAt: 1300, payload: { done: true } })

    writeQueueMocks.getOperationsForEntity.mockResolvedValue([create, failedUpdate, syncingUpdate, pendingUpdate])

    const result = await coalesceOperationsForEntity('task', 'task-1')

    expect(result.operation).toMatchObject({
      id: 91,
      operation: 'create',
      payload: {
        title: 'initial',
        notes: 'keep',
        done: true
      }
    })
    expect(result.mergedOperationIds).toEqual([92, 94])
    expect(result.description).toBe('Merged 2 updates into create')
    expect(writeQueueMocks.deleteOperation).toHaveBeenCalledTimes(2)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(1, 92)
    expect(writeQueueMocks.deleteOperation).toHaveBeenNthCalledWith(2, 94)
    expect(writeQueueMocks.updateOperation).toHaveBeenCalledTimes(1)
    expect(writeQueueMocks.updateOperation).toHaveBeenCalledWith(91, {
      payload: {
        title: 'initial',
        notes: 'keep',
        done: true
      }
    })
  })

  it('mergePayloads is shallow for nested objects and replaces arrays/nulls', () => {
    const merged = mergePayloads(
      {
        meta: {
          keep: true,
          nested: { a: 1 }
        },
        tags: ['a', 'b'],
        done: false
      },
      {
        meta: {
          nested: { b: 2 }
        },
        tags: ['c'],
        done: null
      }
    )

    expect(merged).toEqual({
      meta: {
        keep: true,
        nested: { b: 2 }
      },
      tags: ['c'],
      done: null
    })
  })

  it('coalesceAllOperations groups by entity and omits entities that cancel out', async () => {
    const solo = makeOp({ id: 101, entityId: 'task-solo', operation: 'update', status: 'pending', payload: { title: 'solo' }, createdAt: 1000 })
    const mergeA = makeOp({ id: 102, entityId: 'task-merge', operation: 'update', status: 'pending', payload: { title: 'A' }, createdAt: 1000 })
    const mergeB = makeOp({ id: 103, entityId: 'task-merge', operation: 'update', status: 'pending', payload: { description: 'B' }, createdAt: 1100 })
    const cancelCreate = makeOp({ id: 104, entityId: 'task-cancel', operation: 'create', status: 'pending', payload: { title: 'new' }, createdAt: 1000 })
    const cancelDelete = makeOp({ id: 105, entityId: 'task-cancel', operation: 'delete', status: 'pending', payload: {}, createdAt: 1200 })

    writeQueueMocks.getOperationsForEntity.mockImplementation(async (_entityType: string, entityId: string) => {
      if (entityId === 'task-merge') return [mergeA, mergeB]
      if (entityId === 'task-cancel') return [cancelCreate, cancelDelete]
      return []
    })

    const result = await coalesceAllOperations([solo, mergeA, mergeB, cancelCreate, cancelDelete])

    expect(result.size).toBe(2)
    expect(result.get('task:task-solo')).toEqual(solo)
    expect(result.get('task:task-merge')).toMatchObject({
      id: 102,
      operation: 'update',
      payload: {
        title: 'A',
        description: 'B'
      }
    })
    expect(result.has('task:task-cancel')).toBe(false)
    expect(writeQueueMocks.getOperationsForEntity).toHaveBeenCalledTimes(2)
    expect(writeQueueMocks.getOperationsForEntity).toHaveBeenNthCalledWith(1, 'task', 'task-merge')
    expect(writeQueueMocks.getOperationsForEntity).toHaveBeenNthCalledWith(2, 'task', 'task-cancel')
  })
})
