// 🚨 CACHE BREAKER - FORCES RELOAD - TIMESTAMP: 2025-11-08T16:49:00Z - V10 - SIMPLE BACKUP SYSTEM

// Console filter - reduces log noise in development (toggle via localStorage)
import './utils/consoleFilter'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import i18n from './i18n'

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

// Task disappearance logger - auto-enable for debugging BUG-020
import { taskDisappearanceLogger } from './utils/taskDisappearanceLogger'

const app = createApp(App)

app.use(createPinia())
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

// Auto-enable task disappearance logger for debugging (BUG-020)
// This will help identify mysterious task disappearances
setTimeout(() => {
  taskDisappearanceLogger.enable()
  console.log('%c[TASK-LOGGER] Auto-enabled for BUG-020 investigation', 'color: #4CAF50; font-weight: bold')
}, 2000) // Wait 2 seconds for store initialization
