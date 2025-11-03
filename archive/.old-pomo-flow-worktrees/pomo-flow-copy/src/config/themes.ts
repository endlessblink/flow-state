/**
 * Theme Configuration System
 * Defines available themes and their token values
 */

export interface ThemeTokens {
  // Surface colors
  'surface-primary': string
  'surface-secondary': string
  'surface-tertiary': string
  'surface-elevated': string
  'surface-hover': string
  'surface-active': string

  // Glass effects
  'glass-bg-light': string
  'glass-bg-medium': string
  'glass-bg-heavy': string
  'glass-border': string
  'glass-border-hover': string

  // Text colors
  'text-primary': string
  'text-secondary': string
  'text-muted': string
  'text-subtle': string
  'text-disabled': string

  // Border colors
  'border-subtle': string
  'border-medium': string
  'border-strong': string
  'border-interactive': string
  'border-primary': string
  'border-secondary': string
  'border-hover': string

  // Shadows
  'shadow-sm': string
  'shadow-md': string
  'shadow-lg': string
  'shadow-xl': string
}

export interface Theme {
  id: string
  name: string
  tokens: ThemeTokens
}

/**
 * Dark Theme Configuration
 * Professional dark mode with dramatic glassmorphism
 */
export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark',
  tokens: {
    // Surfaces - Match design-tokens.css exactly
    'surface-primary': 'hsl(0, 0%, 12%)',  // --gray-950
    'surface-secondary': 'hsl(0, 0%, 17%)', // --gray-900
    'surface-tertiary': 'hsl(0, 0%, 22%)',  // --gray-800
    'surface-elevated': 'hsl(0, 0%, 27%)',  // --gray-700
    'surface-hover': 'rgba(255, 255, 255, 0.03)',
    'surface-active': 'rgba(255, 255, 255, 0.05)',

    // Glass effects - Match design-tokens.css exactly
    'glass-bg-light': 'rgba(255, 255, 255, 0.03)',
    'glass-bg-medium': 'rgba(255, 255, 255, 0.05)',
    'glass-bg-heavy': 'rgba(255, 255, 255, 0.08)',
    'glass-border': 'rgba(255, 255, 255, 0.10)',
    'glass-border-hover': 'rgba(255, 255, 255, 0.15)',

    // Text - Match design-tokens.css exactly
    'text-primary': 'hsl(0, 0%, 96%)',  // --gray-100
    'text-secondary': 'hsl(0, 0%, 91%)', // --gray-200
    'text-muted': 'hsl(0, 0%, 58%)',    // --gray-400
    'text-subtle': 'hsl(220, 9%, 40%)',
    'text-disabled': 'hsl(0, 0%, 47%)', // --gray-600

    // Borders - Match design-tokens.css exactly
    'border-subtle': 'rgba(255, 255, 255, 0.08)',
    'border-medium': 'rgba(255, 255, 255, 0.12)',
    'border-strong': 'rgba(255, 255, 255, 0.18)',
    'border-interactive': 'rgba(255, 255, 255, 0.24)',
    'border-primary': 'rgba(255, 255, 255, 0.10)',
    'border-secondary': 'rgba(255, 255, 255, 0.14)',
    'border-hover': 'rgba(255, 255, 255, 0.20)',

    // Shadows - Subtle depth, not dramatic
    'shadow-sm': '0 2px 4px rgba(0, 0, 0, 0.10)',
    'shadow-md': '0 4px 8px rgba(0, 0, 0, 0.12)',
    'shadow-lg': '0 8px 16px rgba(0, 0, 0, 0.15)',
    'shadow-xl': '0 12px 24px rgba(0, 0, 0, 0.18)',
  }
}

/**
 * Light Theme Configuration
 * Clean, bright interface with soft shadows
 */
export const lightTheme: Theme = {
  id: 'light',
  name: 'Light',
  tokens: {
    // Surfaces - Bright, clean backgrounds
    'surface-primary': 'hsl(220, 20%, 99%)',
    'surface-secondary': '#ffffff',
    'surface-tertiary': 'hsl(220, 20%, 97%)',
    'surface-elevated': 'hsl(220, 14%, 93%)',
    'surface-hover': 'rgba(0, 0, 0, 0.02)',
    'surface-active': 'rgba(0, 0, 0, 0.05)',

    // Glass effects - Subtle glass for light mode
    'glass-bg-light': 'rgba(255, 255, 255, 0.7)',
    'glass-bg-medium': 'rgba(255, 255, 255, 0.8)',
    'glass-bg-heavy': 'rgba(255, 255, 255, 0.9)',
    'glass-border': 'rgba(0, 0, 0, 0.1)',
    'glass-border-hover': 'rgba(0, 0, 0, 0.15)',

    // Text - Dark text on light backgrounds
    'text-primary': 'hsl(220, 13%, 9%)',
    'text-secondary': 'hsl(220, 13%, 18%)',
    'text-muted': 'hsl(220, 9%, 46%)',
    'text-subtle': 'hsl(220, 9%, 60%)',
    'text-disabled': 'hsl(220, 9%, 70%)',

    // Borders - Defined edges
    'border-subtle': 'rgba(0, 0, 0, 0.08)',
    'border-medium': 'rgba(0, 0, 0, 0.12)',
    'border-strong': 'rgba(0, 0, 0, 0.18)',
    'border-interactive': 'rgba(0, 0, 0, 0.24)',
    'border-primary': 'rgba(0, 0, 0, 0.10)',
    'border-secondary': 'rgba(0, 0, 0, 0.14)',
    'border-hover': 'rgba(0, 0, 0, 0.20)',

    // Shadows - Soft, elegant shadows
    'shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    'shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    'shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.15)',
    'shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
  }
}

/**
 * Available themes registry
 */
export const themes: Record<string, Theme> = {
  dark: darkTheme,
  light: lightTheme,
}

/**
 * Default theme
 */
export const DEFAULT_THEME = 'dark'

/**
 * Theme storage key
 */
export const THEME_STORAGE_KEY = 'pomo-flow-theme'
