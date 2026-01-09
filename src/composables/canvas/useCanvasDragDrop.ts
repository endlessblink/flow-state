import { type Ref, type ComputedRef, ref, nextTick } from 'vue'
import { type Node } from '@vue-flow/core'
import type { useTaskStore } from '../../stores/tasks';
import { type Task } from '../../stores/tasks'
import type { useCanvasStore } from '../../stores/canvas';
import { type CanvasSection } from '../../stores/canvas'
import { shouldUseSmartGroupLogic, getSmartGroupType, detectPowerKeyword } from '../useTaskSmartGroups'
import { resolveDueDate } from '../useGroupSettings'
import { formatDateKey } from '../../utils/dateUtils'
// TASK-089: Updated to use unified canvas state lock system
// TASK-089: Updated to use unified canvas state lock system
import { lockTaskPosition, lockGroupPosition } from '../../utils/canvasStateLock'
// TASK-144: Use shared geometry utilities
import {
    getTaskCenter,
    isTaskCenterInRect,
    findSmallestContainingRect,
    findAllContainingRects,
    isNodeMoreThanHalfInside
} from '../../utils/geometry'
import type { Rect } from '../../utils/geometry'
import { getAbsoluteNodePosition } from '../../utils/canvasGraph'
// TASK-144: Use centralized duration defaults
import { DURATION_DEFAULTS, type DurationCategory } from '../../utils/durationCategories'
// TASK-151: Use centralized parent-child logic
import { useCanvasParentChild } from './useCanvasParentChild'
import { useNodeAttachment } from './useNodeAttachment'
import { useVueFlow } from '@vue-flow/core'

interface DragDropDeps {
    taskStore: ReturnType<typeof useTaskStore>
    canvasStore: ReturnType<typeof useCanvasStore>
    nodes: Ref<Node[]>
    filteredTasks: ComputedRef<Task[]>
    withVueFlowErrorBoundary: (handlerName: string, handler: (...args: any[]) => any, options?: any) => any
    syncNodes: () => void
    // BUG-152 FIX: setNodes forces Vue Flow to reinitialize parent-child relationships
    setNodes?: (nodes: Node[]) => void
    // Vue Flow's official API for updating node data reactively (kept for backward compatibility)
    updateNodeData?: (nodeId: string, data: Record<string, unknown>) => void
}

interface DragDropState {
    isNodeDragging: Ref<boolean>
    // TASK-072 FIX: Settling period to prevent syncNodes from resetting positions after drag
    // This should be checked in batchedSyncNodes() guard
    // Optional: composable creates its own ref if not provided
    isDragSettling?: Ref<boolean>
}

// TASK-072 FIX: Store starting positions for correct delta calculation
// For nested sections, node.position is relative to parent, so we need to track
// the starting position in the SAME coordinate system to calculate delta
const dragStartPositions = new Map<string, { x: number; y: number }>()

// TASK-072 FIX: Module-level refs for settling state
// These need to be exported so CanvasView.vue can check them in batchedSyncNodes guard
const _internalDragSettling = ref(false)
export const isDragSettlingRef = _internalDragSettling

