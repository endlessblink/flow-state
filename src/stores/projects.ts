import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import { STORAGE_FLAGS } from '@/config/database'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import { guardProjectCreation } from '@/utils/demoContentGuard'
import type { Project } from '@/types/tasks'
import {
    saveProjects as saveIndividualProjects,
    loadAllProjects as loadIndividualProjects,
    migrateFromLegacyFormat as migrateProjectsFromLegacy,
    deleteProject as deleteProjectDoc
} from '@/utils/individualProjectStorage'
import { useTaskStore } from './tasks'
import { syncState } from '@/services/sync/SyncStateService'

export const useProjectStore = defineStore('projects', () => {
    const db = useDatabase()

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
        if (typeof window !== 'undefined' && (window as any).__STORYBOOK__) {
            console.log('🔒 [STORYBOOK] Skipping project persistence:', context)
            return
        }

        const dbInstance = db.database.value
        if (!dbInstance) {
            console.error(`❌ [SAVE-PROJECTS] PouchDB not available (${context})`)
            return
        }

        try {
            await saveIndividualProjects(dbInstance, projectsToSave)
            console.log(`📋 [SAVE-PROJECTS] Projects saved to individual docs (${context}): ${projectsToSave.length} projects`)

            if (db.triggerSync) {
                await db.triggerSync()
            }
        } catch (error) {
            errorHandler.report({
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.DATABASE,
                message: 'Projects save failed',
                error: error as Error,
                context: { projectCount: projectsToSave.length, context },
                showNotification: false
            })
        }
    }

    const loadProjectsFromPouchDB = async () => {
        const dbInstance = db.database.value
        if (!dbInstance) return

        isLoading.value = true
        try {
            const loadedProjects = await loadIndividualProjects(dbInstance)
            projects.value = loadedProjects
            console.log(`📂 Loaded ${loadedProjects.length} projects from individual docs`)
        } catch (error) {
            console.error('Failed to load projects:', error)
        } finally {
            isLoading.value = false
        }
    }

    const createProject = async (projectData: Partial<Project>) => {
        // TASK-061: Demo content guard - warn in dev mode
        if (projectData.name) {
            guardProjectCreation(projectData.name)
        }

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
                await saveProjectsToStorage(projects.value, `deleteProject-${projectId}`)

                // BUG-054 FIX: Actually delete the project document from PouchDB
                // This creates a tombstone that syncs to CouchDB, preventing the project from reappearing
                const dbInstance = db.database.value
                if (dbInstance && STORAGE_FLAGS.INDIVIDUAL_PROJECTS_ONLY) {
                    try {
                        await deleteProjectDoc(dbInstance, projectId)
                        console.log(`🗑️ [PROJECT] Deleted document for project ${projectId}`)
                    } catch (deleteErr) {
                        console.warn(`⚠️ [PROJECT] Failed to delete document for ${projectId}:`, deleteErr)
                    }
                }
            } finally {
                manualOperationInProgress = false
            }
        }
    }

    /**
     * Bulk delete multiple projects at once
     * - Moves all tasks from deleted projects to 'uncategorized'
     * - Re-parents child projects to their grandparent (or root if no grandparent)
     * - Single database write for efficiency
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

            await saveProjectsToStorage(projects.value, `deleteProjects-${projectIds.length}`)

            // BUG-054 FIX: Actually delete project documents from PouchDB
            // This creates tombstones that sync to CouchDB, preventing projects from reappearing
            const dbInstance = db.database.value
            if (dbInstance && STORAGE_FLAGS.INDIVIDUAL_PROJECTS_ONLY) {
                for (const projectId of projectIds) {
                    try {
                        await deleteProjectDoc(dbInstance, projectId)
                        console.log(`🗑️ [PROJECT] Deleted document for project ${projectId}`)
                    } catch (deleteErr) {
                        console.warn(`⚠️ [PROJECT] Failed to delete document for ${projectId}:`, deleteErr)
                    }
                }
            }
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

    const initializeFromPouchDB = async () => {
        await loadProjectsFromPouchDB()
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
        loadProjectsFromPouchDB,
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
        initializeFromPouchDB,
        updateProjectFromSync,
        removeProjectFromSync
    }
})
