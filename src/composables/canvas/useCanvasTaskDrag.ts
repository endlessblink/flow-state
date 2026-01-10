import { type Ref, nextTick } from 'vue'
import { type Node } from '@vue-flow/core'
import { type Task, useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasParentChild } from './useCanvasParentChild'
import { useNodeAttachment } from './useNodeAttachment'
import { getTaskCenter } from '@/utils/geometry'
import { lockTaskPosition } from '@/utils/canvasStateLock'
import { getAbsoluteNodePosition } from '@/utils/canvasGraph'

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
    const { findSectionForTask, getSectionAbsolutePosition } = useCanvasParentChild(
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
    const processSingleTaskDrag = async (node: Node, _draggedNodes: Node[], selectedIdsBeforeDrag: string[]) => {
        // Check if starting position is stored (recovery)
        const startPos = deps.dragStartPositions.get(node.id)

        // Calculate ABSOLUTE position for tasks (even if inside groups)
        let targetX = node.position.x
        let targetY = node.position.y

        // Validate coordinates
        if (Number.isNaN(targetX) || Number.isNaN(targetY)) {
            if (startPos && !Number.isNaN(startPos.x) && !Number.isNaN(startPos.y)) {
                targetX = startPos.x
                targetY = startPos.y
                node.position = { x: targetX, y: targetY }
            } else {
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
                const affectedIds = new Set<string>()
                if (currentParentNode) affectedIds.add(currentParentNode.replace('section-', ''))
                if (containingSection) affectedIds.add(containingSection.id)

                if (containingSection) {
                    // FIX: Pass explicit absoluteX/absoluteY to ensure robust relative calculation
                    await attachNodeToParent(node.id, `section-${containingSection.id}`, { x: absoluteX, y: absoluteY })
                } else {
                    // ROBUST DETACHMENT: Use explicit coordinates due to drift
                    await detachNodeFromParent(node.id, { x: absoluteX, y: absoluteY })
                }

                // Update Counts
                await nextTick()
                const tasks = deps.filteredTasks.value || []
                affectedIds.forEach(id => {
                    deps.updateSingleSectionCount(id, tasks)
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
        const affectedGroupIds = new Set<string>()

        for (const taskNode of taskNodes) {
            // Get Absolute Position
            const absolutePos = getAbsoluteNodePosition(taskNode.id, deps.nodes.value)
            const absoluteX = absolutePos.x
            const absoluteY = absolutePos.y

            const containingSection = getContainingSection(absoluteX, absoluteY)
            const newParentNodeId = containingSection ? `section-${containingSection.id}` : undefined
            const currentParentId = taskNode.parentNode

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
                    // FIX: Pass explicit coordinates here too
                    await attachNodeToParent(taskNode.id, `section-${containingSection.id}`, { x: absoluteX, y: absoluteY })
                } else {
                    // ROBUST DETACHMENT: Use explicit coordinates
                    await detachNodeFromParent(taskNode.id, { x: absoluteX, y: absoluteY })
                }
            }

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

        // Restore Selection
        if (selectedIdsBeforeDrag.length > 0) {
            canvasStore.setSelectedNodes(selectedIdsBeforeDrag)
            deps.nodes.value.forEach(n => {
                if (selectedIdsBeforeDrag.includes(n.id)) {
                    (n as any).selected = true
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
        const selectedIdsBeforeDrag = [...canvasStore.selectedNodeIds]
        const isMultiDrag = draggedNodes.length > 1

        if (isMultiDrag) {
            const taskNodes = draggedNodes.filter(n => !n.id.startsWith('section-'))
            if (taskNodes.length > 0) {
                await processMultiTaskDrag(taskNodes, selectedIdsBeforeDrag)
            }
        } else {
            if (!node.id.startsWith('section-')) {
                await processSingleTaskDrag(node, draggedNodes, selectedIdsBeforeDrag)
            }
        }
    }

    return {
        handleTaskDragStop
    }
}
