import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildDeviceSyncReceipt } from '@/services/sync/deviceSyncDiagnostics'
import { executeDeviceSyncRepair } from '@/services/sync/deviceSyncRepair'

describe('device sync diagnostics', () => {
  it('publishes enough queue identity to trace a missing task without task content', async () => {
    const receipt = await buildDeviceSyncReceipt({
      deviceId: '0d619ffe-a177-4f6a-b890-c38f985d91cb',
      runtime: 'pwa',
      appVersion: '1.4.318',
      status: 'synced',
      isOnline: true,
      lastSyncAt: 1_785_300_000_000,
      operations: [{
        id: 17,
        entityType: 'task',
        operation: 'create',
        entityId: 'task-local-1',
        payload: {
          title: 'לקנוצ פירות וירקות',
          description: 'private detail',
        },
        status: 'pending',
        retryCount: 0,
        createdAt: 1_785_300_100_000,
        lastError: 'private database error',
      }],
    })

    expect(receipt.queue).toEqual({
      pending: 1,
      syncing: 0,
      failed: 0,
      conflict: 0,
    })
    expect(receipt.operations).toEqual([{
      localSequence: 17,
      entityType: 'task',
      operation: 'create',
      entityId: 'task-local-1',
      status: 'pending',
      retryCount: 0,
      createdAt: '2026-07-29T04:41:40.000Z',
      lastAttemptAt: null,
      titleSha256: createHash('sha256').update('לקנוצ פירות וירקות').digest('hex'),
      errorCode: 'write',
    }])

    const serialized = JSON.stringify(receipt)
    expect(serialized).not.toContain('לקנוצ פירות וירקות')
    expect(serialized).not.toContain('private detail')
    expect(serialized).not.toContain('private database error')
  })

  it('reduces errors to stable codes and caps the published operation list', async () => {
    const operations = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      entityType: 'task' as const,
      operation: 'update' as const,
      entityId: `task-${index}`,
      payload: {},
      status: 'failed' as const,
      retryCount: 3,
      createdAt: index,
      lastError: 'JWT expired: private detail',
    }))

    const receipt = await buildDeviceSyncReceipt({
      deviceId: '0d619ffe-a177-4f6a-b890-c38f985d91cb',
      runtime: 'browser',
      appVersion: '1.4.318',
      status: 'error',
      isOnline: true,
      operations,
    })

    expect(receipt.operations).toHaveLength(20)
    expect(receipt.operations[0].errorCode).toBe('auth')
    expect(receipt.queue.failed).toBe(30)
  })

  it('keeps concurrent receipt projections bounded and redacted under stress', async () => {
    const receipts = await Promise.all(Array.from({ length: 100 }, (_, deviceIndex) => buildDeviceSyncReceipt({
      deviceId: `0d619ffe-a177-4f6a-b890-c38f985d9${String(deviceIndex).padStart(3, '0')}`,
      runtime: deviceIndex % 2 === 0 ? 'pwa' : 'electron',
      appVersion: '1.4.341',
      status: 'pending',
      isOnline: true,
      operations: Array.from({ length: 25 }, (_, operationIndex) => ({
        id: operationIndex,
        entityType: 'task' as const,
        operation: 'update' as const,
        entityId: `task-${deviceIndex}-${operationIndex}`,
        payload: { title: `private-${deviceIndex}-${operationIndex}` },
        status: 'pending' as const,
        retryCount: 0,
        createdAt: Date.now(),
      })),
    })))

    expect(receipts).toHaveLength(100)
    expect(receipts.every(receipt => receipt.operations.length <= 20)).toBe(true)
    expect(JSON.stringify(receipts)).not.toContain('private-')
  })
})

describe('device sync repair', () => {
  it('retries only the entity ids requested for this device', async () => {
    const retried: string[][] = []

    const result = await executeDeviceSyncRepair({
      entityIds: ['task-a', 'task-b'],
      requestedAt: '2026-07-29T13:30:00.000Z',
      completedAt: null,
    }, async entityIds => {
      retried.push(entityIds)
    })

    expect(result).toBe('completed')
    expect(retried).toEqual([['task-a', 'task-b']])
  })

  it('does not rerun an already completed repair request', async () => {
    let calls = 0

    const result = await executeDeviceSyncRepair({
      entityIds: ['task-a'],
      requestedAt: '2026-07-29T13:30:00.000Z',
      completedAt: '2026-07-29T13:31:00.000Z',
    }, async () => {
      calls += 1
    })

    expect(result).toBe('skipped')
    expect(calls).toBe(0)
  })

  it('marks a failed repair attempt handled instead of hot-looping it', async () => {
    const result = await executeDeviceSyncRepair({
      entityIds: ['task-a'],
      requestedAt: '2026-07-29T13:30:00.000Z',
      completedAt: null,
    }, async () => {
      throw new Error('private server failure')
    })

    expect(result).toBe('failed')
  })
})
