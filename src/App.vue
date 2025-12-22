<template>
  <NConfigProvider :theme="darkTheme">
    <NGlobalStyle />
    <NMessageProvider>
      <!-- PROFESSIONAL PROJECT MANAGEMENT SYSTEM - CODOMO STYLE -->
      <div class="app" :class="{ 'sidebar-hidden': !uiStore.mainSidebarVisible }" :dir="direction">
        <!-- LEFT SIDEBAR NAVIGATION -->
        <AppSidebar ref="appSidebar" class="sidebar" />

        <!-- FLOATING SIDEBAR TOGGLE (visible when sidebar is hidden) -->
        <button
          v-if="!uiStore.mainSidebarVisible"
          class="floating-sidebar-toggle"
          :title="`Show Sidebar (${isMac ? 'Cmd' : 'Ctrl'}+B)`"
          aria-label="Show sidebar"
          @click="uiStore.toggleMainSidebar"
        >
          <PanelLeft :size="20" />
        </button>

        <!-- MAIN CONTENT AREA -->
        <main class="main-content" :class="{ 'sidebar-hidden': !uiStore.mainSidebarVisible }">
          <!-- CONSOLIDATED HEADER LAYOUT -->
          <AppHeader />

          <!-- ROUTER VIEW FOR DIFFERENT VIEWS - ErrorBoundary removed for debugging -->
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <div v-if="Component" :key="$route.fullPath" class="view-wrapper">
                <!-- DEBUG: ErrorBoundary temporarily removed to expose navigation errors -->
                <component :is="Component" />
              </div>
            </transition>
          </router-view>
        </main>

        <!-- MODAL MANAGER (Handles all global modals) -->
        <ModalManager ref="modalManager" />

        <!-- FAVICON MANAGER - Dynamic favicon with timer progress -->
        <FaviconManager />


    
        <!-- AUTHENTICATION MODAL - Firebase Auth disabled -->
        <!-- AuthModal /-->
        <!-- ⚠️ Authentication disabled - Firebase authentication offline -->
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
// Import design tokens first for better HMR support
import '@/assets/design-tokens.css'

