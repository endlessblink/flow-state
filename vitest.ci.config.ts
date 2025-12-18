/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

/**
 * CI-specific Vitest configuration
 *
 * This config runs only unit tests without Storybook browser tests.
 * Used by GitHub Actions CI workflow.
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/**/*.test.{js,ts,jsx,tsx}',
      'src/**/__tests__/**/*.test.{js,ts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      '**/*.stories.*',
      '**/*.spec.*'  // Exclude Playwright e2e tests
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['default'],
    passWithNoTests: true  // Don't fail if no tests found (allows gradual test adoption)
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
