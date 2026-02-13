import type { Preview } from '@storybook/vue3'
import type { App } from 'vue'
import { setup } from '@storybook/vue3'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n, type I18n } from 'vue-i18n'
import customTheme from './theme'
import en from '../src/i18n/locales/en.json'
import he from '../src/i18n/locales/he.json'

// TASK-054: Mark Storybook environment to prevent database writes
// This prevents stories from polluting the real app's IndexedDB
declare global {
  interface Window {
    __STORYBOOK__?: boolean
  }
}
window.__STORYBOOK__ = true

// Storybook dark mode override (must come first)
import './storybook-dark-override.css'

// Design system (order matters - must match main.ts)
import '../src/assets/design-tokens.css'
import '../src/assets/styles.css'

// Track which apps have been set up to avoid reinstalling plugins
const setupApps = new WeakSet<App>()

// Create a single i18n instance that can be reused
// This prevents "Unexpected return type in composer" errors
let sharedI18n: I18n | null = null

function getOrCreateI18n(): I18n {
  if (!sharedI18n) {
    sharedI18n = createI18n({
      legacy: false,
      locale: 'en',
      fallbackLocale: 'en',
      messages: { en, he },
      globalInjection: true,
      allowComposition: true
    })
  }
  return sharedI18n
}

setup((app: App) => {
  // Skip if already set up (prevents reinstallation errors)
  if (setupApps.has(app)) return
  setupApps.add(app)

  // Pinia - fresh instance for each app
  const pinia = createPinia()
  app.use(pinia)

  // i18n - use shared instance but install fresh for each app
  // Create fresh i18n for each app to avoid "already installed" errors
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en, he },
    globalInjection: true,
    allowComposition: true,
    // Explicitly set warnHtmlMessage to false to reduce noise
    warnHtmlMessage: false,
    missingWarn: false,
    fallbackWarn: false
  })
  app.use(i18n)

  // Router - fresh instance for each app
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
      { path: '/board', name: 'board', component: { template: '<div>Board</div>' } },
      { path: '/calendar', name: 'calendar', component: { template: '<div>Calendar</div>' } },
      { path: '/canvas', name: 'canvas', component: { template: '<div>Canvas</div>' } },
    ],
  })
  app.use(router)
})

// Global types for Storybook toolbar controls
export const globalTypes = {
  tauriMode: {
    name: 'Tauri Mode',
    description: 'Simulate Tauri WebKitGTK fallbacks (no backdrop-filter)',
    defaultValue: false,
    toolbar: {
      icon: 'mobile',
      items: [
        { value: false, title: 'Browser (Chromium)' },
        { value: true, title: 'Tauri (WebKitGTK)' }
      ],
      dynamicTitle: true,
    }
  }
}

const preview: Preview = {
  tags: ['autodocs'],
  initialGlobals: {
    // Enable tag-based sidebar filtering
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      theme: customTheme,
      story: {
        inline: true, // Better auto-height behavior
        height: 'auto', // Allow content to determine height
        iframeHeight: 800, // Increase minimum iframe height for complex content
      },
      canvas: {
        sourceState: 'hidden',
      },
      toc: true,
    },
    // Ensure all controls start minimized by default
    controls: {
      expanded: false, // Start minimized - collapse property descriptions in Controls table
      exclude: /^on[A-Z].*/, // Hide event handlers by default for cleaner interface
      sort: 'requiredFirst', // Show required props first
      hideNoControlsWarning: true, // Hide warning when no controls exist
    },
    options: {
      storySort: {
        method: 'alphabetical',
        order: [
          '📖 Introduction',
          '🎨 Design Tokens',
          '🧩 Components',
          [
            '🔘 Base',
            '📝 Form Controls',
            '🏷️ UI Elements',
            '*',
          ],
          '🎭 Overlays',
          [
            '🪟 Modals',
            '💬 Context Menus',
            '📋 Dropdowns & Popovers',
            '*',
          ],
          '✨ Features',
          [
            '📋 Board View',
            '🎨 Canvas View',
            '📅 Calendar View',
            '*',
          ],
          '*',
          '🧪 Experimental',
        ],
      },
    },
  },

  decorators: [
    // Tauri mode decorator - applies .tauri-app class based on global toggle
    (story: any, context: any) => {
      if (typeof document !== 'undefined') {
        // Apply or remove tauri-app class based on global toggle
        if (context.globals.tauriMode) {
          document.documentElement.classList.add('tauri-app')
          document.body.classList.add('tauri-app')
        } else {
          document.documentElement.classList.remove('tauri-app')
          document.body.classList.remove('tauri-app')
        }
      }
      return story()
    },
    // Dark theme and background decorator
    (story: any) => {
      if (typeof document !== 'undefined') {
        const appLayoutGradient = 'var(--app-background-gradient)'
        document.documentElement.style.setProperty('background', appLayoutGradient, 'important')
        document.body.style.background = appLayoutGradient
        document.documentElement.classList.add('dark-theme')
        document.documentElement.style.colorScheme = 'dark'
      }
      return story()
    },
  ],
}

export default preview
