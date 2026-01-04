/**
 * Task Mapper - Converts between Task (app) and SqlTask (database) formats
 *
 * This mapper handles ALL task fields to ensure zero data loss during
 * the PouchDB to PowerSync migration.
 *
 * Last Updated: January 4, 2026
 * Migration Phase: Complete Schema (Phase 2)
 */

import type { Task, Subtask, TaskInstance, TaskRecurrence, RecurringTaskInstance, NotificationPreferences } from '@/types/tasks'
import type { SqlTask } from '@/services/database/SqlDatabaseTypes'
import { parseJsonColumn, stringifyForSql, sqlBoolToJs, jsBoolToSql } from '@/services/database/SqlDatabaseTypes'

/**
 * Convert Task (app model) to SqlTask (database model)
 */
export function toSqlTask(task: Task): SqlTask {
    const now = new Date().toISOString();

    return {
        id: task.id,

        // Core Identity & Content
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority || null,

        // Project & Hierarchy
        project_id: task.projectId || 'uncategorized',
        parent_task_id: task.parentTaskId || null,

        // Pomodoro Tracking
        total_pomodoros: task.completedPomodoros || 0,
        estimated_pomodoros: task.estimatedPomodoros || 1,
        progress: task.progress || 0,

        // Scheduling & Calendar
        due_date: task.dueDate || null,
        scheduled_date: task.scheduledDate || null,
        scheduled_time: task.scheduledTime || null,
        estimated_duration: task.estimatedDuration || null,

        // Complex Fields (JSON serialized)
        instances_json: stringifyForSql(task.instances),
        subtasks_json: stringifyForSql(task.subtasks),
        depends_on_json: stringifyForSql(task.dependsOn),
        tags_json: stringifyForSql(task.tags),
        connection_types_json: stringifyForSql(task.connectionTypes),
        recurrence_json: stringifyForSql(task.recurrence),
        recurring_instances_json: stringifyForSql(task.recurringInstances),
        notification_prefs_json: stringifyForSql(task.notificationPreferences),

        // Canvas & Spatial
        canvas_position_x: (task.canvasPosition?.x != null && !Number.isNaN(task.canvasPosition.x)) ? task.canvasPosition.x : undefined,
        canvas_position_y: (task.canvasPosition?.y != null && !Number.isNaN(task.canvasPosition.y)) ? task.canvasPosition.y : undefined,
        is_in_inbox: jsBoolToSql(task.isInInbox),

        // Kanban Workflow
        order: task.order || 0,
        column_id: task.columnId || null,

        // Timestamps
        created_at: task.createdAt instanceof Date
            ? task.createdAt.toISOString()
            : (task.createdAt || now),
        updated_at: now, // Always freshen on save
        completed_at: task.completedAt
            ? (task.completedAt instanceof Date ? task.completedAt.toISOString() : task.completedAt as string)
            : null,

        // Soft Delete Support
        is_deleted: jsBoolToSql(task._soft_deleted),
        deleted_at: task.deletedAt
            ? (task.deletedAt instanceof Date ? task.deletedAt.toISOString() : task.deletedAt as string)
            : null
    };
}

/**
 * Convert SqlTask (database model) to Task (app model)
 */
export function fromSqlTask(sqlTask: SqlTask): Task {
    // Parse all JSON fields safely
    const instances = parseJsonColumn<TaskInstance[]>(sqlTask.instances_json, []);
    const subtasks = parseJsonColumn<Subtask[]>(sqlTask.subtasks_json, []);
    const dependsOn = parseJsonColumn<string[]>(sqlTask.depends_on_json, []);
    const tags = parseJsonColumn<string[]>(sqlTask.tags_json, []);
    const connectionTypes = parseJsonColumn<Record<string, 'sequential' | 'blocker' | 'reference'>>(
        sqlTask.connection_types_json,
        {}
    );
    const recurrence = parseJsonColumn<TaskRecurrence | undefined>(sqlTask.recurrence_json, undefined);
    const recurringInstances = parseJsonColumn<RecurringTaskInstance[]>(sqlTask.recurring_instances_json, []);
    const notificationPreferences = parseJsonColumn<NotificationPreferences | undefined>(
        sqlTask.notification_prefs_json,
        undefined
    );

    // Reconstruct Canvas Position
    // CRITICAL FIX: Guard against NaNs from DB
    const canvasPosition = (
        sqlTask.canvas_position_x != null &&
        sqlTask.canvas_position_y != null &&
        !Number.isNaN(sqlTask.canvas_position_x) &&
        !Number.isNaN(sqlTask.canvas_position_y)
    ) ? { x: sqlTask.canvas_position_x, y: sqlTask.canvas_position_y } : undefined;

    return {
        id: sqlTask.id,

        // Core Identity & Content
        title: sqlTask.title,
        description: sqlTask.description || '',
        status: sqlTask.status as Task['status'],
        priority: (sqlTask.priority as Task['priority']) || null,

        // Project & Hierarchy
        projectId: sqlTask.project_id || 'uncategorized',
        parentTaskId: sqlTask.parent_task_id || null,

        // Pomodoro Tracking
        completedPomodoros: sqlTask.total_pomodoros || 0,
        estimatedPomodoros: sqlTask.estimated_pomodoros || 1,
        progress: sqlTask.progress || 0,

        // Scheduling & Calendar
        dueDate: sqlTask.due_date || '',
        scheduledDate: sqlTask.scheduled_date || undefined,
        scheduledTime: sqlTask.scheduled_time || undefined,
        estimatedDuration: sqlTask.estimated_duration || undefined,

        // Complex Fields (parsed from JSON)
        instances: instances,
        subtasks: subtasks,
        dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
        tags: tags.length > 0 ? tags : undefined,
        connectionTypes: Object.keys(connectionTypes).length > 0 ? connectionTypes : undefined,
        recurrence: recurrence,
        recurringInstances: recurringInstances.length > 0 ? recurringInstances : undefined,
        notificationPreferences: notificationPreferences,

        // Canvas & Spatial
        canvasPosition: canvasPosition,
        isInInbox: sqlBoolToJs(sqlTask.is_in_inbox),

        // Kanban Workflow
        order: sqlTask.order || 0,
        columnId: sqlTask.column_id || undefined,

        // Timestamps
        createdAt: new Date(sqlTask.created_at),
        updatedAt: new Date(sqlTask.updated_at),
        completedAt: sqlTask.completed_at ? new Date(sqlTask.completed_at) : undefined,

        // Soft Delete Support
        _soft_deleted: sqlBoolToJs(sqlTask.is_deleted),
        deletedAt: sqlTask.deleted_at ? new Date(sqlTask.deleted_at) : undefined
    };
}

/**
 * Validate task ID format
 */
export function isValidTaskId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    // Accept both old PouchDB format (task-xxx) and new UUID format
    return id.length > 0 && id.length < 100;
}

/**
 * Extract task ID from PouchDB document ID
 */
export function extractTaskId(docId: string): string {
    if (docId.startsWith('task-')) {
        return docId.substring(5); // Remove 'task-' prefix
    }
    return docId;
}

/**
 * Create PouchDB-style document ID from task ID
 */
export function createTaskDocId(taskId: string): string {
    if (taskId.startsWith('task-')) {
        return taskId;
    }
    return `task-${taskId}`;
}
