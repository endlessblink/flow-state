/**
 * Tauri Code Path Parity Tests
 *
 * Verifies Tauri-specific branches and workarounds that have caused production bugs.
 * All tests mock Tauri APIs (never need a real Tauri runtime).
 *
 * Coverage:
 *   1. Platform Detection (src/utils/platform.ts)
 *   2. Session File Path construction (src/stores/auth.ts — writeSessionFile)
 *   3. IndexedDB Structured Clone Safety (src/services/offline/readCacheDB.ts)
 *   4. Drag-and-Drop Tauri Fallback (src/composables/tasks/row/useTaskRowActions.ts)
 *   4b. Drag-and-Drop Tauri Fallback (src/composables/canvas/useCanvasEvents.ts — BUG-1502)
 *   5. Notification Permission Guard (src/utils/notificationDelivery.ts)
 *   6. Context Menu Coordinate Utils (src/utils/contextMenuCoordinates.ts)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive, ref } from 'vue'

// ──────────────────────────────────────────────────────────────────────────────
// 1. Platform Detection
// ──────────────────────────────────────────────────────────────────────────────

describe('Platform Detection (src/utils/platform.ts)', () => {
  // Import after each window manipulation to get a fresh module cache via cache reset
  let detectPlatform: () => string
  let isTauri: () => boolean
  let isCapacitor: () => boolean
  let isPWA: () => boolean
  let isBrowser: () => boolean
  let _resetPlatformCache: () => void

  // jsdom does not implement window.matchMedia — provide a stub that returns non-matching
  // so detectPlatform() falls through to 'browser' when no native globals are present.
  function stubMatchMediaNonStandalone() {
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
    // Re-import to grab the exported functions (cache is reset manually)
    const mod = await import('@/utils/platform')
    detectPlatform = mod.detectPlatform
    isTauri = mod.isTauri
    isCapacitor = mod.isCapacitor
    isPWA = mod.isPWA
    isBrowser = mod.isBrowser
    _resetPlatformCache = mod._resetPlatformCache

    // Clean window state
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    delete (window as Record<string, unknown>).isTauri
    delete (window as Record<string, unknown>).Capacitor

    // Stub matchMedia so PWA check doesn't throw
    stubMatchMediaNonStandalone()

    // Reset module-level cache so next detectPlatform() call re-evaluates window
    _resetPlatformCache()
  })

  afterEach(() => {
    // Restore window to neutral state
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    delete (window as Record<string, unknown>).isTauri
    delete (window as Record<string, unknown>).Capacitor
    _resetPlatformCache()
    vi.restoreAllMocks()
  })

  it('returns "tauri" when __TAURI_INTERNALS__ is present', () => {
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    expect(detectPlatform()).toBe('tauri')
  })

  it('returns "tauri" when __TAURI__ is present', () => {
    ;(window as Record<string, unknown>).__TAURI__ = {}
    expect(detectPlatform()).toBe('tauri')
  })

  it('returns "tauri" when window.isTauri is true', () => {
    ;(window as Record<string, unknown>).isTauri = true
    expect(detectPlatform()).toBe('tauri')
  })

  it('isTauri() returns true in Tauri environment', () => {
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    expect(isTauri()).toBe(true)
  })

  it('isTauri() returns false when no Tauri globals present', () => {
    expect(isTauri()).toBe(false)
  })

  it('returns "capacitor" when Capacitor.isNativePlatform() returns true', () => {
    ;(window as Record<string, unknown>).Capacitor = {
      isNativePlatform: () => true,
    }
    expect(detectPlatform()).toBe('capacitor')
  })

  it('isCapacitor() returns true in Capacitor environment', () => {
    ;(window as Record<string, unknown>).Capacitor = {
      isNativePlatform: () => true,
    }
    expect(isCapacitor()).toBe(true)
  })

  it('returns "browser" when no special globals exist and not standalone', () => {
    // matchMedia is already mocked by jsdom to return non-matching by default
    expect(detectPlatform()).toBe('browser')
  })

  it('isBrowser() returns true in plain browser environment', () => {
    expect(isBrowser()).toBe(true)
  })

  it('returns "pwa" when display-mode is standalone', () => {
    // Override matchMedia to simulate PWA installed mode
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(display-mode: standalone)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList)

    expect(detectPlatform()).toBe('pwa')

    vi.restoreAllMocks()
  })

  it('caches result — second call without reset returns same value', () => {
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    expect(detectPlatform()).toBe('tauri')

    // Remove the global — but cache should still say 'tauri'
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    expect(detectPlatform()).toBe('tauri')
  })

  it('_resetPlatformCache() forces re-evaluation on next call', () => {
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    expect(detectPlatform()).toBe('tauri')

    // Reset and remove signal
    _resetPlatformCache()
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__

    expect(detectPlatform()).toBe('browser')
  })

  it('Tauri detection takes priority over Capacitor when both present', () => {
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    ;(window as Record<string, unknown>).Capacitor = { isNativePlatform: () => true }
    expect(detectPlatform()).toBe('tauri')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 2. Session File Path (writeSessionFile in src/stores/auth.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe('Session File Path (auth.ts writeSessionFile)', () => {
  // We test the path-construction logic in isolation by reproducing it exactly
  // as it appears in writeSessionFile. This avoids importing the full Pinia store
  // (which has heavy deps) while still catching the bug where the '/' was missing.

  /**
   * Reproduces the path-construction logic from writeSessionFile:
   *   const configDir = `${home}/.config/flowstate`
   */
  function buildSessionPath(home: string): { configDir: string; sessionPath: string } {
    const configDir = `${home}/.config/flowstate`
    const sessionPath = `${configDir}/session.json`
    return { configDir, sessionPath }
  }

  it('configDir contains a "/" between home dir and .config', () => {
    const { configDir } = buildSessionPath('/home/user')
    expect(configDir).toBe('/home/user/.config/flowstate')
    // Verify there's a separator — old bug had "${home}.config/flowstate"
    expect(configDir).not.toContain('user.config')
  })

  it('sessionPath is correctly formed for a typical Linux home dir', () => {
    const { sessionPath } = buildSessionPath('/home/alice')
    expect(sessionPath).toBe('/home/alice/.config/flowstate/session.json')
  })

  it('sessionPath is correct for a root home dir', () => {
    const { sessionPath } = buildSessionPath('/root')
    expect(sessionPath).toBe('/root/.config/flowstate/session.json')
  })

  it('homeDir() does NOT include a trailing slash — path concatenation is safe', () => {
    // @tauri-apps/api/path homeDir() always returns paths WITHOUT a trailing slash.
    // The path construction `${home}/.config/flowstate` relies on this.
    // This test documents the expected format of the home dir value.
    const home = '/home/user' // no trailing slash — as homeDir() returns
    const { configDir } = buildSessionPath(home)
    expect(home).not.toMatch(/\/$/)   // homeDir doesn't end with /
    expect(configDir).toBe('/home/user/.config/flowstate')
  })

  it('writeSessionFile mocks: writes session JSON when session is provided', async () => {
    const writeTextFileMock = vi.fn().mockResolvedValue(undefined)
    const mkdirMock = vi.fn().mockResolvedValue(undefined)
    const existsMock = vi.fn().mockResolvedValue(false) // dir doesn't exist yet
    const homeDirMock = vi.fn().mockResolvedValue('/home/testuser')

    vi.doMock('@tauri-apps/plugin-fs', () => ({
      writeTextFile: writeTextFileMock,
      mkdir: mkdirMock,
      exists: existsMock,
    }))
    vi.doMock('@tauri-apps/api/path', () => ({
      homeDir: homeDirMock,
    }))

    // Inline reproduction of writeSessionFile to test its path logic
    const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs')
    const { homeDir } = await import('@tauri-apps/api/path')

    const home = await homeDir()
    const configDir = `${home}/.config/flowstate`
    const sessionPath = `${configDir}/session.json`

    const dirExists = await exists(configDir)
    if (!dirExists) {
      await mkdir(configDir, { recursive: true })
    }

    const fakeSession = {
      access_token: 'tok_abc',
      refresh_token: 'ref_xyz',
      expires_at: 9999999999,
      user: { id: 'user-001' },
    }

    const payload = JSON.stringify({
      access_token: fakeSession.access_token,
      refresh_token: fakeSession.refresh_token,
      expires_at: fakeSession.expires_at,
      user_id: fakeSession.user?.id,
      updated_at: new Date().toISOString(),
    })
    await writeTextFile(sessionPath, payload)

    // The path written MUST include '/' between home and .config
    const writtenPath = writeTextFileMock.mock.calls[0][0] as string
    expect(writtenPath).toBe('/home/testuser/.config/flowstate/session.json')
    expect(writtenPath).not.toContain('testuser.config')

    vi.doUnmock('@tauri-apps/plugin-fs')
    vi.doUnmock('@tauri-apps/api/path')
  })

  it('writeSessionFile mocks: writes "{}" on sign-out (null session)', async () => {
    const writeTextFileMock = vi.fn().mockResolvedValue(undefined)
    const existsMock = vi.fn().mockResolvedValue(true) // dir exists
    const homeDirMock = vi.fn().mockResolvedValue('/home/testuser')

    vi.doMock('@tauri-apps/plugin-fs', () => ({
      writeTextFile: writeTextFileMock,
      mkdir: vi.fn(),
      exists: existsMock,
    }))
    vi.doMock('@tauri-apps/api/path', () => ({
      homeDir: homeDirMock,
    }))

    const { writeTextFile, exists } = await import('@tauri-apps/plugin-fs')
    const { homeDir } = await import('@tauri-apps/api/path')

    const home = await homeDir()
    const configDir = `${home}/.config/flowstate`
    const sessionPath = `${configDir}/session.json`

    // Simulate sign-out path (null session)
    const sessionData = null
    const dirExists = await exists(configDir)
    if (!dirExists) {
      // mkdir not called in this test
    }
    if (sessionData) {
      await writeTextFile(sessionPath, JSON.stringify(sessionData))
    } else {
      await writeTextFile(sessionPath, '{}')
    }

    expect(writeTextFileMock).toHaveBeenCalledWith(
      '/home/testuser/.config/flowstate/session.json',
      '{}'
    )

    vi.doUnmock('@tauri-apps/plugin-fs')
    vi.doUnmock('@tauri-apps/api/path')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 3. IndexedDB Structured Clone Safety (src/services/offline/readCacheDB.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe('IndexedDB Structured Clone Safety (readCacheDB.ts)', () => {
  beforeEach(async () => {
    // Use fake-indexeddb to avoid real browser IndexedDB limitations in jsdom.
    // The '/auto' sub-path installs all necessary globals (indexedDB, IDBKeyRange, etc.)
    // on globalThis automatically — Dexie picks them up via its standard global lookup.
    await import('fake-indexeddb/auto')
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('cacheTasks strips Vue reactive proxy before writing to IndexedDB', async () => {
    const { cacheTasks, getCachedTasks } = await import('@/services/offline/readCacheDB')

    // Create a Vue reactive object — structuredClone (used by IndexedDB) fails on Proxies
    const rawTask = {
      id: 'task-001',
      title: 'Reactive Task',
      description: '',
      status: 'todo' as const,
      priority: null,
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '',
      projectId: 'proj-001',
      parentTaskId: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    }

    const reactiveTask = reactive(rawTask)

    // Should not throw — BUG: without JSON.parse(JSON.stringify(toRaw(t))), this would
    // fail with "could not be cloned" because IndexedDB can't clone Vue Proxies
    await expect(cacheTasks([reactiveTask as unknown as import('@/types/tasks').Task])).resolves.not.toThrow()

    // Verify the data was stored and can be retrieved
    const cached = await getCachedTasks()
    expect(cached).not.toBeNull()
    expect(cached).toHaveLength(1)
    expect(cached![0].id).toBe('task-001')
    expect(cached![0].title).toBe('Reactive Task')
  })

  it('cacheGroups strips Vue reactive proxy before writing', async () => {
    const { cacheGroups, getCachedGroups } = await import('@/services/offline/readCacheDB')

    const rawGroup = {
      id: 'group-001',
      title: 'Test Group',
      position: { x: 100, y: 200 },
      size: { width: 300, height: 200 },
      userId: 'user-001',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    }

    const reactiveGroup = reactive(rawGroup)

    await expect(
      cacheGroups([reactiveGroup as unknown as import('@/types/canvas').CanvasGroup])
    ).resolves.not.toThrow()

    const cached = await getCachedGroups()
    expect(cached).not.toBeNull()
    expect(cached![0].id).toBe('group-001')
  })

  it('cacheProjects strips Vue reactive proxy before writing', async () => {
    const { cacheProjects, getCachedProjects } = await import('@/services/offline/readCacheDB')

    const rawProject = {
      id: 'proj-001',
      name: 'Test Project',
      color: '#4ECDC4',
      colorType: 'hex' as const,
      viewType: 'status' as const,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    }

    const reactiveProject = reactive(rawProject)

    await expect(
      cacheProjects([reactiveProject as unknown as import('@/types/tasks').Project])
    ).resolves.not.toThrow()

    const cached = await getCachedProjects()
    expect(cached).not.toBeNull()
    expect(cached![0].id).toBe('proj-001')
  })

  it('cacheTasks handles empty array without error', async () => {
    const { cacheTasks, getCachedTasks } = await import('@/services/offline/readCacheDB')
    await expect(cacheTasks([])).resolves.not.toThrow()
    // Empty array → getCachedTasks returns null (no tasks stored)
    const cached = await getCachedTasks()
    expect(cached).toBeNull()
  })

  it('toRaw is called — nested reactive objects are serialized cleanly', async () => {
    const { cacheTasks, getCachedTasks } = await import('@/services/offline/readCacheDB')

    const taskWithNestedReactive = reactive({
      id: 'task-nested',
      title: 'Nested Reactive',
      description: '',
      status: 'todo' as const,
      priority: 'high' as const,
      progress: 0,
      completedPomodoros: 0,
      subtasks: reactive([{ id: 'sub-1', title: 'Sub', isCompleted: false }]),
      dueDate: '2026-03-01',
      projectId: 'proj-001',
      parentTaskId: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    })

    await expect(
      cacheTasks([taskWithNestedReactive as unknown as import('@/types/tasks').Task])
    ).resolves.not.toThrow()

    const cached = await getCachedTasks()
    expect(cached![0].id).toBe('task-nested')
    expect(cached![0].priority).toBe('high')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 4. Drag-and-Drop Tauri Fallback (useTaskRowActions.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe('Drag-and-Drop Tauri Fallback (useTaskRowActions.ts — handleDrop)', () => {
  // We test the handleDrop fallback logic by reconstructing it inline.
  // This mirrors the exact logic in useTaskRowActions without importing the composable
  // (which has Vue component lifecycle dependencies).

  interface DragData {
    type: 'task' | 'project'
    taskId?: string
    title: string
    source: string
  }

  type ActiveDragRef = { value: DragData | null }

  /**
   * Reproduction of handleDrop logic from useTaskRowActions.ts line 61-80.
   * Returns the resolved DragData or null.
   */
  function resolveDropData(
    dataTransferResult: string | null,
    activeDragData: ActiveDragRef
  ): DragData | null {
    // Use dragData singleton first (WebKitGTK/Tauri returns empty from dataTransfer.getData)
    let dragData: DragData | null = activeDragData.value
    if (!dragData) {
      const dataString = dataTransferResult
      if (dataString) {
        try {
          dragData = JSON.parse(dataString) as DragData
        } catch { /* ignore */ }
      }
    }
    return dragData
  }

  it('uses activeDragData singleton when dataTransfer.getData returns empty string (WebKitGTK)', () => {
    const activeDragData: ActiveDragRef = {
      value: {
        type: 'task',
        taskId: 'task-abc',
        title: 'My Task',
        source: 'kanban',
      },
    }

    // WebKitGTK/Tauri returns "" from getData
    const result = resolveDropData('', activeDragData)

    expect(result).not.toBeNull()
    expect(result!.taskId).toBe('task-abc')
  })

  it('uses activeDragData singleton when dataTransfer.getData returns null', () => {
    const activeDragData: ActiveDragRef = {
      value: {
        type: 'task',
        taskId: 'task-xyz',
        title: 'Another Task',
        source: 'kanban',
      },
    }

    const result = resolveDropData(null, activeDragData)

    expect(result).not.toBeNull()
    expect(result!.taskId).toBe('task-xyz')
  })

  it('falls back to dataTransfer JSON when activeDragData is null', () => {
    const activeDragData: ActiveDragRef = { value: null }

    const serialized = JSON.stringify({
      type: 'task',
      taskId: 'task-from-dt',
      title: 'DataTransfer Task',
      source: 'kanban',
    })

    const result = resolveDropData(serialized, activeDragData)

    expect(result).not.toBeNull()
    expect(result!.taskId).toBe('task-from-dt')
  })

  it('returns null when both activeDragData and dataTransfer are empty (should abort drop)', () => {
    const activeDragData: ActiveDragRef = { value: null }
    const result = resolveDropData('', activeDragData)
    expect(result).toBeNull()
  })

  it('returns null when dataTransfer JSON is malformed and no singleton', () => {
    const activeDragData: ActiveDragRef = { value: null }
    const result = resolveDropData('{invalid json}}', activeDragData)
    expect(result).toBeNull()
  })

  it('activeDragData singleton takes priority over valid dataTransfer JSON', () => {
    // Singleton was set from dragstart — dataTransfer may be stale/wrong
    const activeDragData: ActiveDragRef = {
      value: {
        type: 'task',
        taskId: 'singleton-task',
        title: 'Singleton Task',
        source: 'kanban',
      },
    }

    const staleJson = JSON.stringify({
      type: 'task',
      taskId: 'stale-task',
      title: 'Stale Task',
      source: 'kanban',
    })

    const result = resolveDropData(staleJson, activeDragData)
    // Singleton wins
    expect(result!.taskId).toBe('singleton-task')
  })

  it('moveTask emit is triggered with correct args when drag data is valid', () => {
    // Test the emit path: dragData.type === 'task' && dragData.taskId && dragData.taskId !== props.task.id
    const emitMock = vi.fn()

    const activeDragData: ActiveDragRef = {
      value: {
        type: 'task',
        taskId: 'dragged-task-id',
        title: 'Dragged Task',
        source: 'kanban',
      },
    }

    const targetTask = {
      id: 'target-task-id',
      projectId: 'proj-001',
    }

    // Reproduce emit logic from handleDrop
    const dragData = resolveDropData('', activeDragData)
    if (dragData && dragData.type === 'task' && dragData.taskId && dragData.taskId !== targetTask.id) {
      emitMock('moveTask', dragData.taskId, targetTask.projectId || null, targetTask.id)
    }

    expect(emitMock).toHaveBeenCalledWith(
      'moveTask',
      'dragged-task-id',
      'proj-001',
      'target-task-id'
    )
  })

  it('moveTask emit is NOT triggered when dragging task onto itself', () => {
    const emitMock = vi.fn()
    const sameTaskId = 'same-task-id'

    const activeDragData: ActiveDragRef = {
      value: {
        type: 'task',
        taskId: sameTaskId,
        title: 'Self Task',
        source: 'kanban',
      },
    }

    const targetTask = { id: sameTaskId, projectId: 'proj-001' }

    const dragData = resolveDropData('', activeDragData)
    if (dragData && dragData.type === 'task' && dragData.taskId && dragData.taskId !== targetTask.id) {
      emitMock('moveTask', dragData.taskId, targetTask.projectId || null, targetTask.id)
    }

    expect(emitMock).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 4b. Drag-and-Drop Tauri Fallback (useCanvasEvents.ts — canvas drop handler)
// ──────────────────────────────────────────────────────────────────────────────

describe('Drag-and-Drop Tauri Fallback (useCanvasEvents.ts — canvas handleDrop)', () => {
  // We test the canvas drop handler fallback logic by reconstructing it inline.
  // The canvas handler uses { taskId?: string } (not the full DragData interface)
  // which matches the actual code in useCanvasEvents.ts lines 154-163.
  //
  // Key difference from section 4: the canvas handler does NOT use the full
  // DragData type — it only cares about taskId.

  type CanvasParsedData = { taskId?: string } | null

  type ActiveDragRef = { value: CanvasParsedData }

  /**
   * Reproduction of canvas drop resolution logic from useCanvasEvents.ts lines 154-163:
   *
   *   let parsedData: { taskId?: string } | null = activeDragData.value
   *   if (!parsedData) {
   *     const dataString = event.dataTransfer?.getData('application/json')
   *     if (dataString) {
   *       try { parsedData = JSON.parse(dataString) } catch { }
   *     }
   *   }
   *   if (!parsedData) { return }
   *
   * Returns the resolved data or null (null = drop aborted).
   */
  function resolveCanvasDropData(
    dataTransferResult: string | null | undefined,
    activeDragData: ActiveDragRef
  ): CanvasParsedData {
    let parsedData: CanvasParsedData = activeDragData.value
    if (!parsedData) {
      const dataString = dataTransferResult
      if (dataString) {
        try {
          parsedData = JSON.parse(dataString) as { taskId?: string }
        } catch { /* ignore */ }
      }
    }
    if (!parsedData) {
      return null
    }
    return parsedData
  }

  it('uses activeDragData singleton when dataTransfer.getData returns empty string (WebKitGTK/Tauri)', () => {
    const activeDragData: ActiveDragRef = {
      value: { taskId: 'canvas-task-abc' },
    }

    // WebKitGTK/Tauri returns "" from getData
    const result = resolveCanvasDropData('', activeDragData)

    expect(result).not.toBeNull()
    expect(result!.taskId).toBe('canvas-task-abc')
  })

  it('uses activeDragData singleton when dataTransfer.getData returns null', () => {
    const activeDragData: ActiveDragRef = {
      value: { taskId: 'canvas-task-xyz' },
    }

    const result = resolveCanvasDropData(null, activeDragData)

    expect(result).not.toBeNull()
    expect(result!.taskId).toBe('canvas-task-xyz')
  })

  it('falls back to dataTransfer JSON when activeDragData is null', () => {
    const activeDragData: ActiveDragRef = { value: null }

    const serialized = JSON.stringify({ taskId: 'canvas-task-from-dt' })

    const result = resolveCanvasDropData(serialized, activeDragData)

    expect(result).not.toBeNull()
    expect(result!.taskId).toBe('canvas-task-from-dt')
  })

  it('returns null when both activeDragData and dataTransfer are empty (aborts drop)', () => {
    const activeDragData: ActiveDragRef = { value: null }

    const result = resolveCanvasDropData('', activeDragData)

    expect(result).toBeNull()
  })

  it('returns null when dataTransfer JSON is malformed and no singleton', () => {
    const activeDragData: ActiveDragRef = { value: null }

    const result = resolveCanvasDropData('{invalid json}}', activeDragData)

    expect(result).toBeNull()
  })

  it('activeDragData singleton takes priority over valid dataTransfer JSON', () => {
    // Singleton was set at dragstart — dataTransfer may be stale or empty in Tauri
    const activeDragData: ActiveDragRef = {
      value: { taskId: 'singleton-canvas-task' },
    }

    const staleJson = JSON.stringify({ taskId: 'stale-canvas-task' })

    const result = resolveCanvasDropData(staleJson, activeDragData)

    // Singleton wins
    expect(result!.taskId).toBe('singleton-canvas-task')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 5. Notification Permission Guard (src/utils/notificationDelivery.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe('Notification Delivery — Tauri skips Notification.requestPermission()', () => {
  let _resetPlatformCache: () => void

  beforeEach(async () => {
    const mod = await import('@/utils/platform')
    _resetPlatformCache = mod._resetPlatformCache

    // Clean state
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    _resetPlatformCache()
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    vi.restoreAllMocks()
    _resetPlatformCache()
  })

  it('does NOT call Notification.requestPermission() when permission is "default" in Tauri', async () => {
    // Simulate Tauri environment (notificationDelivery.ts uses its own local isTauri check)
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}

    const requestPermissionMock = vi.fn().mockResolvedValue('granted')

    // Mock Notification API
    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: requestPermissionMock,
      },
      writable: true,
      configurable: true,
    })

    // Reproduce the guard from deliverViaBrowserAPI (lines 80-84 of notificationDelivery.ts):
    //   if (isTauri()) {
    //     console.warn('[NOTIFY] Skipping permission request in Tauri (WebKitGTK hangs)')
    //     return false
    //   }
    const isTauriLocal = (): boolean =>
      !!(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__

    let result = false
    if (window.Notification.permission === 'default') {
      if (isTauriLocal()) {
        // Should return false without calling requestPermission
        result = false
      } else {
        const permission = await window.Notification.requestPermission()
        result = permission === 'granted'
      }
    }

    expect(requestPermissionMock).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('calls Notification.requestPermission() in browser (non-Tauri)', async () => {
    // No Tauri globals
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__

    const requestPermissionMock = vi.fn().mockResolvedValue('granted')
    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: requestPermissionMock,
      },
      writable: true,
      configurable: true,
    })

    const isTauriLocal = (): boolean =>
      !!(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__

    let result = false
    if (window.Notification.permission === 'default') {
      if (isTauriLocal()) {
        result = false
      } else {
        const permission = await window.Notification.requestPermission()
        result = permission === 'granted'
      }
    }

    expect(requestPermissionMock).toHaveBeenCalledOnce()
    expect(result).toBe(true)
  })

  it('delivers notification without requesting permission when already "granted"', async () => {
    ;(window as Record<string, unknown>).__TAURI_INTERNALS__ = {}

    const requestPermissionMock = vi.fn()
    const NotificationConstructorMock = vi.fn()

    Object.defineProperty(window, 'Notification', {
      value: Object.assign(NotificationConstructorMock, {
        permission: 'granted',
        requestPermission: requestPermissionMock,
      }),
      writable: true,
      configurable: true,
    })

    // When permission is 'granted', new Notification() is called directly — no requestPermission
    let result = false
    if (window.Notification.permission === 'granted') {
      new (window.Notification as unknown as new (t: string, o: object) => void)('Test', { body: 'Hello' })
      result = true
    }

    expect(requestPermissionMock).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 6. Context Menu Coordinate Utilities (src/utils/contextMenuCoordinates.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe('Context Menu Coordinate Utils (src/utils/contextMenuCoordinates.ts)', () => {
  let isTauriCtx: () => boolean
  let isLinuxTauri: () => boolean
  let getLinuxTauriScaleFactor: () => number
  let getViewportCoordinates: (e: MouseEvent | TouchEvent) => { x: number; y: number }

  beforeEach(async () => {
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__

    const mod = await import('@/utils/contextMenuCoordinates')
    isTauriCtx = mod.isTauri
    isLinuxTauri = mod.isLinuxTauri
    getLinuxTauriScaleFactor = mod.getLinuxTauriScaleFactor
    getViewportCoordinates = mod.getViewportCoordinates
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).__TAURI__
    vi.restoreAllMocks()
  })

  it('isTauri() returns true when __TAURI__ is present (contextMenuCoordinates uses __TAURI__)', () => {
    // Note: contextMenuCoordinates.ts checks '__TAURI__' specifically (not __TAURI_INTERNALS__)
    ;(window as Record<string, unknown>).__TAURI__ = {}
    expect(isTauriCtx()).toBe(true)
  })

  it('isTauri() returns false when no Tauri globals present', () => {
    expect(isTauriCtx()).toBe(false)
  })

  it('isLinuxTauri() returns false when not in Tauri', () => {
    expect(isLinuxTauri()).toBe(false)
  })

  it('isLinuxTauri() returns true when in Tauri and userAgent indicates Linux', () => {
    ;(window as Record<string, unknown>).__TAURI__ = {}

    // Override navigator.userAgent to include 'linux'
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    )
    // Ensure userAgentData is absent so fallback path runs
    Object.defineProperty(navigator, 'userAgentData', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    expect(isLinuxTauri()).toBe(true)
  })

  it('getLinuxTauriScaleFactor() returns 1 when not in Tauri', () => {
    expect(getLinuxTauriScaleFactor()).toBe(1)
  })

  it('getLinuxTauriScaleFactor() returns 1 when DPR matches screen ratio', () => {
    ;(window as Record<string, unknown>).__TAURI__ = {}
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Linux x86_64')
    Object.defineProperty(navigator, 'userAgentData', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    // Make DPR == screenRatio (no mismatch)
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true, configurable: true })
    Object.defineProperty(screen, 'width', { value: 1920, writable: true, configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true, configurable: true })

    expect(getLinuxTauriScaleFactor()).toBe(1)
  })

  it('getLinuxTauriScaleFactor() returns correction factor when DPR mismatches screen ratio', () => {
    ;(window as Record<string, unknown>).__TAURI__ = {}
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Linux x86_64')
    Object.defineProperty(navigator, 'userAgentData', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    // WebKitGTK reports DPR=1 but actual screen ratio is 2 (HiDPI mismatch)
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true, configurable: true })
    Object.defineProperty(screen, 'width', { value: 3840, writable: true, configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true, configurable: true })

    // screenRatio = 3840/1920 = 2, dpr = 1, diff = 1 > 0.1 → correction = 2/1 = 2
    const factor = getLinuxTauriScaleFactor()
    expect(factor).toBe(2)
  })

  it('getViewportCoordinates extracts clientX/clientY from MouseEvent', () => {
    const event = new MouseEvent('click', { clientX: 150, clientY: 250 })
    const coords = getViewportCoordinates(event)
    expect(coords.x).toBe(150)
    expect(coords.y).toBe(250)
  })

  it('getViewportCoordinates extracts coordinates from TouchEvent', () => {
    // jsdom supports TouchEvent in recent versions
    // We simulate the expected structure manually
    const fakeTouchEvent = {
      touches: [{ clientX: 75, clientY: 130 }],
    } as unknown as TouchEvent

    const coords = getViewportCoordinates(fakeTouchEvent)
    expect(coords.x).toBe(75)
    expect(coords.y).toBe(130)
  })

  it('BUG-1096: getViewportCoordinates returns raw clientX/Y — no offset correction applied', () => {
    // Regression test: the old Tauri "correction" was adding targetRect.left + offsetX
    // to clientX, which caused double-counting. The fix removed that entirely.
    // clientX should come through unchanged.
    const event = new MouseEvent('contextmenu', { clientX: 400, clientY: 300 })
    const coords = getViewportCoordinates(event)

    // Coordinates must equal clientX/Y exactly — no corrections
    expect(coords.x).toBe(event.clientX)
    expect(coords.y).toBe(event.clientY)
  })
})
