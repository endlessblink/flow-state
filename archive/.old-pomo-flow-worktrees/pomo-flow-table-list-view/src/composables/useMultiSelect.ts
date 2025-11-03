/**
 * useMultiSelect Composable
 *
 * Provides a comprehensive multi-select system for task selection with:
 * - Single click selection
 * - Shift+Click range selection
 * - Ctrl/Cmd+Click toggle selection
 * - Ctrl/Cmd+A select all
 * - Escape to clear selection
 * - Keyboard navigation support
 */

import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

export interface UseMultiSelectOptions<T> {
  /** Array of items that can be selected */
  items: Ref<T[]>
  /** Function to get the unique ID of an item */
  getItemId: (item: T) => string
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: string[]) => void
  /** Enable keyboard shortcuts (default: true) */
  enableKeyboardShortcuts?: boolean
}

export function useMultiSelect<T>(options: UseMultiSelectOptions<T>) {
  const {
    items,
    getItemId,
    onSelectionChange,
    enableKeyboardShortcuts = true
  } = options

  // State
  const selectedIds = ref<Set<string>>(new Set())
  const lastSelectedId = ref<string | null>(null)

  // Computed
  const selectedCount = computed(() => selectedIds.value.size)

  const allSelected = computed(() => {
    return items.value.length > 0 && selectedIds.value.size === items.value.length
  })

  const someSelected = computed(() => {
    return selectedIds.value.size > 0 && selectedIds.value.size < items.value.length
  })

  const selectedItems = computed(() => {
    return items.value.filter(item => selectedIds.value.has(getItemId(item)))
  })

  const isSelected = (id: string) => {
    return selectedIds.value.has(id)
  }

  // Actions
  const selectItem = (id: string) => {
    selectedIds.value.add(id)
    lastSelectedId.value = id
    notifySelectionChange()
  }

  const deselectItem = (id: string) => {
    selectedIds.value.delete(id)
    notifySelectionChange()
  }

  const toggleItem = (id: string) => {
    if (selectedIds.value.has(id)) {
      deselectItem(id)
    } else {
      selectItem(id)
    }
  }

  const selectAll = () => {
    items.value.forEach(item => {
      selectedIds.value.add(getItemId(item))
    })
    notifySelectionChange()
  }

  const clearSelection = () => {
    selectedIds.value.clear()
    lastSelectedId.value = null
    notifySelectionChange()
  }

  const invertSelection = () => {
    const newSelection = new Set<string>()
    items.value.forEach(item => {
      const id = getItemId(item)
      if (!selectedIds.value.has(id)) {
        newSelection.add(id)
      }
    })
    selectedIds.value = newSelection
    notifySelectionChange()
  }

  /**
   * Handle range selection with Shift+Click
   */
  const selectRange = (startId: string, endId: string) => {
    const itemIds = items.value.map(getItemId)
    const startIndex = itemIds.indexOf(startId)
    const endIndex = itemIds.indexOf(endId)

    if (startIndex === -1 || endIndex === -1) return

    const minIndex = Math.min(startIndex, endIndex)
    const maxIndex = Math.max(startIndex, endIndex)

    for (let i = minIndex; i <= maxIndex; i++) {
      selectedIds.value.add(itemIds[i])
    }

    lastSelectedId.value = endId
    notifySelectionChange()
  }

  /**
   * Handle click with modifiers for advanced selection
   */
  const handleClick = (id: string, event?: MouseEvent) => {
    if (!event) {
      // Simple toggle if no event
      toggleItem(id)
      return
    }

    event.preventDefault()

    // Shift+Click: Range selection
    if (event.shiftKey && lastSelectedId.value) {
      selectRange(lastSelectedId.value, id)
      return
    }

    // Ctrl/Cmd+Click: Toggle individual item
    if (event.ctrlKey || event.metaKey) {
      toggleItem(id)
      return
    }

    // Regular click: Clear others and select this one
    clearSelection()
    selectItem(id)
  }

  /**
   * Notify parent of selection changes
   */
  const notifySelectionChange = () => {
    if (onSelectionChange) {
      onSelectionChange(Array.from(selectedIds.value))
    }
  }

  /**
   * Keyboard shortcuts handler
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    // Ctrl/Cmd+A: Select all
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      event.preventDefault()
      selectAll()
      return
    }

    // Escape: Clear selection
    if (event.key === 'Escape' && selectedIds.value.size > 0) {
      event.preventDefault()
      clearSelection()
      return
    }

    // Ctrl/Cmd+I: Invert selection
    if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
      event.preventDefault()
      invertSelection()
      return
    }
  }

  // Lifecycle
  if (enableKeyboardShortcuts) {
    onMounted(() => {
      document.addEventListener('keydown', handleKeyDown)
    })

    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeyDown)
    })
  }

  return {
    // State
    selectedIds: computed(() => Array.from(selectedIds.value)),
    selectedCount,
    allSelected,
    someSelected,
    selectedItems,

    // Methods
    isSelected,
    selectItem,
    deselectItem,
    toggleItem,
    selectAll,
    clearSelection,
    invertSelection,
    selectRange,
    handleClick
  }
}
