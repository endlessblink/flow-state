/**
 * Unified Canvas State Lock Utility (TASK-089)
 *
 * Prevents sync operations from overwriting locally-changed canvas state
 * for a configurable time window after the state change.
 *
 * This fixes race conditions where:
 * 1. User drags/resizes a group or task, or pans/zooms viewport
 * 2. Sync pulls stale data from CouchDB before local push completes
 * 3. updateSectionFromSync() or syncNodes() would overwrite with old data
 *
 * The lock ensures local state changes have priority for 7 seconds,
 * giving enough time for the local->remote push to complete.
 *
 * Supports three lock types:
 * - 'task': Task positions (replaces canvasPositionLock.ts for tasks)
 * - 'group': Group/section positions and dimensions
 * - 'viewport': Canvas viewport (pan/zoom state)
 */

export type CanvasLockType = 'task' | 'group' | 'viewport'

export interface GroupPosition {
  x: number
  y: number
  width: number
  height: number
}

export interface ViewportState {
  x: number
  y: number
  zoom: number
}

export interface TaskPosition {
  x: number
  y: number
}

interface CanvasLock {
  type: CanvasLockType
  id: string
  data: TaskPosition | GroupPosition | ViewportState
  lockedAt: number
  source: 'drag' | 'resize' | 'pan' | 'zoom' | 'manual'
}

// Separate maps for each lock type for faster lookup
const taskLocks = new Map<string, CanvasLock>()
const groupLocks = new Map<string, CanvasLock>()
const viewportLock: { current: CanvasLock | null } = { current: null }

// 7 seconds - longer than the previous 5s to account for sync delays
const LOCK_DURATION_MS = 7000

/**
 * Lock a task's position after a local drag operation.
 */
export function lockTaskPosition(taskId: string, position: TaskPosition, source: CanvasLock['source'] = 'drag'): void {
  const lock: CanvasLock = {
    type: 'task',
    id: taskId,
    data: { ...position },
    lockedAt: Date.now(),
    source
  }
  taskLocks.set(taskId, lock)
  console.log(`🔒 [CANVAS-LOCK] Task ${taskId} locked at (${position.x.toFixed(0)}, ${position.y.toFixed(0)}) [${source}]`)
}

/**
 * Lock a group/section's position and dimensions after drag/resize.
 */
export function lockGroupPosition(groupId: string, position: GroupPosition, source: CanvasLock['source'] = 'drag'): void {
  const lock: CanvasLock = {
    type: 'group',
    id: groupId,
    data: { ...position },
    lockedAt: Date.now(),
    source
  }
  groupLocks.set(groupId, lock)
  console.log(`🔒 [CANVAS-LOCK] Group ${groupId} locked at (${position.x.toFixed(0)}, ${position.y.toFixed(0)}) ${position.width}x${position.height} [${source}]`)
}

/**
 * Lock the viewport state after pan/zoom.
 */
export function lockViewport(viewport: ViewportState, source: CanvasLock['source'] = 'pan'): void {
  viewportLock.current = {
    type: 'viewport',
    id: 'viewport',
    data: { ...viewport },
    lockedAt: Date.now(),
    source
  }
  console.log(`🔒 [CANVAS-LOCK] Viewport locked at (${viewport.x.toFixed(0)}, ${viewport.y.toFixed(0)}) zoom=${viewport.zoom.toFixed(2)} [${source}]`)
}

/**
 * Check if a lock exists and is not expired.
 */
function isLockValid(lock: CanvasLock | null | undefined): boolean {
  if (!lock) return false
  if (Date.now() - lock.lockedAt > LOCK_DURATION_MS) {
    return false
  }
  return true
}

/**
 * Check if a task's position is currently locked.
 */
export function isTaskPositionLocked(taskId: string): boolean {
  const lock = taskLocks.get(taskId)
  if (!isLockValid(lock)) {
    if (lock) {
      taskLocks.delete(taskId)
      console.log(`🔓 [CANVAS-LOCK] Task ${taskId} lock expired`)
    }
    return false
  }
  return true
}

/**
 * Check if a group's position/dimensions are currently locked.
 */
export function isGroupPositionLocked(groupId: string): boolean {
  const lock = groupLocks.get(groupId)
  if (!isLockValid(lock)) {
    if (lock) {
      groupLocks.delete(groupId)
      console.log(`🔓 [CANVAS-LOCK] Group ${groupId} lock expired`)
    }
    return false
  }
  return true
}

/**
 * Check if viewport is currently locked.
 */
export function isViewportLocked(): boolean {
  if (!isLockValid(viewportLock.current)) {
    if (viewportLock.current) {
      console.log(`🔓 [CANVAS-LOCK] Viewport lock expired`)
      viewportLock.current = null
    }
    return false
  }
  return true
}

/**
 * Check if ANY canvas state is currently locked.
 * Useful for guards in syncNodes().
 */
export function isAnyCanvasStateLocked(): boolean {
  // Check task locks
  for (const [taskId, lock] of taskLocks) {
    if (isLockValid(lock)) return true
    taskLocks.delete(taskId)
  }
  // Check group locks
  for (const [groupId, lock] of groupLocks) {
    if (isLockValid(lock)) return true
    groupLocks.delete(groupId)
  }
  // Check viewport lock
  if (isLockValid(viewportLock.current)) return true

  return false
}

