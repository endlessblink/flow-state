import { type Ref, type ComputedRef, ref } from 'vue'
import { type Node } from '@vue-flow/core'
import type { useTaskStore } from '../../stores/tasks'
import { type Task } from '../../stores/tasks'
import type { useCanvasStore } from '../../stores/canvas'

// Imported Composables
import { useCanvasTaskCounts } from './useCanvasTaskCounts'
import { useCanvasSectionProperties } from './useCanvasSectionProperties'
import { useCanvasParentChild } from './useCanvasParentChild'
import { useCanvasGroupDrag } from './useCanvasGroupDrag'
import { useCanvasTaskDrag } from './useCanvasTaskDrag'

interface DragDropDeps {
    taskStore: ReturnType<typeof useTaskStore>
    canvasStore: ReturnType<typeof useCanvasStore>
    nodes: Ref<Node[]>
    filteredTasks: ComputedRef<Task[]>
    withVueFlowErrorBoundary: (handlerName: string, handler: (...args: any[]) => any, options?: any) => any
    syncNodes: () => void
    setNodes?: (nodes: Node[]) => void
}

interface DragDropState {
    isNodeDragging: Ref<boolean>
    isDragSettling?: Ref<boolean>
}

// Global/Module State for continuity
const dragStartPositions = new Map<string, { x: number; y: number }>()

const _internalDragSettling = ref(false)
export const isDragSettlingRef = _internalDragSettling

export function useCanvasDragDrop(deps: DragDropDeps, state: DragDropState) {
    const { taskStore, canvasStore, nodes, filteredTasks, withVueFlowErrorBoundary } = deps
    const { isNodeDragging, isDragSettling = _internalDragSettling } = state

    // 1. Inherit Logic from previous phases
    // We still need task counts and section properties locally or passed to children
    // BUG-184 FIX: Pass taskStore directly to bypass filteredTasks cache for fresh count data
    const { updateSectionTaskCounts, updateSingleSectionCount, getAncestorGroupIds } = useCanvasTaskCounts({
        canvasStore,
        nodes,
        filteredTasks,
        taskStore
    })

    const { findAllContainingSections } = useCanvasParentChild(nodes, canvasStore.groups)

    const { applyAllNestedSectionProperties } = useCanvasSectionProperties({
        taskStore,
        getAllContainingSections: (x, y, w, h) => findAllContainingSections({ x, y, width: w, height: h })
    })

    // 2. Instantiate Strategies
    // Group Strategy
    const groupDragStrategy = useCanvasGroupDrag({
        nodes,
        dragStartPositions
    })

    // Task Strategy
    const taskDragStrategy = useCanvasTaskDrag({
        nodes,
        dragStartPositions,
        filteredTasks: filteredTasks as Ref<Task[]>,
        updateSingleSectionCount,
        getAncestorGroupIds,
        applyAllNestedSectionProperties
    })

    // 3. State Management
    const dragSettlingTimeoutId = ref<any>(null)

    const resetDragState = () => {
        if (dragSettlingTimeoutId.value) {
            clearTimeout(dragSettlingTimeoutId.value)
            dragSettlingTimeoutId.value = null
        }
        isNodeDragging.value = false
        isDragSettling.value = false
    }

    const startDragOriginalZIndex = new Map<string, number | undefined>()

    // 4. Orchestrate Drag Start
    const handleNodeDragStart = withVueFlowErrorBoundary('handleNodeDragStart', (event: { node: Node, nodes: Node[] }) => {
        resetDragState()
        const { nodes: draggedNodes } = event

        isNodeDragging.value = true
        isDragSettling.value = true

        startDragOriginalZIndex.clear()

        draggedNodes.forEach(node => {
            // Elevate Z-Index for Groups
            if (node.id.startsWith('section-')) {
                startDragOriginalZIndex.set(node.id, node.zIndex)
                const elevatedZIndex = 1000 + (typeof node.zIndex === 'number' ? node.zIndex : 0)
                const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
                if (nodeIndex !== -1) {
                    nodes.value[nodeIndex] = { ...nodes.value[nodeIndex], zIndex: elevatedZIndex }
                }
            }

            // Capture Valid Start Position
            let startX = node.position.x
            let startY = node.position.y

            if (Number.isNaN(startX) || Number.isNaN(startY)) {
                // Recovery Logic
                if (node.id.startsWith('section-')) {
                    const sectionId = node.id.replace('section-', '')
                    const section = canvasStore.groups.find(s => s.id === sectionId)
                    if (section) { startX = section.position.x; startY = section.position.y }
                } else {
                    const task = taskStore.tasks.find((t: Task) => t.id === node.id)
                    if (task?.canvasPosition) { startX = task.canvasPosition.x; startY = task.canvasPosition.y }
                }
                // Fallback
                if (Number.isNaN(startX)) startX = 0
                if (Number.isNaN(startY)) startY = 0

                // Apply immediate fix
                node.position.x = startX
                node.position.y = startY
                const idx = nodes.value.findIndex(n => n.id === node.id)
                if (idx !== -1) {
                    nodes.value[idx] = { ...nodes.value[idx], position: { x: startX, y: startY } }
                }
            }

            dragStartPositions.set(node.id, { x: startX, y: startY })
        })

    })

    // 5. Orchestrate Drag Stop
    const handleNodeDragStop = withVueFlowErrorBoundary('handleNodeDragStop', async (event: { node: Node, nodes: Node[] }) => {
        const { node, nodes: draggedNodes } = event

        try {
            // Determine Strategy and Delegate
            const isGroup = node.id.startsWith('section-')
            // Note: If multi-drag contains mixed types, Vue Flow usually triggers based on the "primary" node
            // calling both strategies safely is key

            // However, our strategies handle filtering internally
            // Group Strategy only handles Group logic
            // Task Strategy handles Task logic

            // Because draggedNodes can contain BOTH tasks and sections, we should ideally iterate or let strategies filter?
            // Current implemention:
            // handleTaskDragStop handles BOTH multi-task and single-task.
            // handleGroupDragStop handles atomic group movement.

            // If we have mixed selection, it's safer to separate them
            const hasGroups = draggedNodes.some(n => n.id.startsWith('section-'))
            const hasTasks = draggedNodes.some(n => !n.id.startsWith('section-'))

            if (hasGroups) {
                // Process each group individually (groups usually don't support multi-drag in PomoFlow yet, but safeguards exist)
                const groups = draggedNodes.filter(n => n.id.startsWith('section-'))
                for (const groupNode of groups) {
                    await groupDragStrategy.handleGroupDragStop(groupNode, draggedNodes)
                }
            }

            if (hasTasks) {
                // Trigger task strategy for the batch
                // The task strategy internally filters out non-task nodes from draggedNodes
                await taskDragStrategy.handleTaskDragStop(node, draggedNodes)
            }

        } catch (error) {
            console.error('❌ [DRAG-STOP] Error orchestrated:', error)
        } finally {
            // Global Cleanup
            isNodeDragging.value = false

            // Settling Period
            dragSettlingTimeoutId.value = setTimeout(() => {
                isDragSettling.value = false
            }, 800) // 800ms settling time
        }
    })

    return {
        handleNodeDragStart,
        handleNodeDragStop,
        // Also export legacy helpers if needed by other components, although they should eventually migrate
        updateSectionTaskCounts,
        isDragSettlingRef
    }
}
