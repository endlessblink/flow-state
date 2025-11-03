import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const UI_STATE_STORAGE_KEY = 'pomo-flow-ui-state'

export const useUIStore = defineStore('ui', () => {
  // Sidebar visibility state
  const mainSidebarVisible = ref(true)
  const secondarySidebarVisible = ref(true)
  const focusMode = ref(false)
  const boardDensity = ref<'ultrathin' | 'compact' | 'comfortable'>('comfortable')

  // Auth modal state
  const isAuthModalOpen = ref(false)
  const authModalMode = ref<'login' | 'signup' | 'reset'>('login')
  const authModalRedirectPath = ref<string | null>(null)

  // Settings modal state
  const isSettingsModalOpen = ref(false)

  // Actions
  const toggleMainSidebar = () => {
    mainSidebarVisible.value = !mainSidebarVisible.value
    if (!mainSidebarVisible.value) {
      focusMode.value = false
    }
    persistState()
  }

  const toggleSecondarySidebar = () => {
    secondarySidebarVisible.value = !secondarySidebarVisible.value
    if (!secondarySidebarVisible.value) {
      focusMode.value = false
    }
    persistState()
  }

  const toggleFocusMode = () => {
    focusMode.value = !focusMode.value

    if (focusMode.value) {
      // Entering focus mode - hide all sidebars
      mainSidebarVisible.value = false
      secondarySidebarVisible.value = false
    } else {
      // Exiting focus mode - restore sidebars
      mainSidebarVisible.value = true
      secondarySidebarVisible.value = true
    }
    persistState()
  }

  const showAllSidebars = () => {
    mainSidebarVisible.value = true
    secondarySidebarVisible.value = true
    focusMode.value = false
    persistState()
  }

  const hideAllSidebars = () => {
    mainSidebarVisible.value = false
    secondarySidebarVisible.value = false
    focusMode.value = true
    persistState()
  }

  const setBoardDensity = (density: 'ultrathin' | 'compact' | 'comfortable') => {
    boardDensity.value = density
    persistState()
  }

  // Auth modal actions
  const openAuthModal = (mode: 'login' | 'signup' | 'reset' = 'login', redirectPath: string | null = null) => {
    isAuthModalOpen.value = true
    authModalMode.value = mode
    authModalRedirectPath.value = redirectPath
  }

  const closeAuthModal = () => {
    isAuthModalOpen.value = false
    authModalRedirectPath.value = null
  }

  const setAuthModalMode = (mode: 'login' | 'signup' | 'reset') => {
    authModalMode.value = mode
  }

  // Settings modal actions
  const openSettingsModal = () => {
    isSettingsModalOpen.value = true
  }

  const closeSettingsModal = () => {
    isSettingsModalOpen.value = false
  }

  // Persistence
  const persistState = () => {
    const state = {
      mainSidebarVisible: mainSidebarVisible.value,
      secondarySidebarVisible: secondarySidebarVisible.value,
      focusMode: focusMode.value,
      boardDensity: boardDensity.value
    }
    localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(state))
  }

  const loadState = () => {
    const saved = localStorage.getItem(UI_STATE_STORAGE_KEY)
    if (saved) {
      try {
        const state = JSON.parse(saved)
        mainSidebarVisible.value = state.mainSidebarVisible ?? true
        secondarySidebarVisible.value = state.secondarySidebarVisible ?? true
        focusMode.value = state.focusMode ?? false
        boardDensity.value = state.boardDensity ?? 'comfortable'
      } catch (error) {
        console.warn('Failed to load UI state from localStorage:', error)
      }
    }
  }

  return {
    // State
    mainSidebarVisible,
    secondarySidebarVisible,
    focusMode,
    boardDensity,
    isAuthModalOpen,
    authModalMode,
    authModalRedirectPath,
    isSettingsModalOpen,

    // Actions
    toggleMainSidebar,
    toggleSecondarySidebar,
    toggleFocusMode,
    showAllSidebars,
    hideAllSidebars,
    setBoardDensity,
    openAuthModal,
    closeAuthModal,
    setAuthModalMode,
    openSettingsModal,
    closeSettingsModal,
    loadState
  }
})
