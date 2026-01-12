// 🚨 CACHE BREAKER - FORCES RELOAD - TIMESTAMP: 2026-01-02T07:30:00Z - V20 - BUG-058: FILTER NON-SYNCABLE DOCS FROM LIVE SYNC

// Console filter - reduces log noise in development (toggle via localStorage)
import './utils/consoleFilter'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { PiniaSharedState } from 'pinia-shared-state'
import router from './router'
import App from './App.vue'
import i18n from './i18n'

  // Early Tauri detection - must run BEFORE CSS import for proper fallback application
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ; (() => {
    const w = window as any
    if (('isTauri' in w && w.isTauri) || ('__TAURI__' in w) || ('__TAURI_INTERNALS__' in w)) {
      document.documentElement.classList.add('tauri-app')
    }
  })()

// Design system - Tailwind CSS must be imported here for Vite to process @tailwind directives
import './assets/styles.css'

// Initialize static resource cache for CSS and other assets
import { staticResourceCache } from './composables/useStaticResourceCache'

// Preload critical CSS files with static resource cache
const preloadCriticalResources = async () => {
  try {
    await staticResourceCache.preloadResources([
      { url: '/src/assets/styles.css', priority: 'high' }
    ])
  } catch {
    // Silent fail - CSS will load normally
  }
}

preloadCriticalResources()

// Initialize global error handler
import './utils/errorHandler'

// Initialize security systems
import { useSecurityHeaderManager as _useSecurityHeaderManager } from './utils/securityHeaderManager'
import { useCSPManager as _useCSPManager } from './utils/cspManager'
import { useSecurityMonitor as _useSecurityMonitor } from './utils/securityMonitor'

// SECURITY: App is now 100% Supabase standard

// Run pre-check and initialize app
async function initializeApp() {
  // NOTE: PouchDB migration cleanup removed Jan 2026 - migration complete
  console.log('🚀 [MAIN] Starting app initialization...')

  // Detect Tauri environment and apply class for CSS optimizations
  // WebKitGTK on Linux has limited backdrop-filter support, so we need fallbacks
  // Tauri v2 uses window.isTauri, older versions use __TAURI__ or __TAURI_INTERNALS__
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any
  const isTauriEnv = ('isTauri' in win && win.isTauri) ||
    ('__TAURI__' in win) ||
    ('__TAURI_INTERNALS__' in win)

  if (isTauriEnv) {
    document.documentElement.classList.add('tauri-app')
    document.body?.classList.add('tauri-app')
    console.log('🖥️ [MAIN] Tauri environment detected - applying CSS optimizations')
  } else {
    console.log('🌐 [MAIN] Browser environment detected')
  }

  try {
    // Analytics/Monitoring can go here
    console.log('📊 [MAIN] Monitoring systems active')
  } catch (error) {
    console.warn('⚠️ [MAIN] Initialization monitor warning:', error)
  }

  const app = createApp(App)

  // Create Pinia with cross-tab state synchronization
  // ROLLBACK: Remove PiniaSharedState plugin and revert to: app.use(createPinia())
  const pinia = createPinia()
  pinia.use(
    PiniaSharedState({
      enable: true,       // Enable cross-tab sync globally
      initialize: false,  // FIXED: Disable auto-hydration to prevent "ghost data" flash (BUG-037)
      type: 'native',     // Use BroadcastChannel API (fastest, best support)
    })
  )

  app.use(pinia)
  app.use(router)
  app.use(i18n)

  // Global error handler for extension compatibility
  app.config.errorHandler = (err, _vm, info) => {
    const errorStr = String(err);

    // Extension or harmless browser errors: log silently, don't crash
    if (errorStr.match(/chrome is not defined|browser is not defined|ResizeObserver loop completed/i)) {
      console.warn('ℹ️ [SILENCED] Harmless browser/extension error:', errorStr);
      return; // Don't propagate - app continues
    }

    // Real application errors: log normally
    console.error('App error:', err, info);
  };

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event.reason)
    if (reason.match(/chrome is not defined|ResizeObserver loop/i)) {
      event.preventDefault(); // Don't crash the app
    }
  });

  app.mount('#app')
}

// Start the app
initializeApp()
