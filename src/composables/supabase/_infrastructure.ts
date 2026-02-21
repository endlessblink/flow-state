import type { Ref } from 'vue'
import { supabase } from '@/services/auth/supabase'
import { useAuthStore } from '@/stores/auth'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'

// Re-export for domain composables
export { supabase }

// ============================================================================
// DatabaseContext — shared instance state passed to all domain composables
// ============================================================================

export interface DatabaseContext {
    authStore: ReturnType<typeof useAuthStore>
    isSyncing: Ref<boolean>
    lastSyncError: Ref<string | null>
    getUserIdSafe: () => string | null
    withRetry: <T>(operation: () => Promise<T>, context: string, maxRetries?: number) => Promise<T>
    handleError: (error: unknown, context: string) => void
}

// ============================================================================
// TASK-1060: SWR (Stale-While-Revalidate) Cache for database queries
// ============================================================================

interface SWRCacheEntry<T> {
    data: T
    timestamp: number
    promise?: Promise<T>  // Deduplication: reuse in-flight requests
}

class SWRCache {
    private cache = new Map<string, SWRCacheEntry<unknown>>()
    // TASK-1083: Reduced stale time from 30s to 3s to prevent position drift between devices
    private readonly DEFAULT_STALE_TIME = 3 * 1000  // 3s before considered stale (was 30s)
    private readonly DEFAULT_CACHE_TIME = 60 * 1000  // 1min max cache (was 5min)
    private lastUserId: string | null = null  // BUG-1056: Track user for auth change detection

    /**
     * Get data from cache or fetch if missing/expired
     * SWR pattern: returns stale data immediately, refreshes in background
     */
    async getOrFetch<T>(
        key: string,
        fetcher: () => Promise<T>,
        options?: { staleTime?: number; cacheTime?: number }
    ): Promise<T> {
        const staleTime = options?.staleTime ?? this.DEFAULT_STALE_TIME
        const cacheTime = options?.cacheTime ?? this.DEFAULT_CACHE_TIME
        const now = Date.now()
        const entry = this.cache.get(key) as SWRCacheEntry<T> | undefined

        // Case 1: No cache - fetch and wait
        if (!entry) {
            return this.fetchAndCache(key, fetcher)
        }

        // Case 2: Cache expired - fetch and wait
        const age = now - entry.timestamp
        if (age > cacheTime) {
            this.cache.delete(key)
            return this.fetchAndCache(key, fetcher)
        }

        // Case 3: Cache fresh - return immediately
        if (age < staleTime) {
            return entry.data
        }

        // Case 4: Cache stale but valid - return cached, refresh in background
        // Deduplicate: if refresh already in progress, don't start another
        if (!entry.promise) {
            entry.promise = fetcher()
                .then(data => {
                    this.cache.set(key, { data, timestamp: Date.now() })
                    return data
                })
                .catch(err => {
                    console.warn(`[SWR] Background refresh failed for ${key}:`, err)
                    return entry.data  // Keep stale data on error
                })
                .finally(() => {
                    const current = this.cache.get(key) as SWRCacheEntry<T> | undefined
                    if (current) delete current.promise
                })
        }

        return entry.data
    }

    private async fetchAndCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
        // Deduplicate concurrent requests for same key
        const existing = this.cache.get(key) as SWRCacheEntry<T> | undefined
        if (existing?.promise) {
            return existing.promise
        }

        const promise = fetcher()
        this.cache.set(key, { data: undefined as T, timestamp: 0, promise })

        try {
            const data = await promise
            this.cache.set(key, { data, timestamp: Date.now() })
            return data
        } catch (err) {
            this.cache.delete(key)
            throw err
        }
    }

    /** Invalidate specific cache key (call on realtime events) */
    invalidate(key: string): void {
        this.cache.delete(key)
    }

    /** Invalidate all keys matching prefix (e.g., 'tasks:' for all task queries) */
    invalidatePrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key)
            }
        }
    }

    /** Clear entire cache */
    clear(): void {
        this.cache.clear()
    }

    /**
     * BUG-1056: Check if user changed and clear cache if so
     * This prevents returning stale guest data after auth
     */
    checkUserChange(currentUserId: string | null): boolean {
        if (this.lastUserId !== currentUserId) {
            console.log(`🔄 [SWR] User changed: ${this.lastUserId?.slice(0, 8) || 'guest'} → ${currentUserId?.slice(0, 8) || 'guest'}, clearing cache`)
            this.clear()
            this.lastUserId = currentUserId
            return true
        }
        return false
    }

    /** Get cache stats for debugging */
    getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        }
    }
}

// Global cache instance (shared across all useSupabaseDatabase calls)
export const swrCache = new SWRCache()

// Export for realtime event handlers to invalidate cache
export const invalidateCache = {
    tasks: () => swrCache.invalidatePrefix('tasks:'),
    projects: () => swrCache.invalidatePrefix('projects:'),
    groups: () => swrCache.invalidatePrefix('groups:'),
    pinnedTasks: () => swrCache.invalidatePrefix('pinnedTasks:'),
    all: () => swrCache.clear(),
    // BUG-1056: Expose user change check for auth state changes
    onAuthChange: (userId: string | null) => swrCache.checkUserChange(userId)
}

