/**
 * Canvas Position Lock Utility
 *
 * Prevents sync operations from overwriting locally-changed task positions
 * for a configurable time window after the position change.
 *
 * This fixes the race condition where:
 * 1. User drags task to new position
 * 2. Sync pulls stale data from CouchDB before local push completes
 * 3. updateTaskFromSync() would overwrite the new position with old data
 *
 * The lock ensures local position changes have priority for 5 seconds,
 * giving enough time for the local->remote push to complete.
 */

interface PositionLock {
  taskId: string
  lockedAt: number
  position: { x: number; y: number }
}

const positionLocks = new Map<string, PositionLock>()
const LOCK_DURATION_MS = 5000 // 5 seconds - time for push to complete

/**
 * Lock a task's position after a local drag operation.
 * The lock prevents sync from overwriting this position for LOCK_DURATION_MS.
 */
export function lockTaskPosition(taskId: string, position: { x: number; y: number }): void {
  positionLocks.set(taskId, {
    taskId,
    lockedAt: Date.now(),
    position: { ...position } // Clone to prevent mutation
  })
  console.log(`🔒 [POSITION-LOCK] Locked position for ${taskId} at (${position.x.toFixed(0)}, ${position.y.toFixed(0)})`)
}

/**
 * Check if a task's position is currently locked.
 * Returns false if lock has expired.
 */
export function isPositionLocked(taskId: string): boolean {
  const lock = positionLocks.get(taskId)
  if (!lock) return false

  // Check if lock has expired
  if (Date.now() - lock.lockedAt > LOCK_DURATION_MS) {
    positionLocks.delete(taskId)
    console.log(`🔓 [POSITION-LOCK] Lock expired for ${taskId}`)
    return false
  }

  return true
}

/**
 * Get the locked position for a task.
 * Returns null if no lock exists or lock has expired.
 */
export function getLockedPosition(taskId: string): { x: number; y: number } | null {
  if (!isPositionLocked(taskId)) return null

  const lock = positionLocks.get(taskId)
  return lock?.position ?? null
}

/**
 * Manually clear a position lock.
 */
export function clearLock(taskId: string): void {
  if (positionLocks.has(taskId)) {
    positionLocks.delete(taskId)
    console.log(`🔓 [POSITION-LOCK] Manually cleared lock for ${taskId}`)
  }
}

/**
 * Clear all expired locks.
 * Called periodically to prevent memory leaks.
 */
export function clearExpiredLocks(): void {
  const now = Date.now()
  const toDelete: string[] = []

  positionLocks.forEach((lock, taskId) => {
    if (now - lock.lockedAt > LOCK_DURATION_MS) {
      toDelete.push(taskId)
    }
  })

  toDelete.forEach(taskId => positionLocks.delete(taskId))

  if (toDelete.length > 0) {
    console.log(`🔓 [POSITION-LOCK] Cleared ${toDelete.length} expired locks`)
  }
}

/**
 * Get debug info about current locks.
 */
export function getLocksDebugInfo(): Array<{ taskId: string; age: number; position: { x: number; y: number } }> {
  const now = Date.now()
  const result: Array<{ taskId: string; age: number; position: { x: number; y: number } }> = []
  positionLocks.forEach(lock => {
    result.push({
      taskId: lock.taskId,
      age: now - lock.lockedAt,
      position: lock.position
    })
  })
  return result
}

// Expose debug helpers on window for console debugging
if (typeof window !== 'undefined') {
  (window as any).__positionLocks = {
    list: () => getLocksDebugInfo(),
    clear: () => {
      positionLocks.clear()
      console.log('🔓 [POSITION-LOCK] All locks cleared')
    },
    isLocked: (taskId: string) => isPositionLocked(taskId),
    getPosition: (taskId: string) => getLockedPosition(taskId)
  }
}

// Auto-cleanup expired locks every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(clearExpiredLocks, 30000)
}
