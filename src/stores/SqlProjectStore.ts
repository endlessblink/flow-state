
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import PowerSyncService from '@/services/database/PowerSyncDatabase'
import { SqlProject } from '@/services/database/SqlDatabaseTypes'
import { useNotification } from 'naive-ui'

export const useSqlProjectStore = defineStore('sqlProjects', () => {
    const projects = ref<SqlProject[]>([])
    const isLoading = ref(false)
    const notification = useNotification()

    // --- Getters ---
    const activeProjects = computed(() => projects.value.filter(p => p.is_deleted === 0))

    // --- Actions ---

    /**
     * Load all projects from SQLite
     */
    async function loadProjects() {
        isLoading.value = true
        try {
            const db = await PowerSyncService.getInstance()
            // Order naturally by name for now, or add an order field if needed
            const result = await db.getAll<SqlProject>('SELECT * FROM projects WHERE is_deleted = 0')
            projects.value = result
        } catch (err) {
            console.error('❌ [SQL-PROJECTS] Failed to load projects:', err)
            notification?.error({ content: 'Failed to load projects from local database.' })
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Create or Update a project
     */
    async function saveProject(project: Partial<SqlProject> & { id: string }) {
        try {
            const db = await PowerSyncService.getInstance()
            const now = new Date().toISOString()

            const fullProject: SqlProject = {
                id: project.id,
                name: project.name || 'Untitled Project',
                color: project.color || '#808080',
                created_at: project.created_at || now,
                updated_at: now,
                is_deleted: project.is_deleted || 0
            }

            await db.execute(`
        INSERT OR REPLACE INTO projects (
          id, name, color, created_at, updated_at, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
                fullProject.id, fullProject.name, fullProject.color,
                fullProject.created_at, fullProject.updated_at, fullProject.is_deleted
            ])

            // Optimistic Update
            const index = projects.value.findIndex(p => p.id === fullProject.id)
            if (index !== -1) {
                projects.value[index] = fullProject
            } else {
                projects.value.push(fullProject)
            }

        } catch (err) {
            console.error('❌ [SQL-PROJECTS] Failed to save project:', err)
            throw err
        }
    }

    /**
     * Delete Project (Soft Delete)
     */
    async function deleteProject(id: string) {
        try {
            const db = await PowerSyncService.getInstance()
            const now = new Date().toISOString()

            await db.execute('UPDATE projects SET is_deleted = 1, updated_at = ? WHERE id = ?', [now, id])

            // Optimistic remove
            const index = projects.value.findIndex(p => p.id === id)
            if (index !== -1) {
                projects.value.splice(index, 1)
            }
        } catch (err) {
            console.error('❌ [SQL-PROJECTS] Failed to delete project:', err)
            throw err
        }
    }

    return {
        projects,
        isLoading,
        activeProjects,
        loadProjects,
        saveProject,
        deleteProject
    }
})