import { NConfigProvider, NMessageProvider, NGlobalStyle, darkTheme, useMessage } from 'naive-ui'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
// ⚠️ Firebase Auth disabled for stability
// import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { useTheme } from '@/composables/useTheme'
import { useDirection } from '@/i18n/useDirection'
import { useRouter } from 'vue-router'
import { useSidebarManagement } from '@/composables/app/useSidebarManagement'
// 🚨 FORCE CACHE BREAKER - UNDO SINGLETON V3 - 2025-10-22T22:58:00Z
import { getUndoSystem } from '@/composables/undoSingleton'
import { provideProgressiveDisclosure } from '@/composables/useProgressiveDisclosure'
import { provideFocusMode } from '@/composables/useFocusMode'
import { useSidebarToggle } from '@/composables/useSidebarToggle'
import { useFavicon } from '@/composables/useFavicon'
import { useBrowserTab } from '@/composables/useBrowserTab'
import { useSafariITPProtection } from '@/utils/safariITPProtection'
import { getGlobalReliableSyncManager } from '@/composables/useReliableSyncManager'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import ModalManager from '@/layouts/ModalManager.vue'
import AppSidebar from '@/layouts/AppSidebar.vue'
import AppHeader from '@/layouts/AppHeader.vue'
import FaviconManager from '@/components/FaviconManager.vue'
// ⚠️ Firebase Auth components disabled for stability
// import AuthModal from '@/components/auth/AuthModal.vue'
// import UserProfile from '@/components/auth/UserProfile.vue'
import { initGlobalKeyboardShortcuts, destroyGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'
import type { Task, Project } from '@/stores/tasks'
import { PanelLeft } from 'lucide-vue-next'

// Stores
const timerStore = useTimerStore()
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const uiStore = useUIStore()
// ⚠️ Firebase Auth disabled - using placeholder
// const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const router = useRouter()

// Initialize sidebar management composable
const sidebar = useSidebarManagement()

// Placeholder auth store for local mode
const authStore = {
  isAuthenticated: ref(false),
  isLoading: ref(false)
}

// RTL/LTR direction support
const { direction, isRTL } = useDirection()

// Development mode check for dev tools
const isDev = import.meta.env.DEV

// Unified Undo/Redo system - use shared singleton instance
const undoHistory = getUndoSystem()



// Theme management simplified to dark-only mode
// const { isDarkMode, toggleTheme, initializeTheme } = useTheme() // DISABLED: Dark mode set by default in index.html

// Progressive Disclosure - ADHD Feature #2 (disabled by default)
// Focus Mode - ADHD Feature Phase 2
provideFocusMode()
provideProgressiveDisclosure()

// Sidebar Toggle - ADHD Feature #5 (reduce visual noise)
useSidebarToggle()

// Favicon management - dynamic based on timer state
useFavicon()

// Safari ITP Protection - warn users about 7-day data deletion
const itpProtection = useSafariITPProtection()

// Browser tab management - dynamic tab titles and favicons
const browserTab = useBrowserTab()

// Debug: Verify browser tab composable is initialized
console.log('🍅 DEBUG: Browser tab composable initialized:', {
  isSupported: browserTab.isSupported,
  originalTitle: browserTab.originalTitle,
  methods: {
    updateTabTitle: typeof browserTab.updateTabTitle,
    updateFavicon: typeof browserTab.updateFavicon,
    createTimerFavicon: typeof browserTab.createTimerFavicon,
    restoreTabState: typeof browserTab.restoreTabState
  }
})

// Using sidebar composable state instead of local state
// const showCreateProject = sidebar.showCreateProject
// const expandedProjects = sidebar.expandedProjects
// const showProjectModal = sidebar.showProjectModal
// const editingProject = sidebar.editingProject

// Modal Manager Ref
const modalManager = ref<InstanceType<typeof ModalManager> | null>(null)
const appSidebar = ref<InstanceType<typeof AppSidebar> | null>(null)

// Project context menu state (used by handleProjectContextMenu)
const projectContextMenuX = ref(0)
const projectContextMenuY = ref(0)
const contextMenuProject = ref<Project | null>(null)

// Platform detection
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

// Note: Using useSidebarManagement composable for project filtering
// This ensures consistent project filtering across the application

// ============================================================================
// SMART VIEW COUNTS - FIX Dec 5, 2025
// ============================================================================
// PROBLEM: App.vue had duplicated count logic that was inconsistent with
// the centralized useSmartViews composable used by taskStore.smartViewTaskCounts.
//
// ROOT CAUSE: weekTaskCount didn't check task.dueDate, only instances/scheduledDate
// This caused "This Week: 0" in sidebar when tasks had dueDate but no scheduledDate.
//
// SOLUTION: Use centralized taskStore.smartViewTaskCounts which uses useSmartViews
// composable for consistent filtering logic across the entire application.
// ============================================================================

// Sidebar counts and titles moved to AppSidebar


// Navigation moved to AppSidebar

// Navigation moved to AppSidebar




// Global new task handler
const handleGlobalNewTask = () => {
  appSidebar.value?.focusQuickTask()
}

// Project Navigation Methods
// Using sidebar composable functions instead of local implementations
// const toggleProjectExpansion = sidebar.toggleProjectExpansion
// const selectProject = sidebar.selectProject

// Keyboard navigation for project tree
// Navigation moved to AppSidebar


// Smart view logic moved to AppSidebar

const handleTaskDragStart = (event: DragEvent, task: Task) => {
  if (event.dataTransfer) {
    // Emit custom event for ghost preview in CalendarView
    window.dispatchEvent(new CustomEvent('task-drag-start', {
      detail: {
        duration: task.estimatedDuration || 30,
        title: task.title
      }
    }))

    const dragData = {
      type: 'task',
      taskId: task.id,
      title: task.title,
      source: 'sidebar'
    }

    // Research Pattern: Multiple data formats for cross-browser compatibility
    const dataString = JSON.stringify(dragData)
    event.dataTransfer.setData('application/json', dataString)
    event.dataTransfer.setData('text/plain', dataString)
    event.dataTransfer.setData('text', dataString)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.dropEffect = 'move'

    console.log('Drag started with data:', dataString)
    console.log('Drag data types set:', ['application/json', 'text/plain', 'text'])

    // Add visual feedback
    if (event.target instanceof HTMLElement) {
      event.target.style.opacity = '0.5'
      setTimeout(() => {
        if (event.target instanceof HTMLElement) {
          event.target.style.opacity = '1'
        }
      }, 100)
    }
  }
}



// Project management methods
// Using sidebar composable functions instead of local implementations
const openCreateProject = sidebar.openCreateProject
const openEditProject = sidebar.openEditProject

const handleProjectContextMenu = (event: MouseEvent, project: Project) => {
  event.preventDefault()
  event.stopPropagation()

  projectContextMenuX.value = event.clientX
  projectContextMenuY.value = event.clientY
  contextMenuProject.value = project
  modalManager.value?.openProjectContextMenu(event, project)
}

// Methods migrated to ModalManager

// deleteProject removed - using taskStore.deleteProject() which properly handles task reassignment

// Task management methods
const openEditTask = (task: Task) => {
  modalManager.value?.openEditTask(task)
}

const confirmDeleteTask = async (task: Task) => {
  const message = `Delete task "${task.title}"?`
  const action = async () => {
    // Use the unified undo system
    const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
    const undoRedoActions = useUnifiedUndoRedo()
    await undoRedoActions.deleteTaskWithUndo(task.id)
  }
  modalManager.value?.openConfirmationModal('Confirm Deletion', message, action)
}

const handleContextMenuDelete = (taskId: string, instanceId?: string, isCalendarEvent?: boolean) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (!task) return

  if (isCalendarEvent && instanceId) {
    // Calendar event deletion - remove specific instance
    const message = `Remove "${task.title}" from calendar?`
    const details = ['This will remove the scheduled instance and return the task to the sidebar.']
    const action = () => {
      taskStore.deleteTaskInstance(taskId, instanceId)
      modalManager.value?.closeTaskContextMenu()
    }
    modalManager.value?.openConfirmationModal('Confirm Removal', message, action, details)
  } else {
    // Regular task deletion
    confirmDeleteTask(task)
  }
}

