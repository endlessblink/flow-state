import type { Theme } from '@storybook/theming'

export const customTheme: Theme = {
  base: 'dark',

  // Color palette matching our app's design system
  colorPrimary: '#3b82f6',
  colorSecondary: '#8b5cf6',

  // App UI colors - completely dark
  appBg: '#0d1117',
  appContentBg: '#0d1117',
  appBorderColor: '#334155',
  appBorderRadius: 8,

  // Text colors - bright for contrast
  barTextColor: '#e2e8f0',
  barSelectedColor: '#3b82f6',
  barBg: '#0d1117',

  // Input and button styling
  inputBg: '#0d1117',
  inputBorder: '#21262d',
  inputTextColor: '#e2e8f0',
  inputBorderRadius: 6,

  buttonBg: '#3b82f6',
  buttonBorder: '#2563eb',
  buttonTextColor: '#ffffff',
  buttonBorderRadius: 6,

  // Preview and documentation styling - fully dark
  previewBg: '#0d1117',
  previewTextColor: '#e2e8f0',

  // Sidebar styling - fully dark
  sidebarBg: '#0d1117',
  sidebarTextColor: '#e2e8f0',
  sidebarHoverBg: '#161b22',
  sidebarSelectedBg: '#161b22',

  // Typography
  fontBase: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontCode: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',

  // Branding
  brandTitle: 'Pomo Flow Design System',
  brandUrl: 'https://github.com/yourusername/pomo-flow',
}

export default customTheme