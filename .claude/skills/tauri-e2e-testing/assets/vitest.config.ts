/**
 * Vitest Configuration for Tauri v2 Applications
 *
 * Copy this file to your project root.
 * Adjust paths as needed for your project structure.
 */
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],

  test: {
    // Enable globals (describe, it, expect)
    globals: true,

    // Use jsdom for DOM testing
    environment: 'jsdom',

    // Setup file for mocking Tauri APIs
    setupFiles: './src/tests/unit/setup.ts',

    // Include pattern
    include: ['src/tests/unit/**/*.spec.ts', 'src/tests/unit/**/*.test.ts'],

    // Exclude patterns
    exclude: ['node_modules', 'dist', 'src-tauri'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        'src-tauri/',
      ],
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 70,
        statements: 70,
      },
    },

    // Mock reset between tests
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    // Test timeout
    testTimeout: 10000,

    // Pool options for better performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Reporter
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/vitest-results.json',
    },
  },

  // Path aliases (should match tsconfig.json)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tauri-apps/api': path.resolve(__dirname, './src/tests/mocks/tauri-api'),
    },
  },
});