const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
  modalManager.value?.openTaskContextMenu(event, task)
}

const closeTaskContextMenu = () => {
  modalManager.value?.closeTaskContextMenu()
}

// Listen for task edit requests from calendar/other views
const handleOpenTaskEdit = (event: CustomEvent) => {
  const task = taskStore.tasks.find(t => t.id === event.detail.taskId)
  if (task) {
    openEditTask(task)
  }
}

const handleDeleteSelectedTasks = () => {
  let selectedTaskIds = [...taskStore.selectedTaskIds]

  // Also check canvas selections if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const canvasStore = useCanvasStore()

    // Add canvas-selected task nodes (filter out section nodes)
    const canvasTaskIds = canvasStore.selectedNodeIds.filter((nodeId: string) => {
      const task = taskStore.tasks.find(t => t.id === nodeId)
      return !!task
    })

    // Merge selections, removing duplicates
    selectedTaskIds = [...new Set([...selectedTaskIds, ...canvasTaskIds])]
  } catch {
    // Canvas store not available, continue with global selections only
  }

  if (selectedTaskIds.length === 0) {
    return
  }

  // Get the task details for confirmation message
  const selectedTasks = taskStore.tasks.filter(task => selectedTaskIds.includes(task.id))
  let message = ''
  let details: string[] = []

  if (selectedTasks.length === 1) {
    // Single task deletion
    const task = selectedTasks[0]
    message = `Delete task "${task.title}"?`
    details = ['This will permanently remove the task from all views.']
  } else {
    // Multiple task deletion
    message = `Delete ${selectedTasks.length} selected tasks?`
    const taskTitles = selectedTasks.map(task => `• ${task.title}`)
    details = [
      'This will permanently remove the following tasks from all views:',
      ...taskTitles
    ]
  }

  const action = async () => {
    const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
    const undoRedoActions = useUnifiedUndoRedo()
    for (const taskId of selectedTaskIds) {
      await undoRedoActions.deleteTaskWithUndo(taskId)
    }
    taskStore.clearSelection()
  }

  modalManager.value?.openConfirmationModal('Confirm Deletion', message, action, details)
}

// Undo/Redo handlers
const handleUndo = async () => {
  console.log('🎹 Ctrl+Z keyboard shortcut detected in App.vue')
  console.log('🎹 Current undo stack size:', undoHistory.undoCount.value)
  console.log('🎹 Can undo:', undoHistory.canUndo.value)

  try {
    await undoHistory.undo()
    console.log('✅ Undo successful - task should be restored')
    console.log('🎹 Undo stack size after undo:', undoHistory.undoCount.value)
    // You could add a toast notification here if you have one
  } catch (error) {
    console.error('❌ Undo failed:', error)
  }
}

const handleRedo = async () => {
  console.log('🎹 Ctrl+Y keyboard shortcut detected in App.vue')
  console.log('🎹 Current redo stack size:', undoHistory.redoCount.value)
  console.log('🎹 Can redo:', undoHistory.canRedo.value)

  try {
    // FIXED: Use the same undoHistory instance for consistency
    await undoHistory.redo()
    console.log('✅ Redo successful - task should be restored again')
    console.log('🎹 Redo stack size after redo:', undoHistory.redoCount.value)
    // You could add a toast notification here if you have one
  } catch (error) {
    console.error('❌ Redo failed:', error)
  }
}

// Route mapping for keyboard shortcuts
const viewRouteMap = {
  '1': '/',
  '2': '/calendar',
  '3': '/canvas',
  '4': '/catalog',
  '5': '/quick-sort'
}

