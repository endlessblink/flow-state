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
;(() => {
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

// Initialize local-first authentication system
import { useLocalAuthStore as _useLocalAuthStore } from './stores/local-auth'

// Task disappearance logger - kept for window.taskLogger side-effect (manual debugging)
import { taskDisappearanceLogger as _taskDisappearanceLogger } from './utils/taskDisappearanceLogger'

// BUG-057: Pre-initialization IndexedDB health check for Firefox/Zen browser
// This MUST run BEFORE Vue/Pinia is initialized to catch corrupted databases early
import { runPreInitializationCheck } from './composables/useDatabaseHealthCheck'

// Run pre-check and initialize app
async function initializeApp() {
  // BUG-057: Check IndexedDB health BEFORE creating Vue app
  // This prevents PouchDB from failing on corrupted Firefox databases
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
    const preCheckResult = await runPreInitializationCheck()

    if (preCheckResult.cleared) {
      console.log('🔄 [MAIN] Corrupted IndexedDB was cleared - reloading page...')
      // Page will reload - don't continue initialization
      window.location.reload()
      return
    }

    // Install Debug Helper for Zen/PouchDB debugging (console access)
    // Run `debugHelper.resetReplicationCheckpoint()` in console to fix stuck sync
    import('./utils/debugHelper').then(({ installDebugHelper }) => {
      installDebugHelper()
    })

    if (!preCheckResult.healthy && preCheckResult.error) {
      console.warn('⚠️ [MAIN] IndexedDB pre-check warning:', preCheckResult.error)
      // Continue anyway - PouchDB may still work or will handle it
    }
  } catch (error) {
    console.warn('⚠️ [MAIN] Pre-check failed, continuing anyway:', error)
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

    // Extension errors: log silently, don't crash
    if (errorStr.match(/chrome is not defined|browser is not defined/i)) {
      console.warn('🔌 Extension compatibility detected:', errorStr);
      return; // Don't propagate - app continues
    }

    // Real application errors: log normally
    console.error('App error:', err, info);
  };

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (String(event.reason).includes('chrome is not defined')) {
      event.preventDefault(); // Don't crash the app
    }
  });

  app.mount('#app')

  // Task disappearance logger available for manual debugging if needed:
  // Import: import { taskDisappearanceLogger } from './utils/taskDisappearanceLogger'
  // Enable: taskDisappearanceLogger.enable() or window.taskLogger.enable()
  // TASK-022 monitoring completed Dec 25, 2025 - no issues detected
}

// Start the app
initializeApp()
