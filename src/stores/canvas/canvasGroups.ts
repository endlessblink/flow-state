import { ref, computed } from 'vue'
import type { CanvasGroup } from '@/types/canvas'
import {
    applySmartGroupNormalizations,
    logGroupIdHistogram,
    getAllDescendantGroupIds
} from '@/utils/canvas/storeHelpers'
import type { Task } from '@/types/tasks'
import { getGroupAbsolutePosition } from '@/utils/canvas/coordinates'
import { type ContainerBounds, isNodeCompletelyInside } from '@/utils/canvas/spatialContainment'

export const useCanvasGroups = (
    persistence: {
        saveGroupToStorage: (group: CanvasGroup) => Promise<void>
        saveGroupsToLocalStorage: (groups: CanvasGroup[]) => void
        deleteGroupRemote: (id: string) => Promise<void>
    },
    // TASK-1158: Changed from mutable ref to computed ref (via bridge)
    taskStoreRef: { readonly value: { tasks: Task[] } | null }
) => {
    const _rawGroups = ref<CanvasGroup[]>([])
    const activeGroupId = ref<string | null>(null)
    const taskParentVersion = ref(0)
    const syncTrigger = ref(0)
    const activeSectionId = ref<string | null>(null)

    const visibleGroups = computed(() => {
        const result = _rawGroups.value.filter(g => g.isVisible !== false)
        logGroupIdHistogram('visibleGroups', result)
        return result
    })

    const sections = computed(() => _rawGroups.value)

    const bumpTaskParentVersion = () => {
        taskParentVersion.value++
    }

    const setGroups = (newGroups: CanvasGroup[]) => {
        if (newGroups.length === 0 && _rawGroups.value.length > 0) {
            console.error('❌ [CANVAS] Refusing to overwrite existing groups with empty array')
            return
        }
        _rawGroups.value = [...newGroups]
    }

    const createGroup = async (groupData: Omit<CanvasGroup, 'id'>) => {
        applySmartGroupNormalizations(groupData)
        const newGroup: CanvasGroup = {
            ...groupData,
            id: crypto.randomUUID(), // TASK-1183: Use proper UUID for Supabase compatibility
            isVisible: true,
            isCollapsed: false,
            // BUG-1127 FIX: Preserve parentGroupId for nested groups
            parentGroupId: groupData.parentGroupId || null,
            positionVersion: 1,
            positionFormat: 'absolute'
        }
        _rawGroups.value.push(newGroup)
        await persistence.saveGroupToStorage(newGroup)
        return newGroup
    }

    const updateGroup = async (id: string, updates: Partial<CanvasGroup>) => {
        const index = _rawGroups.value.findIndex(g => g.id === id)
        if (index !== -1) {
            const group = _rawGroups.value[index]

            if (import.meta.env.DEV) {
                if ('parentGroupId' in updates && updates.parentGroupId !== group.parentGroupId) {
                    console.log(`📍[GROUP-PARENT-WRITE] Group ${id.slice(0, 8)}... (${group.name}) parentGroupId: "${group.parentGroupId ?? 'none'}" → "${updates.parentGroupId ?? 'none'}"`)
                }

                // DRIFT LOGGING: Track ALL position writes
                if ('position' in updates && updates.position) {
                    const oldPos = group.position
                    const newPos = updates.position
                    if (oldPos?.x !== newPos?.x || oldPos?.y !== newPos?.y) {
                        console.log(`📍[GROUP-POS-WRITE] Group "${group.name?.slice(0, 20)}" (${id.slice(0, 8)})`, {
                            before: oldPos ? { x: Math.round(oldPos.x), y: Math.round(oldPos.y) } : null,
                            after: { x: Math.round(newPos.x), y: Math.round(newPos.y) },
                            stack: new Error().stack?.split('\n').slice(2, 6).join(' <- ')
                        })
                    }
                }
            }

            if (updates.name) {
                applySmartGroupNormalizations(updates)
            }

            const currentVersion = group.positionVersion || 0
            const newVersion = updates.position ? currentVersion + 1 : currentVersion

            _rawGroups.value[index] = {
                ...group,
                ...updates,
                positionVersion: newVersion,
                updatedAt: new Date().toISOString()
            }
            await persistence.saveGroupToStorage(_rawGroups.value[index])
        }
    }

    const deleteGroup = async (id: string) => {
        const index = _rawGroups.value.findIndex(g => g.id === id)
        if (index !== -1) {
            _rawGroups.value.splice(index, 1)
            if (activeSectionId.value === id) {
                activeSectionId.value = null
            }
            persistence.saveGroupsToLocalStorage(_rawGroups.value)
            await persistence.deleteGroupRemote(id)
        }
    }

    const patchGroups = (updates: Map<string, Partial<CanvasGroup>>) => {
        const result = { patched: [] as string[], skippedLocked: [] as string[], notFound: [] as string[] }
        for (const [groupId, changes] of updates) {
            const group = _rawGroups.value.find(g => g.id === groupId)
            if (!group) {
                result.notFound.push(groupId)
                continue
            }
            Object.assign(group, changes, { updatedAt: new Date().toISOString() })
            result.patched.push(groupId)
        }
        if (result.patched.length > 0) {
            persistence.saveGroupsToLocalStorage(_rawGroups.value)
        }
        return result
    }

    const isTaskDone = (task: Task): boolean => task.status === 'done'

    const taskCountByGroupId = computed(() => {
        const counts = new Map<string, number>()
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _version = taskParentVersion.value

        if (!taskStoreRef.value || !taskStoreRef.value.tasks) return counts

        const tasks = taskStoreRef.value.tasks
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _taskCountTotal = tasks.length

        for (const task of tasks) {
            if (task._soft_deleted || isTaskDone(task)) continue
            if (task.parentId) {
                counts.set(task.parentId, (counts.get(task.parentId) ?? 0) + 1)
            }
        }
        return counts
    })

    const aggregatedTaskCountByGroupId = computed(() => {
        const aggregatedCounts = new Map<string, number>()
        const groups = _rawGroups.value
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _version = taskParentVersion.value

        if (!taskStoreRef.value || !taskStoreRef.value.tasks) return aggregatedCounts
        const directCounts = taskCountByGroupId.value

        for (const group of groups) {
            const descendantIds = getAllDescendantGroupIds(group.id, groups)
            let total = 0
            for (const gid of descendantIds) {
                total += directCounts.get(gid) ?? 0
            }
            aggregatedCounts.set(group.id, total)
        }
        return aggregatedCounts
    })

    const getTasksInSection = (groupId: string, tasks?: Task[]): Task[] => {
        const sourceTasks = tasks || (taskStoreRef.value?.tasks || [])
        const group = _rawGroups.value.find(g => g.id === groupId)
        if (!group) return []

        const groupAbsolutePos = getGroupAbsolutePosition(groupId, _rawGroups.value)
        const containerBounds: ContainerBounds = {
            position: groupAbsolutePos,
            width: group.position.width,
            height: group.position.height
        }

        return sourceTasks.filter((t: Task) => {
            if (t.canvasPosition) {
                return isNodeCompletelyInside({ position: t.canvasPosition }, containerBounds)
            }
            return false
        })
    }

    // Flag to prevent auto-save after sync updates (breaks circular loop)
    let syncUpdateInProgress = false

    // BUG-1207 Fix 4.1: Pending group writes tracking (mirrors task pattern)
    const pendingGroupWrites = new Set<string>()

    const addPendingGroupWrite = (groupId: string) => {
        pendingGroupWrites.add(groupId)
    }

    const removePendingGroupWrite = (groupId: string) => {
        pendingGroupWrites.delete(groupId)
    }

    const updateGroupFromSync = (groupId: string, data: Partial<CanvasGroup>) => {
        // SAFETY: Validate incoming data to prevent corrupted groups
        if (!data || typeof data !== 'object') {
            console.warn(`[GROUP-SYNC] Ignoring invalid data for group ${groupId}:`, data)
            return
        }

        // BUG-1207 Fix 4.1: Skip sync if local write is pending (prevents overwriting user's drag)
        if (pendingGroupWrites.has(groupId)) {
            if (import.meta.env.DEV) {
                console.log(`[GROUP-SYNC] Skipping sync for group ${groupId.slice(0, 8)}... - pending local write`)
            }
            return
        }

        // Set flag to prevent watcher from triggering auto-save
        syncUpdateInProgress = true

        try {
            const index = _rawGroups.value.findIndex(g => g.id === groupId)

            if (index !== -1) {
                const existing = _rawGroups.value[index]

                // BUG-1207 Fix 4.1: Version/timestamp checks - prefer newer data
                const incomingVersion = data.positionVersion ?? 0
                const localVersion = existing.positionVersion ?? 0

                if (incomingVersion > 0 && localVersion > incomingVersion) {
                    if (import.meta.env.DEV) {
                        console.log(`[GROUP-SYNC] Skipping older version for group ${groupId.slice(0, 8)}... (local v${localVersion} > incoming v${incomingVersion})`)
                    }
                    return
                }

                // If versions are equal, compare timestamps
                if (incomingVersion === localVersion && existing.updatedAt && data.updatedAt) {
                    const localTime = new Date(existing.updatedAt).getTime()
                    const incomingTime = new Date(data.updatedAt).getTime()
                    if (localTime > incomingTime) {
                        if (import.meta.env.DEV) {
                            console.log(`[GROUP-SYNC] Skipping older timestamp for group ${groupId.slice(0, 8)}... (local newer by ${localTime - incomingTime}ms)`)
                        }
                        return
                    }
                }

                // Update existing group (don't trigger saveGroupToStorage)
                _rawGroups.value[index] = {
                    ...existing,
                    ...data,
                    id: groupId, // Ensure ID is preserved
                    updatedAt: data.updatedAt || new Date().toISOString()
                }
            } else {
                // Add new group from remote - use defaults matching createGroup
                const newGroup: CanvasGroup = {
                    // Apply data first
                    ...data,
                    // Then apply required fields (override if missing)
                    id: groupId,
                    name: data.name || 'Untitled Group',
                    type: data.type || 'custom',
                    position: data.position || { x: 0, y: 0, width: 400, height: 300 },
                    color: data.color || '#3b82f6',
                    layout: data.layout || 'freeform',
                    isVisible: data.isVisible !== false,
                    isCollapsed: data.isCollapsed || false,
                    parentGroupId: data.parentGroupId || null,
                    positionVersion: data.positionVersion || 1,
                    positionFormat: data.positionFormat || 'absolute',
                    updatedAt: data.updatedAt || new Date().toISOString()
                }
                _rawGroups.value.push(newGroup)
            }

            // Update localStorage backup
            persistence.saveGroupsToLocalStorage(_rawGroups.value)
        } finally {
            // Reset flag after Vue's next tick to ensure watcher sees it
            setTimeout(() => {
                syncUpdateInProgress = false
            }, 100)
        }
    }

    const removeGroupFromSync = (groupId: string) => {
        // SAFETY: Use _rawGroups for sync mutations
        const index = _rawGroups.value.findIndex(g => g.id === groupId)
        if (index !== -1) {
            _rawGroups.value.splice(index, 1)
            if (activeSectionId.value === groupId) {
                activeSectionId.value = null
            }
            persistence.saveGroupsToLocalStorage(_rawGroups.value)
        }
    }

    return {
        _rawGroups,
        activeGroupId,
        taskParentVersion,
        syncTrigger,
        activeSectionId,
        visibleGroups,
        sections,
        bumpTaskParentVersion,
        setGroups,
        createGroup,
        updateGroup,
        deleteGroup,
        patchGroups,
        taskCountByGroupId,
        aggregatedTaskCountByGroupId,
        getTasksInSection,
        updateGroupFromSync,
        removeGroupFromSync,
        addPendingGroupWrite,
        removePendingGroupWrite
    }
}
