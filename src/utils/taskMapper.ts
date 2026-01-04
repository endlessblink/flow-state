
import type { Task } from '@/types/tasks'
import type { SqlTask } from '@/services/database/SqlDatabaseTypes'
import { isValidTaskId } from '@/utils/taskValidation'

export function toSqlTask(task: Task): SqlTask {
    return {
        id: task.id,
        title: task.title,
        status: task.status,
        project_id: task.projectId || 'uncategorized',
        description: task.description || '',
        total_pomodoros: task.completedPomodoros || 0,
        estimated_pomodoros: task.estimatedPomodoros || 1,
        order: task.order || 0,
        column_id: task.columnId || '',
        created_at: task.createdAt instanceof Date ? task.createdAt.toISOString() : (task.createdAt || new Date().toISOString()),
        updated_at: new Date().toISOString(), // Always freshen update time on save
        completed_at: task.completedAt ? (task.completedAt instanceof Date ? task.completedAt.toISOString() : task.completedAt as string) : undefined,
        is_deleted: 0,
        deleted_at: undefined
    }
}

export function fromSqlTask(sqlTask: SqlTask): Task {
    return {
        id: sqlTask.id,
        title: sqlTask.title,
        status: sqlTask.status as any, // Cast to union type
        projectId: sqlTask.project_id || 'uncategorized',
        description: sqlTask.description || '',
        completedPomodoros: sqlTask.total_pomodoros || 0,
        estimatedPomodoros: sqlTask.estimated_pomodoros || 0,
        order: sqlTask.order || 0,
        columnId: sqlTask.column_id || '',
        createdAt: new Date(sqlTask.created_at),
        updatedAt: new Date(sqlTask.updated_at),
        completedAt: sqlTask.completed_at ? new Date(sqlTask.completed_at) : undefined,

        // Defaults for fields not in SQL yet
        priority: 'medium',
        progress: 0,
        subtasks: [],
        dueDate: '',
        isInInbox: !sqlTask.project_id || sqlTask.project_id === 'uncategorized',
        instances: []
    }
}
