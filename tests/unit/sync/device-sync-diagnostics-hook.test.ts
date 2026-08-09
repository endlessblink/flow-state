import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  publishDeviceSyncReceipt,
  consumeDeviceSyncRepair,
  forceSync,
  onScopeDispose,
  watch,
} = vi.hoisted(() => ({
  publishDeviceSyncReceipt: vi.fn().mockResolvedValue(undefined),
  consumeDeviceSyncRepair: vi.fn().mockResolvedValue(undefined),
  forceSync: vi.fn().mockResolvedValue(undefined),
  onScopeDispose: vi.fn(),
  watch: vi.fn((_sources: unknown, callback: () => void, options?: { immediate?: boolean }) => {
    if (options?.immediate) callback()
    return vi.fn()
  }),
}))

vi.mock('vue', () => ({ onScopeDispose, watch }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
    canSyncRemotely: true,
  }),
}))
vi.mock('@/stores/syncStatus', () => ({
  useSyncStatusStore: () => ({
    status: 'pending',
    isOnline: true,
    lastSyncAt: undefined,
    pendingCount: 1,
    failedCount: 0,
  }),
}))
vi.mock('@/services/sync/deviceSyncDiagnostics', () => ({ publishDeviceSyncReceipt }))
vi.mock('@/services/sync/deviceSyncRepair', () => ({ consumeDeviceSyncRepair }))
vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    forceSync,
    retryFailedByEntityIds: vi.fn(),
  }),
}))

import { useDeviceSyncDiagnostics } from '@/composables/sync/useDeviceSyncDiagnostics'

describe('device sync diagnostics heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    forceSync.mockResolvedValue(undefined)
    publishDeviceSyncReceipt.mockResolvedValue(undefined)
    consumeDeviceSyncRepair.mockResolvedValue(undefined)
  })

  it('forces a durable queue pass before publishing the receipt', async () => {
    useDeviceSyncDiagnostics()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(forceSync).toHaveBeenCalledTimes(1)
    expect(publishDeviceSyncReceipt).toHaveBeenCalledTimes(1)
    expect(forceSync.mock.invocationCallOrder[0]).toBeLessThan(
      publishDeviceSyncReceipt.mock.invocationCallOrder[0],
    )
  })

  it('publishes a receipt when the queue pass fails', async () => {
    forceSync.mockRejectedValueOnce(new Error('queue unavailable'))

    useDeviceSyncDiagnostics()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(forceSync).toHaveBeenCalledTimes(1)
    expect(publishDeviceSyncReceipt).toHaveBeenCalledTimes(1)
  })
})
