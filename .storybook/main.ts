import type { StorybookConfig } from '@storybook/vue3-vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config: StorybookConfig = {
  framework: '@storybook/vue3-vite',
  stories: ['../src/stories/**/*.stories.ts'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest'
  ],

  // Tag-based sidebar filters — allows filtering "New" vs "Reviewed" stories
  tags: {
    new: {
      title: '🆕 New',
      description: 'Newly added stories that need design review',
    },
    reviewed: {
      title: '✅ Reviewed',
      description: 'Stories that have been reviewed and approved',
    },
  },

  viteFinal: async (config) => {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          '@': resolve(__dirname, '../src'),
          '~': resolve(__dirname, '../src'),
          // Enable runtime compiler for inline template strings in story mocks
          'vue': resolve(__dirname, '../node_modules/vue/dist/vue.esm-bundler.js')
        }
      },
      plugins: [
        ...(config.plugins || []),
        // Mock virtual:pwa-register/vue for stories that import ReloadPrompt
        {
          name: 'mock-pwa-register',
          resolveId(id: string) {
            if (id === 'virtual:pwa-register/vue') return id
          },
          load(id: string) {
            if (id === 'virtual:pwa-register/vue') return `
              import { ref } from 'vue'
              export function useRegisterSW() {
                return { offlineReady: ref(false), needRefresh: ref(false), updateServiceWorker: () => {} }
              }
            `
          }
        }
      ],
      optimizeDeps: {
        ...config.optimizeDeps,
        exclude: ['vue-i18n', '@intlify/unplugin-vue-i18n']
      }
    }
  }
}

export default config