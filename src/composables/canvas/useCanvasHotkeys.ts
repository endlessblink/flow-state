import type { Ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'

interface BulkDeleteState {
    isBulkDeleteModalOpen: Ref<boolean>
    bulkDeleteItems: Ref<{ id: string; name: string; type: 'task' | 'section' }[]>
    bulkDeleteIsPermanent: Ref<boolean>
    createGroup: (position?: { x: number; y: number }) => Promise<string | undefined>
}

export function useCanvasHotkeys(
    deps: BulkDeleteState
) {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    const { getSelectedNodes, toObject } = useVueFlow()

    // Handle Delete Key
    const handleKeyDown = async (event: KeyboardEvent) => {
        // Handle Creation Hotkeys
        if (event.shiftKey && (event.key === 'G' || event.key === 'g')) {
            event.preventDefault()
            // Create group at center of viewport
            const viewport = toObject().viewport
            // Calculate center: -x/zoom + width/2/zoom
            // Simple approximation or just let createGroup handle default (center)
            await deps.createGroup()
            return
        }

        const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'

        if (!isDeleteKey) return

        // Input protection
        const target = event.target as HTMLElement | null
        if (target) {
            const tagName = target.tagName
            const isEditable = tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable
            if (isEditable && !event.shiftKey) return
        }

        // Check for selected nodes
        // Use canvasStore source of truth if possible, or VueFlow
        const selectedNodes = getSelectedNodes.value
        if (!selectedNodes || selectedNodes.length === 0) return

        event.preventDefault()
        const permanentDelete = event.shiftKey

        // Collect all items to delete - show ONE confirmation for all
        const itemsToDelete: { id: string; name: string; type: 'task' | 'section' }[] = []

        for (const node of selectedNodes) {
            if (node.id.startsWith('section-')) {
                const sectionId = node.id.replace('section-', '')
                const section = canvasStore.sections.find(s => s.id === sectionId)

                itemsToDelete.push({
                    id: sectionId,
                    name: section?.name || 'Unknown Section',
                    type: 'section'
                })
            } else {
                const task = taskStore.getTask(node.id)
                itemsToDelete.push({
                    id: node.id,
                    name: task?.title || 'Unknown Task',
                    type: 'task'
                })
            }
        }

        if (itemsToDelete.length === 0) return

        if (itemsToDelete.length === 0) return

        // Show bulk delete confirmation modal
        deps.bulkDeleteItems.value = itemsToDelete
        deps.bulkDeleteIsPermanent.value = permanentDelete
        deps.isBulkDeleteModalOpen.value = true
    }

    // Register listener
    // We can attach to window or let Vue Flow handle usage via @keydown
    // The original implementation was passed to @keydown on VueFlow component
    // so we should just return the handler.

    return {
        handleKeyDown
    }
}
