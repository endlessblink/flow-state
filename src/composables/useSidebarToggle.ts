import { onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/stores/ui'

export function useSidebarToggle() {
  const uiStore = useUIStore()

  const handleKeyboardShortcuts = (event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modKey = isMac ? event.metaKey : event.ctrlKey

    // Comprehensive logging for sidebar keyboard shortcut debugging
    console.log('🔧 [SIDEBAR TOGGLE] handleKeyboardShortcuts called:', {
      key: event.key,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      isMac,
      modKey,
      target: event.target,
      targetTagName: (event.target as HTMLElement)?.tagName,
      timestamp: new Date().toISOString()
    })

    // Skip if typing in input/textarea
    const isInputField = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
    console.log('🚫 [SIDEBAR TOGGLE] Input field check:', {
      isInputField,
      targetElement: event.target,
      isInputElement: event.target instanceof HTMLInputElement,
      isTextAreaElement: event.target instanceof HTMLTextAreaElement
    })

    if (isInputField) {
      console.log('❌ [SIDEBAR TOGGLE] Keyboard shortcut blocked - target is input field')
      return
    }

    // Check if this is Shift+1-5 that might interfere with App.vue
    if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key >= '1' && event.key <= '5') {
      console.log('⚠️ [SIDEBAR TOGGLE] Shift+1-5 detected but not handled by sidebar toggle - this should be handled by App.vue')
    }

    // Ctrl/Cmd+B: Toggle main sidebar
    console.log('🔍 [SIDEBAR TOGGLE] Checking Ctrl/Cmd+B condition:', {
      modKey,
      keyB: event.key === 'b',
      noShift: !event.shiftKey,
      noAlt: !event.altKey,
      conditionMet: modKey && event.key === 'b' && !event.shiftKey && !event.altKey
    })

    if (modKey && event.key === 'b' && !event.shiftKey && !event.altKey) {
      console.log('✅ [SIDEBAR TOGGLE] Ctrl/Cmd+B detected - toggling main sidebar')
      event.preventDefault()
      uiStore.toggleMainSidebar()
      return
    }

    // Ctrl/Cmd+\: Toggle secondary sidebar
    console.log('🔍 [SIDEBAR TOGGLE] Checking Ctrl/Cmd+\\ condition:', {
      modKey,
      keyBackslash: event.key === '\\',
      noShift: !event.shiftKey,
      noAlt: !event.altKey,
      conditionMet: modKey && event.key === '\\' && !event.shiftKey && !event.altKey
    })

    if (modKey && event.key === '\\' && !event.shiftKey && !event.altKey) {
      console.log('✅ [SIDEBAR TOGGLE] Ctrl/Cmd+\\ detected - toggling secondary sidebar')
      event.preventDefault()
      uiStore.toggleSecondarySidebar()
      return
    }

    // Ctrl/Cmd+Shift+F: Focus mode (hide all sidebars)
    console.log('🔍 [SIDEBAR TOGGLE] Checking Ctrl/Cmd+Shift+F condition:', {
      modKey,
      shiftKey: event.shiftKey,
      keyF: event.key === 'F',
      conditionMet: modKey && event.shiftKey && event.key === 'F'
    })

    if (modKey && event.shiftKey && event.key === 'F') {
      console.log('✅ [SIDEBAR TOGGLE] Ctrl/Cmd+Shift+F detected - toggling focus mode')
      event.preventDefault()
      uiStore.toggleFocusMode()
      return
    }

    // Escape: Exit focus mode (if active)
    console.log('🔍 [SIDEBAR TOGGLE] Checking Escape condition:', {
      keyEscape: event.key === 'Escape',
      focusModeActive: uiStore.focusMode,
      conditionMet: event.key === 'Escape' && uiStore.focusMode
    })

    if (event.key === 'Escape' && uiStore.focusMode) {
      console.log('✅ [SIDEBAR TOGGLE] Escape detected in focus mode - exiting focus mode')
      event.preventDefault()
      uiStore.toggleFocusMode()
      return
    }

    console.log('❌ [SIDEBAR TOGGLE] No sidebar shortcut matched - event will be passed through')
  }

  onMounted(() => {
    console.log('🎯 [SIDEBAR TOGGLE] Adding keyboard event listener (bubble phase)')
    window.addEventListener('keydown', handleKeyboardShortcuts)
  })

  onUnmounted(() => {
    console.log('🗑️ [SIDEBAR TOGGLE] Removing keyboard event listener')
    window.removeEventListener('keydown', handleKeyboardShortcuts)
  })

  return {
    uiStore
  }
}
