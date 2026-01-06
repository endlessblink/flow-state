import { ref, reactive, computed } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useVueFlow } from '@vue-flow/core'
import type { Node } from '@vue-flow/core'
import type { Task } from '@/types/tasks'

export interface SelectionBox {
    x: number
    y: number
    width: number
    height: number
    startX: number
    startY: number
    isVisible: boolean
}

export function useCanvasSelection() {
    const canvasStore = useCanvasStore()
    const { project, getNodes } = useVueFlow()

    // State
    const selectedTask = ref<Task | null>(null)
    const isEditModalOpen = ref(false)
    const selectionBox = reactive<SelectionBox>({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        startX: 0,
        startY: 0,
        isVisible: false
    })

    // Actions
    const handleEditTask = (task: Task) => {
        selectedTask.value = task
        isEditModalOpen.value = true
    }

    const closeEditModal = () => {
        isEditModalOpen.value = false
        selectedTask.value = null
    }

    const handleSelectionChange = (params: { nodes: Node[] }) => {
        const selectedNodeIds = params.nodes.map(n => n.id)
        canvasStore.setSelectedNodes(selectedNodeIds)
    }

    const clearSelection = () => {
        canvasStore.setSelectedNodes([])
        selectedTask.value = null
    }

    // Rubber Band Selection Logic
    const updateSelection = (event: MouseEvent) => {
        if (!selectionBox.isVisible) return

        const currentX = event.clientX
        const currentY = event.clientY

        const width = Math.abs(currentX - selectionBox.startX)
        const height = Math.abs(currentY - selectionBox.startY)
        const x = Math.min(currentX, selectionBox.startX)
        const y = Math.min(currentY, selectionBox.startY)

        selectionBox.x = x
        selectionBox.y = y
        selectionBox.width = width
        selectionBox.height = height
    }

    const endSelection = (event: MouseEvent) => {
        // Clean up listeners immediately
        window.removeEventListener('mousemove', updateSelection)
        window.removeEventListener('mouseup', endSelection)

        if (!selectionBox.isVisible) return

        const { viewport } = useVueFlow()

        // 1. Get Canvas Bounds (to convert screen -> relative canvas coords)
        const flowContainer = document.querySelector('.vue-flow__container') || document.querySelector('.canvas-container')
        if (!flowContainer) {
            console.error('❌ [SELECTION] Cannot find flow container for projection')
            return
        }
        const rect = flowContainer.getBoundingClientRect()

        // 2. Calculate Selection Box in Screen Space relative to Canvas
        // (selectionBox.x is clientX, so subtract rect.left)
        const boxScreenX = selectionBox.x - rect.left
        const boxScreenY = selectionBox.y - rect.top

        // 3. Screen-Space Intersection Strategy
        // We match "What I See" (Screen Pixels) with "Where Nodes Are" (Projected to Screen)
        const nodes = getNodes.value
        const selectedIds: string[] = []

        // Debug info
        const debugSample: any[] = []

        nodes.forEach(node => {
            // Debug: Check if computedPosition is trustworthy
            const hasParent = !!node.parentNode
            const isChild = hasParent

            // 1. Get Absolute Graph Position
            // HYPOTHESIS: computedPosition might be missing/wrong for children
            let graphX = node.computedPosition?.x
            let graphY = node.computedPosition?.y

            // Fallback for debugging - check if we are falling back to relative
            const isFallback = graphX === undefined
            if (isFallback) {
                graphX = node.position.x
                graphY = node.position.y
            }

            const graphW = Number(node.dimensions?.width ?? node.width ?? 200)
            const graphH = Number(node.dimensions?.height ?? node.height ?? 100)

            // 2. Project to Screen Space
            const screenX = (graphX! * viewport.value.zoom) + viewport.value.x + rect.left
            const screenY = (graphY! * viewport.value.zoom) + viewport.value.y + rect.top
            const screenW = graphW * viewport.value.zoom
            const screenH = graphH * viewport.value.zoom

            // 3. Check Intersection
            const intersects = (
                screenX < (selectionBox.x + selectionBox.width) &&
                (screenX + screenW) > selectionBox.x &&
                screenY < (selectionBox.y + selectionBox.height) &&
                (screenY + screenH) > selectionBox.y
            )

            if (intersects) {
                selectedIds.push(node.id)
            }

            // Extensive log for child nodes (inside groups)
            if (isChild || debugSample.length < 5) {
                debugSample.push({
                    id: node.id,
                    parent: node.parentNode,
                    posMode: isFallback ? 'RELATIVE (Fallback)' : 'ABSOLUTE (Computed)',
                    coords: { graphX, graphY, screenX: Math.round(screenX) },
                    box: { l: Math.round(selectionBox.x), r: Math.round(selectionBox.x + selectionBox.width) },
                    intersects
                })
            }
        })

        console.log('📐 [SELECTION DEBUG FINAL]', {
            found: selectedIds.length,
            box: { l: selectionBox.x, t: selectionBox.y, w: selectionBox.width, h: selectionBox.height },
            sample: debugSample
        })

        if (selectedIds.length > 0) {
            canvasStore.setSelectedNodes(selectedIds)
        } else {
            console.log('❌ No nodes intersected in screen space.')
        }

        selectionBox.isVisible = false
        selectionBox.width = 0
        selectionBox.height = 0
    }

    const startSelection = (event: MouseEvent) => {
        if (!event.shiftKey) return

        const { clientX, clientY } = event

        selectionBox.startX = clientX
        selectionBox.startY = clientY
        selectionBox.x = clientX
        selectionBox.y = clientY
        selectionBox.width = 0
        selectionBox.height = 0
        selectionBox.isVisible = true

        // Attach to window to handle drags outside canvas
        window.addEventListener('mousemove', updateSelection)
        window.addEventListener('mouseup', endSelection)

        event.preventDefault() // Prevent text selection
        event.stopPropagation() // Prevent Vue Flow panning
    }

    // Visual Helpers
    const getNodeColor = (node: Node) => {
        if (node.type === 'sectionNode') return 'rgba(99, 102, 241, 0.15)'
        const task = (node.data as any)?.task
        if (!task) return '#94a3b8' // Slate-400
        if (task.status === 'done') return '#10b981' // Emerald-500
        if (task.status === 'in-progress') return '#3b82f6' // Blue-500
        return '#94a3b8'
    }

    return {
        selectedTask,
        isEditModalOpen,
        selectionBox,
        handleEditTask,
        closeEditModal,
        handleSelectionChange,
        clearSelection,
        startSelection,
        updateSelection,
        endSelection,
        getNodeColor
    }
}

