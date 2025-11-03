import { ref, onMounted, onUnmounted, nextTick } from 'vue'

interface FocusElement extends HTMLElement {
  focus: () => void
}

interface FocusableElement {
  element: FocusElement
  group?: string
  priority?: number
}

/**
 * Composable for managing keyboard focus and navigation patterns
 * Provides focus trapping, skip links, and focus restoration functionality
 */
export function useFocusManagement(options: {
  container?: string
  trapFocus?: boolean
  restoreFocus?: boolean
  skipLinks?: boolean
} = {}) {
  const {
    container = '.focus-container',
    trapFocus = false,
    restoreFocus = true,
    skipLinks = false
  } = options

  // Refs
  const containerRef = ref<FocusElement>()
  const previousActiveElement = ref<FocusElement | null>(null)
  const focusableElements = ref<FocusableElement[]>([])

  // State
  const isFocusTrapped = ref(false)
  const currentFocusIndex = ref(-1)
  const focusGroups = ref<Map<string, FocusableElement[]>>(new Map())

  /**
   * Get all focusable elements within a container
   */
  const getFocusableElements = (containerElement?: Element): FocusableElement[] => {
    const element = containerElement || containerRef.value
    if (!element) return []

    const selector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ')

    return Array.from(element.querySelectorAll(selector)) as FocusableElement[]
  }

  /**
   * Focus the first focusable element
   */
  const focusFirst = (containerElement?: Element): boolean => {
    const elements = getFocusableElements(containerElement)
    if (elements.length > 0) {
      elements[0].focus()
      return true
    }
    return false
  }

  /**
   * Focus the last focusable element
   */
  const focusLast = (containerElement?: Element): boolean => {
    const elements = getFocusableElements(containerElement)
    if (elements.length > 0) {
      elements[elements.length - 1].focus()
      return true
    }
    return false
  }

  /**
   * Focus a specific element by index
   */
  const focusByIndex = (index: number, containerElement?: Element): boolean => {
    const elements = getFocusableElements(containerElement)
    if (index >= 0 && index < elements.length) {
      elements[index].focus()
      currentFocusIndex.value = index
      return true
    }
    return false
  }

  /**
   * Find and focus element by selector
   */
  const focusBySelector = (selector: string, containerElement?: Element): boolean => {
    const element = (containerElement || containerRef.value)?.querySelector(selector) as FocusableElement
    if (element) {
      element.focus()
      return true
    }
    return false
  }

  /**
   * Save current active element for restoration later
   */
  const saveActiveElement = (): void => {
    previousActiveElement.value = document.activeElement as FocusElement
  }

  /**
   * Restore focus to previously saved element
   */
  const restoreActiveFocus = (): void => {
    if (previousActiveElement.value && typeof previousActiveElement.value.focus === 'function') {
      previousActiveElement.value.focus()
    }
  }

  /**
   * Create focus trap within a container
   */
  const createFocusTrap = (containerElement?: Element): void => {
    const element = containerElement || containerRef.value
    if (!element) return

    focusableElements.value = getFocusableElements(element)
    isFocusTrapped.value = true

    // Focus first element after a brief delay to allow for animations
    nextTick(() => {
      focusFirst(element)
    })
  }

  /**
   * Remove focus trap
   */
  const removeFocusTrap = (): void => {
    isFocusTrapped.value = false
    focusableElements.value = []
    currentFocusIndex.value = -1
  }

  /**
   * Handle keyboard navigation within focus trap
   */
  const handleKeyNavigation = (event: KeyboardEvent): void => {
    if (!isFocusTrapped.value || focusableElements.value.length === 0) return

    const currentIndex = focusableElements.value.findIndex(
      el => el === document.activeElement
    )

    switch (event.key) {
      case 'Tab':
        event.preventDefault()
        if (event.shiftKey) {
          // Tab + Shift: Move to previous element
          const prevIndex = currentIndex <= 0 ? focusableElements.value.length - 1 : currentIndex - 1
          focusByIndex(prevIndex)
        } else {
          // Tab: Move to next element
          const nextIndex = currentIndex >= focusableElements.value.length - 1 ? 0 : currentIndex + 1
          focusByIndex(nextIndex)
        }
        break

      case 'ArrowDown':
        if (!event.shiftKey) {
          event.preventDefault()
          const nextIndex = currentIndex >= focusableElements.value.length - 1 ? 0 : currentIndex + 1
          focusByIndex(nextIndex)
        }
        break

      case 'ArrowUp':
        event.preventDefault()
        const prevIndex = currentIndex <= 0 ? focusableElements.value.length - 1 : currentIndex - 1
        focusByIndex(prevIndex)
        break

      case 'Home':
        event.preventDefault()
        focusFirst()
        break

      case 'End':
        event.preventDefault()
        focusLast()
        break

      case 'Escape':
        if (isFocusTrapped.value) {
          event.preventDefault()
          removeFocusTrap()
          restoreActiveFocus()
        }
        break
    }
  }

  /**
   * Register focus groups for logical navigation
   */
  const registerFocusGroup = (groupName: string, elements: FocusableElement[]): void => {
    focusGroups.value.set(groupName, elements)
  }

  /**
   * Navigate to next focus group
   */
  const navigateToNextGroup = (currentGroup: string): boolean => {
    const groups = Array.from(focusGroups.value.keys())
    const currentIndex = groups.indexOf(currentGroup)
    const nextIndex = (currentIndex + 1) % groups.length
    const nextGroup = groups[nextIndex]

    const groupElements = focusGroups.value.get(nextGroup)
    if (groupElements && groupElements.length > 0) {
      groupElements[0].focus()
      return true
    }
    return false
  }

  /**
   * Navigate to previous focus group
   */
  const navigateToPreviousGroup = (currentGroup: string): boolean => {
    const groups = Array.from(focusGroups.value.keys())
    const currentIndex = groups.indexOf(currentGroup)
    const prevIndex = currentIndex <= 0 ? groups.length - 1 : currentIndex - 1
    const prevGroup = groups[prevIndex]

    const groupElements = focusGroups.value.get(prevGroup)
    if (groupElements && groupElements.length > 0) {
      groupElements[0].focus()
      return true
    }
    return false
  }

  /**
   * Skip link functionality for accessibility
   */
  const createSkipLink = (targetSelector: string, text: string): HTMLElement => {
    const skipLink = document.createElement('a')
    skipLink.href = `#${targetSelector.replace('#', '')}`
    skipLink.textContent = text
    skipLink.className = 'skip-link'
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: var(--brand-primary);
      color: white;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      text-decoration: none;
      font-weight: var(--font-medium);
      z-index: 9999;
      transition: top 0.3s ease;
    `

    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px'
    })

    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px'
    })

    return skipLink
  }

  /**
   * Initialize skip links
   */
  const initializeSkipLinks = (): void => {
    if (!skipLinks) return

    const skipLinksData = [
      { target: 'main-content', text: 'Skip to main content' },
      { target: 'navigation', text: 'Skip to navigation' }
    ]

    skipLinksData.forEach(({ target, text }) => {
      const skipLink = createSkipLink(target, text)
      document.body.insertBefore(skipLink, document.body.firstChild)
    })
  }

  /**
   * Announce content changes to screen readers
   */
  const announceToScreenReader = (message: string): void => {
    const announcement = document.createElement('div')
    announcement.setAttribute('role', 'status')
    announcement.setAttribute('aria-live', 'polite')
    announcement.className = 'sr-only'
    announcement.textContent = message

    document.body.appendChild(announcement)

    setTimeout(() => {
      document.body.removeChild(announcement)
    }, 1000)
  }

  /**
   * Check if element is focusable
   */
  const isFocusable = (element: Element): boolean => {
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ')

    return element.matches(focusableSelector)
  }

  /**
   * Find next focusable element from current position
   */
  const findNextFocusable = (currentElement: Element): FocusElement | null => {
    const allFocusable = getFocusableElements(document.body)
    const currentIndex = allFocusable.findIndex(el => el === currentElement)

    if (currentIndex >= 0 && currentIndex < allFocusable.length - 1) {
      return allFocusable[currentIndex + 1]
    }
    return null
  }

  /**
   * Find previous focusable element from current position
   */
  const findPreviousFocusable = (currentElement: Element): FocusElement | null => {
    const allFocusable = getFocusableElements(document.body)
    const currentIndex = allFocusable.findIndex(el => el === currentElement)

    if (currentIndex > 0) {
      return allFocusable[currentIndex - 1]
    }
    return null
  }

  // Lifecycle hooks
  onMounted(() => {
    // Save current active element for potential restoration
    if (restoreFocus) {
      saveActiveElement()
    }

    // Initialize skip links if enabled
    if (skipLinks) {
      initializeSkipLinks()
    }

    // Add global keyboard navigation listener if focus trap is enabled
    if (trapFocus) {
      document.addEventListener('keydown', handleKeyNavigation)
    }
  })

  onUnmounted(() => {
    // Clean up event listeners
    document.removeEventListener('keydown', handleKeyNavigation)

    // Restore focus if needed
    if (restoreFocus) {
      restoreActiveFocus()
    }

    // Remove focus trap
    removeFocusTrap()
  })

  return {
    // Refs
    containerRef,

    // State
    isFocusTrapped,
    currentFocusIndex,
    focusableElements,

    // Methods
    focusFirst,
    focusLast,
    focusByIndex,
    focusBySelector,
    saveActiveElement,
    restoreActiveFocus,
    createFocusTrap,
    removeFocusTrap,
    registerFocusGroup,
    navigateToNextGroup,
    navigateToPreviousGroup,
    createSkipLink,
    initializeSkipLinks,
    announceToScreenReader,
    isFocusable,
    findNextFocusable,
    findPreviousFocusable,

    // Advanced
    handleKeyNavigation
  }
}

/**
 * Hook for managing focus within modals and dialogs
 */
export function useModalFocus(options: {
  containerRef?: { value: HTMLElement | null }
  autoFocus?: boolean
  restoreFocus?: boolean
} = {}) {
  const { containerRef, autoFocus = true, restoreFocus = true } = options

  const focusManager = useFocusManagement({
    trapFocus: true,
    restoreFocus
  })

  const openModal = (): void => {
    if (containerRef.value) {
      focusManager.containerRef.value = containerRef.value
      focusManager.saveActiveElement()

      if (autoFocus) {
        focusManager.createFocusTrap(containerRef.value)
      }
    }
  }

  const closeModal = (): void => {
    focusManager.removeFocusTrap()
    if (restoreFocus) {
      focusManager.restoreActiveFocus()
    }
  }

  return {
    ...focusManager,
    openModal,
    closeModal
  }
}

/**
 * Hook for managing keyboard navigation in lists and menus
 */
export function useListNavigation(options: {
  items: any[]
  onSelect?: (item: any, index: number) => void
  loop?: boolean
  orientation?: 'vertical' | 'horizontal'
} = {}) {
  const { items, onSelect, loop = true, orientation = 'vertical' } = options

  const focusedIndex = ref(-1)
  const listRef = ref<HTMLElement>()

  const focusItem = (index: number): void => {
    if (index >= 0 && index < items.length) {
      focusedIndex.value = index
      const itemElement = listRef.value?.querySelector(`[data-list-index="${index}"]`) as HTMLElement
      itemElement?.focus()
    }
  }

  const focusNext = (): void => {
    const nextIndex = focusedIndex.value + 1
    if (nextIndex < items.length) {
      focusItem(nextIndex)
    } else if (loop) {
      focusItem(0)
    }
  }

  const focusPrevious = (): void => {
    const prevIndex = focusedIndex.value - 1
    if (prevIndex >= 0) {
      focusItem(prevIndex)
    } else if (loop) {
      focusItem(items.length - 1)
    }
  }

  const handleKeyNavigation = (event: KeyboardEvent): void => {
    switch (event.key) {
      case orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp':
        event.preventDefault()
        focusPrevious()
        break

      case orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown':
        event.preventDefault()
        focusNext()
        break

      case 'Home':
        event.preventDefault()
        focusItem(0)
        break

      case 'End':
        event.preventDefault()
        focusItem(items.length - 1)
        break

      case 'Enter':
      case ' ':
        event.preventDefault()
        if (focusedIndex.value >= 0 && onSelect) {
          onSelect(items[focusedIndex.value], focusedIndex.value)
        }
        break
    }
  }

  return {
    focusedIndex,
    listRef,
    focusItem,
    focusNext,
    focusPrevious,
    handleKeyNavigation
  }
}