/**
 * Get the locked position for a task.
 */
export function getLockedTaskPosition(taskId: string): TaskPosition | null {
  if (!isTaskPositionLocked(taskId)) return null
  const lock = taskLocks.get(taskId)
  return lock?.data as TaskPosition ?? null
}

/**
 * Get the locked position/dimensions for a group.
 */
export function getLockedGroupPosition(groupId: string): GroupPosition | null {
  if (!isGroupPositionLocked(groupId)) return null
  const lock = groupLocks.get(groupId)
  return lock?.data as GroupPosition ?? null
}

/**
 * Get the locked viewport state.
 */
export function getLockedViewport(): ViewportState | null {
  if (!isViewportLocked()) return null
  return viewportLock.current?.data as ViewportState ?? null
}

/**
 * Manually clear a specific lock.
 */
export function clearTaskLock(taskId: string): void {
  if (taskLocks.has(taskId)) {
    taskLocks.delete(taskId)
    console.log(`🔓 [CANVAS-LOCK] Task ${taskId} lock cleared manually`)
  }
}

export function clearGroupLock(groupId: string): void {
  if (groupLocks.has(groupId)) {
    groupLocks.delete(groupId)
    console.log(`🔓 [CANVAS-LOCK] Group ${groupId} lock cleared manually`)
  }
}

export function clearViewportLock(): void {
  if (viewportLock.current) {
    viewportLock.current = null
    console.log(`🔓 [CANVAS-LOCK] Viewport lock cleared manually`)
  }
}

/**
 * Clear all locks (use sparingly, mainly for testing).
 */
export function clearAllLocks(): void {
  const taskCount = taskLocks.size
  const groupCount = groupLocks.size
  const hasViewport = viewportLock.current !== null

  taskLocks.clear()
  groupLocks.clear()
  viewportLock.current = null

  console.log(`🔓 [CANVAS-LOCK] All locks cleared (${taskCount} tasks, ${groupCount} groups, viewport: ${hasViewport})`)
}

/**
 * Clear all expired locks.
 */
export function clearExpiredLocks(): void {
  const now = Date.now()
  let clearedCount = 0

  // Clean task locks
  for (const [taskId, lock] of taskLocks) {
    if (now - lock.lockedAt > LOCK_DURATION_MS) {
      taskLocks.delete(taskId)
      clearedCount++
    }
  }

  // Clean group locks
  for (const [groupId, lock] of groupLocks) {
    if (now - lock.lockedAt > LOCK_DURATION_MS) {
      groupLocks.delete(groupId)
      clearedCount++
    }
  }

  // Clean viewport lock
  if (viewportLock.current && now - viewportLock.current.lockedAt > LOCK_DURATION_MS) {
    viewportLock.current = null
    clearedCount++
  }

  if (clearedCount > 0) {
    console.log(`🔓 [CANVAS-LOCK] Cleared ${clearedCount} expired locks`)
  }
}

/**
 * Get debug info about all current locks.
 */
export function getLocksDebugInfo(): {
  tasks: Array<{ id: string; age: number; position: TaskPosition; source: string }>
  groups: Array<{ id: string; age: number; position: GroupPosition; source: string }>
  viewport: { age: number; state: ViewportState; source: string } | null
} {
  const now = Date.now()

  const tasks: Array<{ id: string; age: number; position: TaskPosition; source: string }> = []
  taskLocks.forEach(lock => {
    tasks.push({
      id: lock.id,
      age: now - lock.lockedAt,
      position: lock.data as TaskPosition,
      source: lock.source
    })
  })

  const groups: Array<{ id: string; age: number; position: GroupPosition; source: string }> = []
  groupLocks.forEach(lock => {
    groups.push({
      id: lock.id,
      age: now - lock.lockedAt,
      position: lock.data as GroupPosition,
      source: lock.source
    })
  })

  let viewport = null
  if (viewportLock.current) {
    viewport = {
      age: now - viewportLock.current.lockedAt,
      state: viewportLock.current.data as ViewportState,
      source: viewportLock.current.source
    }
  }

  return { tasks, groups, viewport }
}

// Expose debug helpers on window for console debugging
if (typeof window !== 'undefined') {
  (window as any).__canvasLocks = {
    list: () => getLocksDebugInfo(),
    clearAll: clearAllLocks,
    clearExpired: clearExpiredLocks,
    isAnyLocked: isAnyCanvasStateLocked,
    task: {
      isLocked: isTaskPositionLocked,
      getPosition: getLockedTaskPosition,
      lock: lockTaskPosition,
      clear: clearTaskLock
    },
    group: {
      isLocked: isGroupPositionLocked,
      getPosition: getLockedGroupPosition,
      lock: lockGroupPosition,
      clear: clearGroupLock
    },
    viewport: {
      isLocked: isViewportLocked,
      getState: getLockedViewport,
      lock: lockViewport,
      clear: clearViewportLock
    }
  }
}

// Auto-cleanup expired locks every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(clearExpiredLocks, 30000)
}

// Re-export the old function names for backward compatibility with existing code
// that uses canvasPositionLock.ts
export {
  lockTaskPosition as lockTaskPositionLegacy,
  isTaskPositionLocked as isPositionLocked,
  getLockedTaskPosition as getLockedPosition,
  clearTaskLock as clearLock
}
