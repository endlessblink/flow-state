import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import { STORAGE_FLAGS } from '@/config/database'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import type { Project } from '@/types/tasks'
import {
    saveProjects as saveIndividualProjects,
    loadAllProjects as loadIndividualProjects,
    migrateFromLegacyFormat as migrateProjectsFromLegacy
} from '@/utils/individualProjectStorage'
import { useTaskStore } from './tasks'

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

        const dbInstance = (window as any).pomoFlowDb
        if (!dbInstance) {
            console.error(`❌ [SAVE-PROJECTS] PouchDB not available (${context})`)
            return
        }

        try {
            if (STORAGE_FLAGS.DUAL_WRITE_PROJECTS || STORAGE_FLAGS.INDIVIDUAL_PROJECTS_ONLY) {
                await saveIndividualProjects(dbInstance, projectsToSave)
                console.log(`📋 [SAVE-PROJECTS] Projects saved to individual docs (${context}): ${projectsToSave.length} projects`)
            }

            if (!STORAGE_FLAGS.INDIVIDUAL_PROJECTS_ONLY) {
                const existingDoc = await dbInstance.get('projects:data').catch(() => null)
                await dbInstance.put({
                    _id: 'projects:data',
                    _rev: existingDoc?._rev || undefined,
                    data: projectsToSave,
                    createdAt: existingDoc?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
                console.log(`📋 [SAVE-PROJECTS] Projects saved to legacy format (${context})`)
            }

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
        const dbInstance = (window as any).pomoFlowDb
        if (!dbInstance) return

        isLoading.value = true
        try {
            let loadedProjects: Project[] = []

            if (STORAGE_FLAGS.DUAL_WRITE_PROJECTS || STORAGE_FLAGS.INDIVIDUAL_PROJECTS_ONLY) {
                loadedProjects = await loadIndividualProjects(dbInstance)
            }

            if (loadedProjects.length === 0 && !STORAGE_FLAGS.INDIVIDUAL_PROJECTS_ONLY) {
                const legacyDoc = await dbInstance.get('projects:data').catch(() => null)
                if (legacyDoc && legacyDoc.data) {
                    loadedProjects = legacyDoc.data.map((p: any) => ({
                        ...p,
                        createdAt: new Date(p.createdAt || Date.now())
                    }))
                    console.log(`📂 Loaded ${loadedProjects.length} projects from legacy format`)
                }
            }

            projects.value = loadedProjects

            if (STORAGE_FLAGS.DUAL_WRITE_PROJECTS && loadedProjects.length > 0) {
                const individualDocs = await dbInstance.allDocs({
                    startkey: 'project-',
                    endkey: 'project-\ufff0'
                })
                if (individualDocs.total_rows === 0) {
                    await migrateProjectsFromLegacy(dbInstance)
                }
            }
        } catch (error) {
            console.error('Failed to load projects:', error)
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
                ...projectData
            }
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
            } finally {
                manualOperationInProgress = false
            }
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
        while (current?.parentId) {
            if (current.parentId === potentialAncestorId) return true
            current = getProjectById(current.parentId)
        }
        return false
    }

    const getChildProjectIds = (projectId: string): string[] => {
        const ids = [projectId]
        const childProjects = projects.value.filter(p => p.parentId === projectId)
        childProjects.forEach(child => {
            ids.push(...getChildProjectIds(child.id))
        })
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

    const initializeFromPouchDB = async () => {
        await loadProjectsFromPouchDB()
        return projects.value.length > 0
    }

    // Watchers
    watch(projects, (newProjects) => {
        if (manualOperationInProgress || isLoading.value) return
        saveProjectsToStorage([...newProjects], 'auto-save')
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
        initializeFromPouchDB
    }
})
