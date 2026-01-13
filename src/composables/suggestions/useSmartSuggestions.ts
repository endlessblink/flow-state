/**
 * Smart Suggestions Core System
 *
 * AI-Ready infrastructure for intelligent suggestions.
 * Manages suggestion state, dismissal, and settings.
 *
 * @see TASK-266 in MASTER_PLAN.md
 */

import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import type {
  SmartSuggestion
} from '@/types/suggestions'

// Session storage key for dismissed suggestions
const DISMISSED_KEY = 'pomo-flow-dismissed-suggestions'

/**
 * Core suggestion system composable.
 * Manages all active suggestions and provides methods to add, dismiss, and act on them.
 */
export function useSmartSuggestions() {
  const settingsStore = useSettingsStore()

  // State
  const suggestions = ref<SmartSuggestion[]>([])
  const sessionDismissed = ref<Set<string>>(new Set())
  const initialized = ref(false)

  // Load dismissed suggestions from session storage
  const loadDismissed = () => {
    try {
      const stored = sessionStorage.getItem(DISMISSED_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        sessionDismissed.value = new Set(parsed)
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Save dismissed suggestions to session storage
  const saveDismissed = () => {
    try {
      const arr = Array.from(sessionDismissed.value)
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(arr))
    } catch {
      // Ignore storage errors
    }
  }

  // Computed: Active (non-dismissed) suggestions sorted by priority
  const activeSuggestions = computed(() => {
    return suggestions.value
      .filter(s => !s.dismissed && !sessionDismissed.value.has(s.id))
      .sort((a, b) => b.priority - a.priority)
  })

  // Computed: The highest priority suggestion to show
  const currentSuggestion = computed(() => {
    return activeSuggestions.value[0] || null
  })

  // Computed: Whether there are any active suggestions
  const hasSuggestions = computed(() => activeSuggestions.value.length > 0)

  /**
   * Add a new suggestion to the system.
   * Deduplicates by ID.
   */
  const addSuggestion = (suggestion: SmartSuggestion) => {
    // Check if already exists
    const existing = suggestions.value.find(s => s.id === suggestion.id)
    if (existing) {
      // Update existing suggestion
      Object.assign(existing, suggestion)
    } else {
      suggestions.value.push(suggestion)
    }
  }

  /**
   * Remove a suggestion by ID.
   */
  const removeSuggestion = (suggestionId: string) => {
    const index = suggestions.value.findIndex(s => s.id === suggestionId)
    if (index !== -1) {
      suggestions.value.splice(index, 1)
    }
  }

  /**
   * Dismiss a suggestion for this session.
   * The suggestion won't be shown again until the session ends.
   */
  const dismissSuggestion = (suggestionId: string) => {
    sessionDismissed.value.add(suggestionId)
    saveDismissed()

    // Mark as dismissed in the suggestion itself
    const suggestion = suggestions.value.find(s => s.id === suggestionId)
    if (suggestion) {
      suggestion.dismissed = true
    }
  }

  /**
   * Execute an action from a suggestion.
   * Handles errors and removes the suggestion on success.
   */
  const executeAction = async (suggestionId: string, actionId: string) => {
    const suggestion = suggestions.value.find(s => s.id === suggestionId)
    if (!suggestion) return

    const action = suggestion.actions.find(a => a.id === actionId)
    if (!action) return

    try {
      await action.handler()
      // Remove suggestion after successful action
      removeSuggestion(suggestionId)
    } catch (error) {
      console.error('[SmartSuggestions] Action failed:', error)
      throw error
    }
  }

  /**
   * Clear all suggestions.
   */
  const clearSuggestions = () => {
    suggestions.value = []
  }

  /**
   * Clear session dismissed list.
   */
  const clearDismissed = () => {
    sessionDismissed.value.clear()
    saveDismissed()
  }

  /**
   * Initialize the suggestion system.
   */
  const initialize = () => {
    if (initialized.value) return

    loadDismissed()
    initialized.value = true
  }

  /**
   * Check if day-group suggestions are enabled.
   */
  const isDayGroupSuggestionsEnabled = computed(() => {
    return settingsStore.enableDayGroupSuggestions
  })

  /**
   * Disable day-group suggestions (user clicked "don't show again").
   */
  const disableDayGroupSuggestions = () => {
    settingsStore.updateSetting('enableDayGroupSuggestions', false)
  }

  // Auto-initialize
  initialize()

  return {
    // State
    suggestions,
    activeSuggestions,
    currentSuggestion,
    hasSuggestions,
    initialized,

    // Settings
    isDayGroupSuggestionsEnabled,
    disableDayGroupSuggestions,

    // Actions
    addSuggestion,
    removeSuggestion,
    dismissSuggestion,
    executeAction,
    clearSuggestions,
    clearDismissed,
    initialize
  }
}

// Singleton instance for global state
let _instance: ReturnType<typeof useSmartSuggestions> | null = null

/**
 * Get the singleton instance of the suggestion system.
 * Use this when you need to access suggestions from multiple components.
 */
export function useSmartSuggestionsSingleton() {
  if (!_instance) {
    _instance = useSmartSuggestions()
  }
  return _instance
}
