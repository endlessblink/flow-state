// TASK-129: Removed transactionManager (PouchDB WAL stub no longer needed)
import { nextTick, type Ref, toRaw } from 'vue'
import { type Task, type Subtask, type TaskInstance, UNCATEGORIZED_PROJECT_ID } from '@/types/tasks'
// TASK-1158: Canvas sync via shared bridge (breaks circular dependency)
import { canvasUiSyncRequest } from '../canvasTaskBridge'
// TASK-127: Removed taskDisappearanceLogger (PouchDB-era debugging tool)
import { guardTaskCreation } from '@/utils/demoContentGuard'
import { formatDateKey, normalizeDueDate } from '@/utils/dateUtils'
import { recurrenceLockKey } from '@/constants/storageKeys'
// BUG-1569: Dynamic import breaks circular dep (timer→tasks→taskStates→projects→taskOperations→timer)
// TASK-1177: Offline-first sync queue integration
import { useSyncOrchestrator } from '@/composables/sync/useSyncOrchestrator'
// TASK-1418: Reverse status mapping for sync queue payloads (bypasses toSupabaseTask)
// BUG-1516b: toSupabaseTask used for complete create payloads (no missing fields)
import { toDbStatus, toSupabaseTask } from '@/utils/supabaseMappers'
// TASK-1159: Toast feedback for background save failures
import { useToast } from '@/composables/useToast'
// TASK-1428: Keep IndexedDB read cache warm after offline mutations
import { cacheTasks } from '@/services/offline/readCacheDB'
import { createCanonicalTaskPatchState } from '@/services/sync/canonicalTaskPatch'
import { beginPermanentDeleteTrace, logPermanentDeleteTrace } from '@/utils/permanentDeleteTrace'
import { sanitizeTaskTitle } from '@/utils/taskValidation'
// TASK-1871 Phase 0: observable geometry-write chokepoint instrumentation
import { logGeometryWrite } from '@/utils/canvas/geometryWriteLog'
// TASK-1871: fail-fast guard against write storms (same row hammered)
import { recordWrite } from '@/utils/sync/writeRateGuard'
import { supabase } from '@/services/auth/supabase'
import { runDoneForNow } from '@/services/tasks/doneForNow'
import {
    beginCanvasDoneTrace,
    getCanvasDoneTraceTaskIds,
    traceCanvasDone,
    traceCanvasDoneTasks
} from '@/utils/canvas/doneTrace'
// TASK-089 FIX: Unlock position when removing from canvas
// TASK-131 FIX: Protect locked positions from being overwritten by stale sync data

// BUG-1569: Re-export from types/tasks.ts to avoid breaking existing imports
export { UNCATEGORIZED_PROJECT_ID } from '@/types/tasks'

// BUG-1184: Helper to check if a string is a valid UUID (for parent_id column)
// Group IDs like "group-xxx" should NOT be saved to parent_id (UUID column)
const isValidUUID = (str: string | null | undefined): boolean => {
    if (!str) return false
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
}

const FALLBACK_TASK_TITLE = 'Untitled Task'

const isRealTaskTitle = (title: unknown): title is string =>
    typeof title === 'string' && title.trim().length > 0 && title.trim() !== FALLBACK_TASK_TITLE

const hasTaskTitle = (title: unknown): title is string =>
    typeof title === 'string' && title.trim().length > 0