// Helper function to check if element should ignore keyboard shortcuts
const shouldIgnoreElement = (target: HTMLElement | null): boolean => {
  if (!target) return false

  // 🔧 FIX: Allow Enter key events on quick task input to pass through
  // Check if this is the quick task input field
  if (target.classList.contains('quick-task-input') ||
      target.closest('.quick-task-section')) {
    return false // Don't block - allow @keydown.enter to work
  }

  // Check if target is an input, textarea, or contenteditable
  if (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable) {
    return true
  }

  // Check if target is within a modal
  const closestModal = target.closest('[role="dialog"], .modal, .n-modal')
  if (closestModal) return true

  return false
}

// Keyboard shortcut handlers
const handleKeydown = (event: KeyboardEvent) => {
  // Comprehensive logging for keyboard shortcut debugging
  console.log('🎹 [APP.VUE] handleKeydown called:', {
    key: event.key,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    target: event.target,
    targetTagName: (event.target as HTMLElement)?.tagName,
    timestamp: new Date().toISOString()
  })

  // Check if we should ignore keyboard shortcuts
  const target = event.target as HTMLElement
  const shouldIgnore = shouldIgnoreElement(target)
  console.log('🚫 [APP.VUE] shouldIgnoreElement result:', shouldIgnore, {
    targetElement: target,
    isInput: target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.contentEditable === 'true',
    isInModal: !!target?.closest('[role="dialog"], .modal, .n-modal')
  })

  if (shouldIgnore) {
    console.log('❌ [APP.VUE] Keyboard shortcut blocked by shouldIgnoreElement')
    return
  }

  // Cmd/Ctrl+K to open Command Palette (Quick Add)
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    modalManager.value?.openCommandPalette()
  }

  // Cmd/Ctrl+P to open search (alternative)
  if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
    event.preventDefault()
    modalManager.value?.openSearch()
  }

  // Shift+Delete to delete selected tasks
  if (event.shiftKey && event.key === 'Delete') {
    event.preventDefault()
    handleDeleteSelectedTasks()
  }

  // Ctrl+Z (or Cmd+Z) to undo
  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    handleUndo()
  }

  // Ctrl+Y (or Cmd+Shift+Z) to redo
  if (((event.ctrlKey || event.metaKey) && event.key === 'y') ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z')) {
    event.preventDefault()
    handleRedo()
  }

  // Ctrl+E (or Cmd+E) to edit selected task
  if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
    event.preventDefault()
    // Open edit modal if exactly one task is selected
    if (taskStore.selectedTaskIds.length === 1) {
      const task = taskStore.tasks.find(t => t.id === taskStore.selectedTaskIds[0])
      if (task) {
        console.log('✏️ [APP.VUE] Ctrl+E: Opening edit modal for task:', task.title)
        openEditTask(task)
      }
    } else if (taskStore.selectedTaskIds.length === 0) {
      console.log('⚠️ [APP.VUE] Ctrl+E: No task selected')
    } else {
      console.log('⚠️ [APP.VUE] Ctrl+E: Multiple tasks selected, cannot edit')
    }
  }

  // Shift+1-5 for view switching
  console.log('🔍 [APP.VUE] Checking Shift+1-5 condition:', {
    isShift: event.shiftKey,
    noCtrl: !event.ctrlKey,
    noMeta: !event.metaKey,
    noAlt: !event.altKey,
    key: event.key,
    conditionMet: event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
  })

  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const key = event.key
    console.log('🔢 [APP.VUE] Shift+number detected, key:', key, 'Checking range 1-5...')

    if (key >= '1' && key <= '5') {
      console.log('✅ [APP.VUE] Key', key, 'is in range 1-5. Looking up route...')
      const route = viewRouteMap[key as keyof typeof viewRouteMap]
      console.log('🗺️ [APP.VUE] Route lookup result:', { key, route, availableRoutes: viewRouteMap })

      if (route) {
        console.log('🚀 [APP.VUE] Route found! Attempting navigation to:', route)
        console.log('📍 [APP.VUE] Current route before navigation:', router.currentRoute.value.path)

        event.preventDefault()

        try {
          router.push(route)
          console.log('✅ [APP.VUE] Navigation command sent successfully to:', route)
        } catch (error) {
          console.error('❌ [APP.VUE] Navigation failed:', error)
        }
      } else {
        console.log('❌ [APP.VUE] No route found for key:', key)
      }
    } else {
      console.log('❌ [APP.VUE] Key', key, 'is not in range 1-5')
    }
  }
}

// Search selects handled in ModalManager

// Error boundary handler
const handleViewError = (error: Error, info: unknown) => {
  console.error('View error caught by boundary:', error, info)
  // Could send to error tracking service here
}