export function useCanvasDragDrop(deps: DragDropDeps, state: DragDropState) {
    const { taskStore, canvasStore, nodes, filteredTasks, withVueFlowErrorBoundary, syncNodes, setNodes, updateNodeData: _updateNodeData } = deps
    // TASK-072: isDragSettling prevents syncNodes from running during the settling period after drag ends
    // Use provided ref or fall back to internal one (exported as isDragSettlingRef)
    const { isNodeDragging, isDragSettling = _internalDragSettling } = state

    // TASK-144: Helper functions now use shared geometry utilities from @/utils/geometry.ts

    // TASK-151 FIX: Use centralized parent-child logic
    const {
        findSmallestContainingSection,
        findAllContainingSections,
        findSectionForTask,
        getSectionAbsolutePosition // BUG-153: Need this for absolute position calculation
    } = useCanvasParentChild(nodes, canvasStore.groups)

    // Helper: Check if task center is within section bounds
    // REFACTORED: Uses isTaskCenterInRect from shared utils
    const isTaskInSectionBounds = (x: number, y: number, section: CanvasSection, taskWidth: number = 220, taskHeight: number = 100) => {
        const rect: Rect = {
            x: section.position.x,
            y: section.position.y,
            width: section.position.width,
            height: section.position.height
        }
        return isTaskCenterInRect(x, y, rect, taskWidth, taskHeight)
    }

    // LEGACY HELPERS REPLACED BY useCanvasParentChild
    // Kept aliases for compatibility if needed, but direct usage is preferred

    // Helper: Check if task is inside a section (returns first match)
    // REFACTORED: Uses findSectionForTask (Center Point Logic) for immediate snappy feel
    const getContainingSection = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
        const center = getTaskCenter(taskX, taskY, taskWidth, taskHeight)
        return findSectionForTask(center)
    }

    // Helper: Get ALL sections containing a position (for nested group inheritance)
    // REFACTORED: Uses findAllContainingSections from useCanvasParentChild
    const getAllContainingSections = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
        return findAllContainingSections({
            x: taskX,
            y: taskY,
            width: taskWidth,
            height: taskHeight
        })
    }

    // TASK-072 FIX: Recursively calculate absolute position for any nesting depth
    // REFACTORED: Uses getAbsoluteNodePosition from shared utils
    const getAbsolutePosition = (nodeId: string): { x: number, y: number } => {
        return getAbsoluteNodePosition(nodeId, nodes.value)
    }

    // BUG-047 FIX: Helper to get all ancestor group IDs for a given group
    // This is needed to update parent groups when a child's count changes
    const getAncestorGroupIds = (groupId: string, visited = new Set<string>()): string[] => {
        if (visited.has(groupId)) return [] // Prevent infinite loops
        visited.add(groupId)

        const group = canvasStore.groups.find(g => g.id === groupId)
        if (!group || !group.parentGroupId) return []

        const ancestors: string[] = [group.parentGroupId]
        ancestors.push(...getAncestorGroupIds(group.parentGroupId, visited))
        return ancestors
    }

    // BUG-047 FIX: Update a single section's task count by mutating node.data
    const updateSingleSectionCount = (sectionId: string, tasks: Task[]) => {
        const sectionNodeId = `section-${sectionId}`
        const newCount = canvasStore.getTaskCountInGroupRecursive(sectionId, tasks)

        // MUTATE the existing node.data to maintain Vue Flow reactivity
        const node = nodes.value.find(n => n.id === sectionNodeId)
        if (node && node.data) {
            node.data.taskCount = newCount
            console.log(`[BUG-047] Updated "${node.data?.name || sectionId}" taskCount: ${newCount}`)
        }
    }

    // TASK-072 FIX: Update section task counts without calling syncNodes()
    // BUG-047 FIX: Also update all ancestor groups to reflect recursive counting
    // BUG-152 FIX: Use nextTick to ensure task store updates have propagated
    //
    // CRITICAL INSIGHT from Vue Flow docs (https://github.com/bcakmakoglu/vue-flow/discussions/920):
    // "useNode returns us the node object straight from the state - since the node obj is reactive,
    //  we can MUTATE it to update our nodes' data"
    //
    // The key is to MUTATE the existing node.data, NOT replace the node object.
    // Replacing the node breaks the reference that useNode() is watching in custom components.
    const updateSectionTaskCounts = async (oldSectionId?: string, newSectionId?: string) => {
        // BUG-152 FIX: Wait for Vue reactivity to propagate task position updates
        // Without this, filteredTasks may have stale canvasPosition values
        await nextTick()
        await nextTick() // BUG-152: Extra tick for store propagation

        const tasks = filteredTasks.value || []

        // BUG-152 DEBUG: Log task positions we're using for counting
        if (newSectionId) {
            const section = canvasStore.groups.find(s => s.id === newSectionId)
            if (section) {
                console.log(`[BUG-152 COUNT DEBUG] Counting for "${section.name}":`, {
                    sectionBounds: { x: section.position.x, y: section.position.y, w: section.position.width, h: section.position.height },
                    tasksWithPositions: tasks.filter(t => t.canvasPosition).map(t => ({
                        id: t.id.substring(0, 15),
                        title: t.title?.substring(0, 15),
                        pos: t.canvasPosition
                    }))
                })
            }
        }

        // Collect all sections that need updating (including ancestors)
        const sectionsToUpdate = new Set<string>()

        // Update old section and its ancestors (if task was moved out)
        if (oldSectionId) {
            sectionsToUpdate.add(oldSectionId)
            getAncestorGroupIds(oldSectionId).forEach(id => sectionsToUpdate.add(id))
        }

        // Update new section and its ancestors (if task was moved in)
        if (newSectionId) {
            sectionsToUpdate.add(newSectionId)
            getAncestorGroupIds(newSectionId).forEach(id => sectionsToUpdate.add(id))
        }

        // BUG-047 FIX: Update all affected sections in one pass
        sectionsToUpdate.forEach(sectionId => {
            updateSingleSectionCount(sectionId, tasks)
        })

        console.log(`[BUG-152] Updated task counts for ${sectionsToUpdate.size} groups`)
    }

    // Helper: Get properties from a single section based on its name/settings
    const getSectionProperties = (section: CanvasSection): Partial<Task> => {
        const updates: Partial<Task> = {}

        // 0. TASK-130: Check for day-of-week groups first (Monday-Sunday)
        const dayOfWeekMap: Record<string, number> = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        }
        const lowerName = section.name.toLowerCase().trim()
        if (dayOfWeekMap[lowerName] !== undefined) {
            const today = new Date()
            const targetDay = dayOfWeekMap[lowerName]
            // Same formula: next occurrence, same-day → next week
            const daysUntilTarget = ((7 + targetDay - today.getDay()) % 7) || 7
            const resultDate = new Date(today)
            resultDate.setDate(today.getDate() + daysUntilTarget)
            updates.dueDate = formatDateKey(resultDate)
            return updates
        }

        // 1. Check explicit assignOnDrop settings first
        if (section.assignOnDrop) {
            const settings = section.assignOnDrop
            if (settings.priority) updates.priority = settings.priority
            if (settings.status) updates.status = settings.status
            if (settings.projectId) updates.projectId = settings.projectId
            if (settings.dueDate) {
                const resolvedDate = resolveDueDate(settings.dueDate)
                if (resolvedDate !== null) updates.dueDate = resolvedDate
            }
            return updates
        }

        // 2. Auto-detect from section name
        const keyword = detectPowerKeyword(section.name)
        if (keyword) {
            switch (keyword.category) {
                case 'date':
                    // For date keywords, compute the actual date
                    const today = new Date()
                    switch (keyword.value) {
                        case 'today':
                            updates.dueDate = formatDateKey(today)
                            break
                        case 'tomorrow': {
                            const tom = new Date(today)
                            tom.setDate(today.getDate() + 1)
                            updates.dueDate = formatDateKey(tom)
                            break
                        }
                        case 'this weekend': {
                            const sat = new Date(today)
                            sat.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7 || 7))
                            updates.dueDate = formatDateKey(sat)
                            break
                        }
                        case 'this week': {
                            const sun = new Date(today)
                            sun.setDate(today.getDate() + ((7 - today.getDay()) % 7 || 7))
                            updates.dueDate = formatDateKey(sun)
                            break
                        }
                        case 'later':
                            updates.dueDate = ''
                            break
                    }
                    break
                case 'priority':
                    updates.priority = keyword.value as 'high' | 'medium' | 'low'
                    break
                case 'status':
                    updates.status = keyword.value as Task['status']
                    break
                case 'duration':
                    // TASK-144: Use centralized duration defaults
                    updates.estimatedDuration = DURATION_DEFAULTS[keyword.value as DurationCategory] ?? 0
                    break
            }
            return updates
        }

        // 3. Legacy fallback - check section type
        if (section.type === 'priority' && section.propertyValue) {
            updates.priority = section.propertyValue as 'high' | 'medium' | 'low'
        } else if (section.type === 'status' && section.propertyValue) {
            updates.status = section.propertyValue as Task['status']
        } else if (section.type === 'project' && section.propertyValue) {
            updates.projectId = section.propertyValue
        }

        return updates
    }

    // Helper: Apply properties from ALL containing sections (nested group inheritance)
    const applyAllNestedSectionProperties = (taskId: string, taskX: number, taskY: number) => {
        const containingSections = getAllContainingSections(taskX, taskY)
        if (containingSections.length === 0) return

        // Collect properties from all sections (largest/parent first, then children override)
        const mergedUpdates: Partial<Task> = {}
        const appliedSections: string[] = []

        for (const section of containingSections) {
            const sectionProps = getSectionProperties(section)
            if (Object.keys(sectionProps).length > 0) {
                Object.assign(mergedUpdates, sectionProps)
                appliedSections.push(section.name)
            }
        }

        if (Object.keys(mergedUpdates).length > 0) {
            console.log(`🎯 [NESTED-GROUPS] Applying properties from ${appliedSections.length} sections:`, {
                sections: appliedSections,
                mergedUpdates
            })
            taskStore.updateTaskWithUndo(taskId, mergedUpdates)
        }
    }

    // Helper: Apply section properties to task (single section - legacy)
    const applySectionPropertiesToTask = (taskId: string, section: CanvasSection) => {
        const updates: Partial<Task> = {}
        console.log(`🎯 [TASK-114] applySectionPropertiesToTask called for task ${taskId} → section "${section.name}"`)

        // 0. DAY-OF-WEEK GROUPS (Monday-Sunday)
        // TASK-130: Support all days of the week, not just Friday/Saturday
        const dayOfWeekMap: Record<string, number> = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        }
        const lowerName = section.name.toLowerCase().trim()

        if (dayOfWeekMap[lowerName] !== undefined) {
            const today = new Date()
            const targetDay = dayOfWeekMap[lowerName]

            // TASK-130 FIX: Calculate next occurrence of this day
            // If today IS the target day, we want NEXT week's occurrence (7 days ahead)
            // Formula: ((7 + target - current) % 7) || 7
            // The || 7 ensures same-day returns 7 (next week) instead of 0 (today)
            const daysUntilTarget = ((7 + targetDay - today.getDay()) % 7) || 7
            const resultDate = new Date(today)
            resultDate.setDate(today.getDate() + daysUntilTarget)

            updates.dueDate = formatDateKey(resultDate)

            if (Object.keys(updates).length > 0) {
                console.log(`📅 [DayGroup] Assigning ${lowerName} date: ${updates.dueDate} (${daysUntilTarget} days from now)`)
                taskStore.updateTaskWithUndo(taskId, updates)
                return
            }
        }

        // 1. UNIFIED APPROACH: Check for explicit assignOnDrop settings first
        if (section.assignOnDrop) {
            console.log(`🎯 [TASK-114] Path 1: Using assignOnDrop settings:`, section.assignOnDrop)
            const settings = section.assignOnDrop

            if (settings.priority) {
                updates.priority = settings.priority
            }
            if (settings.status) {
                updates.status = settings.status
            }
            if (settings.projectId) {
                updates.projectId = settings.projectId
            }
            if (settings.dueDate) {
                // Resolve smart date values like 'today', 'tomorrow' to actual dates
                const resolvedDate = resolveDueDate(settings.dueDate)
                if (resolvedDate !== null) {
                    updates.dueDate = resolvedDate
                }
            }

            if (Object.keys(updates).length > 0) {
                taskStore.updateTaskWithUndo(taskId, updates)
                return
            }
        }

        // 2. AUTO-DETECT: If no assignOnDrop settings, try keyword detection on section name
        const keyword = detectPowerKeyword(section.name)
        console.log(`🎯 [TASK-114] Path 2: detectPowerKeyword("${section.name}") =`, keyword)
        if (keyword) {
            console.log(`🎯 [TASK-114] Detected keyword:`, keyword)

            switch (keyword.category) {
                case 'date':
                    console.log(`🎯 [TASK-114] Calling moveTaskToSmartGroup(${taskId}, "${keyword.value}")`)
                    taskStore.moveTaskToSmartGroup(taskId, keyword.value)
                    return

                case 'priority':
                    updates.priority = keyword.value as 'high' | 'medium' | 'low'
                    break

                case 'status':
                    updates.status = keyword.value as Task['status']
                    break

                case 'duration':
                    // TASK-144: Use centralized duration defaults
                    updates.estimatedDuration = DURATION_DEFAULTS[keyword.value as DurationCategory] ?? 0
                    break
            }

            if (Object.keys(updates).length > 0) {
                taskStore.updateTaskWithUndo(taskId, updates)
                return
            }
        }

        // 3. LEGACY FALLBACK: Use old type-based behavior for backward compatibility
        switch (section.type) {
            case 'priority':
                if (!section.propertyValue) return
                updates.priority = section.propertyValue as 'high' | 'medium' | 'low'
                break
            case 'status':
                if (!section.propertyValue) return
                updates.status = section.propertyValue as Task['status']
                break
            case 'project':
                if (!section.propertyValue) return
                updates.projectId = section.propertyValue
                break
            case 'custom':
            case 'timeline':
                if (shouldUseSmartGroupLogic(section.name)) {
                    const smartGroupType = getSmartGroupType(section.name)
                    if (smartGroupType) {
                        taskStore.moveTaskToSmartGroup(taskId, smartGroupType)
                    } else {
                        taskStore.moveTaskToDate(taskId, section.propertyValue || section.name)
                    }
                } else {
                    taskStore.moveTaskToDate(taskId, section.propertyValue || section.name)
                }
                return
        }

        if (Object.keys(updates).length > 0) {
            taskStore.updateTaskWithUndo(taskId, updates)
        }
    }

    // TASK-089 FIX: Track timeout IDs to cancel them if a new drag starts immediately
    const dragSettlingTimeoutId = ref<any>(null)
    const nodeDraggingTimeoutId = ref<any>(null)

    // Helper: Force reset drag state (called on start of new drag)
    const resetDragState = () => {
        if (dragSettlingTimeoutId.value) {
            clearTimeout(dragSettlingTimeoutId.value)
            dragSettlingTimeoutId.value = null
        }
        if (nodeDraggingTimeoutId.value) {
            clearTimeout(nodeDraggingTimeoutId.value)
            nodeDraggingTimeoutId.value = null
        }
        isNodeDragging.value = false
        isDragSettling.value = false
    }

    // TASK-130: Store original z-index for drag elevation restoration
    const dragOriginalZIndex = new Map<string, number | undefined>()

    // Handle node drag start
    // BUG-002 FIX: Use correct event type with nodes array for multi-select drag
    const handleNodeDragStart = withVueFlowErrorBoundary('handleNodeDragStart', (event: { node: Node, nodes: Node[] }) => {
        // CRITICAL FIX: Reset any pending settling states from previous drags
        // This prevents a previous "drag stop" timeout from firing mid-drag and ruining the state
        resetDragState()

        const { nodes: draggedNodes } = event
        isNodeDragging.value = true
        // TASK-072 FIX: Also set isDragSettling to true immediately
        // This blocks syncNodes from the moment drag starts until settling period ends
        isDragSettling.value = true

        // TASK-130 FIX: Elevate z-index for section nodes being dragged
        // This ensures dragged groups appear above other groups
        dragOriginalZIndex.clear()
        draggedNodes.forEach(node => {
            if (node.id.startsWith('section-')) {
                // Store original z-index
                dragOriginalZIndex.set(node.id, node.zIndex)
                // Elevate to high z-index during drag (1000 base + current to maintain relative order)
                const elevatedZIndex = 1000 + (typeof node.zIndex === 'number' ? node.zIndex : 0)
                // Find and update node in nodes array
                const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                if (nodeIndex !== -1) {
                    nodes.value[nodeIndex] = {
                        ...nodes.value[nodeIndex],
                        zIndex: elevatedZIndex
                    }
                }
            }
        })

        // BUG-002 FIX: Store start positions for ALL nodes being dragged (not just primary)
        draggedNodes.forEach(node => {
            // TASK-089 FIX: Validate start position to ensure we have a valid recovery point
            let startX = node.position.x
            let startY = node.position.y

            if (Number.isNaN(startX) || Number.isNaN(startY)) {
                console.warn(`⚠️ [TASK-089] NaN start position detected for ${node.id}. Attempting to recover from store.`)

                if (node.id.startsWith('section-')) {
                    const sectionId = node.id.replace('section-', '')
                    const section = canvasStore.groups.find(s => s.id === sectionId)
                    if (section) {
                        startX = section.position.x
                        startY = section.position.y
                        console.log(`✅ [RECOVERY] Recovered start position from section store: (${startX}, ${startY})`)
                    }
                } else {
                    // Assume task
                    const task = taskStore.tasks.find((t: Task) => t.id === node.id)
                    if (task?.canvasPosition) {
                        startX = task.canvasPosition.x
                        startY = task.canvasPosition.y
                        console.log(`✅ [RECOVERY] Recovered start position from task store: (${startX}, ${startY})`)
                    }
                }

                // Final fallback
                if (Number.isNaN(startX)) startX = 0
                if (Number.isNaN(startY)) startY = 0

                // CRITICAL FIX: Apply recovered start position to node IMMEDIATELY
                node.position.x = startX
                node.position.y = startY

                const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                if (nodeIndex !== -1) {
                    nodes.value[nodeIndex] = {
                        ...nodes.value[nodeIndex],
                        position: { x: startX, y: startY }
                    }
                }
            }

            // Store starting position for this node
            dragStartPositions.set(node.id, { x: startX, y: startY })
        })

        console.log(`[DRAG START] ${draggedNodes.length} nodes being dragged`)
    })

    // Handle node drag stop
    // BUG-002 FIX: Use correct event type with nodes array for multi-select drag
    const handleNodeDragStop = withVueFlowErrorBoundary('handleNodeDragStop', async (event: { node: Node, nodes: Node[] }) => {
        const { node, nodes: draggedNodes } = event

        // TASK-142 DEBUG: Log what node is being dragged
        console.log(`🎯 [TASK-142] DRAG STOP: nodeId=${node?.id?.substring(0, 15) || 'NULL'}, type=${node?.type || 'NULL'}, draggedNodes=${draggedNodes?.length || 0}`)

        try {
            // Preserve selection state during drag operations
            const selectedIdsBeforeDrag = [...canvasStore.selectedNodeIds]

            // BUG-002 FIX: Detect multi-node drag
            const isMultiDrag = draggedNodes.length > 1

            // BUG-002 FIX: For multi-drag of TASK nodes, process ALL of them together
            // Skip containment recalculation to preserve relative positions
            if (isMultiDrag) {
                const taskNodes = draggedNodes.filter(n => !n.id.startsWith('section-'))

                if (taskNodes.length > 0) {
                    console.log(`%c[BUG-002] Multi-drag stop: ${taskNodes.length} tasks`, 'color: #9C27B0; font-weight: bold')

                    // BUG-152 FIX: Track affected groups to update counts later
                    const affectedGroupIds = new Set<string>()

                    // Save positions for ALL task nodes, preserving their current parentNode state
                    for (const taskNode of taskNodes) {
                        // Calculate absolute position using Vue Flow graph utility (handles deep nesting)
                        const absolutePos = getAbsolutePosition(taskNode.id)
                        const absoluteX = absolutePos.x
                        const absoluteY = absolutePos.y

                        // Validate and save
                        // BUG-153 FIX: Check if task has moved to a new parent (or root)
                        const center = getTaskCenter(absoluteX, absoluteY, 220, 100)
                        const containingSection = findSectionForTask(center)
                        const newParentNodeId = containingSection ? `section-${containingSection.id}` : undefined

                        // Determine if parent changed
                        const currentParentId = taskNode.parentNode
                        if (currentParentId !== newParentNodeId) {
                            console.log(`%c[BUG-153] Multi-drag task ${taskNode.id} parent change: ${currentParentId} -> ${newParentNodeId}`, 'color: #E91E63')

                            // Track OLD parent for count update
                            if (currentParentId) {
                                const oldGroupId = currentParentId.replace('section-', '')
                                affectedGroupIds.add(oldGroupId)
                                getAncestorGroupIds(oldGroupId).forEach(id => affectedGroupIds.add(id))
                            }
                            // Track NEW parent for count update
                            if (newParentNodeId) {
                                const newGroupId = newParentNodeId.replace('section-', '')
                                affectedGroupIds.add(newGroupId)
                                getAncestorGroupIds(newGroupId).forEach(id => affectedGroupIds.add(id))
                            }

                            // BUG-153 FIX: Use Atomic Coordinate Handover
                            const { attachNodeToParent, detachNodeFromParent } = useNodeAttachment()

                            if (containingSection) {
                                // ATTACHMENT: World -> Parent Space
                                // We wait for this to complete to ensure coords are right before next store update? 
                                // Actually, for multi-drag we might need to be careful about async.
                                // But since we are updating nodes.value directly below, we can calculate and set.
                                // attachNodeToParent modifies the node in place.
                                const result = await attachNodeToParent(taskNode.id, `section-${containingSection.id}`)
                                if (result.success && result.newPosition) {
                                    // Update our local variables so we save the right thing to store if needed?
                                    // Actually, taskStore saves ABSOLUTE position (canvasPosition). 
                                    // So we don't need to change what we save to store (absoluteX, absoluteY).
                                    // We only need to ensure Vue Flow sees the relative position.
                                    console.log(`✅ [BUG-153] Multi-drag Attached ${taskNode.id}`, result.newPosition)
                                }
                            } else {
                                // DETACHMENT
                                const result = await detachNodeFromParent(taskNode.id)
                                if (result.success) {
                                    // Update data explicitly
                                    const nodeIndex = nodes.value.findIndex(n => n.id === taskNode.id)
                                    if (nodeIndex !== -1) {
                                        nodes.value[nodeIndex].data = {
                                            ...nodes.value[nodeIndex].data,
                                            parentId: undefined
                                        }
                                    }
                                    console.log(`✅ [BUG-153] Multi-drag Detached ${taskNode.id}`)
                                }
                            }
                        }

                        // Always lock absolute position for visual stability
                        lockTaskPosition(taskNode.id, { x: absoluteX, y: absoluteY })
                        try {
                            await taskStore.updateTask(taskNode.id, {
                                canvasPosition: { x: absoluteX, y: absoluteY }
                            })
                        } catch (err) {
                            console.error(`[BUG-002] Failed to save position for task ${taskNode.id}:`, err)
                        }


                        dragStartPositions.delete(taskNode.id)
                    }

                    // Restore selection state
                    if (selectedIdsBeforeDrag.length > 0) {
                        canvasStore.setSelectedNodes(selectedIdsBeforeDrag)
                        nodes.value.forEach(n => {
                            const nodeWithSelection = n as Node & { selected?: boolean }
                            nodeWithSelection.selected = selectedIdsBeforeDrag.includes(n.id)
                        })
                    }

                    // Wait for Vue reactivity to propagate task position updates
                    await nextTick()

                    // Final count updates for all affected groups (old and new)
                    await nextTick()
                    if (affectedGroupIds.size > 0) {
                        const tasks = filteredTasks.value || []
                        affectedGroupIds.forEach(id => updateSingleSectionCount(id, tasks))
                        console.log(`[BUG-152] Updated task counts for ${affectedGroupIds.size} groups after multi-drag`)
                    }

                    // Handle any sections in the drag
                    const sectionNodes = draggedNodes.filter(n => n.id.startsWith('section-'))
                    if (sectionNodes.length === 0) {
                        // No sections, just tasks - done
                        // Early return but logic will flow to finally block
                        return
                    }
                    // Fall through to process sections below
                }
            }

            // TASK-142 GUARDRAIL: Section vs Task handling MUST be at the SAME nesting level.
            if (node.id.startsWith('section-')) {
                const sectionId = node.id.replace('section-', '')
                const section: CanvasSection | undefined = canvasStore.groups.find((s: CanvasSection) => s.id === sectionId)

                if (section) {
                    // Clean up the stored position
                    dragStartPositions.delete(node.id)

                    // BUG-153 DEBUG: Log ALL available position sources with ACTUAL VALUES
                    const nodePos = node.position
                    const computedPos = (node as any).computedPosition
                    console.log(`%c[BUG-153 DEBUG] Position sources for "${section.name}":`, 'color: #FF5722; font-weight: bold')
                    console.log(`  node.position (from event): x=${nodePos?.x}, y=${nodePos?.y}`)
                    console.log(`  node.computedPosition (Vue Flow): x=${computedPos?.x}, y=${computedPos?.y}`)
                    console.log(`  section.position (from store): x=${section.position.x}, y=${section.position.y}`)
                    console.log(`  getAbsolutePosition result:`, getAbsolutePosition(node.id))
                    console.log(`  node.parentNode:`, node.parentNode || 'NONE (root node)')

                    // Get final absolute visual position from drag
                    // BUG-153 FIX: For ROOT nodes (no parent), node.position IS the absolute position
                    // For CHILD nodes, computedPosition is the absolute position
                    // The event's node.position is the most accurate source during drag stop
                    let absoluteX: number
                    let absoluteY: number

                    if (!node.parentNode) {
                        // Root node: node.position IS absolute
                        absoluteX = Number.isFinite(nodePos.x) ? nodePos.x : section.position.x
                        absoluteY = Number.isFinite(nodePos.y) ? nodePos.y : section.position.y
                        console.log(`  ROOT node - using node.position: (${absoluteX}, ${absoluteY})`)
                    } else {
                        // Child node: use computedPosition for absolute coords
                        absoluteX = computedPos && Number.isFinite(computedPos.x) ? computedPos.x : section.position.x
                        absoluteY = computedPos && Number.isFinite(computedPos.y) ? computedPos.y : section.position.y
                        console.log(`  CHILD node - using computedPosition: (${absoluteX}, ${absoluteY})`)
                    }

                    console.log(`%c[TASK-072] DRAG STOP: "${section.name}"`, 'color: #4CAF50; font-weight: bold')

                    const oldBounds = {
                        x: section.position.x,
                        y: section.position.y,
                        width: section.position.width,
                        height: section.position.height
                    }

                    const newWidth = node.style && typeof node.style === 'object' && 'width' in node.style ? parseInt(String(node.style.width)) : oldBounds.width
                    const newHeight = node.style && typeof node.style === 'object' && 'height' in node.style ? parseInt(String(node.style.height)) : oldBounds.height

                    // 1. Determine the Intended Parent (Containment Logic)
                    // We must decide the parent FIRST to know if we save Relative or Absolute coordinates
                    let newParentGroupId: string | null = section.parentGroupId || null

                    // Logic to check if we moved OUT of the current parent
                    if (section.parentGroupId) {
                        const currentParent = canvasStore.groups.find(s => s.id === section.parentGroupId)
                        if (currentParent) {
                            const stillInside = (
                                absoluteX >= currentParent.position.x &&
                                absoluteY >= currentParent.position.y &&
                                absoluteX + oldBounds.width <= currentParent.position.x + currentParent.position.width &&
                                absoluteY + oldBounds.height <= currentParent.position.y + currentParent.position.height
                            )
                            if (!stillInside) {
                                console.log(`%c[TASK-072] Moving OUT of parent ${currentParent.name}`, 'color: #E91E63')
                                newParentGroupId = null
                            }
                        } else {
                            // Parent not found? Safety fallback
                            newParentGroupId = null
                        }
                    }

                    // Logic to check if we moved INTO a new parent (only if currently root or moved out)
                    if (!newParentGroupId) {
                        const sectionArea = oldBounds.width * oldBounds.height
                        let containingParent: CanvasSection | null = null
                        const sections: CanvasSection[] = canvasStore.groups || []

                        // BUG-153 DEBUG: Log the dragged section's position
                        console.log(`%c[BUG-153] Checking containment for "${section.name}"`, 'color: #9C27B0; font-weight: bold')
                        console.log(`  Dragged section absolute pos: (${absoluteX.toFixed(0)}, ${absoluteY.toFixed(0)})`)
                        console.log(`  Dragged section size: ${oldBounds.width}x${oldBounds.height}`)
                        console.log(`  Dragged section area: ${sectionArea}`)
                        console.log(`  Potential parents: ${sections.filter(s => s.id !== sectionId).map(s => s.name).join(', ')}`)

                        sections.forEach((potentialParent: CanvasSection) => {
                            if (potentialParent.id === sectionId) return
                            // Prevent circular parenting
                            if (potentialParent.parentGroupId === sectionId) return

                            const parentArea = potentialParent.position.width * potentialParent.position.height

                            // BUG-153 FIX: Get parent's ABSOLUTE position (store pos might be relative if parent is nested)
                            const parentNodeId = `section-${potentialParent.id}`
                            const parentVueFlowNode = nodes.value.find(n => n.id === parentNodeId)
                            let parentAbsX: number
                            let parentAbsY: number

                            if (parentVueFlowNode) {
                                // If parent has its own parent, use computedPosition; otherwise position is absolute
                                if (parentVueFlowNode.parentNode) {
                                    const computed = (parentVueFlowNode as any).computedPosition
                                    parentAbsX = computed?.x ?? potentialParent.position.x
                                    parentAbsY = computed?.y ?? potentialParent.position.y
                                } else {
                                    parentAbsX = parentVueFlowNode.position?.x ?? potentialParent.position.x
                                    parentAbsY = parentVueFlowNode.position?.y ?? potentialParent.position.y
                                }
                            } else {
                                // Fallback to store position (might be wrong if nested, but rare case)
                                parentAbsX = potentialParent.position.x
                                parentAbsY = potentialParent.position.y
                            }

                            // BUG-153 DEBUG: Log each parent check
                            console.log(`  Checking parent "${potentialParent.name}":`)
                            console.log(`    Store position: (${potentialParent.position.x}, ${potentialParent.position.y})`)
                            console.log(`    Absolute position: (${parentAbsX.toFixed(0)}, ${parentAbsY.toFixed(0)}) ${potentialParent.position.width}x${potentialParent.position.height}`)
                            console.log(`    Parent area: ${parentArea}, Section area: ${sectionArea}, Ratio: ${(parentArea / sectionArea).toFixed(2)}`)

                            // BUG-025 FIX: Relaxed strictness for dragging comfort (10% larger is enough)
                            if (parentArea <= sectionArea * 1.05) {
                                console.log(`    ❌ SKIPPED: Parent not large enough (needs > ${(sectionArea * 1.05).toFixed(0)})`)
                                return
                            }

                            const isInside = isNodeMoreThanHalfInside(
                                absoluteX,
                                absoluteY,
                                oldBounds.width,
                                oldBounds.height,
                                {
                                    x: parentAbsX,
                                    y: parentAbsY,
                                    width: potentialParent.position.width,
                                    height: potentialParent.position.height
                                }
                            )

                            console.log(`    isNodeMoreThanHalfInside result: ${isInside}`)

                            if (isInside) {
                                console.log(`    parentArea (${parentArea}) > sectionArea (${sectionArea}) = ${parentArea > sectionArea}`)
                                if (parentArea > sectionArea) {
                                    const currentBest = containingParent ? containingParent.position.width * containingParent.position.height : null
                                    console.log(`    Current best parent area: ${currentBest}, this parent: ${parentArea}`)
                                    if (!containingParent || parentArea < (containingParent.position.width * containingParent.position.height)) {
                                        containingParent = potentialParent
                                        console.log(`    ✅ SELECTED as containing parent!`)
                                    } else {
                                        console.log(`    ❌ Parent larger than current best, keeping existing`)
                                    }
                                } else {
                                    console.log(`    ❌ Parent area not larger than section area (${parentArea} <= ${sectionArea})`)
                                }
                            } else {
                                console.log(`    ❌ NOT inside parent bounds`)
                            }
                        })

                        console.log(`%c[BUG-153] Containment check complete:`, 'color: #673AB7; font-weight: bold')
                        if (containingParent) {
                            console.log(`  ✅ Found parent: "${(containingParent as CanvasSection).name}" (id: ${(containingParent as CanvasSection).id})`)
                            console.log(`%c[TASK-072] Moving INTO parent ${(containingParent as CanvasSection).name}`, 'color: #FF9800')
                            newParentGroupId = (containingParent as CanvasSection).id
                        } else {
                            console.log(`  ❌ No containing parent found`)
                        }
                        console.log(`  Final newParentGroupId: ${newParentGroupId || 'null (will be root)'}`)
                    }

                    // 2. Calculate Final Store Position (Relative vs Absolute)
                    let finalStoreX = absoluteX
                    let finalStoreY = absoluteY

                    // If we have a parent, we MUST save relative coordinates
                    if (newParentGroupId) {
                        const parentSection = canvasStore.groups.find(s => s.id === newParentGroupId)
                        if (parentSection) {
                            // BUG-153 FIX: Calculate relative position correctly
                            // getAbsolutePosition works recursively, so parentAbsPos is reliable
                            const parentAbsPos = getAbsolutePosition(`section-${newParentGroupId}`)

                            // If parent node not found in graph (rare), fallback to store position 
                            // (which assumes store pos is absolute if root, but might be relative if nested... 
                            // safe fallback is to trust the graph)
                            const parentBaseX = Number.isFinite(parentAbsPos.x) ? parentAbsPos.x : parentSection.position.x
                            const parentBaseY = Number.isFinite(parentAbsPos.y) ? parentAbsPos.y : parentSection.position.y

                            finalStoreX = absoluteX - parentBaseX
                            finalStoreY = absoluteY - parentBaseY

                            console.log(`[BUG-153] Converting to RELATIVE: Abs(${absoluteX.toFixed(0)}) - Parent(${parentBaseX.toFixed(0)}) = ${finalStoreX.toFixed(0)}`)
                        }
                    }

                    // 3. Lock UI (Absolute) to prevent Sync jitter
                    // We always lock the ABSOLUTE visual position because that's what Vue Flow renders
                    lockGroupPosition(sectionId, {
                        x: absoluteX,
                        y: absoluteY,
                        width: newWidth,
                        height: newHeight
                    }, 'drag')

                    // 4. Update Store (Relative or Absolute)
                    console.log(`%c[BUG-153] SAVING TO STORE:`, 'color: #E91E63; font-weight: bold')
                    console.log(`  Section: "${section.name}" (id: ${sectionId})`)
                    console.log(`  Position: (${finalStoreX.toFixed(0)}, ${finalStoreY.toFixed(0)}) ${newWidth}x${newHeight}`)
                    console.log(`  parentGroupId: ${newParentGroupId || 'null'}`)

                    await canvasStore.updateSectionWithUndo(sectionId, {
                        position: {
                            x: finalStoreX,
                            y: finalStoreY,
                            width: newWidth,
                            height: newHeight
                        },
                        parentGroupId: newParentGroupId
                    })

                    console.log(`[BUG-153] Store update complete. Verifying...`)
                    const updatedSection = canvasStore.groups.find(s => s.id === sectionId)
                    console.log(`  Verified parentGroupId in store: ${updatedSection?.parentGroupId || 'null'}`)

                    // 5. Update Vue Flow Node State (Immediate visual feedback)
                    // If we changed parent, we need to update the node structure immediately
                    // so it doesn't wait for the next sync cycle
                    const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                    if (nodeIndex !== -1) {
                        const newParentNodeId = newParentGroupId ? `section-${newParentGroupId}` : undefined

                        // Calculate relative position for Vue Flow (which is always relative to parentNode)
                        // If newParentGroupId exists, finalStoreX/Y IS the relative position.
                        // If it doesn't, finalStoreX/Y is absolute, which is also correct for root nodes.
                        const visualX = finalStoreX
                        const visualY = finalStoreY

                        // Calculate Z-Index
                        let childZIndex = 0
                        if (newParentNodeId) {
                            const parentNode = nodes.value.find(n => n.id === newParentNodeId)
                            const parentZIndex = (parentNode?.style as Record<string, any>)?.zIndex ?? 0
                            childZIndex = (typeof parentZIndex === 'number' ? parentZIndex : parseInt(String(parentZIndex)) || 0) + 1
                        }

                        nodes.value[nodeIndex] = {
                            ...nodes.value[nodeIndex],
                            parentNode: newParentNodeId,
                            position: { x: visualX, y: visualY },
                            style: { ...nodes.value[nodeIndex].style as any, zIndex: childZIndex }
                        }
                    }

                    // 6. Handle Children
                    const taskChildNodes = nodes.value.filter(n => n.type === 'taskNode' && n.parentNode === `section-${sectionId}`)

                    // NOTE: We DO NOT update child sections (nested groups) here.
                    // Because nested groups are stored relatively, moving the parent 
                    // automatically moves the children visually without changing their stored numbers.
                    // Updating them to "new absolute" would actually break them (BUG-153).

                    // Handle child TASK nodes
                    // Tasks are ALWAYS stored with absolute coordinates in canvasPosition
                    if (taskChildNodes.length > 0) {
                        console.log(`%c[GROUP-DRAG] Updating ${taskChildNodes.length} child tasks to new absolute position`, 'color: #2196F3')

                        const batchUpdates: Promise<void>[] = []

                        taskChildNodes.forEach(childNode => {
                            // Calculate new absolute position for the task
                            // Since we know the delta of the parent move, we apply it to the child?
                            // No, simpler: absoluteX (new parent pos) + childNode.position.x (relative to parent)
                            const newChildAbsX = absoluteX + childNode.position.x
                            const newChildAbsY = absoluteY + childNode.position.y

                            if (Number.isFinite(newChildAbsX) && Number.isFinite(newChildAbsY)) {
                                // 1. Lock immediately (Synchronous)
                                lockTaskPosition(childNode.id, { x: newChildAbsX, y: newChildAbsY })

                                // 2. Queue Update
                                const updatePromise = taskStore.updateTask(childNode.id, {
                                    canvasPosition: { x: newChildAbsX, y: newChildAbsY }
                                }).catch(err => console.error(`Failed to update child task ${childNode.id}`, err))

                                batchUpdates.push(updatePromise)
                            }
                        })

                        if (batchUpdates.length > 0) {
                            await Promise.all(batchUpdates)
                        }
                    }
                }
            } else {
                // Task Node Logic
                // Check if starting position is stored
                const startPos = dragStartPositions.get(node.id)

                // TASK-131 FIX: Calculate ABSOLUTE position for tasks inside groups
                // node.position is RELATIVE if task has a parentNode
                let targetX = node.position.x
                let targetY = node.position.y

                // Validate coordinates
                if (Number.isNaN(targetX) || Number.isNaN(targetY)) {
                    console.warn(`⚠️ [TASK-089] NaN position detected for task ${node.id}`, { pos: node.position })
                    if (startPos && !Number.isNaN(startPos.x) && !Number.isNaN(startPos.y)) {
                        targetX = startPos.x
                        targetY = startPos.y

                        const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                        if (nodeIndex !== -1) {
                            nodes.value[nodeIndex] = {
                                ...nodes.value[nodeIndex],
                                position: { x: targetX, y: targetY }
                            }
                        }
                    } else {
                        throw new Error('Critical: NaN position with no recovery')
                    }
                }

                // TASK-131 FIX: Convert to ABSOLUTE position before locking and saving
                // This matches what multi-drag does (lines 584-585) and what sync expects
                let absoluteX = targetX
                let absoluteY = targetY
                if (node.parentNode) {
                    const sectionId = node.parentNode.replace('section-', '')
                    const section = canvasStore.groups.find(s => s.id === sectionId)
                    if (section) {
                        absoluteX = section.position.x + targetX
                        absoluteY = section.position.y + targetY
                    }
                }

                console.log(`🔒 [TASK-142] Locking task ${node.id.substring(0, 8)} at absolute (${absoluteX.toFixed(0)}, ${absoluteY.toFixed(0)})`)
                lockTaskPosition(node.id, { x: absoluteX, y: absoluteY })

                try {
                    // TASK-131 FIX: Save ABSOLUTE position to canvasPosition
                    console.log(`💾 [TASK-142] Saving task ${node.id.substring(0, 8)} position to store...`)
                    await taskStore.updateTask(node.id, {
                        canvasPosition: { x: absoluteX, y: absoluteY }
                    })
                    console.log(`✅ [TASK-142] Task ${node.id.substring(0, 8)} position saved`)
                } catch (err) {
                    console.error(`[TASK-089] Failed to save position for task ${node.id}:`, err)
                }

                // Check containment and apply properties
                // BUG-153 FIX: Use getSectionAbsolutePosition to properly handle nested groups
                // Previously only accounted for one level of nesting, causing tasks in Group 2
                // (inside Group 1) to have incorrect absolute positions for containment checks
                let checkX, checkY
                if (node.parentNode) {
                    const sectionId = node.parentNode.replace('section-', '')
                    const section = canvasStore.groups.find(s => s.id === sectionId)
                    if (section) {
                        // BUG-153 FIX: Get ABSOLUTE position of parent section (handles deep nesting)
                        const parentAbsPos = getSectionAbsolutePosition(section)
                        checkX = parentAbsPos.x + node.position.x
                        checkY = parentAbsPos.y + node.position.y
                    } else {
                        checkX = node.position.x
                        checkY = node.position.y
                    }
                } else {
                    checkX = node.position.x
                    checkY = node.position.y
                }

                dragStartPositions.delete(node.id)

                const isMultiDrag = selectedIdsBeforeDrag.length > 1 && selectedIdsBeforeDrag.includes(node.id)

                if (!isMultiDrag) {
                    // Single task drag - apply section containment
                    const containingSection = getContainingSection(checkX, checkY)

                    // BUG-152 DEBUG: Log containment detection
                    console.log(`[BUG-152 DEBUG] Task ${node.id.substring(0, 15)}:`, {
                        checkX: checkX?.toFixed(0),
                        checkY: checkY?.toFixed(0),
                        containingSection: containingSection ? `${containingSection.name} (${containingSection.id.substring(0, 10)})` : 'NONE',
                        sectionBounds: containingSection ? {
                            x: containingSection.position.x,
                            y: containingSection.position.y,
                            w: containingSection.position.width,
                            h: containingSection.position.height
                        } : null
                    })

                    if (containingSection) {
                        try {
                            applyAllNestedSectionProperties(node.id, checkX, checkY)
                        } catch (nestedErr) {
                            console.error('Failed to apply nested section properties:', nestedErr)
                        }
                    }

                    const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                    if (nodeIndex !== -1) {
                        const currentParentNode = nodes.value[nodeIndex].parentNode
                        const newParentNode = containingSection ? `section-${containingSection.id}` : undefined

                        // BUG-152 DEBUG: Log parent comparison
                        console.log(`[BUG-152 DEBUG] Parent comparison:`, {
                            currentParentNode: currentParentNode || 'NONE',
                            newParentNode: newParentNode || 'NONE',
                            willChange: currentParentNode !== newParentNode
                        })

                        if (currentParentNode !== newParentNode) {
                            console.log(`%c[BUG-152] Task parentNode change: ${currentParentNode} → ${newParentNode}`, 'color: #2196F3')

                            // Extract section IDs for task count updates (strip 'section-' prefix)
                            const oldSectionId = currentParentNode ? currentParentNode.replace('section-', '') : undefined
                            const newSectionId = containingSection?.id

                            // BUG-153 FIX: Use the new composable for Atomic Coordinate Handover
                            // This replaces the manual calculation that was missing parent metrics
                            const { attachNodeToParent, detachNodeFromParent } = useNodeAttachment()

                            if (containingSection) {
                                // ATTACHMENT: World -> Parent Space
                                // BUG-153 FIX: Use Vue Flow node ID format (section-{groupId}) not raw group ID
                                const parentNodeId = `section-${containingSection.id}`
                                // BUG-153 FIX: MUST await attachment before setNodes to ensure parentNode is set
                                const result = await attachNodeToParent(node.id, parentNodeId)
                                if (result.success) {
                                    console.log(`✅ [BUG-153] Attached ${node.id} to ${parentNodeId}`, result.newPosition)
                                    // BUG-153: Membership is persisted via absolute canvasPosition
                                    // and inferred by findSectionForTask during sync.
                                    console.log(`✅ [BUG-153] Node parentNode set to ${parentNodeId} for task ${node.id.substring(0, 8)}`)
                                } else {
                                    console.error(`❌ [BUG-153] Attach failed:`, result.error)
                                }
                            } else {
                                // DETACHMENT: Parent Space -> World Space
                                console.log(`%c[BUG-152] Task ${node.id} moved to ROOT (clearing parent)`, 'color: #E91E63')

                                // Detach using composable to restore absolute coordinates
                                // BUG-153 FIX: MUST await detachment before setNodes
                                const result = await detachNodeFromParent(node.id)
                                if (result.success) {
                                    // Update data explicitly for store sync
                                    nodes.value[nodeIndex].data = {
                                        ...nodes.value[nodeIndex].data,
                                        parentId: undefined
                                    }
                                    console.log(`✅ [BUG-153] Detached ${node.id} to World`, result.newPosition)
                                    // BUG-153: Detachment is persisted via absolute canvasPosition
                                    console.log(`✅ [BUG-153] Node parentNode cleared for task ${node.id.substring(0, 8)}`)
                                }
                            }

                            // BUG-152 FIX: CRITICAL - Use setNodes() to force Vue Flow to reinitialize
                            // Direct array mutation doesn't trigger Vue Flow's complete initialization sequence
                            // setNodes() ensures parent-child relationships are properly discovered
                            if (setNodes) {
                                console.log(`[BUG-152] Forcing Vue Flow reinit via setNodes() after parent change`)
                                setNodes([...nodes.value])
                                await nextTick()
                                await nextTick()
                            }

                            // BUG-152 FIX: Await to ensure counts update before continuing
                            await updateSectionTaskCounts(oldSectionId, newSectionId)
                        }
                    }
                }

                // Restore selection state
                if (selectedIdsBeforeDrag.length > 0) {
                    canvasStore.setSelectedNodes(selectedIdsBeforeDrag)
                    // Note: nodesRef updates handled by Vue Flow automatically when selected changes in store if synced, 
                    // but updating local node state ensures immediate visual feedback
                    nodes.value.forEach(node => {
                        const nodeWithSelection = node as Node & { selected?: boolean }
                        nodeWithSelection.selected = selectedIdsBeforeDrag.includes(node.id)
                    })
                }
            }

            // Restore Z-index (runs for both Sections and Tasks)
            setTimeout(() => {
                dragOriginalZIndex.forEach((originalZIndex, nodeId) => {
                    const nodeIndex = nodes.value.findIndex(n => n.id === nodeId)
                    if (nodeIndex !== -1) {
                        const section = canvasStore.groups.find(s => `section-${s.id}` === nodeId)
                        let finalZIndex = originalZIndex ?? 0
                        if (section?.parentGroupId) {
                            const getDepth = (groupId: string, depth = 0): number => {
                                const group = canvasStore.groups.find(s => s.id === groupId)
                                if (!group || !group.parentGroupId || depth > 10) return depth
                                return getDepth(group.parentGroupId, depth + 1)
                            }
                            finalZIndex = getDepth(section.id)
                        }
                        nodes.value[nodeIndex] = {
                            ...nodes.value[nodeIndex],
                            style: { ...(nodes.value[nodeIndex].style as any), zIndex: finalZIndex }
                        }
                    }
                })
                dragOriginalZIndex.clear()
            }, 100)

        } catch (error) {
            console.error('❌ Error handling drag stop:', error)
        } finally {
            // GUARANTEED CLEANUP
            // TASK-072 FIX: Use longer settling period to prevent watchers from resetting positions
            nodeDraggingTimeoutId.value = setTimeout(() => {
                isNodeDragging.value = false
            }, 50)

            dragSettlingTimeoutId.value = setTimeout(() => {
                isDragSettling.value = false
                console.log(`%c[TASK-072] Drag settling complete - syncNodes unblocked`, 'color: #4CAF50')
            }, 500)
        }
    })

    // Handle node drag (continuous during drag - kept lightweight)
    const handleNodeDrag = (_event: { node: Node }) => {
        const { node } = _event
        // CRITICAL FIX: Guard against NaNs appearing mid-drag
        // This stops the "Invalid value for <rect>" errors from flooding the console
        if (Number.isNaN(node.position.x) || Number.isNaN(node.position.y)) {
            console.warn(`⚠️ [TASK-089] NaN positions detected DURING drag for ${node.id}. Force reverting.`)
            const startPos = dragStartPositions.get(node.id)
            if (startPos) {
                node.position.x = startPos.x
                node.position.y = startPos.y
            } else {
                node.position.x = 0
                node.position.y = 0
            }

            // SAFETY: If we are getting NaNs, checks the viewport state too
            // If viewport is corrupt, it causes projection errors which cause NaNs
            const vp = canvasStore.viewport
            if (!Number.isFinite(vp.x) || !Number.isFinite(vp.y) || !Number.isFinite(vp.zoom) || vp.zoom <= 0) {
                console.error('🚨 [TASK-089] CORRUPTED VIEWPORT DETECTED DURING DRAG. FORCE RESETTING.')
                canvasStore.setViewport(0, 0, 1)
            }
        }
    }

    return {
        handleNodeDragStart,
        handleNodeDragStop,
        handleNodeDrag,
        getContainingSection,
        isTaskInSectionBounds,
        applySectionPropertiesToTask
    }
}
