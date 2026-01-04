import { defineConfig } from 'vite'
// @ts-ignore
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
// @ts-ignore
import wasm from 'vite-plugin-wasm'
// @ts-ignore
import topLevelAwait from 'vite-plugin-top-level-await'

import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      include: ['events', 'buffer', 'process'],
      globals: {
        global: true,
        process: true
      }
    }),
    VueI18nPlugin({
      include: [fileURLToPath(new URL('./src/i18n/locales/**', import.meta.url))],
      strictMessage: false,
      escapeHtml: false
    }),
    visualizer({
      open: false,
      filename: 'stats.html',
      gzipSize: true,
      brotliSize: true,
    })
  ],
  esbuild: {
    target: 'esnext',
    // TASK-038: Strip console.* in production for cleaner builds
    // Keeps console.error for critical production debugging
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    // Disable TypeScript checking for development
    // tsconfigRaw removed to fix type conflict
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Fix: uuid CommonJS -> ESM interop
      'uuid': fileURLToPath(new URL('./node_modules/uuid/dist/esm-browser/index.js', import.meta.url))
    }
  },
  // ...
  build: {
    // Simplified build for faster compilation
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      external: ['fsevents'],
      output: {
        format: 'es', // Workers MUST be 'es' format
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // ... existing chunks
          }
        }
      }
    },
    commonjsOptions: {
      include: [/node_modules/]
    },
    target: 'esnext'
  },
  // Development optimizations
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'naive-ui',
      '@vueuse/core',
      '@vue-flow/core',
      'date-fns',
      'js-logger' // Transitively required by PowerSync
    ],
    exclude: [
      '@powersync/web',
      '@journeyapps/wa-sqlite'
    ],
    // Force ESM interop for CJS modules
    needsInterop: [
      'uuid'
    ]
  },
  worker: {
    format: 'es', // CRITICAL: production builds require 'es' format
    plugins: () => [
      wasm(),
      topLevelAwait()
    ]
  }
}))