// Listen for context menu requests from Canvas/other views
const handleGlobalTaskContextMenu = (event: CustomEvent) => {
  const { event: mouseEvent, task, instanceId, isCalendarEvent } = event.detail

  // Store calendar-specific data for later use in delete handler
  if (isCalendarEvent && instanceId) {
    modalManager.value?.openTaskContextMenu(mouseEvent, {
      ...task,
      instanceId,
      isCalendarEvent
    } as Task & { instanceId: string; isCalendarEvent: boolean })
  } else {
    modalManager.value?.openTaskContextMenu(mouseEvent, task)
  }
}

// Initialize app (theme already set to dark in index.html)
onMounted(async () => {
  // Load UI state from localStorage
  uiStore.loadState()

  // BUG-025 FIX: Wait for initial sync to complete BEFORE loading data
  // This prevents stale local data from appearing when the app should show synced data
  const syncManager = getGlobalReliableSyncManager()
  const syncCompleted = await syncManager.waitForInitialSync(10000) // 10s timeout

  if (!syncCompleted) {
    console.warn('⚠️ Sync did not complete in time, loading local data')
  }

  // NOW load data (will have fresh synced data if online)
  await taskStore.loadFromDatabase()
  await canvasStore.loadFromDatabase()

  // Wait for database to be fully ready before initializing notifications
  // Database is ready if we can load tasks successfully
  if (taskStore.tasks.length >= 0) {
    try {
      // Initialize notification system for recurring tasks and reminders
      await notificationStore.initializeNotifications()
    } catch (error) {
      console.warn('⚠️ Notification system initialization failed:', error)
    }
  } else {
    console.warn('⚠️ Database not ready, skipping notification initialization')
  }

  // Request notification permission for timer (wrapped in try-catch for user gesture requirement)
  try {
    await timerStore.requestNotificationPermission()
  } catch (error) {
    console.warn('⚠️ Timer notification permission request failed:', error)
  }

  // Safari ITP Protection - Check and warn about potential data deletion
  try {
    itpProtection.initialize()
    if (itpProtection.shouldShowWarning.value) {
      const warningMessage = itpProtection.warningMessage.value
      if (warningMessage) {
        // Log warning to console
        console.warn('🍎 [Safari ITP]', warningMessage)
        // Show toast notification (using console for now - minimal implementation)
        // Future: integrate with notification system for toast display
        itpProtection.markAsWarned()
      }
    }
    // Record this app load as a user interaction (resets the 7-day counter)
    itpProtection.recordInteraction()
  } catch (error) {
    console.warn('⚠️ Safari ITP check failed:', error)
  }

  // Listen for task edit requests
  window.addEventListener('open-task-edit', handleOpenTaskEdit as EventListener)
  window.addEventListener('task-context-menu', handleGlobalTaskContextMenu as EventListener)

  // Listen for global new task request (Ctrl+N)
  window.addEventListener('global-new-task', handleGlobalNewTask)

  // Initialize global keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+N)
  await initGlobalKeyboardShortcuts()

  // Add keyboard shortcut listener for search
  window.addEventListener('keydown', handleKeydown)

  // Auto-open auth modal if not authenticated (after auth state loads)
  // DISABLED: App works perfectly with IndexedDB without requiring authentication
  // Wait for auth to initialize, then check if user is authenticated
  // setTimeout(() => {
  //   if (!authStore.isLoading && !authStore.isAuthenticated && !uiStore.authModalOpen) {
  //     console.log('🔐 [APP.VUE] Auto-opening auth modal - user not authenticated')
  //     uiStore.openAuthModal('login', '/')
  //   }
  // }, 1000) // Wait 1 second for auth to initialize
})

onUnmounted(() => {
  window.removeEventListener('open-task-edit', handleOpenTaskEdit as EventListener)
  window.removeEventListener('task-context-menu', handleGlobalTaskContextMenu as EventListener)
  window.removeEventListener('global-new-task', handleGlobalNewTask)
  window.removeEventListener('keydown', handleKeydown)
  destroyGlobalKeyboardShortcuts()
})
</script>

