import { column, Schema, Table } from '@powersync/web';

/**
 * Complete PowerSync Schema for Pomo-Flow
 *
 * This schema includes ALL fields from the PouchDB implementation
 * to ensure zero data loss during migration.
 *
 * Last Updated: January 4, 2026
 * Migration Phase: Complete Schema (Phase 2)
 */

// ============================================================================
// TASKS TABLE - Complete field set matching Task interface
// ============================================================================
const tasks = new Table({
    // Core Identity & Content
    title: column.text,
    description: column.text,
    status: column.text, // 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
    priority: column.text, // 'low' | 'medium' | 'high' | null

    // Project & Hierarchy
    project_id: column.text,
    parent_task_id: column.text, // For nested tasks (null = root-level)

    // Pomodoro Tracking
    total_pomodoros: column.integer, // completedPomodoros
    estimated_pomodoros: column.integer,
    progress: column.integer, // 0-100 completion percentage

    // Scheduling & Calendar
    due_date: column.text, // Primary deadline (YYYY-MM-DD)
    scheduled_date: column.text, // Legacy: specific scheduled date
    scheduled_time: column.text, // Legacy: specific scheduled time (HH:MM)
    estimated_duration: column.integer, // Duration in minutes

    // Complex Fields (JSON serialized)
    instances_json: column.text, // TaskInstance[] - Calendar instances
    subtasks_json: column.text, // Subtask[] - Nested subtasks
    depends_on_json: column.text, // string[] - Task IDs this depends on
    tags_json: column.text, // string[] - Task labels
    connection_types_json: column.text, // Record<taskId, type> - Canvas connections
    recurrence_json: column.text, // TaskRecurrence - Recurrence pattern
    recurring_instances_json: column.text, // RecurringTaskInstance[] - Generated instances
    notification_prefs_json: column.text, // NotificationPreferences

    // Canvas & Spatial
    canvas_position_x: column.real,
    canvas_position_y: column.real,
    is_in_inbox: column.integer, // 0/1 boolean

    // Kanban Workflow
    order: column.integer, // Sorting position
    column_id: column.text, // Kanban column

    // Timestamps
    created_at: column.text, // ISO string
    updated_at: column.text, // ISO string
    completed_at: column.text, // When task was marked done

    // Soft Delete Support
    is_deleted: column.integer, // 0/1 boolean
    deleted_at: column.text // ISO string
});

// ============================================================================
// PROJECTS TABLE - Complete field set matching Project interface
// ============================================================================
const projects = new Table({
    // Core Identity
    name: column.text,
    description: column.text,

    // Appearance
    color: column.text, // Hex color or emoji
    color_type: column.text, // 'hex' | 'emoji'
    icon: column.text,
    emoji: column.text, // For emoji-based colors

    // Hierarchy
    parent_id: column.text, // For nested projects

    // View Configuration
    view_type: column.text, // 'status' | 'date' | 'priority' (Kanban view mode)

    // Sorting
    order: column.integer,

    // Timestamps
    created_at: column.text,
    updated_at: column.text,

    // Soft Delete
    is_deleted: column.integer,
    deleted_at: column.text
});

// ============================================================================
// GROUPS TABLE - Canvas Sections with complete feature set
// ============================================================================
const groups = new Table({
    // Core Identity
    name: column.text,
    type: column.text, // 'custom' | 'priority' | 'status' | 'project' | 'timeline'
    color: column.text,

    // Geometry (JSON stored as text)
    position_json: column.text, // { x, y, width, height }

    // Settings (JSON stored as text)
    filters_json: column.text, // GroupFilter configuration
    layout: column.text, // 'vertical' | 'horizontal' | 'grid'

    // State
    is_visible: column.integer, // 0/1 boolean
    is_collapsed: column.integer, // 0/1 boolean
    collapsed_height: column.integer, // Height when collapsed

    // Hierarchy
    parent_group_id: column.text, // For nested groups (TASK-072)

    // Advanced Features (Power Groups)
    is_power_mode: column.integer, // 0/1 boolean - Power mode enabled
    power_keyword_json: column.text, // Power keyword detection result
    assign_on_drop_json: column.text, // AssignOnDropSettings
    collect_filter_json: column.text, // CollectFilterSettings (Magnet feature)
    auto_collect: column.integer, // 0/1 boolean - Auto-collect matching tasks
    is_pinned: column.integer, // 0/1 boolean - Pin state
    property_value: column.text, // Value for auto-collect (e.g., 'high' for priority)

    // Timestamps
    created_at: column.text,
    updated_at: column.text,

    // Soft Delete
    is_deleted: column.integer
});

