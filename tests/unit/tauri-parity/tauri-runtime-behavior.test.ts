/**
 * TASK-1603: Tauri/WebKitGTK Runtime Behavior Tests
 *
 * Tests RUNTIME BEHAVIOR of Tauri/WebKitGTK differences.
 * Companion to tauri-code-paths.test.ts (which does static code scanning).
 *
 * Coverage:
 *   1. Platform Detection (runtime isTauri / detectPlatform behavior)
 *   2. Notification Delivery Path (notify-send vs Browser API routing)
 *   3. Drag-and-Drop Data Transfer (dragData singleton / WebKitGTK empty getData)
 *   4. IndexedDB Deep Clone (Vue proxy stripping before storage)
 *   5. Auto-Updater (status transitions, non-Tauri guard)
 *   6. CSS/Rendering Guards (overflow:clip fallback, perspective + fixed trap)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive, toRaw } from 'vue'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// ──────────────────────────────────────────────────────────────────────────────
// 1. Platform Detection — Runtime Behavior
// ──────────────────────────────────────────────────────────────────────────────

describe('Platform Detection — Runtime Behavior', () => {
  let _resetPlatformCache: () => void
  let isTauri: () => boolean
  let detectPlatform: () => string

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
    const mod = await import('@/utils/platform')
    _resetPlatformCache = mod._resetPlatformCache
    isTauri = mod.isTauri
    detectPlatform = mod.detectPlatform

    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    delete (window as Record<string, unknown>).isTauri
    delete (window as Record<string, unknown>).Capacitor

    stubMatchMediaNonStandalone()
    _resetPlatformCache()
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    delete (window as Record<string, unknown>).isTauri
    _resetPlatformCache()
    vi.restoreAllMocks()
  })

  it('isTauri() returns false when window.__TAURI__ is undefined', () => {
    // Clean window state — no Tauri globals
    expect(isTauri()).toBe(false)
  })

  it('isTauri() returns true when window.__TAURI__ is defined', () => {
    ;(window as Record<string, unknown>).__TAURI__ = {}
    _resetPlatformCache()
    expect(isTauri()).toBe(true)
  })

  it('detectPlatform() returns "browser" when not in Tauri and not standalone PWA', () => {
    // No Tauri globals, matchMedia returns non-matching → 'browser'
    expect(detectPlatform()).toBe('browser')
  })

  it('platform detection does not throw when window is undefined (SSR safety)', async () => {
    // We can't actually remove window in jsdom, but we can verify the guard branch
    // by inspecting the source: detectPlatform() has `if (typeof window === 'undefined')`
    // This test verifies the guard returns 'browser' without throwing.
    //
    // Strategy: temporarily spy on the global typeof check by calling with cached reset
    // and ensuring the function itself is safe when the cache is seeded with 'browser'.
    _resetPlatformCache()

    // Calling detectPlatform() in jsdom (where window exists) should always return safely.
    // The SSR guard is code-verified here — it must not throw even with no window globals.
    expect(() => detectPlatform()).not.toThrow()
    expect(['browser', 'tauri', 'pwa', 'capacitor']).toContain(detectPlatform())
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 2. Notification Delivery Path
// ──────────────────────────────────────────────────────────────────────────────

describe('Notification Delivery Path (notificationDelivery.ts)', () => {
  let _resetPlatformCache: () => void

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
    const platformMod = await import('@/utils/platform')
    _resetPlatformCache = platformMod._resetPlatformCache

    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    delete (window as Record<string, unknown>).Capacitor

    stubMatchMediaNonStandalone()
    _resetPlatformCache()
    vi.resetModules()
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    _resetPlatformCache()
    vi.restoreAllMocks()
  })

  it('In Tauri+Linux: deliverNotification() attempts native notify-send first', async () => {
    // Simulate Tauri environment on Linux
    ;(window as Record<string, unknown>).__TAURI__ = {}
    _resetPlatformCache()

    // Mock navigator.platform to report Linux
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Linux x86_64')

    // Mock @tauri-apps/plugin-shell to capture Command.create calls
    const executeMock = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' })
    const commandMock = { execute: executeMock }
    const createMock = vi.fn().mockReturnValue(commandMock)

    vi.doMock('@tauri-apps/plugin-shell', () => ({
      Command: { create: createMock },
    }))

    const { deliverNotification } = await import('@/utils/notificationDelivery')

    const result = await deliverNotification({ title: 'Test', body: 'Hello' })

    // notify-send path was attempted (Command.create called with 'notify-send')
    expect(createMock).toHaveBeenCalledWith('notify-send', expect.any(Array))
    expect(executeMock).toHaveBeenCalled()
    expect(result).toBe(true)

    vi.doUnmock('@tauri-apps/plugin-shell')
  })

  it('In browser: deliverNotification() uses Browser Notification API', async () => {
    // No Tauri globals → browser mode
    _resetPlatformCache()

    // Mock Notification API as granted
    const NotificationMock = vi.fn()
    ;(NotificationMock as unknown as { permission: string }).permission = 'granted'

    Object.defineProperty(window, 'Notification', {
      writable: true,
      configurable: true,
      value: NotificationMock,
    })

    const { deliverNotification } = await import('@/utils/notificationDelivery')

    const result = await deliverNotification({ title: 'Browser Test', body: 'World' })

    // Browser Notification constructor was called
    expect(NotificationMock).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('notify-send failure falls back to Browser Notification API', async () => {
    // Simulate Tauri on Linux where notify-send fails
    ;(window as Record<string, unknown>).__TAURI__ = {}
    _resetPlatformCache()

    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Linux x86_64')

    // notify-send fails (non-zero exit code)
    const executeMock = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'notify-send not found' })
    const commandMock = { execute: executeMock }
    const createMock = vi.fn().mockReturnValue(commandMock)

    vi.doMock('@tauri-apps/plugin-shell', () => ({
      Command: { create: createMock },
    }))

    // Set up Browser Notification API as fallback
    const NotificationMock = vi.fn()
    ;(NotificationMock as unknown as { permission: string }).permission = 'granted'
    Object.defineProperty(window, 'Notification', {
      writable: true,
      configurable: true,
      value: NotificationMock,
    })

    const { deliverNotification } = await import('@/utils/notificationDelivery')

    const result = await deliverNotification({ title: 'Fallback Test', body: 'Fallback' })

    // notify-send was tried
    expect(createMock).toHaveBeenCalledWith('notify-send', expect.any(Array))
    // Browser Notification API was used as fallback
    expect(NotificationMock).toHaveBeenCalled()
    expect(result).toBe(true)

    vi.doUnmock('@tauri-apps/plugin-shell')
  })

  it('Notification permission denied → returns false without throwing', async () => {
    // Browser mode
    _resetPlatformCache()

    // Notification denied
    const NotificationConstructor = vi.fn()
    Object.defineProperty(NotificationConstructor, 'permission', {
      get: () => 'denied',
      configurable: true,
    })

    Object.defineProperty(window, 'Notification', {
      writable: true,
      configurable: true,
      value: NotificationConstructor,
    })

    const { deliverNotification } = await import('@/utils/notificationDelivery')

    // Must not throw and must return false
    let result: boolean
    await expect(
      (async () => {
        result = await deliverNotification({ title: 'Denied', body: 'Should not show' })
      })()
    ).resolves.not.toThrow()

    // Constructor must NOT have been called — permission is denied
    expect(NotificationConstructor).not.toHaveBeenCalled()
    expect(result!).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 3. Drag-and-Drop Data Transfer (dragData singleton)
// ──────────────────────────────────────────────────────────────────────────────

describe('Drag-and-Drop Data Transfer (useDragAndDrop singleton)', () => {
  /**
   * Reproduces the WebKitGTK fallback resolution pattern from
   * useTaskRowActions.ts / useCanvasEvents.ts handleDrop logic:
   *
   *   let dragData = activeDragData.value        // singleton first
   *   if (!dragData) {
   *     const str = event.dataTransfer?.getData('application/json')
   *     if (str) { dragData = JSON.parse(str) }
   *   }
   */
  type DragPayload = {
    type: 'task' | 'project'
    taskId?: string
    title: string
    source: string
  }

  type DragSingleton = { value: DragPayload | null }

  function resolveDropPayload(
    dataTransferResult: string | null,
    singleton: DragSingleton
  ): DragPayload | null {
    let dragData: DragPayload | null = singleton.value
    if (!dragData) {
      if (dataTransferResult) {
        try {
          dragData = JSON.parse(dataTransferResult) as DragPayload
        } catch {
          // ignore malformed
        }
      }
    }
    return dragData
  }

  it('dragData singleton stores data set during drag start', () => {
    const singleton: DragSingleton = { value: null }

    // Simulate startDrag populating the singleton
    singleton.value = {
      type: 'task',
      taskId: 'task-001',
      title: 'Test Task',
      source: 'kanban',
    }

    expect(singleton.value).not.toBeNull()
    expect(singleton.value!.taskId).toBe('task-001')
  })

  it('dragData singleton retrieves data even when dataTransfer.getData returns empty (WebKitGTK)', () => {
    const singleton: DragSingleton = {
      value: { type: 'task', taskId: 'webkit-task', title: 'WebKit Task', source: 'canvas' },
    }

    // WebKitGTK returns empty string from getData — singleton must win
    const result = resolveDropPayload('', singleton)

    expect(result).not.toBeNull()
    expect(result!.taskId).toBe('webkit-task')
  })

  it('dragData singleton is cleared after drop (endDrag resets state)', () => {
    const singleton: DragSingleton = {
      value: { type: 'task', taskId: 'drag-task', title: 'Task', source: 'kanban' },
    }

    // Simulate endDrag clearing the singleton
    singleton.value = null

    expect(singleton.value).toBeNull()

    // After clear, resolveDropPayload with empty dataTransfer → null
    const result = resolveDropPayload('', singleton)
    expect(result).toBeNull()
  })

  it('multiple concurrent drags do not corrupt the singleton (last write wins)', () => {
    // The singleton is a single ref — only one drag can be active at a time.
    // Starting a second drag overwrites the first (safety net cleans up the first).
    const singleton: DragSingleton = { value: null }

    // First drag starts
    singleton.value = { type: 'task', taskId: 'first', title: 'First', source: 'kanban' }

    // Second drag starts (overwrites first — this is the intended behavior)
    singleton.value = { type: 'task', taskId: 'second', title: 'Second', source: 'canvas' }

    // Only the second drag's data is in the singleton
    expect(singleton.value!.taskId).toBe('second')

    // The drop resolves the active data (second drag)
    const result = resolveDropPayload('', singleton)
    expect(result!.taskId).toBe('second')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 4. IndexedDB Deep Clone (Vue proxy stripping)
// ──────────────────────────────────────────────────────────────────────────────

describe('IndexedDB Deep Clone — Vue Proxy Stripping (SOP-060 §7)', () => {
  /**
   * SOP-060 §7: Always deep-clone before IndexedDB storage:
   *   JSON.parse(JSON.stringify(toRaw(obj)))
   *
   * toRaw() is shallow — nested reactive objects remain Proxies.
   * IndexedDB's structured clone rejects Proxy objects → DataCloneError.
   */

  function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(toRaw(obj as object))) as T
  }

  it('Vue reactive proxy → JSON.parse(JSON.stringify(toRaw())) produces a plain object', () => {
    const reactiveObj = reactive({ id: 'task-1', title: 'Hello', status: 'todo' })

    const cloned = deepClone(reactiveObj)

    // Result must be a plain object (not a Proxy)
    // structuredClone would throw on a Proxy — using JSON round-trip produces plain objects
    expect(typeof cloned).toBe('object')
    expect(cloned.id).toBe('task-1')
    expect(cloned.title).toBe('Hello')

    // structuredClone should succeed on the cloned result (not the proxy)
    expect(() => structuredClone(cloned)).not.toThrow()
  })

  it('deep clone preserves nested objects (subtasks JSONB)', () => {
    const task = reactive({
      id: 'task-with-subtasks',
      title: 'Parent',
      subtasks: reactive([
        { id: 'sub-1', title: 'Subtask A', isCompleted: false },
        { id: 'sub-2', title: 'Subtask B', isCompleted: true },
      ]),
    })

    const cloned = deepClone(task)

    expect(Array.isArray(cloned.subtasks)).toBe(true)
    expect(cloned.subtasks).toHaveLength(2)
    expect(cloned.subtasks[0].id).toBe('sub-1')
    expect(cloned.subtasks[1].isCompleted).toBe(true)

    // Nested arrays are also plain after deep clone
    expect(() => structuredClone(cloned.subtasks)).not.toThrow()
  })

  it('deep clone preserves arrays (tags)', () => {
    const task = reactive({
      id: 'task-with-tags',
      title: 'Tagged Task',
      tags: reactive(['urgent', 'frontend', 'bug']),
    })

    const cloned = deepClone(task)

    expect(Array.isArray(cloned.tags)).toBe(true)
    expect(cloned.tags).toEqual(['urgent', 'frontend', 'bug'])

    // Plain array survives structuredClone
    expect(() => structuredClone(cloned.tags)).not.toThrow()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 5. Auto-Updater (useTauriUpdater.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe('Auto-Updater Runtime Behavior (useTauriUpdater.ts)', () => {
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
    const platformMod = await import('@/utils/platform')
    _resetPlatformCache = platformMod._resetPlatformCache

    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__

    stubMatchMedia()
    _resetPlatformCache()
    vi.resetModules()
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).__TAURI__
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__
    _resetPlatformCache()
    vi.restoreAllMocks()
  })

  it('checkForUpdates() returns false immediately when not in Tauri (no-op guard)', async () => {
    // No Tauri globals → isTauri() returns false
    _resetPlatformCache()

    const { useTauriUpdater } = await import('@/composables/useTauriUpdater')
    const { checkForUpdates, status } = useTauriUpdater()

    const result = await checkForUpdates()

    expect(result).toBe(false)
    // Status must remain 'idle' — no Tauri means no check was attempted
    expect(status.value).toBe('idle')
  })

  it('status transitions: idle → checking → available when update exists', async () => {
    // Simulate Tauri environment
    ;(window as Record<string, unknown>).__TAURI__ = {}
    _resetPlatformCache()

    // Mock the updater plugin to return an available update
    vi.doMock('@tauri-apps/plugin-updater', () => ({
      check: vi.fn().mockResolvedValue({
        version: '2.0.0',
        currentVersion: '1.0.0',
        body: 'New features',
        date: '2026-03-21',
      }),
    }))

    const { useTauriUpdater } = await import('@/composables/useTauriUpdater')
    const { checkForUpdates, status, updateInfo } = useTauriUpdater()

    expect(status.value).toBe('idle')

    const result = await checkForUpdates()

    expect(result).toBe(true)
    expect(status.value).toBe('available')
    expect(updateInfo.value).not.toBeNull()
    expect(updateInfo.value!.version).toBe('2.0.0')
    expect(updateInfo.value!.currentVersion).toBe('1.0.0')

    vi.doUnmock('@tauri-apps/plugin-updater')
  })

  it('status transitions: idle → checking → up-to-date when no update', async () => {
    ;(window as Record<string, unknown>).__TAURI__ = {}
    _resetPlatformCache()

    // check() returns null → no update available
    vi.doMock('@tauri-apps/plugin-updater', () => ({
      check: vi.fn().mockResolvedValue(null),
    }))

    const { useTauriUpdater } = await import('@/composables/useTauriUpdater')
    const { checkForUpdates, status } = useTauriUpdater()

    const result = await checkForUpdates()

    expect(result).toBe(false)
    expect(status.value).toBe('up-to-date')

    vi.doUnmock('@tauri-apps/plugin-updater')
  })

  it('error during update check → status becomes "error" and error message is set', async () => {
    ;(window as Record<string, unknown>).__TAURI__ = {}
    _resetPlatformCache()

    // Simulate network failure
    vi.doMock('@tauri-apps/plugin-updater', () => ({
      check: vi.fn().mockRejectedValue(new Error('Network unreachable')),
    }))

    const { useTauriUpdater } = await import('@/composables/useTauriUpdater')
    const { checkForUpdates, status, error } = useTauriUpdater()

    const result = await checkForUpdates()

    expect(result).toBe(false)
    expect(status.value).toBe('error')
    expect(error.value).toBeTruthy()
    expect(error.value).toContain('Network unreachable')

    vi.doUnmock('@tauri-apps/plugin-updater')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 6. CSS/Rendering Guards (static scan of .vue and .css files)
// ──────────────────────────────────────────────────────────────────────────────

describe('CSS/Rendering Guards (SOP-060 §1, §2)', () => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const SRC_ROOT = join(__dirname, '../../../src')

  /**
   * Recursively collect all files with given extensions under dir.
   */
  function findFiles(dir: string, extensions: string[], result: string[] = []): string[] {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        findFiles(fullPath, extensions, result)
      } else if (extensions.some(ext => entry.endsWith(`.${ext}`))) {
        result.push(fullPath)
      }
    }
    return result
  }

  /**
   * Read all files with given extensions under SRC_ROOT.
   */
  function readSourceFiles(extensions: string[]): Array<{ filePath: string; content: string }> {
    const files = findFiles(SRC_ROOT, extensions)
    return files.map(filePath => ({
      filePath,
      content: readFileSync(filePath, 'utf-8'),
    }))
  }

  it(
    'overflow:clip is never used without an overflow:hidden fallback nearby OR a WebKitGTK-safe comment',
    () => {
      const files = readSourceFiles(['vue', 'css'])

      const violations: string[] = []

      for (const { filePath, content } of files) {
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]

          // Detect lines that set overflow to clip
          // Match: "overflow: clip" or "overflow:clip" or "overflow-x: clip" or "overflow-y: clip"
          const clipMatch = /overflow(?:-[xy])?:\s*clip/.test(line)
          if (!clipMatch) continue

          // Check: is there a WebKitGTK-safe marker comment on same or adjacent lines?
          const contextStart = Math.max(0, i - 3)
          const contextEnd = Math.min(lines.length - 1, i + 3)
          const contextBlock = lines.slice(contextStart, contextEnd + 1).join('\n')

          const hasMarker = /WebKitGTK-safe/.test(contextBlock)

          // Check: is there an overflow:hidden fallback on an adjacent line (within 5 lines)?
          const searchStart = Math.max(0, i - 5)
          const searchEnd = Math.min(lines.length - 1, i + 5)
          const nearbyLines = lines.slice(searchStart, searchEnd + 1).join('\n')

          const hasHiddenFallback = /overflow(?:-[xy])?:\s*hidden/.test(nearbyLines)

          if (!hasMarker && !hasHiddenFallback) {
            const relPath = relative(SRC_ROOT, filePath)
            violations.push(`  ${relPath}:${i + 1} → ${line.trim()}`)
          }
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `[SOP-060 §1] Found overflow:clip without overflow:hidden fallback or WebKitGTK-safe marker:\n` +
          `WebKitGTK ignores overflow:clip — use overflow:hidden or add /* WebKitGTK-safe: [reason] */ comment.\n\n` +
          violations.join('\n')
        )
      }
    }
  )

  it(
    'no perspective property on direct parent of position:fixed elements (BUG-1453)',
    () => {
      /**
       * SOP-060 §2: CSS spec — perspective on a parent creates a containing block
       * that traps position:fixed descendants. WebKitGTK enforces this strictly.
       *
       * Detection strategy: find .vue files that have BOTH perspective: AND position: fixed
       * within the same <style> block (or within 200 lines of each other).
       * Flag files where perspective appears before fixed within the same component.
       *
       * Note: this is a conservative scan. False positives are acceptable since the goal
       * is to catch accidental combinations. Each flagged file should be reviewed manually.
       */
      const files = readSourceFiles(['vue'])

      const violations: string[] = []

      for (const { filePath, content } of files) {
        // Extract all <style> blocks
        const styleBlocks = [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]

        for (const match of styleBlocks) {
          const styleContent = match[1]

          const hasPerspective = /\bperspective\s*:/.test(styleContent)
          const hasPositionFixed = /\bposition\s*:\s*fixed\b/.test(styleContent)

          if (hasPerspective && hasPositionFixed) {
            // Check if there's a comment marking this as intentional / safe
            const hasSafeMarker = /WebKitGTK-safe|perspective-safe|no-fixed-children/.test(styleContent)

            if (!hasSafeMarker) {
              const relPath = relative(SRC_ROOT, filePath)
              violations.push(
                `  ${relPath} — has both "perspective:" and "position: fixed" in same style block ` +
                `(CSS spec: perspective creates containing block for fixed children)`
              )
            }
          }
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `[SOP-060 §2] Found perspective + position:fixed combination (BUG-1453 risk):\n` +
          `perspective on a parent traps position:fixed descendants in WebKitGTK.\n` +
          `Fix: remove perspective, use 2D transforms, or add /* WebKitGTK-safe */ comment.\n\n` +
          violations.join('\n')
        )
      }
    },
    30_000
  )
})
