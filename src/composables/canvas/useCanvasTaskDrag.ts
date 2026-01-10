import { type Ref, nextTick } from 'vue'
import { type Node } from '@vue-flow/core'
import { type Task, useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasParentChild } from './useCanvasParentChild'
import { useNodeAttachment } from './useNodeAttachment'
import { isTaskCenterInRect, getTaskCenter } from '@/utils/geometry'
import { lockTaskPosition } from '@/utils/canvasStateLock'

interface TaskDragDeps {
    nodes: Ref<Node[]>
    dragStartPositions: Map<string, { x: number; y: number }>
    filteredTasks: Ref<Task[]>
    // Helper to update task counts (extracted in previous phase)
    updateSingleSectionCount: (sectionId: string, tasks: Task[]) => void
    getAncestorGroupIds: (groupId: string) => string[]
    // Helper for applying properties
    applyAllNestedSectionProperties: (taskId: string, x: number, y: number) => void
}

export function useCanvasTaskDrag(deps: TaskDragDeps) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()

    // Use centralized parent-child logic
    const { findSectionForTask, getSectionAbsolutePosition, getAbsoluteNodePosition } = useCanvasParentChild(
        deps.nodes,
        canvasStore.groups
    )

    // Use atomic attachment logic
    const { attachNodeToParent, detachNodeFromParent } = useNodeAttachment()

    // --- Helper: Get Containment ---
    const getContainingSection = (x: number, y: number, w: number = 220, h: number = 100) => {
        const center = getTaskCenter(x, y, w, h)
        return findSectionForTask(center)
    }

    // --- Helper: Process Single Task Drag ---
    const processSingleTaskDrag = async (node: Node, draggedNodes: Node[], selectedIdsBeforeDrag: string[]) => {
        // Check if starting position is stored (recovery)
        const startPos = deps.dragStartPositions.get(node.id)

        // Calculate ABSOLUTE position for tasks (even if inside groups)
        let targetX = node.position.x
        let targetY = node.position.y

        // Validate coordinates
        if (Number.isNaN(targetX) || Number.isNaN(targetY)) {
            console.warn(`⚠️ [TASK-DRAG] NaN position detected for task ${node.id}`)
            if (startPos && !Number.isNaN(startPos.x) && !Number.isNaN(startPos.y)) {
                targetX = startPos.x
                targetY = startPos.y
                // Auto-correction
                // Note: This mutates the passed node object, which is usually fine in Vue Flow handlers
                node.position = { x: targetX, y: targetY }
            } else {
                // Critical failure fallback
                targetX = 0; targetY = 0;
            }
        }

        let absoluteX = targetX
        let absoluteY = targetY

        // If currently parented, convert relative to absolute
        if (node.parentNode) {
            const sectionId = node.parentNode.replace('section-', '')
            const section = canvasStore.groups.find(s => s.id === sectionId)
            if (section) {
                // Use robust absolute position lookup
                const parentAbsPos = getSectionAbsolutePosition(section)
                absoluteX = parentAbsPos.x + targetX
                absoluteY = parentAbsPos.y + targetY
            }
        }

        // 1. Lock UI (Absolute)
        lockTaskPosition(node.id, { x: absoluteX, y: absoluteY })

        // 2. Update Store (Absolute)
        try {
            await taskStore.updateTask(node.id, {
                canvasPosition: { x: absoluteX, y: absoluteY }
            })
        } catch (err) {
            console.error(`[TASK-DRAG] Failed to save position for task ${node.id}:`, err)
        }

        // 3. Check Containment (Center Point)
        // We use the calculated absolute position to verify where it lands visually
        const containingSection = getContainingSection(absoluteX, absoluteY)

        // 4. Apply Properties (Theme, etc.)
        if (containingSection) {
            try {
                deps.applyAllNestedSectionProperties(node.id, absoluteX, absoluteY)
            } catch (err) {
                console.error('Failed to apply nested properties:', err)
            }
        }

        // 5. Detect Parent Change
        const nodeIndex = deps.nodes.value.findIndex(n => n.id === node.id)
        if (nodeIndex !== -1) {
            const currentParentNode = deps.nodes.value[nodeIndex].parentNode
            const newParentNode = containingSection ? `section-${containingSection.id}` : undefined

            if (currentParentNode !== newParentNode) {
                console.log(`%c[TASK-DRAG] Parent Change: ${currentParentNode} -> ${newParentNode}`, 'color: #2196F3')

                // Track for count updates
                const affectedIds = new Set<string>()
                if (currentParentNode) affectedIds.add(currentParentNode.replace('section-', ''))
                if (containingSection) affectedIds.add(containingSection.id)


                // ATOMIC COORDINATE HANDOVER
                if (containingSection) {
                    // Attach to new parent (World -> Local)
                    const parentNodeId = `section-${containingSection.id}`
                    const result = await attachNodeToParent(node.id, parentNodeId)
                    if (result.success) {
                        console.log(`✅ [TASK-DRAG] Attached ${node.id} to ${parentNodeId}`)
                    }
                } else {
                    // Detach to root (Local -> World)
                    const result = await detachNodeFromParent(node.id)
                    if (result.success) {
                        // Explicitly clear parentId in data to be safe
                        if (deps.nodes.value[nodeIndex]) {
                            deps.nodes.value[nodeIndex].data = {
                                ...deps.nodes.value[nodeIndex].data,
                                parentId: undefined
                            }
                        }
                        console.log(`✅ [TASK-DRAG] Detached ${node.id}`)
                    }
                }

                // Update Counts
                await nextTick()
                const tasks = deps.filteredTasks.value || []
                affectedIds.forEach(id => {
                    deps.updateSingleSectionCount(id, tasks)
                    // Also update ancestors
                    deps.getAncestorGroupIds(id).forEach(ancestorId => {
                        deps.updateSingleSectionCount(ancestorId, tasks)
                    })
                })
            }
        }

        deps.dragStartPositions.delete(node.id)
    }

    // --- Helper: Process Multi-Task Drag ---
    const processMultiTaskDrag = async (taskNodes: Node[], selectedIdsBeforeDrag: string[]) => {
        console.log(`%c[MULTI-DRAG] Processing ${taskNodes.length} tasks`, 'color: #9C27B0')

        const affectedGroupIds = new Set<string>()

        for (const taskNode of taskNodes) {
            // Get Absolute Position
            // We use the shared utility which handles deep nesting
            const absolutePos = getAbsoluteNodePosition(taskNode.id, deps.nodes.value)
            const absoluteX = absolutePos.x
            const absoluteY = absolutePos.y

            // Check Containment
            const containingSection = getContainingSection(absoluteX, absoluteY)
            const newParentNodeId = containingSection ? `section-${containingSection.id}` : undefined
            const currentParentId = taskNode.parentNode

            // Parent Change Detection
            if (currentParentId !== newParentNodeId) {
                if (currentParentId) {
                    const oldGroupId = currentParentId.replace('section-', '')
                    affectedGroupIds.add(oldGroupId)
                    deps.getAncestorGroupIds(oldGroupId).forEach(id => affectedGroupIds.add(id))
                }
                if (newParentNodeId) {
                    const newGroupId = newParentNodeId.replace('section-', '')
                    affectedGroupIds.add(newGroupId)
                    deps.getAncestorGroupIds(newGroupId).forEach(id => affectedGroupIds.add(id))
                }

                if (containingSection) {
                    await attachNodeToParent(taskNode.id, `section-${containingSection.id}`)
                } else {
                    await detachNodeFromParent(taskNode.id)
                    // Update data cleanup
                    const nIndex = deps.nodes.value.findIndex(n => n.id === taskNode.id)
                    if (nIndex !== -1) {
                        deps.nodes.value[nIndex].data = { ...deps.nodes.value[nIndex].data, parentId: undefined }
                    }
                }
            }

            // Lock & Save Absolute Position
            lockTaskPosition(taskNode.id, { x: absoluteX, y: absoluteY })
            try {
                await taskStore.updateTask(taskNode.id, {
                    canvasPosition: { x: absoluteX, y: absoluteY }
                })
            } catch (err) {
                console.error(`Failed to update task ${taskNode.id}`, err)
            }

            deps.dragStartPositions.delete(taskNode.id)
        }

        // Restore Selection (often lost during drag operations in Vue Flow)
        if (selectedIdsBeforeDrag.length > 0) {
            canvasStore.setSelectedNodes(selectedIdsBeforeDrag)
            deps.nodes.value.forEach(n => {
                if (selectedIdsBeforeDrag.includes(n.id)) {
                    n.selected = true
                }
            })
        }

        // Updates Counts
        await nextTick()
        if (affectedGroupIds.size > 0) {
            const tasks = deps.filteredTasks.value || []
            affectedGroupIds.forEach(id => deps.updateSingleSectionCount(id, tasks))
        }
    }

    const handleTaskDragStop = async (node: Node, draggedNodes: Node[]) => {
        // Restore selection snapshot
        const selectedIdsBeforeDrag = [...canvasStore.selectedNodeIds]

        // Check for Multi-Drag
        // A multi-drag is defined by having multiple dragged nodes
        const isMultiDrag = draggedNodes.length > 1

        if (isMultiDrag) {
            // Filter strictly to task nodes
            const taskNodes = draggedNodes.filter(n => !n.id.startsWith('section-'))
            if (taskNodes.length > 0) {
                await processMultiTaskDrag(taskNodes, selectedIdsBeforeDrag)
            }
        } else {
            // Single Drag
            if (!node.id.startsWith('section-')) {
                await processSingleTaskDrag(node, draggedNodes, selectedIdsBeforeDrag)
            }
        }
    }

    return {
        handleTaskDragStop
    }
}
