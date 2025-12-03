/**
 * Console Filter Utility
 *
 * This utility intercepts console.log/warn/info calls and filters them based on
 * user preferences stored in localStorage.
 *
 * Must be initialized BEFORE any other code runs to catch all logs.
 */

// Helper function to check if task diagnostics should be logged
export const shouldLogTaskDiagnostics = () => {
  return import.meta.env.DEV &&
         localStorage.getItem('DEV_LOG_TASK_DIAGNOSTICS') === 'true'
}

// Environment-based logging control
const LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || (import.meta.env.PROD ? 'silent' : 'warn')
const IS_SILENT = LOG_LEVEL === 'silent'

interface LogToggles {
  timer: boolean
  tabUpdate: boolean
  taskFiltering: boolean
  taskUpdates: boolean
  undoSystem: boolean
  undoOperations: boolean
  canvasResize: boolean
  canvasDrag: boolean
  taskNodeTimer: boolean
  database: boolean
  cloudSync: boolean
  storage: boolean
  // New categories
  calendarDrag: boolean
  canvasSync: boolean
  memoryCleanup: boolean
  validation: boolean
  watchEffects: boolean
  systemInit: boolean
}

// Store original console methods
export const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
}

// Default: all logs disabled
let logToggles: LogToggles = {
  timer: false,
  tabUpdate: false,
  taskFiltering: false,
  taskUpdates: false,
  undoSystem: false,
  undoOperations: false,
  canvasResize: false,
  canvasDrag: false,
  taskNodeTimer: false,
  database: false,
  cloudSync: false,
  storage: false,
  // New categories
  calendarDrag: false,
  canvasSync: false,
  memoryCleanup: false,
  validation: false,
  watchEffects: false,
  systemInit: false,
}

// Load saved preferences
export function loadLogToggles(): LogToggles {
  try {
    const saved = localStorage.getItem('dev-log-toggles')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (typeof parsed === 'object' && parsed !== null) {
        logToggles = { ...logToggles, ...parsed }
      }
    }
  } catch (e) {
    console.error('Failed to load log toggles:', e)
  }
  return logToggles
}

// Save preferences
export function saveLogToggles(toggles: LogToggles): void {
  // Update module-level variable using Object.assign to maintain reference
  Object.assign(logToggles, toggles)

  // Save to localStorage
  localStorage.setItem('dev-log-toggles', JSON.stringify(toggles))

  // Debug confirmation
  console.log('🔧 Log toggles saved:', JSON.stringify(toggles))
}

