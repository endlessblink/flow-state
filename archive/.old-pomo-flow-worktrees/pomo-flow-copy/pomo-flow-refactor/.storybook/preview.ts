import type { Preview } from '@storybook/vue3'
import type { App } from 'vue'
import { setup } from '@storybook/vue3'
import { createPinia } from 'pinia'
import { themes } from 'storybook/theming'

// Design system (order matters - must match main.ts)
import '../src/assets/design-tokens.css'
import '../src/assets/styles.css'

const pinia = createPinia()

setup((app: App) => {
  app.use(pinia)
})

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      theme: themes.dark,
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
        document.documentElement.classList.add('dark-theme')
        document.documentElement.style.colorScheme = 'dark'
        document.documentElement.style.backgroundColor = '#1a2332'
        document.body.style.backgroundColor = '#1a2332'
        document.body.style.color = '#f0f6fc'
      }
      return story()
    },
  ],
}

export default preview
