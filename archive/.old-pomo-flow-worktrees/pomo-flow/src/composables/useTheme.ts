/**
 * useTheme Composable
 * Provides easy access to theme functionality in components
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme'

export function useTheme() {
  const themeStore = useThemeStore()

  // Extract reactive refs
  const { currentThemeId, currentTheme, isDarkMode } = storeToRefs(themeStore)

  // Theme actions
  const {
    setTheme,
    toggleTheme,
    initializeTheme,
    updateToken,
    resetTheme
  } = themeStore

  /**
   * Computed helper to check if current theme matches an ID
   */
  const isTheme = (themeId: string) => computed(() => currentThemeId.value === themeId)

  /**
   * Get current value of a token
   */
  const getToken = (tokenKey: string) => {
    return computed(() => {
      const token = currentTheme.value.tokens[tokenKey as keyof typeof currentTheme.value.tokens]
      return token || `var(--${tokenKey})`
    })
  }

  /**
   * Get CSS variable reference (for use in templates)
   */
  const cssVar = (tokenKey: string) => `var(--${tokenKey})`

  /**
   * Theme helper utilities
   */
  const utils = {
    /**
     * Apply theme-aware styling
     * Usage: :style="utils.themeStyle({ light: '...', dark: '...' })"
     */
    themeStyle: (styles: { light?: any; dark?: any }) => {
      return isDarkMode.value ? styles.dark : styles.light
    },

    /**
     * Conditional class based on theme
     * Usage: :class="utils.themeClass({ light: 'light-class', dark: 'dark-class' })"
     */
    themeClass: (classes: { light?: string; dark?: string }) => {
      return isDarkMode.value ? classes.dark : classes.light
    },

    /**
     * Get color with opacity
     * Usage: utils.withOpacity('--surface-primary', 0.5)
     */
    withOpacity: (tokenKey: string, opacity: number) => {
      const value = getToken(tokenKey).value

      // If it's already a CSS variable, we can't modify it directly
      // Return a CSS calc or custom property
      if (value.startsWith('var(')) {
        return `color-mix(in srgb, ${value} ${opacity * 100}%, transparent)`
      }

      return value
    }
  }

  return {
    // State
    currentThemeId,
    currentTheme,
    isDarkMode,

    // Actions
    setTheme,
    toggleTheme,
    initializeTheme,
    updateToken,
    resetTheme,

    // Helpers
    isTheme,
    getToken,
    cssVar,
    utils,
  }
}
