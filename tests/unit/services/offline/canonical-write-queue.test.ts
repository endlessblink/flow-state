import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import type { CanonicalTaskPatchReceipt } from '@/types/sync'
import {
  clearAll,
  clearFailedOperations,
  cleanupCompleted,
  completeCanonicalOperation,
  completeLegacyTaskOperation,
  enqueueOperation,
  getCanonicalReceipt,
  getLatestCanonicalCheckpointForEntity,
  getLatestCanonicalReceiptForEntity,
  getWriteQueueDB,
  getConflicts,
  hasEarlierUnresolvedOperation,
  hasLaterUnresolvedOperation,
  markFailed,
  markConflict,
  markSyncing,
  purgeStaleOperations,
  recoverStaleSyncing,
  resolveConflictRetry,
} from '@/services/offline/writeQueueDB'

const receipt: CanonicalTaskPatchReceipt = {
  contractVersion: 'task-v1',
  operationId: 'web:durable-1',
  source: 'web-pwa',
  entityType: 'task',
  action: 'patch',
  entityId: 'task-1',
  canonicalRevision: 2,
  canonicalUpdatedAt: '2026-07-13T10:00:00Z',
  changeSequence: 2,
  replayed: false,
  committedAt: '2026-07-13T10:00:00Z',
  readBack: {
    id: 'task-1', title: 'Changed', description: '', priority: null, dueDate: null,
    progress: 0, status: 'todo', isDeleted: false, workspaceId: null,
    canonicalRevision: 2, canonicalUpdatedAt: '2026-07-13T10:00:00Z',
  },
  readBackHash: 'a'.repeat(64),
}

afterEach(() => clearAll())

