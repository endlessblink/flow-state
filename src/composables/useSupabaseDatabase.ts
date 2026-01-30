import { ref } from 'vue'
import { supabase } from '@/services/auth/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Task, Project } from '@/types/tasks'
import type { ScheduledNotification } from '@/types/recurrence'
import type { CanvasGroup } from '@/types/canvas'
import type { AppSettings } from '@/stores/settings'
import type { PomodoroSession } from '@/stores/timer'
import type { SessionSummary } from '@/stores/quickSort'
import {
    toSupabaseTask, fromSupabaseTask,
    toSupabaseProject, fromSupabaseProject,
    toSupabaseGroup, fromSupabaseGroup,
    toSupabaseNotification, fromSupabaseNotification,
    toSupabaseTimerSession, fromSupabaseTimerSession,
    toSupabaseUserSettings, fromSupabaseUserSettings,
    toSupabaseQuickSortSession, fromSupabaseQuickSortSession,
    type SupabaseTask, type SupabaseProject, type SupabaseGroup,
    type SupabaseNotification, type SupabaseTimerSession, type SupabaseUserSettings, type SupabaseQuickSortSession
} from '@/utils/supabaseMappers'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'

// TASK-1060: SWR (Stale-While-Revalidate) Cache for database queries
// Returns cached data immediately while fetching fresh data in background
// Invalidated on realtime events to ensure consistency
// BUG-1056: Cache is also invalidated on auth state changes to prevent stale guest data
interface SWRCacheEntry<T> {
    data: T
    timestamp: number
    promise?: Promise<T>  // Deduplication: reuse in-flight requests
}

