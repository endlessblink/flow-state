import { onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/stores/ui'

export function useSidebarToggle() {
  const uiStore = useUIStore()

  const handleKeyboardShortcuts = (event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modKey = isMac ? event.metaKey : event.ctrlKey

    // Skip if typing in input/textarea
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return
    }

    // Ctrl/Cmd+B: Toggle main sidebar
    if (modKey && event.key === 'b' && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      uiStore.toggleMainSidebar()
      return
    }

    // Ctrl/Cmd+\: Toggle secondary sidebar
    if (modKey && event.key === '\\' && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      uiStore.toggleSecondarySidebar()
      return
    }

    // Ctrl/Cmd+Shift+F: Focus mode (hide all sidebars)
    if (modKey && event.shiftKey && event.key === 'F') {
      event.preventDefault()
      uiStore.toggleFocusMode()
      return
    }

    // Escape: Exit focus mode (if active)
    if (event.key === 'Escape' && uiStore.focusMode) {
      event.preventDefault()
      uiStore.toggleFocusMode()
      return
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyboardShortcuts)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyboardShortcuts)
  })

  return {
    uiStore
  }
}