// Check if a log message should be filtered
function shouldFilter(message: string): boolean {
  // In silent mode, filter ALL logs (console.error is not intercepted)
  if (IS_SILENT) {
    return true
  }

  const msg = String(message)

  // Timer logs
  if (!logToggles.timer) {
    if (msg.includes('🍅 DEBUG tabDisplayTime') ||
        msg.includes('🍅 DEBUG tabTitleWithTimer') ||
        msg.includes('🍅 DEBUG timerPercentage') ||
        msg.includes('🍅 DEBUG faviconStatus')) {
      return true
    }
  }

  if (!logToggles.tabUpdate && msg.includes('🍅 Browser Tab Update')) return true

  // Task logs
  if (!logToggles.taskFiltering) {
    if (msg.includes('🚨 TaskStore.filteredTasks') || msg.includes('🔧 TaskStore.filteredTasks')) {
      return true
    }
  }

  if (!logToggles.taskUpdates) {
    if (msg.includes('📝 taskStore') ||
        msg.includes('✅ Task updated') ||
        msg.includes('✏️ updateTaskWithUndo') ||
        msg.includes('📝 TaskId:') ||
        msg.includes('⚡ Using singleton')) {
      return true
    }
  }

  // Undo logs
  if (!logToggles.undoSystem) {
    if (msg.includes('🔍 [DEBUG] getUndoSystem') ||
        msg.includes('🔍 [DEBUG] refHistory') ||
        msg.includes('Creating SINGLE refHistory') ||
        msg.includes('✅ SINGLE refHistory')) {
      return true
    }
  }

  if (!logToggles.undoOperations) {
    if (msg.includes('💾 State saved') ||
        msg.includes('🔄 Executing undo') ||
        msg.includes('🔄 Executing redo') ||
        msg.includes('📋 Before execution') ||
        msg.includes('✅ Undo count after') ||
        msg.includes('✅ Can undo:')) {
      return true
    }
  }

  // Canvas logs
  if (!logToggles.canvasResize) {
    if (msg.includes('📐 [SectionNode]') ||
        msg.includes('🎯 [CanvasView] Section resize') ||
        msg.includes('📏 [CanvasView]') ||
        msg.includes('🔍 Resize Debug') ||
        msg.includes('Undo/Redo updateSection')) {
      return true
    }
  }

  if (!logToggles.canvasDrag) {
    if (msg.includes('Started dragging') ||
        msg.includes('Section dragged') ||
        msg.includes('[handleNodeDragStop]') ||
        msg.includes('[getContainingSection]') ||
        msg.includes('[applySectionPropertiesToTask]')) {
      return true
    }
  }

  if (!logToggles.taskNodeTimer && msg.includes('🍅 DEBUG TaskNode isTimerActive')) return true

  // Database logs (comprehensive)
  if (!logToggles.database) {
    if (msg.includes('📂 Load') ||
        msg.includes('💾 Saved') ||
        msg.includes('💾 Default project') ||
        msg.includes('📥 Successfully loaded') ||
        msg.includes('❌ Failed to load') ||
        msg.includes('💾 Save results') ||
        msg.includes('🔄 Auto backup') ||
        msg.includes('[USE-DATABASE]') ||
        msg.includes('PouchDB') ||
        msg.includes('POUCHDB') ||
        msg.includes('pouchdb') ||
        msg.includes('Initializing store from') ||
        msg.includes('Waiting for PouchDB') ||
        msg.includes('[CIRCUIT BREAKER]') ||
        msg.includes('[CONFLICT RESOLVER]') ||
        msg.includes('[SYNC-INIT]') ||
        msg.includes('[STATIC_CACHE]') ||
        msg.includes('🗄️') ||
        msg.includes('TASKS.TS LOADING') ||
        msg.includes('Task store connected') ||
        msg.includes('🛑 Cleared pending') ||
        msg.includes('migration not needed') ||
        msg.includes('Tasks auto-saved') ||
        msg.includes('🔧 DEBUG:')) {
      return true
    }
  }

  // Other logs
  if (!logToggles.cloudSync && (msg.includes('📴 Offline') || msg.includes('⚠️ Cloud sync') || msg.includes('💡 To enable cloud sync'))) return true
  if (!logToggles.storage && (msg.includes('📦 Available storage') || msg.includes('📁 File system'))) return true

  // Calendar drag operations
  if (!logToggles.calendarDrag) {
    if (msg.includes('[CalendarDrag]') ||
        msg.includes('[CalendarResize]') ||
        msg.includes('CALENDAR DROP') ||
        msg.includes('Ghost preview') ||
        msg.includes('[useCalendarDayView]')) {
      return true
    }
  }

  // Canvas sync operations (comprehensive)
  if (!logToggles.canvasSync) {
    if (msg.includes('[CANVAS]') ||
        msg.includes('Canvas sync') ||
        msg.includes('Safely syncing tasks') ||
        msg.includes('task nodes created') ||
        msg.includes('[syncNodes]') ||
        msg.includes('[syncEdges]') ||
        msg.includes('[SYNC]') ||
        msg.includes('[SAFE SYNC]') ||
        msg.includes('[EMERGENCY]') ||
        msg.includes('Canvas has no nodes') ||
        msg.includes('Empty canvas ready') ||
        msg.includes('CanvasView mounted') ||
        msg.includes('Vue Flow component') ||
        msg.includes('[VUE_FLOW') ||
        msg.includes('[Zoom Debug]') ||
        msg.includes('showSectionTypeDropdown') ||
        msg.includes('Cross-tab sync')) {
      return true
    }
  }

  // Memory and cleanup logs
  if (!logToggles.memoryCleanup) {
    if (msg.includes('[MEMORY]') ||
        msg.includes('[BATCH]') ||
        msg.includes('[VUE_FLOW]') ||
        msg.includes('[RESOURCE_MANAGER]') ||
        msg.includes('[CLEANUP]')) {
      return true
    }
  }

  // Validation messages
  if (!logToggles.validation) {
    if (msg.includes('Validation failed') ||
        msg.includes('Invalid node') ||
        msg.includes('Invalid edge') ||
        msg.includes('Insufficient nodes')) {
      return true
    }
  }

  // Vue watchEffect logs
  if (!logToggles.watchEffects) {
    if (msg.includes('[WATCHEFFECT]') ||
        msg.includes('watchEffect') ||
        msg.includes('Tasks changed:')) {
      return true
    }
  }

  // System initialization logs (comprehensive)
  if (!logToggles.systemInit) {
    if (msg.includes('[MAIN.TS]') ||
        msg.includes('[DATABASE CONFIG]') ||
        msg.includes('✅ Using local-first') ||
        msg.includes('[SYSTEM]') ||
        msg.includes('App initialized') ||
        msg.includes('Welcome to Pomo-Flow') ||
        msg.includes('Welcome back') ||
        msg.includes('Production logger initialized') ||
        msg.includes('tab visibility') ||
        msg.includes('Tab visibility') ||
        msg.includes('[SIDEBAR TOGGLE]') ||
        msg.includes('[PROJECTS DEBUG]') ||
        msg.includes('📊 Root projects') ||
        msg.includes('📊 Child projects') ||
        msg.includes('🍅 DEBUG:') ||
        msg.includes('Browser tab composable') ||
        msg.includes('DevLogController initialized') ||
        msg.includes('refHistoryInstance') ||
        msg.includes('[DEBUG] No refHistory') ||
        msg.includes('Remote sync') ||
        msg.includes('[AUTO-SYNC]') ||
        msg.includes('All logs are HIDDEN') ||
        msg.includes('Log toggles saved') ||
        msg.includes('Current toggle states')) {
      return true
    }
  }

  return false
}

