import type { Preview } from '@storybook/vue3'
import type { App } from 'vue'
import { setup } from '@storybook/vue3'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import customTheme from './theme'
import i18n from '../src/i18n'

// Storybook dark mode override (must come first)
import './storybook-dark-override.css'

// Design system (order matters - must match main.ts)
import '../src/assets/design-tokens.css'
import '../src/assets/styles.css'

const pinia = createPinia()

// Create a mock router for components that need vue-router
const mockRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
    { path: '/board', name: 'board', component: { template: '<div>Board</div>' } },
    { path: '/calendar', name: 'calendar', component: { template: '<div>Calendar</div>' } },
    { path: '/canvas', name: 'canvas', component: { template: '<div>Canvas</div>' } },
  ],
})

setup((app: App) => {
  app.use(pinia)
  app.use(i18n)
  app.use(mockRouter)
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
        // Apply pure black background
        document.documentElement.style.setProperty('background-color', '#000000', 'important')
        document.body.style.backgroundColor = '#000000'
        document.body.style.color = '#e6edf3'
        document.documentElement.classList.add('dark-theme')
        document.documentElement.style.colorScheme = 'dark'
      }
      return story()
    },
  ],
}

export default preview
