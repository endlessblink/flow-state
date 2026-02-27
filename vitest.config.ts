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
  plugins: [vue()],
  define: {
    '__APP_VERSION__': JSON.stringify(packageVersion),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,ts,jsx,tsx}', 'src/**/__tests__/**/*.{js,ts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'tests/integration/**',
      'tests/e2e/**',
      'tests/canvas-characterization.test.ts',
      'tests/unit/canvas-resize-test*.test.ts',
    ],
    // Allow file system access for safety tests
    allowOnly: true,
    // Increase timeout for file system operations
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tauri-apps/api/path': fileURLToPath(new URL('./tests/mocks/tauri-path.ts', import.meta.url)),
      '@tauri-apps/api/core': fileURLToPath(new URL('./tests/mocks/tauri-core.ts', import.meta.url)),
      '@tauri-apps/api/window': fileURLToPath(new URL('./tests/mocks/tauri-window.ts', import.meta.url)),
      '@tauri-apps/plugin-fs': fileURLToPath(new URL('./tests/mocks/tauri-plugin-fs.ts', import.meta.url)),
      '@tauri-apps/plugin-dialog': fileURLToPath(new URL('./tests/mocks/tauri-plugin-dialog.ts', import.meta.url))
    }
  }
});
