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

    // Helper: Apply section properties to task
    const applySectionPropertiesToTask = (taskId: string, section: CanvasSection) => {
        console.log('[applySectionPropertiesToTask] Called with:', {
            taskId,
            sectionName: section.name,
            sectionType: section.type,
            assignOnDrop: section.assignOnDrop,
            propertyValue: section.propertyValue
        })

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
                console.log('[applySectionPropertiesToTask] Applying assignOnDrop updates:', updates)
                taskStore.updateTaskWithUndo(taskId, updates)
                return
            }
        }

        // 2. AUTO-DETECT: If no assignOnDrop settings, try keyword detection on section name
        const keyword = detectPowerKeyword(section.name)
        if (keyword) {
            console.log('[applySectionPropertiesToTask] Auto-detected keyword:', keyword)

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
                console.log('[applySectionPropertiesToTask] Applying keyword-based updates:', updates)
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

        if (node.id.startsWith('section-')) {
            const sectionId = node.id.replace('section-', '')
            const section = canvasStore.sections.find(s => s.id === sectionId)
            if (section) {
                console.log(`Started dragging section: ${section.name}`)
            }
        }
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

                // Calculate position delta
                const deltaX = node.position.x - oldBounds.x
                const deltaY = node.position.y - oldBounds.y

                // DEBUG: Log section bounds and all task positions
                console.log('🔍 BUG-034 DEBUG: Section drag detected', {
                    sectionId,
                    oldBounds,
                    newPosition: { x: node.position.x, y: node.position.y },
                    delta: { deltaX, deltaY }
                })

                // BUG-034 FIX: Find tasks that are VISUALLY inside the section
                // Use Vue Flow's parentNode relationship (set by syncNodes based on visual containment)
                // This is more reliable than re-checking bounds against stored positions
                const sectionNodeId = `section-${sectionId}`
                const tasksInSection = nodes.value
                    .filter(n => n.parentNode === sectionNodeId && !n.id.startsWith('section-'))
                    .map(n => taskStore.tasks.find(t => t.id === n.id))
                    .filter((t): t is Task => t !== undefined && t.canvasPosition !== undefined)

                console.log(`🔍 BUG-034: Found ${tasksInSection.length} child tasks for section "${section.name}"`,
                    tasksInSection.map(t => ({ id: t.id, title: t.title?.substring(0, 15) })))

                // Update section position in store
                canvasStore.updateSectionWithUndo(sectionId, {
                    position: {
                        x: node.position.x,
                        y: node.position.y,
                        width: node.style && typeof node.style === 'object' && 'width' in node.style ? parseInt(String(node.style.width)) : oldBounds.width,
                        height: node.style && typeof node.style === 'object' && 'height' in node.style ? parseInt(String(node.style.height)) : oldBounds.height
                    }
                })

                // Update all child task positions to maintain relative positioning
                tasksInSection.forEach(task => {
                    if (task.canvasPosition) {
                        taskStore.updateTaskWithUndo(task.id, {
                            canvasPosition: {
                                x: task.canvasPosition.x + deltaX,
                                y: task.canvasPosition.y + deltaY
                            }
                        })
                    }
                })

                console.log(`Section dragged: ${tasksInSection.length} tasks moved with it`)
            }
        } else {
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
            console.log('[handleNodeDragStop] Found section:', containingSection ? { name: containingSection.name, type: containingSection.type } : 'null')

            if (containingSection) {
                if (containingSection.type !== 'custom' || shouldUseSmartGroupLogic(containingSection.name)) {
                    console.log('[handleNodeDragStop] Applying properties for section:', containingSection.name)
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

    // Handle node drag
    const handleNodeDrag = (event: { node: Node }) => {
        const { node } = event
        if (node.id.startsWith('section-')) {
            const sectionId = node.id.replace('section-', '')
            const section = canvasStore.sections.find(s => s.id === sectionId)
            if (section) {
                console.log(`Dragging section: ${section.name}`)
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
