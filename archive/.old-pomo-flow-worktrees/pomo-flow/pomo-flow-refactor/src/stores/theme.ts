/**
 * Theme Store - Reactive Theme Management
 * Manages theme state and CSS variable updates for the entire application
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { themes, DEFAULT_THEME, THEME_STORAGE_KEY, type Theme } from '@/config/themes'

export const useThemeStore = defineStore('theme', () => {
  // ===== State =====

  const currentThemeId = ref<string>(DEFAULT_THEME)
  const currentTheme = ref<Theme>(themes[DEFAULT_THEME])

  // ===== Getters =====

  const isDarkMode = ref(currentThemeId.value === 'dark')

  // ===== Actions =====

  /**
   * Apply theme tokens to CSS variables
   * This is where the magic happens - changing one token cascades everywhere
   */
  const applyThemeTokens = (theme: Theme) => {
    const root = document.documentElement

    // Apply each token as a CSS variable
    Object.entries(theme.tokens).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value)
    })

    // Update dark-theme class for legacy styles
    if (theme.id === 'dark') {
      root.classList.add('dark-theme')
    } else {
      root.classList.remove('dark-theme')
    }
  }

  /**
   * Set theme by ID
   */
  const setTheme = (themeId: string) => {
    const theme = themes[themeId]

    if (!theme) {
      console.warn(`Theme "${themeId}" not found, using default`)
      return
    }

    currentThemeId.value = themeId
    currentTheme.value = theme
    isDarkMode.value = themeId === 'dark'

    // Apply theme immediately
    applyThemeTokens(theme)

    // Persist to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, themeId)
  }

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    const newTheme = isDarkMode.value ? 'light' : 'dark'
    setTheme(newTheme)
  }

  /**
   * Initialize theme from localStorage or system preference
   */
  const initializeTheme = () => {
    // Try localStorage first
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)

    if (savedTheme && themes[savedTheme]) {
      setTheme(savedTheme)
      return
    }

    // Fall back to system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(prefersDark ? 'dark' : 'light')
  }

  /**
   * Update a specific token value (for advanced customization)
   * This demonstrates the power of the system - you can change one token
   * and it propagates throughout the entire app
   */
  const updateToken = (tokenKey: keyof Theme['tokens'], value: string) => {
    // Update in current theme
    currentTheme.value.tokens[tokenKey] = value

    // Apply to CSS immediately
    document.documentElement.style.setProperty(`--${tokenKey}`, value)
  }

  /**
   * Reset theme to defaults
   */
  const resetTheme = () => {
    setTheme(currentThemeId.value)
  }

  // ===== Watchers =====

  // Watch for system theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't manually set a preference
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
      if (!savedTheme) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    })
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
    applyThemeTokens,
  }
})
