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

  viteFinal: async (config) => {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          '@': resolve(__dirname, '../src'),
          '~': resolve(__dirname, '../src')
        }
      },
      optimizeDeps: {
        ...config.optimizeDeps,
        exclude: ['vue-i18n', '@intlify/unplugin-vue-i18n']
      }
    }
  }
}

export default config