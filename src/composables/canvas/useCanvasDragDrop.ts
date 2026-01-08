import { type Ref, type ComputedRef, ref } from 'vue'
import { type Node } from '@vue-flow/core'
import type { useTaskStore } from '@/stores/tasks';
import { type Task } from '@/stores/tasks'
import type { useCanvasStore } from '@/stores/canvas';
import { type CanvasSection } from '@/stores/canvas'
import { shouldUseSmartGroupLogic, getSmartGroupType, detectPowerKeyword } from '@/composables/useTaskSmartGroups'
import { resolveDueDate } from '@/composables/useGroupSettings'
import { formatDateKey } from '@/utils/dateUtils'
// TASK-089: Updated to use unified canvas state lock system
import { lockTaskPosition, lockGroupPosition } from '@/utils/canvasStateLock'

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

    // Helper: Check if coordinates are within section bounds
    const isTaskInSectionBounds = (x: number, y: number, section: CanvasSection, taskWidth: number = 220, taskHeight: number = 100) => {
        const { x: sx, y: sy, width, height } = section.position
        const taskCenterX = x + taskWidth / 2
        const taskCenterY = y + taskHeight / 2

        return (
            taskCenterX >= sx &&
            taskCenterX <= sx + width &&
            taskCenterY >= sy &&
            taskCenterY <= sy + height
        )
    }

    // Helper: Check if task is inside a section (returns first match)
    const getContainingSection = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
        return canvasStore.sections.find(section => {
            const { x, y, width, height } = section.position
            const taskCenterX = taskX + taskWidth / 2
            const taskCenterY = taskY + taskHeight / 2

            // TASK-126 FIX: Use full height for containment detection (removed redundant ternary)
            const detectionHeight = height

            const isInside = (
                taskCenterX >= x &&
                taskCenterX <= x + width &&
                taskCenterY >= y &&
                taskCenterY <= y + detectionHeight
            )

            return isInside
        })
    }

    // Helper: Get ALL sections containing a position (for nested group inheritance)
    const getAllContainingSections = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
        const taskCenterX = taskX + taskWidth / 2
        const taskCenterY = taskY + taskHeight / 2

        return canvasStore.sections.filter(section => {
            const { x, y, width, height } = section.position
            // TASK-126 FIX: Use full height for containment detection (removed redundant ternary)
            const detectionHeight = height

            return (
                taskCenterX >= x &&
                taskCenterX <= x + width &&
                taskCenterY >= y &&
                taskCenterY <= y + detectionHeight
            )
        }).sort((a, b) => {
            // Sort by area - LARGEST first (parent sections before child sections)
            // This way child section properties will override parent properties
            const areaA = (a.position.width || 300) * (a.position.height || 200)
            const areaB = (b.position.width || 300) * (b.position.height || 200)
            return areaB - areaA
        })
    }

    // TASK-072 FIX: Recursively calculate absolute position for any nesting depth
    // When a node has parentNode set, its position is RELATIVE to parent.
    // If the parent is also nested, ITS position is relative to ITS parent.
    // We need to walk up the entire ancestor chain to get true absolute position.
    const getAbsolutePosition = (nodeId: string): { x: number, y: number } => {
        const node = nodes.value.find(n => n.id === nodeId)
        if (!node) return { x: 0, y: 0 }

        // Sanitize node position
        const nodeX = Number.isNaN(node.position.x) ? 0 : node.position.x
        const nodeY = Number.isNaN(node.position.y) ? 0 : node.position.y

        if (!node.parentNode) {
            // No parent = position is already absolute
            return { x: nodeX, y: nodeY }
        }

        // Has parent: recursively get parent's absolute position and add this node's relative position
        const parentAbsolute = getAbsolutePosition(node.parentNode)
        return {
            x: parentAbsolute.x + nodeX,
            y: parentAbsolute.y + nodeY
        }
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
                    const durationMap: Record<string, number> = {
                        'quick': 15, 'short': 30, 'medium': 60, 'long': 120, 'unestimated': 0
                    }
                    updates.estimatedDuration = durationMap[keyword.value] ?? 0
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
                    // Map duration keyword to estimated minutes
                    const durationMap: Record<string, number> = {
                        'quick': 15,
                        'short': 30,
                        'medium': 60,
                        'long': 120,
                        'unestimated': 0
                    }
                    updates.estimatedDuration = durationMap[keyword.value] ?? 0
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
                    // Calculate absolute position
                    let absoluteX: number, absoluteY: number

                    if (taskNode.parentNode) {
                        const sectionId = taskNode.parentNode.replace('section-', '')
                        const section = canvasStore.sections.find(s => s.id === sectionId)
                        if (section) {
                            absoluteX = section.position.x + taskNode.position.x
                            absoluteY = section.position.y + taskNode.position.y
                        } else {
                            absoluteX = taskNode.position.x
                            absoluteY = taskNode.position.y
                        }
                    } else {
                        absoluteX = taskNode.position.x
                        absoluteY = taskNode.position.y
                    }

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
                    nodeDraggingTimeoutId.value = setTimeout(() => {
                        isNodeDragging.value = false
                    }, 50)
                    dragSettlingTimeoutId.value = setTimeout(() => {
                        isDragSettling.value = false
                    }, 500)
                    return
                }
                // Fall through to process sections below
            }
        }

        // Check if it's a section node or task node
        if (node.id.startsWith('section-')) {
            const sectionId = node.id.replace('section-', '')
            const section: CanvasSection | undefined = canvasStore.sections.find((s: CanvasSection) => s.id === sectionId)

            if (section) {
                // Clean up the stored position
                dragStartPositions.delete(node.id)

                // TASK-072 FIX: Use Vue Flow's native parent-child handling
                // When parentNode is set, Vue Flow automatically moves children with parent
                // We just need to:
                // 1. Calculate the section's new ABSOLUTE position
                // 2. Update store with absolute position
                // 3. Detect if section should be nested in another (set parentGroupId)
                // 4. Let syncNodes() handle the Vue Flow parentNode relationship

                // TASK-072 FIX: Use recursive helper for correct absolute position at ANY nesting depth
                // The old code only checked immediate parent, breaking for 3+ level nesting
                // (grandchild → child → parent) where child's position is also relative
                const absolutePos = getAbsolutePosition(node.id)
                const absoluteX = Number.isFinite(absolutePos.x) ? absolutePos.x : section.position.x
                const absoluteY = Number.isFinite(absolutePos.y) ? absolutePos.y : section.position.y

                console.log(`%c[TASK-072] DRAG STOP: "${section.name}"`, 'color: #4CAF50; font-weight: bold')
                console.log(`  Vue Flow pos: (${node.position.x.toFixed(0)}, ${node.position.y.toFixed(0)})${node.parentNode ? ' [relative]' : ' [absolute]'}`)
                console.log(`  Calculated absolute: (${absoluteX.toFixed(0)}, ${absoluteY.toFixed(0)})`)

                const oldBounds = {
                    x: section.position.x,
                    y: section.position.y,
                    width: section.position.width,
                    height: section.position.height
                }

                // TASK-072: Log child sections for debugging (Vue Flow manages them automatically)
                const sectionNodeId = `section-${sectionId}`
                const childSectionCount = nodes.value.filter(n =>
                    n.parentNode === sectionNodeId && n.id.startsWith('section-')
                ).length
                if (childSectionCount > 0) {
                    console.log(`  Child sections: ${childSectionCount} (Vue Flow auto-manages)`)
                }

                // Update dragged section's position in store (always absolute)
                const newWidth = node.style && typeof node.style === 'object' && 'width' in node.style ? parseInt(String(node.style.width)) : oldBounds.width
                const newHeight = node.style && typeof node.style === 'object' && 'height' in node.style ? parseInt(String(node.style.height)) : oldBounds.height

                // CRITICAL FIX: Lock BEFORE store update to prevent watcher race condition
                // Store update triggers watchers → syncNodes, lock must exist first
                lockGroupPosition(sectionId, {
                    x: absoluteX,
                    y: absoluteY,
                    width: newWidth,
                    height: newHeight
                }, 'drag')

                canvasStore.updateSectionWithUndo(sectionId, {
                    position: {
                        x: absoluteX,
                        y: absoluteY,
                        width: newWidth,
                        height: newHeight
                    }
                })

                // TASK-072 FIX: Do NOT update child section or task positions here!
                // Vue Flow manages children automatically when parentNode is set.
                // When parent drags, Vue Flow moves children visually (relative positions stay same).
                // See: https://vueflow.dev/examples/nodes/nesting.html

                // TASK-072: Manage parent-child relationship based on position
                const sectionArea = oldBounds.width * oldBounds.height

                // First, check if section with existing parent was dragged OUTSIDE that parent
                if (section.parentGroupId) {
                    const currentParent = canvasStore.sections.find(s => s.id === section.parentGroupId)
                    if (currentParent) {
                        // Check if we're still inside the current parent
                        const stillInside = (
                            absoluteX >= currentParent.position.x &&
                            absoluteY >= currentParent.position.y &&
                            absoluteX + oldBounds.width <= currentParent.position.x + currentParent.position.width &&
                            absoluteY + oldBounds.height <= currentParent.position.y + currentParent.position.height
                        )

                        if (!stillInside) {
                            console.log(`%c[TASK-072] Clearing parentGroupId: "${section.name}" dragged outside "${currentParent.name}"`, 'color: #E91E63; font-weight: bold')
                            canvasStore.updateSection(sectionId, { parentGroupId: null })

                            // TASK-072 FIX: Directly update Vue Flow node to remove parent relationship
                            const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                            if (nodeIndex !== -1) {
                                nodes.value[nodeIndex] = {
                                    ...nodes.value[nodeIndex],
                                    parentNode: undefined,
                                    position: { x: absoluteX, y: absoluteY },  // Convert to absolute
                                    style: {
                                        ...(nodes.value[nodeIndex].style as Record<string, any>),
                                        zIndex: 0  // Reset to base z-index when becoming top-level
                                    }
                                }
                                console.log(`  Updated Vue Flow node: parentNode=undefined, absPos=(${absoluteX.toFixed(0)}, ${absoluteY.toFixed(0)}), zIndex=0`)
                            }
                            // After clearing, continue to check if it landed in a NEW parent below
                        }
                    }
                }

                // Then, check if section was dropped inside another section (new parent)
                // Re-read section to get updated parentGroupId state
                const updatedSection = canvasStore.sections.find(s => s.id === sectionId)
                if (updatedSection && !updatedSection.parentGroupId) {
                    let containingParent: CanvasSection | null = null

                    const sections: CanvasSection[] = canvasStore.sections || []
                    sections.forEach((potentialParent: CanvasSection) => {
                        if (potentialParent.id === sectionId) return  // Skip self
                        if (potentialParent.parentGroupId === sectionId) return  // Skip our children

                        const parentArea = potentialParent.position.width * potentialParent.position.height
                        if (parentArea <= sectionArea) return  // Parent must be bigger

                        // Check if we're fully inside this potential parent
                        const isInside = (
                            absoluteX >= potentialParent.position.x &&
                            absoluteY >= potentialParent.position.y &&
                            absoluteX + oldBounds.width <= potentialParent.position.x + potentialParent.position.width &&
                            absoluteY + oldBounds.height <= potentialParent.position.y + potentialParent.position.height
                        )

                        if (isInside) {
                            // Prefer smallest containing parent (most immediate)
                            if (!containingParent || parentArea < (containingParent.position.width * containingParent.position.height)) {
                                containingParent = potentialParent
                            }
                        }
                    })

                    if (containingParent) {
                        const parent = containingParent as CanvasSection
                        console.log(`%c[TASK-072] Setting parentGroupId: "${updatedSection.name}" is now child of "${parent.name}"`, 'color: #FF9800; font-weight: bold')
                        canvasStore.updateSection(sectionId, { parentGroupId: parent.id })

                        // TASK-072 FIX: Directly update Vue Flow node's parentNode instead of calling syncNodes()
                        // syncNodes() rebuilds all nodes which breaks Vue Flow's automatic child positioning
                        const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                        if (nodeIndex !== -1) {
                            const parentNodeId = `section-${parent.id}`
                            // Convert to relative position for Vue Flow
                            const relativeX = absoluteX - parent.position.x
                            const relativeY = absoluteY - parent.position.y

                            // Calculate z-index: nested groups should render ABOVE their parents
                            // Get parent's z-index and add 1
                            const parentNode = nodes.value.find(n => n.id === parentNodeId)
                            const parentZIndex = (parentNode?.style as Record<string, any>)?.zIndex ?? 0
                            const childZIndex = (typeof parentZIndex === 'number' ? parentZIndex : parseInt(String(parentZIndex)) || 0) + 1

                            nodes.value[nodeIndex] = {
                                ...nodes.value[nodeIndex],
                                parentNode: parentNodeId,
                                position: { x: relativeX, y: relativeY },
                                style: {
                                    ...(nodes.value[nodeIndex].style as Record<string, any>),
                                    zIndex: childZIndex
                                }
                            }
                            console.log(`  Updated Vue Flow node: parentNode=${parentNodeId}, relPos=(${relativeX.toFixed(0)}, ${relativeY.toFixed(0)}), zIndex=${childZIndex}`)
                        }
                    }
                }

                console.log(`%c[TASK-072] DRAG COMPLETE - Vue Flow manages child positions`, 'color: #4CAF50; font-weight: bold')

                // TASK-072 FIX: Do NOT call syncNodes() after drag!
                // Vue Flow already moved children visually during drag.
                // Calling syncNodes() rebuilds all nodes and breaks the position consistency.
                // syncNodes() // REMOVED - was causing position resets
            }
        } else {
            // TASK-072: Start position cleanup moved to end of block


            // For task nodes, update position with improved section handling
            if (node.parentNode) {
                const sectionId = node.parentNode.replace('section-', '')
                const section = canvasStore.sections.find(s => s.id === sectionId)

                if (section) {
                    let absoluteX = section.position.x + node.position.x
                    let absoluteY = section.position.y + node.position.y

                    // CRITICAL FIX: Validate coordinates before any updates
                    if (Number.isNaN(absoluteX) || Number.isNaN(absoluteY)) {
                        console.warn(`⚠️ [TASK-089] NaN absolute position for task ${node.id} in section ${sectionId}`, { relPos: node.position, secPos: section.position })

                        // Try recovery from start position if available
                        const startPos = dragStartPositions.get(node.id)
                        if (startPos && !Number.isNaN(startPos.x) && !Number.isNaN(startPos.y)) {
                            console.log(`RECOVERY: Reverting to start position due to NaN calc`)
                            absoluteX = startPos.x
                            absoluteY = startPos.y

                            // FORCE VISUAL RECOVERY: Directly update Vue Flow node to kill NaNs
                            const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                            if (nodeIndex !== -1) {
                                // Calculate valid relative position for the visual node
                                const relativeX = absoluteX - section.position.x
                                const relativeY = absoluteY - section.position.y

                                nodes.value[nodeIndex] = {
                                    ...nodes.value[nodeIndex],
                                    position: { x: relativeX, y: relativeY }
                                }
                                // Also mutate the event node reference just in case
                                node.position.x = relativeX
                                node.position.y = relativeY
                            }
                        } else {
                            console.error('CRITICAL: Aborting update due to NaN calculation.')
                            dragStartPositions.delete(node.id)
                            isNodeDragging.value = false
                            isDragSettling.value = false
                            return
                        }
                    }

                    // CRITICAL FIX: Validate coordinates before any updates
                    if (Number.isNaN(absoluteX) || Number.isNaN(absoluteY)) {
                        console.warn(`⚠️ [TASK-089] NaN absolute position for task ${node.id} in section ${sectionId}`, { relPos: node.position, secPos: section.position })
                        // Fallback to relative if section position is corrupted, or just abort
                        if (!Number.isNaN(node.position.x) && !Number.isNaN(node.position.y)) {
                            // Try to use just relative position as absolute if section is weird? No, that's dangerous.
                            // Best to abort.
                            console.error('CRITICAL: Aborting update due to NaN calculation.')
                            isNodeDragging.value = false
                            isDragSettling.value = false
                            return
                        }
                    }

                    // BUG-FIX: Ensure absolute coordinates are finite
                    if (!Number.isFinite(absoluteX)) absoluteX = 0
                    if (!Number.isFinite(absoluteY)) absoluteY = 0

                    // CRITICAL FIX: Lock BEFORE store update to prevent watcher race condition
                    // Store update triggers watchers → syncNodes, lock must exist first
                    lockTaskPosition(node.id, { x: absoluteX, y: absoluteY })
                    // TASK-089 MEMORY FIX: Use updateTask instead of updateTaskWithUndo
                    // updateTaskWithUndo saves state TWICE per call, causing memory exhaustion during drag
                    // Position updates don't need undo - users can simply drag again
                    // TASK-089 FIX 9: Await position save to prevent data loss on refresh
                    try {
                        await taskStore.updateTask(node.id, {
                            canvasPosition: { x: absoluteX, y: absoluteY }
                        })
                    } catch (err) {
                        console.error(`[TASK-089] Failed to save position for task ${node.id}:`, err)
                    }

                    // Check if task moved outside the original section
                    if (!isTaskInSectionBounds(absoluteX, absoluteY, section)) {
                        console.log(`Task ${node.id} moved outside section ${sectionId}`)
                        const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                        if (nodeIndex !== -1) {
                            nodes.value[nodeIndex] = {
                                ...nodes.value[nodeIndex],
                                parentNode: undefined,
                                position: { x: absoluteX, y: absoluteY }
                            }
                        }
                    }
                }
            } else {
                // Check if starting position is stored
                const startPos = dragStartPositions.get(node.id)

                // CRITICAL FIX: Validate coordinates before any updates
                // If Vue Flow gives us NaN, we must fallback to start position or abort
                let targetX = node.position.x
                let targetY = node.position.y

                if (Number.isNaN(targetX) || Number.isNaN(targetY)) {
                    console.warn(`⚠️ [TASK-089] NaN position detected for task ${node.id} at drag stop!`, { pos: node.position, startPos })
                    if (startPos && !Number.isNaN(startPos.x) && !Number.isNaN(startPos.y)) {
                        targetX = startPos.x
                        targetY = startPos.y
                        console.log(`RECOVERY: Reverted to start position (${targetX}, ${targetY})`)

                        // FORCE VISUAL RECOVERY: Directly update Vue Flow node to kill NaNs
                        const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                        if (nodeIndex !== -1) {
                            nodes.value[nodeIndex] = {
                                ...nodes.value[nodeIndex],
                                position: { x: targetX, y: targetY }
                            }
                            // Also mutate the event node reference just in case
                            node.position.x = targetX
                            node.position.y = targetY
                        }
                    } else {
                        console.error('CRITICAL: No start position for recovery. Aborting update.')
                        dragStartPositions.delete(node.id)
                        isNodeDragging.value = false
                        isDragSettling.value = false
                        return
                    }
                }

                // CRITICAL FIX: Lock BEFORE store update to prevent watcher race condition
                lockTaskPosition(node.id, { x: targetX, y: targetY })

                // TASK-089 MEMORY FIX: Use updateTask instead of updateTaskWithUndo
                // updateTaskWithUndo saves state TWICE per call, causing memory exhaustion during drag
                // TASK-089 FIX 9: Await position save to prevent data loss on refresh
                try {
                    await taskStore.updateTask(node.id, {
                        canvasPosition: { x: targetX, y: targetY }
                    })
                } catch (err) {
                    console.error(`[TASK-089] Failed to save position for task ${node.id}:`, err)
                }
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

            // Cleanup start position AFTER use
            dragStartPositions.delete(node.id)

            // BUG-002 FIX: When multiple tasks are selected, skip automatic section containment changes
            // This preserves their relative positions. If containment changed individually per task,
            // some would get relative coords (inside section) while others get absolute coords,
            // breaking their visual arrangement.
            const isMultiDrag = selectedIdsBeforeDrag.length > 1 && selectedIdsBeforeDrag.includes(node.id)

            if (!isMultiDrag) {
                // Single task drag - apply section containment as usual
                const containingSection = getContainingSection(checkX, checkY)

                if (containingSection) {
                    // NESTED GROUPS: Apply properties from ALL containing sections
                    // This enables inheritance: drop on "High Priority" inside "Today" → gets both priority AND dueDate
                    applyAllNestedSectionProperties(node.id, checkX, checkY)
                }

                // TASK-072 FIX: Directly update Vue Flow node's parentNode instead of calling syncNodes()
                // syncNodes() rebuilds ALL nodes including sections, which breaks nested group positions
                const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                if (nodeIndex !== -1) {
                    const currentParentNode = nodes.value[nodeIndex].parentNode
                    const newParentNode = containingSection ? `section-${containingSection.id}` : undefined

                    // Only update if parentNode actually changed
                    if (currentParentNode !== newParentNode) {
                        console.log(`%c[TASK-072] Task parentNode change: ${currentParentNode} → ${newParentNode}`, 'color: #2196F3; font-weight: bold')

                        // Extract section IDs for task count updates
                        const oldSectionId = currentParentNode?.replace('section-', '')
                        const newSectionId = newParentNode?.replace('section-', '')

                        if (containingSection) {
                            // Convert to relative position
                            const relativeX = checkX - containingSection.position.x
                            const relativeY = checkY - containingSection.position.y
                            nodes.value[nodeIndex] = {
                                ...nodes.value[nodeIndex],
                                parentNode: newParentNode,
                                position: { x: relativeX, y: relativeY }
                            }
                        } else {
                            // No containing section - use absolute position
                            nodes.value[nodeIndex] = {
                                ...nodes.value[nodeIndex],
                                parentNode: undefined,
                                position: { x: checkX, y: checkY }
                            }
                        }

                        // TASK-072 FIX: Update task counts on affected sections immediately
                        // Without this, group headers show stale counts until next syncNodes()
                        updateSectionTaskCounts(oldSectionId, newSectionId)
                    }
                }
            } else {
                // Multi-drag: Keep existing parentNode to preserve relative positions
                console.log(`%c[BUG-002] Multi-drag detected - preserving parentNode for ${node.id}`, 'color: #9C27B0')
            }
            // syncNodes() // REMOVED - was causing section position resets (TASK-072)

            // Restore selection state
            if (selectedIdsBeforeDrag.length > 0) {
                canvasStore.setSelectedNodes(selectedIdsBeforeDrag)
                nodes.value.forEach(node => {
                    const nodeWithSelection = node as Node & { selected?: boolean }
                    nodeWithSelection.selected = selectedIdsBeforeDrag.includes(node.id)
                })
            }
        }

        // TASK-130 FIX: Restore original z-index for section nodes after drag completes
        // This happens in a microtask to let Vue Flow finish its updates first
        setTimeout(() => {
            dragOriginalZIndex.forEach((originalZIndex, nodeId) => {
                const nodeIndex = nodes.value.findIndex(n => n.id === nodeId)
                if (nodeIndex !== -1) {
                    // Get the correct z-index - either restored original or recalculated from nesting depth
                    const section = canvasStore.sections.find(s => `section-${s.id}` === nodeId)
                    let finalZIndex = originalZIndex ?? 0

                    // If section now has a parent, recalculate z-index based on nesting
                    if (section?.parentGroupId) {
                        // Calculate depth-based z-index
                        const getDepth = (groupId: string, depth = 0): number => {
                            const group = canvasStore.sections.find(s => s.id === groupId)
                            if (!group || !group.parentGroupId || depth > 10) return depth
                            return getDepth(group.parentGroupId, depth + 1)
                        }
                        finalZIndex = getDepth(section.id)
                    }

                    nodes.value[nodeIndex] = {
                        ...nodes.value[nodeIndex],
                        style: {
                            ...(nodes.value[nodeIndex].style as Record<string, any>),
                            zIndex: finalZIndex
                        }
                    }
                }
            })
            dragOriginalZIndex.clear()
        }, 100)

        // TASK-072 FIX: Use longer settling period to prevent watchers from resetting positions
        // The settling period blocks syncNodes from running after drag ends.
        // This gives time for:
        // 1. Store updates to propagate
        // 2. Watchers to fire and be blocked
        // 3. Vue Flow to stabilize positions
        nodeDraggingTimeoutId.value = setTimeout(() => {
            isNodeDragging.value = false
        }, 50)

        // TASK-072 FIX: Clear isDragSettling after a longer delay (500ms)
        // We capture the timeout ID so we can cancel it if a new drag starts
        dragSettlingTimeoutId.value = setTimeout(() => {
            isDragSettling.value = false
            console.log(`%c[TASK-072] Drag settling complete - syncNodes unblocked`, 'color: #4CAF50')
        }, 500)
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
