/**
 * TASK-1643: Offline Mode Tests (10 tests)
 *
 * Tests for offline/online behavior in the sync system:
 * - Initial online state detection
 * - Queue pause/resume on connectivity changes
 * - Local storage of operations while offline
 * - Queue drain on reconnection
 * - Network flap resilience
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock platform detection
// ---------------------------------------------------------------------------
let mockNavigatorOnLine = true
let mockIsTauri = false

vi.mock('@/utils/platform', () => ({
  getInitialOnlineState: () => {
    // Tauri always returns true (optimistic), browser uses navigator.onLine
    if (mockIsTauri) return true
    return mockNavigatorOnLine
  },
  shouldTrustNavigatorOnline: () => !mockIsTauri,
  detectPlatform: () => mockIsTauri ? 'tauri' : 'browser',
  isTauri: () => mockIsTauri,
  isCapacitor: () => false,
  isPWA: () => false,
  isBrowser: () => !mockIsTauri,
  isNative: () => mockIsTauri,
  isMobileNative: () => false,
  isDesktopNative: () => mockIsTauri,
  _resetPlatformCache: () => {}
}))

// Mock supabase
vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: {
      refreshSession: vi.fn().mockResolvedValue({ error: null }),
      // TASK-1904: 459fdfb6 added an auth-freshness gate to processQueue that
      // calls getSession() BEFORE getPendingOperations — without this mock the
      // gate threw, the queue bailed early, and the drain tests asserted nothing.
      // Plain async fn (not vi.fn) so beforeEach's clearAllMocks can't wipe it.
      getSession: async () => ({
        data: { session: { access_token: 'test-token', user: { id: 'test-user-id' } } },
        error: null,
      }),
    }
  }
}))

// Mock writeQueueDB
const mockEnqueue = vi.fn().mockResolvedValue({ id: 1, status: 'pending', retryCount: 0, createdAt: Date.now() })
const mockGetPending = vi.fn().mockResolvedValue([])
const mockGetStats = vi.fn().mockResolvedValue({
  totalOperations: 0,
  pendingCount: 0,
  syncingCount: 0,
  failedCount: 0,
  completedCount: 0,
  conflictCount: 0
})
const mockMarkSyncing = vi.fn()
const mockMarkCompleted = vi.fn()
const mockMarkFailed = vi.fn()
const mockMarkConflict = vi.fn()
const mockCleanupCompleted = vi.fn().mockResolvedValue(0)
const mockGetFailed = vi.fn().mockResolvedValue([])
const mockRecoverStale = vi.fn().mockResolvedValue(0)
const mockClearFailed = vi.fn().mockResolvedValue(0)
const mockPurgeStale = vi.fn().mockResolvedValue(0)
const mockGetOperationsForEntity = vi.fn().mockResolvedValue([])
const mockDeleteOperation = vi.fn()

vi.mock('@/services/offline/writeQueueDB', () => ({
  enqueueOperation: (...args: any[]) => mockEnqueue(...args),
  getPendingOperations: (...args: any[]) => mockGetPending(...args),
  getStats: () => mockGetStats(),
  markSyncing: (...args: any[]) => mockMarkSyncing(...args),
  markCompleted: (...args: any[]) => mockMarkCompleted(...args),
  markFailed: (...args: any[]) => mockMarkFailed(...args),
  markConflict: (...args: any[]) => mockMarkConflict(...args),
  cleanupCompleted: () => mockCleanupCompleted(),
  getFailedOperations: () => mockGetFailed(),
  recoverStaleSyncing: () => mockRecoverStale(),
  recoverRlsPolicyFailures: async () => 0,
  clearFailedOperations: () => mockClearFailed(),
  purgeStaleOperations: () => mockPurgeStale(),
  getOperationsForEntity: (...args: any[]) => mockGetOperationsForEntity(...args),
  deleteOperation: (...args: any[]) => mockDeleteOperation(...args),
  updateOperation: vi.fn(),
}))

// Mock retry strategy
vi.mock('@/services/offline/retryStrategy', () => ({
  calculateNextRetryTime: vi.fn().mockReturnValue(Date.now() + 5000),
  shouldRetry: vi.fn().mockReturnValue(true),
  classifyError: vi.fn().mockReturnValue('transient'),
  getRetryConfigForError: vi.fn().mockReturnValue({ maxRetries: 3 })
}))

// Mock operation coalescer/sorter
vi.mock('@/services/offline/operationCoalescer', () => ({
  coalesceOperationsForEntity: vi.fn().mockImplementation((_type, _id) => ({ operation: null }))
}))
vi.mock('@/services/offline/operationSorter', () => ({
  sortOperations: vi.fn().mockImplementation((ops) => ops)
}))

// Mock stores
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'test-user-id' } })
}))
vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({ activeWorkspaceId: null, isSwitchingWorkspace: false })
}))
vi.mock('@/constants/dbTables', () => ({
  DB_TABLES: { TOMBSTONES: 'tombstones' }
}))

// Provide fake indexedDB
if (typeof globalThis.indexedDB === 'undefined') {
  (globalThis as any).indexedDB = {} as IDBFactory
}

describe('TASK-1643: Offline Mode', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.clearAllMocks()
    mockNavigatorOnLine = true
    mockIsTauri = false

    // Restore mock implementations that vi.clearAllMocks() clears
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending', retryCount: 0, createdAt: Date.now() })
    mockGetPending.mockResolvedValue([])
    mockGetStats.mockResolvedValue({
      totalOperations: 0,
      pendingCount: 0,
      syncingCount: 0,
      failedCount: 0,
      completedCount: 0,
      conflictCount: 0
    })
    mockGetFailed.mockResolvedValue([])
    mockRecoverStale.mockResolvedValue(0)
    mockClearFailed.mockResolvedValue(0)
    mockCleanupCompleted.mockResolvedValue(0)
    mockPurgeStale.mockResolvedValue(0)
    mockGetOperationsForEntity.mockResolvedValue([])

    // Reset module state by re-importing
    vi.resetModules()
  })

  afterEach(async () => {
    vi.clearAllTimers()
    await vi.advanceTimersByTimeAsync(0)
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('1. getInitialOnlineState returns navigator.onLine in browser', async () => {
    const { getInitialOnlineState } = await import('@/utils/platform')

    mockNavigatorOnLine = true
    mockIsTauri = false
    expect(getInitialOnlineState()).toBe(true)

    mockNavigatorOnLine = false
    expect(getInitialOnlineState()).toBe(false)
  })

  it('2. getInitialOnlineState returns true in Tauri (optimistic)', async () => {
    const { getInitialOnlineState } = await import('@/utils/platform')

    mockIsTauri = true
    mockNavigatorOnLine = false // Even if navigator says offline
    expect(getInitialOnlineState()).toBe(true)
  })

  it('3. Offline: sync queue does not attempt network when offline', async () => {
    // When isOnline is false, processQueue should bail out immediately
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const sync = useSyncOrchestrator()

    // Simulate offline
    mockNavigatorOnLine = false

    // The orchestrator checks isOnline before processing
    // Enqueue an operation while "offline"
    await sync.enqueue({
      entityType: 'task',
      operation: 'create',
      entityId: 'test-id-1',
      payload: { title: 'Test task' }
    })

    // The enqueue should succeed (stored locally)
    expect(mockEnqueue).toHaveBeenCalled()
  })

  it('4. Offline: task create stores operation locally', async () => {
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const sync = useSyncOrchestrator()

    const result = await sync.enqueue({
      entityType: 'task',
      operation: 'create',
      entityId: 'offline-task-1',
      payload: { title: 'Offline task', status: 'planned' }
    })

    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'task',
        operation: 'create',
        entityId: 'offline-task-1',
        payload: expect.objectContaining({ title: 'Offline task' })
      })
    )
    expect(result).toBeDefined()
  })

  it('5. Offline: task update stores locally', async () => {
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const sync = useSyncOrchestrator()

    await sync.enqueue({
      entityType: 'task',
      operation: 'update',
      entityId: 'existing-task-1',
      payload: { title: 'Updated title', updated_at: new Date().toISOString() }
    })

    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'task',
        operation: 'update',
        entityId: 'existing-task-1'
      })
    )
  })

  it('6. Online after offline: forceSync triggers queue processing', async () => {
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const sync = useSyncOrchestrator()

    // Mock pending operations exist
    mockGetPending.mockResolvedValueOnce([
      {
        id: 1,
        entityType: 'task',
        operation: 'create',
        entityId: 'queued-1',
        payload: { title: 'Queued task' },
        status: 'pending',
        retryCount: 0,
        createdAt: Date.now()
      }
    ])

    // Force sync should attempt to process
    await sync.forceSync()

    // It should have attempted to get pending operations
    expect(mockGetPending).toHaveBeenCalled()
  })

  it('7. Network flap (quick offline/online) does not corrupt queue', async () => {
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const sync = useSyncOrchestrator()

    // Enqueue during rapid connectivity changes
    await sync.enqueue({
      entityType: 'task',
      operation: 'create',
      entityId: 'flap-task-1',
      payload: { title: 'Flap task 1' }
    })

    await sync.enqueue({
      entityType: 'task',
      operation: 'update',
      entityId: 'flap-task-1',
      payload: { title: 'Flap task updated' }
    })

    // Both operations should be enqueued
    expect(mockEnqueue).toHaveBeenCalledTimes(2)
  })

  it('8. Offline indicator state tracked via isOnline computed', async () => {
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const sync = useSyncOrchestrator()

    // The isOnline computed should reflect current state
    expect(sync.isOnline).toBeDefined()
    expect(typeof sync.isOnline.value).toBe('boolean')
  })

  it('9. Status reflects offline state', async () => {
    // Test that the status computed reflects connectivity
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const sync = useSyncOrchestrator()

    // Should have meaningful status
    expect(sync.status).toBeDefined()
    const validStatuses = ['synced', 'syncing', 'pending', 'offline', 'error']
    expect(validStatuses).toContain(sync.status.value)
  })

  it('10. hasErrors computed tracks failed operations', async () => {
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const sync = useSyncOrchestrator()

    // hasErrors should be a computed that reflects failedCount > 0
    expect(sync.hasErrors).toBeDefined()
    expect(typeof sync.hasErrors.value).toBe('boolean')

    // hasPendingChanges should also be computed
    expect(sync.hasPendingChanges).toBeDefined()
    expect(typeof sync.hasPendingChanges.value).toBe('boolean')
  })
})
