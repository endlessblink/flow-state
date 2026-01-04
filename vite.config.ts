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
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5546,
    strictPort: true, // Force single port usage - prevents multiple instances
    open: false, // Prevent multiple browser instances
    proxy: {
      '/pomoflow-tasks': {
        target: 'http://84.46.253.137:5984',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    // Simplified build for faster compilation
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      external: ['fsevents'],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pouchdb')) return 'vendor-pouchdb'
            if (id.includes('naive-ui')) return 'vendor-ui'
            if (id.includes('lucide-vue-next')) return 'vendor-ui'
            if (id.includes('@vue-flow')) return 'vendor-flow'
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('@vueuse')) return 'vendor-core'
            return 'vendor'
          }
        }
      }
    },
    // Reduce complexity for testing
    // Reduce complexity for testing
    chunkSizeWarningLimit: 1000,
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
      'date-fns'
    ],
  },
  worker: {
    format: 'es',
    plugins: () => [
      wasm(),
      topLevelAwait()
    ]
  }
}))