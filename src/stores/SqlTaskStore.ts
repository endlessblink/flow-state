
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import PowerSyncService from '@/services/database/PowerSyncDatabase'
import { SqlTask } from '@/services/database/SqlDatabaseTypes'
import { useNotification } from 'naive-ui'

export const useSqlTaskStore = defineStore('sqlTasks', () => {
    const tasks = ref<SqlTask[]>([])
    const isLoading = ref(false)
    const notification = useNotification()

    // --- Getters ---
    const activeTasks = computed(() => tasks.value.filter(t => t.is_deleted === 0))
    const completedTasks = computed(() => tasks.value.filter(t => t.status === 'completed' && t.is_deleted === 0))

    // --- Actions ---

    /**
     * Load all tasks from SQLite
     */
    async function loadTasks() {
        isLoading.value = true
        try {
            const db = await PowerSyncService.getInstance()
            const result = await db.getAll<SqlTask>('SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY "order" ASC')
            tasks.value = result
        } catch (err) {
            console.error('❌ [SQL-TASKS] Failed to load tasks:', err)
            notification?.error({ content: 'Failed to load tasks from local database.' })
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Create or Update a task
     */
    async function saveTask(task: Partial<SqlTask> & { id: string }) {
        try {
            const db = await PowerSyncService.getInstance()

            // Basic upsert logic
            const now = new Date().toISOString()
            const fullTask: SqlTask = {
                id: task.id,
                title: task.title || 'Untitled',
                status: task.status || 'todo',
                project_id: task.project_id,
                description: task.description,
                total_pomodoros: task.total_pomodoros || 0,
                estimated_pomodoros: task.estimated_pomodoros || 1,
                order: task.order || 0,
                column_id: task.column_id,
                created_at: task.created_at || now,
                updated_at: now, // Always update timestamp
                completed_at: task.completed_at,
                is_deleted: task.is_deleted || 0,
                deleted_at: task.deleted_at
            }

            await db.execute(`
        INSERT OR REPLACE INTO tasks (
          id, title, status, project_id, description, 
          total_pomodoros, estimated_pomodoros, "order", column_id,
          created_at, updated_at, completed_at, is_deleted, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                fullTask.id, fullTask.title, fullTask.status, fullTask.project_id, fullTask.description,
                fullTask.total_pomodoros, fullTask.estimated_pomodoros, fullTask.order, fullTask.column_id,
                fullTask.created_at, fullTask.updated_at, fullTask.completed_at, fullTask.is_deleted, fullTask.deleted_at
            ])

            // Optimistic Update
            const index = tasks.value.findIndex(t => t.id === fullTask.id)
            if (index !== -1) {
                tasks.value[index] = fullTask
            } else {
                tasks.value.push(fullTask)
            }

        } catch (err) {
            console.error('❌ [SQL-TASKS] Failed to save task:', err)
            throw err
        }
    }

    /**
     * Delete Task (Soft Delete)
     */
    async function deleteTask(id: string) {
        try {
            const db = await PowerSyncService.getInstance()
            const now = new Date().toISOString()

            await db.execute('UPDATE tasks SET is_deleted = 1, deleted_at = ? WHERE id = ?', [now, id])

            // Optimistic remove
            const index = tasks.value.findIndex(t => t.id === id)
            if (index !== -1) {
                tasks.value.splice(index, 1) // Remove from UI view immediately
            }
        } catch (err) {
            console.error('❌ [SQL-TASKS] Failed to delete task:', err)
        }
    }

    return {
        tasks,
        isLoading,
        activeTasks,
        completedTasks,
        loadTasks,
        saveTask,
        deleteTask
    }
})
