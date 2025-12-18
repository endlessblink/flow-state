// Global window type declarations for Pomo-Flow backup system

declare global {
  interface Window {
    pomoFlowBackup: {
      exportTasks: () => Promise<string>
      importTasks: (data: string) => Promise<void>
      downloadBackup: () => void
      restoreFromLatest: () => Promise<void>
      restoreFromBackup: (backup: any) => Promise<void>
      createBackup: () => Promise<any>
      getLatestBackup: () => any
      getBackupHistory: () => any[]
      listBackups: () => any[]
      getBackupStatus: () => string
      hasBackups: () => boolean
      getHebrewTaskCount: () => number
      startAutoBackup: () => void
      stopAutoBackup: () => void
    }
    // Debug/Development API properties
    __notificationApi?: (options: any) => void
    vueFlowStability?: any
    vueFlowStateManager?: any
    vueFlowErrorHandling?: any
    vueFlowStore?: any
  }
}

// vue-cal module declaration (missing types)
declare module 'vue-cal' {
  import { App } from 'vue'

  interface VueCalProps {
    activeView?: string
    events?: any[]
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
    onEventClick?: (event: any, window: any) => void
    onEventCreate?: (event: any, deleteEvent: () => void) => void
    onEventDelete?: (event: any) => void
    onEventDblClick?: (event: any, window: any) => void
    onViewChange?: (view: string, window: any) => void
    onCellClick?: (cell: any, window: any) => void
    onCellDoubleClick?: (cell: any, window: any) => void
  }

  const VueCal: DefineComponent<VueCalProps>
  export default VueCal
}

// Vue module declarations - Critical for TypeScript to recognize .vue files
declare module '*.vue' {
  import type { DefineComponent , DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Root-relative Vue module declarations for development server compatibility
declare module './App.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Specific Vue component declarations for dynamic imports
declare module '@/components/SyncStatusIndicator.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/SyncErrorBoundary.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/views/CanvasView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/TaskEditModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/CalendarInboxPanel.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/ForensicVerificationDashboard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/MultiSelectToggle.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/HierarchicalTaskRow.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/PerformanceTest.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/kanban/TaskCard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/kanban/KanbanSwimlane.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/SettingsModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/ProjectModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/GroupModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/BatchEditModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/CloudSyncSettings.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/BackupSettings.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/TaskContextMenu.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/SearchModal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/CommandPalette.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Additional view components
declare module '@/views/BoardView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/views/CalendarView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/views/CalendarViewVueCal.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/views/AllTasksView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/views/QuickSortView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/views/FocusView.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Missing component declarations from global tsc errors
declare module '@/components/ForensicVerificationDashboard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/MultiSelectToggle.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/HierarchicalTaskRow.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/PerformanceTest.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/CloudSyncSettings.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/TaskContextMenu.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Kanban components
declare module '@/components/kanban/TaskCard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/kanban/KanbanSwimlane.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/KeyboardDeletionTest.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module './App.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Universal path alias declarations for global TypeScript compatibility
declare module '@/components/*' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/views/*' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/stores/*' {
  const content: any
  export default content
}

declare module '@/utils/*' {
  const content: any
  export default content
}

declare module '@/types/*' {
  const content: any
  export default content
}

declare module '@/composables/*' {
  const content: any
  export default content
}

declare module '@/*' {
  const content: any
  export default content
}

export {}