<style scoped>
/* BOLD MODERN DESIGN - Linear/Notion/ClickUp Quality */
.app {
  /* Dramatic gradient background */
  background: linear-gradient(
    135deg,
    hsl(220, 13%, 9%) 0%,
    hsl(240, 21%, 15%) 25%,
    hsl(250, 24%, 12%) 50%,
    hsl(260, 20%, 14%) 75%,
    hsl(220, 13%, 11%) 100%
  );
  /* CRITICAL FIX: Ensure root container has explicit dimensions */
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  font-family: var(--font-sans);
  color: var(--text-primary);
  /* Use CSS Grid for flexible sidebar layout */
  display: grid;
  grid-template-columns: minmax(240px, 340px) 1fr;
  position: relative;
  overflow-x: hidden; /* Prevent horizontal overflow at root level */
  overflow-y: visible; /* Allow vertical scrolling */
  /* Ensure no borders are applied to the main app container */
  border: none;
  outline: none;
  box-shadow: none;
  /* Smooth transition for grid layout changes */
  transition: grid-template-columns 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* When sidebar is hidden, collapse the first column */
.app.sidebar-hidden {
  grid-template-columns: 0fr 1fr;
}

/* Ensure sidebar and main content stay in correct grid columns */
/* LEFT SIDEBAR - Grid layout handled in .app */
.sidebar {
  grid-column: 1;
}
/* When sidebar is hidden, explicitly collapse sidebar column */
.app.sidebar-hidden .sidebar {
  grid-column: 1 / span 0;
}

/* Floating sidebar toggle (appears when sidebar is hidden) */
.floating-sidebar-toggle {
  position: fixed;
  top: 50%;
  inset-inline-start: 0; /* RTL: left edge in LTR, right edge in RTL */
  transform: translateY(-50%);
  z-index: 1000;
  width: 36px;
  height: 48px;
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  border-inline-start: none; /* RTL: no border at start */
  border-start-end-radius: var(--radius-lg); /* RTL: top-right in LTR, top-left in RTL */
  border-end-end-radius: var(--radius-lg); /* RTL: bottom-right in LTR, bottom-left in RTL */
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.floating-sidebar-toggle:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  transform: translateY(-50%) translateX(2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.floating-sidebar-toggle:active {
  transform: translateY(-50%) scale(0.95);
}

/* Navigation and badge styles moved or obsolete */

/* Project and smart view styles moved to AppSidebar.vue */


/* Sidebar footer removed - Settings moved to header */

/* MAIN CONTENT - Transparent with glass effects */
.main-content {
  /* Grid column automatically takes remaining space */
  background: transparent;
  padding: var(--space-10) var(--space-12) 0; /* RTL: increased padding for less cramped feel, removed bottom padding */
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  /* CRITICAL FIX: Ensure main content has explicit dimensions */
  width: 100%;
  height: 100%;
  min-height: 100vh;
  max-height: 100vh;
  overflow-x: hidden; /* Prevent horizontal overflow from affecting main layout */
  overflow-y: visible; /* Allow vertical scrolling */
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  /* Ensure no borders are accidentally applied */
  border: none;
  outline: none;
  box-shadow: none;
}

/* Main content when sidebar is hidden - reduce left padding to utilize full width */
.main-content.sidebar-hidden {
  padding: var(--space-10) var(--space-6) 0; /* Reduce left padding to utilize full sidebar space */
}


/* View transition animations */

/* View transition animations */
.view-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: visible;
  padding-inline-end: var(--space-2); /* RTL: scrollbar spacing */
  /* CRITICAL FIX: Ensure view wrapper has explicit dimensions for Vue Flow */
  width: 100%;
  height: 100%;
  min-height: 0; /* Critical: allows flex child to shrink */
  /* Ensure the container has non-zero dimensions */
  min-width: 1px;
  min-height: 1px;
}

/* Custom scrollbar styling */
.view-wrapper::-webkit-scrollbar {
  width: 8px;
}

.view-wrapper::-webkit-scrollbar-track {
  background: var(--glass-bg-soft);
  border-radius: var(--radius-full);
}

.view-wrapper::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-full);
  transition: background var(--duration-fast) ease;
}

.view-wrapper::-webkit-scrollbar-thumb:hover {
  background: var(--glass-border-soft);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}


/* KANBAN STYLES */



.kanban-column {
  background: transparent;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding: 0 var(--space-1);
}

.column-title {
  color: var(--text-muted);
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
}

.add-task-btn {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.add-task-btn:hover {
  background: var(--surface-tertiary);
  border-color: var(--border-strong);
  color: var(--text-muted);
}

/* TASK CARDS - ULTRA REFINED */
.task-card {
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: 0.75rem;
  box-shadow: 0 1px 2px 0 var(--surface-hover);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.task-card:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-medium);
}

.task-title {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin: 0 0 var(--space-2) 0;
  line-height: 1.3;
}

.task-description {
  color: var(--text-muted);
  font-size: var(--text-xs);
  margin: 0 0 var(--space-3) 0;
  line-height: 1.4;
}

