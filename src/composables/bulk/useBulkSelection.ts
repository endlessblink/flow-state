import { ref, computed } from 'vue'

export interface BulkSelectionActions {
    toggle: (id: string, event?: MouseEvent | KeyboardEvent) => void
    selectRange: (fromId: string, toId: string, allIds: string[]) => void
    selectAll: (ids: string[]) => void
    deselectAll: () => void
    isSelected: (id: string) => boolean
}

export function useBulkSelection() {
    const selectedIds = ref<Set<string>>(new Set())
    const lastSelectedId = ref<string | null>(null)

    const isSelectionActive = computed(() => selectedIds.value.size > 0)
    const selectionCount = computed(() => selectedIds.value.size)

    // -- Actions --

    const deselectAll = () => {
        selectedIds.value.clear()
        lastSelectedId.value = null
    }

    const selectAll = (ids: string[]) => {
        selectedIds.value = new Set(ids)
        lastSelectedId.value = ids[ids.length - 1] || null
    }

    const selectRange = (fromId: string, toId: string, allIds: string[]) => {
        const fromIndex = allIds.indexOf(fromId)
        const toIndex = allIds.indexOf(toId)

        if (fromIndex === -1 || toIndex === -1) return

        const start = Math.min(fromIndex, toIndex)
        const end = Math.max(fromIndex, toIndex)

        const idsToSelect = allIds.slice(start, end + 1)

        // Add range to existing selection
        idsToSelect.forEach(id => selectedIds.value.add(id))
    }

    const toggle = (id: string, event?: MouseEvent | KeyboardEvent, allIds: string[] = []) => {

        // Handle Shift+Click (Range Selection)
        if (event && (event as MouseEvent).shiftKey && lastSelectedId.value && allIds.length > 0) {
            selectRange(lastSelectedId.value, id, allIds)
            lastSelectedId.value = id // Update anchor
            return
        }

        // Handle Ctrl/Cmd+Click (Toggle) or simple check
        // Note: In typical "Selection Mode", simplified toggle is standard.
        // If not holding Ctrl, standard behavior might be "select only this", but for checkboxes it's always toggle.
        // We assume this is called from a Checkbox context, so it's always an additive toggle.

        if (selectedIds.value.has(id)) {
            selectedIds.value.delete(id)
            // If we deselect the anchor, do we clear it? 
            // Usually keeping it is fine for next range, or we can clear it.
            if (lastSelectedId.value === id) {
                lastSelectedId.value = null
            }
        } else {
            selectedIds.value.add(id)
            lastSelectedId.value = id
        }
    }

    const isSelected = (id: string) => selectedIds.value.has(id)

    return {
        // State
        selectedIds,
        lastSelectedId,
        isSelectionActive,
        selectionCount,

        // Actions
        toggle,
        selectRange,
        selectAll,
        deselectAll,
        isSelected
    }
}
