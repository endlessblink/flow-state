
import { type Task, type Project, type Lane, type Subtask, type PlanningNote, type MiniCanvasEdge, type TaskInstance, type TaskRecurrence, type RecurringTaskInstance, type NotificationPreferences, UNCATEGORIZED_PROJECT_ID } from '../types/tasks'
import type { ScheduledNotification } from '../types/recurrence'
import type { CanvasGroup } from '../types/canvas'
import type { AppSettings } from '../stores/settings'
import type { PomodoroSession } from '../stores/timer'
import type { SessionSummary } from '../stores/quickSort'

// -- Validation Helpers --

/**
 * Validates if a string is a valid UUID v4 format
 */
const isValidUUID = (str: string | null | undefined): boolean => {
    if (!str) return false
    // BUG-FIX: Allow both UUIDs (v4) and Timestamp IDs (legacy/current task creation)
    // Timestamp IDs are usually 13 digits, UUIDs are 36 chars
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const timestampRegex = /^\d{10,20}$/ // Simple numeric check for timestamps
    return uuidRegex.test(str) || timestampRegex.test(str)
}

/**
 * Sanitizes a potential UUID field - returns null for invalid/placeholder values
 */
// BUG-1320: Track already-warned invalid UUIDs to avoid log spam on every sync cycle
const warnedInvalidUUIDs = new Set<string>()

const sanitizeUUID = (value: string | null | undefined): string | null => {
    // Handle null/undefined/empty string - catches all falsy values
    if (!value || value === 'undefined' || value === 'null') return null
    // Handle non-UUID placeholder values
    if (value === UNCATEGORIZED_PROJECT_ID || value === '1') return null
    // Validate UUID format
    if (!isValidUUID(value)) {
        if (!warnedInvalidUUIDs.has(value)) {
            warnedInvalidUUIDs.add(value)
            console.warn(`[SUPABASE-MAPPER] Invalid UUID detected: "${value}", converting to null`)
        }
        return null
    }
    return value
}

/**
 * Sanitize timestamp/date values to prevent "null" string errors in Postgres
 */
const sanitizeTimestamp = (value: string | Date | null | undefined): string | null => {
    // Handle null/undefined
    if (value === null || value === undefined) return null
    // Handle string literals that should be null
    if (value === 'undefined' || value === 'null' || value === '') return null
    // Handle Date objects
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value.toISOString()
    }
    // BUG-1286: Preserve date-only strings (YYYY-MM-DD) without adding T00:00:00.000Z
    // This prevents timezone-induced time artifacts (e.g., 2am in UTC+2)
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        // Validate it's a real date
        const [y, m, d] = value.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
            return value
        }
        return null
    }
    // Handle ISO string - validate it's a real date
    try {
        const date = new Date(value)
        return isNaN(date.getTime()) ? null : date.toISOString()
    } catch {
        return null
    }
}

// -- Types matching the Supabase Schema --

export interface SupabaseProject {
    id: string
    user_id: string
    name: string
    color?: string
    color_type?: 'hex' | 'emoji'
    view_type?: 'status' | 'date' | 'priority' | 'list' | 'board'
    parent_id?: string | null
    order?: number
    is_deleted?: boolean
    deleted_at?: string | null
    created_at?: string
    updated_at?: string
    // Workspace collaboration
    workspace_id?: string | null
}

// TASK-1812: Lane — sprint-style cross-project goal
export interface SupabaseLane {
    id: string
    user_id: string
    name: string
    color?: string
    is_deleted?: boolean
    deleted_at?: string | null
    created_at?: string
    updated_at?: string
    // Workspace collaboration
    workspace_id?: string | null
}

export interface SupabaseTask {
    id: string
    user_id: string
    project_id?: string | null
    lane_id?: string | null
    title: string
    description?: string
    status: string
    priority?: string | null

    // Progress
    progress?: number
    total_pomodoros?: number
    estimated_pomodoros?: number
    completed_pomodoros?: number

    // Timing
    due_date?: string | null
    due_time?: string | null
    estimated_duration?: number

    // JSON & Arrays
    subtasks?: Subtask[] | null // stored as jsonb, Supabase client handles object/array
    tags?: string[] | null
    depends_on?: string[] | null

    // Complex JSON fields (mapped to camelCase in jsonb)
    position?: { x: number; y: number; parentId?: string; format?: 'absolute' | 'relative' } | null
    position_version?: number // Optimistic locking for canvas position sync
    instances?: TaskInstance[] | null
    connection_types?: Record<string, 'sequential' | 'blocker' | 'reference'> | null
    recurrence?: TaskRecurrence | null
    recurring_instances?: RecurringTaskInstance[] | null
    notification_prefs?: NotificationPreferences | null
    reminders?: unknown[] | null // FEATURE-1363: Custom date/time reminders
    attachments?: unknown[] | null // FEATURE-1414: Image attachments (stored as JSONB)
    planning_notes?: PlanningNote[] | null // TASK-1768: Mini-canvas free-form planning notes (jsonb)
    mini_canvas_edges?: MiniCanvasEdge[] | null // Mini-canvas user-drawn connections (jsonb)
    recurrence_rule?: Record<string, unknown> | null  // TASK-1403: Simplified recurrence
    recurrence_parent_id?: string | null
    recurrence_count?: number

