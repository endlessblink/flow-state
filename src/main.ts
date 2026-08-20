// 🚨 CACHE BREAKER - FORCES RELOAD - TIMESTAMP: 2026-01-27T11:00:00Z - V24 - BUG-1090 FIX2
// BUG-1090: Capture task data BEFORE emit('close') to prevent null reference

// Cache bust version - increment to force new asset hashes
const __BUILD_VERSION__ = 'v24-bug1090-fix2-20260127'
console.log(`[FlowState] Build: ${__BUILD_VERSION__}`)

// Console filter - reduces log noise in development (toggle via localStorage)
import './utils/consoleFilter'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { PiniaSharedState } from 'pinia-shared-state'
import router from './router'
import App from './App.vue'
import i18n from './i18n'

  // Early platform detection - must run BEFORE CSS import for proper fallback application
  // TASK-1718: Electron migration — detect Electron via preload's window.electronAPI
  ; (() => {
    const w = window as unknown as Record<string, unknown>
    const isElectron = typeof w.electronAPI !== 'undefined'
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone

    if (isElectron) {
      document.documentElement.classList.add('electron-app')
    }
    if (isPWA) {
      document.documentElement.classList.add('pwa-app')
    }
  })()

// Design system - Tailwind CSS must be imported here for Vite to process @tailwind directives
import './assets/styles.css'

// TASK-1215: Preload UI state from Tauri native store before Vue mounts
import { preloadTauriUiState } from './composables/usePersistentRef'

// Initialize global error handler
import './utils/errorHandler'
import { startElectronRuntimeDiagnostics } from './utils/electronRuntimeDiagnostics'

// Initialize security systems
import { useSecurityHeaderManager as _useSecurityHeaderManager } from './utils/securityHeaderManager'
import { useCSPManager as _useCSPManager } from './utils/cspManager'
import { useSecurityMonitor as _useSecurityMonitor } from './utils/securityMonitor'

// SECURITY: App is now 100% Supabase standard

// Initialize Tauri log plugin early — must run before any other console output in Tauri
import { initTauriLogger } from './utils/tauriLogger'

// Run pre-check and initialize app
async function initializeApp() {
  // NOTE: PouchDB migration cleanup removed Jan 2026 - migration complete
  // NOTE: BUG-1533b IndexedDB cleanup removed Mar 2026 - already ran on all clients

  // Pipe console.* to tauri-plugin-log (stdout + log file) when running as desktop app
  await initTauriLogger()
  startElectronRuntimeDiagnostics()

  console.log('🚀 [MAIN] Starting app initialization...')

  // Detect Tauri environment and apply class for CSS optimizations
  // WebKitGTK on Linux has limited backdrop-filter support, so we need fallbacks
  // Tauri v2 uses window.isTauri, older versions use __TAURI__ or __TAURI_INTERNALS__
  const win = window as unknown as Record<string, unknown>
  const isTauriEnv = ('isTauri' in win && win.isTauri) ||
    ('__TAURI__' in win) ||
    ('__TAURI_INTERNALS__' in win)

  if (isTauriEnv) {
    document.documentElement.classList.add('tauri-app')
    document.body?.classList.add('tauri-app')
    console.log('🖥️ [MAIN] Tauri environment detected - applying CSS optimizations')
  } else if (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone) {
    document.documentElement.classList.add('pwa-app')
    document.body?.classList.add('pwa-app')
    console.log('📱 [MAIN] PWA standalone environment detected - applying CSS optimizations')
  } else {
    console.log('🌐 [MAIN] Browser environment detected')
  }

  try {
    // Analytics/Monitoring can go here
    console.log('📊 [MAIN] Monitoring systems active')
  } catch (error) {
    console.warn('⚠️ [MAIN] Initialization monitor warning:', error)
  }

  // TASK-1215: Load UI preferences from Tauri native store into localStorage
  // BEFORE Vue mounts, so useStorage/usePersistentRef picks up correct values
  await preloadTauriUiState()

  const app = createApp(App)

  // Create Pinia with cross-tab state synchronization
  // ROLLBACK: Remove PiniaSharedState plugin and revert to: app.use(createPinia())
  const pinia = createPinia()
  // BUG-1207 Fix 5.2: Disable PiniaSharedState globally.
  // Stores that handle their own sync (tasks, canvas, projects, timer)
  // must NOT use BroadcastChannel cross-tab sync - it fights with Supabase Realtime
  // and causes state overwrites. Individual UI-only stores can opt in via
  // share: { enable: true } in their store options if needed.
  pinia.use(
    PiniaSharedState({
      enable: false,      // BUG-1207: Disabled globally - stores opt in individually
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

  // Unhandled promise rejections are captured by GlobalErrorHandler (errorHandler.ts)
  // with throttled notifications. Only add a lightweight handler here for known-harmless errors.
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason)
    // Prevent default for harmless browser/extension/Tauri errors
    if (reasonStr.match(/chrome is not defined|ResizeObserver loop|plugin not found|plugin not initialized/i)) {
      event.preventDefault()
    }
  });

  app.mount('#app')

  const { getCrossTabSync } = await import('./composables/useCrossTabSync')
  getCrossTabSync().initialize()
}

// Start the app
initializeApp().catch((err) => {
  console.error('[FlowState] Fatal initialization error:', err)
})
