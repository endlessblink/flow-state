import { type Ref, nextTick } from 'vue'
import { type Node } from '@vue-flow/core'
import { type Task, useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasParentChild } from './useCanvasParentChild'
import { useNodeAttachment } from './useNodeAttachment'
import { getTaskCenter, getAbsoluteNodePosition } from '@/utils/canvas/positionCalculator'
import { useCanvasOptimisticSync } from './useCanvasOptimisticSync'

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
    const { trackLocalChange, markSynced } = useCanvasOptimisticSync()

    // Use centralized parent-child logic
    const { findSectionForTask, getSectionAbsolutePosition } = useCanvasParentChild(
        deps.nodes,
        canvasStore.groups
    )

    // Use atomic attachment logic
    const { attachNodeToParent, detachNodeFromParent, getParentMetrics } = useNodeAttachment()

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
                // FIX: Account for parent border metrics
                const metrics = getParentMetrics(node.parentNode) || { borderLeft: 0, borderTop: 0, paddingLeft: 0, paddingTop: 0 }

                absoluteX = parentAbsPos.x + targetX + metrics.borderLeft
                absoluteY = parentAbsPos.y + targetY + metrics.borderTop
            }
        }

        // 1. Lock UI (Optimistic)
        trackLocalChange(node.id, 'task', { x: absoluteX, y: absoluteY })

        // 2. Update Store (Absolute)
        try {
            await taskStore.updateTask(node.id, {
                canvasPosition: { x: absoluteX, y: absoluteY }
            })
            markSynced(node.id)
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
                // Silently fail as this is additive 
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
            // Get Absolute Position - Manual Calculation to include metrics
            let absoluteX = taskNode.position.x
            let absoluteY = taskNode.position.y

            if (taskNode.parentNode) {
                const sectionId = taskNode.parentNode.replace('section-', '')
                const section = canvasStore.groups.find(s => s.id === sectionId)
                if (section) {
                    const parentAbsPos = getSectionAbsolutePosition(section)
                    const metrics = getParentMetrics(taskNode.parentNode) || { borderLeft: 0, borderTop: 0, paddingLeft: 0, paddingTop: 0 }
                    absoluteX = parentAbsPos.x + taskNode.position.x + metrics.borderLeft
                    absoluteY = parentAbsPos.y + taskNode.position.y + metrics.borderTop
                } else {
                    // Fallback to graph traversal if store info missing (shouldn't happen)
                    const absPos = getAbsoluteNodePosition(taskNode.id, deps.nodes.value)
                    absoluteX = absPos.x
                    absoluteY = absPos.y
                }
            }

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

            trackLocalChange(taskNode.id, 'task', { x: absoluteX, y: absoluteY })
            try {
                await taskStore.updateTask(taskNode.id, {
                    canvasPosition: { x: absoluteX, y: absoluteY }
                })
                markSynced(taskNode.id)
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
