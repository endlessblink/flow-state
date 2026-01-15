import { reactive } from 'vue'
import type { LockSource } from './types'

interface LockState {
    source: LockSource
    timestamp: number
    timeoutId?: number | NodeJS.Timeout
}

/**
 * LockManager
 * 
 * Manages write locks for canvas nodes to prevent race conditions.
 * 
 * CORE PRINCIPLE:
 * - Only ONE source can own a lock on a node at a time.
 * - 'user-drag' is the highest priority implicitly (UI should acquire it).
 * - Locks auto-expire to prevent deadlocks.
 */
class LockManager {
    private locks: Map<string, LockState> = reactive(new Map())
    private readonly DEFAULT_TIMEOUT_MS = 5000 // 5 seconds default safety valve

    /**
     * Attempt to acquire a lock for a node.
     * @returns true if lock acquired, false if already locked by another source
     */
    acquire(nodeId: string, source: LockSource, timeoutMs?: number): boolean {
        const existing = this.locks.get(nodeId)
        const now = Date.now()

        // If already locked by someone else, deny
        if (existing && existing.source !== source) {
            // Check if expired (safety check if timeout logic failed)
            const isExpired = now - existing.timestamp > this.DEFAULT_TIMEOUT_MS * 2
            if (!isExpired) {
                return false
            }
            console.warn(`[LockManager] Force-breaking stale lock on ${nodeId} from ${existing.source}`)
        }

        // Clear existing timeout if we are refreshing our own lock
        if (existing?.timeoutId) {
            clearTimeout(existing.timeoutId)
        }

        // Set new lock
        const duration = timeoutMs ?? this.DEFAULT_TIMEOUT_MS
        const timeoutId = setTimeout(() => {
            this.release(nodeId, source)
        }, duration)

        this.locks.set(nodeId, {
            source,
            timestamp: now,
            timeoutId
        })

        return true
    }

    /**
     * Release a lock.
     * Only the owner can release their lock (unless force=true)
     */
    release(nodeId: string, source: LockSource, force = false): boolean {
        const existing = this.locks.get(nodeId)

        if (!existing) return true // Already free

        if (existing.source !== source && !force) {
            console.warn(`[LockManager] Unauthorized release attempt on ${nodeId} by ${source} (owned by ${existing.source})`)
            return false
        }

        if (existing.timeoutId) {
            clearTimeout(existing.timeoutId)
        }

        this.locks.delete(nodeId)
        return true
    }

    /**
     * Check if a node is currently locked by ANY source.
     */
    isLocked(nodeId: string): boolean {
        return this.locks.has(nodeId)
    }

    /**
     * Get the current owner of a lock
     */
    getLockOwner(nodeId: string): LockSource | null {
        return this.locks.get(nodeId)?.source || null
    }

    /**
     * Force clear all locks (useful for reset/unmount)
     */
    clearAll() {
        this.locks.forEach(lock => {
            if (lock.timeoutId) clearTimeout(lock.timeoutId)
        })
        this.locks.clear()
    }
}

// Export as singleton
export const lockManager = new LockManager()
