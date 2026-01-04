import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import PowerSyncService from '@/services/database/PowerSyncDatabase'
import { toSqlProject, fromSqlProject } from '@/utils/projectMapper'
import type { Project } from '@/types/tasks'
import { useTaskStore } from './tasks'
import { syncState } from '@/services/sync/SyncStateService'

export const useProjectStore = defineStore('projects', () => {

    // State
    const projects = ref<Project[]>([])
    const activeProjectId = ref<string | null>(null)
    const isLoading = ref(false)

    // Manual operation flag to prevent watch system conflicts
    let manualOperationInProgress = false

    // Root projects - projects without parentId
    const rootProjects = computed(() => {
        return projects.value.filter(p => !p.parentId || p.parentId === 'undefined' || p.parentId === undefined)
    })

    // Actions
    const saveProjectsToStorage = async (projectsToSave: Project[], context: string = 'unknown'): Promise<void> => {
        if (typeof window !== 'undefined' && (window as any).__STORYBOOK__) return

        try {
            const db = await PowerSyncService.getInstance()

            // Convert to SQL format
            const sqlProjects = projectsToSave.map(toSqlProject)

            // Execute Transaction - ALL FIELDS
            await db.writeTransaction(async (tx) => {
                for (const p of sqlProjects) {
                    await tx.execute(`
                        INSERT OR REPLACE INTO projects (
                            id, name, description, color, color_type, icon, emoji,
                            parent_id, view_type, "order",
                            created_at, updated_at, is_deleted, deleted_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        p.id, p.name, p.description, p.color, p.color_type, p.icon, p.emoji,
                        p.parent_id, p.view_type, p.order,
                        p.created_at, p.updated_at, p.is_deleted, p.deleted_at
                    ])
                }
            })
            console.debug(`✅ [SQL] Saved ${sqlProjects.length} projects (${context})`)

            // PouchDB dual-sync removed during decommissioning

        } catch (e) {
            console.error(`❌ [SQL] Project save failed (${context}):`, e)
        }
    }

    const loadProjectsFromDatabase = async () => {
        isLoading.value = true
        try {
            const db = await PowerSyncService.getInstance()

            // Query all non-deleted projects
            const result = await db.getAll('SELECT * FROM projects WHERE is_deleted = 0')

            // Map back to Frontend Project objects
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const loadedProjects = result.map(row => fromSqlProject(row as any))

            projects.value = loadedProjects
            console.log(`✅ [SQL] Loaded ${loadedProjects.length} projects from SQLite`)

        } catch (error) {
            console.error('❌ [SQL] Projects load failed:', error)
        } finally {
            isLoading.value = false
        }
    }

    const createProject = async (projectData: Partial<Project>) => {
        manualOperationInProgress = true
        try {
            const newProject: Project = {
                id: Date.now().toString(),
                name: projectData.name || 'New Project',
                color: projectData.color || '#4ECDC4',
                colorType: projectData.colorType || 'hex',
                emoji: projectData.emoji,
                viewType: projectData.viewType || 'status',
                parentId: projectData.parentId || null,
                createdAt: new Date(),
                updatedAt: new Date(),
                ...projectData
            } as Project
            projects.value.push(newProject)
            await saveProjectsToStorage(projects.value, `createProject-${newProject.id}`)
            return newProject
        } finally {
            manualOperationInProgress = false
        }
    }

    const updateProject = async (projectId: string, updates: Partial<Project>) => {
        const projectIndex = projects.value.findIndex(p => p.id === projectId)
        if (projectIndex !== -1) {
            manualOperationInProgress = true
            try {
                projects.value[projectIndex] = {
                    ...projects.value[projectIndex],
                    ...updates
                }
                await saveProjectsToStorage(projects.value, `updateProject-${projectId}`)
            } finally {
                manualOperationInProgress = false
            }
        }
    }

    const deleteProject = async (projectId: string) => {
        const projectIndex = projects.value.findIndex(p => p.id === projectId)
        if (projectIndex !== -1) {
            manualOperationInProgress = true
            try {
                const projectToDelete = projects.value[projectIndex]
                const parentId = projectToDelete.parentId

                const taskStore = useTaskStore() as any
                taskStore.tasks.forEach((task: any) => {
                    if (task.projectId === projectId) {
                        taskStore.updateTask(task.id, {
                            projectId: 'uncategorized',
                            isUncategorized: true
                        })
                    }
                })

                projects.value.forEach(project => {
                    if (project.parentId === projectId) {
                        project.parentId = parentId
                    }
                })

                projects.value.splice(projectIndex, 1)

                // SQL Delete (Soft delete)
                const db = await PowerSyncService.getInstance()
                await db.execute('UPDATE projects SET is_deleted = 1 WHERE id = ?', [projectId])

            } catch (e) {
                console.error('Failed to delete project:', e)
            } finally {
                manualOperationInProgress = false
            }
        }
    }

    /**
     * Bulk delete multiple projects at once
     */
    const deleteProjects = async (projectIds: string[]) => {
        if (projectIds.length === 0) return

        manualOperationInProgress = true
        try {
            const taskStore = useTaskStore() as any
            const projectIdSet = new Set(projectIds)

            // Build parent mapping for re-parenting children
            const parentMap = new Map<string, string | null>()
            projectIds.forEach(id => {
                const project = projects.value.find(p => p.id === id)
                if (project) {
                    parentMap.set(id, project.parentId || null)
                }
            })

            // Move tasks from all deleted projects to uncategorized
            taskStore.tasks.forEach((task: any) => {
                if (projectIdSet.has(task.projectId)) {
                    taskStore.updateTask(task.id, {
                        projectId: 'uncategorized',
                        isUncategorized: true
                    })
                }
            })

            // Re-parent children of deleted projects
            projects.value.forEach(project => {
                if (projectIdSet.has(project.parentId || '')) {
                    // Find the nearest ancestor that's not being deleted
                    let newParentId = parentMap.get(project.parentId!) || null
                    while (newParentId && projectIdSet.has(newParentId)) {
                        newParentId = parentMap.get(newParentId) || null
                    }
                    project.parentId = newParentId
                }
            })

            // Remove all deleted projects
            projects.value = projects.value.filter(p => !projectIdSet.has(p.id))

            // SQL Bulk Delete
            const db = await PowerSyncService.getInstance()
            await db.writeTransaction(async (tx) => {
                for (const id of projectIds) {
                    await tx.execute('UPDATE projects SET is_deleted = 1 WHERE id = ?', [id])
                }
            })

        } finally {
            manualOperationInProgress = false
        }
    }

    const setProjectColor = async (projectId: string, color: string, colorType: 'hex' | 'emoji', emoji?: string) => {
        const project = projects.value.find(p => p.id === projectId)
        if (project) {
            manualOperationInProgress = true
            try {
                project.color = color
                project.colorType = colorType
                project.emoji = colorType === 'emoji' ? emoji : undefined
                await saveProjectsToStorage(projects.value, `setProjectColor-${projectId}`)
            } finally {
                manualOperationInProgress = false
            }
        }
    }

    const setProjectViewType = async (projectId: string, viewType: Project['viewType']) => {
        const project = projects.value.find(p => p.id === projectId)
        if (project) {
            project.viewType = viewType
            await saveProjectsToStorage(projects.value, `setProjectViewType-${projectId}`)
        }
    }

    const moveTaskToProject = async (taskId: string, targetProjectId: string) => {
        const taskStore = useTaskStore() as any
        const task = (taskStore.tasks as any).find((t: any) => t.id === taskId)
        if (task) {
            manualOperationInProgress = true
            try {
                task.projectId = targetProjectId
                task.updatedAt = new Date()
                console.log(`Task "${task.title}" moved to project "${getProjectDisplayName(targetProjectId)}"`)
                await (taskStore as any).saveTasksToStorage(taskStore.tasks, `moveTaskToProject-${taskId}`)
            } finally {
                manualOperationInProgress = false
            }
        }
    }

    const getProjectById = (projectId: string | null | undefined): Project | undefined => {
        if (!projectId) return undefined
        return projects.value.find(p => p.id === projectId)
    }

    const getProjectDisplayName = (projectId: string | null | undefined): string => {
        if (!projectId || projectId === '1' || projectId === 'uncategorized') return 'Uncategorized'
        const project = getProjectById(projectId)
        return project?.name || 'Uncategorized'
    }

    const getProjectEmoji = (projectId: string | null | undefined): string => {
        if (!projectId) return '📁'
        const project = getProjectById(projectId)
        return project?.emoji || '📁'
    }

    const getProjectVisual = (projectId: string | null | undefined) => {
        if (!projectId) return { type: 'default', content: '📁' }
        const project = getProjectById(projectId)
        if (!project) return { type: 'default', content: '📁' }
        if (project.emoji) return { type: 'emoji', content: project.emoji }
        if (project.colorType === 'hex' && typeof project.color === 'string') {
            return { type: 'css-circle', content: '', color: project.color }
        }
        return { type: 'default', content: '📁' }
    }

    const isDescendantOf = (projectId: string, potentialAncestorId: string): boolean => {
        let current = getProjectById(projectId)
        const visited = new Set<string>()

        while (current?.parentId) {
            if (visited.has(current.id)) return false // Cycle detected
            visited.add(current.id)

            if (current.parentId === potentialAncestorId) return true
            current = getProjectById(current.parentId)
        }
        return false
    }

    const getChildProjectIds = (projectId: string): string[] => {
        const ids = [projectId]
        const visited = new Set<string>([projectId])
        const queue = [projectId]

        // Use iterative BFS instead of recursion to prevent stack overflow
        while (queue.length > 0) {
            const currentId = queue.shift()!
            const childProjects = projects.value.filter(p => p.parentId === currentId)

            for (const child of childProjects) {
                if (!visited.has(child.id)) {
                    visited.add(child.id)
                    ids.push(child.id)
                    queue.push(child.id)
                }
            }
        }
        return ids
    }

    const getChildProjects = (parentId: string): Project[] => {
        return projects.value.filter(p => p.parentId === parentId)
    }

    const getProjectHierarchy = (projectId: string): Project[] => {
        const project = getProjectById(projectId)
        if (!project) return []
        const hierarchy = [project]
        let currentId = project.parentId
        while (currentId) {
            const parent = getProjectById(currentId)
            if (parent) {
                hierarchy.unshift(parent)
                currentId = parent.parentId
            } else break
        }
        return hierarchy
    }

    const setActiveProject = (projectId: string | null) => {
        activeProjectId.value = projectId
    }

    const updateProjectFromSync = (projectId: string, data: any) => {
        const index = projects.value.findIndex(p => p.id === projectId)
        const normalized = {
            ...data,
            createdAt: new Date(data.createdAt || Date.now()),
            updatedAt: new Date(data.updatedAt || Date.now())
        }
        if (index !== -1) {
            projects.value[index] = normalized
        } else {
            projects.value.push(normalized)
        }
    }

    const removeProjectFromSync = (projectId: string) => {
        const index = projects.value.findIndex(p => p.id === projectId)
        if (index !== -1) {
            projects.value.splice(index, 1)
        }
    }

    const initializeFromDatabase = async () => {
        await loadProjectsFromDatabase()
        return projects.value.length > 0
    }

    // Watchers
    let saveTimeout: ReturnType<typeof setTimeout> | null = null
    watch(projects, (newProjects) => {
        if (manualOperationInProgress || isLoading.value || syncState.isSyncing.value) return
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(() => {
            saveProjectsToStorage([...newProjects], 'auto-save')
        }, 1000)
    }, { deep: true })

    return {
        projects,
        activeProjectId,
        isLoading,
        rootProjects,
        loadProjectsFromDatabase,
        // Alias for backward compatibility with app initialization
        loadProjectsFromPouchDB: loadProjectsFromDatabase,
        createProject,
        updateProject,
        deleteProject,
        deleteProjects,
        setProjectColor,
        getProjectById,
        getProjectDisplayName,
        getProjectEmoji,
        getProjectVisual,
        isDescendantOf,
        getChildProjectIds,
        getChildProjects,
        getProjectHierarchy,
        setActiveProject,
        saveProjectsToStorage,
        setProjectViewType,
        moveTaskToProject,
        initializeFromDatabase,
        updateProjectFromSync,
        removeProjectFromSync
    }
})
