import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import { useTaskStore, type Task } from '../tasks'
import {
    isSmartGroup,
    getSmartGroupType,
    getSmartGroupDate,
    detectPowerKeyword,
    isPowerGroup,
    type SmartGroupType,
    type PowerKeywordResult
} from '@/composables/useTaskSmartGroups'
import { useSmartViews } from '@/composables/useSmartViews'
import { resolveDueDate } from '@/composables/useGroupSettings'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import { STORAGE_FLAGS } from '@/config/database'
import {
    saveSections as saveIndividualSections,
    loadAllSections as loadIndividualSections,
    deleteSection as deleteIndividualSection,
    migrateFromLegacyFormat as migrateSectionsFromLegacy
} from '@/utils/individualSectionStorage'
import type { CanvasGroup, CanvasSection, TaskPosition, AssignOnDropSettings, CollectFilterSettings } from './types'
import type { Node, Edge } from '@vue-flow/core'

/**
 * Core Data Store for Canvas
 * Manages Groups, Nodes, Edges and persistence.
 */
export const useCanvasDataStore = defineStore('canvasData', () => {
    const db = useDatabase()

    // --- State ---
    const groups = ref<CanvasGroup[]>([])
    const nodes = ref<Node[]>([])
    const edges = ref<Edge[]>([])
    const isDataLoading = ref(false)
    const isFirstLoadComplete = ref(false)
    const collapsedTaskPositions = ref(new Map<string, TaskPosition[]>())

    const isGroupPinned = computed(() => (id: string) => groups.value.find(g => g.id === id)?.isPinned || false)

    // --- Actions ---

    const setNodes = (newNodes: Node[]) => {
        nodes.value = newNodes
    }

    const setEdges = (newEdges: Edge[]) => {
        edges.value = newEdges
    }

    // Group Management
    const createGroup = (group: Omit<CanvasGroup, 'id'>): CanvasGroup => {
        const id = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newGroup = { ...group, id } as CanvasGroup
        groups.value.push(newGroup)
        return newGroup
    }

    const updateGroup = (id: string, updates: Partial<CanvasGroup>) => {
        const index = groups.value.findIndex(g => g.id === id)
        if (index !== -1) {
            groups.value[index] = { ...groups.value[index], ...updates }
        }
    }

    const deleteGroup = async (id: string) => {
        const index = groups.value.findIndex(g => g.id === id)
        if (index !== -1) {
            groups.value.splice(index, 1)
            if (STORAGE_FLAGS.DUAL_WRITE_SECTIONS || STORAGE_FLAGS.INDIVIDUAL_SECTIONS_ONLY) {
                const dbInstance = db.database.value
                if (!dbInstance) {
                    isDataLoading.value = false
                    return
                }
                await deleteIndividualSection(dbInstance as any, id)
            }
        }
    }

    const getTasksInGroup = (group: CanvasGroup, allTasks: Task[]): Task[] => {
        return allTasks.filter(task => {
            if (group.type === 'custom') {
                return (group as any).taskIds?.includes(task.id) || false
            }
            return taskMatchesSection(task, group as any)
        })
    }

    const getTasksInGroupBounds = (group: CanvasGroup, allTasks: Task[]): Task[] => {
        const { x, y, width, height } = group.position
        return allTasks.filter(task => {
            if (!task.canvasPosition) return false
            return (
                task.canvasPosition.x >= x &&
                task.canvasPosition.x <= x + width &&
                task.canvasPosition.y >= y &&
                task.canvasPosition.y <= y + height
            )
        })
    }

    const toggleGroupCollapse = (id: string, allTasks: Task[] = []) => {
        const group = groups.value.find(g => g.id === id)
        if (!group) return
        const gTasks = getTasksInGroupBounds(group, allTasks)
        if (group.isCollapsed) {
            const saved = collapsedTaskPositions.value.get(id)
            if (saved) {
                saved.forEach(s => {
                    const t = allTasks.find(x => x.id === s.id)
                    if (t && t.canvasPosition) t.canvasPosition = { ...s.position }
                })
                collapsedTaskPositions.value.delete(id)
            }
            if (group.collapsedHeight) {
                group.position.height = group.collapsedHeight
                group.collapsedHeight = undefined
            }
            group.isCollapsed = false
        } else {
            const pos = gTasks.filter(t => !!t.canvasPosition).map(t => ({
                id: t.id,
                position: { ...t.canvasPosition! },
                relativePosition: { x: t.canvasPosition!.x - group.position.x, y: t.canvasPosition!.y - group.position.y }
            }))
            group.collapsedHeight = group.position.height
            collapsedTaskPositions.value.set(id, pos)
            group.isCollapsed = true
        }
    }

    const toggleGroupVisibility = (id: string) => {
        const g = groups.value.find(x => x.id === id)
        if (g) g.isVisible = !g.isVisible
    }

    const toggleAutoCollect = (groupId: string) => {
        const group = groups.value.find(g => g.id === groupId)
        if (group) group.autoCollect = !group.autoCollect
    }

    const taskMatchesSection = (task: Task, section: CanvasSection): boolean => {
        if (!section.type || section.type === 'custom') {
            if (section.name.includes('(T)') || section.name.includes('Timeline')) {
                return (task as any).dueDate === section.propertyValue || task.title.includes(String(section.propertyValue))
            }
            return false
        }

        switch (section.type) {
            case 'priority':
                return task.priority === section.propertyValue
            case 'status':
                return task.status === section.propertyValue
            case 'project':
                return task.projectId === section.propertyValue
            default:
                return false
        }
    }

    const collectTasksIntoGroup = (groupId: string) => {
        const group = groups.value.find(g => g.id === groupId)
        if (!group) return

        const taskStore = useTaskStore()
        const allTasks = taskStore.tasks

        const inboxTasks = allTasks.filter((t: Task) => !t.canvasPosition && t.status !== 'done')
        const matchingTasks = inboxTasks.filter((task: Task) => taskMatchesSection(task, group as any))

        if (matchingTasks.length === 0) return

        matchingTasks.forEach((task: Task, index: number) => {
            const { x, y } = group.position
            const col = index % 3
            const row = Math.floor(index / 3)
            const newX = x + 20 + (col * 220)
            const newY = y + 60 + (row * 120)

            taskStore.updateTask(task.id, {
                canvasPosition: { x: newX, y: newY },
                isInInbox: false
            })
        })
    }

    // --- Magnetic Snap & Layout ---

    const getMagneticSnapPosition = (point: { x: number; y: number }, threshold: number = 20): { x: number; y: number } | null => {
        let bestPos = null
        let minOffset = threshold

        for (const g of groups.value) {
            if (!g.isVisible) continue
            // Left edge
            if (Math.abs(point.x - g.position.x) < minOffset) {
                bestPos = { ...point, x: g.position.x }
                minOffset = Math.abs(point.x - g.position.x)
            }
            // Right edge
            if (Math.abs(point.x - (g.position.x + g.position.width)) < minOffset) {
                bestPos = { ...point, x: g.position.x + g.position.width }
                minOffset = Math.abs(point.x - (g.position.x + g.position.width))
            }
            // Top edge
            if (Math.abs(point.y - g.position.y) < minOffset) {
                bestPos = { ...point, y: g.position.y }
                minOffset = Math.abs(point.y - g.position.y)
            }
            // Bottom edge
            if (Math.abs(point.y - (g.position.y + g.position.height)) < minOffset) {
                bestPos = { ...point, y: g.position.y + g.position.height }
                minOffset = Math.abs(point.y - (g.position.y + g.position.height))
            }
        }
        return bestPos
    }

    const getTaskCountInGroupRecursive = (groupId: string, tasks: Task[]): number => {
        const group = groups.value.find(g => g.id === groupId)
        if (!group) return 0
        let count = getTasksInGroupBounds(group, tasks).length
        const children = getChildGroups(groupId)
        for (const child of children) {
            count += getTaskCountInGroupRecursive(child.id, tasks)
        }
        return count
    }

    const getChildGroups = (groupId: string): CanvasGroup[] => {
        return groups.value.filter(g => (g as any).parentGroupId === groupId)
    }

    // --- Power Groups ---

    const togglePowerMode = (groupId: string) => {
        const group = groups.value.find(g => g.id === groupId)
        if (group) {
            if (isPowerGroup(group.name)) {
                group.name = group.name.replace(' (Power Group)', '')
            } else {
                group.name = `${group.name} (Power Group)`
            }
        }
    }

    const getMatchingTasksForPowerGroup = (groupId: string, tasks: Task[]): Task[] => {
        const group = groups.value.find(g => g.id === groupId)
        if (!group || !isPowerGroup(group.name)) return []
        return tasks.filter(task => taskMatchesSection(task, group as any))
    }

    const getMatchingTaskCount = (groupId: string, tasks: Task[]): number => {
        return getMatchingTasksForPowerGroup(groupId, tasks).length
    }

    const collectMatchingTasks = (groupId: string) => {
        const group = groups.value.find(g => g.id === groupId)
        if (!group) return
        collectTasksIntoGroup(groupId)
    }

    const getPowerGroupUpdates = (groupId: string, tasks: Task[]): Partial<Task>[] => {
        const group = groups.value.find(g => g.id === groupId)
        if (!group || !isPowerGroup(group.name)) return []
        // Simple implementation: return updates that would make tasks match
        return [] // Placeholder
    }

    const restoreGroups = (savedGroups: CanvasGroup[]) => {
        groups.value = savedGroups
    }

    const syncTasksToCanvas = (tasks: Task[]) => {
        // Logic to ensure tasks on canvas have correct properties based on their positions
        // This is complex, returning placeholder
    }

    // --- Preset creators ---

    const createPriorityGroup = (priority: 'high' | 'medium' | 'low', position: { x: number; y: number }) => {
        const colors = { high: '#ef4444', medium: '#f59e0b', low: '#6366f1' }
        const names = { high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority' }
        return createGroup({ name: names[priority], type: 'priority', propertyValue: priority, position: { ...position, width: 300, height: 250 }, color: colors[priority], layout: 'grid', isVisible: true, isCollapsed: false })
    }

    const createStatusGroup = (status: 'planned' | 'in_progress' | 'done' | 'backlog', position: { x: number; y: number }) => {
        const colors = { planned: '#6366f1', in_progress: '#f59e0b', done: '#10b981', backlog: '#64748b' }
        const names = { planned: 'Planned', in_progress: 'In Progress', done: 'Done', backlog: 'Backlog' }
        return createGroup({ name: names[status], type: 'status', propertyValue: status, position: { ...position, width: 300, height: 250 }, color: colors[status], layout: 'grid', isVisible: true, isCollapsed: false })
    }

    const createProjectGroup = (projectId: string, projectName: string, color: string, position: { x: number; y: number }) => {
        return createGroup({ name: projectName, type: 'project', propertyValue: projectId, position: { ...position, width: 300, height: 250 }, color: color, layout: 'grid', isVisible: true, isCollapsed: false })
    }

    const createCustomGroup = (name: string, color: string, position: { x: number; y: number }, width: number = 300, height: number = 200) => {
        return createGroup({ name, type: 'custom', position: { x: position.x, y: position.y, width, height }, color, layout: 'grid', isVisible: true, isCollapsed: false })
    }

    // --- Persistence & Initialization ---
    let groupsSaveTimer: any = null
    watch(groups, (newGroups) => {
        if (groupsSaveTimer) clearTimeout(groupsSaveTimer)
        groupsSaveTimer = setTimeout(async () => {
            const dbInstance = db.database.value
            if (!dbInstance) return
            try {
                if (STORAGE_FLAGS.DUAL_WRITE_SECTIONS || STORAGE_FLAGS.INDIVIDUAL_SECTIONS_ONLY) {
                    await saveIndividualSections(dbInstance as any, newGroups)
                }
            } catch (error) {
                console.error('❌ Canvas auto-save failed:', error)
            }
        }, 1000)
    }, { deep: true, flush: 'post' })

    const loadFromDatabase = async () => {
        if (isDataLoading.value) return
        isDataLoading.value = true
        try {
            const dbInstance = db.database.value
            if (!dbInstance) {
                isFirstLoadComplete.value = true
                isDataLoading.value = false
                return
            }

            let savedGroups: CanvasGroup[] | null = null
            if (STORAGE_FLAGS.INDIVIDUAL_SECTIONS_ONLY) {
                savedGroups = await loadIndividualSections(dbInstance as any)
            }

            if (savedGroups && savedGroups.length > 0) {
                groups.value = savedGroups
            } else {
                await migrateSectionsFromLegacy(dbInstance as any)
                const migrated = await loadIndividualSections(dbInstance as any)
                if (migrated && migrated.length > 0) {
                    groups.value = migrated
                }
            }
        } finally {
            isFirstLoadComplete.value = true
            isDataLoading.value = false
        }
    }

    const initializeDefaultGroups = async () => {
        if (groups.value.length > 0) return
        createStatusGroup('planned', { x: 0, y: 0 })
        createStatusGroup('in_progress', { x: 350, y: 0 })
        createStatusGroup('done', { x: 700, y: 0 })
    }

    const calculateContentBounds = (allNodes: Node[]) => {
        if (allNodes.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        allNodes.forEach((node: Node) => {
            const { x, y } = node.position
            const width = (node as any).dimensions?.width || 200
            const height = (node as any).dimensions?.height || 100
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x + width)
            maxY = Math.max(maxY, y + height)
        })
        return { minX, minY, maxX, maxY }
    }

    const calculateDynamicMinZoom = (allNodes: Node[], viewportWidth: number, viewportHeight: number) => {
        const bounds = calculateContentBounds(allNodes)
        const contentWidth = bounds.maxX - bounds.minX
        const contentHeight = bounds.maxY - bounds.minY
        const scaleX = viewportWidth / (contentWidth + 200)
        const scaleY = viewportHeight / (contentHeight + 200)
        return Math.min(Math.max(Math.min(scaleX, scaleY), 0.05), 1.0)
    }

    const isGroupPowerEnabled = (id: string) => {
        const g = groups.value.find(x => x.id === id)
        return !!(g && isPowerGroup(g.name))
    }

    const getGroupPowerKeyword = (id: string) => {
        const g = groups.value.find(x => x.id === id)
        return g ? detectPowerKeyword(g.name) : null
    }

    const updateGroupPowerKeyword = (id: string, keyword: string) => {
        const g = groups.value.find(x => x.id === id)
        if (g) {
            g.name = `${keyword} (Power Group)`
        }
    }

    const isPointInGroup = (point: { x: number; y: number }, group: CanvasGroup) => {
        const { x, y, width, height } = group.position
        return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height
    }

    const isTaskInGroup = (task: Task, group: CanvasGroup) => {
        if (!task.canvasPosition) return false
        return isPointInGroup(task.canvasPosition, group)
    }

    const findNearestGroup = (point: { x: number; y: number }, threshold: number = 200) => {
        let nearest = null
        let minDist = threshold
        groups.value.forEach(g => {
            const centerX = g.position.x + g.position.width / 2
            const centerY = g.position.y + g.position.height / 2
            const dist = Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2))
            if (dist < minDist) {
                minDist = dist
                nearest = g
            }
        })
        return nearest
    }

    const updateSectionFromSync = (id: string, data: any) => {
        const index = groups.value.findIndex(g => g.id === id)
        if (index !== -1) {
            groups.value[index] = { ...data }
        } else {
            groups.value.push({ ...data })
        }
    }

    const removeSectionFromSync = (id: string) => {
        const index = groups.value.findIndex(g => g.id === id)
        if (index !== -1) {
            groups.value.splice(index, 1)
        }
    }

    return {
        groups,
        nodes,
        edges,
        isDataLoading,
        isFirstLoadComplete,
        collapsedTaskPositions,
        isGroupPinned,
        setNodes,
        setEdges,
        createGroup,
        updateGroup,
        deleteGroup,
        getTasksInGroup,
        getTasksInGroupBounds,
        toggleGroupCollapse,
        toggleGroupVisibility,
        toggleAutoCollect,
        taskMatchesSection,
        collectTasksIntoGroup,
        getMagneticSnapPosition,
        getTaskCountInGroupRecursive,
        getChildGroups,
        togglePowerMode,
        getMatchingTasksForPowerGroup,
        getMatchingTaskCount,
        collectMatchingTasks,
        getPowerGroupUpdates,
        restoreGroups,
        syncTasksToCanvas,
        createPriorityGroup,
        createStatusGroup,
        createProjectGroup,
        createCustomGroup,
        loadFromDatabase,
        initializeDefaultGroups,
        calculateContentBounds,
        calculateDynamicMinZoom,
        isGroupPowerEnabled,
        getGroupPowerKeyword,
        updateGroupPowerKeyword,
        isPointInGroup,
        isTaskInGroup,
        findNearestGroup,
        updateSectionFromSync,
        removeSectionFromSync
    }
})
