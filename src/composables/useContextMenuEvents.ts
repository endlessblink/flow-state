/**
 * Context Menu Event Handling Composable
 *
 * Provides unified event handling for context menus to ensure:
 * - Consistent behavior across all context menus
 * - Proper click-outside detection
 * - Event cleanup to prevent memory leaks
 * - Prevented premature menu closure
 *
 * FIXED (2025-11-29): Now accepts reactive isVisible via refs or getters
 */

import { onMounted, onUnmounted, nextTick, type Ref, isRef, toValue } from 'vue'

export interface useContextMenuEventsOptions {
  isVisible: boolean | Ref<boolean> | (() => boolean)
  menuRef: { value: HTMLElement | null }
  closeCallback: () => void
  preventCloseOnMenuClick?: boolean
}

export function useContextMenuEvents(options: useContextMenuEventsOptions) {
  const { menuRef, closeCallback, preventCloseOnMenuClick = true } = options

  // Helper to get current visibility (works with boolean, ref, or getter)
  const getIsVisible = () => toValue(options.isVisible)

  let clickHandler: (event: MouseEvent) => void
  let keyHandler: (event: KeyboardEvent) => void
  let contextMenuHandler: (event: MouseEvent) => void

  const handleClickOutside = (event: MouseEvent) => {
    if (!getIsVisible() || !menuRef.value) return

    // Check if click is inside the menu
    const target = event.target as Node
    if (menuRef.value.contains(target)) {
      return // Click inside menu, don't close
    }

    // Close menu when clicking outside
    closeCallback()
  }

  const handleKeyEscape = (event: KeyboardEvent) => {
    if (!getIsVisible()) return

    if (event.key === 'Escape') {
      event.preventDefault()
      closeCallback()
    }
  }

  const handleContextMenu = (event: MouseEvent) => {
    if (!getIsVisible()) return

    // Prevent new context menu when one is already open
    event.preventDefault()
  }

  onMounted(() => {
    // Add event listeners with proper timing
    nextTick(() => {
      // Click outside handler
      clickHandler = handleClickOutside
      document.addEventListener('click', clickHandler, true)

      // Escape key handler
      keyHandler = handleKeyEscape
      document.addEventListener('keydown', keyHandler, true)

      // Prevent context menu on right-click when menu is open
      contextMenuHandler = handleContextMenu
      document.addEventListener('contextmenu', contextMenuHandler, true)
    })
  })

  onUnmounted(() => {
    // Clean up event listeners
    if (clickHandler) {
      document.removeEventListener('click', clickHandler, true)
    }
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler, true)
    }
    if (contextMenuHandler) {
      document.removeEventListener('contextmenu', contextMenuHandler, true)
    }
  })

  return {
    handleClickOutside,
    handleKeyEscape,
    handleContextMenu
  }
}