    // Hierarchy
    parent_task_id?: string | null

    // Metadata
    order?: number
    column_id?: string | null
    is_in_inbox?: boolean

    // BUG-1051: Add missing scheduled fields
    scheduled_date?: string | null
    scheduled_time?: string | null
    is_uncategorized?: boolean

    is_deleted?: boolean
    deleted_at?: string | null
    completed_at?: string | null
    created_at?: string
    updated_at?: string

    // "Done for now" feature - tracks when task was rescheduled via this feature
    done_for_now_until?: string | null
    is_pinned?: boolean
    calendar_locked?: boolean
    is_completion_record?: boolean
    // Workspace collaboration
    workspace_id?: string | null
    assigned_to?: string | null
}

export interface SupabaseGroup {
    id: string
    user_id: string
    name: string
    type: string
    color?: string

    position_json?: { x: number; y: number; width: number; height: number;[key: string]: unknown } | null // Fixed: Use legacy database column name
    position_version?: number // Optimistic locking for canvas position sync
    position_format?: string // TASK-240: Transition to relative-only
    layout?: string

    is_visible?: boolean
    is_collapsed?: boolean
    collapsed_height?: number

    parent_group_id?: string | null
    linked_parent_task_id?: string | null

    filters_json?: import('../types/canvas').GroupFilter | null
    is_power_mode?: boolean
    power_keyword_json?: import('../composables/useTaskSmartGroups').PowerKeywordResult | null
    assign_on_drop_json?: import('../types/canvas').AssignOnDropSettings | null
    collect_filter_json?: import('../types/canvas').CollectFilterSettings | null
    auto_collect?: boolean
    is_pinned?: boolean
    property_value?: string | number | boolean | Record<string, unknown> | null

    is_deleted?: boolean
    deleted_at?: string | null  // TASK-317: Added for deletion-aware restore
    created_at?: string
    updated_at?: string
    // Workspace collaboration
    workspace_id?: string | null
}

export interface SupabaseNotification {
    id: string
    user_id: string
    task_id: string
    title: string
    body: string
    scheduled_time: string
    snoozed_until?: string | null
    is_shown?: boolean
    is_dismissed?: boolean
    created_at?: string
    updated_at?: string
}

export interface SupabaseTimerSession {
    id: string
    user_id: string
    task_id: string
    start_time: string
    duration: number
    remaining_time: number
    is_active?: boolean
    is_paused?: boolean
    is_break?: boolean
    completed_at?: string | null
    device_leader_id?: string | null
    device_leader_last_seen?: string | null
    created_at?: string
    updated_at?: string
}

export interface SupabaseUserSettings {
    id?: string
    user_id: string
    work_duration?: number
    short_break_duration?: number
    long_break_duration?: number
    auto_start_breaks?: boolean
    auto_start_pomodoros?: boolean
    play_notification_sounds?: boolean
    theme?: string
    language?: string
    sidebar_collapsed?: boolean
    board_density?: string
    kanban_settings?: Record<string, unknown> | null
    canvas_viewport?: { x: number; y: number; zoom: number } | null
    // Full settings blob for cross-device sync (BUG-settings-mapper)
    settings?: Record<string, unknown> | null
    created_at?: string
    updated_at?: string
}

export interface SupabaseQuickSortSession {
    id: string
    user_id: string
    tasks_processed: number
    time_spent: number
    efficiency: number
    streak_days: number
    completed_at: string
}

// -- Work Profile Types (FEATURE-1317) --

export interface SupabaseWorkProfile {
    id: string
    user_id: string
    work_days: string[]
    days_off: string[]
    heavy_meeting_days: string[]
    max_tasks_per_day: number
    preferred_work_style: string
    top_priority_note: string | null
    personal_context: string | null
    avg_work_minutes_per_day: number | null
    avg_tasks_completed_per_day: number | null
    peak_productivity_days: string[] | null
    avg_plan_accuracy: number | null
    weekly_history: unknown[]
    profile_version: number
    interview_completed: boolean
    created_at?: string
    updated_at?: string
    memory_graph: unknown[]
}

export interface WorkProfile {
    id: string
    userId: string
    workDays: string[]
    daysOff: string[]
    heavyMeetingDays: string[]
    maxTasksPerDay: number
    preferredWorkStyle: 'frontload' | 'balanced' | 'backload'
    topPriorityNote: string | null
    personalContext: string | null
    avgWorkMinutesPerDay: number | null
    avgTasksCompletedPerDay: number | null
    peakProductivityDays: string[] | null
    avgPlanAccuracy: number | null
    weeklyHistory: Array<{
        weekStart: string
        plannedCount: number
        completedCount: number
        accuracy: number
    }>
    profileVersion: number
    interviewCompleted: boolean
    createdAt?: string
    updatedAt?: string
    memoryGraph: MemoryObservation[]
}

