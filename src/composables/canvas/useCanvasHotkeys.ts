import type { Ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { CanvasIds } from '@/utils/canvas/canvasIds'

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
    const { getSelectedNodes } = useVueFlow()

    // Handle Delete Key
    const handleKeyDown = async (event: KeyboardEvent) => {
        // Input protection - skip hotkeys when user is typing in input fields or modals
        const target = event.target as HTMLElement | null
        if (target) {
            const tagName = target.tagName
            const isEditable = tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable
            // Also check if we're inside a modal/dialog
            const isInModal = target.closest('[role="dialog"], .modal, .n-modal, .n-dialog')
            if (isEditable || isInModal) {
                // Allow normal typing - don't intercept hotkeys
                return
            }
        }

        // Handle Creation Hotkeys - Shift+G creates a group
        if (event.shiftKey && (event.key === 'G' || event.key === 'g')) {
            event.preventDefault()
            // Create group at center of viewport (createGroup handles positioning)
            await deps.createGroup()
            return
        }

        const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'

        if (!isDeleteKey) return

        // Check for selected nodes
        // Use canvasStore source of truth if possible, or VueFlow
        const selectedNodes = getSelectedNodes.value
        if (!selectedNodes || selectedNodes.length === 0) return

        event.preventDefault()
        const permanentDelete = event.shiftKey

        // Collect all items to delete - show ONE confirmation for all
        const itemsToDelete: { id: string; name: string; type: 'task' | 'section' }[] = []

        for (const node of selectedNodes) {
            if (CanvasIds.isGroupNode(node.id)) {
                const { id: sectionId } = CanvasIds.parseNodeId(node.id)
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
