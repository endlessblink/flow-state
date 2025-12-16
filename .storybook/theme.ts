import { create } from 'storybook/theming'

export const customTheme = create({
  base: 'dark',

  // Force pure black throughout
  appBg: '#000000',
  appContentBg: '#000000',
  appBorderColor: '#1a1a1a',
  appBorderRadius: 4,

  // Typography
  fontBase: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontCode: 'ui-monospace, SFMono-Regular, Consolas, monospace',

  // Text colors
  textColor: '#e6edf3',
  textInverseColor: '#000000',
  textMutedColor: '#8b949e',

  // Toolbar/bar
  barBg: '#000000',
  barTextColor: '#e6edf3',
  barSelectedColor: '#3b82f6',
  barHoverColor: '#58a6ff',

  // Colors
  colorPrimary: '#3b82f6',
  colorSecondary: '#8b5cf6',

  // Input styling
  inputBg: '#0d1117',
  inputBorder: '#30363d',
  inputTextColor: '#e6edf3',
  inputBorderRadius: 6,

  // Button styling
  buttonBg: '#21262d',
  buttonBorder: '#30363d',

  // Boolean inputs
  booleanBg: '#0d1117',
  booleanSelectedBg: '#3b82f6',

  // Brand
  brandTitle: 'Pomo Flow Design System',
  brandUrl: 'https://github.com/yourusername/pomo-flow',
  brandTarget: '_self',
})

export default customTheme