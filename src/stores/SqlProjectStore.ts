
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
     * Load all projects from SQLite and stay in sync
     */
    async function loadProjects() {
        isLoading.value = true
        try {
            const db = await PowerSyncService.getInstance()

            // PowerSync watch() returns an AsyncIterable
            const observable = db.watch('SELECT * FROM projects WHERE is_deleted = 0')

                // Start the background watcher loop
                ; (async () => {
                    try {
                        for await (const result of observable) {
                            const rows = result.rows?._array as SqlProject[] || []
                            console.debug('🔋 [SQL-PROJECTS] Projects updated from DB', rows.length)
                            projects.value = rows
                        }
                    } catch (err) {
                        console.error('❌ [SQL-PROJECTS] Watcher loop error:', err)
                    }
                })()

        } catch (err) {
            console.error('❌ [SQL-PROJECTS] Failed to load projects:', err)
            notification?.error({ content: 'Failed to load projects from local database.' })
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Create or Update a project (ALL FIELDS)
     */
    async function saveProject(project: Partial<SqlProject> & { id: string }) {
        try {
            const db = await PowerSyncService.getInstance()
            const now = new Date().toISOString()

            const fullProject: SqlProject = {
                id: project.id,

                // Core Identity
                name: project.name || 'Untitled Project',
                description: project.description || undefined,

                // Appearance
                color: project.color || '#808080',
                color_type: project.color_type || 'hex',
                icon: project.icon || undefined,
                emoji: project.emoji || undefined,

                // Hierarchy
                parent_id: project.parent_id || undefined,

                // View Configuration
                view_type: project.view_type || 'status',

                // Sorting
                order: project.order ?? 0,

                // Timestamps
                created_at: project.created_at || now,
                updated_at: now,

                // Soft Delete
                is_deleted: project.is_deleted ?? 0,
                deleted_at: project.deleted_at || undefined
            }

            await db.execute(`
        INSERT OR REPLACE INTO projects (
          id, name, description, color, color_type, icon, emoji,
          parent_id, view_type, "order",
          created_at, updated_at, is_deleted, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                fullProject.id, fullProject.name, fullProject.description,
                fullProject.color, fullProject.color_type, fullProject.icon, fullProject.emoji,
                fullProject.parent_id, fullProject.view_type, fullProject.order,
                fullProject.created_at, fullProject.updated_at, fullProject.is_deleted, fullProject.deleted_at
            ])

            // NOTE: No optimistic update needed! db.watch() handles the UI update instantly.

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

            // NOTE: No optimistic removal needed! db.watch() handles it.
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