// Apply console filtering
export function applyConsoleFiltering(): void {
  console.log = (...args: any[]) => {
    const firstArg = args[0]
    if (!shouldFilter(firstArg)) {
      originalConsole.log(...args)
    }
  }

  console.warn = (...args: any[]) => {
    const firstArg = args[0]
    if (!shouldFilter(firstArg)) {
      originalConsole.warn(...args)
    }
  }

  console.info = (...args: any[]) => {
    const firstArg = args[0]
    if (!shouldFilter(firstArg)) {
      originalConsole.info(...args)
    }
  }
}

// Restore original console
export function restoreConsole(): void {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  console.info = originalConsole.info
  console.debug = originalConsole.debug
}

// Get current toggles (reload from localStorage to ensure fresh data)
export function getLogToggles(): LogToggles {
  try {
    const saved = localStorage.getItem('dev-log-toggles')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (typeof parsed === 'object' && parsed !== null) {
        // Update module-level variable
        Object.assign(logToggles, parsed)
        return { ...logToggles }
      }
    }
  } catch (e) {
    console.error('Failed to get log toggles:', e)
  }
  return { ...logToggles }
}

// Initialize console filtering - must be called explicitly from main.ts
export function initialize(): void {
  // SSR safety check
  if (typeof window === 'undefined') {
    return
  }

  try {
    loadLogToggles()
    applyConsoleFiltering()

    // Expose to window for debugging in development
    if (import.meta.env.DEV) {
      ;(window as any).consoleFilter = {
        getToggles: getLogToggles,
        saveToggles: saveLogToggles,
        restore: restoreConsole,
      }
    }
  } catch (e) {
    originalConsole.warn('Console filter initialization failed:', e)
  }
}

// Auto-initialize immediately when module loads (with safety guards)
// This ensures filtering is active before any other modules log
try {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    loadLogToggles()
    applyConsoleFiltering()
  }
} catch {
  // Silently fail - initialize() will be called later as backup
}
