import { ref, computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { getLocaleDirection } from './index'

/**
 * Composable for managing text direction (LTR/RTL)
 *
 * Usage:
 * ```ts
 * const { direction, isRTL, setDirection } = useDirection()
 * ```
 */
export function useDirection() {
  const { locale } = useI18n()

  // Get saved direction preference or auto-detect from locale
  const getSavedDirection = (): 'ltr' | 'rtl' | 'auto' => {
    const saved = localStorage.getItem('app-direction')
    if (saved && ['ltr', 'rtl', 'auto'].includes(saved)) {
      return saved as 'ltr' | 'rtl' | 'auto'
    }
    return 'auto'
  }

  // FIX: Use ref instead of computed to make it reactive to manual changes
  const directionPreference = ref<'ltr' | 'rtl' | 'auto'>(getSavedDirection())

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
    directionPreference.value = dir  // FIX: Update ref to trigger reactivity
    localStorage.setItem('app-direction', dir)

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