const shouldKeepPermanentDeleteLocallyOnRemoteFailure = (error: unknown): boolean => {
    const status = error && typeof error === 'object' && 'status' in error
        ? (error as { status?: unknown }).status
        : undefined
    const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : ''
    const message = error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : String(error)
    const lowerMessage = message.toLowerCase()

    if (
        lowerMessage.includes('visible but delete affected 0 rows') ||
        lowerMessage.includes('rls delete policy is blocking')
    ) {
        return false
    }

    return (
        status === 401 ||
        status === 408 ||
        code === 'PGRST116' ||
        lowerMessage.includes('refresh token') ||
        lowerMessage.includes('already used') ||
        lowerMessage.includes('jwt') ||
        lowerMessage.includes('network') ||
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('timed out') ||
        lowerMessage.includes('failed to fetch') ||
        lowerMessage.includes('not present on server') ||
        lowerMessage.includes('not found') ||
        lowerMessage.includes('postgrest unavailable')
    )
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

const FORBIDDEN_GEOMETRY_SOURCES = new Set<GeometryWriteSource>(['SYNC', 'SMART-GROUP'])

const sanitizeGeometryUpdates = (
    updates: Partial<Task>,
    source: GeometryWriteSource,
    task: Task,
    taskId: string
) => {
    const sanitized = { ...updates }
    const attemptedGeometryChange = ('parentId' in sanitized && sanitized.parentId !== task.parentId) ||
        ('canvasPosition' in sanitized && sanitized.canvasPosition !== undefined &&
            (task.canvasPosition?.x !== sanitized.canvasPosition?.x ||
                task.canvasPosition?.y !== sanitized.canvasPosition?.y))

    const blocked = FORBIDDEN_GEOMETRY_SOURCES.has(source) && attemptedGeometryChange

    // TASK-1871 Phase 0: observe every attempted geometry write so tests can
    // assert WHICH source moved WHICH task (catches the "all nodes shift" /
    // "tasks repositioned themselves" regressions). Logging only — no behaviour change.
    if (attemptedGeometryChange) {
        logGeometryWrite({
            source,
            entityType: 'task',
            entityId: taskId,
            before: { parentId: task.parentId, x: task.canvasPosition?.x, y: task.canvasPosition?.y },
            after: { parentId: sanitized.parentId, x: sanitized.canvasPosition?.x, y: sanitized.canvasPosition?.y },
            blocked,
        })
    }

    if (blocked) {
        console.warn(`⚠️ [GEOMETRY-GUARD] Blocked '${source}' geometry update`, {
            taskId: taskId.slice(0, 8),
            taskTitle: task.title?.slice(0, 30),
            parentIdChange: 'parentId' in sanitized,
            positionChange: 'canvasPosition' in sanitized
        })
        delete sanitized.parentId
        delete sanitized.canvasPosition
        delete sanitized.positionFormat
        delete sanitized.positionVersion
    }

    return sanitized
}

import { useSmartViews, type SmartView } from '@/composables/useSmartViews'
import { useProjectStore } from '../projects'
import { useAuthStore } from '../auth'
// BUG-1757: Drop tasks out of smart day-group when user edits dueDate to a non-matching day
import { calculatePositionInGroup, findMatchingGroupForDueDate } from '@/composables/canvas/useSmartGroupMatcher'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'

export function useTaskOperations(
    // SAFETY: Named _rawTasks to indicate this is the raw array for mutations
    _rawTasks: Ref<Task[]>,
    selectedTaskIds: Ref<string[]>,
    activeSmartView: Ref<SmartView>,
    activeStatusFilter: Ref<string | null>,
    activeDurationFilter: Ref<'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>,
    hideDoneTasks: Ref<boolean>,
    hideBoardDoneTasks: Ref<boolean>,
    hideCanvasDoneTasks: Ref<boolean>,
    hideCalendarDoneTasks: Ref<boolean>,
    hideCanvasOverdueTasks: Ref<boolean>,
    manualOperationInProgress: Ref<boolean>,
    saveTasksToStorage: (tasks: Task[], context: string) => Promise<void>,
    saveSpecificTasks: (tasks: Task[], context: string) => Promise<void>,
    deleteTaskFromStorage: (taskId: string) => Promise<void>,
    _bulkDeleteTasksFromStorage: (taskIds: string[]) => Promise<void>,
    persistFilters: () => void,
    _runAllTaskMigrations: () => void,
    addPendingWrite: (taskId: string) => void,
    removePendingWrite: (taskId: string) => void
) {
    const projectStore = useProjectStore()

    // Helper to trigger canvas sync after task operations
    // This bypasses Vue's watch system which has timing issues in Tauri/WebKitGTK
    // DRIFT FIX: Now requires explicit source to prevent automated sync loops
    // TASK-1158: Uses shared bridge ref instead of dynamic import (breaks circular dependency)
    const triggerCanvasSync = (_source: 'user:create' | 'user:delete' | 'user:context-menu' = 'user:create') => {
        canvasUiSyncRequest.value++
    }

    const createTask = async (
        taskData: Partial<Task>,
        _options: { awaitDirectSave?: boolean } = {}
    ) => {
        if (!hasTaskTitle(taskData.title)) {
            throw new Error('Task title is required')
        }

        // TASK-061: Demo content guard - warn in dev mode
        guardTaskCreation(taskData.title)

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
            const {
                canvasPosition: explicitCanvasPosition,
                instances: _taskDataInstances,
                title: _taskDataTitle,
                ...taskDataWithoutPositionAndInstances
            } = taskData

            // Workspace collaboration: inject active workspace into new tasks
            const { useWorkspaceStore } = await import('../workspace')
            const activeWorkspaceId = useWorkspaceStore().activeWorkspaceId

            const newTask: Task = {
                id: taskId,
                title: sanitizeTaskTitle(taskData.title),
                description: taskData.description || '',
                status: taskData.status || 'todo',
                priority: taskData.priority || 'medium',
                progress: 0,
                completedPomodoros: 0,
                subtasks: [],
                // BUG-1325: dueDate only set if explicitly provided or inferred from scheduledDate
                // (scheduledDate implies a deadline on that date, but does NOT create calendar instances)
                dueDate: normalizeDueDate(taskData.dueDate || taskData.scheduledDate || ''),
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
                // BUG-1509: Always clear soft-delete on create/undo-restore.
                // Undo snapshots may carry _soft_deleted: true if a realtime echo
                // processed before undo fired. Without this, toSupabaseTask maps
                // _soft_deleted → is_deleted: true and the task vanishes on refresh.
                _soft_deleted: false,
                deletedAt: undefined,
                // Workspace collaboration: set workspaceId from active workspace (taskData takes precedence)
                workspaceId: taskData.workspaceId !== undefined ? taskData.workspaceId : activeWorkspaceId,
            }

            // Defensive: prevent duplicate push if task with same ID already exists in _rawTasks
            // (can happen from realtime echo, cross-tab sync, or undo race conditions)
            const existingIdx = _rawTasks.value.findIndex(t => t.id === taskId)
            if (existingIdx !== -1) {
                console.warn(`[TASKS] createTask: duplicate push prevented for ${taskId.slice(0, 8)}, updating in-place`)
                _rawTasks.value[existingIdx] = newTask
            } else {
                _rawTasks.value.push(newTask)
            }

            // BUG-1329: Register pending write to suppress Realtime echo.
            // Without this, the INSERT event from our own direct save bypasses
            // isPendingWrite() and can cause updateTaskFromSync() to re-add the task.
            addPendingWrite(taskId)

            if (import.meta.env.DEV) {
                console.log(`[BUG-1329] Echo protection active for new task ${taskId.slice(0, 8)}`)
            }

            // TASK-1177: Queue for offline-first sync
            // This ensures the task persists in IndexedDB even if network fails
            let queuePersisted = false
            const authStore = useAuthStore()
            const userId = authStore.user?.id
            try {
                const syncOrchestrator = useSyncOrchestrator()
                // BUG-1184: CRITICAL - user_id is REQUIRED for RLS policy
                // authStore exports `user` not `userId` - must use user?.id
                if (!userId) {
                    console.warn('[SYNC] Skipping sync queue: user not authenticated; task requires guest storage')
                    throw new Error('SKIP_QUEUE_NO_AUTH')
                }
                // BUG-1516b: Use toSupabaseTask() to build the full payload so no fields
                // are accidentally omitted (tags, estimatedDuration, subtasks, reminders, etc.)
                // toSupabaseTask() handles snake_case conversion, UUID sanitization, null coercion.
                const mappedPayload = toSupabaseTask(newTask, userId)
                const payload: Record<string, unknown> = {
                    ...mappedPayload,
                    // Override user_id explicitly (toSupabaseTask already sets it, belt+suspenders)
                    user_id: userId,
                    // BUG-1509: Explicitly clear soft-delete flags on create/undo-restore.
                    // When undo re-creates a previously soft-deleted task, the DB row still has
                    // is_deleted=true. The upsert must clear it so fetchTasks (which filters
                    // .eq('is_deleted', false)) sees the task after the next page refresh.
                    is_deleted: false,
                    deleted_at: null
                }
                // position_version is managed by DB triggers — do not send on create/upsert
                delete payload.position_version

                await syncOrchestrator.enqueue({
                    entityType: 'task',
                    operation: 'create',
                    entityId: newTask.id,
                    payload: JSON.parse(JSON.stringify(payload)), // Strip all reactivity
                    baseVersion: 0
                })
                queuePersisted = true
            } catch (queueError) {
                console.warn('[SYNC-QUEUE] Failed to queue create; task remains local-first and will be retried by cache/session recovery:', queueError)
            }

            // TASK-1428: Update IndexedDB read cache immediately. The sync queue is the
            // single remote writer; local cache keeps Electron reload/restart behavior durable.
            try {
                await cacheTasks([..._rawTasks.value], { throwOnError: true })
            } catch (cacheError) {
                console.warn('[READ-CACHE] Failed to persist newly created task:', cacheError)
            }

            // BUG-1967: The read cache is only a projection; authoritative account loads
            // intentionally remove server-absent rows unless a durable queued intent exists.
            // Guest mode has a separate reload path and must persist to its real localStorage.
            if (userId && !queuePersisted) {
                throw new Error('Task could not be saved. Please try again.')
            }
            if (!userId) {
                await saveTasksToStorage([..._rawTasks.value], 'create-task-guest-durability')
            }

            // Trigger canvas sync for Tauri reactivity
            triggerCanvasSync()

            // TASK-1554: Log activity for workspace tasks (fire-and-forget)
            if (newTask.workspaceId) {
                import('@/composables/supabase/useWorkspaceActivity').then(({ useWorkspaceActivity }) => {
                    useWorkspaceActivity().logActivity(
                        newTask.workspaceId!,
                        'task_created',
                        'task',
                        newTask.id,
                        { title: newTask.title?.slice(0, 100) }
                    )
                }).catch(() => {})
            }

            return newTask
        } catch (error) {
            // Only reaches here if sync queue AND cache both failed (extremely unlikely).
            // Remove both the optimistic row and its echo guard so a retry starts cleanly.
            const index = _rawTasks.value.findIndex(t => t.id === taskId)
            if (index !== -1) _rawTasks.value.splice(index, 1)
            removePendingWrite(taskId)
            try {
                await cacheTasks([..._rawTasks.value], { throwOnError: true })
            } catch (rollbackCacheError) {
                console.warn('[READ-CACHE] Failed to remove rolled-back task from cache:', rollbackCacheError)
            }
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

        // CASE 1: dueDate changed — dueDate is a DEADLINE, not a calendar slot.
        // BUG-1325: Do NOT auto-populate scheduledDate/scheduledTime from dueDate.
        // That was causing every task with a dueDate to appear on the calendar at 9:00 AM.
        // Calendar visibility requires explicit user action: drag to calendar, set time in modal, "Start Now".
        if (updates.dueDate !== undefined && updates.instances === undefined) {
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

        // CASE 3: scheduledDate changed (legacy field) → sync dueDate only
        // BUG-1325: Do NOT auto-create instances from scheduledDate changes.
        // Instance creation is the caller's responsibility (via createTaskInstance or passing instances[]).
        if (updates.scheduledDate !== undefined && updates.dueDate === undefined && updates.instances === undefined) {
            if (updates.scheduledDate) {
                synced.dueDate = updates.scheduledDate
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

        const authStore = useAuthStore()
        const task = _rawTasks.value[index]
        updates = sanitizeGeometryUpdates(updates, source, task, taskId)
        if (Object.keys(updates).length === 0) return

        // TASK-1871: storm tripwire — throws in dev if the SAME task is written many
        // times/sec (feedback loop / runaway layout), warns in prod. Per-entity keyed,
        // so bulk distinct-task writes (load/import) never trip it.
        recordWrite('task', taskId)

        const isMarkingDone = updates.status === 'done' && task.status !== 'done'
        if (isMarkingDone) {
            beginCanvasDoneTrace(taskId, _rawTasks.value)
        }

        // BUG-060 FIX: Suppress watcher during manual update to prevent concurrent bulk saves
        // This prevents the "8 conflicts in bulk save" issue
        const wasManualInProgress = manualOperationInProgress.value
        if (!wasManualInProgress) manualOperationInProgress.value = true

        // BUG-1207 FIX: Register pending write to suppress realtime echo from own save.
        // Without this, Supabase fires a realtime event back for our own write,
        // and the echo can overwrite newer local state (especially during rapid edits).
        addPendingWrite(taskId)

        try {
            // TASK-1177: Deep snapshot for rollback if all persistence paths fail
            // toRaw() strips Vue reactivity proxy before cloning (structuredClone can't handle Proxy)
            const previousTask = JSON.parse(JSON.stringify(toRaw(task)))

            // GEOMETRY DRIFT DETECTION (TASK-255): Track and warn about geometry changes
            const hasGeometryChange = ('parentId' in updates && updates.parentId !== task.parentId) ||
                ('canvasPosition' in updates && updates.canvasPosition !== undefined &&
                    (task.canvasPosition?.x !== updates.canvasPosition?.x ||
                        task.canvasPosition?.y !== updates.canvasPosition?.y))

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

            if (getCanvasDoneTraceTaskIds().includes(taskId) && hasGeometryChange) {
                traceCanvasDone('updateTask:geometry-write', {
                    taskId,
                    source,
                    updates: {
                        parentId: 'parentId' in updates ? updates.parentId ?? null : undefined,
                        canvasPosition: updates.canvasPosition
                            ? { x: Math.round(updates.canvasPosition.x), y: Math.round(updates.canvasPosition.y) }
                            : updates.canvasPosition,
                        positionVersion: updates.positionVersion ?? null,
                    },
                    before: {
                        canvasPosition: task.canvasPosition
                            ? { x: Math.round(task.canvasPosition.x), y: Math.round(task.canvasPosition.y) }
                            : null,
                        parentId: task.parentId ?? null,
                        positionVersion: task.positionVersion ?? null,
                    },
                })
            }

            // BUG-045 FIX: Removed auto-archive behavior
            // Tasks now stay on canvas when marked as done (no position/inbox changes)


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

            if ('title' in updates) {
                const safeTitle = sanitizeTaskTitle(updates.title)
                updates.title = safeTitle === FALLBACK_TASK_TITLE && isRealTaskTitle(task.title)
                    ? task.title
                    : safeTitle
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
                    // Clear inbox flag — done tasks should not appear in inbox
                    // Prevents duplicate-looking entries when recurring parent (done) + clone both show
                    updates.isInInbox = false
                    console.log(`✅ [DONE-ZONE] Task "${task.title?.slice(0, 30)}" marked done, completedAt set, inbox cleared`)

                    // TASK-1554: Log activity for workspace tasks (fire-and-forget)
                    if (task.workspaceId) {
                        import('@/composables/supabase/useWorkspaceActivity').then(({ useWorkspaceActivity }) => {
                            useWorkspaceActivity().logActivity(
                                task.workspaceId!,
                                'task_completed',
                                'task',
                                taskId,
                                { title: task.title?.slice(0, 100) }
                            )
                        }).catch(() => {})
                    }

                    // BUG-1303: Stop timer if it's running on the completed task
                    // BUG-1569: Dynamic import to break circular dependency
                    try {
                        const { useTimerStore } = await import('@/stores/timer')
                        const timerStore = useTimerStore()
                        if (timerStore.currentTaskId === taskId && timerStore.isTimerActive) {
                            await timerStore.stopTimer()
                            console.log(`⏱️ [TIMER] Auto-stopped timer for completed task "${task.title?.slice(0, 30)}"`)
                        }
                    } catch (e) {
                        console.warn('[Timer] Auto-stop on task completion failed:', e)
                    }

                    // TASK-1403: Clone-on-complete for recurring tasks
                    // When a recurring task is completed, spawn a fresh clone for the next occurrence
                    if (task.recurrenceRule) {
                        try {
                            const { computeNextDueDate } = await import('@/utils/recurrenceUtils')
                            const { formatDateKey } = await import('@/utils/dateUtils')
                            const today = formatDateKey(new Date())
                            const currentDueDate = task.dueDate || today
                            let count = (task.recurrenceCount || 0) + 1
                            let nextDueDate = computeNextDueDate(currentDueDate, task.recurrenceRule, count)

                            // TASK-1418: Skip-to-present — advance past missed occurrences
                            while (nextDueDate && nextDueDate < today) {
                                const advanced = computeNextDueDate(nextDueDate, task.recurrenceRule, count + 1)
                                if (!advanced || advanced <= nextDueDate) break // Safety: prevent infinite loop
                                count++
                                nextDueDate = advanced
                            }

                            // TASK-1418: Only create clone if due today or earlier (defer future dates)
                            if (nextDueDate && nextDueDate <= today) {
                                const clonedTask: Partial<Task> = {
                                    title: task.title,
                                    description: task.description,
                                    priority: task.priority,
                                    projectId: task.projectId,
                                    estimatedDuration: task.estimatedDuration,
                                    estimatedPomodoros: task.estimatedPomodoros,
                                    tags: task.tags ? [...task.tags] : undefined,
                                    subtasks: task.subtasks?.map(st => ({
                                        ...st,
                                        isCompleted: false,
                                    })) || [],
                                    recurrenceRule: { ...task.recurrenceRule },
                                    recurrenceParentId: task.recurrenceParentId || task.id,
                                    recurrenceCount: count,
                                    dueDate: nextDueDate,
                                    status: 'todo',
                                    isInInbox: true,
                                }

                                // BUG-1531: DB-level dedup — prevent cross-device duplicate clones
                                let skipClone = false
                                try {
                                    const { supabase: sbClient } = await import('@/services/auth/supabase')
                                    if (sbClient) {
                                        const dedupChainId = task.recurrenceParentId || task.id
                                        const { data: existingClones } = await sbClient
                                            .from('tasks')
                                            .select('id')
                                            .eq('recurrence_parent_id', dedupChainId)
                                            .eq('is_deleted', false)
                                            .neq('status', 'done')
                                            .limit(1)

                                        if (existingClones && existingClones.length > 0) {
                                            console.log(`[RECURRENCE] BUG-1531: Skipping clone — active clone already exists in DB for chain ${dedupChainId.slice(0, 8)}`)
                                            skipClone = true
                                        }
                                    }
                                } catch (e) {
                                    console.warn('[RECURRENCE] BUG-1531: DB dedup check failed, proceeding with clone:', e)
                                    // Fall through — create the clone anyway if we can't check
                                }

                                if (!skipClone) {
                                    try {
                                        await createTask(clonedTask)
                                        console.log(`🔄 [RECURRENCE] Cloned recurring task "${task.title?.slice(0, 30)}" → next due: ${nextDueDate} (occurrence #${count})`)
                                    } catch (cloneError: any) {
                                        // DB unique constraint (idx_unique_recurrence_occurrence) catches cross-device race
                                        if (cloneError?.code === '23505' || cloneError?.message?.includes('duplicate key') || cloneError?.message?.includes('unique')) {
                                            console.log(`[RECURRENCE] Clone race resolved by DB constraint for chain ${(task.recurrenceParentId || task.id).slice(0, 8)}`)
                                        } else {
                                            throw cloneError
                                        }
                                    }

                                    // SOP-065: Set the recurrence scheduler lock so the deferred scheduler
                                    // doesn't create a SECOND clone if the user refreshes before the DB write
                                    // from this createTask propagates to Supabase.
                                    try {
                                        const LOCK_KEY = recurrenceLockKey(today)
                                        localStorage.setItem(LOCK_KEY, String(Date.now()))
                                    } catch { /* localStorage may be unavailable */ }
                                }
                            } else if (nextDueDate) {
                                console.log(`⏳ [RECURRENCE] Deferred clone for "${task.title?.slice(0, 30)}" → next due: ${nextDueDate} (future, will create on app load)`)
                            } else {
                                console.log(`🏁 [RECURRENCE] Recurring task "${task.title?.slice(0, 30)}" ended (${task.recurrenceRule.endType})`)
                            }
                        } catch (e) {
                            // Recurrence is non-critical, don't break task completion
                            console.error('[RECURRENCE] Clone-on-complete failed:', e)
                        }
                    }

                    // TASK-1418: Clear calendar instances on recurring task completion
                    // Completed recurring tasks should not remain visible on calendar views
                    if (task.recurrenceRule) {
                        updates.instances = []
                        updates.recurringInstances = []
                    }

                    // Keep canvas geometry untouched when marking done. Hiding done
                    // tasks is a view/filter concern; status updates must not clear
                    // canvasPosition or parentId because that forces a full canvas
                    // re-sync and can shift unrelated nodes.
                }
                // Clear completedAt when status changes FROM 'done' (task reopened)
                else if (wasDone && isNowNotDone) {
                    updates.completedAt = undefined
                    console.log(`🔄 [DONE-ZONE] Task "${task.title?.slice(0, 30)}" reopened, completedAt cleared`)

                }
            }

            // BUG-1757/1790: Re-home canvas tasks when user edits dueDate.
            // Without this, useDayGroupRotation keeps overwriting stale group dates,
            // or the task keeps sitting outside the newly matching Today/day group.
            // Excludes SMART-GROUP source so the rotation itself is not cancelled.
            // Excludes freeform groups (no power keyword) — user may group by theme.
            if (
                'dueDate' in updates &&
                source !== 'SMART-GROUP' &&
                (task.parentId || task.canvasPosition) &&
                !('parentId' in updates)
            ) {
                try {
                    const { useCanvasStore } = await import('@/stores/canvas')
                    const canvasStore = useCanvasStore()
                    const parentGroup = canvasStore.groups.find(g => g.id === task.parentId)
                    const parentIsSmart = parentGroup
                        ? !!detectPowerKeyword(parentGroup.name)
                        : false
                    const taskIsOnCanvas = task.isInInbox === false || !!task.canvasPosition

                    if (taskIsOnCanvas && (parentIsSmart || !task.parentId)) {
                        const newDueDate = updates.dueDate ? normalizeDueDate(updates.dueDate as any) : undefined
                        const match = findMatchingGroupForDueDate(newDueDate, canvasStore.groups)
                        if (match && match.id !== task.parentId) {
                            updates.parentId = match.id
                            updates.canvasPosition = calculatePositionInGroup(
                                match,
                                _rawTasks.value.filter(t => t.id !== taskId)
                            )
                            updates.isInInbox = false
                            updates.positionVersion = (task.positionVersion || 0) + 1
                            console.log(
                                `📅 [DUE-DATE-EDIT] "${task.title?.slice(0, 30)}" new dueDate ${newDueDate} moved to group "${match.name}"`
                            )
                        } else if (!match && parentIsSmart) {
                            updates.parentId = undefined
                            updates.canvasPosition = undefined
                            updates.isInInbox = true
                            updates.positionVersion = (task.positionVersion || 0) + 1
                            console.log(
                                `📅 [DUE-DATE-EDIT] "${task.title?.slice(0, 30)}" new dueDate ${newDueDate} no longer matches group "${parentGroup?.name}" — dropping to inbox`
                            )
                        }
                    }
                } catch (e) {
                    console.warn('[BUG-1757] dueDate→group check failed:', e)
                }
            }

            // BUG-1321: Sync date fields bidirectionally before save
            const syncedUpdates = syncDateFields(task, updates)

            // BUG-1416: Normalize dueDate to canonical YYYY-MM-DD format.
            // This is the SINGLE chokepoint — all task mutations flow through here.
            if (syncedUpdates.dueDate !== undefined && syncedUpdates.dueDate !== '') {
                syncedUpdates.dueDate = normalizeDueDate(syncedUpdates.dueDate)
            }

            if (import.meta.env.DEV && syncedUpdates.status !== undefined) {
                console.log(`[BUG-1451] updateTask: ${taskId.slice(0, 8)} status: ${task.status} → ${syncedUpdates.status}`)
            }

            // Re-lookup index: the original `index` from findIndex may be stale
            // because async operations (timer stop, recurrence clone, sync queue)
            // between the initial lookup and this write can mutate _rawTasks.
            const freshIndex = _rawTasks.value.findIndex(t => t.id === taskId)
            if (freshIndex === -1) {
                console.warn(`[updateTask] Task ${taskId.slice(0, 8)} disappeared during async operations — skipping write`)
                return
            }
            _rawTasks.value[freshIndex] = {
                ...task,
                ...syncedUpdates,
                // Explicit positionVersion updates take priority over the derived geometry version.
                positionVersion: syncedUpdates.positionVersion ?? newVersion,
                updatedAt: new Date()
            }

            if (isMarkingDone || getCanvasDoneTraceTaskIds().includes(taskId)) {
                traceCanvasDoneTasks('updateTask:after-store-write', _rawTasks.value)
                nextTick(() => {
                    traceCanvasDoneTasks('updateTask:after-nextTick-1', _rawTasks.value)
                    nextTick(() => traceCanvasDoneTasks('updateTask:after-nextTick-2', _rawTasks.value))
                })
            }

            // Force canvas sync when a user action explicitly removes a task from canvas.
            // triggerCanvasSync() increments canvasUiSyncRequest which tells the canvas
            // orchestrator to re-evaluate visible nodes. Without this, the node stays
            // rendered even after canvasPosition is cleared, because updateTask() never
            // called triggerCanvasSync() — only createTask() did.
            if (task.canvasPosition && syncedUpdates.canvasPosition === undefined && 'canvasPosition' in syncedUpdates) {
                triggerCanvasSync('user:context-menu')
            }

            // TASK-1177: Queue for offline-first sync FIRST
            // This ensures the update persists in IndexedDB even if network fails
            const updatedTask = _rawTasks.value[freshIndex]
            let persisted = false
            let canonicalTaskPatch: ReturnType<typeof createCanonicalTaskPatchState>
            try {
                const syncOrchestrator = useSyncOrchestrator()
                // BUGFIX: Filter out undefined values to prevent "null" string errors in Postgres
                // BUGFIX: Use JSON.parse/stringify to strip Vue reactivity (Proxy objects can't be cloned to IndexedDB)

                // BUG-1516: Field-level sync — only send fields that actually changed.
                // Whole-document LWW overwrites concurrent edits on other devices.
                // e.g. phone edits title, desktop edits description → last save wipes the other.
                // Solution: collect all changed keys from updates (includes derived mutations
                // like completedAt when status→done or explicit canvas removal.
                // plus syncedUpdates (date field sync may add dueDate derived from instances).
                // Only include those keys in the DB payload so Supabase only writes changed columns.
                const changedKeys = new Set([
                    ...Object.keys(updates),
                    ...Object.keys(syncedUpdates)
                ])

                // updated_at is always included (required for LWW comparisons on all devices)
                const payload: Record<string, unknown> = {
                    updated_at: updatedTask.updatedAt.toISOString()
                }

                // Core fields — only included when they were in the update
                if (changedKeys.has('title')) {
                    payload.title = updatedTask.title
                }
                if (changedKeys.has('description')) {
                    payload.description = updatedTask.description
                }
                if (changedKeys.has('status')) {
                    payload.status = toDbStatus(updatedTask.status) // TASK-1418: Map 'todo'→'planned' for DB
                }
                if (changedKeys.has('priority')) {
                    payload.priority = updatedTask.priority
                }
                if (changedKeys.has('progress')) {
                    payload.progress = updatedTask.progress
                }
                if (changedKeys.has('completedPomodoros')) {
                    payload.completed_pomodoros = updatedTask.completedPomodoros
                    // BUG-1799: toSupabaseTask sets total_pomodoros from completedPomodoros too.
                    payload.total_pomodoros = updatedTask.completedPomodoros
                }
                if (changedKeys.has('isInInbox')) {
                    payload.is_in_inbox = updatedTask.isInInbox
                }
                // position_version always included when geometry changed (optimistic locking)
                if (changedKeys.has('positionVersion') || changedKeys.has('canvasPosition') || changedKeys.has('parentId')) {
                    payload.position_version = updatedTask.positionVersion
                }

                // Optional fields — only when in the update
                // BUGFIX: Check for "null" string which causes Postgres timestamp parse error
                if (changedKeys.has('dueDate')) {
                    const dueDate = updatedTask.dueDate
                    payload.due_date = (!dueDate || dueDate === 'null' || dueDate === 'undefined') ? null : dueDate
                }
                // BUG-1184: Only set project_id for valid UUIDs - 'uncategorized' is NOT a valid UUID.
                // Clearing a project sets projectId to undefined locally, but the DB still needs
                // an explicit null or realtime/refresh will restore the old project.
                if (changedKeys.has('projectId')) {
                    payload.project_id = isValidUUID(updatedTask.projectId) ? updatedTask.projectId : null
                }
                // TASK-1812: Lane membership — selective payload must carry lane_id or
                // assigning/clearing a lane via updateTask() never reaches the sync queue
                // (queue-payload field-completeness trap). Nullable = unassign.
                if (changedKeys.has('laneId')) {
                    payload.lane_id = isValidUUID(updatedTask.laneId) ? updatedTask.laneId : null
                }
                // BUG-1365: Also check if canvasPosition was explicitly set in the updates object.
                // During explicit canvas removal, canvasPosition is set to undefined to clear it.
                // Without 'canvasPosition' in updates check, the sync queue never sends position: null
                // to the DB, so after refresh the task reappears on canvas with its old position.
                //
                // TASK-1871: ALSO write `position` on a parentId-only change. Canvas group
                // membership (parentId) lives INSIDE the position JSON, so a parentId-only
                // update (e.g. group delete clearing children's parentId, BUG-1510) was never
                // persisted — the DB kept the stale parentId and sync/realtime re-applied it,
                // leaving a dangling parentId that hides the task. Field-completeness trap.
                if (changedKeys.has('canvasPosition') || changedKeys.has('parentId')) {
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
                if (changedKeys.has('completedAt')) {
                    const completedAt = updatedTask.completedAt
                    if (completedAt instanceof Date) {
                        payload.completed_at = completedAt.toISOString()
                    } else {
                        payload.completed_at = (!completedAt || completedAt === 'null' || completedAt === 'undefined') ? null : completedAt
                    }
                }
                // BUG-1187: Include doneForNowUntil in sync payload
                // Without this, the "Done for now" badge resets on page refresh
                if (changedKeys.has('doneForNowUntil')) {
                    const doneForNowUntil = updatedTask.doneForNowUntil
                    payload.done_for_now_until = (!doneForNowUntil || doneForNowUntil === 'null' || doneForNowUntil === 'undefined') ? null : doneForNowUntil
                }
                if (changedKeys.has('isCompletionRecord')) {
                    payload.is_completion_record = updatedTask.isCompletionRecord ?? false
                }
                // BUG-1302: Include instances in sync queue payload
                // Without this, calendar time blocks aren't backed up by the sync queue
                if (changedKeys.has('instances') && updatedTask.instances !== undefined) {
                    payload.instances = JSON.parse(JSON.stringify(updatedTask.instances))
                }
                // BUG-1338: Include recurringInstances in sync queue payload
                if (changedKeys.has('recurringInstances') && updatedTask.recurringInstances !== undefined) {
                    payload.recurring_instances = JSON.parse(JSON.stringify(updatedTask.recurringInstances))
                }
                // BUG-1321: Include subtasks in sync queue payload
                // Without this, offline subtask changes are silently dropped
                if (changedKeys.has('subtasks') && updatedTask.subtasks !== undefined) {
                    payload.subtasks = JSON.parse(JSON.stringify(updatedTask.subtasks))
                }
                if (changedKeys.has('miniCanvasEdges') && updatedTask.miniCanvasEdges !== undefined) {
                    payload.mini_canvas_edges = JSON.parse(JSON.stringify(updatedTask.miniCanvasEdges))
                }
                // TASK-1403: Include new recurrence fields in sync queue
                // TASK-1520: Handle null explicitly to clear recurrence on stop
                if (changedKeys.has('recurrenceRule')) {
                    payload.recurrence_rule = updatedTask.recurrenceRule
                        ? JSON.parse(JSON.stringify(updatedTask.recurrenceRule))
                        : null
                }
                if (changedKeys.has('recurrenceParentId') && updatedTask.recurrenceParentId) {
                    payload.recurrence_parent_id = updatedTask.recurrenceParentId
                }
                if (changedKeys.has('recurrenceCount') && updatedTask.recurrenceCount !== undefined) {
                    payload.recurrence_count = updatedTask.recurrenceCount
                }
                // BUG-1516: Missing field handlers — these were never sent to the sync queue
                if (changedKeys.has('tags')) {
                    payload.tags = updatedTask.tags || []
                }
                if (changedKeys.has('estimatedDuration')) {
                    payload.estimated_duration = updatedTask.estimatedDuration ?? null
                }
                if (changedKeys.has('estimatedPomodoros')) {
                    payload.estimated_pomodoros = updatedTask.estimatedPomodoros ?? null
                }
                if (changedKeys.has('order')) {
                    payload.order = updatedTask.order ?? 0
                }
                if (changedKeys.has('scheduledDate')) {
                    payload.scheduled_date = updatedTask.scheduledDate || null
                }
                if (changedKeys.has('scheduledTime')) {
                    payload.scheduled_time = updatedTask.scheduledTime || null
                }
                if (changedKeys.has('dueTime')) {
                    payload.due_time = updatedTask.dueTime || null
                }
                if (changedKeys.has('reminders') && updatedTask.reminders !== undefined) {
                    payload.reminders = JSON.parse(JSON.stringify(updatedTask.reminders))
                }
                if (changedKeys.has('attachments') && updatedTask.attachments !== undefined) {
                    payload.attachments = JSON.parse(JSON.stringify(updatedTask.attachments))
                }
                if (changedKeys.has('isPinned')) {
                    payload.is_pinned = updatedTask.isPinned ?? false
                }
                // BUG-1799: These fields were previously persisted ONLY by the now-removed
                // unconditional direct save. Mirror toSupabaseTask (supabaseMappers.ts) exactly so
                // the sync queue is a complete single writer and no field silently stops syncing.
                if (changedKeys.has('planningNotes') && updatedTask.planningNotes !== undefined) {
                    payload.planning_notes = JSON.parse(JSON.stringify(updatedTask.planningNotes || []))
                }
                if (changedKeys.has('connectionTypes')) {
                    payload.connection_types = updatedTask.connectionTypes
                        ? JSON.parse(JSON.stringify(updatedTask.connectionTypes))
                        : null
                }
                if (changedKeys.has('notificationPreferences')) {
                    payload.notification_prefs = updatedTask.notificationPreferences
                        ? JSON.parse(JSON.stringify(updatedTask.notificationPreferences))
                        : null
                }
                if (changedKeys.has('dependsOn')) {
                    const validDeps = (updatedTask.dependsOn || []).filter(id => isValidUUID(id))
                    payload.depends_on = validDeps.length > 0 ? validDeps : null
                }
                if (changedKeys.has('columnId')) {
                    payload.column_id = updatedTask.columnId || null
                }
                if (changedKeys.has('calendarLocked')) {
                    payload.calendar_locked = updatedTask.calendarLocked ?? false
                }
                if (changedKeys.has('parentTaskId')) {
                    payload.parent_task_id = isValidUUID(updatedTask.parentTaskId) ? updatedTask.parentTaskId : null
                }

                canonicalTaskPatch = createCanonicalTaskPatchState(payload, updatedTask.canonicalRevision)

                await syncOrchestrator.enqueue({
                    entityType: 'task',
                    operation: 'update',
                    entityId: taskId,
                    payload: JSON.parse(JSON.stringify(payload)), // Strip all reactivity
                    baseVersion: currentVersion,
                    canonicalTaskPatch,
                })
                persisted = true
            } catch (queueError) {
                const errorMsg = queueError instanceof Error ? queueError.message : String(queueError)
                if (canonicalTaskPatch) {
                    console.error('[CANONICAL-SYNC] Failed to durably queue task patch; rolling back:', errorMsg)
                    const rollbackIndex = _rawTasks.value.findIndex(candidate => candidate.id === taskId)
                    if (rollbackIndex !== -1) _rawTasks.value[rollbackIndex] = previousTask
                    removePendingWrite(taskId)
                    await cacheTasks([..._rawTasks.value])
                    const { showToast } = useToast()
                    showToast('This change was not safely queued. The task was restored.', 'error')
                    throw queueError
                }
                console.warn('[SYNC-QUEUE] Failed to queue update, falling back to direct save:', errorMsg)
                // BUG-1207 FIX (Fix 2.3): Only fall back to direct save when sync queue fails
                // (e.g., guest mode with no auth, or IndexedDB unavailable).
                // This replaces the old dual-write where BOTH paths always ran.
                try {
                    await saveSpecificTasks([updatedTask], `updateTask-fallback-${taskId}`)
                    persisted = true
                } catch (saveError) {
                    console.warn(`[SYNC-QUEUE] Fallback save also failed for ${taskId}:`, saveError)
                }
            }

            // BUG-1799: Removed the unconditional direct save that used to run here.
            // It double-wrote every edit (queue + direct save), and the direct save's fresh
            // `updated_at` (toSupabaseTask stamps now) out-timestamped the queued op → guaranteed
            // false position_version conflict → LWW "server wins" log spam + ~1s latency + the
            // delete-vs-queued-update blank-title resurrection. The sync queue above is now the
            // single writer: it flushes immediately when online (enqueue → processQueue), retains
            // position_version optimistic locking + field-level merge, and carries every field
            // (see the complete payload above). Offline/enqueue failure falls back to the direct
            // save in the catch block above. Echo protection is already set via addPendingWrite()
            // at the top of updateTask — independent of this removed save.

            // TASK-1177: If ALL persistence paths failed, rollback optimistic update
            // Re-find by ID (index may have shifted if another task was deleted concurrently)
            if (!persisted) {
                const rollbackIndex = _rawTasks.value.findIndex(t => t.id === taskId)
                if (rollbackIndex !== -1) {
                    console.error(`❌ [TASK] All persistence paths failed for ${taskId}, rolling back optimistic update`)
                    _rawTasks.value[rollbackIndex] = previousTask
                }
            }

            // TASK-1428: Update IndexedDB read cache so reloads see the acknowledged mutation.
            // Every update must await this boundary: a fast reload can otherwise hydrate the
            // previous snapshot even though the UI already reported the action as complete.
            const cacheSnapshot = [..._rawTasks.value]
            await cacheTasks(cacheSnapshot, { throwOnError: true })
            if (!authStore.user?.id) {
                await saveTasksToStorage(cacheSnapshot, 'update-task-guest-durability')
            }
        } finally {
            if (!wasManualInProgress) manualOperationInProgress.value = false
        }
    }

    const deleteTask = async (taskId: string, source: string = 'unknown') => {
        const index = _rawTasks.value.findIndex(t => t.id === taskId)
        if (index === -1) {
            console.warn(`⚠️ Task not found for deletion: ${taskId} (source: ${source})`)
            return
        }

        const deletedTask = _rawTasks.value[index]
        console.log(`🗑️ [DELETE] "${deletedTask.title?.slice(0, 30)}" (${taskId.slice(0, 8)}) — source: ${source}`)
        manualOperationInProgress.value = true

        // BUG-1211 FIX: Mark as pending write BEFORE the delete so the realtime
        // echo (UPDATE with is_deleted=true) doesn't get processed as an external event.
        // Without this, the realtime handler would redundantly splice the task again.
        addPendingWrite(taskId)

        // TASK-1159: Optimistic delete — splice from local state immediately for instant UI
        if (import.meta.env.DEV) {
            console.log(`[BUG-1451] deleteTask: ${taskId.slice(0, 8)} "${deletedTask.title?.slice(0, 20)}" spliced from _rawTasks`)
        }
        _rawTasks.value.splice(index, 1)

        // BUG-1737: Single-write path — sync queue is the SOLE path to Supabase for deletes.
        // Previously also called deleteTaskFromStorage() directly, creating a dual-write race
        // where undo couldn't cleanly cancel both the queue DELETE and the direct DELETE.
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
            console.warn(`⚠️ [DELETE] Failed to queue delete for ${taskId.slice(0, 8)}, restoring the task:`, queueError)
            if (!_rawTasks.value.some(task => task.id === taskId)) {
                _rawTasks.value.splice(Math.min(index, _rawTasks.value.length), 0, deletedTask)
            }
            removePendingWrite(taskId)
            await cacheTasks([..._rawTasks.value])
            const { showToast } = useToast()
            showToast('Delete was not saved. The task has been restored.', 'error')
            throw queueError
        } finally {
            manualOperationInProgress.value = false
        }

        // The durable delete must exist before the reload cache is allowed to show
        // the task as gone. A crash before queue enrollment must restart from the
        // older truthful cache; a crash after enrollment is covered by queue replay.
        try {
            await cacheTasks([..._rawTasks.value])
        } catch (cacheError) {
            console.warn(`⚠️ [DELETE] Durable delete queued but read cache update failed for ${taskId.slice(0, 8)}:`, cacheError)
        }

        // TASK-131: Removed triggerCanvasSync() - surgical deletion watcher in CanvasView handles this
        // The watcher detects the deletion and removes only the affected node, preventing position resets
    }

    // [DEEP-DIVE FIX] Added permanent delete operation
    const permanentlyDeleteTask = async (taskId: string) => {
        beginPermanentDeleteTrace(taskId, 'taskStore.permanentlyDeleteTask')
        const index = _rawTasks.value.findIndex(t => t.id === taskId)
        logPermanentDeleteTrace(taskId, 'store.lookup', {
            found: index !== -1,
            rawTaskCount: _rawTasks.value.length,
        })
        if (index === -1) {
            logPermanentDeleteTrace(taskId, 'store.not-found')
            return
        }

        // BUG-1508: Clear recurrenceRule on all chain members BEFORE hard-deleting
        // so the recurrence scheduler cannot find a done ancestor and recreate this task.
        logPermanentDeleteTrace(taskId, 'store.before-clear-recurrence')
        await clearRecurrenceChain(taskId)
        logPermanentDeleteTrace(taskId, 'store.after-clear-recurrence')

        const deletedTask = _rawTasks.value[index]
        manualOperationInProgress.value = true
        addPendingWrite(taskId)
        logPermanentDeleteTrace(taskId, 'store.pending-write-added', {
            title: deletedTask.title,
            index,
        })
        let hardDeleteCompleted = false
        try {
            // 1. Remove from local state immediately (Optimistic UI)
            _rawTasks.value.splice(index, 1)
            logPermanentDeleteTrace(taskId, 'store.local-splice-complete', {
                rawTaskCount: _rawTasks.value.length,
                stillInRawTasks: _rawTasks.value.some(t => t.id === taskId),
            })

            // 2. Call TrashService for DB removal (Hard Delete)
            const { trashService } = await import('@/services/trash/TrashService')
            logPermanentDeleteTrace(taskId, 'store.before-trash-service')
            await trashService.permanentlyDeleteTask(taskId)
            hardDeleteCompleted = true
            logPermanentDeleteTrace(taskId, 'store.after-trash-service')

            await cacheTasks([..._rawTasks.value])
            logPermanentDeleteTrace(taskId, 'store.cache-updated', {
                cachedTaskCount: _rawTasks.value.length,
            })
        } catch (error) {
            logPermanentDeleteTrace(taskId, 'store.error', {
                hardDeleteCompleted,
                error: error instanceof Error ? error.message : String(error),
            })
            console.error(`❌ Failed to permanently delete ${taskId}:`, error)
            if (!hardDeleteCompleted && shouldKeepPermanentDeleteLocallyOnRemoteFailure(error)) {
                logPermanentDeleteTrace(taskId, 'store.remote-delete-failed-keeping-local', {
                    rawTaskCount: _rawTasks.value.length,
                })

                try {
                    const syncOrchestrator = useSyncOrchestrator()
                    await syncOrchestrator.enqueue({
                        entityType: 'task',
                        operation: 'delete',
                        entityId: taskId,
                        payload: { id: taskId, permanentDelete: true },
                        baseVersion: deletedTask.positionVersion || 0
                    })
                    logPermanentDeleteTrace(taskId, 'store.remote-failed-permanent-delete-queued', {
                        rawTaskCount: _rawTasks.value.length,
                    })
                    try {
                        await cacheTasks([..._rawTasks.value])
                    } catch (cacheError) {
                        console.warn(`⚠️ [PERMANENT-DELETE] Durable fallback queued but read cache update failed for ${taskId.slice(0, 8)}:`, cacheError)
                    }
                    return
                } catch (queueError) {
                    logPermanentDeleteTrace(taskId, 'store.remote-failed-permanent-delete-queue-error', {
                        error: queueError instanceof Error ? queueError.message : String(queueError),
                    })
                    console.warn(`⚠️ [PERMANENT-DELETE] Failed to queue fallback delete for ${taskId.slice(0, 8)}; restoring the task:`, queueError)
                    if (!_rawTasks.value.some(task => task.id === taskId)) {
                        _rawTasks.value.splice(Math.min(index, _rawTasks.value.length), 0, deletedTask)
                    }
                    removePendingWrite(taskId)
                    await cacheTasks([..._rawTasks.value])
                    const { showToast } = useToast()
                    showToast('Permanent delete was not saved. The task has been restored.', 'error')
                    throw queueError
                }
            }
            if (!hardDeleteCompleted) {
                _rawTasks.value.splice(index, 0, deletedTask)
                logPermanentDeleteTrace(taskId, 'store.rollback-local-splice', {
                    rawTaskCount: _rawTasks.value.length,
                })
            }
            throw error
        } finally {
            manualOperationInProgress.value = false
            logPermanentDeleteTrace(taskId, 'store.finally', {
                hardDeleteCompleted,
                stillInRawTasks: _rawTasks.value.some(t => t.id === taskId),
                rawTaskCount: _rawTasks.value.length,
            })
        }
    }

    // ================================================================
    // TASK-1520: Recurrence-aware delete operations
    // ================================================================

    // BUG-1508: Extracted helper — clears recurrenceRule on every chain member
    // (including the task itself). Safe to call even when task has no recurrenceRule.
    // Used by permanentlyDeleteTask and stopRecurrence to prevent the scheduler
    // from finding a done ancestor with recurrenceRule set and recreating the task.
    const clearRecurrenceChain = async (taskId: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task || !task.recurrenceRule) return

        const chainId = task.recurrenceParentId || task.id
        const chainMembers = _rawTasks.value.filter(t =>
            t.id === chainId || t.recurrenceParentId === chainId
        )

        for (const member of chainMembers) {
            if (member.recurrenceRule) {
                await updateTask(member.id, { recurrenceRule: null as unknown as undefined })
            }
        }
    }

    /**
     * Skip this recurring occurrence: advance the chain so the scheduler
     * creates the NEXT occurrence, then delete the current task.
     */
    const skipRecurringOccurrence = async (taskId: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task || !task.recurrenceRule) {
            // Not recurring — fall through to normal delete
            await deleteTask(taskId, 'skipRecurringOccurrence')
            return
        }

        const chainId = task.recurrenceParentId || task.id
        const chainTasks = _rawTasks.value.filter(t =>
            t.id === chainId || t.recurrenceParentId === chainId
        )

        // Find the latest done ancestor (highest recurrenceCount with status 'done')
        const doneAncestors = chainTasks
            .filter(t => t.status === 'done' && t.id !== taskId)
            .sort((a, b) => (b.recurrenceCount || 0) - (a.recurrenceCount || 0))

        const latestDoneAncestor = doneAncestors[0]

        if (latestDoneAncestor) {
            // Advance the ancestor's recurrenceCount so the scheduler computes
            // count+1 → next occurrence (skipping the deleted one)
            const targetCount = task.recurrenceCount || 0
            if ((latestDoneAncestor.recurrenceCount || 0) < targetCount) {
                await updateTask(latestDoneAncestor.id, { recurrenceCount: targetCount })
            }
        }

        // Delete the current occurrence — the recurrence scheduler will create
        // the next one on app load (useRecurrenceScheduler)
        await deleteTask(taskId, 'skipRecurringOccurrence:chain')
    }

    /**
     * Stop all future occurrences: clear recurrenceRule on every task in the
     * chain, then delete the current task.
     */
    const stopRecurrence = async (taskId: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task || !task.recurrenceRule) {
            await deleteTask(taskId, 'stopRecurrence')
            return
        }

        // BUG-1508: Use shared helper to clear the entire chain (includes current task)
        await clearRecurrenceChain(taskId)

        // Delete the current task
        await deleteTask(taskId, 'stopRecurrence:final')
    }

    // BUG-025 FIX: Atomic local bulk delete; remote sync is queued per task.
    const bulkDeleteTasks = async (taskIds: string[]) => {
        if (!taskIds.length) return
        manualOperationInProgress.value = true

        try {
            // Keep the optimistic all-at-once UI behavior, but do not make the
            // reload cache authoritative until every individual result is known.
            const originalTasks = [..._rawTasks.value]
            const deletedTasks = originalTasks
                .map((task, index) => ({ task, index }))
                .filter(({ task }) => taskIds.includes(task.id))
            deletedTasks.forEach(({ task }) => addPendingWrite(task.id))
            _rawTasks.value = _rawTasks.value.filter(t => !taskIds.includes(t.id))

            const syncOrchestrator = useSyncOrchestrator()
            const failed: Array<{ task: Task; index: number; error: unknown }> = []
            for (const deleted of deletedTasks) {
                try {
                    await syncOrchestrator.enqueue({
                        entityType: 'task',
                        operation: 'delete',
                        entityId: deleted.task.id,
                        payload: { id: deleted.task.id },
                        baseVersion: deleted.task.positionVersion || 0
                    })
                } catch (error) {
                    failed.push({ ...deleted, error })
                }
            }

            if (failed.length > 0) {
                const failedIds = new Set(failed.map(({ task }) => task.id))
                const originalIds = new Set(originalTasks.map(task => task.id))
                const tasksAddedWhileQueued = _rawTasks.value.filter(task => !originalIds.has(task.id))
                _rawTasks.value = [
                    ...originalTasks.filter(task => !taskIds.includes(task.id) || failedIds.has(task.id)),
                    ...tasksAddedWhileQueued,
                ]
            }
            for (const { task } of failed) {
                removePendingWrite(task.id)
            }

            try {
                await cacheTasks([..._rawTasks.value])
            } catch (cacheError) {
                console.warn('[BULK-DELETE] Durable queue results could not be projected to the read cache:', cacheError)
            }

            if (failed.length > 0) {
                const { showToast } = useToast()
                showToast(`${failed.length} task${failed.length === 1 ? '' : 's'} could not be deleted and were restored.`, 'error')
                throw new Error(
                    `${failed.length} task delete${failed.length === 1 ? '' : 's'} could not be durably queued: ${
                        failed.map(({ error }) => error instanceof Error ? error.message : String(error)).join('; ')
                    }`
                )
            }
        } finally {
            manualOperationInProgress.value = false
        }
    }

    const moveTask = async (taskId: string, newStatus: Task['status']) => {
        await updateTask(taskId, { status: newStatus }) // BUG-1051: AWAIT to ensure persistence
    }

    // TASK-1532: "Done for Now" — for recurring tasks, creates a completion record and advances
    // the original task to the next occurrence. For non-recurring tasks, delegates to moveTask.
    // BUG-1536: In-flight guard prevents double-invocation (double-click creating 2 completion records)
    const doneForNowInFlight = new Set<string>()
    const doneForNow = async (taskId: string, options: { nextDueDate?: string; requestId?: string } = {}) => {
        if (doneForNowInFlight.has(taskId)) {
            console.warn(`[DONE-FOR-NOW] Already in flight for ${taskId}, skipping`)
            return
        }

        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return

        // Non-recurring: just mark done normally
        if (!task.recurrenceRule) {
            await moveTask(taskId, 'done')
            return
        }

        doneForNowInFlight.add(taskId)
        try {
            const authStore = useAuthStore()

        // 1. Stop timer if running on this task
        // BUG-1569: Dynamic import to break circular dependency
        try {
            const { useTimerStore } = await import('@/stores/timer')
            const timerStore = useTimerStore()
            if (timerStore.currentTaskId === taskId && timerStore.isTimerActive) {
                await timerStore.stopTimer()
            }
        } catch (e) {
            console.warn('[Timer] Auto-stop on done-for-now failed:', e)
        }

        if (!authStore.user?.id) {
            const { computeNextDueDate } = await import('@/utils/recurrenceUtils')
            const currentDueDate = task.dueDate || formatDateKey(new Date())
            const nextDueDate = options.nextDueDate ?? computeNextDueDate(
                currentDueDate,
                task.recurrenceRule,
                (task.recurrenceCount || 0) + 1,
            )
            const completedAt = new Date()
            const completionRecord: Task = {
                ...task,
                id: crypto.randomUUID(),
                status: 'done',
                completedAt,
                dueDate: currentDueDate,
                recurrenceRule: undefined,
                recurrenceParentId: task.recurrenceParentId || task.id,
                recurrenceCount: task.recurrenceCount || 0,
                isCompletionRecord: true,
                instances: task.instances
                    ?.filter(inst => inst.scheduledDate === currentDueDate)
                    .map(inst => ({ ...inst, status: 'completed' as const })) || [],
                parentId: undefined,
                canvasPosition: undefined,
                isInInbox: false,
            }
            const nextInstances: TaskInstance[] = nextDueDate
                ? [{
                    id: crypto.randomUUID(),
                    taskId,
                    scheduledDate: nextDueDate,
                    scheduledTime: task.dueTime,
                    duration: task.estimatedDuration || 25,
                    status: 'scheduled',
                }]
                : []
            const updatedTask: Task = {
                ...task,
                status: nextDueDate ? 'todo' : 'done',
                completedAt: nextDueDate ? undefined : completedAt,
                dueDate: nextDueDate || currentDueDate,
                doneForNowUntil: nextDueDate || undefined,
                recurrenceCount: (task.recurrenceCount || 0) + 1,
                instances: nextInstances,
                subtasks: task.subtasks?.map(st => ({ ...st, isCompleted: false, updatedAt: new Date() })) || [],
                parentId: undefined,
                canvasPosition: undefined,
                isInInbox: !!nextDueDate,
            }
            const taskIndex = _rawTasks.value.findIndex(candidate => candidate.id === taskId)
            if (taskIndex !== -1) _rawTasks.value.splice(taskIndex, 1, updatedTask)
            _rawTasks.value.push(completionRecord)
            await cacheTasks([..._rawTasks.value], { throwOnError: true })
            await saveTasksToStorage([..._rawTasks.value], 'done-for-now-guest-durability')
            return
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const { computeNextDueDate } = await import('@/utils/recurrenceUtils')
            const currentDueDate = task.dueDate || formatDateKey(new Date())
            const nextDueDate = options.nextDueDate ?? computeNextDueDate(
                currentDueDate,
                task.recurrenceRule,
                (task.recurrenceCount || 0) + 1,
            )
            if (!nextDueDate) {
                throw new Error('Done for now could not compute the next occurrence while offline')
            }

            const updatedTask: Task = {
                ...task,
                status: 'todo',
                completedAt: undefined,
                dueDate: nextDueDate,
                doneForNowUntil: nextDueDate,
                recurrenceCount: (task.recurrenceCount || 0) + 1,
                instances: [{
                    id: crypto.randomUUID(),
                    taskId,
                    scheduledDate: nextDueDate,
                    scheduledTime: task.dueTime,
                    duration: task.estimatedDuration || 25,
                    status: 'scheduled',
                }],
                subtasks: task.subtasks?.map(st => ({ ...st, isCompleted: false, updatedAt: new Date() })) || [],
                parentId: undefined,
                canvasPosition: undefined,
                isInInbox: true,
            }
            const taskIndex = _rawTasks.value.findIndex(candidate => candidate.id === taskId)
            if (taskIndex === -1) return

            _rawTasks.value.splice(taskIndex, 1, updatedTask)
            try {
                await cacheTasks([..._rawTasks.value], { throwOnError: true })
                const syncOrchestrator = useSyncOrchestrator()
                await syncOrchestrator.enqueue({
                    entityType: 'task',
                    operation: 'update',
                    entityId: taskId,
                    payload: {},
                    workspaceId: task.workspaceId ?? null,
                    doneForNow: {
                        requestId: options.requestId || crypto.randomUUID(),
                        nextDueDate,
                    },
                })
            } catch (error) {
                _rawTasks.value.splice(taskIndex, 1, task)
                await cacheTasks([..._rawTasks.value], { throwOnError: true })
                throw error
            }
            return
        }

        // 2. Preview and apply the same canonical transaction used by the Local Task API.
        // The renderer action itself is the user's approval, while Hermes must surface
        // the previewVersion before it can call apply.
        const preview = await runDoneForNow(supabase, {
            taskId,
            preview: true,
            workspaceId: task.workspaceId,
            nextDueDate: options.nextDueDate,
        })
        if (!preview.previewVersion) throw new Error('Done for now preview did not return a version')
        const receipt = await runDoneForNow(supabase, {
            taskId,
            preview: false,
            workspaceId: task.workspaceId,
            nextDueDate: options.nextDueDate,
            previewVersion: preview.previewVersion,
            ...(preview.requestHash ? { requestHash: preview.requestHash } : {}),
            requestId: options.requestId || crypto.randomUUID(),
        })
        const completed = receipt.completedOccurrence
        const next = receipt.nextOccurrence
        if (!completed) throw new Error('Done for now receipt did not include the completed occurrence')

        // 3. Project the committed receipt into renderer state immediately. Realtime and
        // Local API mutation notices then reconcile the same authoritative rows.
        const currentDueDate = receipt.currentOccurrence?.dueDate || task.dueDate
        const completionRecord: Task = {
            ...task,
            id: completed.id,
            status: 'done',
            completedAt: new Date(completed.completedAt),
            dueDate: completed.dueDate,
            recurrenceRule: undefined,
            recurrenceParentId: task.recurrenceParentId || task.id,
            recurrenceCount: task.recurrenceCount || 0,
            isCompletionRecord: true,
            instances: task.instances
                ?.filter(inst => inst.scheduledDate === currentDueDate)
                .map(inst => ({ ...inst, status: 'completed' as const })) || [],
            parentId: undefined,
            canvasPosition: undefined,
            isInInbox: false,
        }
        const nextInstances: TaskInstance[] = next
            ? [{
                id: next.id,
                taskId,
                scheduledDate: next.dueDate,
                scheduledTime: next.scheduledTime,
                duration: next.duration || task.estimatedDuration || 25,
                status: 'scheduled',
            }]
            : []
        const updatedTask: Task = {
            ...task,
            status: next ? 'todo' : 'done',
            completedAt: next ? undefined : new Date(completed.completedAt),
            dueDate: next?.dueDate || task.dueDate,
            doneForNowUntil: next?.dueDate,
            recurrenceCount: (task.recurrenceCount || 0) + 1,
            instances: nextInstances,
            subtasks: task.subtasks?.map(st => ({ ...st, isCompleted: false, updatedAt: new Date() })) || [],
            parentId: undefined,
            canvasPosition: undefined,
            isInInbox: !!next,
        }
        const taskIndex = _rawTasks.value.findIndex(candidate => candidate.id === taskId)
        if (taskIndex !== -1) _rawTasks.value.splice(taskIndex, 1, updatedTask)
        _rawTasks.value.push(completionRecord)
        await cacheTasks([..._rawTasks.value])

        // Set recurrence lock to prevent deferred scheduler from creating duplicates
        try {
            const LOCK_KEY = recurrenceLockKey(currentDueDate)
            localStorage.setItem(LOCK_KEY, String(Date.now()))
        } catch { /* localStorage may be unavailable */ }

        console.log(`[DONE-FOR-NOW] "${task.title?.slice(0, 30)}" occurrence completed, next: ${next?.dueDate || 'ended'}`)
        } finally {
            doneForNowInFlight.delete(taskId)
        }
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
        // BUG-1343: Non-recurring tasks get ONE instance (replace, not append).
        // Recurring tasks can have multiple instances.
        const isRecurring = task.recurrence || instanceData.isRecurring
        const updatedInstances = isRecurring
            ? [...(task.instances || []), newInstance]
            : [newInstance]
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
        if (!task) return

        const updates: Partial<Task> = {}

        // BUG-1338: Check both instances[] and recurringInstances[]
        // Calendar events can come from either source via getTaskInstances()
        if (task.instances && task.instances.length > 0) {
            const filtered = task.instances.filter(inst => inst.id !== instanceId)
            if (filtered.length !== task.instances.length) {
                updates.instances = filtered
            }
        }
        if (task.recurringInstances && task.recurringInstances.length > 0) {
            const filtered = task.recurringInstances.filter(inst => inst.id !== instanceId)
            if (filtered.length !== task.recurringInstances.length) {
                updates.recurringInstances = filtered
            }
        }

        // If instanceId wasn't found in either array, still clear instances as fallback
        if (Object.keys(updates).length === 0) {
            console.warn(`[deleteTaskInstance] instanceId "${instanceId}" not found in task "${task.title?.slice(0, 30)}". Instances: ${task.instances?.length || 0}, RecurringInstances: ${task.recurringInstances?.length || 0}`)
            return
        }

        // Restore to inbox when all calendar instances are removed
        const remainingInstances = updates.instances ?? task.instances ?? []
        const remainingRecurring = updates.recurringInstances ?? task.recurringInstances ?? []
        if (remainingInstances.length === 0 && remainingRecurring.length === 0 && !task.canvasPosition) {
            updates.isInInbox = true
        }

        await updateTask(taskId, updates)
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
            scheduledTime: schedule.scheduledTime
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
        // BUG-1343: Non-recurring tasks get ONE instance (replace, not append)
        const isRecurring = task.recurrence
        const updatedInstances = isRecurring
            ? [...(task.instances || []), newInstance]
            : [newInstance]
        await updateTask(taskId, { instances: updatedInstances, status: 'todo' })
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

        // BUG-1189: Handle 'inbox' and 'noDate' columns
        if (dateColumn === 'inbox') {
            await updateTask(taskId, { instances: [], dueDate: undefined, isInInbox: true })
            return
        }

        if (dateColumn === 'noDate') {
            await updateTask(taskId, { instances: [], dueDate: undefined })
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

        const updates: Partial<Task> = {}
        if (target) {
            const targetDateStr = formatDateKey(target)
            // BUG-1467: Only update dueDate — do NOT create calendar instances.
            // Board date-column drag sets a deadline, not a calendar time slot.
            // Calendar scheduling requires explicit user action (drag to calendar, "Start Now", or edit modal).
            updates.dueDate = targetDateStr
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

    // BUG-1451: toggleHideDoneTasks now only toggles the board flag (used by BoardView)
    const toggleHideDoneTasks = () => {
        hideBoardDoneTasks.value = !hideBoardDoneTasks.value
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
        activeStatusFilter.value = (status === 'all' || status === null) ? null : status
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
        return _rawTasks.value.filter(t =>
            t.status !== 'done' &&
            !t._soft_deleted &&
            !t.isPinned &&
            isUncategorizedTask(t)
        ).length
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
        skipRecurringOccurrence,
        stopRecurrence,
        bulkDeleteTasks,
        moveTask,
        doneForNow,
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
