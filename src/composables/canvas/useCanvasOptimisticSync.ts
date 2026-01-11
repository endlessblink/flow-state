import { ref } from 'vue'

interface PendingChange {
    type: 'task' | 'group'
    position: { x: number; y: number }
    timestamp: number
    synced: boolean
}

const pendingChanges = ref(new Map<string, PendingChange>())

export function useCanvasOptimisticSync() {
    /**
     * Track a local position change with timestamp.
     * Called when user drags a node.
     */
    const trackLocalChange = (
        id: string,
        type: 'task' | 'group',
        position: { x: number; y: number }
    ) => {
        pendingChanges.value.set(id, {
            type,
            position,
            timestamp: Date.now(),
            synced: false
        })
    }

    /**
     * Determine if we should accept a remote position change.
     * Reject if we have a newer local change that hasn't synced yet.
     */
    const shouldAcceptRemoteChange = (
        id: string,
        remoteTimestamp: number
    ): boolean => {
        const pending = pendingChanges.value.get(id)

        // No local change pending - accept remote
        if (!pending) return true

        // Remote is newer than our local change - accept it
        if (remoteTimestamp > pending.timestamp) {
            pendingChanges.value.delete(id)
            return true
        }

        // Our local change is newer - reject remote
        return false
    }

    /**
     * Mark a local change as synced to server.
     * Called after successful Supabase push.
     */
    const markSynced = (id: string) => {
        const pending = pendingChanges.value.get(id)
        if (pending) {
            pending.synced = true
            // Clean up after confirmation window (1s)
            setTimeout(() => pendingChanges.value.delete(id), 1000)
        }
    }

    /**
     * Get the pending local position if it exists.
     * Use this instead of lock position checks.
     */
    const getPendingPosition = (id: string): { x: number; y: number } | null => {
        const pending = pendingChanges.value.get(id)
        return pending ? pending.position : null
    }

    /**
     * Check if any changes are pending.
     */
    const hasPendingChanges = (): boolean => {
        return pendingChanges.value.size > 0
    }

    return {
        trackLocalChange,
        shouldAcceptRemoteChange,
        markSynced,
        getPendingPosition,
        hasPendingChanges,
        pendingChanges
    }
}
