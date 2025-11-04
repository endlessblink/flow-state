// 🚨 CACHE BREAKER - FORCES RELOAD - TIMESTAMP: 2025-10-23T07:06:00Z - V9 - CREATE TASK UNDO FIX

// Initialize console filtering FIRST (before any other imports that might log)
import './utils/consoleFilter'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import i18n from './i18n'

// Design system (order matters)
// Note: design-tokens.css moved to App.vue for better HMR support
import './assets/styles.css'

// Initialize global error handler
import './utils/errorHandler'

// Initialize Firebase
import './config/firebase'

// Initialize authentication
import { useAuthStore } from './stores/auth'

// Initialize undo/redo keyboard shortcuts (using simple version to avoid circular dependencies)
import { initGlobalKeyboardShortcuts } from './utils/globalKeyboardHandlerSimple'

// Naive UI - will configure with custom theme
const meta = document.createElement('meta')
meta.name = 'naive-ui-style'
document.head.appendChild(meta)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

// Initialize authentication listener (must be after Pinia is installed, but before mount)
console.log('🔵 [MAIN.TS] About to initialize auth store...')
const authStore = useAuthStore()
console.log('🔵 [MAIN.TS] Auth store created, calling initAuthListener()...')

// Initialize auth listener asynchronously
authStore.initAuthListener()
  .then(() => {
    console.log('✅ [MAIN.TS] Auth listener initialized successfully')
  })
  .catch((error) => {
    console.warn('⚠️ [MAIN.TS] Auth listener initialization failed:', error)
  })
  .finally(() => {
    console.log('🔵 [MAIN.TS] initAuthListener() completed')
  })

// Initialize undo/redo system after mounting
const mountedApp = app.mount('#root')

// Initialize global keyboard shortcuts
console.log('🎯 [MAIN.TS] About to initialize global keyboard shortcuts...')
initGlobalKeyboardShortcuts({
  enabled: true,
  preventDefault: true,
  ignoreInputs: true,
  ignoreModals: true
}).then(() => {
  console.log('✅ [MAIN.TS] Global keyboard shortcuts initialized successfully')
}).catch(error => {
  console.error('❌ [MAIN.TS] Failed to initialize global keyboard shortcuts:', error)
})

// Add global keyboard event diagnostics to track all keyboard events
console.log('🔍 [MAIN.TS] Setting up global keyboard event diagnostics...')
window.addEventListener('keydown', (event) => {
  // Only log Shift+1-5 events to avoid console spam
  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key >= '1' && event.key <= '5') {
    console.log('🔍 [MAIN.TS] GLOBAL: Shift+' + event.key + ' detected at document level:', {
      eventPhase: event.eventPhase,
      target: event.target,
      currentTarget: event.currentTarget,
      timestamp: new Date().toISOString(),
      bubbles: event.bubbles,
      cancelable: event.cancelable
    })
  }
}, true) // Use capture phase to see events before any other handlers

export default mountedApp