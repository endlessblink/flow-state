import { afterEach, describe, expect, it, vi } from 'vitest'

const originalIndexedDB = globalThis.indexedDB

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: originalIndexedDB })
})

describe('canonical queue durability without IndexedDB', () => {
  it('rejects canonical enqueue instead of returning a fake durable row', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined })
    vi.resetModules()
    vi.doMock('@/services/auth/supabase', () => ({ supabase: null }))
    vi.doMock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'user-1' } }) }))
    vi.doMock('@/stores/workspace', () => ({
      useWorkspaceStore: () => ({ activeWorkspaceId: null, isSwitchingWorkspace: false }),
    }))
    vi.doMock('@/utils/platform', () => ({
      getInitialOnlineState: () => false,
      detectPlatform: () => 'browser',
      isTauri: () => false,
    }))
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')

    await expect(useSyncOrchestrator().enqueue({
      entityType: 'task',
      operation: 'update',
      entityId: 'task-1',
      payload: { title: 'Changed' },
      canonicalTaskPatch: {
        contractVersion: 'task-v1', operationId: 'web:no-idb', baseRevision: 1,
        patch: { title: 'Changed' }, phase: 'queued',
      },
    })).rejects.toThrow('IndexedDB')
  })
})
