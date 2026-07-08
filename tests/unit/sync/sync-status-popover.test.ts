import { mount, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

const AUTH_EXPIRED_MESSAGE = 'Sign-in expired — changes are kept on this device and will sync after you sign in again'

describe('sync status auth-error watchdog', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(async () => {
    setActivePinia(createPinia())
    document.body.innerHTML = ''

    const { __resetWriteHealthForTests, setWriteHealthNotifier } = await import('@/composables/sync/writeHealth')
    const { syncState } = await import('@/composables/sync/useSyncOrchestrator')

    __resetWriteHealthForTests()
    setWriteHealthNotifier(() => {})
    syncState.value = {
      status: 'synced',
      pendingCount: 0,
      failedCount: 0,
      lastSyncAt: undefined,
      lastError: undefined,
      isOnline: true,
      failedOperations: [],
    }
  })

  afterEach(async () => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.clearAllMocks()

    const { __resetWriteHealthForTests } = await import('@/composables/sync/writeHealth')
    __resetWriteHealthForTests()
  })

  it('does not expose stale auth-gate writeHealth as a zero-item Sync Errors popover', async () => {
    const { reportWriteFailure } = await import('@/composables/sync/writeHealth')
    const { useSyncStatusStore } = await import('@/stores/syncStatus')

    reportWriteFailure('queueFlushAuthGate', AUTH_EXPIRED_MESSAGE, 1_000)
    reportWriteFailure('queueFlushAuthGate', AUTH_EXPIRED_MESSAGE, 2_000)

    const store = useSyncStatusStore()

    expect(store.failedOperations).toHaveLength(0)
    expect(store.failedCount).toBe(0)
    expect(store.lastError ?? '').not.toMatch(/sign in again/i)
    expect(store.hasErrors).toBe(false)
  })

  it('renders an empty-state popover instead of a sign-in-expired banner when there are zero errors', async () => {
    const { default: SyncErrorPopover } = await import('@/components/sync/SyncErrorPopover.vue')

    wrapper = mount(SyncErrorPopover, {
      attachTo: document.body,
      props: {
        errors: [],
        lastError: AUTH_EXPIRED_MESSAGE,
      },
      global: {
        stubs: {
          Teleport: false,
        },
      },
    })
    await nextTick()

    expect(document.body.textContent).toContain('0 errors')
    expect(document.body.textContent).not.toContain('Sign-in expired')
    expect(document.body.textContent).not.toContain('sign in again')
    expect(document.body.textContent).toContain('No failed sync operations')
  })
})