// -- Mappers --

// BUG-1320: Track legacy group IDs we've already warned about to avoid log spam
const warnedLegacyGroupIds = new Set<string>()

export function toSupabaseGroup(group: CanvasGroup, userId: string): SupabaseGroup | null {
    // BUG-1184: Validate group ID is valid UUID - skip legacy timestamp IDs gracefully
    // Legacy groups created before UUID requirement have IDs like "group-1768138473081-54fxz7t"
    // These can't sync to Supabase but shouldn't break user's workflow
    if (!isValidUUID(group.id)) {
        if (!warnedLegacyGroupIds.has(group.id)) {
            warnedLegacyGroupIds.add(group.id)
            if (import.meta.env.DEV) {
                console.debug(`[SUPABASE-MAPPER] Group "${group.name}" has legacy ID: "${group.id}" - skipping Supabase sync (local only)`)
            }
        }
        return null
    }

    // SAFETY: Sanitize parent_group_id - must be valid UUID or null
    const sanitizedParentGroupId = sanitizeUUID(group.parentGroupId)

    if (group.parentGroupId && !sanitizedParentGroupId) {
        console.warn(`[SUPABASE-MAPPER] Group "${group.name}" had invalid parentGroupId: "${group.parentGroupId}", sanitized to null`)
    }

    return {
        id: group.id,
        user_id: userId,
        name: group.name,
        type: group.type,
        color: group.color,

        position_json: group.position, // Fixed: Map internal position to DB position_json
        // Note: position_version is managed by DB triggers, not sent on update
        layout: group.layout,

        is_visible: group.isVisible,
        is_collapsed: group.isCollapsed,
        collapsed_height: group.collapsedHeight,

        parent_group_id: sanitizedParentGroupId,
        linked_parent_task_id: sanitizeUUID(group.linkedParentTaskId),

        filters_json: group.filters,
        is_power_mode: group.isPowerMode,
        power_keyword_json: group.powerKeyword,
        assign_on_drop_json: group.assignOnDrop,
        collect_filter_json: group.collectFilter,
        auto_collect: group.autoCollect,
        is_pinned: group.isPinned,
        property_value: typeof group.propertyValue === 'object' ? JSON.stringify(group.propertyValue) : group.propertyValue,

        // Let the database default handle new groups (default: false)
        // Upsert will only update fields present in the payload
        // position_format removed - column does not exist in DB
        // Workspace collaboration — only include when set (safe before migration)
        ...((group as CanvasGroup & { workspaceId?: string | null }).workspaceId ? { workspace_id: (group as CanvasGroup & { workspaceId?: string | null }).workspaceId } : {}),
        updated_at: new Date().toISOString()
    }
}

export function fromSupabaseGroup(record: SupabaseGroup): CanvasGroup {
    return {
        id: record.id,
        name: record.name,
        type: record.type as CanvasGroup['type'],
        color: record.color || '#cccccc',

        position: record.position_json, // Fixed: Map DB position_json to internal position
        positionVersion: record.position_version ?? 0, // Read position_version for optimistic locking
        layout: (record.layout as CanvasGroup['layout']) || 'vertical',

        isVisible: record.is_visible ?? true,
        isCollapsed: record.is_collapsed ?? false,
        collapsedHeight: record.collapsed_height,

        parentGroupId: record.parent_group_id, // TASK-138: Using current DB field name
        linkedParentTaskId: record.linked_parent_task_id || null,

        filters: record.filters_json,
        isPowerMode: record.is_power_mode,
        powerKeyword: record.power_keyword_json,
        assignOnDrop: record.assign_on_drop_json,
        collectFilter: record.collect_filter_json,
        autoCollect: record.auto_collect,
        isPinned: record.is_pinned,
        propertyValue: record.property_value, // Might need parsing if it was stringified object
        positionFormat: 'absolute', // Default to absolute since DB column is missing

        updatedAt: record.updated_at,
        workspaceId: record.workspace_id || null,
    } as CanvasGroup
}