class SWRCache {
    private cache = new Map<string, SWRCacheEntry<unknown>>()
    // TASK-1083: Reduced stale time from 30s to 3s to prevent position drift between devices
    // Old value caused stale positions to be returned for up to 30 seconds after another device updated
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
const swrCache = new SWRCache()

// Export for realtime event handlers to invalidate cache
export const invalidateCache = {
    tasks: () => swrCache.invalidatePrefix('tasks:'),
    projects: () => swrCache.invalidatePrefix('projects:'),
    groups: () => swrCache.invalidatePrefix('groups:'),
    all: () => swrCache.clear(),
    // BUG-1056: Expose user change check for auth state changes
    onAuthChange: (userId: string | null) => swrCache.checkUserChange(userId)
}

// FORCE_HMR_UPDATE: Clearing stale cache for position_version schema
// App Types are defined locally or imported for convenience
export interface TimerSettings {
    workDuration: number
    shortBreakDuration: number
    longBreakDuration: number
    autoStartBreaks: boolean
    autoStartPomodoros: boolean
    playNotificationSounds: boolean
}

// Define DatabaseDependencies for the new function signature
type DatabaseDependencies = Record<string, unknown>

export function useSupabaseDatabase(_deps: DatabaseDependencies = {}) {

    const authStore = useAuthStore()
    const isSyncing = ref(false)
    const lastSyncError = ref<string | null>(null)

    // -- Helpers --

    const getUserIdSafe = (): string | null => {
        return authStore.user?.id || null
    }

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

                // Exponential backoff delay: 1s, 2s, 4s...
                const delay = Math.pow(2, i) * 1000

                // 1. Clock Skew (JWT issued at future)
                if (message.includes('JWT issued at future')) {
                    console.warn(`🕒 [CLOCK-SKEW] ${context} failed. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                    continue
                }

                // 2. Auth Errors (401/403) - Can happen if GoTrue/PostgREST is restarting or cache is stale
                if (status === 401 || status === 403 || status === '401' || status === '403' || message.includes('JWKS') || message.includes('invalid_token')) {
                    console.warn(`🔐 [AUTH-RETRY] ${context} failed (${status}). Retrying with backoff in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                    continue
                }

                // 3. Network / Connection Errors
                if (message.includes('Failed to fetch') || message.includes('Network Error') || message.includes('Service Unavailable')) {
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e = error as any
            message = e.message || String(error)
            details = e.details || e.hint || ''
        } else {
            message = String(error)
        }

        const finalMessage = details ? `${message} (${details})` : message
        const err = error instanceof Error ? error : new Error(finalMessage)

        errorHandler.report({
            error: err,
            message: `Sync Error(${context}): ${finalMessage}`,
            severity: ErrorSeverity.ERROR,
            category: ErrorCategory.SYNC,
            showNotification: true
        })
        lastSyncError.value = finalMessage
    }

    // -- Projects --

    const fetchProjects = async (): Promise<Project[]> => {
        const userId = getUserIdSafe()
        // BUG-1056: Check if user changed since last fetch - invalidates cache if so
        swrCache.checkUserChange(userId)
        const cacheKey = `projects:${userId || 'guest'}`

        return swrCache.getOrFetch(cacheKey, async () => {
            try {
                return await withRetry(async () => {
                    const { data, error } = await supabase
                        .from('projects')
                        .select('*')
                        .order('created_at', { ascending: true })

                    if (error) throw error
                    if (!data) return []

                    return (data as SupabaseProject[]).map(fromSupabaseProject)
                }, 'fetchProjects')
            } catch (e: unknown) {
                handleError(e, 'fetchProjects')
                return []
            }
        })
    }

    const saveProject = async (project: Project): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveProject - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = toSupabaseProject(project, userId)
            const { error } = await supabase.from('projects').upsert(payload, { onConflict: 'id' })
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveProject')
            throw e // BUG-1051: Re-throw so caller knows save failed
        } finally {
            isSyncing.value = false
        }
    }

    const saveProjects = async (projects: Project[]): Promise<void> => {
        if (projects.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveProjects - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = projects.map(p => toSupabaseProject(p, userId))
            // BUG-171 FIX: Add .select() and verify data.length to detect RLS partial write failures
            const { data, error } = await supabase.from('projects').upsert(payload, { onConflict: 'id' }).select('id')
            if (error) throw error
            if (!data || data.length !== payload.length) {
                const writtenCount = data?.length ?? 0
                const failedCount = payload.length - writtenCount
                throw new Error(`RLS blocked ${failedCount} of ${payload.length} project writes (only ${writtenCount} succeeded)`)
            }
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveProjects')
            throw e // BUG-171: Re-throw so callers know the save failed
        } finally {
            isSyncing.value = false
        }
    }

    const deleteProject = async (projectId: string): Promise<void> => {
        try {
            isSyncing.value = true
            const { error } = await supabase
                .from('projects')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', projectId)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'deleteProject')
            throw e // BUG-1051: Re-throw so caller knows save failed
        } finally {
            isSyncing.value = false
        }
    }

    const restoreProject = async (projectId: string): Promise<void> => {
        try {
            isSyncing.value = true
            const { error } = await supabase
                .from('projects')
                .update({ is_deleted: false, deleted_at: null })
                .eq('id', projectId)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'restoreProject')
            throw e // BUG-1051: Re-throw so caller knows save failed
        } finally {
            isSyncing.value = false
        }
    }

    // TASK-317: Record tombstone for permanent deletions
    // Tombstones prevent zombie data resurrection during backup restore
    // TASK-344: Task tombstones are now permanent (expires_at = NULL)
    const recordTombstone = async (entityType: 'task' | 'group' | 'project', entityId: string): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping recordTombstone - not authenticated')
            return
        }
        try {
            // TASK-344: Task tombstones are permanent (no expiry), others expire in 90 days
            const expiresAt = entityType === 'task'
                ? null  // Permanent for tasks
                : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()  // 90 days for others

            const { error } = await supabase.from('tombstones').upsert({
                user_id: userId,
                entity_type: entityType,
                entity_id: entityId,
                deleted_at: new Date().toISOString(),
                expires_at: expiresAt
            }, { onConflict: 'entity_type,entity_id,user_id' })
            if (error) {
                console.warn(`[TASK-317] Failed to record tombstone for ${entityType}:${entityId}:`, error.message)
            } else {
                console.log(`🪦 [TOMBSTONE] Recorded permanent deletion: ${entityType}:${entityId} (expires: ${expiresAt || 'never'})`)
            }
        } catch (e: unknown) {
            // Non-fatal: tombstone recording failure shouldn't block deletion
            console.warn(`[TASK-317] Tombstone recording error:`, e)
        }
    }

    // TASK-317: Fetch tombstones for restore filtering
    const fetchTombstones = async (): Promise<{ entityType: string; entityId: string }[]> => {
        const userId = getUserIdSafe()
        if (!userId) return []
        try {
            const { data, error } = await supabase
                .from('tombstones')
                .select('entity_type, entity_id')
                .eq('user_id', userId)
            if (error) throw error
            return data?.map((t: any) => ({ entityType: t.entity_type, entityId: t.entity_id })) || []
        } catch (e: unknown) {
            console.error('[TASK-317] Failed to fetch tombstones:', e)
            return []
        }
    }

    // =============================================================================
    // TASK-344: Immutable Task ID System
    // =============================================================================
    // Types are exported at the bottom of this file

    /**
     * TASK-344: Safely create a task, checking for existing IDs and tombstones.
     * Returns a result object instead of throwing errors for existing/tombstoned IDs.
     *
     * This function:
     * 1. Checks if task ID already exists (active or soft-deleted)
     * 2. Checks if task ID is tombstoned (permanently deleted)
     * 3. Only creates if ID is truly available
     *
     * @param task - The task to create
     * @returns SafeCreateTaskResult with status and details
     */
    const safeCreateTask = async (task: Task): Promise<SafeCreateTaskResult> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] safeCreateTask - not authenticated, falling back to local')
            return {
                status: 'created',
                taskId: task.id,
                message: 'Task created locally (guest mode)'
            }
        }

        try {
            // Try to use the RPC function if available (more efficient)
            const { data: rpcResult, error: rpcError } = await supabase.rpc('safe_create_task', {
                p_task_id: task.id,
                p_user_id: userId,
                p_title: task.title,
                p_description: task.description || '',
                p_status: task.status || 'planned',
                p_priority: task.priority || 'medium',
                p_due_date: task.dueDate || null,
                p_project_id: task.projectId || 'uncategorized',
                p_position: task.canvasPosition ? JSON.stringify(task.canvasPosition) : null,
                p_tags: task.tags || [],
                p_is_in_inbox: task.isInInbox !== false,
                p_parent_task_id: task.parentTaskId || null
            })

            if (rpcError) {
                // RPC function might not exist yet - fall back to manual check
                console.warn('[TASK-344] RPC failed, falling back to manual check:', rpcError.message)
                return await safeCreateTaskManual(task, userId)
            }

            // Parse RPC result
            const result = rpcResult as { status: string; task_id: string; message: string; is_deleted?: boolean; title?: string; deleted_at?: string }
            return {
                status: result.status as SafeCreateTaskResult['status'],
                taskId: result.task_id,
                message: result.message,
                isDeleted: result.is_deleted,
                title: result.title,
                deletedAt: result.deleted_at
            }

        } catch (e: unknown) {
            console.error('[TASK-344] safeCreateTask failed:', e)
            // Fall back to manual check
            return await safeCreateTaskManual(task, userId)
        }
    }

    /**
     * Manual implementation of safe task creation (fallback if RPC not available)
     */
    const safeCreateTaskManual = async (task: Task, userId: string): Promise<SafeCreateTaskResult> => {
        try {
            // 1. Check if task already exists
            const { data: existing, error: existError } = await supabase
                .from('tasks')
                .select('id, is_deleted, title')
                .eq('id', task.id)
                .eq('user_id', userId)
                .maybeSingle()

            if (existError && existError.code !== 'PGRST116') {
                throw existError
            }

            if (existing) {
                console.log(`🔒 [TASK-344] Task ID ${task.id.slice(0, 8)}... already exists (is_deleted: ${existing.is_deleted})`)
                return {
                    status: 'exists',
                    taskId: existing.id,
                    message: 'Task with this ID already exists',
                    isDeleted: existing.is_deleted,
                    title: existing.title
                }
            }

            // 2. Check tombstones
            const { data: tombstone, error: tombError } = await supabase
                .from('tombstones')
                .select('entity_id, deleted_at')
                .eq('entity_type', 'task')
                .eq('entity_id', task.id)
                .eq('user_id', userId)
                .maybeSingle()

            if (tombError && tombError.code !== 'PGRST116') {
                throw tombError
            }

            if (tombstone) {
                console.log(`🪦 [TASK-344] Task ID ${task.id.slice(0, 8)}... is tombstoned (deleted: ${tombstone.deleted_at})`)
                return {
                    status: 'tombstoned',
                    taskId: task.id,
                    message: 'Task ID was permanently deleted and cannot be reused',
                    deletedAt: tombstone.deleted_at
                }
            }

            // 3. Safe to create - use regular saveTask
            const payload = toSupabaseTask(task, userId)
            const { error: insertError } = await supabase.from('tasks').insert(payload)

            if (insertError) {
                // Check for unique violation (race condition)
                if (insertError.code === '23505') {
                    return {
                        status: 'exists',
                        taskId: task.id,
                        message: 'Task was created by another transaction (race condition)'
                    }
                }
                throw insertError
            }

            console.log(`✅ [TASK-344] Task ${task.id.slice(0, 8)}... created safely`)
            return {
                status: 'created',
                taskId: task.id,
                message: 'Task created successfully'
            }

        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e)
            console.error('[TASK-344] safeCreateTaskManual failed:', e)
            return {
                status: 'error',
                taskId: task.id,
                message: `Failed to create task: ${message}`
            }
        }
    }

    /**
     * TASK-344: Batch check task ID availability for restore/sync operations.
     * More efficient than checking one at a time.
     *
     * @param taskIds - Array of task IDs to check
     * @returns Array of availability results
     */
    const checkTaskIdsAvailability = async (taskIds: string[]): Promise<TaskIdAvailability[]> => {
        const userId = getUserIdSafe()
        if (!userId || taskIds.length === 0) {
            return taskIds.map(id => ({
                taskId: id,
                status: 'available' as const,
                reason: 'Guest mode or empty array'
            }))
        }

        try {
            // Try RPC function first
            const { data: rpcResult, error: rpcError } = await supabase.rpc('check_task_ids_availability', {
                p_user_id: userId,
                p_task_ids: taskIds
            })

            if (!rpcError && rpcResult) {
                return (rpcResult as any[]).map(r => ({
                    taskId: r.task_id,
                    status: r.status as TaskIdAvailability['status'],
                    reason: r.reason
                }))
            }

            // Fall back to manual batch check
            console.warn('[TASK-344] RPC check_task_ids_availability not available, using manual check')
            return await checkTaskIdsAvailabilityManual(taskIds, userId)

        } catch (e: unknown) {
            console.error('[TASK-344] checkTaskIdsAvailability failed:', e)
            return await checkTaskIdsAvailabilityManual(taskIds, userId)
        }
    }

    /**
     * Manual batch check for task ID availability
     */
    const checkTaskIdsAvailabilityManual = async (taskIds: string[], userId: string): Promise<TaskIdAvailability[]> => {
        const results: TaskIdAvailability[] = []

        try {
            // Batch fetch existing tasks
            const { data: existingTasks, error: tasksError } = await supabase
                .from('tasks')
                .select('id, is_deleted')
                .in('id', taskIds)
                .eq('user_id', userId)

            if (tasksError) throw tasksError

            const existingMap = new Map<string, boolean>()
            for (const t of existingTasks || []) {
                existingMap.set(t.id, t.is_deleted)
            }

            // Batch fetch tombstones
            const { data: tombstones, error: tombError } = await supabase
                .from('tombstones')
                .select('entity_id')
                .eq('entity_type', 'task')
                .in('entity_id', taskIds)
                .eq('user_id', userId)

            if (tombError) throw tombError

            const tombstoneSet = new Set((tombstones || []).map((t: { entity_id: string }) => t.entity_id))

            // Build results
            for (const id of taskIds) {
                if (existingMap.has(id)) {
                    const isDeleted = existingMap.get(id)
                    results.push({
                        taskId: id,
                        status: isDeleted ? 'soft_deleted' : 'active',
                        reason: `Task exists in database (${isDeleted ? 'soft_deleted' : 'active'})`
                    })
                } else if (tombstoneSet.has(id)) {
                    results.push({
                        taskId: id,
                        status: 'tombstoned',
                        reason: 'Task ID is tombstoned (permanently deleted)'
                    })
                } else {
                    results.push({
                        taskId: id,
                        status: 'available',
                        reason: 'Task ID is available for creation'
                    })
                }
            }

        } catch (e: unknown) {
            console.error('[TASK-344] checkTaskIdsAvailabilityManual failed:', e)
            // Return all as available on error (fail open for restore operations)
            return taskIds.map(id => ({
                taskId: id,
                status: 'available' as const,
                reason: 'Check failed, assuming available'
            }))
        }

        return results
    }

    /**
     * TASK-344: Log dedup decision to audit table (non-blocking)
     */
    const logDedupDecision = async (
        operation: 'restore' | 'sync' | 'create',
        taskId: string,
        decision: 'created' | 'skipped_exists' | 'skipped_tombstoned' | 'failed',
        reason: string,
        backupSource?: string
    ): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) return

        try {
            await supabase.from('task_dedup_audit').insert({
                user_id: userId,
                operation,
                task_id: taskId,
                decision,
                reason,
                backup_source: backupSource || null
            })
        } catch (e: unknown) {
            // Non-fatal - audit logging should never block operations
            console.warn('[TASK-344] Failed to log dedup decision:', e)
        }
    }

    const permanentlyDeleteProject = async (projectId: string): Promise<void> => {
        try {
            isSyncing.value = true
            // TASK-317: Record tombstone before permanent deletion
            await recordTombstone('project', projectId)
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'permanentlyDeleteProject')
        } finally {
            isSyncing.value = false
        }
    }

    // -- Tasks --

    const fetchTasks = async (): Promise<Task[]> => {
        const userId = getUserIdSafe()
        // BUG-1056: Check if user changed since last fetch - invalidates cache if so
        swrCache.checkUserChange(userId)
        const cacheKey = `tasks:${userId || 'guest'}`

        return swrCache.getOrFetch(cacheKey, async () => {
            try {
                return await withRetry(async () => {
                    const { data, error } = await supabase
                        .from('tasks')
                        .select('*')
                        .eq('is_deleted', false)

                    if (error) throw error
                    if (!data) return []

                    // TASK-142 DEBUG: Log what positions we receive from Supabase
                    const tasksWithPos = data.filter((d: any) => d.position)
                    if (tasksWithPos.length > 0) {
                        console.log(`📥 [TASK-142] LOADED ${tasksWithPos.length} tasks with positions from Supabase:`,
                            tasksWithPos.map((d: any) => ({ id: d.id?.substring(0, 8), pos: d.position })))
                    } else {
                        console.log(`📥 [TASK-142] LOADED ${data.length} tasks - NONE have positions in DB`)
                    }

                    return (data as SupabaseTask[]).map(fromSupabaseTask)
                }, 'fetchTasks')
            } catch (e: unknown) {
                handleError(e, 'fetchTasks')
                return []
            }
        })
    }

    const fetchTrash = async (): Promise<Task[]> => {
        try {
            // BUG-1107: Wrap in withRetry for mobile PWA network resilience
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('is_deleted', true)
                    .order('deleted_at', { ascending: false })

                if (error) throw error
                if (!data) return []

                return (data as SupabaseTask[]).map(fromSupabaseTask)
            }, 'fetchTrash')
        } catch (e: unknown) {
            handleError(e, 'fetchTrash')
            return []
        }
    }

    const saveTask = async (task: Task): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveTask - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = toSupabaseTask(task, userId)

            // FK-aware upsert with single retry for orphaned parent references
            const attemptUpsert = async (payloadToSave: typeof payload, isRetry = false): Promise<void> => {
                const { error } = await supabase.from('tasks').upsert(payloadToSave, { onConflict: 'id' })

                // Handle FK constraint violation on parent_task_id
                if (error?.code === '23503' && error?.message?.includes('parent_task_id') && !isRetry) {
                    console.warn(`⚠️ [saveTask] FK violation on parent_task_id, clearing and retrying`)
                    return attemptUpsert({ ...payloadToSave, parent_task_id: null }, true)
                }

                if (error) throw error
            }

            await withRetry(() => attemptUpsert(payload), 'saveTask')

            // TASK-1083: Invalidate cache after successful write to prevent stale reads
            invalidateCache.tasks()

            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveTask')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    const saveTasks = async (tasks: Task[]): Promise<void> => {
        if (tasks.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveTasks - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = tasks.map(t => toSupabaseTask(t, userId))

            // TASK-142 DEBUG: Log what we're sending
            const tasksWithPos = payload.filter(p => p.position)
            if (tasksWithPos.length > 0) {
                console.log(`📤 [TASK-142] SENDING ${tasksWithPos.length} tasks with positions:`,
                    tasksWithPos.map(t => ({ id: t.id?.substring(0, 8), pos: t.position })))
            }

            // FK-aware upsert with single retry for orphaned parent references
            const attemptUpsert = async (payloadToSave: typeof payload, isRetry = false): Promise<void> => {
                const { data, error } = await supabase
                    .from('tasks')
                    .upsert(payloadToSave, { onConflict: 'id' })
                    .select('id, position')

                // Handle FK constraint violation on parent_task_id
                if (error?.code === '23503' && error?.message?.includes('parent_task_id') && !isRetry) {
                    console.warn(`⚠️ [saveTasks] FK violation on parent_task_id, clearing orphaned references and retrying`)
                    const clearedPayload = payloadToSave.map(t => ({ ...t, parent_task_id: null }))
                    return attemptUpsert(clearedPayload, true)
                }

                if (error) throw error

                // RLS check
                if (!data || data.length !== payloadToSave.length) {
                    const writtenCount = data?.length ?? 0
                    const failedCount = payloadToSave.length - writtenCount
                    throw new Error(`RLS blocked ${failedCount} of ${payloadToSave.length} writes (only ${writtenCount} succeeded)`)
                }

                // TASK-142 DEBUG: Log what Supabase returned
                const positionSaves = data.filter((d: any) => d.position)
                if (positionSaves.length > 0) {
                    console.log(`📥 [TASK-142] RECEIVED ${positionSaves.length} tasks with positions:`,
                        positionSaves.map((d: any) => ({ id: d.id?.substring(0, 8), pos: d.position })))
                } else if (tasksWithPos.length > 0) {
                    console.error(`❌ [TASK-142] POSITION LOST! Sent ${tasksWithPos.length} with positions, received 0 back!`)
                }
            }

            await withRetry(() => attemptUpsert(payload), 'saveTasks')

            // TASK-1083: Invalidate cache after successful write to prevent stale reads
            invalidateCache.tasks()

            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveTasks')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    const deleteTask = async (taskId: string): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping deleteTask - not authenticated')
            return
        }
        console.log(`🗑️ [SUPABASE-DELETE] Starting soft-delete for task: ${taskId}`)
        try {
            isSyncing.value = true

            const { error, count } = await supabase
                .from('tasks')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', taskId)
                .select('*', { count: 'exact' })

            console.log(`🗑️ [SUPABASE-DELETE] Result - error: ${error?.message || 'none'}, affected rows: ${count ?? 'unknown'}`)

            if (error) throw error
            lastSyncError.value = null
            console.log(`✅ [SUPABASE-DELETE] Task ${taskId} marked as deleted`)
        } catch (e: unknown) {
            console.error(`❌ [SUPABASE-DELETE] Failed to delete task ${taskId}:`, e)
            handleError(e, 'deleteTask')
            throw e  // Re-throw so caller knows it failed
        } finally {
            isSyncing.value = false
        }
    }

    const restoreTask = async (taskId: string): Promise<void> => {
        try {
            isSyncing.value = true
            const { error } = await supabase
                .from('tasks')
                .update({ is_deleted: false, deleted_at: null })
                .eq('id', taskId)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'restoreTask')
        } finally {
            isSyncing.value = false
        }
    }

    const permanentlyDeleteTask = async (taskId: string): Promise<void> => {
        try {
            isSyncing.value = true
            // TASK-317: Record tombstone before permanent deletion
            await recordTombstone('task', taskId)
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'permanentlyDeleteTask')
        } finally {
            isSyncing.value = false
        }
    }

    // TASK-153: Fetch IDs of deleted tasks (for golden backup validation)
    const fetchDeletedTaskIds = async (): Promise<string[]> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return []

            const { data, error } = await supabase
                .from('tasks')
                .select('id')
                .eq('is_deleted', true)
                .eq('user_id', userId)

            if (error) throw error
            return data?.map((d: any) => d.id) || []
        } catch (e: unknown) {
            console.error('[TASK-153] Failed to fetch deleted task IDs:', e)
            return []
        }
    }

    // TASK-153: Fetch IDs of deleted projects (for golden backup validation)
    const fetchDeletedProjectIds = async (): Promise<string[]> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return []

            const { data, error } = await supabase
                .from('projects')
                .select('id')
                .eq('is_deleted', true)
                .eq('user_id', userId)

            if (error) throw error
            return data?.map((d: any) => d.id) || []
        } catch (e: unknown) {
            console.error('[TASK-153] Failed to fetch deleted project IDs:', e)
            return []
        }
    }

    // TASK-153: Fetch IDs of deleted groups (for golden backup validation)
    const fetchDeletedGroupIds = async (): Promise<string[]> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return []

            const { data, error } = await supabase
                .from('groups')
                .select('id')
                .eq('is_deleted', true)
                .eq('user_id', userId)

            if (error) throw error
            return data?.map((d: any) => d.id) || []
        } catch (e: unknown) {
            console.error('[TASK-153] Failed to fetch deleted group IDs:', e)
            return []
        }
    }

    // BUG-025 FIX: Atomic bulk delete using Supabase .in() operator
    const bulkDeleteTasks = async (taskIds: string[]): Promise<void> => {
        if (taskIds.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping bulkDeleteTasks - not authenticated')
            return
        }
        console.log(`🗑️ [SUPABASE-BULK-DELETE] Starting atomic soft-delete for ${taskIds.length} tasks`)
        try {
            isSyncing.value = true

            const { error, count } = await supabase
                .from('tasks')
                // FIX: Schema compatibility - remove deleted_at if not in DB
                .update({ is_deleted: true })
                .in('id', taskIds)
                .select('*', { count: 'exact' })

            console.log(`🗑️ [SUPABASE-BULK-DELETE] Result - error: ${error?.message || 'none'}, affected rows: ${count ?? 'unknown'}`)

            if (error) throw error
            lastSyncError.value = null
            console.log(`✅ [SUPABASE-BULK-DELETE] ${taskIds.length} tasks marked as deleted atomically`)
        } catch (e: unknown) {
            console.error(`❌ [SUPABASE-BULK-DELETE] Failed to bulk delete ${taskIds.length} tasks:`, e)
            handleError(e, 'bulkDeleteTasks')
            throw e // Re-throw so caller knows it failed
        } finally {
            isSyncing.value = false
        }
    }

    // -- Groups --

    const fetchGroups = async (): Promise<CanvasGroup[]> => {
        const userId = getUserIdSafe()
        // BUG-1056: Check if user changed since last fetch - invalidates cache if so
        swrCache.checkUserChange(userId)
        const cacheKey = `groups:${userId || 'guest'}`

        return swrCache.getOrFetch(cacheKey, async () => {
            try {
                // BUG-1107: Wrap in withRetry for mobile PWA network resilience
                return await withRetry(async () => {
                    const { data, error } = await supabase
                        .from('groups')
                        .select('*')
                        .eq('is_deleted', false)

                    if (error) throw error
                    if (!data) return []

                    // DEBUG: Log loaded groups and their dimensions
                    const groups = data as SupabaseGroup[]
                    groups.forEach((g: any) => {
                        const pos = g.position_json
                        console.log(`📦 [GROUP-LOAD] "${g.name}" loaded from Supabase: size=${pos?.width}x${pos?.height}`)
                    })

                    return (data as SupabaseGroup[]).map(fromSupabaseGroup)
                }, 'fetchGroups')
            } catch (e: unknown) {
                handleError(e, 'fetchGroups')
                return []
            }
        })
    }

    const saveGroup = async (group: CanvasGroup): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveGroup - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = toSupabaseGroup(group, userId)

            // TASK-142 FIX: Add .select() and check data.length to detect RLS silent failures
            // BUG FIX: Use position_json (actual DB column name), not position
            await withRetry(async () => {
                const { data, error } = await supabase.from('groups').upsert(payload, { onConflict: 'id' }).select('id, position_json')
                if (error) throw error
                if (!data || data.length === 0) {
                    throw new Error('RLS blocked write - upsert returned no data for group')
                }
                // Log position save for debugging
                if (data[0]?.position_json) {
                    const pos = data[0].position_json
                    console.log(`📍 [GROUP-SAVE] Saved group "${group.name}" pos=(${pos.x?.toFixed(0)}, ${pos.y?.toFixed(0)}) size=${pos.width}x${pos.height} to Supabase - VERIFIED`)
                }
            }, 'saveGroup')

            // TASK-1083: Invalidate cache after successful write to prevent stale reads
            invalidateCache.groups()

            lastSyncError.value = null
        } catch (e: unknown) {
            console.error('Save Group Error:', e)
            throw e // Re-throw so callers know the save failed
        } finally {
            isSyncing.value = false
        }
    }

    const deleteGroup = async (groupId: string): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping deleteGroup - not authenticated')
            return
        }
        console.log(`🗑️ [SUPABASE-DELETE-GROUP] Starting soft-delete for group: ${groupId}`)
        try {
            isSyncing.value = true

            // TASK-149 FIX: Add user_id filter and verify rows affected
            // TASK-317: Now includes deleted_at after migration
            const { data, error, count } = await supabase
                .from('groups')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', groupId)
                .eq('user_id', userId)
                .select('id, is_deleted', { count: 'exact' })

            console.log(`🗑️ [SUPABASE-DELETE-GROUP] Result - error: ${error?.message || 'none'}, affected: ${count ?? 'unknown'}`)

            if (error) throw error

            // Verify the delete actually worked
            if (!data || data.length === 0) {
                // BUG-208 FIX: Treat "no rows updated" as success (idempotent delete).
                // This handles cases where the group is already deleted in DB but stuck in UI.
                console.warn(`⚠️ [SUPABASE-DELETE-GROUP] No rows updated - group ${groupId} likely already deleted or RLS blocked. Proceeding with local removal.`)
                // We do NOT throw here anymore, allowing the UI to proceed with removing the node.
            } else {
                console.log(`✅ [SUPABASE-DELETE-GROUP] Group ${groupId} marked as deleted`)
            }
        } catch (e: unknown) {
            console.error(`❌ [SUPABASE-DELETE-GROUP] Failed:`, e)
            handleError(e, 'deleteGroup')
            throw e // Only re-throw actual errors (network, auth, etc)
        } finally {
            isSyncing.value = false
        }
    }

    // TASK-317: Permanent group deletion with tombstone
    const permanentlyDeleteGroup = async (groupId: string): Promise<void> => {
        try {
            isSyncing.value = true
            // Record tombstone before permanent deletion
            await recordTombstone('group', groupId)
            const { error } = await supabase
                .from('groups')
                .delete()
                .eq('id', groupId)
            if (error) throw error
            lastSyncError.value = null
            console.log(`🪦 [PERMANENT-DELETE-GROUP] Group ${groupId} permanently deleted`)
        } catch (e: unknown) {
            handleError(e, 'permanentlyDeleteGroup')
        } finally {
            isSyncing.value = false
        }
    }

    // -- Notifications --

    const fetchNotifications = async (): Promise<ScheduledNotification[]> => {
        try {
            // BUG-1107: Wrap in withRetry for mobile PWA network resilience
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('is_dismissed', false)

                if (error) throw error
                if (!data) return []

                return (data as SupabaseNotification[]).map(fromSupabaseNotification)
            }, 'fetchNotifications')
        } catch (e: unknown) {
            handleError(e, 'fetchNotifications')
            return []
        }
    }

    const saveNotification = async (notification: ScheduledNotification): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveNotification - not authenticated')
            return
        }
        try {
            const payload = toSupabaseNotification(notification, userId)
            const { error } = await supabase.from('notifications').upsert(payload, { onConflict: 'id' })
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'saveNotification')
            throw e // BUG-1051: Re-throw so caller knows save failed
        }
    }

    const saveNotifications = async (notifications: ScheduledNotification[]): Promise<void> => {
        if (notifications.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveNotifications - not authenticated')
            return
        }
        try {
            const payload = notifications.map(n => toSupabaseNotification(n, userId))
            const { error } = await supabase.from('notifications').upsert(payload, { onConflict: 'id' })
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'saveNotifications')
            throw e // BUG-1051: Re-throw so caller knows save failed
        }
    }

    const deleteNotification = async (id: string): Promise<void> => {
        try {
            const { error } = await supabase.from('notifications').delete().eq('id', id)
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'deleteNotification')
            throw e // BUG-1051: Re-throw so caller knows save failed
        }
    }

    // -- Timer Sessions --

    const fetchActiveTimerSession = async (): Promise<PomodoroSession | null> => {
        try {
            const userId = getUserIdSafe()
            console.log('🍅 [DB] fetchActiveTimerSession userId:', userId)
            if (!userId) {
                console.log('🍅 [DB] No userId - returning null')
                return null
            }

            // BUG-1107: Wrap in withRetry for mobile PWA network resilience
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('timer_sessions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                console.log('🍅 [DB] fetchActiveTimerSession result:', { hasData: !!data, error: error?.message })

                if (error) throw error
                if (!data) return null

                return fromSupabaseTimerSession(data as SupabaseTimerSession)
            }, 'fetchActiveTimerSession')
        } catch (e: unknown) {
            handleError(e, 'fetchActiveTimerSession')
            return null
        }
    }

    const saveActiveTimerSession = async (session: PomodoroSession, deviceId: string): Promise<void> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) {
                console.log('🍅 [DB] saveActiveTimerSession - no userId, skipping')
                return
            }

            const payload = toSupabaseTimerSession(session, userId, deviceId)
            console.log('🍅 [DB] saveActiveTimerSession:', { sessionId: session.id, userId, deviceId, isActive: session.isActive })
            const { error } = await supabase.from('timer_sessions').upsert(payload, { onConflict: 'id' })
            if (error) {
                console.error('🍅 [DB] saveActiveTimerSession error:', error)
                throw error
            }
            console.log('🍅 [DB] saveActiveTimerSession success')
        } catch (e: unknown) {
            handleError(e, 'saveActiveTimerSession')
        }
    }

    const deleteTimerSession = async (id: string): Promise<void> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return // Skip Supabase sync when not authenticated (local-only mode)

            const { error } = await supabase.from('timer_sessions').delete().eq('id', id)
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'deleteTimerSession')
        }
    }

    // -- User Settings --

    const fetchUserSettings = async (): Promise<AppSettings | null> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return null

            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle()

            if (error) throw error
            if (!data) return null

            return fromSupabaseUserSettings(data as SupabaseUserSettings)
        } catch (e: unknown) {
            console.error('Fetch User Settings Error:', e)
            return null
        }
    }

    const saveUserSettings = async (settings: AppSettings): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveUserSettings - not authenticated')
            return
        }
        try {
            const payload = toSupabaseUserSettings(settings, userId)

            await withRetry(async () => {
                // Fix: Explicitly specify conflict target to handle 'user_settings_user_id_key' violation
                const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' })
                if (error) throw error
            }, 'saveUserSettings')
        } catch (e: unknown) {
            handleError(e, 'saveUserSettings')
            throw e // BUG-1051: Re-throw so caller knows save failed
        }
    }

    // -- Quick Sort Sessions --

    const fetchQuickSortHistory = async (): Promise<SessionSummary[]> => {
        try {
            const { data, error } = await supabase
                .from('quick_sort_sessions')
                .select('*')
                .order('completed_at', { ascending: false })

            if (error) throw error
            if (!data) return []

            return (data as SupabaseQuickSortSession[]).map(fromSupabaseQuickSortSession)
        } catch (e: unknown) {
            handleError(e, 'fetchQuickSortHistory')
            return []
        }
    }

    const saveQuickSortSession = async (summary: SessionSummary): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveQuickSortSession - not authenticated')
            return
        }
        try {
            const payload = toSupabaseQuickSortSession(summary, userId)
            const { error } = await supabase.from('quick_sort_sessions').upsert(payload, { onConflict: 'id' })
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'saveQuickSortSession')
            throw e // BUG-1051: Re-throw so caller knows save failed
        }
    }

    // -- Realtime Subscription --

    const initRealtimeSubscription = (
        onProjectChange: (payload: unknown) => void,
        onTaskChange: (payload: unknown) => void,
        onTimerChange?: (payload: unknown) => void,
        onNotificationChange?: (payload: unknown) => void,
        onGroupChange?: (payload: unknown) => void,
        onRecovery?: () => Promise<void> // Callback to reload data after recovery
    ) => {
        const userId = authStore.user?.id
        if (!userId) return null

        let currentChannel: any = null
        let retryCount = 0
        let isExplicitlyClosed = false
        let heartbeatInterval: any = null
        let isRemovingChannel = false // Guard against recursive removeChannel calls (BUG-1088)

        // cleanup previous channels if any
        if (supabase.realtime.channels.length > 0) {
            console.log(`📡 [REALTIME] Cleaning up ${supabase.realtime.channels.length} existing channels...`)
            supabase.removeAllChannels()
        }

        // Unique channel name per tab
        const tabId = (window as any).__flowstate_tab_id || (() => {
            const id = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
                ; (window as any).__flowstate_tab_id = id
            return id
        })()

        const channelName = `db-changes-${userId.substring(0, 8)}-${tabId}`

        const setupSubscription = async () => {
            if (isExplicitlyClosed) return

            // connection guard
            const { data: { session: freshSession } } = await supabase.auth.getSession()
            if (!freshSession?.access_token) {
                console.warn('📡 [REALTIME] No auth token available, aborting setup')
                return
            }
            supabase.realtime.setAuth(freshSession.access_token)

            console.log(`📡 [REALTIME] Connecting to channel: ${channelName} (Attempt ${retryCount + 1})`)

            const channel = supabase.channel(channelName)
            currentChannel = channel

            // Attach Listeners with detailed logging
            channel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` },
                    (payload: any) => {
                        console.log('📡 [REALTIME] PROJECT event received:', {
                            eventType: payload.eventType,
                            table: payload.table,
                            id: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8),
                            name: payload.new?.name || payload.old?.name
                        })
                        if (payload.table === 'projects') onProjectChange(payload)
                    })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
                    (payload: any) => {
                        console.log('📡 [REALTIME] TASK event received:', {
                            eventType: payload.eventType,
                            table: payload.table,
                            id: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8),
                            title: payload.new?.title?.substring(0, 20) || payload.old?.title?.substring(0, 20),
                            position: payload.new?.position ? `(${payload.new.position.x},${payload.new.position.y})` : 'N/A'
                        })
                        if (payload.table === 'tasks') onTaskChange(payload)
                    })

            if (onTimerChange) {
                channel.on('postgres_changes', { event: '*', schema: 'public', table: 'timer_sessions', filter: `user_id=eq.${userId}` },
                    (payload: any) => {
                        console.log('📡 [REALTIME] TIMER event received:', {
                            eventType: payload.eventType,
                            sessionId: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8),
                            isActive: payload.new?.is_active,
                            remainingTime: payload.new?.remaining_time
                        })
                        onTimerChange(payload)
                    })
            }

            if (onNotificationChange) {
                channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                    (payload: any) => {
                        console.log('📡 [REALTIME] NOTIFICATION event received:', {
                            eventType: payload.eventType,
                            id: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8)
                        })
                        onNotificationChange(payload)
                    })
            }

            if (onGroupChange) {
                channel.on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `user_id=eq.${userId}` },
                    (payload: any) => {
                        console.log('📡 [REALTIME] GROUP event received:', {
                            eventType: payload.eventType,
                            id: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8),
                            name: payload.new?.name || payload.old?.name,
                            position: payload.new?.position ? `(${payload.new.position.x},${payload.new.position.y})` : 'N/A'
                        })
                        onGroupChange(payload)
                    })
            }

            // Subscribe with Robust Error Handling
            channel.subscribe(async (status: any, err: any) => {
                if (status === 'SUBSCRIBED') {
                    console.log('📡 [REALTIME] Connected! 🟢')
                    retryCount = 0 // Reset backoff

                    // If this was a recovery (retryCount > 0 previously implies we were trying), reload data
                    // But we just reset it. We need a flag.
                    // Actually, if we are in this function, we assume we might have missed data if it's a reconnect.
                    // But 'SUBSCRIBED' fires on first connect too. 
                    // reliable strategy: only reload if we actually recovered from an error or it's a re-connection
                }

                else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                    console.warn(`📡 [REALTIME] Connection dropped (${status}):`, err || 'unknown reason')

                    if (isExplicitlyClosed) return

                    // BUG-1088: Guard against recursive removeChannel calls that cause stack overflow
                    if (isRemovingChannel) {
                        console.log('📡 [REALTIME] Skipping duplicate removeChannel (recursion guard)')
                        return
                    }

                    // PREVENT STALE CHANNELS:
                    // Supabase docs recommend removing the channel before reconnecting
                    isRemovingChannel = true
                    try {
                        await supabase.removeChannel(channel)
                    } catch (removeErr) {
                        console.warn('📡 [REALTIME] Failed to remove channel (continuing anyway):', removeErr)
                    } finally {
                        isRemovingChannel = false
                    }
                    currentChannel = null

                    // RETRY LOGIC (Exponential Backoff)
                    const maxRetries = 10
                    if (retryCount < maxRetries) {
                        const delay = Math.pow(1.5, retryCount) * 1000 + (Math.random() * 500)
                        console.log(`📡 [REALTIME] Reconnecting in ${delay.toFixed(0)}ms...`)

                        setTimeout(() => {
                            retryCount++
                            setupSubscription().then(() => {
                                // On successful reconnect setup, we might want to reload data
                                if (onRecovery) {
                                    console.log('📡 [REALTIME] Triggering recovery data reload...')
                                    // CRITICAL FIX: Invalidate ALL caches before recovery to prevent stale data
                                    invalidateCache.all()
                                    onRecovery().catch(e => console.error('Recovery failed:', e))
                                }
                            })
                        }, delay)
                    } else {
                        console.error('📡 [REALTIME] Max retries reached. Connection lost permanently until refresh.')
                        handleError(new Error('Realtime connection lost'), 'RealtimeSubscription')
                    }
                }
            })
        }

        // Start initial connection
        setupSubscription()

        // VISIBILITY RESUME (Handle Background Tab Throttling)
        const onVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                console.log('👀 [REALTIME] App visible - checking connection health...')
                const state = currentChannel?.state

                if (!currentChannel || state === 'closed' || state === 'errored') {
                    console.log('👀 [REALTIME] Connection dead on resume. Force reconnecting...')
                    // BUG-1088: Guard against recursive removeChannel calls
                    if (currentChannel && !isRemovingChannel) {
                        isRemovingChannel = true
                        try {
                            await supabase.removeChannel(currentChannel as any)
                        } catch (removeErr) {
                            console.warn('👀 [REALTIME] Failed to remove channel (continuing anyway):', removeErr)
                        } finally {
                            isRemovingChannel = false
                        }
                    }
                    retryCount = 0
                    setupSubscription()
                    if (onRecovery) {
                        // CRITICAL FIX: Invalidate ALL caches before recovery to prevent stale data
                        invalidateCache.all()
                        onRecovery()
                    }
                } else {
                    // Pulse check - verify we are actually connected
                    // (Optional: Send a heartbeat or just assume it's okay if state says joined)
                }
            }
        }
        document.addEventListener('visibilitychange', onVisibilityChange)

        // ONLINE RESUME
        const onOnline = () => {
            console.log('🌐 [REALTIME] Online event detected. Reconnecting...')
            retryCount = 0
            setupSubscription()
            if (onRecovery) {
                // CRITICAL FIX: Invalidate ALL caches before recovery to prevent stale data
                invalidateCache.all()
                onRecovery()
            }
        }
        window.addEventListener('online', onOnline)

        // Return cleanup function (Proxy interface for callers)
        return {
            unsubscribe: async () => {
                console.log('📡 [REALTIME] Unsubscribing explicitly.')
                isExplicitlyClosed = true
                // BUG-1088: Guard against recursive removeChannel calls
                if (currentChannel && !isRemovingChannel) {
                    isRemovingChannel = true
                    try {
                        await supabase.removeChannel(currentChannel)
                    } catch (removeErr) {
                        console.warn('📡 [REALTIME] Failed to remove channel during cleanup:', removeErr)
                    } finally {
                        isRemovingChannel = false
                    }
                }
                document.removeEventListener('visibilitychange', onVisibilityChange)
                window.removeEventListener('online', onOnline)
            }
        }
    }

    return {
        isSyncing,
        lastSyncError,
        fetchProjects,
        saveProject,
        saveProjects,
        deleteProject,
        restoreProject,
        permanentlyDeleteProject,
        fetchTasks,
        fetchTrash,
        saveTask,
        saveTasks,
        deleteTask,
        bulkDeleteTasks,
        restoreTask,
        permanentlyDeleteTask,
        // TASK-153: Fetch deleted item IDs for golden backup validation
        fetchDeletedTaskIds,
        fetchDeletedProjectIds,
        fetchDeletedGroupIds,
        fetchGroups,
        saveGroup,
        deleteGroup,
        permanentlyDeleteGroup,
        // TASK-317: Tombstone functions
        fetchTombstones,
        // TASK-344: Immutable Task ID System
        safeCreateTask,
        checkTaskIdsAvailability,
        logDedupDecision,
        fetchNotifications,
        saveNotification,
        saveNotifications,
        deleteNotification,
        fetchActiveTimerSession,
        saveActiveTimerSession,
        deleteTimerSession,
        fetchUserSettings,
        saveUserSettings,
        fetchQuickSortHistory,
        saveQuickSortSession,
        initRealtimeSubscription
    }
}

// =============================================================================
// TASK-344: Exported Types for Immutable Task ID System
// =============================================================================

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
