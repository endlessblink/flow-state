import { type Ref, type ComputedRef, ref } from 'vue'
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

interface DragDropDeps {
    taskStore: ReturnType<typeof useTaskStore>
    canvasStore: ReturnType<typeof useCanvasStore>
    nodes: Ref<Node[]>
    filteredTasks: ComputedRef<Task[]>
    withVueFlowErrorBoundary: (handlerName: string, handler: (...args: any[]) => any, options?: any) => any
    syncNodes: () => void
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
    const { taskStore, canvasStore, nodes, filteredTasks, withVueFlowErrorBoundary, syncNodes, updateNodeData: _updateNodeData } = deps
    // TASK-072: isDragSettling prevents syncNodes from running during the settling period after drag ends
    // Use provided ref or fall back to internal one (exported as isDragSettlingRef)
    const { isNodeDragging, isDragSettling = _internalDragSettling } = state

    // TASK-144: Helper functions now use shared geometry utilities from @/utils/geometry.ts

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

    // Helper: Check if task is inside a section (returns first match)
    // REFACTORED: Uses robust isNodeMoreThanHalfInside from shared utils to prevent false positives
    const getContainingSection = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
        // Find all sections where the task is > 50% inside
        const validSections = canvasStore.sections.filter(s =>
            isNodeMoreThanHalfInside(taskX, taskY, taskWidth, taskHeight, {
                x: s.position.x,
                y: s.position.y,
                width: s.position.width,
                height: s.position.height
            })
        )

        if (validSections.length === 0) return undefined