export function toSupabaseProject(project: Project, userId: string): SupabaseProject {
    // Determine color type and extract primary color (handling legacy array colors if any)
    const primaryColor = Array.isArray(project.color) ? project.color[0] : project.color;
    // Check if color is likely an emoji (if not hex)
    const isEmoji = project.colorType === 'emoji' || (project.emoji && !primaryColor?.startsWith('#'));

    // Store emoji in color field when colorType is emoji, otherwise use the hex color
    const colorValue = isEmoji && project.emoji ? project.emoji : primaryColor;

    // SAFETY: Validate UUID fields to prevent 400 errors from Supabase
    const sanitizedId = project.id
    const sanitizedParentId = sanitizeUUID(project.parentId)

    // SAFETY: Ensure name is never null (required by DB constraint)
    const sanitizedName = project.name || 'Unnamed Project'

    // Log if we're sanitizing invalid data
    if (project.parentId && !sanitizedParentId) {
        console.warn(`[SUPABASE-MAPPER] Project "${sanitizedName}" had invalid parentId: "${project.parentId}", sanitized to null`)
    }
    if (!project.name) {
        console.warn(`[SUPABASE-MAPPER] Project "${sanitizedId}" had null/empty name, defaulting to "Unnamed Project"`)
    }

    return {
        id: sanitizedId,
        user_id: userId,
        name: sanitizedName,
        color: colorValue,
        color_type: project.colorType || (isEmoji ? 'emoji' : 'hex'),
        view_type: project.viewType || 'status',
        parent_id: sanitizedParentId,
        order: (project as Project & { order?: number }).order || 0,
        is_deleted: (project as Project & { isDeleted?: boolean }).isDeleted || false,
        deleted_at: (project as Project & { deletedAt?: string | Date }).deletedAt
            ? new Date((project as Project & { deletedAt?: string | Date }).deletedAt as string | Date).toISOString()
            : null,
        created_at: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
        // Workspace collaboration — only include when set (safe before migration)
        ...((project as Project & { workspaceId?: string | null }).workspaceId ? { workspace_id: (project as Project & { workspaceId?: string | null }).workspaceId } : {}),
        updated_at: new Date().toISOString()
    }
}

export function fromSupabaseProject(record: SupabaseProject): Project {
    return {
        id: record.id,
        name: record.name,
        color: record.color || '#000000',
        colorType: (record.color_type as Project['colorType']) || 'hex',
        emoji: record.color_type === 'emoji' ? record.color : undefined,
        viewType: (record.view_type as Project['viewType']) || 'status',
        parentId: record.parent_id || null,
        createdAt: new Date(record.created_at || Date.now()),
        updatedAt: new Date(record.updated_at || Date.now()),
        workspaceId: record.workspace_id || null,
    }
}

// TASK-1812: Lane mappers — mirror Project, minus colorType/viewType/parentId/order.
export function toSupabaseLane(lane: Lane, userId: string): SupabaseLane {
    const primaryColor = Array.isArray(lane.color) ? lane.color[0] : lane.color
    const sanitizedName = lane.name || 'Unnamed Lane'
    if (!lane.name) {
        console.warn(`[SUPABASE-MAPPER] Lane "${lane.id}" had null/empty name, defaulting to "Unnamed Lane"`)
    }
    return {
        id: lane.id,
        user_id: userId,
        name: sanitizedName,
        color: primaryColor,
        is_deleted: (lane as Lane & { isDeleted?: boolean }).isDeleted || false,
        deleted_at: (lane as Lane & { deletedAt?: string | Date }).deletedAt
            ? new Date((lane as Lane & { deletedAt?: string | Date }).deletedAt as string | Date).toISOString()
            : null,
        created_at: lane.createdAt instanceof Date ? lane.createdAt.toISOString() : lane.createdAt,
        // Workspace collaboration — only include when set (safe before migration)
        ...((lane as Lane & { workspaceId?: string | null }).workspaceId ? { workspace_id: (lane as Lane & { workspaceId?: string | null }).workspaceId } : {}),
        updated_at: new Date().toISOString()
    }
}

export function fromSupabaseLane(record: SupabaseLane): Lane {
    return {
        id: record.id,
        name: record.name,
        color: record.color || '#4ECDC4',
        createdAt: new Date(record.created_at || Date.now()),
        updatedAt: new Date(record.updated_at || Date.now()),
        workspaceId: record.workspace_id || null,
    }
}

// Valid status values per database constraint
const VALID_TASK_STATUSES = ['todo', 'done'] as const

/**
 * TASK-1418: Convert app status ('todo'/'done') to DB status ('planned'/'done')
 * until the DB migration runs. Use this in ANY code that writes status to the DB
 * without going through toSupabaseTask() (e.g., sync queue payloads, RPC calls).
 *
 * After running the DB migration (ALTER CHECK constraint to accept 'todo'),
 * remove this function and all its call sites.
 */
export function toDbStatus(appStatus: string): string {
    const DB_STATUS_MAP: Record<string, string> = { 'todo': 'planned', 'done': 'done' }
    return DB_STATUS_MAP[appStatus] || 'planned'
}