.task-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.due-date {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.calendar-icon {
  font-size: var(--text-xs);
}

.progress-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.progress-text {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
}

.progress-text.yellow {
  color: var(--color-break);
}

.progress-text.green {
  color: var(--color-work);
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-avatars {
  display: flex;
  gap: 0.25rem;
}

.avatar {
  width: 1.5rem;
  height: 1.5rem;
  background: var(--border-medium);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--text-muted);
  border: 1px solid var(--surface-secondary);
}

.task-stats {
  display: flex;
  gap: 0.5rem;
}

.stat-item {
  color: var(--text-muted);
  font-size: var(--text-xs);
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

/* Theme toggle CSS removed - app now uses dark mode only */

/* Uncategorized Filter Styles */
.smart-view-uncategorized {
  margin-top: var(--space-2);
  border-top: 1px solid var(--glass-bg-heavy);
  padding-top: var(--space-2);
}

.uncategorized-filter {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.uncategorized-filter:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
  border-color: var(--border-medium);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.uncategorized-filter.active {
  background: var(--brand-primary-bg-subtle);
  border-color: var(--brand-primary-border-medium);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
  box-shadow: var(--brand-primary-glow-subtle);
}

.uncategorized-filter .filter-badge {
  margin-left: auto;
  background: var(--glass-bg-heavy);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
  border: 1px solid var(--glass-border);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.uncategorized-filter .filter-badge.badge-active {
  background: var(--brand-primary);
  color: white;
  border-color: var(--brand-primary);
  box-shadow: var(--brand-primary-glow-subtle);
}

/* Quick Sort Button */
.quick-sort-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: linear-gradient(135deg, var(--brand-primary-bg-subtle), var(--brand-primary-bg-medium));
  border: 1px solid var(--brand-primary-border-medium);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--brand-primary-glow-subtle);
}

.quick-sort-button:hover {
  background: linear-gradient(135deg, var(--brand-primary-bg-medium), var(--brand-primary-bg-heavy));
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  transform: translateY(-1px);
  box-shadow: var(--brand-primary-glow-medium);
}

.quick-sort-button:active {
  transform: translateY(0);
  box-shadow: var(--brand-primary-glow-subtle);
}

/* Removed - using BaseButton now */
</style>

<!-- GLOBAL DARK MODE STYLES -->
<style>
:root {
  --transition-duration: 0.3s;
  --transition-easing: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Smooth transitions for theme switching */
* {
  transition: background-color var(--transition-duration) var(--transition-easing),
              color var(--transition-duration) var(--transition-easing),
              border-color var(--transition-duration) var(--transition-easing);
}

/* DARK THEME OVERRIDES */
.dark-theme .app {
  background: var(--surface-primary);
  color: var(--text-primary);
}

.dark-theme .sidebar {
  background: var(--surface-secondary);
  border-right: 1px solid var(--border-subtle);
}

.dark-theme .content-header {
  /* Ensure border color matches sidebar border in dark theme */
  border-bottom-color: var(--border-subtle);
}

.dark-theme .brand-text {
  color: var(--text-primary);
}

.dark-theme .create-project-btn {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
  color: var(--text-secondary);
}

.dark-theme .create-project-btn:hover {
  background: var(--surface-elevated);
  border-color: var(--text-subtle);
}

.dark-theme .nav-item {
  color: var(--text-muted);
}

.dark-theme .nav-item:hover {
  background: var(--surface-tertiary);
  color: var(--text-secondary);
}

.dark-theme .notification-badge {
  background: var(--color-danger);
}

.dark-theme .section-title {
  color: var(--text-subtle);
}

.dark-theme .project-parent {
  color: var(--text-secondary);
}

.dark-theme .project-child {
  color: var(--text-muted);
}

.dark-theme .project-child:hover {
  color: var(--text-secondary);
}

.dark-theme .project-child.active {
  color: var(--text-primary);
}

.dark-theme .create-issue-btn {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
  color: var(--text-muted);
}

.dark-theme .create-issue-btn:hover {
  background: var(--surface-elevated);
  border-color: var(--text-subtle);
}

.dark-theme .settings-btn {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
  color: var(--text-muted);
}

.dark-theme .settings-btn:hover {
  background: var(--surface-elevated);
  border-color: var(--text-subtle);
}

.dark-theme .main-content {
  background: var(--surface-primary);
}

.dark-theme .breadcrumb-item {
  color: var(--text-muted);
}

.dark-theme .breadcrumb-item:hover {
  color: var(--text-secondary);
}

.dark-theme .breadcrumb-item.current {
  color: var(--text-primary);
}

.dark-theme .breadcrumb-separator {
  color: var(--text-subtle);
}

.dark-theme .title-main {
  color: var(--text-primary);
}

.dark-theme .title-filter {
  color: var(--text-secondary);
}

.dark-theme .project-title {
  color: var(--text-primary);
}

/* Dark theme timer styles */
.dark-theme .timer-display {
  background: var(--surface-secondary);
  border-color: var(--border-subtle);
}

.dark-theme .timer-display.timer-active {
  background: var(--orange-bg-subtle);
  border-color: var(--color-break);
  box-shadow: var(--orange-glow-subtle);
}

.dark-theme .timer-display.timer-break {
  background: var(--success-bg-start);
  border-color: var(--color-work);
  box-shadow: var(--blue-glow-subtle);
}

.dark-theme .timer-time {
  color: var(--text-primary);
}

.dark-theme .timer-task {
  color: var(--text-muted);
}

.dark-theme .timer-btn {
  color: var(--text-muted);
}

.dark-theme .timer-btn:hover {
  background: var(--glass-border);
  color: var(--text-secondary);
}

/* Dark theme for task management sidebar - REBUILT */
.dark-theme .quick-task-section {
  background: var(--glass-bg-soft);
}

.dark-theme .quick-task-input {
  background: var(--glass-bg-tint);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

.dark-theme .quick-task-input:focus {
  border-color: var(--brand-primary);
  background: var(--glass-bg-light);
}

.dark-theme .task-management-section {
  border-bottom-color: var(--border-subtle);
}

.dark-theme .section-title {
  color: var(--text-subtle);
}

.dark-theme .section-icon {
  color: var(--text-muted);
}

.dark-theme .add-project-btn {
  border-color: var(--border-medium);
  color: var(--text-muted);
}

.dark-theme .add-project-btn:hover {
  background: var(--surface-tertiary);
  border-color: var(--text-subtle);
  color: var(--text-secondary);
}

.dark-theme .project-header {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
}

.dark-theme .project-header:hover {
  background: var(--surface-elevated);
  border-color: var(--text-subtle);
}

.dark-theme .expand-icon {
  color: var(--text-muted);
}

.dark-theme .project-name {
  color: var(--text-primary);
}

.dark-theme .task-count {
  color: var(--text-muted);
  background: var(--surface-elevated);
}

.dark-theme .project-tasks {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
}

.dark-theme .sidebar-task {
  background: transparent;
  box-shadow: inset 2px 0 0 transparent;
}

.dark-theme .sidebar-task:hover {
  background: var(--glass-bg-medium);
}

.dark-theme .sidebar-task.scheduled {
  box-shadow: inset 2px 0 0 var(--color-work);
  /* Inherit dark background from component */
}

.dark-theme .task-title {
  color: var(--text-primary);
}

.dark-theme .pomodoro-count {
  color: var(--text-muted);
}

.dark-theme .subtask-count {
  color: var(--text-secondary);
  background: var(--blue-bg-medium);
}

.dark-theme .scheduled-info {
  color: var(--color-work);
}

.dark-theme .action-btn {
  background: var(--overlay-dark);
  border-color: var(--border-subtle);
  color: var(--text-muted);
}

.dark-theme .action-btn:hover {
  background: var(--surface-secondary);
  border-color: var(--border-medium);
  color: var(--text-secondary);
}

.dark-theme .add-task-to-project {
  border-color: var(--border-medium);
  color: var(--text-muted);
}

.dark-theme .add-task-to-project:hover {
  background: var(--surface-tertiary);
  border-color: var(--text-subtle);
  color: var(--text-secondary);
}

/* Sidebar footer removed - Settings moved to header */

.dark-theme .view-tab {
  color: var(--text-muted);
}

.dark-theme .view-tab:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-secondary);
}

.dark-theme .view-tab.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--state-active-text);
}



