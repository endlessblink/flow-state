import { ref, computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { getLocaleDirection } from './index'

// Module-level shared state (singleton pattern)
// All useDirection() consumers share this ref so direction changes propagate everywhere
function getSavedDirection(): 'ltr' | 'rtl' | 'auto' {
  if (typeof localStorage === 'undefined') return 'auto'
  const saved = localStorage.getItem('flowstate-app-direction')
  if (saved && ['ltr', 'rtl', 'auto'].includes(saved)) {
    return saved as 'ltr' | 'rtl' | 'auto'
  }
  return 'auto'
}

const _sharedDirectionPreference = ref<'ltr' | 'rtl' | 'auto'>(getSavedDirection())

/**
 * Composable for managing text direction (LTR/RTL)
 *
 * All instances share the same directionPreference state so changes
 * in LanguageSettings propagate to MainLayout and everywhere else.
 *
 * Usage:
 * ```ts
 * const { direction, isRTL, setDirection } = useDirection()
 * ```
 */
export function useDirection() {
  const { locale } = useI18n({ useScope: 'global' })

  // Shared across all instances
  const directionPreference = _sharedDirectionPreference

  // Compute actual direction based on preference and locale
  const direction = computed<'ltr' | 'rtl'>(() => {
    const pref = directionPreference.value

    if (pref === 'auto') {
      return getLocaleDirection(locale.value)
    }

    return pref
  })

  const isRTL = computed(() => direction.value === 'rtl')
  const isLTR = computed(() => direction.value === 'ltr')

  // Set direction preference and save to localStorage
  const setDirection = (dir: 'ltr' | 'rtl' | 'auto') => {
    directionPreference.value = dir
    localStorage.setItem('flowstate-app-direction', dir)

    // Update document direction
    updateDocumentDirection()
  }

  // Update the HTML document's dir attribute
  const updateDocumentDirection = () => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('dir', direction.value)
    }
  }

  // Watch for direction changes and update document
  watchEffect(() => {
    updateDocumentDirection()
  })

  return {
    direction,
    isRTL,
    isLTR,
    directionPreference,
    setDirection,
    updateDocumentDirection
  }
}
