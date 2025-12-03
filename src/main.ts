// 🚨 CACHE BREAKER - FORCES RELOAD - TIMESTAMP: 2025-11-08T16:49:00Z - V10 - SIMPLE BACKUP SYSTEM

// Console filter - initialize FIRST before any other imports to catch all logs
import { initialize as initConsoleFilter } from './utils/consoleFilter'
initConsoleFilter()

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
    console.log('✅ [MAIN.TS] Critical CSS resources preloaded')
  } catch (error) {
    console.warn('⚠ [MAIN.TS] Failed to preload CSS resources:', error)
  }
}

preloadCriticalResources()

// Initialize global error handler
import './utils/errorHandler'

// Initialize security systems
import { useSecurityHeaderManager } from './utils/securityHeaderManager'
import { useCSPManager } from './utils/cspManager'
import { useSecurityMonitor } from './utils/securityMonitor'

// Initialize local-first authentication system
import { useLocalAuthStore } from './stores/local-auth'
console.log('✅ Using local-first authentication system')

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

// Global error handler for extension compatibility
app.config.errorHandler = (err, vm, info) => {
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
