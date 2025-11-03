import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      include: [fileURLToPath(new URL('./src/i18n/locales/**', import.meta.url))],
      strictMessage: false,
      escapeHtml: false
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5547  // Worktree uses different port from main (5546)
  },
  build: {
    // Performance optimizations
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Code splitting for better performance
        manualChunks: {
          // Vue ecosystem
          vendor: ['vue', 'vue-router', 'pinia'],

          // UI components and styling
          ui: ['naive-ui', '@vueuse/core'],

          // Canvas and visualization
          canvas: ['@vue-flow/core', '@vue-flow/background', '@vue-flow/controls', 'konva', 'vue-konva'],

          // Date and time utilities
          date: ['date-fns', 'vue-cal', 'qalendar'],

          // Drag and drop
          dnd: ['vuedraggable', '@vueuse/gesture'],

          // Database and storage
          storage: ['localforage', 'yjs', 'y-indexeddb', 'y-websocket'],

          // Development and debugging tools
          dev: ['@vitest/browser', 'playwright']
        },
        // Optimize chunk loading
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // Optimize bundle size
    chunkSizeWarningLimit: 1000,
    // Enable tree shaking
    target: 'esnext',
    // Optimize for modern browsers
    cssCodeSplit: true
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
    ]
  }
})