// ============================================================================
// Exported types
// ============================================================================

// FORCE_HMR_UPDATE: Clearing stale cache for position_version schema
export interface TimerSettings {
    workDuration: number
    shortBreakDuration: number
    longBreakDuration: number
    autoStartBreaks: boolean
    autoStartPomodoros: boolean
    playNotificationSounds: boolean
}

// Define DatabaseDependencies for the new function signature
export type DatabaseDependencies = Record<string, unknown>

/**
 * Result type for safe task creation operations
 */
export interface SafeCreateTaskResult {
    status: 'created' | 'exists' | 'tombstoned' | 'error'
    taskId: string
    message: string
    isDeleted?: boolean
    title?: string
    deletedAt?: string
}

/**
 * Result type for batch ID availability check
 */
export interface TaskIdAvailability {
    taskId: string
    status: 'available' | 'active' | 'soft_deleted' | 'tombstoned'
    reason: string
}

// ============================================================================
// Factory: create shared database helpers bound to instance state
// ============================================================================

export function createDatabaseHelpers(
    lastSyncError: Ref<string | null>
) {
    /**
     * Helper to execute Supabase operations with transient error retries (e.g. clock skew, 401/403 restarts)
     * TASK-329: Added exponential backoff and auth resilience
     */
    const withRetry = async <T>(operation: () => Promise<T>, context: string, maxRetries = 3): Promise<T> => {
        let lastErr: any = null

        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation()
            } catch (err: any) {
                lastErr = err
                const message = err?.message || String(err)
                const status = err?.status || err?.code

                // BUG-352: Faster backoff for mobile: 500ms, 1s, 2s (was 1s, 2s, 4s)
                const delay = Math.pow(2, i) * 500

                // 1. Clock Skew (JWT issued at future)
                if (message.includes('JWT issued at future')) {
                    console.warn(`🕒 [CLOCK-SKEW] ${context} failed. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                    continue
                }

                // 2. Auth Errors (401/403) - Can happen if GoTrue/PostgREST is restarting or cache is stale
                // BUG-1182 FIX: Refresh the auth token before retrying. After sleep/wake, the JWT
                // may have expired. Without this, all 3 retries use the same stale token and all fail.
                if (status === 401 || status === 403 || status === '401' || status === '403' || message.includes('JWKS') || message.includes('invalid_token')) {
                    console.warn(`🔐 [AUTH-RETRY] ${context} failed (${status}). Refreshing token and retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`)
                    try {
                        await supabase.auth.refreshSession()
                        console.log(`🔐 [AUTH-RETRY] Token refreshed successfully before retry`)
                    } catch (refreshErr) {
                        console.warn(`🔐 [AUTH-RETRY] Token refresh failed:`, refreshErr)
                    }
                    await new Promise(resolve => setTimeout(resolve, delay))
                    continue
                }

                // 3. Network / Connection / Timeout Errors
                // BUG-352: Also catch AbortError (from fetch timeout) and timeout strings
                // BUG-1311: Firefox/Zen reports "NetworkError" (no space), Chrome reports "Network Error" (space)
                const lowerMsg = message.toLowerCase()
                if (message.includes('Failed to fetch') || lowerMsg.includes('networkerror') || message.includes('Network Error') || message.includes('Service Unavailable') || message.includes('AbortError') || lowerMsg.includes('timeout') || message.includes('aborted')) {
                    console.warn(`🌐 [NETWORK-RETRY] ${context} failed. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                    continue
                }

                // For other errors, don't retry immediately unless they look transient
                throw err
            }
        }

        throw lastErr
    }

    const handleError = (error: unknown, context: string) => {
        // Handle Supabase/Postgrest errors which are objects but not Error instances
        let message = 'Unknown error'
        let details = ''

        if (error instanceof Error) {
            message = error.message
        } else if (typeof error === 'object' && error !== null) {
            const e = error as { message?: string; details?: string; hint?: string; status?: number; code?: string }
            message = e.message || String(error)
            details = e.details || e.hint || ''
        } else {
            message = String(error)
        }

        const finalMessage = details ? `${message} (${details})` : message
        const err = error instanceof Error ? error : new Error(finalMessage)

        // BUG-352: Suppress notifications for transient network errors (common on mobile WiFi/cell handoffs)
        const lowerMsg = message.toLowerCase()
        const isTransientNetwork = message.includes('Failed to fetch') ||
            lowerMsg.includes('networkerror') ||
            message.includes('Network Error') ||
            message.includes('AbortError') ||
            lowerMsg.includes('timeout') ||
            message.includes('aborted')

        errorHandler.report({
            error: err,
            message: `Sync Error(${context}): ${finalMessage}`,
            severity: isTransientNetwork ? ErrorSeverity.WARNING : ErrorSeverity.ERROR,
            category: ErrorCategory.SYNC,
            showNotification: !isTransientNetwork
        })
        lastSyncError.value = finalMessage
    }

    return { withRetry, handleError }
}
