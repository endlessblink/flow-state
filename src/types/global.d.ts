// Global window type declarations for Pomo-Flow backup system
// TASK-136: PouchDB types removed Jan 2026 - app uses Supabase

declare global {
  // TASK-1322: Web Speech API types removed — Whisper via Groq is the only voice input method

  // Backup types
  interface BackupSnapshot {
    id: string
    timestamp: string
    data: unknown
  }

  // Undo/Redo system interface
  interface UndoRedoActions {
    createTask?: (taskData: Partial<import('@/types/tasks').Task>) => Promise<import('@/types/tasks').Task>
    updateTask?: (taskId: string, updates: Partial<import('@/types/tasks').Task>) => void
    deleteTask?: (taskId: string) => void
    deleteTaskWithUndo?: (taskId: string) => void
    undo?: () => void
    redo?: () => void
    canUndo: import('vue').ComputedRef<boolean> | boolean
    canRedo: import('vue').ComputedRef<boolean> | boolean
    undoCount?: import('vue').ComputedRef<number>
    redoCount?: import('vue').ComputedRef<number>
    history?: import('vue').Ref<unknown[]>
    commit?: () => void
    clear?: () => void
    [key: string]: unknown // Allow index access for dynamic method checks
  }

  // Notification options interface
  interface NotificationOptions {
    title?: string
    content?: string
    type?: 'info' | 'success' | 'warning' | 'error'
    duration?: number
  }

  interface Window {
    // TASK-054: Storybook environment flag to prevent database pollution
    __STORYBOOK__?: boolean
    // TASK-136: pomoFlowDb removed - PouchDB decommissioned, app uses Supabase
    __pomoFlowUndoSystem?: UndoRedoActions

    // ---- FlowState custom window properties ----
    // App lifecycle: timestamp when the session started (ms since epoch)
    FlowStateSessionStart?: number

    // Canvas interaction lock flags (set by drag/resize handlers)
    __FlowStateIsDragging?: boolean
    __FlowStateIsResizing?: boolean
    __FlowStateIsSettling?: boolean

    // Cross-tab coordination: unique ID per browser tab
    __flowstate_tab_id?: string

    // Dev-only Tauri debug helper (set in useIsTauriDebug when DEV=true)
    __flowstate_tauri_debug?: {
      getSummary: () => string
      exportHistory: () => string
      getTrend: () => unknown
    }

    // Tauri runtime markers (injected by Tauri WebView)
    __TAURI_INTERNALS__?: unknown
    __TAURI__?: unknown

    // Capacitor native platform detection (Ionic/Capacitor apps)
    Capacitor?: {
      isNativePlatform?: () => boolean
    }

    // Legacy Internet Explorer stream detection (used for iOS check)
    MSStream?: unknown

    // Legacy Opera browser user-agent property
    opera?: string

    pomoFlowBackup: {
      exportTasks: () => Promise<string>
      importTasks: (data: string) => Promise<void>
      downloadBackup: () => void
      restoreFromLatest: () => Promise<void>
      restoreFromBackup: (backup: BackupSnapshot) => Promise<void>
      createBackup: () => Promise<BackupSnapshot>
      getLatestBackup: () => BackupSnapshot | null
      getBackupHistory: () => BackupSnapshot[]
      listBackups: () => BackupSnapshot[]
      getBackupStatus: () => string
      hasBackups: () => boolean
      getHebrewTaskCount: () => number
      startAutoBackup: () => void
      stopAutoBackup: () => void
    }
    // Debug/Development API properties
    __notificationApi?: (options: NotificationOptions) => void
    vueFlowStability?: unknown
    vueFlowStateManager?: unknown
    vueFlowErrorHandling?: unknown
    vueFlowStore?: unknown
    // Safari WebKit Audio Context (for cross-browser compatibility)
    webkitAudioContext?: typeof AudioContext
    // Debug properties for development
    __lastDeletedGroup?: {
      id: string
      before: string[]
      after?: string[]
      missed?: boolean
    }
    // Canvas drag state
    __draggingTaskId?: string | null
    // Performance monitoring
    __performanceMonitorMemoryInterval?: ReturnType<typeof setInterval>
    // Garbage collection (V8 debug mode)
    gc?: () => void
    // Task store access for cross-tab sync
    taskStore?: {
      tasks: unknown[]
      loadTasks?: () => Promise<void>
    }
    // UI store access
    uiStore?: {
      sidebarOpen?: boolean
      activeView?: string
      theme?: string
    }
    // Canvas store access
    canvasStore?: {
      nodes?: unknown[]
      sections?: unknown[]
      viewport?: { x: number; y: number; zoom: number }
    }
  }
}

