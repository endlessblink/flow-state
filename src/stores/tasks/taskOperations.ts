// TASK-129: Removed transactionManager (PouchDB WAL stub no longer needed)
import { type Ref } from 'vue'
import type { Task, Subtask, TaskInstance } from '@/types/tasks'
// TASK-127: Removed taskDisappearanceLogger (PouchDB-era debugging tool)
import { guardTaskCreation } from '@/utils/demoContentGuard'
import { formatDateKey } from '@/utils/dateUtils'
// FEATURE-1118: Gamification hooks for task completion
import { useGamificationHooks } from '@/composables/useGamificationHooks'
// BUG-1303: Stop timer when task marked done
import { useTimerStore } from '@/stores/timer'
// TASK-1177: Offline-first sync queue integration
import { useSyncOrchestrator } from '@/composables/sync/useSyncOrchestrator'
// TASK-089 FIX: Unlock position when removing from canvas
// TASK-131 FIX: Protect locked positions from being overwritten by stale sync data

/** Frontend sentinel for tasks with no project. Sanitized to null before DB writes. */
export const UNCATEGORIZED_PROJECT_ID = 'uncategorized' as const

// BUG-1184: Helper to check if a string is a valid UUID (for parent_id column)
// Group IDs like "group-xxx" should NOT be saved to parent_id (UUID column)
const isValidUUID = (str: string | null | undefined): boolean => {
    if (!str) return false
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
}

// =============================================================================
// GEOMETRY WRITE SOURCE (TASK-255 Geometry Invariants)
// =============================================================================
// Tracks the origin of geometry mutations for drift detection.
// - 'DRAG': User drag/drop operations (ALLOWED)
// - 'RECONCILE': One-time parent reconciliation on load (CONTROLLED)
// - 'USER': Explicit user actions like move-to-inbox (ALLOWED)
// - 'SYNC': Remote sync updates (SHOULD NOT change geometry)
// - 'SMART-GROUP': Smart group property application (METADATA ONLY - no geometry!)
// =============================================================================
export type GeometryWriteSource = 'DRAG' | 'RECONCILE' | 'USER' | 'SYNC' | 'SMART-GROUP'

import { useSmartViews, type SmartView } from '@/composables/useSmartViews'
import { useProjectStore } from '../projects'
import { useAuthStore } from '../auth'