describe('canonical write queue durability', () => {
  it('migrates existing v4 receipts to scoped compound identity without losing proof', async () => {
    const legacy = new Dexie('FlowStateSyncQueue')
    legacy.version(4).stores({
      operations: '++id, status, [entityType+entityId], createdAt, nextRetryAt, userId, workspaceId',
      conflicts: '++id, [operation.entityType+operation.entityId], detectedAt',
      metadata: 'key',
      canonicalReceipts: 'operationId, [scopeKey+entityId], scopeKey, entityId, changeSequence',
    })
    await legacy.table('canonicalReceipts').put({ ...receipt, scopeKey: 'user-1:personal' })
    legacy.close()

    expect(await getCanonicalReceipt(receipt.operationId, 'user-1', null)).toEqual(receipt)
    expect(await getLatestCanonicalCheckpointForEntity('task-1', 'user-1', null)).toEqual({
      scopeKey: 'user-1:personal',
      entityId: 'task-1',
      canonicalRevision: 2,
      operationId: receipt.operationId,
    })
  })

  it('atomically stores canonical proof before completing the queue row', async () => {
    const op = await enqueueOperation({
      entityType: 'task',
      operation: 'update',
      entityId: 'task-1',
      payload: { title: 'Changed' },
      userId: 'user-1',
      workspaceId: null,
      canonicalTaskPatch: {
        contractVersion: 'task-v1',
        operationId: receipt.operationId,
        baseRevision: 1,
        patch: { title: 'Changed' },
        phase: 'previewed',
        previewDigest: 'b'.repeat(64),
        previewExpiresAt: '2026-07-13T10:15:00Z',
      },
    })

    await completeCanonicalOperation(op.id!, receipt)

    expect(await getCanonicalReceipt(receipt.operationId, 'user-1', null)).toEqual(receipt)
    expect(await getWriteQueueDB().operations.get(op.id!)).toMatchObject({
      status: 'completed',
      canonicalTaskPatch: { phase: 'committed', receipt },
    })
    expect(await getLatestCanonicalCheckpointForEntity('task-1', 'user-1', null)).toEqual({
      scopeKey: 'user-1:personal',
      entityId: 'task-1',
      canonicalRevision: 2,
      operationId: receipt.operationId,
    })
  })

  it('atomically completes a legacy task update and records its scoped canonical revision', async () => {
    const op = await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-legacy',
      payload: { status: 'done' }, userId: 'user-1', workspaceId: 'workspace-1',
    })

    await completeLegacyTaskOperation(op.id!, 7)

    expect(await getWriteQueueDB().operations.get(op.id!)).toMatchObject({ status: 'completed' })
    expect(await getLatestCanonicalCheckpointForEntity('task-legacy', 'user-1', 'workspace-1')).toEqual({
      scopeKey: 'user-1:workspace-1',
      entityId: 'task-legacy',
      canonicalRevision: 7,
      operationId: `legacy:${op.id}`,
    })
  })

  it('rolls back legacy completion when its canonical revision is invalid', async () => {
    const op = await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-legacy',
      payload: { status: 'done' }, userId: 'user-1', workspaceId: null,
    })

    await expect(completeLegacyTaskOperation(op.id!, 0)).rejects.toThrow('revision')

    expect(await getWriteQueueDB().operations.get(op.id!)).toMatchObject({ status: 'pending' })
    expect(await getLatestCanonicalCheckpointForEntity('task-legacy', 'user-1', null)).toBeUndefined()
  })

  it('keeps canonical proof after completed queue rows are cleaned up', async () => {
    const op = await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-1', payload: { title: 'Changed' },
      userId: 'user-1', workspaceId: null,
      canonicalTaskPatch: {
        contractVersion: 'task-v1', operationId: receipt.operationId, baseRevision: 1,
        patch: { title: 'Changed' }, phase: 'previewed',
      },
    })
    await completeCanonicalOperation(op.id!, receipt)

    expect(await cleanupCompleted()).toBe(1)
    expect(await getWriteQueueDB().operations.get(op.id!)).toBeUndefined()
    expect(await getCanonicalReceipt(receipt.operationId, 'user-1', null)).toEqual(receipt)
  })

  it('rejects a mismatched receipt without changing either durable table', async () => {
    const op = await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-1', payload: { title: 'Changed' },
      userId: 'user-1', workspaceId: null,
      canonicalTaskPatch: {
        contractVersion: 'task-v1', operationId: 'web:expected', baseRevision: 1,
        patch: { title: 'Changed' }, phase: 'previewed',
      },
    })

    await expect(completeCanonicalOperation(op.id!, receipt)).rejects.toThrow('does not match')

    expect(await getCanonicalReceipt(receipt.operationId, 'user-1', null)).toBeUndefined()
    expect(await getWriteQueueDB().operations.get(op.id!)).toMatchObject({ status: 'pending' })
  })

  it('never purges unresolved canonical intent by age', async () => {
    const id = await getWriteQueueDB().operations.add({
      entityType: 'task',
      operation: 'update',
      entityId: 'task-old',
      payload: { title: 'Old but unresolved' },
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now() - 48 * 60 * 60 * 1000,
      canonicalTaskPatch: {
        contractVersion: 'task-v1',
        operationId: 'web:old',
        baseRevision: 1,
        patch: { title: 'Old but unresolved' },
        phase: 'queued',
      },
    })

    expect(await purgeStaleOperations()).toBe(0)
    expect(await getWriteQueueDB().operations.get(id)).toBeDefined()
  })

  it.each(['create', 'update', 'delete'] as const)(
    'never purges an unresolved legacy task %s by age',
    async operation => {
      const id = await getWriteQueueDB().operations.add({
        entityType: 'task',
        operation,
        entityId: `task-old-${operation}`,
        payload: operation === 'delete' ? { id: `task-old-${operation}` } : { title: 'Still unsynced' },
        status: 'pending',
        retryCount: 0,
        createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
        userId: 'user-1',
        workspaceId: null,
      })

      expect(await purgeStaleOperations(0)).toBe(0)
      expect(await getWriteQueueDB().operations.get(id)).toBeDefined()
    },
  )

  it('requeues a crash-abandoned write after the conservative stale timeout', async () => {
    const operation = await enqueueOperation({
      entityType: 'task',
      operation: 'update',
      entityId: 'task-crash-abandoned',
      payload: { title: 'Must survive renderer crash' },
      userId: 'user-1',
      workspaceId: null,
    })
    await markSyncing(operation.id!)
    await getWriteQueueDB().operations.update(operation.id!, {
      lastAttemptAt: Date.now() - 60_001,
    })

    expect(await recoverStaleSyncing()).toBe(1)
    await expect(getWriteQueueDB().operations.get(operation.id!)).resolves.toMatchObject({
      status: 'pending',
      retryCount: 1,
    })
  })

  it('does not immediately steal an unmarked in-flight write from an older app window', async () => {
    const operation = await enqueueOperation({
      entityType: 'task',
      operation: 'update',
      entityId: 'task-legacy-window',
      payload: { title: 'Older window may still be submitting' },
      userId: 'user-1',
      workspaceId: null,
    })
    await getWriteQueueDB().operations.update(operation.id!, {
      status: 'syncing',
      lastAttemptAt: Date.now() - 1,
    })

    expect(await recoverStaleSyncing(0)).toBe(0)
    await expect(getWriteQueueDB().operations.get(operation.id!)).resolves.toMatchObject({
      status: 'syncing',
      retryCount: 0,
    })
  })

  it('does not steal an in-flight mixed-version claim before the stale timeout', async () => {
    const operation = await enqueueOperation({
      entityType: 'task',
      operation: 'update',
      entityId: 'task-mixed-version-window',
      payload: { title: 'Mixed version claim' },
      userId: 'user-1',
      workspaceId: null,
    })
    await markSyncing(operation.id!)
    const currentClaim = await getWriteQueueDB().operations.get(operation.id!)
    await getWriteQueueDB().operations.update(operation.id!, {
      status: 'syncing',
      lastAttemptAt: currentClaim?.lastAttemptAt ?? Date.now(),
    })

    expect(await recoverStaleSyncing(0)).toBe(0)
    await expect(getWriteQueueDB().operations.get(operation.id!)).resolves.toMatchObject({
      status: 'syncing',
      retryCount: 0,
    })
  })

  it('does not recover a fallback-platform claim before the stale timeout', async () => {
    const operation = await enqueueOperation({
      entityType: 'task',
      operation: 'update',
      entityId: 'task-no-web-locks',
      payload: { title: 'Fallback claim' },
      userId: 'user-1',
      workspaceId: null,
    })
    await markSyncing(operation.id!)

    expect(await recoverStaleSyncing(0)).toBe(0)
  })

  it('blocks a successor while an earlier failed operation waits for its retry time', async () => {
    const first = await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-ordered', payload: { title: 'First' },
      userId: 'user-1', workspaceId: null,
    })
    const second = await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-ordered', payload: { title: 'Second' },
      userId: 'user-1', workspaceId: null,
      canonicalTaskPatch: {
        contractVersion: 'task-v1', operationId: 'web:second', baseRevision: 1,
        patch: { title: 'Second' }, phase: 'queued',
      },
    })
    await markFailed(first.id!, 'offline', Date.now() + 60_000)

    expect(await hasEarlierUnresolvedOperation(second)).toBe(true)
  })

  it('reports a later unresolved operation so predecessor projection cannot overwrite it', async () => {
    const first = await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-optimistic', payload: { title: 'First' },
      userId: 'user-1', workspaceId: null,
    })
    await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-optimistic', payload: { title: 'Second' },
      userId: 'user-1', workspaceId: null,
    })

    expect(await hasLaterUnresolvedOperation(first)).toBe(true)
  })

  it('selects the latest predecessor by canonical sequence instead of client clock order', async () => {
    const queueAndComplete = async (nextReceipt: CanonicalTaskPatchReceipt, userId = 'user-1') => {
      const op = await enqueueOperation({
        entityType: 'task',
        operation: 'update',
        entityId: nextReceipt.entityId,
        payload: { title: nextReceipt.operationId },
        userId,
        workspaceId: nextReceipt.readBack.workspaceId,
        canonicalTaskPatch: {
          contractVersion: 'task-v1',
          operationId: nextReceipt.operationId,
          baseRevision: nextReceipt.canonicalRevision - 1,
          patch: { title: nextReceipt.operationId },
          phase: 'previewed',
        },
      })
      await completeCanonicalOperation(op.id!, nextReceipt)
    }
    const laterSequence = {
      ...receipt,
      operationId: 'web:durable-2',
      canonicalRevision: 3,
      changeSequence: 3,
      committedAt: '2026-07-13T09:00:00Z',
      readBack: { ...receipt.readBack, canonicalRevision: 3 },
    }
    await queueAndComplete(receipt)
    await queueAndComplete(laterSequence)

    expect((await getLatestCanonicalReceiptForEntity('task-1', 'user-1', null))?.operationId).toBe('web:durable-2')
  })

  it('never uses another signed-user scope as a canonical predecessor', async () => {
    const queueAndComplete = async (nextReceipt: CanonicalTaskPatchReceipt, userId: string) => {
      const op = await enqueueOperation({
        entityType: 'task', operation: 'update', entityId: nextReceipt.entityId,
        payload: { title: nextReceipt.operationId }, userId, workspaceId: null,
        canonicalTaskPatch: {
          contractVersion: 'task-v1', operationId: nextReceipt.operationId,
          baseRevision: nextReceipt.canonicalRevision - 1,
          patch: { title: nextReceipt.operationId }, phase: 'previewed',
        },
      })
      await completeCanonicalOperation(op.id!, nextReceipt)
    }
    await queueAndComplete(receipt, 'user-1')
    await queueAndComplete({
      ...receipt,
      operationId: 'web:other-user',
      canonicalRevision: 99,
      changeSequence: 99,
      readBack: { ...receipt.readBack, canonicalRevision: 99 },
    }, 'user-2')

    expect((await getLatestCanonicalReceiptForEntity('task-1', 'user-1', null))?.operationId).toBe(receipt.operationId)
  })

  it('retains the same operation ID independently for each signed-user scope', async () => {
    const queueAndComplete = async (userId: string, nextReceipt: CanonicalTaskPatchReceipt) => {
      const op = await enqueueOperation({
        entityType: 'task', operation: 'update', entityId: nextReceipt.entityId,
        payload: { title: nextReceipt.readBack.title }, userId, workspaceId: null,
        canonicalTaskPatch: {
          contractVersion: 'task-v1', operationId: nextReceipt.operationId,
          baseRevision: 1, patch: { title: nextReceipt.readBack.title }, phase: 'previewed',
        },
      })
      await completeCanonicalOperation(op.id!, nextReceipt)
    }
    const other = {
      ...receipt,
      readBack: { ...receipt.readBack, title: 'Other user' },
      readBackHash: 'c'.repeat(64),
    }
    await queueAndComplete('user-1', receipt)
    await queueAndComplete('user-2', other)

    expect((await getCanonicalReceipt(receipt.operationId, 'user-1', null))?.readBack.title).toBe('Changed')
    expect((await getCanonicalReceipt(receipt.operationId, 'user-2', null))?.readBack.title).toBe('Other user')
  })

  it('isolates canonical predecessors between workspaces owned by the same user', async () => {
    const queueAndComplete = async (workspaceId: string, sequence: number) => {
      const nextReceipt = {
        ...receipt,
        operationId: `web:${workspaceId}`,
        canonicalRevision: sequence,
        changeSequence: sequence,
        readBack: { ...receipt.readBack, workspaceId, canonicalRevision: sequence },
      }
      const op = await enqueueOperation({
        entityType: 'task', operation: 'update', entityId: receipt.entityId,
        payload: { title: workspaceId }, userId: 'user-1', workspaceId,
        canonicalTaskPatch: {
          contractVersion: 'task-v1', operationId: nextReceipt.operationId,
          baseRevision: sequence - 1, patch: { title: workspaceId }, phase: 'previewed',
        },
      })
      await completeCanonicalOperation(op.id!, nextReceipt)
    }
    await queueAndComplete('workspace-a', 2)
    await queueAndComplete('workspace-b', 99)

    expect((await getLatestCanonicalReceiptForEntity('task-1', 'user-1', 'workspace-a'))?.operationId).toBe('web:workspace-a')
    expect((await getLatestCanonicalReceiptForEntity('task-1', 'user-1', 'workspace-b'))?.operationId).toBe('web:workspace-b')
  })

  it('generic failed-write cleanup preserves canonical intent and its conflict evidence', async () => {
    const op = await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-1',
      payload: { title: 'Keep me' }, userId: 'user-1', workspaceId: null,
      canonicalTaskPatch: {
        contractVersion: 'task-v1', operationId: 'web:conflict', baseRevision: 1,
        patch: { title: 'Keep me' }, phase: 'queued',
      },
    })
    await markConflict(op.id!, 2)

    expect(await clearFailedOperations()).toBe(0)
    expect(await getWriteQueueDB().operations.get(op.id!)).toBeDefined()
    expect(await getConflicts()).toHaveLength(1)
  })

  it('rebases only an unpreviewed canonical conflict when the user explicitly retries it', async () => {
    const op = await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-1', payload: { title: 'Retry' },
      userId: 'user-1', workspaceId: null,
      canonicalTaskPatch: {
        contractVersion: 'task-v1', operationId: 'web:retry', baseRevision: 1,
        patch: { title: 'Retry' }, phase: 'queued',
      },
    })
    await markConflict(op.id!, 4)
    const [conflict] = await getConflicts()

    await resolveConflictRetry(conflict.id!, 4)

    expect(await getWriteQueueDB().operations.get(op.id!)).toMatchObject({
      status: 'pending',
      canonicalTaskPatch: { operationId: 'web:retry', baseRevision: 4, phase: 'queued' },
    })
  })

  it('refuses to mutate a canonical request after its preview binding was issued', async () => {
    const op = await enqueueOperation({
      entityType: 'task', operation: 'update', entityId: 'task-1', payload: { title: 'Bound' },
      userId: 'user-1', workspaceId: null,
      canonicalTaskPatch: {
        contractVersion: 'task-v1', operationId: 'web:bound', baseRevision: 1,
        patch: { title: 'Bound' }, phase: 'previewed', previewDigest: 'b'.repeat(64),
        previewExpiresAt: '2026-07-13T10:15:00Z',
      },
    })
    await markConflict(op.id!, 4)
    const [conflict] = await getConflicts()

    await expect(resolveConflictRetry(conflict.id!, 4)).rejects.toThrow('preview')

    expect(await getWriteQueueDB().operations.get(op.id!)).toMatchObject({
      status: 'conflict', canonicalTaskPatch: { baseRevision: 1, phase: 'previewed' },
    })
    expect(await getConflicts()).toHaveLength(1)
  })
})
