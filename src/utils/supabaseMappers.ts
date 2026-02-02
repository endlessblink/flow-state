
import type { Task, Project, Subtask, TaskInstance, TaskRecurrence, RecurringTaskInstance, NotificationPreferences } from '../types/tasks'
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
const sanitizeUUID = (value: string | null | undefined): string | null => {
    // Handle null/undefined
    if (value === null || value === undefined) return null
    // Handle string literals that should be null
    if (value === 'undefined' || value === 'null' || value === '') return null
    // Handle non-UUID placeholder values
    if (value === 'uncategorized' || value === '1') return null
    // Validate UUID format
    if (!isValidUUID(value)) {
        console.warn(`[SUPABASE-MAPPER] Invalid UUID detected: "${value}", converting to null`)
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
}

export interface SupabaseTask {
    id: string
    user_id: string
    project_id?: string | null
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

// -- Mappers --

export function toSupabaseGroup(group: CanvasGroup, userId: string): SupabaseGroup {
    // SAFETY: Sanitize parent_group_id (though groups table uses text type, still good to sanitize)
    const sanitizedParentGroupId = group.parentGroupId &&
        group.parentGroupId !== 'undefined' &&
        group.parentGroupId !== 'null'
        ? group.parentGroupId
        : null

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

        filters: record.filters_json,
        isPowerMode: record.is_power_mode,
        powerKeyword: record.power_keyword_json,
        assignOnDrop: record.assign_on_drop_json,
        collectFilter: record.collect_filter_json,
        autoCollect: record.auto_collect,
        isPinned: record.is_pinned,
        propertyValue: record.property_value, // Might need parsing if it was stringified object
        positionFormat: 'absolute', // Default to absolute since DB column is missing

        updatedAt: record.updated_at
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
            ? new Date((project as Project & { deletedAt?: string | Date }).deletedAt!).toISOString()
            : null,
        created_at: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
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
        updatedAt: new Date(record.updated_at || Date.now())
    }
}

// Valid status values per database constraint
const VALID_TASK_STATUSES = ['planned', 'in_progress', 'done', 'backlog', 'on_hold'] as const

export function toSupabaseTask(task: Task, userId: string): SupabaseTask {
    const now = new Date().toISOString()

    // SAFETY: Sanitize UUID fields to prevent 400 errors from Supabase
    const sanitizedProjectId = sanitizeUUID(task.projectId)
    const sanitizedParentTaskId = sanitizeUUID(task.parentTaskId)

    // Sanitize depends_on array - filter out invalid UUIDs
    const sanitizedDependsOn = (task.dependsOn || []).filter(id => isValidUUID(id))

    // SAFETY: Ensure status is valid per database constraint (tasks_status_check)
    const sanitizedStatus = VALID_TASK_STATUSES.includes(task.status as typeof VALID_TASK_STATUSES[number])
        ? task.status
        : 'planned' // Default fallback

    return {
        id: task.id,
        user_id: userId,
        project_id: sanitizedProjectId,
        title: task.title,
        description: task.description,
        status: sanitizedStatus,
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
        position: task.canvasPosition ? {
            x: task.canvasPosition.x,
            y: task.canvasPosition.y,
            parentId: task.parentId, // Serialize parentId into position JSON
            format: 'absolute' // Default for existing tasks during migration
        } : null,
        // Note: position_version is managed by DB triggers, not sent on update
        instances: task.instances || [],
        connection_types: task.connectionTypes || null,
        recurrence: task.recurrence || null,
        recurring_instances: task.recurringInstances || [],
        notification_prefs: task.notificationPreferences || null,

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

        created_at: sanitizeTimestamp(task.createdAt) || now,
        updated_at: now
    }
}

export function fromSupabaseTask(record: SupabaseTask): Task {
    return {
        id: record.id,
        title: record.title,
        description: record.description || '',
        status: record.status as Task['status'],
        priority: (record.priority as Task['priority']) || null,

        projectId: record.project_id || 'uncategorized',
        parentTaskId: record.parent_task_id || null,

        completedPomodoros: record.completed_pomodoros || 0,
        estimatedPomodoros: record.estimated_pomodoros || 1,
        progress: record.progress || 0,

        dueDate: record.due_date || '', // App uses empty string for no date sometimes? Types say string.
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
        recurringInstances: record.recurring_instances || [],
        notificationPreferences: record.notification_prefs || undefined,

        isInInbox: record.is_in_inbox || false,
        order: record.order || 0,
        columnId: record.column_id || undefined,

        createdAt: new Date(record.created_at || Date.now()),
        updatedAt: new Date(record.updated_at || Date.now()),
        completedAt: record.completed_at ? new Date(record.completed_at) : undefined,

        _soft_deleted: record.is_deleted || false,
        deletedAt: record.deleted_at ? new Date(record.deleted_at) : undefined,

        // "Done for now" feature
        doneForNowUntil: record.done_for_now_until || undefined
    }
}

// -- User Settings Mappers --

export function toSupabaseUserSettings(settings: AppSettings, userId: string): SupabaseUserSettings {
    return {
        user_id: userId,
        work_duration: settings.workDuration,
        short_break_duration: settings.shortBreakDuration,
        long_break_duration: settings.longBreakDuration,
        auto_start_breaks: settings.autoStartBreaks,
        auto_start_pomodoros: settings.autoStartPomodoros,
        play_notification_sounds: settings.playNotificationSounds,
        theme: settings.theme || 'system',
        language: settings.language || 'en',
        sidebar_collapsed: (settings as AppSettings & { sidebarCollapsed?: boolean }).sidebarCollapsed || false,
        board_density: settings.boardDensity || 'comfortable',
        kanban_settings: (settings as AppSettings & { kanbanSettings?: Record<string, unknown> }).kanbanSettings || {},
        canvas_viewport: (settings as AppSettings & { canvasViewport?: { x: number; y: number; zoom: number } }).canvasViewport || null
    }
}

export function fromSupabaseUserSettings(record: SupabaseUserSettings): AppSettings {
    return {
        workDuration: record.work_duration,
        shortBreakDuration: record.short_break_duration,
        longBreakDuration: record.long_break_duration,
        autoStartBreaks: record.auto_start_breaks,
        autoStartPomodoros: record.auto_start_pomodoros,
        playNotificationSounds: record.play_notification_sounds,
        theme: record.theme,
        language: record.language,
        sidebarCollapsed: record.sidebar_collapsed,
        boardDensity: record.board_density,
        kanbanSettings: record.kanban_settings,
        canvasViewport: record.canvas_viewport,
        // Default values for fields missing in DB but required in AppSettings
        showDoneColumn: true,
        powerGroupOverrideMode: 'only_empty',
        textDirection: 'auto',
        enableDayGroupSuggestions: true
    } as unknown as AppSettings // Cast back for store consumption, or we need a bigger interface
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
