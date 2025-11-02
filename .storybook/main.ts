import type { StorybookConfig } from '@storybook/vue3-vite'
import { fileURLToPath, URL } from 'node:url'

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  ],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest'
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: {}
  },
  viteFinal: async (config) => {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          '@': fileURLToPath(new URL('../src', import.meta.url))
        },
        dedupe: ['vue', 'pinia'],
      },
    }
  },
}
export default config