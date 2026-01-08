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
        // Skip if we just did a manual Ctrl+click toggle (prevents Vue Flow from overriding)
        if (canvasStore.skipNextSelectionChange) {
            // Don't reset flag here - let handleNodesChange handle it after all events
            return
        }
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

    // Helper: Recursively calculate absolute position by summing parent offsets
    // This bypasses unreliable computedPosition for nested nodes
    const getAbsolutePosition = (node: Node, allNodes: Node[]): { x: number, y: number } => {
        let x = node.position.x
        let y = node.position.y
        let parentId = node.parentNode

        while (parentId) {
            const parent = allNodes.find(n => n.id === parentId)
            if (parent) {
                x += parent.position.x
                y += parent.position.y
                parentId = parent.parentNode
            } else {
                break // Parent not found or invalid
            }
        }
        return { x, y }
    }

    // Helper: Get viewport from DOM transform (more reliable than useVueFlow() in event handlers)
    const getViewportFromDOM = (): { x: number, y: number, zoom: number } => {
        const transformPane = document.querySelector('.vue-flow__transformationpane') as HTMLElement
        if (!transformPane) return { x: 0, y: 0, zoom: 1 }

        const transform = transformPane.style.transform
        const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/)
        if (match) {
            return {
                x: parseFloat(match[1]),
                y: parseFloat(match[2]),
                zoom: parseFloat(match[3])
            }
        }
        return { x: 0, y: 0, zoom: 1 }
    }

    const endSelection = (event: MouseEvent) => {
        // Clean up listeners immediately
        window.removeEventListener('mousemove', updateSelection)
        window.removeEventListener('mouseup', endSelection)

        if (!selectionBox.isVisible) return

        // Get viewport from DOM transform (useVueFlow() returns stale values in event handlers)
        const viewport = getViewportFromDOM()

        // 1. Get Canvas Bounds
        const flowContainer = document.querySelector('.vue-flow__container') || document.querySelector('.canvas-container')
        if (!flowContainer) {
            console.error('❌ [SELECTION] Cannot find flow container for projection')
            return
        }
        const rect = flowContainer.getBoundingClientRect()

        // 2. Screen-Space Intersection Strategy
        const nodes = getNodes.value
        const selectedIds: string[] = []
        const debugSample: any[] = []

        // Selection box bounds
        const boxLeft = selectionBox.x
        const boxTop = selectionBox.y
        const boxRight = selectionBox.x + selectionBox.width
        const boxBottom = selectionBox.y + selectionBox.height

        nodes.forEach(node => {
            // 1. Get Absolute Graph Position via Recursive Calculation
            const { x: graphX, y: graphY } = getAbsolutePosition(node, nodes)

            const graphW = Number(node.dimensions?.width ?? node.width ?? 200)
            const graphH = Number(node.dimensions?.height ?? node.height ?? 100)

            // 2. Project to Screen Space
            const screenX = (graphX * viewport.zoom) + viewport.x + rect.left
            const screenY = (graphY * viewport.zoom) + viewport.y + rect.top
            const screenW = graphW * viewport.zoom
            const screenH = graphH * viewport.zoom

            // 3. New Strategy for Sections:
            // Groups/Sections should ONLY be selected if they are FULLY CONTAINED within the selection box.
            // This prevents the common issue of accidentally selecting the parent group when
            // trying to rubber-band select tasks *inside* that group.
            if (node.type === 'sectionNode') {
                const isFullyContained = (
                    screenX >= boxLeft &&
                    (screenX + screenW) <= boxRight &&
                    screenY >= boxTop &&
                    (screenY + screenH) <= boxBottom
                )

                if (isFullyContained) {
                    selectedIds.push(node.id)
                }
                // If not fully contained, do not select (even if intersecting)
                return
            }

            // Standard intersection check for tasks and other nodes
            const intersects = (
                screenX < boxRight &&
                (screenX + screenW) > boxLeft &&
                screenY < boxBottom &&
                (screenY + screenH) > boxTop
            )

            if (intersects) {
                selectedIds.push(node.id)
            }

            if (node.parentNode || debugSample.length < 5) {
                debugSample.push({
                    id: node.id,
                    parent: node.parentNode,
                    posMode: 'RECURSIVE_CALC',
                    coords: { graphX, graphY, screenX: Math.round(screenX) },
                    box: { x: Math.round(selectionBox.x), y: Math.round(selectionBox.y), w: Math.round(selectionBox.width), h: Math.round(selectionBox.height) },
                    intersects
                })
            }
        })

        console.log('📐 [SELECTION ROBUST RECURSIVE]', {
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
