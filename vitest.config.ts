/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const packageVersion = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')
).version;

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [
    // TASK-1470: Stub @tauri-apps/* packages for unit tests (mirrors vite.config.ts tauri-stub)
    {
      name: 'tauri-stub-test',
      resolveId(id: string) {
        if (id.startsWith('@tauri-apps/')) return '\0tauri-stub'
      },
      load(id: string) {
        if (id === '\0tauri-stub') return 'export default {}; export const invoke = () => {}; export const getCurrentWindow = () => ({}); export const homeDir = () => ""; export const attachConsole = () => {}; export const open = () => {}; export const load = () => ({}); export const check = () => ({}); export const relaunch = () => {}; export const Command = class {}; export const fetch = globalThis.fetch; export const writeTextFile = () => {}; export const mkdir = () => {}; export const exists = () => false; export const listen = () => () => {}; export const emit = () => {}; export const convertFileSrc = () => "";'
      }
    },
    vue(),
  ],
  define: {
    '__APP_VERSION__': JSON.stringify(packageVersion),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{js,ts,jsx,tsx}', 'src/**/__tests__/**/*.{js,ts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'tests/e2e/**',
      'tests/canvas-characterization.test.ts',
      'tests/unit/canvas-resize-test*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.stories.ts', 'src/**/*.spec.ts', 'src/**/*.test.ts', 'node_modules/**'],
    },
    // Allow file system access for safety tests
    allowOnly: true,
    // Keep unit tests from saturating the desktop on development machines.
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },
    maxConcurrency: 4,
    // Increase timeout for file system operations
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