        // Return the smallest one by area (most specific)
        return validSections.reduce((smallest, current) => {
            const smallestArea = smallest.position.width * smallest.position.height
            const currentArea = current.position.width * current.position.height
            return currentArea < smallestArea ? current : smallest
        })
    }

    // Helper: Get ALL sections containing a position (for nested group inheritance)
    // REFACTORED: Uses robust isNodeMoreThanHalfInside from shared utils
    const getAllContainingSections = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
        const matches = canvasStore.sections.filter(s =>
            isNodeMoreThanHalfInside(taskX, taskY, taskWidth, taskHeight, {
                x: s.position.x,
                y: s.position.y,
                width: s.position.width || 300,
                height: s.position.height || 200
            })
        )

        // Sort largest to smallest (parents first)
        return matches.sort((a, b) => {
            const areaA = a.position.width * a.position.height
            const areaB = b.position.width * b.position.height
            return areaB - areaA
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
    //
    // CRITICAL INSIGHT from Vue Flow docs (https://github.com/bcakmakoglu/vue-flow/discussions/920):
    // "useNode returns us the node object straight from the state - since the node obj is reactive,
    //  we can MUTATE it to update our nodes' data"
    //
    // The key is to MUTATE the existing node.data, NOT replace the node object.
    // Replacing the node breaks the reference that useNode() is watching in custom components.
    const updateSectionTaskCounts = (oldSectionId?: string, newSectionId?: string) => {
        const tasks = filteredTasks.value || []

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
                    const section = canvasStore.sections.find(s => s.id === sectionId)
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

                    // Save positions for ALL task nodes, preserving their current parentNode state
                    for (const taskNode of taskNodes) {
                        // Calculate absolute position using Vue Flow graph utility (handles deep nesting)
                        const absolutePos = getAbsolutePosition(taskNode.id)
                        const absoluteX = absolutePos.x
                        const absoluteY = absolutePos.y

                        // Validate and save
                        if (Number.isFinite(absoluteX) && Number.isFinite(absoluteY)) {
                            lockTaskPosition(taskNode.id, { x: absoluteX, y: absoluteY })
                            try {
                                await taskStore.updateTask(taskNode.id, {
                                    canvasPosition: { x: absoluteX, y: absoluteY }
                                })
                            } catch (err) {
                                console.error(`[BUG-002] Failed to save position for task ${taskNode.id}:`, err)
                            }
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
            // Bug was found where task logic was nested INSIDE section block, making it
            // unreachable for actual task nodes. The structure MUST be:
            //   if (section-node) { handle section } else { handle task }
            // NOT:
            //   if (section-node) { if (found) {...} else { handle task - UNREACHABLE! } }
            if (node.id.startsWith('section-')) {
                const sectionId = node.id.replace('section-', '')
                const section: CanvasSection | undefined = canvasStore.sections.find((s: CanvasSection) => s.id === sectionId)

                if (section) {
                    // Clean up the stored position
                    dragStartPositions.delete(node.id)

                    // ... (rest of section logic) ...
                    // Converting existing code to fit structure
                    const absolutePos = getAbsolutePosition(node.id)
                    const absoluteX = Number.isFinite(absolutePos.x) ? absolutePos.x : section.position.x
                    const absoluteY = Number.isFinite(absolutePos.y) ? absolutePos.y : section.position.y

                    console.log(`%c[TASK-072] DRAG STOP: "${section.name}"`, 'color: #4CAF50; font-weight: bold')

                    const oldBounds = {
                        x: section.position.x,
                        y: section.position.y,
                        width: section.position.width,
                        height: section.position.height
                    }

                    const newWidth = node.style && typeof node.style === 'object' && 'width' in node.style ? parseInt(String(node.style.width)) : oldBounds.width
                    const newHeight = node.style && typeof node.style === 'object' && 'height' in node.style ? parseInt(String(node.style.height)) : oldBounds.height

                    lockGroupPosition(sectionId, {
                        x: absoluteX,
                        y: absoluteY,
                        width: newWidth,
                        height: newHeight
                    }, 'drag')

                    await canvasStore.updateSectionWithUndo(sectionId, {
                        position: {
                            x: absoluteX,
                            y: absoluteY,
                            width: newWidth,
                            height: newHeight
                        }
                    })

                    // Handle parent-child relationships
                    const sectionArea = oldBounds.width * oldBounds.height

                    if (section.parentGroupId) {
                        const currentParent = canvasStore.sections.find(s => s.id === section.parentGroupId)
                        if (currentParent) {
                            const stillInside = (
                                absoluteX >= currentParent.position.x &&
                                absoluteY >= currentParent.position.y &&
                                absoluteX + oldBounds.width <= currentParent.position.x + currentParent.position.width &&
                                absoluteY + oldBounds.height <= currentParent.position.y + currentParent.position.height
                            )
                            if (!stillInside) {
                                console.log(`%c[TASK-072] Clearing parentGroupId`, 'color: #E91E63')
                                await canvasStore.updateSection(sectionId, { parentGroupId: null })

                                const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                                if (nodeIndex !== -1) {
                                    nodes.value[nodeIndex] = {
                                        ...nodes.value[nodeIndex],
                                        parentNode: undefined,
                                        position: { x: absoluteX, y: absoluteY },
                                        style: { ...nodes.value[nodeIndex].style as any, zIndex: 0 }
                                    }
                                }
                            }
                        }
                    }

                    // Check for new parent
                    const updatedSection = canvasStore.sections.find(s => s.id === sectionId)
                    if (updatedSection && !updatedSection.parentGroupId) {
                        let containingParent: CanvasSection | null = null
                        const sections: CanvasSection[] = canvasStore.sections || []
                        sections.forEach((potentialParent: CanvasSection) => {
                            if (potentialParent.id === sectionId) return
                            if (potentialParent.parentGroupId === sectionId) return
                            const parentArea = potentialParent.position.width * potentialParent.position.height

                            // BUG-025 FIX: Relaxed strictness for dragging comfort
                            // TASK-131 FIX: Relaxed ratio from 1.5 to 1.1 - 10% larger is enough
                            if (parentArea <= sectionArea * 1.05) return

                            // Use robust containment check (require > 70% inside for groups)
                            // This allows for "messy" drops where edges might slightly overhang
                            const isInside = isNodeMoreThanHalfInside(
                                absoluteX,
                                absoluteY,
                                oldBounds.width,
                                oldBounds.height,
                                {
                                    x: potentialParent.position.x,
                                    y: potentialParent.position.y,
                                    width: potentialParent.position.width,
                                    height: potentialParent.position.height
                                }
                            )

                            if (isInside) {
                                // BUG-025 CHECK: Only ensure the parent is actually physically larger
                                if (parentArea > sectionArea) {
                                    if (!containingParent || parentArea < (containingParent.position.width * containingParent.position.height)) {
                                        containingParent = potentialParent
                                    }
                                }
                            }
                        })

                        if (containingParent) {
                            const parent = containingParent as CanvasSection
                            console.log(`%c[TASK-072] Setting parentGroupId`, 'color: #FF9800')
                            await canvasStore.updateSection(sectionId, { parentGroupId: parent.id })

                            const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                            if (nodeIndex !== -1) {
                                const parentNodeId = `section-${parent.id}`
                                const relativeX = absoluteX - parent.position.x
                                const relativeY = absoluteY - parent.position.y
                                const parentNode = nodes.value.find(n => n.id === parentNodeId)
                                const parentZIndex = (parentNode?.style as Record<string, any>)?.zIndex ?? 0
                                const childZIndex = (typeof parentZIndex === 'number' ? parentZIndex : parseInt(String(parentZIndex)) || 0) + 1

                                nodes.value[nodeIndex] = {
                                    ...nodes.value[nodeIndex],
                                    parentNode: parentNodeId,
                                    position: { x: relativeX, y: relativeY },
                                    style: { ...nodes.value[nodeIndex].style as any, zIndex: childZIndex }
                                }
                            }
                        }
                    }
                    // TASK-141 FIX: When dragging a group, Vue Flow updates visual child positions (relative stays same),
                    // but we must update the ABSOLUTE positions in the store so they don't jump on next sync.
                    // CRITICAL: Include BOTH task nodes AND nested section nodes (child groups)
                    const taskChildNodes = nodes.value.filter(n => n.type === 'taskNode' && n.parentNode === `section-${sectionId}`)
                    const sectionChildNodes = nodes.value.filter(n => n.type === 'sectionNode' && n.parentNode === `section-${sectionId}`)

                    console.log(`🔍 [GROUP-DRAG] Checking for children of section-${sectionId}`, {
                        totalNodes: nodes.value.length,
                        foundTaskChildren: taskChildNodes.length,
                        foundSectionChildren: sectionChildNodes.length
                    })

                    // TASK-141 FIX: Handle nested group children FIRST (they may have their own children)
                    if (sectionChildNodes.length > 0) {
                        console.log(`%c[TASK-141] Updating ${sectionChildNodes.length} nested child groups to new absolute position`, 'color: #9C27B0; font-weight: bold')

                        const sectionBatchUpdates: Promise<void>[] = []

                        for (const childSectionNode of sectionChildNodes) {
                            const childSectionId = childSectionNode.id.replace('section-', '')
                            const newChildAbsX = absoluteX + childSectionNode.position.x
                            const newChildAbsY = absoluteY + childSectionNode.position.y

                            if (Number.isFinite(newChildAbsX) && Number.isFinite(newChildAbsY)) {
                                // 1. Lock the child section position
                                const childSection = canvasStore.sections.find(s => s.id === childSectionId)
                                const childWidth = childSection?.position.width || 300
                                const childHeight = childSection?.position.height || 200

                                lockGroupPosition(childSectionId, {
                                    x: newChildAbsX,
                                    y: newChildAbsY,
                                    width: childWidth,
                                    height: childHeight
                                }, 'drag')

                                // 2. Queue the store update
                                const updatePromise = canvasStore.updateSection(childSectionId, {
                                    position: {
                                        x: newChildAbsX,
                                        y: newChildAbsY,
                                        width: childWidth,
                                        height: childHeight
                                    }
                                }).catch(err => console.error(`[TASK-141] Failed to update child section ${childSectionId}`, err))

                                sectionBatchUpdates.push(updatePromise)

                                console.log(`  📦 [TASK-141] Child group "${childSection?.name || childSectionId}": (${childSectionNode.position.x}, ${childSectionNode.position.y}) → absolute (${newChildAbsX}, ${newChildAbsY})`)
                            }
                        }

                        if (sectionBatchUpdates.length > 0) {
                            await Promise.all(sectionBatchUpdates)
                            console.log(`%c[TASK-141] Nested groups batch update complete`, 'color: #4CAF50')
                        }
                    }

                    // Handle child TASK nodes
                    if (taskChildNodes.length > 0) {
                        console.log(`%c[GROUP-DRAG] Updating ${taskChildNodes.length} child tasks to new absolute position`, 'color: #2196F3')

                        // BUG-024 FIX: ATOMIC BATCH SYNC
                        // Calculate and Lock ALL positions first, then persist in parallel
                        // This prevents the "race" where some tasks update and others don't before a sync tick
                        const batchUpdates: Promise<void>[] = []

                        taskChildNodes.forEach(childNode => {
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
                            console.log(`%c[GROUP-DRAG] Batch updating ${batchUpdates.length} tasks...`, 'color: #2196F3')
                            await Promise.all(batchUpdates)
                            console.log(`%c[GROUP-DRAG] Batch update complete`, 'color: #4CAF50')
                        }

                        console.log(`%c[TASK-072] DRAG COMPLETE - Vue Flow manages child positions`, 'color: #4CAF50')
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
                    const section = canvasStore.sections.find(s => s.id === sectionId)
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
                let checkX, checkY
                if (node.parentNode) {
                    const sectionId = node.parentNode.replace('section-', '')
                    const section = canvasStore.sections.find(s => s.id === sectionId)
                    if (section) {
                        checkX = section.position.x + node.position.x
                        checkY = section.position.y + node.position.y
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

                        if (currentParentNode !== newParentNode) {
                            console.log(`%c[TASK-072] Task parentNode change: ${currentParentNode} → ${newParentNode}`, 'color: #2196F3')
                            const oldSectionId = currentParentNode?.replace('section-', '')
                            const newSectionId = newParentNode?.replace('section-', '')

                            if (containingSection) {
                                const relativeX = checkX - containingSection.position.x
                                const relativeY = checkY - containingSection.position.y
                                nodes.value[nodeIndex] = {
                                    ...nodes.value[nodeIndex],
                                    parentNode: newParentNode,
                                    position: { x: relativeX, y: relativeY }
                                }
                            } else {
                                nodes.value[nodeIndex] = {
                                    ...nodes.value[nodeIndex],
                                    parentNode: undefined,
                                    position: { x: checkX, y: checkY }
                                }
                            }
                            updateSectionTaskCounts(oldSectionId, newSectionId)
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
                        const section = canvasStore.sections.find(s => `section-${s.id}` === nodeId)
                        let finalZIndex = originalZIndex ?? 0
                        if (section?.parentGroupId) {
                            const getDepth = (groupId: string, depth = 0): number => {
                                const group = canvasStore.sections.find(s => s.id === groupId)
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
