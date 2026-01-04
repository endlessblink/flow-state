/**
 * SQL Database Type Definitions for PowerSync
 *
 * These interfaces define the exact shape of data stored in SQLite tables.
 * They match the schema defined in AppSchema.ts
 *
 * Last Updated: January 4, 2026
 * Migration Phase: Complete Schema (Phase 2)
 */

// ============================================================================
// TASKS
// ============================================================================
export interface SqlTask {
    id: string;

    // Core Identity & Content
    title: string;
    description?: string;
    status: string; // 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
    priority?: string; // 'low' | 'medium' | 'high' | null

    // Project & Hierarchy
    project_id?: string;
    parent_task_id?: string; // For nested tasks (null = root-level)

    // Pomodoro Tracking
    total_pomodoros: number; // completedPomodoros
    estimated_pomodoros: number;
    progress: number; // 0-100 completion percentage

    // Scheduling & Calendar
    due_date?: string; // Primary deadline (YYYY-MM-DD)
    scheduled_date?: string; // Legacy: specific scheduled date
    scheduled_time?: string; // Legacy: specific scheduled time (HH:MM)
    estimated_duration?: number; // Duration in minutes

    // Complex Fields (JSON serialized)
    instances_json?: string; // TaskInstance[]
    subtasks_json?: string; // Subtask[]
    depends_on_json?: string; // string[]
    tags_json?: string; // string[]
    connection_types_json?: string; // Record<taskId, type>
    recurrence_json?: string; // TaskRecurrence
    recurring_instances_json?: string; // RecurringTaskInstance[]
    notification_prefs_json?: string; // NotificationPreferences

    // Canvas & Spatial
    canvas_position_x?: number;
    canvas_position_y?: number;
    is_in_inbox?: number; // 0/1 boolean

    // Kanban Workflow
    order: number;
    column_id?: string;

    // Timestamps
    created_at: string;
    updated_at: string;
    completed_at?: string;

    // Soft Delete Support
    is_deleted: number; // 0/1 boolean
    deleted_at?: string;
}

// ============================================================================
// PROJECTS
// ============================================================================
export interface SqlProject {
    id: string;

    // Core Identity
    name: string;
    description?: string;

    // Appearance
    color: string; // Hex color or emoji
    color_type?: string; // 'hex' | 'emoji'
    icon?: string;
    emoji?: string; // For emoji-based colors

    // Hierarchy
    parent_id?: string; // For nested projects

    // View Configuration
    view_type?: string; // 'status' | 'date' | 'priority'

    // Sorting
    order?: number;

    // Timestamps
    created_at: string;
    updated_at: string;

    // Soft Delete
    is_deleted: number;
    deleted_at?: string;
}

// ============================================================================
// GROUPS (Canvas Sections)
// ============================================================================
export interface SqlGroup {
    id: string;

    // Core Identity
    name: string;
    type: string; // 'custom' | 'priority' | 'status' | 'project' | 'timeline'
    color?: string;

    // Geometry (JSON)
    position_json?: string; // { x, y, width, height }

    // Settings (JSON)
    filters_json?: string;
    layout?: string; // 'vertical' | 'horizontal' | 'grid'

    // State
    is_visible?: number; // 0/1
    is_collapsed?: number; // 0/1
    collapsed_height?: number;

    // Hierarchy
    parent_group_id?: string;

    // Advanced Features (Power Groups)
    is_power_mode?: number; // 0/1
    power_keyword_json?: string;
    assign_on_drop_json?: string;
    collect_filter_json?: string;
    auto_collect?: number; // 0/1
    is_pinned?: number; // 0/1
    property_value?: string;

    // Timestamps
    created_at: string;
    updated_at: string;

    // Soft Delete
    is_deleted?: number;
}

// ============================================================================
// SUBTASKS
// ============================================================================
export interface SqlSubtask {
    id: string;
    parent_task_id: string;

    // Content
    title: string;
    description?: string;

    // Progress
    completed_pomodoros: number;
    is_completed: number; // 0/1

    // Sorting
    order: number;

    // Timestamps
    created_at: string;
    updated_at: string;
}

// ============================================================================
// TIMER SESSIONS
// ============================================================================
export interface SqlTimerSession {
    id: string;

    // Session Identity
    session_type: string; // 'work' | 'short_break' | 'long_break'
    task_id?: string;

    // Timer State
    duration: number; // Total duration in seconds
    remaining: number; // Remaining time in seconds
    is_running: number; // 0/1
    is_paused: number; // 0/1

    // Session Tracking
    sessions_completed: number;
    total_sessions_today: number;

    // Cross-device Coordination
    device_leader_id?: string;
    last_heartbeat?: string;

    // Settings (cached for offline)
    work_duration: number;
    short_break_duration: number;
    long_break_duration: number;
    sessions_before_long_break: number;
    auto_start_breaks: number; // 0/1
    auto_start_pomodoros: number; // 0/1

    // Timestamps
    started_at?: string;
    paused_at?: string;
    created_at: string;
    updated_at: string;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================
export interface SqlNotification {
    id: string;

    // Identity
    task_id?: string;
    type: string; // 'reminder' | 'due_date' | 'pomodoro_complete' | 'custom'

    // Content
    title: string;
    message?: string;

    // Scheduling
    scheduled_for?: string;
    timing_minutes?: number;

    // State
    is_read: number; // 0/1
    is_dismissed: number; // 0/1
    is_snoozed: number; // 0/1
    snoozed_until?: string;

    // Settings
    sound_enabled: number; // 0/1
    vibration_enabled: number; // 0/1

    // Timestamps
    created_at: string;
    updated_at: string;
    read_at?: string;
    dismissed_at?: string;
}

// ============================================================================
// SETTINGS (Key-Value Store)
// ============================================================================
export interface SqlSetting {
    id: string;
    key: string;
    value_json: string;
    category?: string; // 'timer' | 'ui' | 'sync' | 'notifications'
    updated_at: string;
}

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

/**
 * Convert SQLite boolean (0/1) to JavaScript boolean
 */
export function sqlBoolToJs(value: number | undefined | null): boolean {
    return value === 1;
}

/**
 * Convert JavaScript boolean to SQLite boolean (0/1)
 */
export function jsBoolToSql(value: boolean | undefined | null): number {
    return value ? 1 : 0;
}

/**
 * Safely parse JSON from SQL text column
 */
export function parseJsonColumn<T>(json: string | undefined | null, fallback: T): T {
    if (!json) return fallback;
    try {
        return JSON.parse(json) as T;
    } catch {
        console.warn('[SQL] Failed to parse JSON column:', json);
        return fallback;
    }
}

/**
 * Safely stringify object for SQL text column
 */
export function stringifyForSql(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value) && value.length === 0) return null;
    if (typeof value === 'object' && Object.keys(value).length === 0) return null;
    try {
        return JSON.stringify(value);
    } catch {
        console.warn('[SQL] Failed to stringify for SQL:', value);
        return null;
    }
}
