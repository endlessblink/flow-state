import { defineConfig } from 'vite'
// @ts-ignore
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'

import { visualizer } from 'rollup-plugin-visualizer'

// Cache duration constants for PWA
const CACHE_DURATIONS = {
  FIVE_MINUTES: 60 * 5, // BUG-023: Short TTL for API data
  ONE_DAY: 60 * 60 * 24,
  ONE_WEEK: 60 * 60 * 24 * 7,
  ONE_MONTH: 60 * 60 * 24 * 30,
  ONE_YEAR: 60 * 60 * 24 * 365,
} as const

// Check if running in Tauri context (dev or build)
// BUG-336: TAURI_DEV is set via beforeDevCommand in tauri.conf.json
// TAURI_ENV_PLATFORM is set during `tauri build`
const isTauri =
  process.env.TAURI_ENV_PLATFORM !== undefined ||
  process.env.TAURI_DEV !== undefined

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // PWA Plugin - ROAD-004 (disabled for Tauri builds - service workers don't work with tauri:// protocol)
    // BUG-336: Use `disable` option instead of conditional inclusion to provide proper stub modules
    VitePWA({
      disable: isTauri, // Provides empty stub modules for virtual:pwa-register imports
      registerType: 'autoUpdate', // Force update to clear old cache for user verification
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'FlowState',
        short_name: 'FlowState',
        description: 'Pomodoro timer with task management',
        theme_color: '#4F46E5',
        background_color: '#0f172a', // Dark mode background
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // TASK-1060: Skip API caching in service worker - use app-level SWR instead
        // Prevents stale data after realtime updates (cache invalidation conflict)
        navigateFallbackDenylist: [
          /^\/rest\//, // Supabase REST API
          /^\/auth\//, // Supabase Auth API
          /^\/realtime\//, // Supabase Realtime
        ],
        runtimeCaching: [
          // REMOVED: Supabase API caching - conflicts with realtime updates
          // App-level caching with realtime invalidation is implemented in useSupabaseDatabase
          // Images: Cache-first
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: CACHE_DURATIONS.ONE_MONTH,
              },
            },
          },
          // Fonts: Cache-first with long expiry
          {
            urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: CACHE_DURATIONS.ONE_YEAR,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // TASK-272: Disabled in dev to reduce HMR noise/flickering
        type: 'module',
      },
    }),
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
  ].filter(Boolean),
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
      external: [
        'fsevents'
        // BUG-336: Removed PWA externals - VitePWA({ disable: true }) now provides proper stubs
      ],
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
      'date-fns'
    ],
    // Force ESM interop for CJS modules
    needsInterop: [
      'uuid'
    ]
  },
  worker: {
    format: 'es' // CRITICAL: production builds require 'es' format
  },
  server: {
    allowedHosts: true
  }
}))