// vue-cal module declaration (missing types)
declare module 'vue-cal' {
  import { App } from 'vue'

  interface VueCalProps {
    activeView?: string
    events?: unknown[]
    selectable?: boolean
    hideViewSelector?: boolean
    hideTitleBar?: boolean
    hideWeekends?: boolean
    time?: boolean
    timeFrom?: number
    timeTo?: number
    timeStep?: number
    timeCellHeight?: number
    timeFormat?: string
    twelveHour?: boolean
    showTimeInCells?: boolean
    disableDays?: number[]
    eventsOnMonthView?: boolean
    minDate?: string | Date
    maxDate?: string | Date
    minEventWidth?: number
    maxEventWidth?: number
    specialHours?: Record<number, { label: string; class: string }>
    stickySplitLabels?: boolean
    splitDays?: number[]
    watchRealTime?: boolean
    onEventClick?: (event: unknown, window: unknown) => void
    onEventCreate?: (event: unknown, deleteEvent: () => void) => void
    onEventDelete?: (event: unknown) => void
    onEventDblClick?: (event: unknown, window: unknown) => void
    onViewChange?: (view: string, window: unknown) => void
    onCellClick?: (cell: unknown, window: unknown) => void
    onCellDoubleClick?: (cell: unknown, window: unknown) => void
  }

  const VueCal: DefineComponent<VueCalProps>
  export default VueCal
}

// Vue module declarations - Critical for TypeScript to recognize .vue files
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

// Root-relative Vue module declarations for development server compatibility
declare module './App.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

// Specific Vue component declarations for dynamic imports
declare module '@/views/CanvasView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/tasks/TaskEditModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/inbox/CalendarInboxPanel.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/sync/ForensicVerificationDashboard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/common/MultiSelectToggle.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/tasks/HierarchicalTaskRow.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/debug/PerformanceTest.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/kanban/TaskCard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/kanban/KanbanSwimlane.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/layout/SettingsModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/projects/ProjectModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/common/GroupModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/tasks/BatchEditModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/sync/CloudSyncSettings.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/sync/BackupSettings.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/tasks/TaskContextMenu.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/layout/SearchModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/layout/CommandPalette.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

// Additional view components
declare module '@/views/BoardView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/views/CalendarView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/views/CalendarViewVueCal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/views/AllTasksView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/views/QuickSortView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/views/FocusView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

// Missing component declarations from global tsc errors
declare module '@/components/sync/ForensicVerificationDashboard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/common/MultiSelectToggle.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/tasks/HierarchicalTaskRow.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/debug/PerformanceTest.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/sync/CloudSyncSettings.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/tasks/TaskContextMenu.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

// Kanban components
declare module '@/components/kanban/TaskCard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/kanban/KanbanSwimlane.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/debug/KeyboardDeletionTest.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module './App.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

// Universal path alias declarations for global TypeScript compatibility
declare module '@/components/*' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/views/*' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/stores/*' {
  const content: unknown
  export default content
}

declare module '@/utils/*' {
  const content: unknown
  export default content
}

declare module '@/types/*' {
  const content: unknown
  export default content
}

declare module '@/composables/*' {
  const content: unknown
  export default content
}

declare module '@/*' {
  const content: unknown
  export default content
}

export { }