export function toSupabaseTask(task: Task, userId: string): SupabaseTask {
    const now = new Date().toISOString()
    const safeTitle = typeof task.title === 'string' && task.title.trim().length > 0
        ? task.title.trim()
        : 'Untitled Task'

    // SAFETY: Sanitize UUID fields to prevent 400 errors from Supabase
    const sanitizedProjectId = sanitizeUUID(task.projectId)
    const sanitizedParentTaskId = sanitizeUUID(task.parentTaskId)

    // Sanitize depends_on array - filter out invalid UUIDs
    const sanitizedDependsOn = (task.dependsOn || []).filter(id => isValidUUID(id))

    // SAFETY: Ensure status is valid per database constraint (tasks_status_check)
    const sanitizedStatus = VALID_TASK_STATUSES.includes(task.status as typeof VALID_TASK_STATUSES[number])
        ? task.status
        : 'todo' // Default fallback

    // TASK-1418: Reverse mapping for DB compatibility until migration runs
    const dbStatus = toDbStatus(sanitizedStatus)
    if (import.meta.env?.DEV && sanitizedStatus !== dbStatus) {
        console.debug(`[TASK-1418] toSupabaseTask status mapping: '${sanitizedStatus}' → '${dbStatus}' for task ${task.id?.slice(0, 8)}`)
    }

    return {
        id: task.id,
        user_id: userId,
        project_id: sanitizedProjectId,
        title: safeTitle,
        description: task.description,
        status: dbStatus,
        priority: task.priority,

        progress: task.progress,
        total_pomodoros: task.completedPomodoros,
        completed_pomodoros: task.completedPomodoros,
        estimated_pomodoros: task.estimatedPomodoros,

        due_date: sanitizeTimestamp(task.dueDate),
        due_time: task.dueTime || null,
        estimated_duration: task.estimatedDuration,

        subtasks: task.subtasks || [],
        tags: task.tags || [],
        depends_on: sanitizedDependsOn.length > 0 ? sanitizedDependsOn : null,

        // JSONB mappings
        // TASK-1183: parentId in position JSONB — allow legacy group IDs (e.g. "group-1768138473081-54fxz7t")
        // BUG-FIX: sanitizeUUID was stripping valid legacy group IDs to null on every save.
        // Realtime echo then overwrote the correct local parentId with undefined → tasks lost their parent group.
        // Position is a JSONB column — no UUID constraint. Pass through any non-placeholder value.
        position: task.canvasPosition ? {
            x: task.canvasPosition.x,
            y: task.canvasPosition.y,
            parentId: (task.parentId && task.parentId !== 'NONE' && task.parentId !== 'undefined' && task.parentId !== 'null' && task.parentId !== '') ? task.parentId : undefined,
            format: 'absolute' // Default for existing tasks during migration
        } : null,
        // Note: position_version is managed by DB triggers, not sent on update
        instances: task.instances || [],
        connection_types: task.connectionTypes || null,
        recurrence: task.recurrence || null,
        recurring_instances: task.recurringInstances || [],
        notification_prefs: task.notificationPreferences || null,
        reminders: task.reminders || [], // FEATURE-1363: Custom date/time reminders
        attachments: task.attachments || [],
        planning_notes: task.planningNotes || [], // TASK-1768
        mini_canvas_edges: task.miniCanvasEdges || [],

        parent_task_id: sanitizedParentTaskId,

        order: task.order || 0,
        column_id: task.columnId || null,
        is_in_inbox: task.isInInbox || false,

        // BUG-1051: Add missing scheduled fields
        scheduled_date: sanitizeTimestamp(task.scheduledDate),
        scheduled_time: task.scheduledTime || null,
        is_uncategorized: task.isUncategorized || false,

        is_deleted: task._soft_deleted || false,
        deleted_at: sanitizeTimestamp(task.deletedAt),
        completed_at: sanitizeTimestamp(task.completedAt),

        // "Done for now" feature
        done_for_now_until: sanitizeTimestamp(task.doneForNowUntil),
        is_completion_record: task.isCompletionRecord ?? false,
        is_pinned: task.isPinned ?? false,
    calendar_locked: task.calendarLocked ?? false,

        // Workspace collaboration — only include when set (safe before migration adds columns)
        ...(task.workspaceId ? { workspace_id: task.workspaceId } : {}),
        ...(task.assignedTo ? { assigned_to: sanitizeUUID(task.assignedTo) } : {}),

        // TASK-1812: Lane membership. Conditional-spread so a client hitting a DB
        // without the lane_id column (pre-migration) doesn't 400. When the task is
        // unassigned from a lane (laneId === null), send explicit null to clear it.
        ...(task.laneId !== undefined ? { lane_id: sanitizeUUID(task.laneId) } : {}),

        created_at: sanitizeTimestamp(task.createdAt) || now,
        updated_at: now,

        // TASK-1403: Only include new recurrence columns when set (safe before migration)
        ...(task.recurrenceRule ? { recurrence_rule: JSON.parse(JSON.stringify(task.recurrenceRule)) } : {}),
        ...(task.recurrenceParentId ? { recurrence_parent_id: sanitizeUUID(task.recurrenceParentId) } : {}),
        ...(task.recurrenceCount != null ? { recurrence_count: task.recurrenceCount } : {}),
    }
}

