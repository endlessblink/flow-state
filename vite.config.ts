import { defineConfig } from 'vite'
// @ts-ignore
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
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

// FEATURE-1345: Check if running in Capacitor context
const isCapacitor = process.env.CAPACITOR_PLATFORM !== undefined

// TASK-1715: Check if building for Electron (file:// needs relative base)
const isElectron = process.env.ELECTRON_BUILD !== undefined

// FEATURE-1194: Read version from package.json for injection into app
const packageVersion = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')
).version

export default defineConfig(({ mode }) => ({
  // TASK-1715: Electron loads from file:// which needs relative paths
  base: isElectron ? './' : '/',
  define: {
    '__APP_VERSION__': JSON.stringify(packageVersion),
    '__IS_CAPACITOR_BUILD__': isCapacitor,
  },
  plugins: [
    // TASK-1721: Stub @tauri-apps/* — packages removed, dead code behind isTauri()===false
    {
      name: 'tauri-stub',
      resolveId(id) {
        if (id.startsWith('@tauri-apps/')) return '\0tauri-stub'
      },
      load(id) {
        if (id === '\0tauri-stub') return 'export default {}; export const invoke = () => {}; export const getCurrentWindow = () => ({}); export const homeDir = () => ""; export const attachConsole = () => {}; export const open = () => {}; export const load = () => ({}); export const check = () => ({}); export const relaunch = () => {}; export const Command = class {}; export const fetch = globalThis.fetch; export const writeTextFile = () => {}; export const mkdir = () => {}; export const exists = () => false;'
      }
    },
    vue(),
    // PWA Plugin - ROAD-004 (disabled for desktop builds - service workers don't work with file:// / tauri:// protocols)
    // BUG-336: Use `disable` option instead of conditional inclusion to provide proper stub modules
    // TASK-1009: Switched to injectManifest for custom timer notification handlers
    VitePWA({
      disable: isTauri || isCapacitor || isElectron, // Provides empty stub modules for virtual:pwa-register imports
      strategies: 'injectManifest', // TASK-1009: Use custom SW for notification actions
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'FlowState',
        short_name: 'FlowState',
        description: 'FlowState — visual task management across Board, Calendar, and Canvas views with Pomodoro timer, AI assistant, and gamification',
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
      injectManifest: {
        // TASK-1009: Glob patterns for precaching
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Note: navigateFallbackDenylist is not used in injectManifest mode
        // API caching is handled at the app level via useSupabaseDatabase
      },
      devOptions: {
        // Dev mode manifest: static public/manifest.webmanifest + <link> in index.html (BUG-1679)
        enabled: false, // Disabled: caused infinite reload loop in dev mode (BUG-1112 notifications work via browser API)
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
    // TASK-1281/TASK-1148: Strip console.log, console.debug, console.info at build-time for production
    // Using 'pure' instead of 'drop' to preserve console.warn and console.error
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
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
        'fsevents',
      ],
      output: {
        format: 'es', // Workers MUST be 'es' format
        // BUG-1123: Split vendor chunks to reduce main bundle size (was 1.9MB)
        // BUG-1183: Fixed circular dependency - naive-ui must be in vue-vendor chunk
        manualChunks(id) {
          // BUG-1717: canvasTaskBridge uses module-level ref() calls. Keeping it in the
          // same chunk as Vue guarantees Vue is initialized before this module evaluates,
          // preventing "ref is not defined" errors from Rollup chunk-ordering races.
          if (id.includes('stores/canvasTaskBridge')) {
            return 'vue-vendor'
          }
          if (id.includes('node_modules')) {
            // Vue ecosystem - core framework + Naive UI (BUG-1183: naive-ui depends on Vue)
            // Must be in same chunk to prevent "can't access lexical declaration" errors
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('naive-ui')) {
              return 'vue-vendor'
            }
            // Vue Flow - large canvas library
            if (id.includes('@vue-flow')) {
              return 'vue-flow'
            }
            // Supabase - backend SDK
            if (id.includes('@supabase')) {
              return 'supabase'
            }
            // VueUse - composables
            if (id.includes('@vueuse')) {
              return 'vueuse'
            }
            // Date utilities
            if (id.includes('date-fns')) {
              return 'date-fns'
            }
            // TipTap editor
            if (id.includes('tiptap') || id.includes('prosemirror')) {
              return 'tiptap'
            }
            // Tauri APIs
            if (id.includes('@tauri-apps')) {
              return 'tauri'
            }
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
      '@supabase/supabase-js',
      'dexie',
      'lucide-vue-next',
      'vue-i18n',
      'dompurify',
      'marked'
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
