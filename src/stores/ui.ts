import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
// Temporarily remove i18n to fix setup function error
// import { useI18n } from 'vue-i18n'
// import { useDirection } from '@/i18n/useDirection'

const UI_STATE_STORAGE_KEY = 'pomo-flow-ui-state'

export type AuthModalView = 'login' | 'signup' | 'reset-password'

/**
 * Power group override mode for canvas power groups
 * - 'always': Always override task properties when dropped on power group
 * - 'only_empty': Only set property if task doesn't have one
 * - 'ask': Ask user each time when there's a conflict
 */
export type PowerGroupOverrideMode = 'always' | 'only_empty' | 'ask'

export const useUIStore = defineStore('ui', () => {
  // RTL and i18n support - temporarily disabled to fix initialization
  // const { locale } = useI18n()
  // const { direction, isRTL, isLTR, setDirection, directionPreference } = useDirection()

  // Temporary hardcoded values until i18n is fixed
  const locale = ref('en')
  const direction = ref('ltr')
  const isRTL = computed(() => direction.value === 'rtl')
  const isLTR = computed(() => direction.value === 'ltr')
  const directionPreference = ref('ltr') // Temporary value

  // Sidebar visibility state
  const mainSidebarVisible = ref(true)
  const secondarySidebarVisible = ref(true)
  const focusMode = ref(false)
  const boardDensity = ref<'ultrathin' | 'compact' | 'comfortable'>('comfortable')

  // Theme and additional UI state
  const theme = ref<'light' | 'dark' | 'auto'>('dark')
  const sidebarCollapsed = ref(false) // Legacy compatibility property
  const activeView = ref<'board' | 'canvas' | 'calendar' | 'all-tasks'>('board')

  // Power group settings
  const powerGroupOverrideMode = ref<PowerGroupOverrideMode>('always')

  // Language and direction state
  const availableLanguages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית' }
  ]

  const currentLanguage = computed(() =>
    availableLanguages.find(lang => lang.code === locale.value) || availableLanguages[0]
  )

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

  // Power group settings actions
  const setPowerGroupOverrideMode = (mode: PowerGroupOverrideMode) => {
    powerGroupOverrideMode.value = mode
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

  // Language and direction actions
  const setLanguage = (languageCode: 'en' | 'he') => {
    locale.value = languageCode
    localStorage.setItem('app-locale', languageCode)
    persistState()
  }

  const setDirectionPreference = (pref: 'ltr' | 'rtl' | 'auto') => {
    // Temporarily disabled direction setting functionality
    // setDirection(pref)
    directionPreference.value = pref
    persistState()
  }

  const toggleDirection = () => {
    // Temporarily disabled direction toggling
    if (directionPreference.value === 'auto') {
      setDirectionPreference(isRTL.value ? 'ltr' : 'rtl')
    } else {
      setDirectionPreference('auto')
    }
    persistState()
  }

  // Persistence
  const persistState = () => {
    const state = {
      mainSidebarVisible: mainSidebarVisible.value,
      secondarySidebarVisible: secondarySidebarVisible.value,
      focusMode: focusMode.value,
      boardDensity: boardDensity.value,
      locale: locale.value,
      directionPreference: directionPreference.value,
      powerGroupOverrideMode: powerGroupOverrideMode.value
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

        // Restore language and direction preferences
        if (state.locale && ['en', 'he'].includes(state.locale)) {
          locale.value = state.locale
          localStorage.setItem('app-locale', state.locale)
        }

        if (state.directionPreference && ['ltr', 'rtl', 'auto'].includes(state.directionPreference)) {
          // Temporarily disabled direction setting
          // setDirection(state.directionPreference)
          directionPreference.value = state.directionPreference
        }

        // Load power group settings
        if (state.powerGroupOverrideMode && ['always', 'only_empty', 'ask'].includes(state.powerGroupOverrideMode)) {
          powerGroupOverrideMode.value = state.powerGroupOverrideMode
        }
      } catch (error) {
        errorHandler.report({
          severity: ErrorSeverity.WARNING,
          category: ErrorCategory.STATE,
          message: 'Failed to load UI state from localStorage',
          error: error as Error,
          context: { operation: 'loadState', store: 'ui' },
          showNotification: false // Non-critical - using defaults
        })
      }
    }
  }

  return {
    // State
    mainSidebarVisible,
    secondarySidebarVisible,
    focusMode,
    boardDensity,
    theme,
    sidebarCollapsed,
    activeView,
    authModalOpen,
    authModalView,
    authModalRedirect,
    settingsModalOpen,

    // RTL and i18n state
    locale,
    direction,
    isRTL,
    isLTR,
    directionPreference,
    availableLanguages,
    currentLanguage,

    // Power group settings
    powerGroupOverrideMode,

    // Actions
    toggleMainSidebar,
    toggleSecondarySidebar,
    toggleFocusMode,
    showAllSidebars,
    hideAllSidebars,
    setBoardDensity,
    setPowerGroupOverrideMode,
    openAuthModal,
    closeAuthModal,
    switchAuthView,
    openSettingsModal,
    closeSettingsModal,

    // Language and direction actions
    setLanguage,
    setDirectionPreference,
    toggleDirection,
    loadState
  }
})
