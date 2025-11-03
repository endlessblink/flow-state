import type { Theme } from '@storybook/theming'

export const customTheme: Theme = {
  base: 'dark',

  // Color palette matching our app's design system
  colorPrimary: '#3b82f6',
  colorSecondary: '#8b5cf6',

  // App UI colors - completely dark
  appBg: '#1a2332',
  appContentBg: '#1a2332',
  appBorderColor: '#334155',
  appBorderRadius: 8,

  // Text colors - bright for contrast
  barTextColor: '#e2e8f0',
  barSelectedColor: '#3b82f6',
  barBg: '#1a2332',

  // Input and button styling
  inputBg: '#1a2332',
  inputBorder: '#334155',
  inputTextColor: '#e2e8f0',
  inputBorderRadius: 6,

  buttonBg: '#3b82f6',
  buttonBorder: '#2563eb',
  buttonTextColor: '#ffffff',
  buttonBorderRadius: 6,

  // Preview and documentation styling - dark but slightly lighter
  previewBg: '#1a2332',
  previewTextColor: '#e2e8f0',

  // Sidebar styling - dark
  sidebarBg: '#1a2332',
  sidebarTextColor: '#e2e8f0',
  sidebarHoverBg: '#1e293b',
  sidebarSelectedBg: '#1e293b',

  // Typography
  fontBase: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontCode: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',

  // Branding
  brandTitle: 'Pomo Flow Design System',
  brandUrl: 'https://github.com/yourusername/pomo-flow',
}

export default customTheme