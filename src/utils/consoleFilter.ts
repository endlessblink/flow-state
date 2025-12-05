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

  // Database logs
  if (!logToggles.database) {
    if (msg.includes('📂 Loaded') ||
        msg.includes('💾 Saved') ||
        msg.includes('📥 Successfully loaded') ||
        msg.includes('❌ Failed to load') ||
        msg.includes('💾 Save results') ||
        msg.includes('🔄 Auto backup')) {
      return true
    }
  }

  // Other logs
  if (!logToggles.cloudSync && (msg.includes('📴 Offline') || msg.includes('⚠️ Cloud sync') || msg.includes('💡 To enable cloud sync'))) return true
  if (!logToggles.storage && (msg.includes('📦 Available storage') || msg.includes('📁 File system'))) return true

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

// Initialize on module load
loadLogToggles()
applyConsoleFiltering()

// Expose to window for debugging
if (import.meta.env.DEV) {
  ;(window as any).consoleFilter = {
    getToggles: getLogToggles,
    saveToggles: saveLogToggles,
    restore: restoreConsole,
  }
}