/* Dark theme toggle CSS removed - app now uses dark mode only */

.dark-theme .column-title {
  color: var(--text-muted);
}

.dark-theme .add-task-btn {
  background: var(--surface-secondary);
  border-color: var(--border-subtle);
  color: var(--text-subtle);
}

.dark-theme .add-task-btn:hover {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
  color: var(--text-muted);
}

.dark-theme .task-card {
  background: var(--surface-secondary);
  border-color: var(--border-subtle);
  box-shadow: var(--shadow-subtle);
}

.dark-theme .task-card:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-strong);
}

.dark-theme .task-title {
  color: var(--text-primary);
}

.dark-theme .task-description {
  color: var(--text-muted);
}

.dark-theme .due-date {
  color: var(--text-muted);
}

.dark-theme .progress-text {
  color: var(--text-muted);
}

.dark-theme .progress-text.yellow {
  color: var(--color-break);
}

.dark-theme .progress-text.green {
  color: var(--color-work);
}

.dark-theme .avatar {
  background: var(--surface-tertiary);
  border-color: var(--surface-secondary);
  color: var(--text-subtle);
}

.dark-theme .stat-item {
  color: var(--text-subtle);
}

/* Dark mode progress circle adjustments */
.dark-theme .progress-circle circle:first-child {
  stroke: var(--border-subtle);
}
</style>