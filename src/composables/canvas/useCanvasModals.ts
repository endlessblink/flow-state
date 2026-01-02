import { ref, computed } from 'vue'
import type { CanvasSection } from '@/stores/canvas/types'

export function useCanvasModals() {
    // Group Modal state (unified modal for create + edit with smart settings)
    const isGroupModalOpen = ref(false)
    const selectedGroup = ref<CanvasSection | null>(null)
    const groupModalPosition = ref({ x: 100, y: 100 })

    // Group Edit Modal state
    const isGroupEditModalOpen = ref(false)
    const selectedSectionForEdit = ref<CanvasSection | null>(null)

    // Group Delete Confirmation Modal state
    const isDeleteGroupModalOpen = ref(false)
    const groupPendingDelete = ref<CanvasSection | null>(null)

    // Delete group confirmation message
    const deleteGroupMessage = computed(() => {
        if (!groupPendingDelete.value) return 'Delete this group?'
        return `Delete "${groupPendingDelete.value.name}" group? Tasks inside will remain on the canvas.`
    })

    // Bulk Delete Confirmation Modal state (for Shift+Delete on multiple items)
    const isBulkDeleteModalOpen = ref(false)
    const bulkDeleteItems = ref<{ id: string; name: string; type: 'task' | 'section' }[]>([])
    const bulkDeleteIsPermanent = ref(false)

    // Bulk delete confirmation message
    const bulkDeleteMessage = computed(() => {
        const count = bulkDeleteItems.value.length
        if (count === 0) return ''

        const taskCount = bulkDeleteItems.value.filter(i => i.type === 'task').length
        const sectionCount = bulkDeleteItems.value.filter(i => i.type === 'section').length

        const parts: string[] = []
        if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`)
        if (sectionCount > 0) parts.push(`${sectionCount} group${sectionCount > 1 ? 's' : ''}`)

        const itemsText = parts.join(' and ')

        if (bulkDeleteIsPermanent.value) {
            return `Permanently delete ${itemsText}? This cannot be undone.`
        } else {
            return `Remove ${itemsText} from canvas? Tasks will be moved to inbox.`
        }
    })

    // Bulk delete title
    const bulkDeleteTitle = computed(() => {
        if (bulkDeleteIsPermanent.value) {
            return 'Delete Items Permanently'
        }
        return 'Remove from Canvas'
    })

    return {
        // State
        isGroupModalOpen,
        selectedGroup,
        groupModalPosition,
        isGroupEditModalOpen,
        selectedSectionForEdit,
        isDeleteGroupModalOpen,
        groupPendingDelete,
        isBulkDeleteModalOpen,
        bulkDeleteItems,
        bulkDeleteIsPermanent,

        // Computed
        deleteGroupMessage,
        bulkDeleteMessage,
        bulkDeleteTitle
    }
}
