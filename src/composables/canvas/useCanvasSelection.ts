import { ref, reactive, type Ref, onMounted, onUnmounted } from 'vue'
import { type Node, useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'
import { useCanvasCore } from './useCanvasCore'

export interface SelectionBox {
    x: number
    y: number
    width: number
    height: number
    startX: number
    startY: number
    isVisible: boolean
}

export function useCanvasSelection(deps: {
    nodes: Ref<Node[]>
    applyNodeChanges: (changes: any[]) => void
}) {
    const { nodes, applyNodeChanges } = deps
    const canvasStore = useCanvasStore()
    const { getNodes } = useCanvasCore()

    // Selection state
    const selectionBox = reactive<SelectionBox>({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        startX: 0,
        startY: 0,
        isVisible: false
    })

    const selectedTask = ref<Task | null>(null)

    // --- NODE CLICK HANDLER (Migrated from CanvasView.vue) ---
    const handleNodeClick = (event: { event: MouseEvent | TouchEvent; node: Node }) => {
        const { node } = event
        const nodeId = node.id
        const currentSelection = [...canvasStore.selectedNodeIds]

        // Type guard for mouse event
        const mouseEvent = event.event as MouseEvent

        let newSelection: string[]

        // If Ctrl/Cmd OR Shift is held, toggle selection
        if (mouseEvent.ctrlKey || mouseEvent.metaKey || mouseEvent.shiftKey) {
            if (currentSelection.includes(nodeId)) {
                newSelection = currentSelection.filter(id => id !== nodeId)
            } else {
                newSelection = [...currentSelection, nodeId]
            }
        } else {
            // Standard behavior: Single click replaces selection
            newSelection = [nodeId]
        }

        // Update store
        canvasStore.selectedNodeIds = newSelection

        // Update Vue Flow's visual selection state
        const selectionChanges = nodes.value.map(n => ({
            id: n.id,
            type: 'select' as const,
            selected: newSelection.includes(n.id)
        }))
        applyNodeChanges(selectionChanges)
    }

    // --- SELECTION CHANGE HANDLER (Migrated from CanvasView.vue) ---
    const handleSelectionChange = (params: any) => {
        const newSelection = params?.nodes?.map((n: any) => n.id) ?? []
        canvasStore.selectedNodeIds = newSelection
    }

    // --- TASK SELECT HANDLER (From TaskNode.vue) ---
    const handleTaskSelect = (task: Task, multiSelect: boolean) => {
        if (!task.id) return

        let newSelection: string[]
        const currentSelection = [...canvasStore.selectedNodeIds]

        if (multiSelect) {
            if (currentSelection.includes(task.id)) {
                newSelection = currentSelection.filter(id => id !== task.id)
            } else {
                newSelection = [...currentSelection, task.id]
            }
        } else {
            newSelection = [task.id]
        }

        canvasStore.setSelectedNodes(newSelection)

        const selectionChanges = nodes.value.map(node => ({
            id: node.id,
            type: 'select' as const,
            selected: newSelection.includes(node.id)
        }))

        applyNodeChanges(selectionChanges)
    }

    // --- CLEAR SELECTION ---
    const clearSelection = () => {
        canvasStore.setSelectedNodes([])
        selectedTask.value = null

        nodes.value.forEach((node: any) => {
            if (node.selected) {
                node.selected = false
            }
        })
    }

    // --- RECTANGLE SELECTION HANDLERS ---
    const updateSelection = (event: MouseEvent) => {
        if (!selectionBox.isVisible) return
        const currentX = event.clientX
        const currentY = event.clientY
        selectionBox.width = Math.abs(currentX - selectionBox.startX)
        selectionBox.height = Math.abs(currentY - selectionBox.startY)
        selectionBox.x = Math.min(currentX, selectionBox.startX)
        selectionBox.y = Math.min(currentY, selectionBox.startY)
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
        window.addEventListener('mousemove', updateSelection)
        window.addEventListener('mouseup', endSelection)
        event.preventDefault()
        event.stopPropagation()
    }

    const endSelection = (_event: MouseEvent) => {
        window.removeEventListener('mousemove', updateSelection)
        window.removeEventListener('mouseup', endSelection)
        if (!selectionBox.isVisible) return

        const viewport = getViewportFromDOM()
        const flowContainer = document.querySelector('.vue-flow__container') || document.querySelector('.canvas-container')
        if (!flowContainer) return
        const rect = flowContainer.getBoundingClientRect()

        const involvedNodes = getNodes.value
        const selectedIds: string[] = []
        const boxLeft = selectionBox.x
        const boxTop = selectionBox.y
        const boxRight = selectionBox.x + selectionBox.width
        const boxBottom = selectionBox.y + selectionBox.height

        involvedNodes.forEach(node => {
            const { x: graphX, y: graphY } = getAbsolutePositionRecursive(node, involvedNodes)
            const graphW = Number(node.dimensions?.width ?? node.width ?? 200)
            const graphH = Number(node.dimensions?.height ?? node.height ?? 100)
            const screenX = (graphX * viewport.zoom) + viewport.x + rect.left
            const screenY = (graphY * viewport.zoom) + viewport.y + rect.top
            const screenW = graphW * viewport.zoom
            const screenH = graphH * viewport.zoom

            if (node.type === 'sectionNode') {
                const isFullyContained = (
                    screenX >= boxLeft && (screenX + screenW) <= boxRight &&
                    screenY >= boxTop && (screenY + screenH) <= boxBottom
                )
                if (isFullyContained) selectedIds.push(node.id)
                return
            }

            const intersects = (
                screenX < boxRight && (screenX + screenW) > boxLeft &&
                screenY < boxBottom && (screenY + screenH) > boxTop
            )
            if (intersects) selectedIds.push(node.id)
        })

        if (selectedIds.length > 0) {
            canvasStore.setSelectedNodes(selectedIds)
            const selectionChanges = nodes.value.map(node => ({
                id: node.id,
                type: 'select' as const,
                selected: selectedIds.includes(node.id)
            }))
            applyNodeChanges(selectionChanges)
        }
        selectionBox.isVisible = false
    }

    // --- RECURSIVE HELPERS FOR ABSOLUTE POSITIONS ---
    const getAbsolutePositionRecursive = (node: Node, allNodes: Node[]): { x: number, y: number } => {
        let x = node.position.x
        let y = node.position.y
        let parentId = node.parentNode
        while (parentId) {
            const parent = allNodes.find(n => n.id === parentId)
            if (parent) {
                x += parent.position.x
                y += parent.position.y
                parentId = parent.parentNode
            } else break
        }
        return { x, y }
    }

    const getViewportFromDOM = (): { x: number, y: number, zoom: number } => {
        const transformPane = document.querySelector('.vue-flow__transformationpane') as HTMLElement
        if (!transformPane) return { x: 0, y: 0, zoom: 1 }
        const transform = transformPane.style.transform
        const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/)
        return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]), zoom: parseFloat(match[3]) } : { x: 0, y: 0, zoom: 1 }
    }

    // --- GLOBAL INTERCEPTOR FOR SHIFT+CLICK ---
    const handleGlobalShiftClick = (e: MouseEvent) => {
        if (!e.shiftKey) return

        const elements = document.elementsFromPoint(e.clientX, e.clientY)
        const taskElement = elements.find(el =>
            el.classList.contains('task-node') ||
            el.classList.contains('vue-flow__node-taskNode')
        )

        if (taskElement) {
            e.stopPropagation()
            let taskId = taskElement.getAttribute('data-task-id')

            if (!taskId && taskElement.classList.contains('vue-flow__node-taskNode')) {
                const inner = taskElement.querySelector('.task-node')
                if (inner) taskId = inner.getAttribute('data-task-id')
                if (!taskId) taskId = taskElement.getAttribute('data-id')
            } else if (!taskId && taskElement.classList.contains('task-node')) {
                taskId = taskElement.getAttribute('data-task-id')
            }

            if (taskId) {
                const currentSelection = [...canvasStore.selectedNodeIds]
                let newSelection: string[]

                if (currentSelection.includes(taskId)) {
                    newSelection = currentSelection.filter(id => id !== taskId)
                } else {
                    newSelection = [...currentSelection, taskId]
                }

                canvasStore.setSelectedNodes(newSelection)

                if (nodes.value) {
                    const selectionChanges = nodes.value.map((n: any) => ({
                        id: n.id,
                        type: 'select' as const,
                        selected: newSelection.includes(n.id)
                    }))
                    applyNodeChanges(selectionChanges)
                }
            }
        }
    }

    onMounted(() => {
        window.addEventListener('mousedown', handleGlobalShiftClick, true)
    })

    onUnmounted(() => {
        window.removeEventListener('mousedown', handleGlobalShiftClick, true)
    })

    return {
        selectionBox,
        selectedTask,
        handleNodeClick,
        handleSelectionChange,
        handleTaskSelect,
        clearSelection,
        startSelection,
        updateSelection,
        endSelection
    }
}
