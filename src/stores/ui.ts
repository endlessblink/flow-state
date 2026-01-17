import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'

const UI_STATE_STORAGE_KEY = 'flow-state-ui-state'

/**
 * Helper to ensure a value is a Set<string>
 * Handles cross-tab sync where PiniaSharedState serializes Sets as plain objects
 */
function ensureSet(value: unknown): Set<string> {
  if (value instanceof Set) return value
  if (Array.isArray(value)) return new Set(value)
  if (value && typeof value === 'object') {
    // Object from JSON serialization - use keys
    return new Set(Object.keys(value))
  }
  return new Set()
}

export type AuthModalView = 'login' | 'signup' | 'reset-password'

export const useUIStore = defineStore('ui', () => {
  // Temporary hardcoded values until i18n is fixed
  const locale = ref('en')
  const direction = ref('ltr')
  const isRTL = computed(() => direction.value === 'rtl')
  const isLTR = computed(() => direction.value === 'ltr')
  const directionPreference = ref('ltr')

  // Sidebar visibility state
  const mainSidebarVisible = ref(true)
  const secondarySidebarVisible = ref(true)
  const focusMode = ref(false)

  // Project Multi-Selection State
  // Note: PiniaSharedState can serialize Sets as plain objects during cross-tab sync
  const selectedProjectIds = ref<Set<string>>(new Set())
  const lastSelectedProjectId = ref<string | null>(null)

  // FIX: Ensure selectedProjectIds is always a Set after cross-tab sync
  // PiniaSharedState serializes Sets as plain objects, so we watch and convert back
  watch(selectedProjectIds, (newVal) => {
    if (!(newVal instanceof Set)) {
      selectedProjectIds.value = ensureSet(newVal)
    }
  }, { immediate: true })

  // Theme and additional UI state
  const theme = ref<'light' | 'dark' | 'auto'>('dark')
  const sidebarCollapsed = ref(false)
  const activeView = ref<'board' | 'canvas' | 'calendar' | 'all-tasks'>('board')

  // Expanded State
  const expandedProjectIds = ref<string[]>([])
  const isDurationSectionExpanded = ref(true)

  // Language state
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
  const toggleProjectSelection = (projectId: string, multiSelect: boolean = true) => {
    if (!multiSelect) {
      selectedProjectIds.value = new Set([projectId])
      lastSelectedProjectId.value = projectId
      return
    }

    const newSet = new Set(selectedProjectIds.value)
    if (newSet.has(projectId)) {
      newSet.delete(projectId)
      if (projectId === lastSelectedProjectId.value) {
        lastSelectedProjectId.value = null
      }
    } else {
      newSet.add(projectId)
      lastSelectedProjectId.value = projectId
    }
    selectedProjectIds.value = newSet
  }

  const setProjectSelection = (ids: string[]) => {
    selectedProjectIds.value = new Set(ids)
    lastSelectedProjectId.value = ids.length > 0 ? ids[ids.length - 1] : null
  }

  const clearProjectSelection = () => {
    if (selectedProjectIds.value.size > 0) {
      selectedProjectIds.value = new Set()
      lastSelectedProjectId.value = null
    }
  }

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
      mainSidebarVisible.value = false
      secondarySidebarVisible.value = false
    } else {
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
    directionPreference.value = pref
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
      activeView: activeView.value,
      expandedProjectIds: expandedProjectIds.value,
      isDurationSectionExpanded: isDurationSectionExpanded.value
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

        if (state.activeView && ['board', 'canvas', 'calendar', 'all-tasks'].includes(state.activeView)) {
          activeView.value = state.activeView
        }

        if (Array.isArray(state.expandedProjectIds)) {
          expandedProjectIds.value = state.expandedProjectIds
        }
        if (typeof state.isDurationSectionExpanded === 'boolean') {
          isDurationSectionExpanded.value = state.isDurationSectionExpanded
        }
      } catch (error) {
        errorHandler.report({
          severity: ErrorSeverity.WARNING,
          category: ErrorCategory.STATE,
          message: 'Failed to load UI state from localStorage',
          error: error as Error,
          context: { operation: 'loadState', store: 'ui' },
          showNotification: false
        })
      }
    }
  }

  return {
    mainSidebarVisible,
    secondarySidebarVisible,
    focusMode,
    theme,
    sidebarCollapsed,
    activeView,
    authModalOpen,
    authModalView,
    authModalRedirect,
    settingsModalOpen,
    locale,
    direction,
    isRTL,
    isLTR,
    directionPreference,
    availableLanguages,
    currentLanguage,
    expandedProjectIds,
    isDurationSectionExpanded,
    toggleMainSidebar,
    toggleSecondarySidebar,
    toggleFocusMode,
    showAllSidebars,
    hideAllSidebars,
    selectedProjectIds,
    lastSelectedProjectId,
    toggleProjectSelection,
    setProjectSelection,
    clearProjectSelection,
    openAuthModal,
    closeAuthModal,
    switchAuthView,
    openSettingsModal,
    closeSettingsModal,
    setLanguage,
    setDirectionPreference,
    toggleDirection,
    loadState,
    persistState
  }
})
