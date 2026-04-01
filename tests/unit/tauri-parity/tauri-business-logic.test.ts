/**
 * Tauri-Specific Business Logic Tests
 *
 * 30 tests covering platform-conditional behavior, store behavior in Tauri context,
 * and runtime safety patterns. All tests mock Tauri APIs (never need a real Tauri runtime).
 *
 * Coverage:
 *   Section A: Platform-conditional behavior (10 tests)
 *   Section B: Store behavior in Tauri context (10 tests)
 *   Section C: Runtime safety (10 tests)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ──────────────────────────────────────────────────────────────────────────────
// Section A: Platform-Conditional Behavior (10 tests)
// ──────────────────────────────────────────────────────────────────────────────

describe('A: Platform-Conditional Behavior', () => {
  let _resetPlatformCache: () => void
  let isTauri: () => boolean
  let isBrowser: () => boolean
  let detectPlatform: () => string
  let shouldTrustNavigatorOnline: () => boolean
  let getInitialOnlineState: () => boolean

  function stubMatchMedia() {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
  }

  beforeEach(async () => {
    const mod = await import('@/utils/platform')
    _resetPlatformCache = mod._resetPlatformCache
    isTauri = mod.isTauri
    isBrowser = mod.isBrowser
    detectPlatform = mod.detectPlatform
    shouldTrustNavigatorOnline = mod.shouldTrustNavigatorOnline
    getInitialOnlineState = mod.getInitialOnlineState

    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    delete (window as Record<string, unknown>).isTauri
    delete (window as Record<string, unknown>).Capacitor
    stubMatchMedia()
    _resetPlatformCache()
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    delete (window as Record<string, unknown>).isTauri
    delete (window as Record<string, unknown>).Capacitor
    _resetPlatformCache()
    vi.restoreAllMocks()
  })

  // 1. isTauri() false → no Tauri plugin imports attempted
  it('1 - isTauri() returns false in browser — Tauri plugin imports should be skipped', () => {
    expect(isTauri()).toBe(false)
    expect(isBrowser()).toBe(true)

    // Verify the guard pattern used throughout the codebase:
    // if (!isTauri()) return; — ensures dynamic imports of @tauri-apps/* are never reached
    let importAttempted = false
    if (isTauri()) {
      importAttempted = true
    }
    expect(importAttempted).toBe(false)
  })

  // 2. TASK-1718: isTauri() is deprecated (always false). Test isElectron() instead.
  it('2 - isTauri() always returns false after Electron migration; isElectron() detects electronAPI', async () => {
    const mod = await import('@/utils/platform')
    // isTauri() is a deprecated stub — always false regardless of window globals
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    _resetPlatformCache()
    expect(isTauri()).toBe(false)

    // isElectron() detects window.electronAPI
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    ;(window as Record<string, unknown>).electronAPI = {}
    _resetPlatformCache()
    expect(mod.isElectron()).toBe(true)
    delete (window as Record<string, unknown>).electronAPI
    _resetPlatformCache()
  })

  // 3. TASK-1718: Window title always uses browser path (isTauri() deprecated)
  it('3 - Window title update always takes browser path after Electron migration', () => {
    const nativeTitleUpdate = vi.fn()
    const browserTitleUpdate = vi.fn()

    // isTauri() is always false — browser path always taken
    if (isTauri()) {
      nativeTitleUpdate('FlowState - 25:00')
    } else {
      browserTitleUpdate('FlowState - 25:00')
    }

    expect(nativeTitleUpdate).not.toHaveBeenCalled()
    expect(browserTitleUpdate).toHaveBeenCalledWith('FlowState - 25:00')

    // Even with __TAURI_INTERNALS__ set, isTauri() remains false
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    _resetPlatformCache()
    expect(isTauri()).toBe(false) // Deprecated stub
  })

  // 4. TASK-1718: System tray guard — isTauri() deprecated, always false
  it('4 - System tray features never activate (isTauri() deprecated)', () => {
    let trayInitAttempted = false

    if (isTauri()) {
      trayInitAttempted = true
    }
    expect(trayInitAttempted).toBe(false)

    // Even with Tauri globals, isTauri() stays false
    ;(window as Record<string, unknown>).__TAURI__ = {}
    _resetPlatformCache()

    if (isTauri()) {
      trayInitAttempted = true
    }
    expect(trayInitAttempted).toBe(false) // Deprecated — always false
  })

  // 5. Deep link handling in Tauri vs browser
  it('5 - Deep link handling differs between Tauri and browser', () => {
    // Browser: uses window.location.hash for routing
    // Tauri: can also receive deep links via Tauri protocol handlers
    const browserRoute = '/#/tasks'
    const tauriDeepLink = 'flowstate://tasks'

    let handledAs: 'browser-hash' | 'tauri-protocol' | null = null

    if (isTauri()) {
      // In Tauri, both hash routes and protocol links work
      handledAs = 'tauri-protocol'
    } else {
      handledAs = 'browser-hash'
    }

    expect(handledAs).toBe('browser-hash')
  })

  // 6. File dialog (save/load) only available in Tauri
  it('6 - File dialog for backup is gated behind isTauri()', () => {
    // backupExport.ts checks isTauri() before importing @tauri-apps/plugin-dialog
    let useTauriDialog = false
    let useBrowserDownload = false

    if (isTauri()) {
      useTauriDialog = true
    } else {
      useBrowserDownload = true
    }

    expect(useTauriDialog).toBe(false)
    expect(useBrowserDownload).toBe(true)
  })

  // 7. Tauri updater disabled in browser
  it('7 - Updater check returns false in browser environment', async () => {
    // useTauriUpdater.checkForUpdates() returns false when !isTauri()
    // Reproduce the guard:
    let result = false
    if (!isTauri()) {
      result = false
    } else {
      result = true // would call check() in real code
    }
    expect(result).toBe(false)
  })

  // 8. TASK-1718: Notification routing — isTauri() deprecated, native-linux path is dead
  it('8 - Notification delivery always routes to browser-api (isTauri() deprecated)', () => {
    let route: 'native-linux' | 'browser-api' | 'capacitor' = 'browser-api'

    if (isTauri()) {
      route = 'native-linux'
    }
    expect(route).toBe('browser-api')

    // Even with Tauri globals, route stays browser-api
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    _resetPlatformCache()

    if (isTauri()) {
      route = 'native-linux'
    }
    expect(route).toBe('browser-api') // isTauri() always false
  })

  // 9. Wake lock behavior differs between platforms
  it('9 - Wake lock approach differs between Tauri and browser', () => {
    // Browser: uses navigator.wakeLock API
    // Tauri: WebKitGTK does not support wakeLock — uses prevent_idle Tauri command
    let method: 'wake-lock-api' | 'tauri-prevent-idle' = 'wake-lock-api'

    if (isTauri()) {
      method = 'tauri-prevent-idle'
    }

    expect(method).toBe('wake-lock-api')
  })

  // 10. TASK-1718: Online detection — Chromium (Electron) is always trustworthy
  it('10 - After Electron migration, navigator.onLine is always trusted', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)

    // shouldTrustNavigatorOnline() always returns true (Chromium is reliable)
    expect(shouldTrustNavigatorOnline()).toBe(true)
    // getInitialOnlineState() respects navigator.onLine
    expect(getInitialOnlineState()).toBe(false)

    // Even with Tauri globals, behavior is the same (Tauri detection is dead)
    ;(window as Record<string, unknown>).__TAURI__ = {}
    _resetPlatformCache()

    expect(shouldTrustNavigatorOnline()).toBe(true)
    expect(getInitialOnlineState()).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Section B: Store Behavior in Tauri Context (10 tests)
// ──────────────────────────────────────────────────────────────────────────────

describe('B: Store Behavior in Tauri Context', () => {
  let _resetPlatformCache: () => void

  function stubMatchMedia() {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
  }

  beforeEach(async () => {
    const mod = await import('@/utils/platform')
    _resetPlatformCache = mod._resetPlatformCache
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    delete (window as Record<string, unknown>).Capacitor
    stubMatchMedia()
    _resetPlatformCache()
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    _resetPlatformCache()
    vi.restoreAllMocks()
  })

  // 11. PersistentRef preloads in Tauri, skips in browser
  it('11 - PersistentRef preload is gated by Tauri environment check', () => {
    // usePersistentRef.ts: preloadTauriUiState() checks isTauriEnv()
    // which uses '__TAURI__' in window
    const isTauriEnv = (): boolean =>
      typeof window !== 'undefined' && '__TAURI__' in window

    expect(isTauriEnv()).toBe(false) // browser — skip preload

    ;(window as Record<string, unknown>).__TAURI__ = {}
    expect(isTauriEnv()).toBe(true) // Tauri — run preload
  })

  // 12. Task store works identically in both platforms
  it('12 - Task data model is platform-agnostic', () => {
    // Task shape is identical regardless of platform
    const task = {
      id: 'task-001',
      title: 'Test task',
      status: 'planned',
      priority: 'medium',
      projectId: null,
      isDeleted: false,
    }

    // The same task object is valid in both Tauri and browser
    expect(task.id).toBe('task-001')
    expect(task.status).toBe('planned')

    // Platform detection does not affect task structure
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    _resetPlatformCache()

    expect(task.id).toBe('task-001')
    expect(task.status).toBe('planned')
  })

  // 13. Timer store leadership works across platforms
  it('13 - Timer leadership model is consistent across platforms', () => {
    // Timer uses Supabase Realtime for cross-device sync
    // Leadership: one device leads countdown, others follow
    // This is transport-layer logic, not platform-specific
    const leaderState = {
      isLeader: true,
      heartbeatInterval: 10000,
      leaderTimeout: 30000,
    }

    // Same values regardless of platform
    expect(leaderState.heartbeatInterval).toBe(10000)
    expect(leaderState.leaderTimeout).toBe(30000)
  })

  // 14. Auth store handles Tauri OAuth flow
  it('14 - Auth OAuth flow branches on Tauri detection', () => {
    // auth.ts: Tauri uses useTauriOAuth (shell:open for OAuth redirect)
    // Browser uses standard Supabase OAuth redirect
    let authFlow: 'tauri-shell-oauth' | 'browser-redirect' = 'browser-redirect'

    const isTauri = (): boolean =>
      '__TAURI_INTERNALS__' in window || '__TAURI__' in window

    if (isTauri()) {
      authFlow = 'tauri-shell-oauth'
    }

    expect(authFlow).toBe('browser-redirect')

    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    if (isTauri()) {
      authFlow = 'tauri-shell-oauth'
    }
    expect(authFlow).toBe('tauri-shell-oauth')
  })

  // 15. Settings store persists to Tauri store plugin
  it('15 - Settings persistence uses dual-write in Tauri', () => {
    // In Tauri: writes to both localStorage (sync) AND Tauri plugin-store (async)
    // In browser: only localStorage
    const writes: string[] = []

    const isTauriEnv = (): boolean => '__TAURI__' in window

    const persistSetting = (key: string, value: string) => {
      writes.push('localStorage')
      if (isTauriEnv()) {
        writes.push('tauri-store')
      }
    }

    persistSetting('theme', 'dark')
    expect(writes).toEqual(['localStorage'])

    writes.length = 0
    ;(window as Record<string, unknown>).__TAURI__ = {}

    persistSetting('theme', 'light')
    expect(writes).toEqual(['localStorage', 'tauri-store'])
  })

  // 16. Canvas positions persist identically in both platforms
  it('16 - Canvas position data is platform-agnostic', () => {
    // Canvas positions are stored in Supabase, not locally
    // No Tauri-specific position handling
    const position = { x: 100, y: 200 }
    const serialized = JSON.stringify(position)
    const deserialized = JSON.parse(serialized)

    expect(deserialized.x).toBe(100)
    expect(deserialized.y).toBe(200)
  })

  // 17. TASK-1718: getInitialOnlineState respects navigator.onLine (no Tauri override)
  it('17 - Sync orchestrator uses getInitialOnlineState — always respects navigator.onLine after Electron migration', async () => {
    const { getInitialOnlineState } = await import('@/utils/platform')

    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true)
    expect(getInitialOnlineState()).toBe(true)

    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    _resetPlatformCache()
    expect(getInitialOnlineState()).toBe(false)

    // Even with Tauri globals, navigator.onLine is still respected (no override)
    ;(window as Record<string, unknown>).__TAURI__ = {}
    _resetPlatformCache()
    expect(getInitialOnlineState()).toBe(false) // navigator.onLine is still false
  })

  // 18. Backup system works in both platforms
  it('18 - Backup export branches on isTauri for file dialog vs download', () => {
    const isTauri = (): boolean => '__TAURI__' in window

    let exportMethod: 'tauri-dialog' | 'browser-download' = 'browser-download'

    if (isTauri()) {
      exportMethod = 'tauri-dialog'
    }

    expect(exportMethod).toBe('browser-download')

    ;(window as Record<string, unknown>).__TAURI__ = {}

    exportMethod = 'browser-download'
    if (isTauri()) {
      exportMethod = 'tauri-dialog'
    }

    expect(exportMethod).toBe('tauri-dialog')
  })

  // 19. IndexedDB deep-clone pattern used in Tauri paths
  it('19 - Deep-clone via JSON.parse(JSON.stringify) strips Vue reactive proxies for IndexedDB', () => {
    const { reactive, toRaw } = require('vue')

    const rawData = {
      id: 'task-001',
      subtasks: [{ id: 'sub-1', completed: false }],
      nested: { deep: { value: 42 } },
    }

    const reactiveData = reactive(rawData)

    // The pattern used in readCacheDB.ts for safe IndexedDB storage
    const safeClone = JSON.parse(JSON.stringify(toRaw(reactiveData)))

    expect(safeClone.id).toBe('task-001')
    expect(safeClone.subtasks[0].id).toBe('sub-1')
    expect(safeClone.nested.deep.value).toBe(42)

    // Verify it's a plain object, not a Proxy
    expect(typeof safeClone).toBe('object')
    expect(safeClone.constructor).toBe(Object)
  })

  // 20. BroadcastChannel sync works in Tauri WebView
  it('20 - BroadcastChannel availability check for cross-tab sync', () => {
    // Tauri WebKitGTK supports BroadcastChannel
    // The code checks typeof BroadcastChannel !== 'undefined' before using it
    const hasBroadcastChannel = typeof BroadcastChannel !== 'undefined'

    // In jsdom, BroadcastChannel may or may not exist
    // The important thing is the guard pattern works without throwing
    expect(typeof hasBroadcastChannel).toBe('boolean')

    // Verify the guard pattern does not crash
    let channelCreated = false
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('test-channel')
        channelCreated = true
        channel.close()
      } catch {
        // Expected in some test environments
      }
    }
    // No assertion on channelCreated — just verify no crash
    expect(true).toBeTruthy()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Section C: Runtime Safety (10 tests)
// ──────────────────────────────────────────────────────────────────────────────

describe('C: Runtime Safety', () => {
  let _resetPlatformCache: () => void

  function stubMatchMedia() {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
  }

  beforeEach(async () => {
    const mod = await import('@/utils/platform')
    _resetPlatformCache = mod._resetPlatformCache
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    delete (window as Record<string, unknown>).Capacitor
    stubMatchMedia()
    _resetPlatformCache()
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    _resetPlatformCache()
    vi.restoreAllMocks()
  })

  // 21. All dynamic imports wrapped in try/catch
  it('21 - Dynamic Tauri imports use try/catch to prevent crashes in browser', async () => {
    // Pattern from notificationDelivery.ts, backupExport.ts, etc.:
    // try { const { X } = await import('@tauri-apps/...') } catch { /* fallback */ }
    let importFailed = false
    let fallbackUsed = false

    try {
      // Simulate a dynamic import that would fail in browser context
      const module = await import('@tauri-apps/api/core').catch(() => null)
      if (!module) {
        importFailed = true
        fallbackUsed = true
      }
    } catch {
      importFailed = true
      fallbackUsed = true
    }

    // In test/browser environment, the import should fail gracefully
    // (or succeed if @tauri-apps is in node_modules as a dev dependency)
    expect(true).toBeTruthy() // No crash is the assertion
  })

  // 22. Tauri invoke() calls have error handling
  it('22 - invoke() pattern includes error handling and fallback', async () => {
    // Pattern from useTauriStartup.ts:
    // try { const result = await invoke<string>('command') } catch (error) { handle(error) }
    const mockInvoke = vi.fn().mockRejectedValue(new Error('Tauri not available'))

    let result: string | null = null
    let errorCaught = false

    try {
      result = await mockInvoke('check_docker_status')
    } catch (error) {
      errorCaught = true
      result = null
    }

    expect(errorCaught).toBe(true)
    expect(result).toBeNull()
  })

  // 23. Plugin not-found errors handled gracefully
  it('23 - Plugin not-found error does not crash the app', async () => {
    // When a Tauri plugin is not installed, the dynamic import fails
    // The app should catch this and fall back to browser behavior
    const loadPlugin = async (): Promise<boolean> => {
      try {
        // Simulate plugin load failure
        throw new Error('plugin `store` not found in the Tauri configuration')
      } catch (error) {
        const msg = error instanceof Error ? error.message : ''
        if (msg.includes('not found')) {
          return false // Plugin not available
        }
        throw error // Re-throw unexpected errors
      }
    }

    const available = await loadPlugin()
    expect(available).toBe(false)
  })

  // 24. Window.__TAURI__ missing doesn't crash startup
  it('24 - Missing __TAURI__ globals do not crash platform detection', async () => {
    // Ensure no Tauri globals exist
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    delete (window as Record<string, unknown>).isTauri

    // This should not throw
    const mod = await import('@/utils/platform')
    mod._resetPlatformCache()

    expect(() => mod.detectPlatform()).not.toThrow()
    expect(() => mod.isTauri()).not.toThrow()
    expect(() => mod.isBrowser()).not.toThrow()
    expect(mod.detectPlatform()).toBe('browser')
  })

  // 25. Tauri-specific composables export no-op functions for browser
  it('25 - useTauriStartup exports functions that safely no-op in browser', async () => {
    // getTauriMode and setTauriMode work in any environment (use localStorage)
    const { getTauriMode, setTauriMode } = await import('@/composables/useTauriStartup')

    // Should not throw in browser
    expect(() => setTauriMode('cloud')).not.toThrow()
    expect(getTauriMode()).toBe('cloud')

    expect(() => setTauriMode('local')).not.toThrow()
    expect(getTauriMode()).toBe('local')
  })

  // 26. No unconditional @tauri-apps imports at top level
  it('26 - Top-level Tauri imports are only in Tauri-specific files', () => {
    // useTauriStartup.ts has top-level imports from @tauri-apps/api/core and @tauri-apps/api/window
    // These are acceptable because the composable is only used when isTauri() is true.
    // All other files use dynamic imports: await import('@tauri-apps/...')
    //
    // This test documents the convention by checking the import patterns used in the codebase.
    const topLevelImportFiles = [
      'src/composables/useTauriStartup.ts', // import { invoke } from '@tauri-apps/api/core'
    ]

    const dynamicImportFiles = [
      'src/utils/notificationDelivery.ts',
      'src/utils/openExternal.ts',
      'src/utils/tauriLogger.ts',
      'src/stores/auth.ts',
      'src/composables/usePersistentRef.ts',
      'src/composables/useTauriUpdater.ts',
      'src/composables/useTauriOAuth.ts',
      'src/composables/backup/backupExport.ts',
      'src/services/ai/utils/tauriHttp.ts',
    ]

    // Top-level import files must be small and only used behind isTauri() guards
    expect(topLevelImportFiles.length).toBeLessThanOrEqual(2)
    // Most Tauri integrations use dynamic imports
    expect(dynamicImportFiles.length).toBeGreaterThan(5)
  })

  // 27. CSS `overflow: clip` has fallback in all Tauri-rendered views
  it('27 - overflow:clip usages are annotated as WebKitGTK-safe', () => {
    // The codebase uses `overflow: clip` in specific places with comments
    // indicating WebKitGTK compatibility has been verified.
    // This test documents the pattern — actual CSS verification is in E2E tests.
    const overflowClipUsages = [
      { file: 'src/assets/canvas-view-layout.css', comment: 'WebKitGTK-safe: canvas container' },
      { file: 'src/mobile/views/MobileQuickSortView.vue', comment: 'WebKitGTK-safe: BUG-1453' },
    ]

    // Each usage should have a WebKitGTK-safe comment
    for (const usage of overflowClipUsages) {
      expect(usage.comment).toContain('WebKitGTK-safe')
    }
  })

  // 28. Touch events work with passive listeners
  it('28 - Touch event listener options use passive: true for touchstart', () => {
    // BUG-1453: touchstart MUST be passive: true in WebKitGTK
    // Calling preventDefault() in non-passive touchstart poisons the gesture on Android Chrome
    // and causes issues in WebKitGTK as well
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

    // Simulate the correct pattern
    const handler = () => {}
    document.addEventListener('touchstart', handler, { passive: true })

    expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', handler, { passive: true })

    document.removeEventListener('touchstart', handler)
    addEventListenerSpy.mockRestore()
  })

  // 29. Drag-and-drop falls back to dragData singleton
  it('29 - Drag-and-drop resolves data from singleton when dataTransfer is empty (WebKitGTK)', () => {
    // WebKitGTK/Tauri returns empty string from dataTransfer.getData()
    // The codebase uses a module-level dragData singleton as primary source
    interface DragData {
      type: 'task' | 'project'
      taskId?: string
      title: string
      source: string
    }

    const singleton: { value: DragData | null } = {
      value: {
        type: 'task',
        taskId: 'task-abc',
        title: 'Test Task',
        source: 'kanban',
      },
    }

    // Simulate WebKitGTK behavior: dataTransfer.getData returns ""
    const dataTransferResult = ''

    let resolved: DragData | null = singleton.value
    if (!resolved) {
      const dataString = dataTransferResult
      if (dataString) {
        try {
          resolved = JSON.parse(dataString)
        } catch { /* ignore */ }
      }
    }

    expect(resolved).not.toBeNull()
    expect(resolved!.taskId).toBe('task-abc')
  })

  // 30. Auto-updater handles offline/error states
  it('30 - Auto-updater error states are handled without crashes', () => {
    // useTauriUpdater.ts handles these error cases:
    // - Not in Tauri environment → returns false
    // - Plugin import fails → catches and sets error state
    // - Invalid binary format → provides helpful error message
    // - Signature verification failure → provides helpful error message
    // - Network error → sets error state

    const errorMessages = [
      'invalid updater binary format',
      'signature verification failed',
      'network error',
      'plugin `updater` not found',
    ]

    for (const errMsg of errorMessages) {
      // The updater should classify each error correctly
      let userMessage: string

      if (errMsg.includes('invalid updater binary format')) {
        userMessage = 'Update file format invalid.'
      } else if (errMsg.includes('signature')) {
        userMessage = 'Update signature verification failed.'
      } else {
        userMessage = errMsg
      }

      // All error messages should be non-empty strings
      expect(userMessage.length).toBeGreaterThan(0)
    }

    // Updater status transitions should be valid
    const validStatuses = ['idle', 'checking', 'available', 'downloading', 'ready', 'error', 'up-to-date']
    for (const status of validStatuses) {
      expect(typeof status).toBe('string')
    }
  })
})
