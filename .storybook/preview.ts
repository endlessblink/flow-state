import type { Preview } from '@storybook/vue3'
import type { App } from 'vue'
import { setup } from '@storybook/vue3'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import customTheme from './theme'
import i18n from '../src/i18n'

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

const pinia = createPinia()

setup((app: App) => {
  app.use(pinia)
  app.use(i18n)

  // Create a new router instance for each story to avoid re-definition conflicts
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

const preview: Preview = {
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
