/**
 * TASK-1871 regression: the beforeunload "unsaved changes" guard must be SKIPPED
 * in Electron. Otherwise it blocks the window from closing whenever there are
 * pending sync changes/errors, and — with no Quit menu fallback — the desktop app
 * cannot quit at all (the recurring "can't quit FlowState" bug). It's safe to skip
 * because the offline-first queue persists pending writes across restarts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

let isElectronValue = false
vi.mock('@/utils/platform', () => ({
  isElectron: () => isElectronValue,
}))
vi.mock('@/stores/syncStatus', () => ({
  useSyncStatusStore: () => ({
    hasPendingChanges: true, // worst case: there ARE pending changes
    hasErrors: false,
    pendingCount: 3,
    failedCount: 0,
  }),
}))

import { useBeforeUnload } from '@/composables/useBeforeUnload'

const Harness = defineComponent({
  setup() {
    useBeforeUnload()
    return () => null
  },
})

describe('useBeforeUnload — Electron must not block window close (TASK-1871)', () => {
  let addSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener')
    addSpy.mockClear()
  })

  it('does NOT register a beforeunload handler in Electron', () => {
    isElectronValue = true
    mount(Harness)
    const beforeUnloadRegistered = addSpy.mock.calls.some(c => c[0] === 'beforeunload')
    expect(beforeUnloadRegistered, 'beforeunload must not be registered in Electron').toBe(false)
  })

  it('DOES register the beforeunload guard in the browser/PWA', () => {
    isElectronValue = false
    mount(Harness)
    const beforeUnloadRegistered = addSpy.mock.calls.some(c => c[0] === 'beforeunload')
    expect(beforeUnloadRegistered, 'beforeunload should guard in the browser').toBe(true)
  })
})
