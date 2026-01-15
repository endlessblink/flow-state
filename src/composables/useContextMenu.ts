/**
 * Unified Context Menu Composable
 *
 * Combines event handling and positioning for context menus:
 * - Click-outside detection and Escape key handling
 * - Viewport boundary detection and positioning
 * - Proper event cleanup to prevent memory leaks
 *
 * Consolidated from useContextMenuEvents.ts and useContextMenuPositioning.ts
 */

import { computed, nextTick, ref, watch, onMounted, onUnmounted, type Ref, isRef, toValue } from 'vue'

export interface UseContextMenuOptions {
  x: number | Ref<number> | (() => number)
  y: number | Ref<number> | (() => number)
  isVisible: boolean | Ref<boolean> | (() => boolean)
  menuRef: { value: HTMLElement | null }
  closeCallback: () => void
  offset?: { x?: number; y?: number }
  viewportPadding?: number
  preventCloseOnMenuClick?: boolean
}

export function useContextMenu(options: UseContextMenuOptions) {
  const {
    menuRef,
    closeCallback,
    offset = { x: 2, y: 2 },
    viewportPadding = 8,
    preventCloseOnMenuClick: _preventCloseOnMenuClick = true
  } = options

  // ============================================
  // POSITIONING LOGIC
  // ============================================

  // Store reactive versions of x, y, isVisible
  const currentX = ref(toValue(options.x))
  const currentY = ref(toValue(options.y))
  const currentIsVisible = ref(toValue(options.isVisible))

  // Watch for changes if refs or getters were provided
  if (isRef(options.x) || typeof options.x === 'function') {
    watch(() => toValue(options.x), (newX) => { currentX.value = newX })
  }
  if (isRef(options.y) || typeof options.y === 'function') {
    watch(() => toValue(options.y), (newY) => { currentY.value = newY })
  }
  if (isRef(options.isVisible) || typeof options.isVisible === 'function') {
    watch(() => toValue(options.isVisible), (newVisible) => { currentIsVisible.value = newVisible })
  }

  const isPositioning = ref(false)
  const recalcTrigger = ref(0)

  const menuPosition = computed(() => {
    // Access trigger to make this computed reactive to manual updates
    void recalcTrigger.value

    if (!currentIsVisible.value) {
      return {
        left: '-9999px',
        top: '-9999px'
      }
    }

    // Start with the click position plus offset
    let left = currentX.value + (offset.x || 0)
    let top = currentY.value + (offset.y || 0)

    // If we have a menu element reference, adjust for viewport boundaries
    if (menuRef.value) {
      const menu = menuRef.value
      const rect = menu.getBoundingClientRect()

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const wouldOverflowRight = left + rect.width > viewportWidth - viewportPadding
      const wouldOverflowBottom = top + rect.height > viewportHeight - viewportPadding

      // Handle horizontal positioning
      if (wouldOverflowRight) {
        const leftPosition = currentX.value - rect.width - (offset.x || 0)
        if (leftPosition >= viewportPadding) {
          left = leftPosition
        } else {
          left = Math.max(viewportPadding, viewportWidth - rect.width - viewportPadding)
        }
      }

      // Handle vertical positioning
      if (wouldOverflowBottom) {
        const topPosition = currentY.value - rect.height - (offset.y || 0)
        if (topPosition >= viewportPadding) {
          top = topPosition
        } else {
          top = Math.max(viewportPadding, viewportHeight - rect.height - viewportPadding)
        }
      }

      // Final safety check
      left = Math.max(viewportPadding, Math.min(left, viewportWidth - rect.width - viewportPadding))
      top = Math.max(viewportPadding, Math.min(top, viewportHeight - rect.height - viewportPadding))
    }

    return {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`
    }
  })

  const setPosition = (newX: number, newY: number) => {
    currentX.value = newX
    currentY.value = newY
  }

  const updatePosition = async () => {
    if (!currentIsVisible.value || !menuRef.value) return

    isPositioning.value = true
    await nextTick()
    recalcTrigger.value++
    void menuPosition.value
    isPositioning.value = false
  }

  // ============================================
  // EVENT HANDLING LOGIC
  // ============================================

  // Helper to get current visibility
  const getIsVisible = () => toValue(options.isVisible)

  let mousedownHandler: (event: MouseEvent) => void
  let keyHandler: (event: KeyboardEvent) => void
  let contextMenuHandler: (event: MouseEvent) => void

  // Use mousedown instead of click to catch events before Vue Flow can intercept them
  // Vue Flow's pane-click is a synthetic event and may not propagate standard click events
  const handleClickOutside = (event: MouseEvent) => {
    if (!getIsVisible() || !menuRef.value) return

    const target = event.target as Node
    if (menuRef.value.contains(target)) {
      return // Click inside menu, don't close
    }

    // Also check for teleported submenus (they're outside the main menu ref)
    const teleportedSubmenu = document.querySelector('.submenu-teleported')
    if (teleportedSubmenu && teleportedSubmenu.contains(target)) {
      return // Click inside teleported submenu, don't close
    }

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
    event.preventDefault()
  }

  onMounted(() => {
    nextTick(() => {
      // Use mousedown in capture phase - fires before Vue Flow can intercept
      mousedownHandler = handleClickOutside
      document.addEventListener('mousedown', mousedownHandler, true)

      keyHandler = handleKeyEscape
      document.addEventListener('keydown', keyHandler, true)

      contextMenuHandler = handleContextMenu
      document.addEventListener('contextmenu', contextMenuHandler, true)
    })
  })

  onUnmounted(() => {
    if (mousedownHandler) {
      document.removeEventListener('mousedown', mousedownHandler, true)
    }
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler, true)
    }
    if (contextMenuHandler) {
      document.removeEventListener('contextmenu', contextMenuHandler, true)
    }
  })

  return {
    // Positioning
    menuPosition,
    updatePosition,
    setPosition,
    isPositioning,
    // Event handlers
    handleClickOutside,
    handleKeyEscape,
    handleContextMenu
  }
}
