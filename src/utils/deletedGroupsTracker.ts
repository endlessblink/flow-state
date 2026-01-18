/**
 * TASK-158: Deleted Groups Tracker
 *
 * Tracks recently deleted groups to prevent "zombie groups" - groups that
 * reappear after deletion due to sync race conditions.
 *
 * Improvements over the previous approach:
 * 1. Persists to localStorage (survives page refresh)
 * 2. Clears based on confirmation, not fixed timeout
 * 3. Has TTL cleanup for stale entries (fallback)
 */

const STORAGE_KEY = 'flowstate-deleted-groups'
const TTL_MS = 60000 // 60 seconds fallback TTL (was 10s, now more generous)

interface DeletedGroupEntry {
    id: string
    deletedAt: number
}

/**
 * Get all tracked deleted group IDs (cleaned of stale entries)
 */
export function getDeletedGroupIds(): Set<string> {
    try {
        const data = localStorage.getItem(STORAGE_KEY)
        if (!data) return new Set()

        const entries: DeletedGroupEntry[] = JSON.parse(data)
        const now = Date.now()

        // Filter out stale entries (older than TTL)
        const validEntries = entries.filter(e => (now - e.deletedAt) < TTL_MS)

        // If we removed stale entries, update storage
        if (validEntries.length !== entries.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(validEntries))
        }

        return new Set(validEntries.map(e => e.id))
    } catch {
        return new Set()
    }
}

/**
 * Mark a group as deleted (add to tracking)
 * Called BEFORE the actual delete operation to prevent race conditions
 */
export function markGroupDeleted(groupId: string): void {
    try {
        const entries = getDeletedEntries()

        // Don't add duplicates
        if (!entries.some(e => e.id === groupId)) {
            entries.push({ id: groupId, deletedAt: Date.now() })
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
            console.log(`🧟 [ZOMBIE-PREVENT] Added ${groupId} to deleted groups tracker`)
        }
    } catch (e) {
        console.warn('[ZOMBIE-PREVENT] Failed to mark group deleted:', e)
    }
}

/**
 * Confirm a group deletion was successful (remove from tracking)
 * Called AFTER Supabase confirms the delete
 */
export function confirmGroupDeleted(groupId: string): void {
    try {
        const entries = getDeletedEntries()
        const filtered = entries.filter(e => e.id !== groupId)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
        console.log(`🧟 [ZOMBIE-PREVENT] Confirmed deletion of ${groupId}`)
    } catch (e) {
        console.warn('[ZOMBIE-PREVENT] Failed to confirm group deleted:', e)
    }
}

/**
 * Check if a group is marked as recently deleted
 */
export function isGroupDeleted(groupId: string): boolean {
    return getDeletedGroupIds().has(groupId)
}

/**
 * Clear all tracked deletions (used on logout or manual reset)
 */
export function clearDeletedGroups(): void {
    localStorage.removeItem(STORAGE_KEY)
}

// Internal helper
function getDeletedEntries(): DeletedGroupEntry[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY)
        if (!data) return []

        const entries: DeletedGroupEntry[] = JSON.parse(data)
        const now = Date.now()

        // Clean stale entries while we're at it
        return entries.filter(e => (now - e.deletedAt) < TTL_MS)
    } catch {
        return []
    }
}