// ============================================================================
// SUBTASKS TABLE - Separate table for relational subtasks
// ============================================================================
const subtasks = new Table({
    // Identity
    parent_task_id: column.text, // FK to tasks

    // Content
    title: column.text,
    description: column.text,

    // Progress
    completed_pomodoros: column.integer,
    is_completed: column.integer, // 0/1 boolean

    // Sorting
    order: column.integer,

    // Timestamps
    created_at: column.text,
    updated_at: column.text
});

// ============================================================================
// TIMER_SESSIONS TABLE - Pomodoro timer state
// ============================================================================
const timer_sessions = new Table({
    // Session Identity
    session_type: column.text, // 'work' | 'short_break' | 'long_break'
    task_id: column.text, // Currently focused task (nullable)

    // Timer State
    duration: column.integer, // Total duration in seconds
    remaining: column.integer, // Remaining time in seconds
    is_running: column.integer, // 0/1 boolean
    is_paused: column.integer, // 0/1 boolean

    // Session Tracking
    sessions_completed: column.integer, // Pomodoros completed in current cycle
    total_sessions_today: column.integer,

    // Cross-device Coordination
    device_leader_id: column.text, // Device currently running the timer
    last_heartbeat: column.text, // ISO timestamp

    // Settings (cached for offline)
    work_duration: column.integer, // Work session length (minutes)
    short_break_duration: column.integer,
    long_break_duration: column.integer,
    sessions_before_long_break: column.integer,
    auto_start_breaks: column.integer, // 0/1 boolean
    auto_start_pomodoros: column.integer, // 0/1 boolean

    // Timestamps
    started_at: column.text,
    paused_at: column.text,
    created_at: column.text,
    updated_at: column.text
});

// ============================================================================
// NOTIFICATIONS TABLE - Individual notification documents
// ============================================================================
const notifications = new Table({
    // Identity
    task_id: column.text, // Related task (nullable)
    type: column.text, // 'reminder' | 'due_date' | 'pomodoro_complete' | 'custom'

    // Content
    title: column.text,
    message: column.text,

    // Scheduling
    scheduled_for: column.text, // ISO timestamp
    timing_minutes: column.integer, // Minutes before due date

    // State
    is_read: column.integer, // 0/1 boolean
    is_dismissed: column.integer, // 0/1 boolean
    is_snoozed: column.integer, // 0/1 boolean
    snoozed_until: column.text, // ISO timestamp

    // Settings
    sound_enabled: column.integer, // 0/1 boolean
    vibration_enabled: column.integer, // 0/1 boolean

    // Timestamps
    created_at: column.text,
    updated_at: column.text,
    read_at: column.text,
    dismissed_at: column.text
});

// ============================================================================
// SETTINGS TABLE - Key-value store for app settings
// ============================================================================
const settings = new Table({
    key: column.text, // Setting identifier
    value_json: column.text, // JSON-encoded value
    category: column.text, // 'timer' | 'ui' | 'sync' | 'notifications'
    updated_at: column.text
});

// ============================================================================
// EXPORT SCHEMA
// ============================================================================
export const AppSchema = new Schema({
    tasks,
    projects,
    groups,
    subtasks,
    timer_sessions,
    notifications,
    settings
});

export type DatabaseSchema = typeof AppSchema.types;
