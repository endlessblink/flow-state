import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  return {
  plugins: [
    vue(),
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
    })
  ],
  esbuild: {
    target: 'esnext',
    // Disable TypeScript checking for development
    tsconfigRaw: {
      compilerOptions: {
        noEmit: true,
        skipLibCheck: true
      }
    }
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
    // Proxy CouchDB to bypass CORS in development
    proxy: {
      '/couchdb': {
        target: 'http://84.46.253.137:5984',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/couchdb/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Add basic auth header from environment variables
            const username = env.VITE_COUCHDB_USERNAME || 'admin'
            const password = env.VITE_COUCHDB_PASSWORD || ''
            if (password) {
              const auth = Buffer.from(`${username}:${password}`).toString('base64')
              proxyReq.setHeader('Authorization', `Basic ${auth}`)
            }
          })
        }
      }
    }
  },
  build: {
    // Simplified build for faster compilation
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      external: ['fsevents']
    },
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
    ]
  }
  }
})