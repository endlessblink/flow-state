import type { Task } from '@/types/tasks'
import {
    toSupabaseTask, fromSupabaseTask, toDbStatus,
    type SupabaseTask
} from '@/utils/supabaseMappers'
import { UNCATEGORIZED_PROJECT_ID } from '@/stores/tasks/taskOperations'
import {
    getSupabase, swrCache, invalidateCache,
    type DatabaseContext, type SafeCreateTaskResult, type TaskIdAvailability
} from './_infrastructure'
export function useTasksDatabase(ctx: DatabaseContext) {
    const { authStore, isSyncing, lastSyncError, getUserIdSafe, withRetry, handleError } = ctx

    const fetchTasks = async (workspaceId?: string | null): Promise<Task[]> => {
        // TASK-1060: Ensure auth is initialized before fetching to avoid stale guest data
        if (!authStore.isInitialized) {
            console.log('🔄 [TASK-1060] Auth not initialized, waiting...')
            await authStore.initialize()
        }

        const userId = getUserIdSafe()
        // BUG-1056: Check if user changed since last fetch - invalidates cache if so
        swrCache.checkUserChange(userId)
        // Workspace-aware cache key so switching workspaces invalidates stale results
        const wsKey = workspaceId === undefined ? 'all' : (workspaceId ?? 'personal')
        const cacheKey = `tasks:${userId || 'guest'}:ws:${wsKey}`

        return swrCache.getOrFetch(cacheKey, async () => {
            try {
                return await withRetry(async () => {
                    let query = getSupabase()
                        .from('tasks')
                        .select('*')
                        .eq('is_deleted', false)

                    // Workspace filter: undefined = legacy (no filter), null = personal, string = workspace
                    if (workspaceId === null) {
                        query = query.is('workspace_id', null)
                    } else if (typeof workspaceId === 'string') {
                        query = query.eq('workspace_id', workspaceId)
                    }
                    // workspaceId === undefined: no filter (legacy/backward-compat)

                    const { data, error } = await query
                        .order('order', { ascending: true })
                        .order('created_at', { ascending: true })

                    if (error) throw error
                    if (!data) return []

                    // TASK-142 DEBUG: Log what positions we receive from Supabase
                    const tasksWithPos = data.filter((d: Record<string, unknown>) => d.position)
                    if (tasksWithPos.length > 0) {
                        console.log(`📥 [TASK-142] LOADED ${tasksWithPos.length} tasks with positions from Supabase:`,
                            tasksWithPos.map((d: Record<string, unknown>) => ({ id: (d.id as string)?.substring(0, 8), pos: d.position })))
                    } else {
                        console.log(`📥 [TASK-142] LOADED ${data.length} tasks - NONE have positions in DB`)
                    }

                    return (data as SupabaseTask[]).map(fromSupabaseTask)
                }, 'fetchTasks')
            } catch (e: unknown) {
                handleError(e, 'fetchTasks')
                // BUG-1339: Re-throw so callers can retry instead of silently returning empty
                throw e
            }
        })
    }

    const fetchTrash = async (): Promise<Task[]> => {
        try {
            // BUG-1107: Wrap in withRetry for mobile PWA network resilience
            return await withRetry(async () => {
                const { data, error } = await getSupabase()
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
                const { error } = await getSupabase().from('tasks').upsert(payloadToSave, { onConflict: 'id' })

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
            console.warn('[BUG-1451] saveTasks SKIPPED — not authenticated! Task changes will NOT reach Supabase.')
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
                const { data, error } = await getSupabase()
                    .from('tasks')
                    .upsert(payloadToSave, { onConflict: 'id' })
                    .select('id, position')

                // Handle FK constraint violation on parent_task_id
                if (error?.code === '23503' && error?.message?.includes('parent_task_id') && !isRetry) {
                    console.warn(`⚠️ [saveTasks] FK violation on parent_task_id, clearing orphaned references and retrying`)
                    const clearedPayload = payloadToSave.map(t => ({ ...t, parent_task_id: null }))
                    return attemptUpsert(clearedPayload, true)
                }

                // Handle recurrence dedup constraint (idx_unique_recurrence_occurrence) — cross-device race
                // The conflict is between payload tasks and tasks already in the DB with the same
                // recurrence_parent_id + recurrence_count but different id. Drop recurrence clones and retry.
                if (error?.code === '23505' && error?.message?.includes('idx_unique_recurrence_occurrence') && !isRetry) {
                    const recurrenceCount = payloadToSave.filter(t => t.recurrence_parent_id && t.recurrence_count != null).length
                    console.warn(`⚠️ [saveTasks] Recurrence dedup constraint hit, dropping ${recurrenceCount} recurrence clones and retrying`)
                    const nonRecurrencePayload = payloadToSave.filter(t => !t.recurrence_parent_id || t.recurrence_count == null)
                    if (nonRecurrencePayload.length > 0) {
                        return attemptUpsert(nonRecurrencePayload, true)
                    }
                    // All tasks were recurrence duplicates — DB already has them, silently succeed
                    return
                }

                if (error) throw error

                // RLS check
                if (!data || data.length !== payloadToSave.length) {
                    const writtenCount = data?.length ?? 0
                    const failedCount = payloadToSave.length - writtenCount
                    throw new Error(`RLS blocked ${failedCount} of ${payloadToSave.length} writes (only ${writtenCount} succeeded)`)
                }

                // TASK-142 DEBUG: Log what Supabase returned
                const positionSaves = data.filter((d: Record<string, unknown>) => d.position)
                if (positionSaves.length > 0) {
                    console.log(`📥 [TASK-142] RECEIVED ${positionSaves.length} tasks with positions:`,
                        positionSaves.map((d: Record<string, unknown>) => ({ id: (d.id as string)?.substring(0, 8), pos: d.position })))
                } else if (tasksWithPos.length > 0) {
                    console.error(`❌ [TASK-142] POSITION LOST! Sent ${tasksWithPos.length} with positions, received 0 back!`)
                }
            }

            await withRetry(() => attemptUpsert(payload), 'saveTasks')

            if (import.meta.env.DEV) {
                console.log(`[BUG-1451] saveTasks SUCCESS: ${payload.map(t => `${t.id?.slice(0, 8)}:${t.status}`).join(', ')}`)
            }

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

            // BUG-352: Wrap in withRetry for mobile network resilience
            const { error: _error, count: _count } = await withRetry(async () => {
                const { error, count } = await getSupabase()
                    .from('tasks')
                    .update({ is_deleted: true, deleted_at: new Date().toISOString() }, { count: 'exact' })
                    .eq('id', taskId)
                    .select('*')

                console.log(`🗑️ [SUPABASE-DELETE] Result - error: ${error?.message || 'none'}, affected rows: ${count ?? 'unknown'}`)

                if (error) throw error
                return { error, count }
            }, 'deleteTask')

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

    const restoreTask = async (taskId: string): Promise<Task | null> => {
        try {
            isSyncing.value = true
            // BUG-352: Wrap in withRetry for mobile network resilience
            let restoredTask: Task | null = null
            await withRetry(async () => {
                const { data, error } = await getSupabase()
                    .from('tasks')
                    .update({ is_deleted: false, deleted_at: null })
                    .eq('id', taskId)
                    .select('*')
                    .single()
                if (error) throw error
                if (data) restoredTask = fromSupabaseTask(data as SupabaseTask)
            }, 'restoreTask')
            lastSyncError.value = null
            return restoredTask
        } catch (e: unknown) {
            handleError(e, 'restoreTask')
            throw e  // Re-throw so caller knows it failed (matches permanentlyDeleteTask pattern)
        } finally {
            isSyncing.value = false
        }
    }

    const permanentlyDeleteTask = async (taskId: string): Promise<void> => {
        try {
            isSyncing.value = true
            // BUG-1477: Just hard-delete. The DB trigger `trg_task_tombstone`
            // (BEFORE DELETE on tasks) auto-creates the tombstone in the same
            // transaction. No need for a separate recordTombstone() call.
            await withRetry(async () => {
                const { error } = await getSupabase()
                    .from('tasks')
                    .delete()
                    .eq('id', taskId)
                if (error) throw error
            }, 'permanentlyDeleteTask')
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'permanentlyDeleteTask')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    // TASK-153: Fetch IDs of deleted tasks (for golden backup validation)
    const fetchDeletedTaskIds = async (): Promise<string[]> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return []

            // BUG-1311: Wrap in withRetry for network resilience
            return await withRetry(async () => {
                const { data, error } = await getSupabase()
                    .from('tasks')
                    .select('id')
                    .eq('is_deleted', true)
                    .eq('user_id', userId)

                if (error) throw error
                return data?.map((d: Record<string, unknown>) => d.id as string) || []
            }, 'fetchDeletedTaskIds')
        } catch (e: unknown) {
            console.error('[TASK-153] Failed to fetch deleted task IDs:', e)
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

        // BUG-1738 SAFETY NET: Refuse to batch-delete more than 10 tasks in a single call.
        // This prevents sync/merge cascades from accidentally wiping large numbers of tasks.
        // User-initiated bulk deletes go through undoSingleton which processes in smaller batches.
        if (taskIds.length > 10) {
            console.error(`🛡️ [BULK-DELETE-GUARD] BLOCKED batch delete of ${taskIds.length} tasks (limit: 10). This may indicate a sync cascade bug.`)
            return
        }

        console.log(`🗑️ [SUPABASE-BULK-DELETE] Starting atomic soft-delete for ${taskIds.length} tasks`)
        try {
            isSyncing.value = true

            // BUG-352: Wrap in withRetry for mobile network resilience
            const { error: _error, count: _count } = await withRetry(async () => {
                const { error, count } = await getSupabase()
                    .from('tasks')
                    // FIX: Schema compatibility - remove deleted_at if not in DB
                    .update({ is_deleted: true }, { count: 'exact' })
                    .in('id', taskIds)
                    .select('*')

                console.log(`🗑️ [SUPABASE-BULK-DELETE] Result - error: ${error?.message || 'none'}, affected rows: ${count ?? 'unknown'}`)

                if (error) throw error
                return { error, count }
            }, 'bulkDeleteTasks')

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

    // =============================================================================
    // TASK-344: Immutable Task ID System
    // =============================================================================

    /**
     * TASK-344: Safely create a task, checking for existing IDs and tombstones.
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
            // TASK-1183: Sanitize project_id - 'uncategorized' is not a valid UUID
            const sanitizedProjectId = task.projectId === UNCATEGORIZED_PROJECT_ID || task.projectId === '1'
                ? null
                : (task.projectId || null)

            const { data: rpcResult, error: rpcError } = await getSupabase().rpc('safe_create_task', {
                p_task_id: task.id,
                p_user_id: userId,
                p_title: task.title,
                p_description: task.description || '',
                p_status: toDbStatus(task.status || 'todo'),
                p_priority: task.priority || 'medium',
                p_due_date: task.dueDate || null,
                p_project_id: sanitizedProjectId,
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
            const { data: existing, error: existError } = await getSupabase()
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
            const { data: tombstone, error: tombError } = await getSupabase()
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
            const { error: insertError } = await getSupabase().from('tasks').insert(payload)

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
            const { data: rpcResult, error: rpcError } = await getSupabase().rpc('check_task_ids_availability', {
                p_user_id: userId,
                p_task_ids: taskIds
            })

            if (!rpcError && rpcResult) {
                interface TaskIdCheckResult { task_id: string; status: string; reason: string }
                return (rpcResult as TaskIdCheckResult[]).map(r => ({
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
            const { data: existingTasks, error: tasksError } = await getSupabase()
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
            const { data: tombstones, error: tombError } = await getSupabase()
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
            await getSupabase().from('task_dedup_audit').insert({
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

    return {
        fetchTasks,
        fetchTrash,
        saveTask,
        saveTasks,
        deleteTask,
        bulkDeleteTasks,
        restoreTask,
        permanentlyDeleteTask,
        fetchDeletedTaskIds,
        safeCreateTask,
        checkTaskIdsAvailability,
        logDedupDecision,
    }
}