export function useTaskOperations(
    // SAFETY: Named _rawTasks to indicate this is the raw array for mutations
    _rawTasks: Ref<Task[]>,
    selectedTaskIds: Ref<string[]>,
    activeSmartView: Ref<SmartView>,
    activeStatusFilter: Ref<string | null>,
    activeDurationFilter: Ref<'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>,
    hideDoneTasks: Ref<boolean>,
    hideCanvasDoneTasks: Ref<boolean>,
    hideCalendarDoneTasks: Ref<boolean>,
    hideCanvasOverdueTasks: Ref<boolean>,
    manualOperationInProgress: Ref<boolean>,
    saveTasksToStorage: (tasks: Task[], context: string) => Promise<void>,
    saveSpecificTasks: (tasks: Task[], context: string) => Promise<void>,
    deleteTaskFromStorage: (taskId: string) => Promise<void>,
    bulkDeleteTasksFromStorage: (taskIds: string[]) => Promise<void>,  // BUG-025: Atomic bulk delete
    persistFilters: () => void,
    _runAllTaskMigrations: () => void,
    addPendingWrite: (taskId: string) => void
) {
    const projectStore = useProjectStore()

    // Helper to trigger canvas sync after task operations
    // This bypasses Vue's watch system which has timing issues in Tauri/WebKitGTK
    // DRIFT FIX: Now requires explicit source to prevent automated sync loops
    const triggerCanvasSync = (source: 'user:create' | 'user:delete' | 'user:context-menu' = 'user:create') => {
        // Dynamic import to avoid circular dependency and context issues
        import('../canvas/canvasUi').then(({ useCanvasUiStore }) => {
            const canvasUiStore = useCanvasUiStore()
            canvasUiStore.requestSync(source)
        }).catch(_e => {
            // Ignore if canvas store not available (e.g., in non-canvas views)
        })
    }

    const createTask = async (taskData: Partial<Task>) => {
        // TASK-061: Demo content guard - warn in dev mode
        if (taskData.title) {
            guardTaskCreation(taskData.title)
        }

        // BUG-336: Preserve task ID if provided (needed for undo restore)
        const taskId = taskData.id || crypto.randomUUID()
        manualOperationInProgress.value = true

        try {
            const instances: TaskInstance[] = taskData.instances ? [...taskData.instances] : []
            if (instances.length === 0 && taskData.scheduledDate && taskData.scheduledTime) {
                const now = new Date()
                instances.push({
                    id: `instance-${taskId}-${Date.now()}`,
                    taskId: taskId,
                    scheduledDate: taskData.scheduledDate,
                    scheduledTime: taskData.scheduledTime,
                    duration: taskData.estimatedDuration || 25,
                    status: 'scheduled',
                    isRecurring: false,
                    createdAt: now,
                    updatedAt: now
                })
            }
            // BUG-1325: Removed auto-instance creation from dueDate.
            // Tasks should only appear on calendar when user explicitly drags them or sets start/end time.
            // A dueDate is a deadline, not a calendar time block.

            // Keep 'uncategorized' as frontend placeholder, sanitize to null when sending to DB
            let projectId = taskData.projectId || UNCATEGORIZED_PROJECT_ID
            if (taskData.parentTaskId) {
                const parentTask = _rawTasks.value.find(t => t.id === taskData.parentTaskId)
                if (parentTask) projectId = parentTask.projectId
            }

            // BUG-1321: Exclude instances and canvasPosition from spread to prevent overwriting computed values
            const { canvasPosition: explicitCanvasPosition, instances: _taskDataInstances, ...taskDataWithoutPositionAndInstances } = taskData

            const newTask: Task = {
                id: taskId,
                title: taskData.title || 'New Task',
                description: taskData.description || '',
                status: taskData.status || 'planned',
                priority: taskData.priority || 'medium',
                progress: 0,
                completedPomodoros: 0,
                subtasks: [],
                // BUG-1325: dueDate only set if explicitly provided or inferred from scheduledDate
                // (scheduledDate implies a deadline on that date, but does NOT create calendar instances)
                dueDate: taskData.dueDate || taskData.scheduledDate || '',
                projectId,
                createdAt: new Date(),
                updatedAt: new Date(),
                isInInbox: taskData.isInInbox !== false,
                canvasPosition: explicitCanvasPosition || undefined,
                positionVersion: 1, // Start at version 1
                positionFormat: taskData.positionFormat || 'absolute', // Default to absolute
                ...taskDataWithoutPositionAndInstances,
                // BUG-1321: instances MUST come AFTER spread to preserve auto-created instances
                instances,
            }

            _rawTasks.value.push(newTask)

            // TASK-1177: Queue for offline-first sync
            // This ensures the task persists in IndexedDB even if network fails
            try {
                const syncOrchestrator = useSyncOrchestrator()
                const authStore = useAuthStore()
                // BUG-1184: CRITICAL - user_id is REQUIRED for RLS policy
                // authStore exports `user` not `userId` - must use user?.id
                const userId = authStore.user?.id
                if (!userId) {
                    // BUG-1193: Don't throw - task was already added to local store above
                    // Throwing here would break the entire createTask flow and prevent
                    // the task from appearing in the UI. Direct save below will handle sync.
                    console.warn('[SYNC] Skipping sync queue: user not authenticated (direct save will handle sync)')
                    // Skip enqueueing but still attempt direct save below
                    throw new Error('SKIP_QUEUE_NO_AUTH')
                }
                // BUGFIX: Filter out undefined values to prevent "null" string errors in Postgres
                // BUGFIX: Use JSON.parse/stringify to strip Vue reactivity (Proxy objects can't be cloned to IndexedDB)
                const payload: Record<string, unknown> = {
                    id: newTask.id,
                    user_id: userId, // Required for RLS - MUST be valid UUID
                    title: newTask.title,
                    description: newTask.description,
                    status: newTask.status,
                    priority: newTask.priority,
                    progress: newTask.progress,
                    completed_pomodoros: newTask.completedPomodoros,
                    is_in_inbox: newTask.isInInbox,
                    position_version: newTask.positionVersion,
                    created_at: newTask.createdAt.toISOString(),
                    updated_at: newTask.updatedAt.toISOString()
                }
                // Only add optional fields if they have values (not undefined/null)
                if (newTask.dueDate) payload.due_date = newTask.dueDate
                // BUG-1184: Only set project_id for valid UUIDs - 'uncategorized' is NOT a valid UUID
                if (newTask.projectId && isValidUUID(newTask.projectId)) {
                    payload.project_id = newTask.projectId
                }
                // BUG-1184: Only set parent_id for valid UUIDs (sub-tasks)
                // Group IDs like "group-xxx" are NOT valid UUIDs and cause Postgres errors
                if (newTask.parentId && isValidUUID(newTask.parentId)) {
                    payload.parent_id = newTask.parentId
                }
                // Strip reactivity from complex objects - use 'position' column (not 'canvas_position')
                if (newTask.canvasPosition) {
                    payload.position = {
                        x: newTask.canvasPosition.x,
                        y: newTask.canvasPosition.y,
                        parentId: newTask.parentId,
                        format: 'absolute'
                    }
                }
                // BUG-1187: Include doneForNowUntil in sync payload
                if (newTask.doneForNowUntil) {
                    payload.done_for_now_until = newTask.doneForNowUntil
                }

                await syncOrchestrator.enqueue({
                    entityType: 'task',
                    operation: 'create',
                    entityId: newTask.id,
                    payload: JSON.parse(JSON.stringify(payload)), // Strip all reactivity
                    baseVersion: 0
                })
            } catch (queueError) {
                console.warn('[SYNC-QUEUE] Failed to queue create, falling back to direct save:', queueError)
            }

            // Also attempt direct save (for immediate sync when online)
            await saveSpecificTasks([newTask], `createTask-${newTask.id}`)

            // Trigger canvas sync for Tauri reactivity
            triggerCanvasSync()

            return newTask
        } catch (error) {
            const index = _rawTasks.value.findIndex(t => t.id === taskId)
            if (index !== -1) _rawTasks.value.splice(index, 1)
            throw error
        } finally {
            manualOperationInProgress.value = false
        }
    }

    /**
     * BUG-1321: Bidirectional date field sync
     * When dueDate, scheduledDate, or instances change, keep the others in sync.
     * Called BEFORE the save in updateTask() — augments the updates object.
     * NO new watchers, NO recursive updateTask() calls — just object augmentation.
     */
    function syncDateFields(task: Task, updates: Partial<Task>): Partial<Task> {
        const synced = { ...updates }

        // GUARD: If caller explicitly set multiple date fields, trust them
        const dateFieldsInUpdate = [
            updates.dueDate !== undefined,
            updates.scheduledDate !== undefined,
            updates.instances !== undefined
        ].filter(Boolean).length
        if (dateFieldsInUpdate > 1) return synced // Caller knows what they're doing

        // CASE 1: dueDate changed → sync scheduledDate for legacy compat, but do NOT auto-create calendar instances
        // BUG-1325: A dueDate is a deadline, not a calendar time block. Only explicit user actions
        // (drag to calendar, set time in modal, "Start Now") should create calendar instances.
        if (updates.dueDate !== undefined && updates.instances === undefined) {
            const newDueDate = updates.dueDate
            if (newDueDate && newDueDate !== 'null') {
                synced.scheduledDate = newDueDate
                synced.scheduledTime = synced.scheduledTime || task.scheduledTime || '09:00'
                synced.isInInbox = false
            }
            // dueDate cleared — DON'T clear instances (user may have scheduled independently)
        }

        // CASE 2: instances changed (calendar interaction) → always sync dueDate to earliest instance
        if (updates.instances !== undefined && updates.dueDate === undefined) {
            const instances = updates.instances || []
            if (instances.length > 0) {
                const earliest = instances.reduce((a, b) =>
                    (a.scheduledDate || '') < (b.scheduledDate || '') ? a : b
                )
                if (earliest.scheduledDate) {
                    synced.dueDate = earliest.scheduledDate
                }
            }
            // DON'T clear dueDate when instances are cleared (keep deadline even if unscheduled)
        }

        // CASE 3: scheduledDate changed (legacy/calendar drag) → sync dueDate + create instance
        if (updates.scheduledDate !== undefined && updates.dueDate === undefined && updates.instances === undefined) {
            if (updates.scheduledDate) {
                synced.dueDate = updates.scheduledDate
                // Also create an instance for the new date if none exists
                const existing = (task.instances || []).find(i => i.scheduledDate === updates.scheduledDate)
                if (!existing) {
                    synced.instances = [
                        ...(task.instances || []),
                        {
                            id: `auto-${task.id}-${Date.now()}`,
                            scheduledDate: updates.scheduledDate,
                            scheduledTime: (updates as Record<string, unknown>).scheduledTime as string || task.scheduledTime || '09:00',
                            duration: task.estimatedDuration || 30
                        } as TaskInstance
                    ]
                }
            }
        }

        return synced
    }

    /**
     * Update a task with optional geometry write source tracking (TASK-255)
     *
     * @param taskId - The ID of the task to update
     * @param updates - Partial task updates to apply
     * @param source - Origin of the update for drift detection (default: 'USER')
     *
     * GEOMETRY INVARIANT: Only 'DRAG' and 'USER' sources should include
     * parentId or canvasPosition changes. If 'SYNC' or 'SMART-GROUP' sources
     * include geometry changes, a warning will be logged.
     */
    const updateTask = async (taskId: string, updates: Partial<Task>, source: GeometryWriteSource = 'USER') => {
        const index = _rawTasks.value.findIndex(t => t.id === taskId)
        if (index === -1) return

        // BUG-060 FIX: Suppress watcher during manual update to prevent concurrent bulk saves
        // This prevents the "8 conflicts in bulk save" issue
        const wasManualInProgress = manualOperationInProgress.value
        if (!wasManualInProgress) manualOperationInProgress.value = true

        // BUG-1207 FIX: Register pending write to suppress realtime echo from own save.
        // Without this, Supabase fires a realtime event back for our own write,
        // and the echo can overwrite newer local state (especially during rapid edits).
        addPendingWrite(taskId)

        try {
            const task = _rawTasks.value[index]

            // GEOMETRY DRIFT DETECTION (TASK-255): Track and warn about geometry changes
            const hasGeometryChange = ('parentId' in updates && updates.parentId !== task.parentId) ||
                ('canvasPosition' in updates && updates.canvasPosition !== undefined &&
                    (task.canvasPosition?.x !== updates.canvasPosition?.x ||
                        task.canvasPosition?.y !== updates.canvasPosition?.y))

            // Warn if non-allowed sources try to change geometry
            if (import.meta.env.DEV && hasGeometryChange && (source === 'SYNC' || source === 'SMART-GROUP')) {
                console.warn(`⚠️ [GEOMETRY-DRIFT] Source '${source}' is changing geometry - this may cause position drift!`, {
                    taskId: taskId.slice(0, 8),
                    taskTitle: task.title?.slice(0, 30),
                    parentIdChange: 'parentId' in updates,
                    positionChange: 'canvasPosition' in updates
                })
            }

            // DRIFT LOGGING: Track when parentId or canvasPosition is changed
            // This helps identify non-drag flows that mutate hierarchy/positions
            if (import.meta.env.DEV) {
                if ('parentId' in updates && updates.parentId !== task.parentId) {
                    console.log(`📍 [GEOMETRY-${source}] Task ${taskId.slice(0, 8)}... parentId: "${task.parentId ?? 'none'}" → "${updates.parentId ?? 'none'}"`, {
                        taskTitle: task.title?.slice(0, 30),
                        source,
                        stack: new Error().stack?.split('\n').slice(2, 5).join(' <- ')
                    })
                }
                if ('canvasPosition' in updates && updates.canvasPosition !== undefined) {
                    const oldPos = task.canvasPosition
                    const newPos = updates.canvasPosition
                    if (oldPos?.x !== newPos?.x || oldPos?.y !== newPos?.y) {
                        console.log(`📍 [GEOMETRY-${source}] Task ${taskId.slice(0, 8)}... pos: (${oldPos?.x?.toFixed(0) ?? '?'},${oldPos?.y?.toFixed(0) ?? '?'}) → (${newPos?.x?.toFixed(0) ?? 'null'},${newPos?.y?.toFixed(0) ?? 'null'})`, {
                            taskTitle: task.title?.slice(0, 30),
                            source,
                            stack: new Error().stack?.split('\n').slice(2, 5).join(' <- ')
                        })
                    }
                }
            }

            // BUG-045 FIX: Removed auto-archive behavior
            // Tasks now stay on canvas when marked as done (no position/inbox changes)

            // Canvas logic
            if (updates.canvasPosition && !task.canvasPosition) {
                updates.isInInbox = false
            }

            // BUG-FIX: Explicitly unlock position if removing from canvas
            // This prevents sync from restoring the position due to "Preserve local canvasPosition" logic
            if (updates.canvasPosition === null) {
                // Position will be cleared by the update
            }

            // TASK-131 FIX: Protect locked positions from being overwritten by stale sync data
            // If a position lock (pending change) exists, use that position instead of the update
            if (updates.canvasPosition && updates.canvasPosition !== null) {
                // Position lock protection handled by persistence logic
            }

            if (updates.canvasPosition === undefined && task.canvasPosition && !updates.instances && (!task.instances || !task.instances.length)) {
                // updates.isInInbox = true // Wait, why force inbox true if just position is undefined but task has position? 
                // This logic implies check if task HAS position.
                // Let's log if this triggers.
            }

            // Project logic
            if ('projectId' in updates) {
                const isUncategorized = !updates.projectId || updates.projectId === '1' || updates.projectId === UNCATEGORIZED_PROJECT_ID
                updates.isUncategorized = isUncategorized
            }

            // Orphan prevention
            const finalInInbox = updates.isInInbox ?? task.isInInbox
            const finalPos = updates.canvasPosition ?? task.canvasPosition
            const finalInst = updates.instances ?? task.instances
            if (!finalInInbox && !finalPos && (!finalInst || !finalInst.length)) {
                // updates.isInInbox = true
            }

            // TASK-240: Handle position versioning
            // NOTE: hasGeometryChange already defined at line ~157 includes both parentId AND canvasPosition changes
            const currentVersion = task.positionVersion || 0
            const newVersion = hasGeometryChange ? currentVersion + 1 : currentVersion

            // DONE-ZONE: Track completedAt when task status changes to/from 'done'
            // This enables age-based filtering for Done Zone (1-7 days) vs Inbox (7+ days)
            if ('status' in updates) {
                const wasNotDone = task.status !== 'done'
                const isNowDone = updates.status === 'done'
                const wasDone = task.status === 'done'
                const isNowNotDone = updates.status !== 'done'

                // Set completedAt when status changes TO 'done'
                if (wasNotDone && isNowDone) {
                    updates.completedAt = new Date()
                    console.log(`✅ [DONE-ZONE] Task "${task.title?.slice(0, 30)}" marked done, completedAt set`)

                    // FEATURE-1118: Award XP for task completion
                    try {
                        const gamificationHooks = useGamificationHooks()
                        const isOverdue = !!(task.dueDate && new Date(task.dueDate) < new Date())
                        gamificationHooks.onTaskCompleted(task, {
                            wasOverdue: isOverdue,
                            createdAt: task.createdAt
                        }).catch(e => console.warn('[Gamification] Task completion hook failed:', e))
                    } catch (e) {
                        // Gamification is non-critical, don't break task flow
                        console.warn('[Gamification] Hook error:', e)
                    }

                    // BUG-1303: Stop timer if it's running on the completed task
                    try {
                        const timerStore = useTimerStore()
                        if (timerStore.currentTaskId === taskId && timerStore.isTimerActive) {
                            await timerStore.stopTimer()
                            console.log(`⏱️ [TIMER] Auto-stopped timer for completed task "${task.title?.slice(0, 30)}"`)
                        }
                    } catch (e) {
                        console.warn('[Timer] Auto-stop on task completion failed:', e)
                    }

                    // ================================================================
                    // AUTO-ARCHIVE: Move done tasks off canvas to inbox
                    // ================================================================
                    // INTENTIONAL GEOMETRY INVARIANT EXCEPTION (TASK-255)
                    //
                    // This clears canvasPosition and parentId, which are geometry
                    // properties normally restricted to drag handlers only.
                    // This is ALLOWED because:
                    //   1. Done tasks must leave the canvas — keeping them causes
                    //      position/sync drift and visual clutter
                    //   2. The write is always triggered by an explicit status change
                    //      (user or sync marking task as 'done'), not by background sync
                    //   3. The direction is always "remove from canvas" (clear), never
                    //      "move to a new position" — so it cannot cause position drift
                    // ================================================================
                    if (task.canvasPosition) {
                        updates.canvasPosition = undefined
                        updates.isInInbox = true
                        updates.parentId = undefined
                        console.log(`📦 [DONE-ARCHIVE] Task "${task.title?.slice(0, 30)}" moved off canvas to inbox`)
                    }
                }
                // Clear completedAt when status changes FROM 'done' (task reopened)
                else if (wasDone && isNowNotDone) {
                    updates.completedAt = undefined
                    console.log(`🔄 [DONE-ZONE] Task "${task.title?.slice(0, 30)}" reopened, completedAt cleared`)
                }
            }

            // BUG-1321: Sync date fields bidirectionally before save
            const syncedUpdates = syncDateFields(task, updates)

            _rawTasks.value[index] = {
                ...task,
                ...syncedUpdates,
                positionVersion: newVersion,
                updatedAt: new Date()
            }

            // TASK-1177: Queue for offline-first sync FIRST
            // This ensures the update persists in IndexedDB even if network fails
            const updatedTask = _rawTasks.value[index]
            try {
                const syncOrchestrator = useSyncOrchestrator()
                // BUGFIX: Filter out undefined values to prevent "null" string errors in Postgres
                // BUGFIX: Use JSON.parse/stringify to strip Vue reactivity (Proxy objects can't be cloned to IndexedDB)
                const payload: Record<string, unknown> = {
                    title: updatedTask.title,
                    description: updatedTask.description,
                    status: updatedTask.status,
                    priority: updatedTask.priority,
                    progress: updatedTask.progress,
                    completed_pomodoros: updatedTask.completedPomodoros,
                    is_in_inbox: updatedTask.isInInbox,
                    position_version: updatedTask.positionVersion,
                    updated_at: updatedTask.updatedAt.toISOString()
                }
                // Only add optional fields if they have values (not undefined/null)
                // Use explicit null for fields that need to be cleared
                // BUGFIX: Check for "null" string which causes Postgres timestamp parse error
                if (updatedTask.dueDate !== undefined) {
                    const dueDate = updatedTask.dueDate
                    payload.due_date = (!dueDate || dueDate === 'null' || dueDate === 'undefined') ? null : dueDate
                }
                // BUG-1184: Only set project_id for valid UUIDs - 'uncategorized' is NOT a valid UUID
                if (updatedTask.projectId !== undefined) {
                    payload.project_id = isValidUUID(updatedTask.projectId) ? updatedTask.projectId : null
                }
                // BUG-1184: Only set parent_id for valid UUIDs (sub-tasks)
                // Group IDs like "group-xxx" are NOT valid UUIDs and cause Postgres errors
                // Canvas group association is stored in position.parentId (JSONB), not parent_id (UUID)
                if (updatedTask.parentId !== undefined) {
                    payload.parent_id = isValidUUID(updatedTask.parentId) ? updatedTask.parentId : null
                }
                if (updatedTask.canvasPosition !== undefined) {
                    // Use 'position' column (not 'canvas_position') - format as DB expects
                    payload.position = updatedTask.canvasPosition
                        ? {
                            x: updatedTask.canvasPosition.x,
                            y: updatedTask.canvasPosition.y,
                            parentId: updatedTask.parentId,
                            format: 'absolute'
                        }
                        : null
                }
                if (updatedTask.completedAt !== undefined) {
                    const completedAt = updatedTask.completedAt
                    if (completedAt instanceof Date) {
                        payload.completed_at = completedAt.toISOString()
                    } else {
                        payload.completed_at = (!completedAt || completedAt === 'null' || completedAt === 'undefined') ? null : completedAt
                    }
                }
                // BUG-1187: Include doneForNowUntil in sync payload
                // Without this, the "Done for now" badge resets on page refresh
                if (updatedTask.doneForNowUntil !== undefined) {
                    const doneForNowUntil = updatedTask.doneForNowUntil
                    payload.done_for_now_until = (!doneForNowUntil || doneForNowUntil === 'null' || doneForNowUntil === 'undefined') ? null : doneForNowUntil
                }
                // BUG-1302: Include instances in sync queue payload
                // Without this, calendar time blocks aren't backed up by the sync queue
                if (updatedTask.instances !== undefined) {
                    payload.instances = JSON.parse(JSON.stringify(updatedTask.instances))
                }
                // BUG-1321: Include subtasks in sync queue payload
                // Without this, offline subtask changes are silently dropped
                if (updatedTask.subtasks !== undefined) {
                    payload.subtasks = JSON.parse(JSON.stringify(updatedTask.subtasks))
                }

                await syncOrchestrator.enqueue({
                    entityType: 'task',
                    operation: 'update',
                    entityId: taskId,
                    payload: JSON.parse(JSON.stringify(payload)), // Strip all reactivity
                    baseVersion: currentVersion
                })
            } catch (queueError) {
                const errorMsg = queueError instanceof Error ? queueError.message : String(queueError)
                console.warn('[SYNC-QUEUE] Failed to queue update, falling back to direct save:', errorMsg)
                // BUG-1207 FIX (Fix 2.3): Only fall back to direct save when sync queue fails
                // (e.g., guest mode with no auth, or IndexedDB unavailable).
                // This replaces the old dual-write where BOTH paths always ran.
                try {
                    await saveSpecificTasks([updatedTask], `updateTask-fallback-${taskId}`)
                } catch (saveError) {
                    console.warn(`[SYNC-QUEUE] Fallback save also failed for ${taskId}:`, saveError)
                }
            }

            // BUG-1207: Direct save to Supabase (VPS is primary persistence).
            // The sync queue above is a backup for offline/failure scenarios.
            // Direct save ensures changes hit VPS immediately without waiting for queue interval.
            // Echo protection: pendingWrites (120s, tied to sync completion) prevents
            // the realtime echo from this save from reverting local state.
            try {
                await saveSpecificTasks([updatedTask], `updateTask-direct-${taskId}`)
            } catch (directSaveError) {
                // Direct save failed - sync queue will retry. Don't throw, change is queued.
                console.warn(`[TASK] Direct save failed for ${taskId}, sync queue will retry:`, directSaveError)
            }
        } finally {
            if (!wasManualInProgress) manualOperationInProgress.value = false
        }
    }

    const deleteTask = async (taskId: string) => {
        const index = _rawTasks.value.findIndex(t => t.id === taskId)
        if (index === -1) return

        const deletedTask = _rawTasks.value[index]
        manualOperationInProgress.value = true

        // BUG-1211 FIX: Mark as pending write BEFORE the delete so the realtime
        // echo (UPDATE with is_deleted=true) doesn't get processed as an external event.
        // Without this, the realtime handler would redundantly splice the task again.
        addPendingWrite(taskId)

        try {
            // TASK-1177: Queue deletion for offline-first sync FIRST
            // This ensures the delete persists in IndexedDB even if network fails
            try {
                const syncOrchestrator = useSyncOrchestrator()
                await syncOrchestrator.enqueue({
                    entityType: 'task',
                    operation: 'delete',
                    entityId: taskId,
                    payload: { id: taskId },
                    baseVersion: deletedTask.positionVersion || 0
                })
            } catch (queueError) {
                console.warn('[SYNC-QUEUE] Failed to queue delete, falling back to direct delete:', queueError)
            }

            // Also attempt direct delete for immediate sync when online
            // BUGFIX: Persist deletion to Supabase FIRST (soft delete)
            // This ensures task won't reappear on refresh
            await deleteTaskFromStorage(taskId)

            _rawTasks.value.splice(index, 1)

            // Save to localStorage AFTER splice (for guest mode persistence)
            await saveTasksToStorage(_rawTasks.value, 'deleteTask')

            // TASK-131: Removed triggerCanvasSync() - surgical deletion watcher in CanvasView handles this
            // The watcher detects the deletion and removes only the affected node, preventing position resets
        } catch (error) {
            _rawTasks.value.splice(index, 0, deletedTask)
            console.error(`❌ [DELETE] Failed to delete task ${taskId}:`, error)
            throw error
        } finally {
            manualOperationInProgress.value = false
        }
    }

    // [DEEP-DIVE FIX] Added permanent delete operation
    const permanentlyDeleteTask = async (taskId: string) => {
        const index = _rawTasks.value.findIndex(t => t.id === taskId)
        if (index === -1) return

        manualOperationInProgress.value = true
        try {
            // 1. Remove from local state immediately (Optimistic UI)
            _rawTasks.value.splice(index, 1)

            // 2. Call TrashService for DB removal (Hard Delete)
            const { trashService } = await import('@/services/trash/TrashService')
            await trashService.permanentlyDeleteTask(taskId)

            // 3. Ensure no artifacts remain in individual storage if needed
        } catch (error) {
            console.error(`❌ Failed to permanently delete ${taskId}:`, error)
        } finally {
            manualOperationInProgress.value = false
        }
    }

    // BUG-025 FIX: Atomic bulk delete using Supabase .in() operator
    const bulkDeleteTasks = async (taskIds: string[]) => {
        if (!taskIds.length) return
        manualOperationInProgress.value = true

        try {
            // BUG-025 FIX: Use atomic bulk delete instead of looping
            await bulkDeleteTasksFromStorage(taskIds)

            const tasksToKeep = _rawTasks.value.filter(t => !taskIds.includes(t.id))
            _rawTasks.value = tasksToKeep

            // Save to localStorage AFTER filter (for guest mode persistence)
            await saveTasksToStorage(_rawTasks.value, 'bulkDeleteTasks')

            // TASK-131: Removed triggerCanvasSync() - surgical deletion watcher in CanvasView handles this
            // The watcher detects bulk deletions and removes only the affected nodes, preventing position resets
        } catch (error) {
            console.error(`❌ [BULK-DELETE] Failed to delete ${taskIds.length} tasks:`, error)
            throw error
        } finally {
            manualOperationInProgress.value = false
        }
    }

    const moveTask = async (taskId: string, newStatus: Task['status']) => {
        await updateTask(taskId, { status: newStatus }) // BUG-1051: AWAIT to ensure persistence
    }

    const selectTask = (taskId: string) => {
        if (!selectedTaskIds.value.includes(taskId)) selectedTaskIds.value.push(taskId)
    }

    const deselectTask = (taskId: string) => {
        const idx = selectedTaskIds.value.indexOf(taskId)
        if (idx !== -1) selectedTaskIds.value.splice(idx, 1)
    }

    const clearSelection = () => {
        selectedTaskIds.value = []
    }

    // BUG-1321: Subtask methods now route through updateTask() for proper
    // echo protection, sync queue enrollment, and pending write registration.

    const createSubtask = async (taskId: string, subtaskData: Partial<Subtask>) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return null
        const newSubtask: Subtask = {
            id: Date.now().toString(),
            parentTaskId: taskId,
            title: subtaskData.title || 'New Subtask',
            description: subtaskData.description || '',
            completedPomodoros: 0,
            isCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }
        const updatedSubtasks = [...(task.subtasks || []), newSubtask]
        await updateTask(taskId, { subtasks: updatedSubtasks })
        return newSubtask
    }

    const updateSubtask = async (taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return
        const idx = task.subtasks.findIndex(st => st.id === subtaskId)
        if (idx === -1) return
        const updatedSubtasks = [...task.subtasks]
        updatedSubtasks[idx] = { ...updatedSubtasks[idx], ...updates, updatedAt: new Date() }
        await updateTask(taskId, { subtasks: updatedSubtasks })
    }

    const deleteSubtask = async (taskId: string, subtaskId: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return
        const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId)
        await updateTask(taskId, { subtasks: updatedSubtasks })
    }

    // BUG-1321: Instance methods now route through updateTask() for proper
    // echo protection, sync queue enrollment, and bidirectional date sync.

    const createTaskInstance = async (taskId: string, instanceData: Omit<TaskInstance, 'id'>) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return null
        const newInstance: TaskInstance = {
            id: Date.now().toString(),
            ...instanceData
        }
        const updatedInstances = [...(task.instances || []), newInstance]
        await updateTask(taskId, { instances: updatedInstances })
        return newInstance
    }

    const updateTaskInstance = async (taskId: string, instanceId: string, updates: Partial<TaskInstance>) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task || !task.instances) return
        const idx = task.instances.findIndex(inst => inst.id === instanceId)
        if (idx === -1) return
        const updatedInstances = [...task.instances]
        updatedInstances[idx] = { ...updatedInstances[idx], ...updates }
        await updateTask(taskId, { instances: updatedInstances })
    }

    const deleteTaskInstance = async (taskId: string, instanceId: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task || !task.instances) return
        const updatedInstances = task.instances.filter(inst => inst.id !== instanceId)
        await updateTask(taskId, { instances: updatedInstances })
    }

    /**
     * ✅ TASK-192: Atomic update for task scheduling
     * Combines task updates and instance updates to prevent race conditions
     */
    const updateTaskWithSchedule = async (taskId: string, schedule: {
        scheduledDate: string
        scheduledTime: string
        instanceId?: string
    }) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return

        const updates: Partial<Task> = {
            scheduledDate: schedule.scheduledDate,
            scheduledTime: schedule.scheduledTime,
            // When scheduling on calendar, it's no longer in inbox
            isInInbox: false
        }

        // If instance exists, update it too
        if (schedule.instanceId && task.instances) {
            const instances = [...task.instances]
            const idx = instances.findIndex(i => i.id === schedule.instanceId)
            if (idx !== -1) {
                instances[idx] = {
                    ...instances[idx],
                    scheduledDate: schedule.scheduledDate,
                    scheduledTime: schedule.scheduledTime,
                    updatedAt: new Date()
                }
                updates.instances = instances
            }
        }

        await updateTask(taskId, updates)
    }

    const startTaskNow = async (taskId: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) {
            console.warn('🎯 startTaskNow: Task not found:', taskId)
            return
        }
        const now = new Date()
        const currentMinutes = now.getMinutes()
        const roundedMinutes = currentMinutes < 30 ? 0 : 30
        const roundedTime = new Date(now)
        roundedTime.setMinutes(roundedMinutes, 0, 0)

        const newInstance = {
            id: `instance-${taskId}-${Date.now()}`,
            scheduledDate: formatDateKey(now),
            scheduledTime: `${roundedTime.getHours().toString().padStart(2, '0')}:${roundedTime.getMinutes().toString().padStart(2, '0')}`,
            duration: task.estimatedDuration || 60
        }
        // BUG-1090: AWAIT to ensure instance is persisted before navigation
        // BUG-1291: APPEND new instance instead of replacing — preserves existing start times
        const existingInstances = task.instances || []
        await updateTask(taskId, { instances: [...existingInstances, newInstance], status: 'in_progress' })
    }

    const moveTaskToSmartGroup = async (taskId: string, type: string) => {
        const today = new Date()
        let dueDate = ''
        switch (type.toLowerCase()) {
            case 'today': {
                dueDate = formatDateKey(today)
                break
            }
            case 'tomorrow': {
                const tom = new Date(today)
                tom.setDate(today.getDate() + 1)
                dueDate = formatDateKey(tom)
                break
            }
            case 'this weekend': {
                const sat = new Date(today)
                sat.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7 || 7))
                dueDate = formatDateKey(sat)
                break
            }
            case 'this week': {
                const sun = new Date(today)
                sun.setDate(today.getDate() + ((7 - today.getDay()) % 7 || 7))
                dueDate = formatDateKey(sun)
                break
            }
            case 'later': {
                // "Later" clears the due date - task is postponed indefinitely
                dueDate = ''
                break
            }
            default:
                // BUG-016 FIX: Return early for unknown types to prevent clearing dueDate
                console.warn(`⚠️ [TASK-114] Unknown smart group type: "${type}" - no update performed`)
                return
        }
        await updateTask(taskId, { dueDate })
    }

    const moveTaskToDate = async (taskId: string, dateColumn: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const todayStr = formatDateKey(today)

        // BUG-1189: Handle 'inbox' and 'noDate' columns
        if (dateColumn === 'inbox') {
            await updateTask(taskId, { instances: [], dueDate: undefined, isInInbox: true })
            return
        }

        if (dateColumn === 'noDate') {
            await updateTask(taskId, { instances: [], dueDate: undefined, isInInbox: false })
            return
        }

        let target: Date | null = null
        switch (dateColumn) {
            case 'overdue': target = new Date(today); target.setDate(today.getDate() - 1); break
            case 'today': target = today; break
            case 'tomorrow': target = new Date(today); target.setDate(today.getDate() + 1); break
            case 'thisWeek': target = new Date(today); target.setDate(today.getDate() + (7 - today.getDay())); break
            case 'nextWeek': target = new Date(today); target.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7)); break
            case 'later': target = new Date(today); target.setDate(today.getDate() + 30); break
        }

        // BUG-1189: Also clear/update dueDate to prevent task from staying in Overdue
        // If task has a past dueDate, clear it so it doesn't stay stuck in Overdue column
        const hasOverdueDueDate = task.dueDate && task.dueDate < todayStr

        const updates: Partial<Task> = { instances: [], isInInbox: false }
        if (target) {
            const targetDateStr = formatDateKey(target)
            updates.instances = [{
                id: `instance-${taskId}-${Date.now()}`,
                scheduledDate: targetDateStr,
                scheduledTime: '09:00',
                duration: task.estimatedDuration || 60,
                isLater: dateColumn === 'later'
            }]

            // If dueDate was causing overdue status, update it to the target date
            if (hasOverdueDueDate) {
                updates.dueDate = targetDateStr
            }
        }
        await updateTask(taskId, updates)
    }

    const unscheduleTask = async (taskId: string) => {
        await updateTask(taskId, { instances: [], isInInbox: true })
    }

    const moveTaskToPriority = async (taskId: string, priority: Task['priority'] | 'no_priority') => {
        await updateTask(taskId, { priority: priority === 'no_priority' ? null : priority })
    }

    const setActiveProject = (projectId: string | null) => {
        projectStore.setActiveProject(projectId)
        persistFilters()
    }

    const setSmartView = (view: SmartView) => {
        activeSmartView.value = view
        persistFilters()
    }

    const toggleHideDoneTasks = () => {
        hideDoneTasks.value = !hideDoneTasks.value
        persistFilters()
    }

    // TASK-076: View-specific done task toggles
    const toggleCanvasDoneTasks = () => {
        hideCanvasDoneTasks.value = !hideCanvasDoneTasks.value
        persistFilters()
    }

    const toggleCalendarDoneTasks = () => {
        hideCalendarDoneTasks.value = !hideCalendarDoneTasks.value
        persistFilters()
    }

    const toggleCanvasOverdueTasks = () => {
        hideCanvasOverdueTasks.value = !hideCanvasOverdueTasks.value
        persistFilters()
    }

    const setActiveStatusFilter = (status: string | null) => {
        activeStatusFilter.value = status
        if (status) activeDurationFilter.value = null
        persistFilters()
    }

    const toggleStatusFilter = (status: string) => {
        setActiveStatusFilter(activeStatusFilter.value === status ? null : status)
    }

    const setActiveDurationFilter = (duration: 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null) => {
        activeDurationFilter.value = duration
        if (duration) activeStatusFilter.value = null
        persistFilters()
    }

    const toggleDurationFilter = (duration: 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null) => {
        setActiveDurationFilter(activeDurationFilter.value === duration ? null : duration)
    }

    const getTask = (taskId: string) => _rawTasks.value.find(t => t.id === taskId)

    const getUncategorizedTaskCount = () => {
        const { isUncategorizedTask } = useSmartViews()
        return _rawTasks.value.filter(t => t.status !== 'done' && isUncategorizedTask(t)).length
    }

    const getNestedTasks = (parent: string | null = null) => _rawTasks.value.filter(t => t.parentTaskId === parent)
    const getTaskChildren = (taskId: string) => _rawTasks.value.filter(t => t.parentTaskId === taskId)
    const getTaskHierarchy = (taskId: string) => {
        const list: Task[] = []
        const visited = new Set<string>()
        let curr: string | null = taskId

        while (curr && !visited.has(curr)) {
            visited.add(curr)
            const t = getTask(curr)
            if (!t) break
            list.unshift(t)
            curr = t.parentTaskId || null
        }
        return list
    }
    const isNestedTask = (id: string) => !!getTask(id)?.parentTaskId
    const hasNestedTasks = (id: string) => _rawTasks.value.some(t => t.parentTaskId === id)

    return {
        createTask,
        updateTask,
        deleteTask,
        permanentlyDeleteTask,
        bulkDeleteTasks,
        moveTask,
        selectTask,
        deselectTask,
        clearSelection,
        createSubtask,
        updateSubtask,
        deleteSubtask,
        createTaskInstance,
        updateTaskInstance,
        deleteTaskInstance,
        updateTaskWithSchedule,
        startTaskNow,
        moveTaskToSmartGroup,
        moveTaskToDate,
        unscheduleTask,
        moveTaskToPriority,
        // BUG-1321: Route through updateTask() for echo protection + sync queue
        moveTaskToProject: async (taskId: string, targetProjectId: string) => {
            await updateTask(taskId, { projectId: targetProjectId })
        },
        setActiveProject,
        setSmartView,
        toggleHideDoneTasks,
        toggleCanvasDoneTasks,
        toggleCalendarDoneTasks,
        toggleCanvasOverdueTasks,
        setActiveStatusFilter,
        toggleStatusFilter,
        setActiveDurationFilter,
        toggleDurationFilter,
        getTask,
        getUncategorizedTaskCount,
        getNestedTasks,
        getTaskChildren,
        getTaskHierarchy,
        isNestedTask,
        hasNestedTasks
    }
}