export function fromSupabaseTask(record: SupabaseTask): Task {
    return {
        id: record.id,
        title: record.title,
        description: record.description || '',
        status: (() => {
            const statusRaw = record.status as string
            const STATUS_MIGRATION: Record<string, 'todo' | 'done'> = {
                'planned': 'todo',
                'in_progress': 'todo',
                'backlog': 'todo',
                'on_hold': 'todo',
                'todo': 'todo',
                'done': 'done'
            }
            return STATUS_MIGRATION[statusRaw] || 'todo'
        })(),
        priority: (record.priority as Task['priority']) || null,

        projectId: record.project_id || UNCATEGORIZED_PROJECT_ID,
        parentTaskId: record.parent_task_id || null,
        // TASK-1812: Lane membership. Must be read here or realtime echo nulls laneId every save.
        laneId: record.lane_id ?? null,

        completedPomodoros: record.completed_pomodoros || 0,
        estimatedPomodoros: record.estimated_pomodoros || 1,
        progress: record.progress || 0,

        dueDate: record.due_date ? (record.due_date.includes('T') ? record.due_date.split('T')[0] : record.due_date) : '',
        dueTime: record.due_time || undefined,
        estimatedDuration: record.estimated_duration || undefined,

        subtasks: record.subtasks || [],
        tags: record.tags || undefined,
        dependsOn: record.depends_on || undefined,

        // BUG-1051: Add missing scheduled fields
        scheduledDate: record.scheduled_date || undefined,
        scheduledTime: record.scheduled_time || undefined,
        isUncategorized: record.is_uncategorized || false,

        canvasPosition: record.position ? { x: record.position.x, y: record.position.y } : undefined,
        positionVersion: record.position_version ?? 0, // Read position_version for optimistic locking
        parentId: record.position?.parentId,
        positionFormat: record.position?.format || 'absolute',
        instances: record.instances || [],
        connectionTypes: record.connection_types || undefined,
        recurrence: record.recurrence || undefined,
        recurrenceRule: record.recurrence_rule as import('../types/tasks').SimpleRecurrenceRule | undefined,
        recurrenceParentId: record.recurrence_parent_id || undefined,
        recurrenceCount: record.recurrence_count ?? undefined,
        recurringInstances: record.recurring_instances || [],
        notificationPreferences: record.notification_prefs || undefined,
        reminders: (record.reminders as import('../types/notifications').TaskReminder[]) || [],
        attachments: (record.attachments as import('../types/tasks').TaskAttachment[]) || [],
        planningNotes: record.planning_notes || [], // TASK-1768
        miniCanvasEdges: record.mini_canvas_edges || [],

        isInInbox: record.is_in_inbox || false,
        order: record.order || 0,
        columnId: record.column_id || undefined,

        createdAt: new Date(record.created_at || Date.now()),
        updatedAt: new Date(record.updated_at || Date.now()),
        completedAt: record.completed_at ? new Date(record.completed_at) : undefined,

        _soft_deleted: record.is_deleted || false,
        deletedAt: record.deleted_at ? new Date(record.deleted_at) : undefined,

        // "Done for now" feature
        doneForNowUntil: record.done_for_now_until || undefined,
        isCompletionRecord: record.is_completion_record ?? false,
        isPinned: record.is_pinned ?? false,
    calendarLocked: record.calendar_locked ?? false,

        // Workspace collaboration
        workspaceId: record.workspace_id || null,
        assignedTo: record.assigned_to || null,
    }
}

// -- User Settings Mappers --

export function toSupabaseUserSettings(settings: AppSettings, userId: string): SupabaseUserSettings {
    return {
        user_id: userId,
        // Individual columns kept for backwards compatibility
        work_duration: settings.workDuration,
        short_break_duration: settings.shortBreakDuration,
        long_break_duration: settings.longBreakDuration,
        auto_start_breaks: settings.autoStartBreaks,
        auto_start_pomodoros: settings.autoStartPomodoros,
        play_notification_sounds: settings.playNotificationSounds,
        theme: settings.theme || 'auto',
        language: settings.language || 'en',
        sidebar_collapsed: (settings as AppSettings & { sidebarCollapsed?: boolean }).sidebarCollapsed || false,
        board_density: settings.boardDensity || 'comfortable',
        kanban_settings: (settings as AppSettings & { kanbanSettings?: Record<string, unknown> }).kanbanSettings || {},
        canvas_viewport: (settings as AppSettings & { canvasViewport?: { x: number; y: number; zoom: number } }).canvasViewport || null,
        // Full settings blob for cross-device sync — stores ALL 23+ fields (BUG-settings-mapper)
        settings: JSON.parse(JSON.stringify(settings)) as Record<string, unknown>,
        updated_at: new Date().toISOString()
    }
}

