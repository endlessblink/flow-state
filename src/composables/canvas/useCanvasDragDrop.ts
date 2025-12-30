import { type Ref, type ComputedRef, ref } from 'vue'
import { type Node } from '@vue-flow/core'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { shouldUseSmartGroupLogic, getSmartGroupType, detectPowerKeyword } from '@/composables/useTaskSmartGroups'
import { resolveDueDate } from '@/composables/useGroupSettings'

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

    // Helper: Check if task is inside a section
    const getContainingSection = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
        return canvasStore.sections.find(section => {
            const { x, y, width, height } = section.position
            const taskCenterX = taskX + taskWidth / 2
            const taskCenterY = taskY + taskHeight / 2

            // For collapsed sections, use the full/original height for containment detection
            const detectionHeight = section.isCollapsed ? height : height

            const isInside = (
                taskCenterX >= x &&
                taskCenterX <= x + width &&
                taskCenterY >= y &&
                taskCenterY <= y + detectionHeight
            )

            return isInside
        })
    }

    // TASK-072 FIX: Recursively calculate absolute position for any nesting depth
    // When a node has parentNode set, its position is RELATIVE to parent.
    // If the parent is also nested, ITS position is relative to ITS parent.
    // We need to walk up the entire ancestor chain to get true absolute position.
    const getAbsolutePosition = (nodeId: string): { x: number, y: number } => {
        const node = nodes.value.find(n => n.id === nodeId)
        if (!node) return { x: 0, y: 0 }

        if (!node.parentNode) {
            // No parent = position is already absolute
            return { x: node.position.x, y: node.position.y }
        }

        // Has parent: recursively get parent's absolute position and add this node's relative position
        const parentAbsolute = getAbsolutePosition(node.parentNode)
        return {
            x: parentAbsolute.x + node.position.x,
            y: parentAbsolute.y + node.position.y
        }
    }

    // TASK-072 FIX: Update section task counts without calling syncNodes()
    // This is called after a task moves between sections to update the visual count
    //
    // CRITICAL INSIGHT from Vue Flow docs (https://github.com/bcakmakoglu/vue-flow/discussions/920):
    // "useNode returns us the node object straight from the state - since the node obj is reactive,
    //  we can MUTATE it to update our nodes' data"
    //
    // The key is to MUTATE the existing node.data, NOT replace the node object.
    // Replacing the node breaks the reference that useNode() is watching in custom components.
    const updateSectionTaskCounts = (oldSectionId?: string, newSectionId?: string) => {
        const tasks = filteredTasks.value || []

        // Update old section's count (if task was moved out)
        if (oldSectionId) {
            const oldSectionNodeId = `section-${oldSectionId}`
            const newCount = canvasStore.getTaskCountInGroupRecursive(oldSectionId, tasks)

            // TASK-072 FIX: MUTATE the existing node.data, don't replace the node
            // This maintains the reactive reference that useNode() tracks
            const node = nodes.value.find(n => n.id === oldSectionNodeId)
            if (node && node.data) {
                node.data.taskCount = newCount
                console.log(`[TASK-072] MUTATED "${node.data?.name || oldSectionId}" taskCount: ${newCount}`)
            }
        }

        // Update new section's count (if task was moved in)
        if (newSectionId) {
            const newSectionNodeId = `section-${newSectionId}`
            const newCount = canvasStore.getTaskCountInGroupRecursive(newSectionId, tasks)

            // TASK-072 FIX: MUTATE the existing node.data, don't replace the node
            const node = nodes.value.find(n => n.id === newSectionNodeId)
            if (node && node.data) {
                node.data.taskCount = newCount
                console.log(`[TASK-072] MUTATED "${node.data?.name || newSectionId}" taskCount: ${newCount}`)
            }
        }
    }

    // Helper: Apply section properties to task
    const applySectionPropertiesToTask = (taskId: string, section: CanvasSection) => {
        const updates: Partial<Task> = {}

        // 1. UNIFIED APPROACH: Check for explicit assignOnDrop settings first
        if (section.assignOnDrop) {
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
        if (keyword) {

            switch (keyword.category) {
                case 'date':
                    taskStore.moveTaskToSmartGroup(taskId, keyword.value)
                    return

                case 'priority':
                    updates.priority = keyword.value as 'high' | 'medium' | 'low'
                    break

                case 'status':
                    updates.status = keyword.value as Task['status']
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

    // Handle node drag start
    const handleNodeDragStart = withVueFlowErrorBoundary('handleNodeDragStart', (event: { node: Node }) => {
        const { node } = event
        isNodeDragging.value = true
        // TASK-072 FIX: Also set isDragSettling to true immediately
        // This blocks syncNodes from the moment drag starts until settling period ends
        isDragSettling.value = true

        // TASK-072 FIX: Store starting position for accurate delta calculation
        // This is critical for nested sections where node.position is relative to parent
        dragStartPositions.set(node.id, { x: node.position.x, y: node.position.y })
    })

    // Handle node drag stop
    const handleNodeDragStop = withVueFlowErrorBoundary('handleNodeDragStop', (event: { node: Node }) => {
        const { node } = event

        // Preserve selection state during drag operations
        const selectedIdsBeforeDrag = [...canvasStore.selectedNodeIds]

        // Check if it's a section node or task node
        if (node.id.startsWith('section-')) {
            const sectionId = node.id.replace('section-', '')
            const section = canvasStore.sections.find(s => s.id === sectionId)

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
                let absoluteX = absolutePos.x
                let absoluteY = absolutePos.y

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
                canvasStore.updateSectionWithUndo(sectionId, {
                    position: {
                        x: absoluteX,
                        y: absoluteY,
                        width: node.style && typeof node.style === 'object' && 'width' in node.style ? parseInt(String(node.style.width)) : oldBounds.width,
                        height: node.style && typeof node.style === 'object' && 'height' in node.style ? parseInt(String(node.style.height)) : oldBounds.height
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

                    canvasStore.sections.forEach(potentialParent => {
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
                        console.log(`%c[TASK-072] Setting parentGroupId: "${section.name}" is now child of "${containingParent.name}"`, 'color: #FF9800; font-weight: bold')
                        canvasStore.updateSection(sectionId, { parentGroupId: containingParent.id })

                        // TASK-072 FIX: Directly update Vue Flow node's parentNode instead of calling syncNodes()
                        // syncNodes() rebuilds all nodes which breaks Vue Flow's automatic child positioning
                        const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                        if (nodeIndex !== -1) {
                            const parentNodeId = `section-${containingParent.id}`
                            // Convert to relative position for Vue Flow
                            const relativeX = absoluteX - containingParent.position.x
                            const relativeY = absoluteY - containingParent.position.y

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
            // TASK-072: Clean up stored start position for task nodes too
            dragStartPositions.delete(node.id)

            // For task nodes, update position with improved section handling
            if (node.parentNode) {
                const sectionId = node.parentNode.replace('section-', '')
                const section = canvasStore.sections.find(s => s.id === sectionId)

                if (section) {
                    const absoluteX = section.position.x + node.position.x
                    const absoluteY = section.position.y + node.position.y

                    taskStore.updateTaskWithUndo(node.id, {
                        canvasPosition: { x: absoluteX, y: absoluteY }
                    })

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
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: node.position.x, y: node.position.y }
                })
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

            const containingSection = getContainingSection(checkX, checkY)

            if (containingSection) {
                if (containingSection.type !== 'custom' || shouldUseSmartGroupLogic(containingSection.name)) {
                    applySectionPropertiesToTask(node.id, containingSection)
                }
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

        // TASK-072 FIX: Use longer settling period to prevent watchers from resetting positions
        // The settling period blocks syncNodes from running after drag ends.
        // This gives time for:
        // 1. Store updates to propagate
        // 2. Watchers to fire and be blocked
        // 3. Vue Flow to stabilize positions
        setTimeout(() => {
            isNodeDragging.value = false
        }, 50)

        // TASK-072 FIX: Clear isDragSettling after a longer delay (500ms)
        // This is the key fix for position resets - watchers trigger syncNodes after
        // isNodeDragging becomes false, but isDragSettling blocks them until
        // all store updates have fully propagated.
        setTimeout(() => {
            isDragSettling.value = false
            console.log(`%c[TASK-072] Drag settling complete - syncNodes unblocked`, 'color: #4CAF50')
        }, 500)
    })

    // Handle node drag (continuous during drag - kept lightweight)
    const handleNodeDrag = (_event: { node: Node }) => {
        // No-op for now - heavy operations should be in handleNodeDragStop
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
