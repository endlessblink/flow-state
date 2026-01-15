import { reactive, readonly } from 'vue'
import { lockManager } from './LockManager'
import type { NodePosition, Position2D, LockSource } from './types'

/**
 * PositionManager
 * 
 * The Single Source of Truth for all canvas node positions.
 * 
 * RESPONSIBILITIES:
 * 1. Maintain a reactive map of all node positions (tasks & groups).
 * 2. Enforce locking before allowing updates.
 * 3. Provide "optimistic" UI updates while syncing allows for rollback (Phase 2).
 * 4. Abstract away "relative" vs "absolute" logic eventually (Phase 4).
 */
class PositionManager {
    // The master registry of positions
    private positions: Map<string, NodePosition> = reactive(new Map())

    // Event subscribers
    private subscribers: Set<(event: any) => void> = new Set()

    /**
     * Update a node's position.
     * securely acquires lock or validates existing lock.
     */
    updatePosition(
        nodeId: string,
        position: Position2D,
        source: LockSource,
        parentId: string | null = null
    ): boolean {
        // 1. Concurrency Check
        if (!lockManager.acquire(nodeId, source)) {
            console.warn(`[PositionManager] Update rejected for ${nodeId} from ${source} - Locked by ${lockManager.getLockOwner(nodeId)}`)
            return false
        }

        // 2. State Update
        const current = this.positions.get(nodeId)

        // Optimization: Skip if no change (roughly)
        if (
            current &&
            Math.abs(current.position.x - position.x) < 0.01 &&
            Math.abs(current.position.y - position.y) < 0.01 &&
            current.parentId === parentId
        ) {
            return true
        }

        this.positions.set(nodeId, {
            id: nodeId,
            position: { ...position },
            parentId
        })

        // 3. Notify subscribers
        this.notify({
            type: 'position-changed',
            nodeId,
            payload: { position, parentId, source }
        })

        return true
    }

    /**
     * Batch update positions (e.g. from Database Sync)
     * This is efficient for initial load or large syncs.
     */
    batchUpdate(
        updates: { id: string; x: number; y: number; parentId?: string | null }[],
        source: LockSource
    ) {
        let successCount = 0
        updates.forEach(update => {
            // For sync, we don't necessarily need to lock hard if we trust the DB,
            // BUT if the user is dragging, we should respect the user lock.
            // So we try to acquire with 'remote-sync'. If user has 'user-drag', it will fail (Good!)

            const success = this.updatePosition(
                update.id,
                { x: update.x, y: update.y },
                source,
                update.parentId ?? null
            )

            if (success) successCount++
        })

        return successCount
    }

    /**
     * GET current position truth
     */
    getPosition(nodeId: string): NodePosition | undefined {
        return this.positions.get(nodeId)
    }

    /**
     * GET read-only map for Vue Flow binding
     */
    getAllPositions() {
        return readonly(this.positions)
    }

    /**
     * Clear state (e.g. on unmount or logout)
     */
    clear() {
        this.positions.clear()
        lockManager.clearAll()
    }

    // -- Event System --

    subscribe(callback: (event: any) => void) {
        this.subscribers.add(callback)
        return () => this.subscribers.delete(callback)
    }

    private notify(event: any) {
        this.subscribers.forEach(cb => {
            try {
                cb(event)
            } catch (e) {
                console.error('[PositionManager] Subscriber error:', e)
            }
        })
    }
}

export const positionManager = new PositionManager()
