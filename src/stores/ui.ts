import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useGlobalAppLoaded } from '@/composables/useAppLoaded'

const UI_STATE_STORAGE_KEY = 'pomo-flow-ui-state'

export type AuthModalView = 'login' | 'signup' | 'reset-password'

export const useUIStore = defineStore('ui', () => {
  // Initialize app loading state
  const appLoaded = useGlobalAppLoaded()

  // Sidebar visibility state
  const mainSidebarVisible = ref(true)
  const secondarySidebarVisible = ref(true)
  const focusMode = ref(false)
  const boardDensity = ref<'ultrathin' | 'compact' | 'comfortable'>('comfortable')

  // App loading state (computed from appLoaded composable)
  const isAppLoading = computed(() => !appLoaded.isLoaded.value)
  const appLoadedProgress = computed(() => appLoaded.overallProgress.value)
  const currentLoadingPhase = computed(() => appLoaded.currentPhase.value)
  const loadingErrors = computed(() => appLoaded.allErrors.value)

  // Auth modal state
  const authModalOpen = ref(false)
  const authModalView = ref<AuthModalView>('login')
  const authModalRedirect = ref<string | undefined>(undefined)

  // Settings modal state
  const settingsModalOpen = ref(false)

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
  const openAuthModal = (view: AuthModalView = 'login', redirectTo?: string) => {
    authModalView.value = view
    authModalRedirect.value = redirectTo
    authModalOpen.value = true
  }

  const closeAuthModal = () => {
    authModalOpen.value = false
    authModalRedirect.value = undefined
  }

  const switchAuthView = (view: AuthModalView) => {
    authModalView.value = view
  }

  // Settings modal actions
  const openSettingsModal = () => {
    settingsModalOpen.value = true
  }

  const closeSettingsModal = () => {
    settingsModalOpen.value = false
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
    authModalOpen,
    authModalView,
    authModalRedirect,
    settingsModalOpen,

    // App loading state
    isAppLoading,
    appLoadedProgress,
    currentLoadingPhase,
    loadingErrors,

    // Actions
    toggleMainSidebar,
    toggleSecondarySidebar,
    toggleFocusMode,
    showAllSidebars,
    hideAllSidebars,
    setBoardDensity,
    openAuthModal,
    closeAuthModal,
    switchAuthView,
    openSettingsModal,
    closeSettingsModal,
    loadState,

    // App loading actions (passthrough to appLoaded composable)
    startAppLoading: appLoaded.reset,
    getAppLoadedComposable: () => appLoaded
  }
})
