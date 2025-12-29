import { type Ref, type ComputedRef } from 'vue'
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
}

interface DragDropState {
    isNodeDragging: Ref<boolean>
}

// TASK-072 FIX: Store starting positions for correct delta calculation
// For nested sections, node.position is relative to parent, so we need to track
// the starting position in the SAME coordinate system to calculate delta
const dragStartPositions = new Map<string, { x: number; y: number }>()

export function useCanvasDragDrop(deps: DragDropDeps, state: DragDropState) {
    const { taskStore, canvasStore, nodes, filteredTasks, withVueFlowErrorBoundary, syncNodes } = deps
    const { isNodeDragging } = state

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

    // Helper: Check if a section is physically inside another section (for nested group detection)
    const isSectionInsideSection = (inner: CanvasSection, outer: CanvasSection): boolean => {
        // A section is "inside" another if its center is within the outer section's bounds
        const innerCenterX = inner.position.x + (inner.position.width / 2)
        const innerCenterY = inner.position.y + (inner.position.height / 2)

        return (
            innerCenterX >= outer.position.x &&
            innerCenterX <= outer.position.x + outer.position.width &&
            innerCenterY >= outer.position.y &&
            innerCenterY <= outer.position.y + outer.position.height &&
            inner.id !== outer.id  // Don't match self
        )
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
                // BUG-034 FIX: Save OLD section bounds BEFORE updating position
                // This is critical for correctly identifying tasks inside the section
                const oldBounds = {
                    x: section.position.x,
                    y: section.position.y,
                    width: section.position.width,
                    height: section.position.height
                }

                // TASK-072 FIX: Calculate position delta using SAME coordinate system
                // For nested sections, node.position is relative to parent, so we MUST use
                // the stored start position (also relative) to get correct delta
                const startPos = dragStartPositions.get(node.id) || { x: oldBounds.x, y: oldBounds.y }
                const deltaX = node.position.x - startPos.x
                const deltaY = node.position.y - startPos.y

                // Clean up the stored position
                dragStartPositions.delete(node.id)

                // BUG-034 FIX: Find tasks that are VISUALLY inside the section
                // First try Vue Flow's parentNode relationship
                const sectionNodeId = `section-${sectionId}`
                let tasksInSection = nodes.value
                    .filter(n => n.parentNode === sectionNodeId && !n.id.startsWith('section-'))
                    .map(n => taskStore.tasks.find(t => t.id === n.id))
                    .filter((t): t is Task => t !== undefined && t.canvasPosition !== undefined)

                // TASK-072 FIX: For nested groups, Vue Flow assigns tasks to outermost container
                // So parentNode check fails. Use physical containment as fallback.
                // CRITICAL: Use node.position (Vue Flow's position) which is accurate
                if (tasksInSection.length === 0) {
                    // For nested sections, node.position is RELATIVE to parent
                    // We need to calculate absolute position for bounds check
                    let absoluteX = node.position.x
                    let absoluteY = node.position.y

                    if (node.parentNode) {
                        // Find parent node in Vue Flow nodes array
                        const parentNode = nodes.value.find(n => n.id === node.parentNode)
                        if (parentNode) {
                            absoluteX = parentNode.position.x + node.position.x
                            absoluteY = parentNode.position.y + node.position.y
                        }
                    }

                    const visualBounds = {
                        x: absoluteX,
                        y: absoluteY,
                        width: oldBounds.width,
                        height: oldBounds.height
                    }

                    // Create a temporary section-like object with correct visual bounds
                    const visualSection = {
                        ...section,
                        position: visualBounds
                    }

                    tasksInSection = filteredTasks.value.filter(task => {
                        if (!task.canvasPosition) return false
                        return isTaskInSectionBounds(
                            task.canvasPosition.x,
                            task.canvasPosition.y,
                            visualSection as typeof section
                        )
                    })
                }

                // TASK-072 FIX: Find nested sections (child groups) that should move with parent
                // First try Vue Flow's parentNode relationship
                let nestedSectionsInParent = nodes.value
                    .filter(n => n.parentNode === sectionNodeId && n.id.startsWith('section-'))
                    .map(n => n.id.replace('section-', ''))

                // TASK-072 FIX: If no nested sections found via parentNode, use physical containment
                // This handles cases where groups are visually nested but don't have parentGroupId set
                if (nestedSectionsInParent.length === 0 && section) {
                    nestedSectionsInParent = canvasStore.sections
                        .filter(s => s.id !== sectionId && isSectionInsideSection(s, section))
                        .map(s => s.id)
                }

                // TASK-072 FIX: For nested sections, node.position is RELATIVE to parent
                // But the store expects ABSOLUTE positions. Convert before storing.
                let storeX = node.position.x
                let storeY = node.position.y
                if (node.parentNode) {
                    const parentNode = nodes.value.find(n => n.id === node.parentNode)
                    if (parentNode) {
                        storeX = parentNode.position.x + node.position.x
                        storeY = parentNode.position.y + node.position.y
                    }
                }

                // Update section position in store with ABSOLUTE coordinates
                canvasStore.updateSectionWithUndo(sectionId, {
                    position: {
                        x: storeX,
                        y: storeY,
                        width: node.style && typeof node.style === 'object' && 'width' in node.style ? parseInt(String(node.style.width)) : oldBounds.width,
                        height: node.style && typeof node.style === 'object' && 'height' in node.style ? parseInt(String(node.style.height)) : oldBounds.height
                    }
                })

                // TASK-072 FIX: Update nested section positions to maintain relative positioning
                // CRITICAL: Find tasks FIRST using OLD position, THEN update section, THEN move tasks
                nestedSectionsInParent.forEach(nestedSectionId => {
                    const nestedSection = canvasStore.sections.find(s => s.id === nestedSectionId)
                    if (nestedSection) {
                        // STEP 1: Find tasks PHYSICALLY inside nested section BEFORE updating position
                        // This is critical - we need OLD section bounds to match OLD task positions
                        const tasksInNestedSection = filteredTasks.value.filter(task => {
                            if (!task.canvasPosition) return false
                            return isTaskInSectionBounds(
                                task.canvasPosition.x,
                                task.canvasPosition.y,
                                nestedSection  // Still at OLD position here
                            )
                        })

                        // STEP 2: NOW update nested section position
                        canvasStore.updateSection(nestedSectionId, {
                            position: {
                                ...nestedSection.position,
                                x: nestedSection.position.x + deltaX,
                                y: nestedSection.position.y + deltaY
                            }
                        })

                        // STEP 3: Move the tasks we found earlier
                        tasksInNestedSection.forEach(task => {
                            if (task.canvasPosition) {
                                taskStore.updateTask(task.id, {
                                    canvasPosition: {
                                        x: task.canvasPosition.x + deltaX,
                                        y: task.canvasPosition.y + deltaY
                                    }
                                })
                            }
                        })
                    }
                })

                // TASK-072 FIX: Collect IDs of tasks already moved via nested sections to avoid double-moving
                const tasksAlreadyMoved = new Set<string>()
                nestedSectionsInParent.forEach(nestedSectionId => {
                    const nestedSection = canvasStore.sections.find(s => s.id === nestedSectionId)
                    if (nestedSection) {
                        filteredTasks.value.forEach(task => {
                            if (task.canvasPosition && isTaskInSectionBounds(task.canvasPosition.x, task.canvasPosition.y, nestedSection)) {
                                tasksAlreadyMoved.add(task.id)
                            }
                        })
                    }
                })

                // Update all child task positions to maintain relative positioning
                // BUT skip tasks that were already moved as part of nested sections
                tasksInSection.forEach(task => {
                    if (task.canvasPosition && !tasksAlreadyMoved.has(task.id)) {
                        const newX = task.canvasPosition.x + deltaX
                        const newY = task.canvasPosition.y + deltaY
                        taskStore.updateTaskWithUndo(task.id, {
                            canvasPosition: {
                                x: newX,
                                y: newY
                            }
                        })
                    }
                })

                console.log(`Section dragged: ${tasksInSection.length} tasks moved with it`)

                // TASK-072 FIX: Sync Vue Flow nodes after updating task positions in store
                // This ensures the visual position matches the store position
                syncNodes()
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

            // BUG-034 FIX: ALWAYS call syncNodes after task drag to update parentNode relationships
            // This ensures task count and group membership are always up-to-date
            syncNodes()

            // Restore selection state
            if (selectedIdsBeforeDrag.length > 0) {
                canvasStore.setSelectedNodes(selectedIdsBeforeDrag)
                nodes.value.forEach(node => {
                    const nodeWithSelection = node as Node & { selected?: boolean }
                    nodeWithSelection.selected = selectedIdsBeforeDrag.includes(node.id)
                })
            }
        }

        setTimeout(() => {
            isNodeDragging.value = false
        }, 50)
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