export function fromSupabaseUserSettings(record: SupabaseUserSettings): AppSettings {
    // BUG-settings-mapper: Start with full settings blob (contains all 23+ fields),
    // then overlay individual columns as the authoritative source for legacy fields.
    const base: Record<string, unknown> = record.settings ? { ...record.settings } : {}

    return {
        // Spread full blob first (provides all fields not mapped individually)
        ...base,
        // Individual column overrides — these are source of truth for legacy fields
        workDuration: record.work_duration ?? (base.workDuration as number | undefined),
        shortBreakDuration: record.short_break_duration ?? (base.shortBreakDuration as number | undefined),
        longBreakDuration: record.long_break_duration ?? (base.longBreakDuration as number | undefined),
        autoStartBreaks: record.auto_start_breaks ?? (base.autoStartBreaks as boolean | undefined),
        autoStartPomodoros: record.auto_start_pomodoros ?? (base.autoStartPomodoros as boolean | undefined),
        playNotificationSounds: record.play_notification_sounds ?? (base.playNotificationSounds as boolean | undefined),
        theme: record.theme ?? (base.theme as string | undefined),
        language: record.language ?? (base.language as string | undefined),
        sidebarCollapsed: record.sidebar_collapsed ?? (base.sidebarCollapsed as boolean | undefined),
        boardDensity: record.board_density ?? (base.boardDensity as string | undefined),
        kanbanSettings: record.kanban_settings ?? (base.kanbanSettings as Record<string, unknown> | undefined),
        canvasViewport: record.canvas_viewport ?? (base.canvasViewport as { x: number; y: number; zoom: number } | undefined),
        // Safe defaults for fields absent in both blob and individual columns
        showDoneColumn: (base.showDoneColumn as boolean | undefined) ?? true,
        powerGroupOverrideMode: (base.powerGroupOverrideMode as string | undefined) ?? 'only_empty',
        textDirection: (base.textDirection as string | undefined) ?? 'auto',
        enableDayGroupSuggestions: (base.enableDayGroupSuggestions as boolean | undefined) ?? true,
        enableDayGroupPositionRotation: (base.enableDayGroupPositionRotation as boolean | undefined) ?? true
    } as unknown as AppSettings
}

// -- Notification Mappers --

export function toSupabaseNotification(notification: ScheduledNotification, userId: string): SupabaseNotification {
    return {
        id: notification.id,
        user_id: userId,
        task_id: notification.taskId,
        title: notification.title,
        body: notification.body,
        scheduled_time: notification.scheduledTime.toISOString(),
        snoozed_until: notification.snoozedUntil?.toISOString() || null,
        is_shown: notification.isShown,
        is_dismissed: notification.isDismissed,
        created_at: notification.createdAt.toISOString()
    }
}

export function fromSupabaseNotification(record: SupabaseNotification): ScheduledNotification {
    return {
        id: record.id,
        taskId: record.task_id,
        title: record.title,
        body: record.body,
        scheduledTime: new Date(record.scheduled_time),
        isShown: record.is_shown || false,
        isDismissed: record.is_dismissed || false,
        snoozedUntil: record.snoozed_until ? new Date(record.snoozed_until) : undefined,
        createdAt: new Date(record.created_at || Date.now())
    }
}

// -- Timer Session Mappers --

export function toSupabaseTimerSession(session: PomodoroSession, userId: string, deviceId: string): SupabaseTimerSession {
    // SAFETY: Validate session ID - generate new UUID if invalid (prevents timestamp IDs from breaking DB)
    const validSessionId = isValidUUID(session.id) ? session.id : crypto.randomUUID()

    if (!isValidUUID(session.id)) {
        console.warn(`[SUPABASE-MAPPER] Timer session had invalid ID: "${session.id}", generated new UUID: ${validSessionId}`)
    }

    // BUG-1056: Ensure startTime is a Date object (might be string from localStorage)
    const startTime = session.startTime instanceof Date
        ? session.startTime
        : new Date(session.startTime)

    return {
        id: validSessionId,
        user_id: userId,
        task_id: session.taskId,
        start_time: startTime.toISOString(),
        duration: session.duration,
        remaining_time: session.remainingTime,
        is_active: session.isActive,
        is_paused: session.isPaused,
        is_break: session.isBreak,
        completed_at: session.completedAt?.toISOString() || null,
        device_leader_id: deviceId,
        device_leader_last_seen: new Date().toISOString()
    }
}

export function fromSupabaseTimerSession(record: SupabaseTimerSession): PomodoroSession & { deviceLeaderId?: string | null, deviceLeaderLastSeen?: number } {
    // SAFETY: Ensure ID is valid UUID when loading (in case DB has corrupted data)
    const validId = isValidUUID(record.id) ? record.id : crypto.randomUUID()

    if (!isValidUUID(record.id)) {
        console.warn(`[SUPABASE-MAPPER] Loaded timer session had invalid ID: "${record.id}", generated new UUID: ${validId}`)
    }

    return {
        id: validId,
        taskId: record.task_id,
        startTime: new Date(record.start_time),
        duration: record.duration,
        remainingTime: record.remaining_time,
        isActive: record.is_active ?? false,
        isPaused: record.is_paused ?? false,
        isBreak: record.is_break ?? false,
        completedAt: record.completed_at ? new Date(record.completed_at) : undefined,
        deviceLeaderId: record.device_leader_id,
        deviceLeaderLastSeen: record.device_leader_last_seen ? new Date(record.device_leader_last_seen).getTime() : undefined
    }
}

