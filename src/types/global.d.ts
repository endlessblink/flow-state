// Global window type declarations for Pomo-Flow backup system

declare global {
  // PouchDB types - must be in global scope for use across stores
  interface PouchDBDocument {
    _id: string
    _rev?: string
    _conflicts?: string[]
    [key: string]: unknown
  }

  interface PouchDBResponse {
    ok: boolean
    id: string
    rev: string
  }

  interface PouchDBRow {
    id: string
    key: string
    value: { rev: string }
    doc?: PouchDBDocument
  }

  interface PouchDBAllDocsResponse {
    total_rows: number
    offset: number
    rows: PouchDBRow[]
  }

  interface PouchDBChangesOptions {
    since?: string | number
    live?: boolean
    include_docs?: boolean
  }

  interface PouchDBChanges {
    on: (event: string, callback: (change: PouchDBChange) => void) => PouchDBChanges
    cancel: () => void
  }

  interface PouchDBChange {
    id: string
    seq: number | string
    changes: Array<{ rev: string }>
    doc?: PouchDBDocument
    deleted?: boolean
  }

  // PouchDB sync event types
  interface PouchDBSyncChange {
    direction: 'push' | 'pull'
    change: {
      docs: PouchDBDocument[]
      ok?: boolean
      errors?: unknown[]
    }
  }

  interface PouchDBSyncInfo {
    pending?: number
    ok?: boolean
    status?: string
    docs_read?: number
    docs_written?: number
  }

  interface PouchDBSyncError {
    message?: string
    status?: number
    error?: boolean
    reason?: string
  }

  interface PouchDBSyncHandler {
    on: (event: 'change' | 'paused' | 'active' | 'denied' | 'complete' | 'error', callback: (info: unknown) => void) => PouchDBSyncHandler
    cancel: () => void
  }

  // PouchDB instance type (simplified for window property)
  interface PomoFlowDB {
    get: (docId: string, options?: { conflicts?: boolean }) => Promise<PouchDBDocument>
    put: (doc: PouchDBDocument) => Promise<PouchDBResponse>
    remove: (docId: string, rev: string) => Promise<PouchDBResponse>
    allDocs: (options?: { include_docs?: boolean } & Record<string, unknown>) => Promise<PouchDBAllDocsResponse>
    bulkDocs: (docs: PouchDBDocument[]) => Promise<PouchDBResponse[]>
    changes: (options?: PouchDBChangesOptions) => PouchDBChanges
  }

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
    pomoFlowDb?: PomoFlowDB
    __pomoFlowUndoSystem?: UndoRedoActions
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
declare module '@/components/SyncStatusIndicator.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/SyncErrorBoundary.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/views/CanvasView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/TaskEditModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/CalendarInboxPanel.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/ForensicVerificationDashboard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/MultiSelectToggle.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/HierarchicalTaskRow.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/PerformanceTest.vue' {
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

declare module '@/components/SettingsModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/ProjectModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/GroupModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/BatchEditModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/CloudSyncSettings.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/BackupSettings.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/TaskContextMenu.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/SearchModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/CommandPalette.vue' {
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
declare module '@/components/ForensicVerificationDashboard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/MultiSelectToggle.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/HierarchicalTaskRow.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/PerformanceTest.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/CloudSyncSettings.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '@/components/TaskContextMenu.vue' {
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

declare module '@/components/KeyboardDeletionTest.vue' {
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