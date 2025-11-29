/**
 * Context Menu Event Handling Composable
 *
 * Provides unified event handling for context menus to ensure:
 * - Consistent behavior across all context menus
 * - Proper click-outside detection
 * - Event cleanup to prevent memory leaks
 * - Prevented premature menu closure
 */

import { onMounted, onUnmounted, nextTick } from 'vue'

export interface useContextMenuEventsOptions {
  isVisible: boolean
  menuRef: { value: HTMLElement | null }
  closeCallback: () => void
  preventCloseOnMenuClick?: boolean
}

export function useContextMenuEvents(options: useContextMenuEventsOptions) {
  const { isVisible, menuRef, closeCallback, preventCloseOnMenuClick = true } = options

  let clickHandler: (event: MouseEvent) => void
  let keyHandler: (event: KeyboardEvent) => void
  let contextMenuHandler: (event: MouseEvent) => void

  const handleClickOutside = (event: MouseEvent) => {
    if (!isVisible || !menuRef.value) return

    // Check if click is inside the menu
    const target = event.target as Node
    if (menuRef.value.contains(target)) {
      return // Click inside menu, don't close
    }

    // Close menu when clicking outside
    closeCallback()
  }

  const handleKeyEscape = (event: KeyboardEvent) => {
    if (!isVisible) return

    if (event.key === 'Escape') {
      event.preventDefault()
      closeCallback()
    }
  }

  const handleContextMenu = (event: MouseEvent) => {
    if (!isVisible) return

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