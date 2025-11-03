// 🚨 CACHE BREAKER - FORCES RELOAD - TIMESTAMP: 2025-10-23T07:06:00Z - V9 - CREATE TASK UNDO FIX

// Initialize console filtering FIRST (before any other imports that might log)
import './utils/consoleFilter'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import i18n from './i18n'

// Design system (order matters)
import './assets/design-tokens.css'
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

// Initialize undo/redo system after mounting
const mountedApp = app.mount('#root')

// Initialize authentication listener (must be after Pinia is installed)
const authStore = useAuthStore()
authStore.initAuthListener()

// Initialize global keyboard shortcuts
initGlobalKeyboardShortcuts({
  enabled: true,
  preventDefault: true,
  ignoreInputs: true,
  ignoreModals: true
}).catch(error => {
  console.error('Failed to initialize global keyboard shortcuts:', error)
})

export default mountedApp