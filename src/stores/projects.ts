import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { Project } from '@/types/tasks'

export const useProjectStore = defineStore('projects', () => {

    // State
    // SAFETY: Named _rawProjects to discourage direct access - use projects (filtered) instead
    const _rawProjects = ref<Project[]>([])
    const activeProjectId = ref<string | null>(null)
    const isLoading = ref(false)

    // Manual operation flag to prevent watch system conflicts
    let manualOperationInProgress = false

    // SAFETY: Filtered projects for display
    // - Filters out corrupted projects (missing name, invalid data)
    // - Future: could filter out _soft_deleted projects if that feature is added
    const projects = computed(() => _rawProjects.value.filter(p => {
        // Must have valid id
        if (!p.id) return false
        // Must have valid name (not null, undefined, or empty string)
        if (!p.name || typeof p.name !== 'string' || p.name.trim() === '') {
            console.warn(`[PROJECT-FILTER] Hiding project with invalid name:`, p.id)
            return false
        }
        return true
    }))

    // Root projects - projects without parentId (uses filtered projects to exclude corrupted)
    const rootProjects = computed(() => {
        return projects.value.filter(p => !p.parentId || p.parentId === 'undefined' || p.parentId === undefined)
    })

    // Optimization: fast lookup map for projects
    // Replaces O(N) array find with O(1) map lookup
    // This significantly improves performance when rendering lists of tasks
    // that need to look up project details (e.g. UnifiedInboxPanel)
    // SAFETY: Use _rawProjects for lookup since we might need to find any project
    const projectMap = computed(() => {
        const map = new Map<string, Project>()
        for (const p of _rawProjects.value) {
            map.set(p.id, p)
        }
        return map
    })

    // -- Supabase Integration --
    const { fetchProjects, saveProjects, saveProject, deleteProject: deleteProjectRemote, isSyncing } = useSupabaseDatabase()

    // Actions
    const saveProjectsToStorage = async (projectsToSave: Project[], context: string = 'unknown'): Promise<void> => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof window !== 'undefined' && (window as any).__STORYBOOK__) return

        // TASK-142 FIX: ALWAYS try Supabase - if reads work, writes should too
        // The auth check was causing data loss: loads came from Supabase but saves were blocked
        try {
            await saveProjects(projectsToSave)
            // console.debug(`✅ [SUPABASE] Saved ${projectsToSave.length} projects (${context})`)
        } catch (e) {
            console.error(`❌ [SUPABASE] Project save failed (${context}):`, e)
        }
    }

    const loadProjectsFromDatabase = async () => {
        isLoading.value = true
        try {
            // Guest mode: skip Supabase, start with empty projects
            const { useAuthStore } = await import('@/stores/auth')
            const authStore = useAuthStore()
            if (!authStore.isAuthenticated) {
                console.log('👤 [GUEST-MODE] Skipping Supabase fetch - projects start empty')
                _rawProjects.value = []
                return
            }

            const loadedProjects = await fetchProjects()
            _rawProjects.value = loadedProjects
            console.log(`✅ [SUPABASE] Loaded ${loadedProjects.length} projects`)
        } catch (error) {
            console.error('❌ [SUPABASE] Projects load failed:', error)
        } finally {
            isLoading.value = false
        }
    }

    const createProject = async (projectData: Partial<Project>) => {
        manualOperationInProgress = true
        try {
            const newProject: Project = {
                id: crypto.randomUUID(), // Use standard UUID
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
            _rawProjects.value.push(newProject)
            await saveProject(newProject)
            return newProject
        } finally {
            manualOperationInProgress = false
        }
    }

    const updateProject = async (projectId: string, updates: Partial<Project>) => {
        const projectIndex = _rawProjects.value.findIndex(p => p.id === projectId)
        if (projectIndex !== -1) {
            manualOperationInProgress = true
            try {
                _rawProjects.value[projectIndex] = {
                    ..._rawProjects.value[projectIndex],
                    ...updates,
                    updatedAt: new Date()
                }
                await saveProject(_rawProjects.value[projectIndex])
            } finally {
                manualOperationInProgress = false
            }
        }
    }

    const deleteProject = async (projectId: string) => {
        const projectIndex = _rawProjects.value.findIndex(p => p.id === projectId)
        if (projectIndex !== -1) {
            manualOperationInProgress = true
            try {
                const projectToDelete = _rawProjects.value[projectIndex]
                const parentId = projectToDelete.parentId

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { useTaskStore } = await import('./tasks')
                const taskStore = useTaskStore() as any
                // SAFETY: Use _rawTasks to include soft-deleted tasks in project reassignment
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                taskStore._rawTasks.forEach((task: any) => {
                    if (task.projectId === projectId) {
                        taskStore.updateTask(task.id, {
                            projectId: 'uncategorized',
                            isUncategorized: true
                        })
                    }
                })

                // SAFETY: Use _rawProjects for mutation
                _rawProjects.value.forEach(project => {
                    if (project.parentId === projectId) {
                        project.parentId = parentId
                    }
                })

                _rawProjects.value.splice(projectIndex, 1)

                // Supabase Soft Delete
                await deleteProjectRemote(projectId)

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
            const { useTaskStore } = await import('./tasks')
            const taskStore = useTaskStore() as any
            const projectIdSet = new Set(projectIds)

            // Build parent mapping for re-parenting children
            // SAFETY: Use _rawProjects for lookup
            const parentMap = new Map<string, string | null>()
            projectIds.forEach(id => {
                const project = _rawProjects.value.find(p => p.id === id)
                if (project) {
                    parentMap.set(id, project.parentId || null)
                }
            })

            // Move tasks from all deleted projects to uncategorized
            // SAFETY: Use _rawTasks to include soft-deleted tasks in project reassignment
            taskStore._rawTasks.forEach((task: any) => {
                if (projectIdSet.has(task.projectId)) {
                    taskStore.updateTask(task.id, {
                        projectId: 'uncategorized',
                        isUncategorized: true
                    })
                }
            })

            // Re-parent children of deleted projects
            // SAFETY: Use _rawProjects for mutation
            _rawProjects.value.forEach(project => {
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
            _rawProjects.value = _rawProjects.value.filter(p => !projectIdSet.has(p.id))

            // Supabase Bulk Delete
            for (const id of projectIds) {
                await deleteProjectRemote(id)
            }

        } finally {
            manualOperationInProgress = false
        }
    }

    const setProjectColor = async (projectId: string, color: string, colorType: 'hex' | 'emoji', emoji?: string) => {
        // SAFETY: Use _rawProjects for mutation
        const project = _rawProjects.value.find(p => p.id === projectId)
        if (project) {
            manualOperationInProgress = true
            try {
                project.color = color
                project.colorType = colorType
                project.emoji = colorType === 'emoji' ? emoji : undefined
                await saveProjectsToStorage(_rawProjects.value, `setProjectColor-${projectId}`)
            } finally {
                manualOperationInProgress = false
            }
        }
    }

    const setProjectViewType = async (projectId: string, viewType: Project['viewType']) => {
        // SAFETY: Use _rawProjects for mutation
        const project = _rawProjects.value.find(p => p.id === projectId)
        if (project) {
            project.viewType = viewType
            await saveProjectsToStorage(_rawProjects.value, `setProjectViewType-${projectId}`)
        }
    }

    // moveTaskToProject MOVED to taskOperations.ts to break circular dependency
    // (tasks -> projects -> tasks)

    const getProjectById = (projectId: string | null | undefined): Project | undefined => {
        if (!projectId) return undefined
        // Optimized O(1) lookup
        return projectMap.value.get(projectId)
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

    // Flag to prevent auto-save after sync updates (breaks circular loop)
    let syncUpdateInProgress = false

    const updateProjectFromSync = (projectId: string, data: any) => {
        // SAFETY: Validate incoming data to prevent corrupted projects
        if (!data || typeof data !== 'object') {
            console.warn(`[PROJECT-SYNC] Ignoring invalid data for project ${projectId}:`, data)
            return
        }

        // CRITICAL: Ensure name is present and valid
        if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
            console.warn(`[PROJECT-SYNC] Ignoring project update with invalid name for ${projectId}:`, data.name)
            return
        }

        // Set flag to prevent watcher from triggering auto-save
        syncUpdateInProgress = true

        try {
            const index = _rawProjects.value.findIndex(p => p.id === projectId)
            const normalized = {
                id: projectId,
                name: data.name,
                color: data.color || '#4ECDC4',
                colorType: data.colorType || 'hex',
                emoji: data.emoji,
                viewType: data.viewType || 'status',
                parentId: data.parentId || null,
                createdAt: new Date(data.createdAt || Date.now()),
                updatedAt: new Date(data.updatedAt || Date.now())
            }

            if (index !== -1) {
                // Merge with existing data to preserve fields not in sync payload
                _rawProjects.value[index] = {
                    ..._rawProjects.value[index],
                    ...normalized
                }
            } else {
                _rawProjects.value.push(normalized)
            }
        } finally {
            // Reset flag after Vue's next tick to ensure watcher sees it
            setTimeout(() => {
                syncUpdateInProgress = false
            }, 100)
        }
    }

    const removeProjectFromSync = (projectId: string) => {
        // SAFETY: Use _rawProjects for sync mutations
        const index = _rawProjects.value.findIndex(p => p.id === projectId)
        if (index !== -1) {
            _rawProjects.value.splice(index, 1)
        }
    }

    const initializeFromDatabase = async () => {
        await loadProjectsFromDatabase()
        return projects.value.length > 0
    }

    /**
     * Removes corrupted projects (missing name, invalid data) from local state
     * Call this if you see ghost/empty projects in the sidebar
     */
    const cleanupCorruptedProjects = () => {
        const before = _rawProjects.value.length
        _rawProjects.value = _rawProjects.value.filter(p => {
            if (!p.id) {
                console.log(`[PROJECT-CLEANUP] Removing project with no id`)
                return false
            }
            if (!p.name || typeof p.name !== 'string' || p.name.trim() === '') {
                console.log(`[PROJECT-CLEANUP] Removing project with invalid name:`, p.id)
                return false
            }
            return true
        })
        const removed = before - _rawProjects.value.length
        console.log(`[PROJECT-CLEANUP] Removed ${removed} corrupted projects`)
        return removed
    }

    // Watchers
    let saveTimeout: ReturnType<typeof setTimeout> | null = null
    watch(projects, (newProjects) => {
        // CRITICAL: Prevent circular sync loop
        // - manualOperationInProgress: Direct CRUD operations (already saving)
        // - isLoading: Loading from database (don't save during load)
        // - syncUpdateInProgress: Realtime update just happened (don't echo back)
        if (manualOperationInProgress || isLoading.value || syncUpdateInProgress) {
            return
        }
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(() => {
            saveProjectsToStorage([...newProjects], 'auto-save')
        }, 1000)
    }, { deep: true })

    return {
        // SAFETY: Export filtered projects as 'projects' - this is the safe default for components
        // Use _rawProjects only for internal operations (load, save, sync, mutations)
        projects,
        _rawProjects,
        activeProjectId,
        isLoading,
        rootProjects,
        loadProjectsFromDatabase,
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
        // moveTaskToProject, // Removed: Moved to taskOperations.ts
        initializeFromDatabase,
        updateProjectFromSync,
        removeProjectFromSync,
        cleanupCorruptedProjects
    }
})
