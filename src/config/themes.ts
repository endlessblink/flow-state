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
    // Surfaces - Refined navy backgrounds matching screenshots
    'surface-primary': '#1e293b',
    'surface-secondary': '#2d3748',
    'surface-tertiary': '#374151',
    'surface-elevated': '#475569',
    'surface-hover': 'rgba(255, 255, 255, 0.03)',
    'surface-active': 'rgba(255, 255, 255, 0.05)',

    // Glass effects - SUBTLE, not dramatic
    'glass-bg-light': 'rgba(255, 255, 255, 0.03)',
    'glass-bg-medium': 'rgba(255, 255, 255, 0.05)',
    'glass-bg-heavy': 'rgba(255, 255, 255, 0.08)',
    'glass-border': 'rgba(16, 185, 129, 0.10)',
    'glass-border-hover': 'rgba(16, 185, 129, 0.15)',

    // Text - Professional hierarchy
    'text-primary': '#f1f5f9',
    'text-secondary': '#cbd5e1',
    'text-muted': '#94a3b8',
    'text-subtle': '#6b7280',
    'text-disabled': '#64748b',

    // Borders - Subtle, refined
    'border-subtle': 'rgba(255, 255, 255, 0.06)',
    'border-medium': 'rgba(255, 255, 255, 0.10)',
    'border-strong': 'rgba(255, 255, 255, 0.14)',
    'border-interactive': 'rgba(255, 255, 255, 0.18)',
    'border-primary': 'rgba(255, 255, 255, 0.08)',
    'border-secondary': 'rgba(255, 255, 255, 0.10)',
    'border-hover': 'rgba(255, 255, 255, 0.14)',

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
