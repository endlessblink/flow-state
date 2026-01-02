import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Node } from '@vue-flow/core'

export const useCanvasInteractionStore = defineStore('canvasInteraction', () => {
    // Selection state
    const selectedNodeIds = ref<string[]>([])
    const multiSelectMode = ref(false)
    const multiSelectActive = ref(false)
    const selectionRect = ref<{ x: number; y: number; width: number; height: number } | null>(null)
    const selectionMode = ref<'rectangle' | 'lasso' | 'click'>('rectangle')
    const isSelecting = ref(false)

    // Connection mode state
    const connectMode = ref(false)
    const connectingFrom = ref<string | null>(null)

    // Actions
    const setSelectedNodes = (nodeIds: string[]) => {
        selectedNodeIds.value = nodeIds
    }

    const toggleConnectMode = () => {
        connectMode.value = !connectMode.value
        if (!connectMode.value) {
            connectingFrom.value = null
        }
    }

    const startConnection = (nodeId: string) => {
        connectingFrom.value = nodeId
        connectMode.value = true
    }

    const clearConnection = () => {
        connectingFrom.value = null
        connectMode.value = false
    }

    const toggleMultiSelectMode = () => {
        multiSelectMode.value = !multiSelectMode.value
        if (!multiSelectMode.value) {
            clearSelection()
        }
    }

    const setSelectionMode = (mode: 'rectangle' | 'lasso' | 'click') => {
        selectionMode.value = mode
    }

    const startSelection = (x: number, y: number) => {
        isSelecting.value = true
        selectionRect.value = { x, y, width: 0, height: 0 }
    }

    const updateSelection = (currentX: number, currentY: number) => {
        if (!isSelecting.value || !selectionRect.value) return

        const startX = selectionRect.value.x
        const startY = selectionRect.value.y

        selectionRect.value = {
            x: Math.min(startX, currentX),
            y: Math.min(startY, currentY),
            width: Math.abs(currentX - startX),
            height: Math.abs(currentY - startY)
        }
    }

    const endSelection = () => {
        isSelecting.value = false
    }

    const clearSelection = () => {
        selectedNodeIds.value = []
        selectionRect.value = null
        isSelecting.value = false
    }

    const selectNodesInRect = (rect: { x: number; y: number; width: number; height: number }, nodes: Node[]) => {
        const selectedIds: string[] = []

        nodes.forEach(node => {
            const nodeX = node.position.x
            const nodeY = node.position.y
            const nodeWidth = 200 // Approximate node width
            const nodeHeight = 80 // Approximate node height

            if (
                nodeX < rect.x + rect.width &&
                nodeX + nodeWidth > rect.x &&
                nodeY < rect.y + rect.height &&
                nodeY + nodeHeight > rect.y
            ) {
                selectedIds.push(node.id)
            }
        })

        selectedNodeIds.value = selectedIds
    }

    const toggleNodeSelection = (nodeId: string) => {
        const index = selectedNodeIds.value.indexOf(nodeId)
        if (index > -1) {
            selectedNodeIds.value.splice(index, 1)
        } else {
            selectedNodeIds.value.push(nodeId)
        }
    }

    return {
        selectedNodeIds,
        multiSelectMode,
        multiSelectActive,
        selectionRect,
        selectionMode,
        isSelecting,
        connectMode,
        connectingFrom,
        setSelectedNodes,
        toggleConnectMode,
        startConnection,
        clearConnection,
        toggleMultiSelectMode,
        setSelectionMode,
        startSelection,
        updateSelection,
        endSelection,
        clearSelection,
        selectNodesInRect,
        toggleNodeSelection
    }
})