// -- Quick Sort Mappers --

export function toSupabaseQuickSortSession(summary: SessionSummary, userId: string): SupabaseQuickSortSession {
    // SAFETY: Validate session ID - generate new UUID if invalid
    const validId = isValidUUID(summary.id) ? summary.id : crypto.randomUUID()

    if (!isValidUUID(summary.id)) {
        console.warn(`[SUPABASE-MAPPER] QuickSort session had invalid ID: "${summary.id}", generated new UUID: ${validId}`)
    }

    return {
        id: validId,
        user_id: userId,
        tasks_processed: summary.tasksProcessed,
        time_spent: summary.timeSpent,
        efficiency: summary.efficiency,
        streak_days: summary.streakDays,
        completed_at: summary.completedAt.toISOString()
    }
}

export function fromSupabaseQuickSortSession(record: SupabaseQuickSortSession): SessionSummary {
    return {
        id: record.id,
        tasksProcessed: record.tasks_processed,
        timeSpent: record.time_spent,
        efficiency: record.efficiency,
        streakDays: record.streak_days,
        completedAt: new Date(record.completed_at)
    }
}

// -- Memory Observation Types (FEATURE-1317 Phase 2) --

export interface MemoryObservation {
    entity: string      // e.g. "project:dashboard", "day:monday", "user", "tasktype:bugfix"
    relation: string    // e.g. "takes_longer", "overplanned", "avg_duration", "insight"
    value: string       // e.g. "2x estimated", "3 of 4 weeks", "45min"
    confidence: number  // 0.0 - 1.0
    source: string      // "pomodoro_data" | "weekly_history" | "ai_observation"
    createdAt: string   // ISO date
}

// -- Work Profile Mappers (FEATURE-1317) --

export function toSupabaseWorkProfile(profile: Partial<WorkProfile>, userId: string): Partial<SupabaseWorkProfile> {
    return {
        user_id: userId,
        ...(profile.workDays !== undefined && { work_days: profile.workDays }),
        ...(profile.daysOff !== undefined && { days_off: profile.daysOff }),
        ...(profile.heavyMeetingDays !== undefined && { heavy_meeting_days: profile.heavyMeetingDays }),
        ...(profile.maxTasksPerDay !== undefined && { max_tasks_per_day: profile.maxTasksPerDay }),
        ...(profile.preferredWorkStyle !== undefined && { preferred_work_style: profile.preferredWorkStyle }),
        ...(profile.topPriorityNote !== undefined && { top_priority_note: profile.topPriorityNote }),
        ...(profile.personalContext !== undefined && { personal_context: profile.personalContext }),
        ...(profile.avgWorkMinutesPerDay !== undefined && { avg_work_minutes_per_day: profile.avgWorkMinutesPerDay }),
        ...(profile.avgTasksCompletedPerDay !== undefined && { avg_tasks_completed_per_day: profile.avgTasksCompletedPerDay }),
        ...(profile.peakProductivityDays !== undefined && { peak_productivity_days: profile.peakProductivityDays }),
        ...(profile.avgPlanAccuracy !== undefined && { avg_plan_accuracy: profile.avgPlanAccuracy }),
        ...(profile.weeklyHistory !== undefined && { weekly_history: profile.weeklyHistory }),
        ...(profile.interviewCompleted !== undefined && { interview_completed: profile.interviewCompleted }),
        ...(profile.memoryGraph !== undefined && { memory_graph: profile.memoryGraph }),
        updated_at: new Date().toISOString()
    }
}

export function fromSupabaseWorkProfile(record: SupabaseWorkProfile): WorkProfile {
    return {
        id: record.id,
        userId: record.user_id,
        workDays: record.work_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        daysOff: record.days_off || [],
        heavyMeetingDays: record.heavy_meeting_days || [],
        maxTasksPerDay: record.max_tasks_per_day || 6,
        preferredWorkStyle: (record.preferred_work_style as WorkProfile['preferredWorkStyle']) || 'balanced',
        topPriorityNote: record.top_priority_note || null,
        personalContext: record.personal_context || null,
        avgWorkMinutesPerDay: record.avg_work_minutes_per_day,
        avgTasksCompletedPerDay: record.avg_tasks_completed_per_day,
        peakProductivityDays: record.peak_productivity_days,
        avgPlanAccuracy: record.avg_plan_accuracy,
        weeklyHistory: (record.weekly_history || []) as WorkProfile['weeklyHistory'],
        profileVersion: record.profile_version || 1,
        interviewCompleted: record.interview_completed || false,
        memoryGraph: (record.memory_graph || []) as MemoryObservation[],
        createdAt: record.created_at,
        updatedAt: record.updated_at
    }
}
