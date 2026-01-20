/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';

/**
 * Vitest Benchmark Configuration
 * TASK-338: Comprehensive stress testing
 *
 * Separate config for benchmarks to avoid Storybook browser mode.
 * Run with: npx vitest bench --config vitest.bench.config.ts
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.bench.{js,ts}'],
    benchmark: {
      include: ['tests/**/*.bench.{js,ts}'],
      reporters: ['default'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
