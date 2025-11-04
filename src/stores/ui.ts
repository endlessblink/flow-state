import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDirection } from '@/i18n/useDirection'

const UI_STATE_STORAGE_KEY = 'pomo-flow-ui-state'

export type AuthModalView = 'login' | 'signup' | 'reset-password'

export const useUIStore = defineStore('ui', () => {
  // RTL and i18n support
  const { locale } = useI18n()
  const { direction, isRTL, isLTR, setDirection, directionPreference } = useDirection()

  // Sidebar visibility state
  const mainSidebarVisible = ref(true)
  const secondarySidebarVisible = ref(true)
  const focusMode = ref(false)
  const boardDensity = ref<'ultrathin' | 'compact' | 'comfortable'>('comfortable')

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
    setDirection(pref)
    persistState()
  }

  const toggleDirection = () => {
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
      directionPreference: directionPreference.value
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
          setDirection(state.directionPreference)
        }
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

    // RTL and i18n state
    locale,
    direction,
    isRTL,
    isLTR,
    directionPreference,
    availableLanguages,
    currentLanguage,

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

    // Language and direction actions
    setLanguage,
    setDirectionPreference,
    toggleDirection,
    loadState
  }
})
