<template>
  <n-config-provider :theme="darkTheme">
    <n-global-style />
    <n-message-provider>
  <!-- PROFESSIONAL PROJECT MANAGEMENT SYSTEM - CODOMO STYLE -->
  <div class="app" :dir="direction">
    <!-- LEFT SIDEBAR NAVIGATION -->
    <Transition name="sidebar-slide">
      <aside v-show="uiStore.mainSidebarVisible" class="sidebar" aria-label="Main navigation" :aria-hidden="!uiStore.mainSidebarVisible">
      <!-- App Header -->
      <div class="sidebar-header">
        <div class="app-brand">
          <span class="brand-icon">🍅</span>
          <span class="brand-text">Pomo-Flow</span>
        </div>
        <BaseButton variant="secondary" size="md" @click="openCreateProject">
          <Plus :size="14" />
          Create project
        </BaseButton>

        <div class="icon-button-group">
          <button
            class="icon-btn"
            @click="uiStore.toggleMainSidebar"
            :title="'Hide Sidebar'"
            aria-label="Hide sidebar"
          >
            <PanelLeftClose :size="18" />
          </button>

          <button
            class="icon-btn"
            @click="uiStore.openSettingsModal()"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings :size="18" />
          </button>
        </div>
      </div>

      <!-- Quick Task Creation -->
      <div class="quick-add-section">
        <div class="quick-add-input">
          <Plus :size="16" class="add-icon" />
          <input
            v-model="newTaskTitle"
            type="text"
            placeholder="Add a task..."
            class="task-input"
            @keyup.enter="createQuickTask"
          />
        </div>
      </div>

      <!-- Project & Task Management -->
      <div class="task-management-section">
        <div class="section-header">
          <h3 class="section-title">
            <FolderOpen :size="16" class="section-icon" />
            Projects
          </h3>
          <button class="add-project-btn" @click="openCreateProject" title="Add Project">
            <Plus :size="14" />
          </button>
        </div>

        <!-- Smart Views - Using DateDropZone for drag and drop functionality -->
        <div class="smart-views">
          <!-- Today -->
          <DateDropZone
            :active="taskStore.activeSmartView === 'today'"
            :count="todayTaskCount"
            target-type="today"
            @click="selectSmartView('today')"
          >
            <template #icon>
              <Calendar :size="16" />
            </template>
            Today
          </DateDropZone>

          <!-- This Week -->
          <DateDropZone
            :active="taskStore.activeSmartView === 'week'"
            :count="weekTaskCount"
            target-type="week"
            @click="selectSmartView('week')"
          >
            <template #icon>
              <Calendar :size="16" />
            </template>
            This Week
          </DateDropZone>

          <!-- Uncategorized Tasks (My Tasks) -->
          <div class="smart-view-uncategorized">
            <!-- All Tasks -->
            <DateDropZone
              :active="taskStore.activeSmartView === 'above_my_tasks'"
              :count="aboveMyTasksCount"
              target-type="above_my_tasks"
              @click="selectSmartView('above_my_tasks')"
            >
              <template #icon>
                <List :size="16" />
              </template>
              All Tasks
            </DateDropZone>

            <button
              class="uncategorized-filter"
              :class="{ active: taskStore.activeSmartView === 'uncategorized' }"
              @click="selectSmartView('uncategorized')"
              title="Show Uncategorized Tasks"
            >
              <Inbox :size="16" />
              <span>My Tasks</span>
              <span
                v-if="uncategorizedCount > 0"
                class="filter-badge"
                :class="{ 'badge-active': taskStore.activeSmartView === 'uncategorized' }"
              >
                {{ uncategorizedCount }}
              </span>
            </button>

            <!-- Quick Sort Button (shows when uncategorized filter is active) -->
            <button
              v-if="taskStore.activeSmartView === 'uncategorized' && uncategorizedCount > 0"
              class="quick-sort-button"
              @click="handleStartQuickSort"
              title="Start Quick Sort to categorize these tasks"
            >
              <Zap :size="16" />
              <span>Quick Sort</span>
            </button>
          </div>
        </div>

        <!-- Projects Section Header -->
        <div class="projects-divider"></div>

        <!-- Project List - Recursive tree rendering with accessibility -->
        <nav
          class="projects-list"
          role="tree"
          aria-label="Projects"
          :aria-activedescendant="activeProjectId ? `project-${activeProjectId}` : undefined"
          @keydown="handleProjectTreeKeydown"
        >
          <ProjectTreeItem
            v-for="project in rootProjects"
            :key="project.id"
            :project="project"
            :expanded-projects="expandedProjects"
            :level="1"
            @click="selectProject"
            @toggle-expand="toggleProjectExpansion"
            @contextmenu="handleProjectContextMenu"
            @project-drop="() => {}"
          />
        </nav>
      </div>
      </aside>
    </Transition>

    <!-- FLOATING SIDEBAR TOGGLE (visible when sidebar is hidden) -->
    <button
      v-if="!uiStore.mainSidebarVisible"
      class="floating-sidebar-toggle"
      @click="uiStore.toggleMainSidebar"
      :title="`Show Sidebar (${isMac ? 'Cmd' : 'Ctrl'}+B)`"
      aria-label="Show sidebar"
    >
      <PanelLeft :size="20" />
    </button>

    <!-- MAIN CONTENT AREA -->
    <main class="main-content" :class="{ 'sidebar-hidden': !uiStore.mainSidebarVisible }">

      <!-- PROJECT TITLE AND TIMER -->
      <div class="header-section">
        <!-- USER PROFILE (Left side) -->
        <div class="user-profile-container">
          <UserProfile v-if="authStore.isAuthenticated" />
        </div>

        <h1 class="project-title">{{ pageTitle }}</h1>

        <!-- INTEGRATED CONTROL PANEL: Clock + Timer -->
        <div class="control-panel">
          <!-- TIME DISPLAY - ADHD Feature #4 -->
          <div class="time-display-container">
            <TimeDisplay />
          </div>

          <!-- POMODORO TIMER DISPLAY -->
          <div class="timer-container">
          <div class="timer-display" :class="{ 'timer-active': timerStore.isTimerActive, 'timer-break': timerStore.currentSession?.isBreak }">
            <div class="timer-icon">
              <!-- Animated emoticons when timer is active -->
              <span v-if="timerStore.isTimerActive && !timerStore.currentSession?.isBreak" class="timer-emoticon active">🍅</span>
              <span v-else-if="timerStore.isTimerActive && timerStore.currentSession?.isBreak" class="timer-emoticon active">🧎</span>
              <!-- Static icons when timer is inactive -->
              <Timer v-else :size="20" :stroke-width="1.5" class="timer-stroke" />
            </div>
            <div class="timer-info">
              <div class="timer-time">{{ timerStore.displayTime }}</div>
              <!-- Always render task name div to prevent layout shift -->
              <div class="timer-task">{{ timerStore.currentTaskName || '&nbsp;' }}</div>
            </div>
            <div class="timer-controls">
              <div v-if="!timerStore.currentSession" class="timer-start-options">
                <button
                  class="timer-btn timer-start"
                  @click="startQuickTimer"
                  title="Start 25-min work timer"
                >
                  <Play :size="16" />
                </button>
                <button
                  class="timer-btn timer-break"
                  @click="startShortBreak"
                  title="Start 5-min break"
                >
                  <Coffee :size="16" :stroke-width="1.5" class="coffee-stroke" />
                </button>
                <button
                  class="timer-btn timer-break"
                  @click="startLongBreak"
                  title="Start 15-min long break"
                >
                  <User :size="16" :stroke-width="1.5" class="meditation-stroke" />
                </button>
              </div>

              <button
                v-else-if="timerStore.isPaused"
                class="timer-btn timer-resume"
                @click="timerStore.resumeTimer"
                title="Resume timer"
              >
                <Play :size="16" />
              </button>

              <button
                v-else-if="timerStore.isTimerActive"
                class="timer-btn timer-pause"
                @click="timerStore.pauseTimer"
                title="Pause timer"
              >
                <Pause :size="16" />
              </button>

              <button
                v-if="timerStore.currentSession"
                class="timer-btn timer-stop"
                @click="timerStore.stopTimer"
                title="Stop timer"
              >
                <Square :size="16" />
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      <!-- VIEW TABS AND CONTROLS -->
      <div class="content-header">
        <div class="view-tabs">
          <router-link to="/" class="view-tab" active-class="active">Board</router-link>
          <router-link to="/calendar" class="view-tab" active-class="active">Calendar</router-link>
          <router-link to="/canvas" class="view-tab" active-class="active">Canvas</router-link>
          <router-link to="/catalog" class="view-tab" active-class="active">Catalog</router-link>
          <router-link to="/quick-sort" class="view-tab" active-class="active">
            Quick Sort
            <span v-if="uncategorizedCount > 0" class="tab-badge">{{ uncategorizedCount }}</span>
          </router-link>
        </div>

      </div>

      <!-- ROUTER VIEW FOR DIFFERENT VIEWS -->
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <div class="view-wrapper">
            <ErrorBoundary
              :fallback-message="`The ${$route.name} view encountered an error. You can try reloading or switch to another view.`"
              @error="handleViewError"
            >
              <component :is="Component" />
            </ErrorBoundary>
          </div>
        </transition>
      </router-view>
    </main>

    <!-- SETTINGS MODAL -->
    <SettingsModal
      :isOpen="uiStore.settingsModalOpen"
      @close="uiStore.closeSettingsModal()"
    />

    <!-- PROJECT MODAL -->
    <ProjectModal
      :isOpen="showProjectModal"
      :project="editingProject"
      @close="showProjectModal = false"
    />

    <!-- TASK EDIT MODAL -->
    <TaskEditModal
      :isOpen="showTaskEditModal"
      :task="editingTask"
      @close="showTaskEditModal = false"
    />

    <!-- TASK CONTEXT MENU -->
    <TaskContextMenu
      :isVisible="showTaskContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="contextMenuTask"
      :compactMode="uiStore.boardDensity === 'ultrathin'"
      @close="closeTaskContextMenu"
      @edit="openEditTask"
      @confirmDelete="(taskId, instanceId, isCalendarEvent) => handleContextMenuDelete(taskId, instanceId, isCalendarEvent)"
    />

    <!-- PROJECT CONTEXT MENU -->
    <ContextMenu
      :isVisible="showProjectContextMenu"
      :x="projectContextMenuX"
      :y="projectContextMenuY"
      :items="projectContextMenuItems"
      @close="showProjectContextMenu = false"
    />

    <!-- CONFIRMATION MODAL -->
    <ConfirmationModal
      :isOpen="showConfirmModal"
      :title="'Confirm Action'"
      :message="confirmMessage"
      :details="confirmDetails"
      :confirmText="'Delete'"
      @confirm="executeConfirmAction"
      @cancel="cancelConfirmAction"
    />

    <!-- SEARCH MODAL -->
    <SearchModal
      :isOpen="showSearchModal"
      @close="showSearchModal = false"
      @selectTask="handleSearchSelectTask"
      @selectProject="handleSearchSelectProject"
    />

    <!-- QUICK TASK CREATE MODAL -->
    <QuickTaskCreateModal
      :isOpen="showQuickTaskCreate"
      :loading="false"
      @cancel="closeQuickTaskCreate"
      @create="handleQuickTaskCreate"
    />

    <!-- COMMAND PALETTE - ADHD Feature #1 (Cmd+K) -->
    <CommandPalette ref="commandPaletteRef" />

    <!-- FAVICON MANAGER - Dynamic favicon with timer progress -->
    <FaviconManager />

    <!-- DEV LOG CONTROLLER - Interactive log filter (DEV only) -->
    <DevLogController v-if="isDev" />

    <!-- AUTHENTICATION MODAL -->
    <AuthModal />

    </div>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
// Import design tokens first for better HMR support
import '@/assets/design-tokens.css'

import { NConfigProvider, NMessageProvider, NGlobalStyle, darkTheme } from 'naive-ui'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore, getTaskInstances } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import { useDirection } from '@/i18n/useDirection'
import { useRouter } from 'vue-router'
// 🚨 FORCE CACHE BREAKER - UNDO SINGLETON V3 - 2025-10-22T22:58:00Z
import { getUndoSystem } from '@/composables/undoSingleton'
import { provideProgressiveDisclosure } from '@/composables/useProgressiveDisclosure'
import { provideFocusMode } from '@/composables/useFocusMode'
import { useSidebarToggle } from '@/composables/useSidebarToggle'
import { useFavicon } from '@/composables/useFavicon'
import { useBrowserTab } from '@/composables/useBrowserTab'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseNavItem from '@/components/base/BaseNavItem.vue'
import DateDropZone from '@/components/DateDropZone.vue'
import ProjectTreeItem from '@/components/ProjectTreeItem.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import TimeDisplay from '@/components/TimeDisplay.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import FaviconManager from '@/components/FaviconManager.vue'
import DevLogController from '@/components/DevLogController.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import ProjectModal from '@/components/ProjectModal.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import TaskContextMenu from '@/components/TaskContextMenu.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ContextMenu.vue'
import SearchModal from '@/components/SearchModal.vue'
import QuickTaskCreateModal from '@/components/QuickTaskCreateModal.vue'
import AuthModal from '@/components/auth/AuthModal.vue'
import UserProfile from '@/components/auth/UserProfile.vue'
import type { Task, Project } from '@/stores/tasks'
import {
  Play, Pause, Square, Plus, Settings,
  Inbox, Bell, FileText, Archive,
  Coffee, User, Timer, FolderOpen, ChevronDown,
  Clock, Flag, Calendar, Edit, Trash2, Copy, Palette,
  PanelLeft, PanelLeftClose, Zap, List
} from 'lucide-vue-next'

// Stores
const timerStore = useTimerStore()
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const uiStore = useUIStore()
const authStore = useAuthStore()
const router = useRouter()

// RTL/LTR direction support
const { direction, isRTL } = useDirection()

// Development mode check for dev tools
const isDev = import.meta.env.DEV

// Unified Undo/Redo system - use shared singleton instance
const undoHistory = getUndoSystem()



// Theme management - using new cohesive design system
const { isDarkMode, toggleTheme, initializeTheme } = useTheme()

// Progressive Disclosure - ADHD Feature #2 (disabled by default)
// Focus Mode - ADHD Feature Phase 2
provideFocusMode()
provideProgressiveDisclosure()

// Sidebar Toggle - ADHD Feature #5 (reduce visual noise)
useSidebarToggle()

// Favicon management - dynamic based on timer state
useFavicon()

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

// Task management state
const newTaskTitle = ref('')
const showCreateProject = ref(false)
const expandedProjects = ref<string[]>([]) // For nested project expand/collapse

// Project management state
const showProjectModal = ref(false)
const editingProject = ref<Project | null>(null)

// Task editing state
const showTaskEditModal = ref(false)
const editingTask = ref<Task | null>(null)

// Context menu state
const showTaskContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)

// Project context menu state
const showProjectContextMenu = ref(false)
const projectContextMenuX = ref(0)
const projectContextMenuY = ref(0)
const contextMenuProject = ref<Project | null>(null)

// Confirmation modal state
const showConfirmModal = ref(false)
const confirmAction = ref<() => void | Promise<void>>(() => {})
const confirmMessage = ref('')
const confirmDetails = ref<string[]>([])

// Search modal state
const showSearchModal = ref(false)

// Quick Task Create Modal state
const showQuickTaskCreate = ref(false)

// Command Palette ref
const commandPaletteRef = ref<{ open: () => void; close: () => void } | null>(null)


// Platform detection
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

// Note: Removed project filtering functions - projects now always visible regardless of task count
// Smart filters only affect main board content, not sidebar project visibility

// Helper function to filter out synthetic My Tasks project
const filterOutSyntheticMyTasks = (project: any) => {
  // Exclude synthetic My Tasks project with multiple criteria for robustness
  return project.id !== '1' &&
         project.name !== 'My Tasks' &&
         !(project.color === '#3b82f6' && project.colorType === 'hex' && project.viewType === 'status')
}

// Computed Properties for Project Hierarchy
// Show all root projects regardless of task count (but exclude the synthetic My Tasks project)
const rootProjects = computed(() => {
  return taskStore.projects
    .filter(p => !p.parentId) // Only root projects
    .filter(filterOutSyntheticMyTasks) // Exclude synthetic My Tasks project
    // Note: No longer filtering by active tasks - show all projects
})

const getChildren = (parentId: string) => {
  return taskStore.projects
    .filter(p => p.parentId === parentId)
    .filter(filterOutSyntheticMyTasks) // Exclude synthetic My Tasks project
    // Note: No longer filtering by active tasks - show all child projects
}

const hasChildren = (projectId: string) => {
  return taskStore.projects
    .filter(p => p.parentId === projectId)
    .filter(filterOutSyntheticMyTasks) // Exclude synthetic My Tasks project
    .length > 0 // Check if there are any child projects
}

// Smart View Counts
const todayTaskCount = computed(() => {
  const todayStr = new Date().toISOString().split('T')[0]
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return taskStore.tasks.filter(task => {
    // Exclude done tasks from today count - CRITICAL FIX
    if (task.status === 'done') {
      return false
    }

    // Check instances first (new format) - tasks scheduled for today
    const instances = getTaskInstances(task)
    if (instances.length > 0) {
      if (instances.some(inst => inst.scheduledDate === todayStr)) {
        return true
      }
    }

    // Fallback to legacy scheduledDate - tasks scheduled for today
    if (task.scheduledDate === todayStr) {
      return true
    }

    // Tasks created today
    const taskCreatedDate = new Date(task.createdAt)
    taskCreatedDate.setHours(0, 0, 0, 0)
    if (taskCreatedDate.getTime() === today.getTime()) {
      return true
    }

    // Tasks due today
    if (task.dueDate === todayStr) {
      return true
    }

    // Tasks currently in progress
    if (task.status === 'in_progress') {
      return true
    }

    return false
  }).length
})

const weekTaskCount = computed(() => {
  // Calculate tasks for the next 7 days using same logic as store
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  return taskStore.tasks.filter(task => {
    // Exclude done tasks from week count - CRITICAL FIX (matches today filter)
    if (task.status === 'done') {
      return false
    }

    // Check instances first (new format)
    const instances = getTaskInstances(task)
    if (instances.length > 0) {
      return instances.some(inst => inst.scheduledDate >= todayStr && inst.scheduledDate < weekEndStr)
    }
    // Fallback to legacy scheduledDate
    if (!task.scheduledDate) return false
    return task.scheduledDate >= todayStr && task.scheduledDate < weekEndStr
  }).length
})

// Above My Tasks task count - counts all non-done tasks
const aboveMyTasksCount = computed(() => {
  return taskStore.tasks.filter(task => {
    // Count all tasks that are not marked as done
    // This matches the "above_my_tasks" smart view logic
    return task.status !== 'done'
  }).length
})


// Uncategorized task count for Quick Sort badge
const uncategorizedCount = computed(() => {
  // Use the exact same logic as the store's uncategorized filter for consistency
  const filteredTasks = taskStore.tasks.filter(task => {
    // Apply same filtering logic as uncategorized smart view in taskStore.filteredTasks
    // Check isUncategorized flag first
    if (task.isUncategorized === true) {
      return true
    }

    // Backward compatibility: also treat tasks without proper project assignment as uncategorized
    if (!task.projectId || task.projectId === '' || task.projectId === null || task.projectId === '1') {
      return true
    }

    return false
  })

  // Apply the same hideDoneTasks logic as the task store
  const finalCount = taskStore.hideDoneTasks
    ? filteredTasks.filter(task => task.status !== 'done').length
    : filteredTasks.length

  return finalCount
})

// Dynamic page title
const pageTitle = computed(() => {
  if (taskStore.activeSmartView === 'today') return 'Today'
  if (taskStore.activeSmartView === 'week') return 'This Week'

  if (taskStore.activeProjectId) {
    const project = taskStore.projects.find(p => p.id === taskStore.activeProjectId)
    return project ? project.name : 'My Tasks'
  }

  return 'Board'
})

// Theme toggle - using new cohesive design system
const toggleDarkMode = () => {
  toggleTheme()
}

// Timer methods
const startQuickTimer = () => {
  console.log('🍅 DEBUG: startQuickTimer called - starting general timer')
  // Start a general 25-minute timer (no specific task)
  timerStore.startTimer('general')
}

const startShortBreak = () => {
  console.log('🍅 DEBUG: startShortBreak called - starting short break timer')
  // Start a 5-minute break timer
  timerStore.startTimer('short-break', timerStore.settings.shortBreakDuration, true)
}

const startLongBreak = () => {
  console.log('🍅 DEBUG: startLongBreak called - starting long break timer')
  // Start a 15-minute long break timer
  timerStore.startTimer('long-break', timerStore.settings.longBreakDuration, true)
}

// Task management methods
const createQuickTask = async () => {
  if (newTaskTitle.value.trim()) {
    // Use the unified undo system
    const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
    const undoRedoActions = useUnifiedUndoRedo()
    undoRedoActions.createTaskWithUndo({
      title: newTaskTitle.value.trim(),
      description: '',
      status: 'planned',
      projectId: '1' // Default project
    })
    newTaskTitle.value = ''
  }
}

// Quick Task Create Modal handlers
const closeQuickTaskCreate = () => {
  showQuickTaskCreate.value = false
}

const handleQuickTaskCreate = async (title: string, description: string) => {
  console.log('🎯 Creating quick task with title:', title)

  // Use the unified undo system
  // Create new task with user-provided title using undo/redo system
  const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
  const undoRedoActions = useUnifiedUndoRedo()
  undoRedoActions.createTaskWithUndo({
    title: title,
    description: description,
    status: 'planned',
    projectId: '1' // Default project
  })

  // Close the quick create modal
  closeQuickTaskCreate()

  if (newTask) {
    console.log('✅ Successfully created quick task:', newTask.title)
  } else {
    console.error('❌ Failed to create new quick task')
  }
}

// Project Navigation Methods
const toggleProjectExpansion = (projectId: string) => {
  const index = expandedProjects.value.indexOf(projectId)
  if (index > -1) {
    expandedProjects.value.splice(index, 1)
  } else {
    expandedProjects.value.push(projectId)
  }
}

const selectProject = (project: Project) => {
  taskStore.setActiveProject(project.id)
  taskStore.setSmartView(null)
}

// Keyboard navigation for project tree
const handleProjectTreeKeydown = (event: KeyboardEvent) => {
  const { key } = event

  switch (key) {
    case 'ArrowDown':
      event.preventDefault()
      navigateToNextProject()
      break
    case 'ArrowUp':
      event.preventDefault()
      navigateToPreviousProject()
      break
    case 'ArrowRight':
      event.preventDefault()
      expandCurrentProject()
      break
    case 'ArrowLeft':
      event.preventDefault()
      collapseCurrentProjectOrNavigateToParent()
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      activateCurrentProject()
      break
    case 'Home':
      event.preventDefault()
      navigateToFirstProject()
      break
    case 'End':
      event.preventDefault()
      navigateToLastProject()
      break
  }
}

// Navigation helpers
const navigateToNextProject = () => {
  const currentProjectId = taskStore.activeProjectId
  const allProjects = getFlattenedProjectList()
  const currentIndex = allProjects.findIndex(p => p.id === currentProjectId)

  if (currentIndex < allProjects.length - 1) {
    taskStore.setActiveProject(allProjects[currentIndex + 1].id)
  }
}

const navigateToPreviousProject = () => {
  const currentProjectId = taskStore.activeProjectId
  const allProjects = getFlattenedProjectList()
  const currentIndex = allProjects.findIndex(p => p.id === currentProjectId)

  if (currentIndex > 0) {
    taskStore.setActiveProject(allProjects[currentIndex - 1].id)
  }
}

const expandCurrentProject = () => {
  const currentProjectId = taskStore.activeProjectId
  if (currentProjectId && hasProjectChildren(currentProjectId)) {
    if (!expandedProjects.value.includes(currentProjectId)) {
      expandedProjects.value.push(currentProjectId)
    }
  }
}

const collapseCurrentProjectOrNavigateToParent = () => {
  const currentProjectId = taskStore.activeProjectId
  if (!currentProjectId) return

  // If project has children and is expanded, collapse it
  if (hasProjectChildren(currentProjectId) && expandedProjects.value.includes(currentProjectId)) {
    const index = expandedProjects.value.indexOf(currentProjectId)
    expandedProjects.value.splice(index, 1)
  } else {
    // Otherwise, navigate to parent if exists
    const project = taskStore.getProjectById(currentProjectId)
    if (project?.parentId) {
      taskStore.setActiveProject(project.parentId)
    }
  }
}

const activateCurrentProject = () => {
  const currentProjectId = taskStore.activeProjectId
  if (currentProjectId) {
    const project = taskStore.getProjectById(currentProjectId)
    if (project) {
      selectProject(project)
    }
  }
}

const navigateToFirstProject = () => {
  const allProjects = getFlattenedProjectList()
  if (allProjects.length > 0) {
    taskStore.setActiveProject(allProjects[0].id)
  }
}

const navigateToLastProject = () => {
  const allProjects = getFlattenedProjectList()
  if (allProjects.length > 0) {
    taskStore.setActiveProject(allProjects[allProjects.length - 1].id)
  }
}

// Helper functions for navigation
const getFlattenedProjectList = () => {
  const flatten = (projects: Project[], level = 1): Project[] => {
    const result: Project[] = []

    for (const project of projects) {
      if (!project.parentId) { // Only include root projects initially
        result.push(project)

        if (expandedProjects.value.includes(project.id)) {
          const children = taskStore.projects.filter(p => p.parentId === project.id)
          result.push(...flatten(children, level + 1))
        }
      }
    }

    return result
  }

  return flatten(taskStore.projects)
}

const hasProjectChildren = (projectId: string) => {
  return taskStore.projects.some(p => p.parentId === projectId)
}


const selectSmartView = (view: 'today' | 'week' | 'uncategorized' | 'above_my_tasks') => {
  taskStore.setSmartView(view)
}

// Start Quick Sort from uncategorized view
const handleStartQuickSort = () => {
  console.log('🔧 App: Starting Quick Sort from uncategorized view')
  router.push({ name: 'quick-sort' })
}

const getProjectTaskCount = (projectId: string) => {
  // Include tasks from child projects recursively
  const countTasksRecursive = (pid: string): number => {
    const directTasks = taskStore.tasks.filter(task => task.projectId === pid).length
    const children = getChildren(pid)
    const childTasks = children.reduce((sum, child) => sum + countTasksRecursive(child.id), 0)
    return directTasks + childTasks
  }

  return countTasksRecursive(projectId)
}

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


const startTaskTimer = (taskId: string) => {
  timerStore.startTimer(taskId, timerStore.settings.workDuration, false)
}


const addTaskToProject = (projectId: string) => {
  // Open quick task create modal instead of creating task directly
  showQuickTaskCreate.value = true
  console.log('Opening task creation modal for project:', projectId)
}

// Project management methods
const openCreateProject = () => {
  editingProject.value = null
  showProjectModal.value = true
}

const openEditProject = (project: Project) => {
  editingProject.value = project
  showProjectModal.value = true
}

const handleProjectContextMenu = (event: MouseEvent, project: Project) => {
  event.preventDefault()
  event.stopPropagation()

  projectContextMenuX.value = event.clientX
  projectContextMenuY.value = event.clientY
  contextMenuProject.value = project
  showProjectContextMenu.value = true
}

const projectContextMenuItems = computed<ContextMenuItem[]>(() => {
  if (!contextMenuProject.value) return []

  const project = contextMenuProject.value
  const isDefaultProject = project.id === '1'

  return [
    {
      id: 'edit',
      label: 'Edit Project',
      icon: Edit,
      action: () => openEditProject(project)
    },
    {
      id: 'change-icon',
      label: 'Change Icon',
      icon: Palette,
      action: () => openEditProject(project)
    },
    {
      id: 'duplicate',
      label: 'Duplicate Project',
      icon: Copy,
      action: () => duplicateProject(project)
    },
    {
      id: 'delete',
      label: 'Delete Project',
      icon: Trash2,
      action: () => confirmDeleteProject(project),
      danger: true,
      disabled: isDefaultProject
    }
  ]
})

const duplicateProject = async (project: Project) => {
  // Use the task store directly for projects (not part of undo system)
  taskStore.createProject({
    name: `${project.name} (Copy)`,
    color: project.color,
    colorType: project.colorType,
    emoji: project.emoji,
    viewType: project.viewType,
    parentId: project.parentId
  })
  showProjectContextMenu.value = false
}

const confirmDeleteProject = (project: Project) => {
  const taskCount = taskStore.tasks.filter(t => t.projectId === project.id).length
  const childCount = taskStore.projects.filter(p => p.parentId === project.id).length

  const details: string[] = []
  if (taskCount > 0) {
    details.push(`${taskCount} task${taskCount > 1 ? 's' : ''} will move to "My Tasks"`)
  }
  if (childCount > 0) {
    details.push(`${childCount} child project${childCount > 1 ? 's' : ''} will be un-nested`)
  }

  confirmMessage.value = `Delete project "${project.name}"?`
  confirmAction.value = () => {
    taskStore.deleteProject(project.id)
    showProjectContextMenu.value = false
  }
  confirmDetails.value = details
  showConfirmModal.value = true
}

// deleteProject removed - using taskStore.deleteProject() which properly handles task reassignment

// Task management methods
const openEditTask = (task: Task) => {
  editingTask.value = task
  showTaskEditModal.value = true
}

const confirmDeleteTask = async (task: Task) => {
  confirmMessage.value = `Delete task "${task.title}"?`
  confirmAction.value = async () => {
    // Use the unified undo system
    const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
    const undoRedoActions = useUnifiedUndoRedo()
    undoRedoActions.deleteTaskWithUndo(task.id)
  }
  showConfirmModal.value = true
}

const handleContextMenuDelete = (taskId: string, instanceId?: string, isCalendarEvent?: boolean) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (!task) return

  if (isCalendarEvent && instanceId) {
    // Calendar event deletion - remove specific instance
    confirmMessage.value = `Remove "${task.title}" from calendar?`
    confirmAction.value = () => {
      taskStore.deleteTaskInstance(taskId, instanceId)
      showTaskContextMenu.value = false
    }
    confirmDetails.value = ['This will remove the scheduled instance and return the task to the sidebar.']
    showConfirmModal.value = true
  } else {
    // Regular task deletion
    confirmDeleteTask(task)
  }
}

const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuTask.value = task
  showTaskContextMenu.value = true
}

const closeTaskContextMenu = () => {
  showTaskContextMenu.value = false
  contextMenuTask.value = null
}

// Confirmation modal methods
const executeConfirmAction = async () => {
  await confirmAction.value()
  showConfirmModal.value = false
  confirmAction.value = () => {}
  confirmMessage.value = ''
}

const cancelConfirmAction = () => {
  showConfirmModal.value = false
  confirmAction.value = () => {}
  confirmMessage.value = ''
  confirmDetails.value = []
}

// Listen for task edit requests from calendar/other views
const handleOpenTaskEdit = (event: CustomEvent) => {
  const task = taskStore.tasks.find(t => t.id === event.detail.taskId)
  if (task) {
    openEditTask(task)
  }
}

// Handle Shift+Delete for selected tasks
const handleDeleteSelectedTasks = () => {
  let selectedTaskIds = [...taskStore.selectedTaskIds]

  // Also check canvas selections if available
  try {
    const { useCanvasStore } = require('@/stores/canvas')
    const canvasStore = useCanvasStore()

    // Add canvas-selected task nodes (filter out section nodes)
    const canvasTaskIds = canvasStore.selectedNodeIds.filter(nodeId => {
      const task = taskStore.tasks.find(t => t.id === nodeId)
      return !!task
    })

    // Merge selections, removing duplicates
    selectedTaskIds = [...new Set([...selectedTaskIds, ...canvasTaskIds])]
  } catch {
    // Canvas store not available, continue with global selections only
  }

  if (selectedTaskIds.length === 0) {
    // No tasks selected, show a helpful message
    console.log('Shift+Delete: No tasks selected. Please select tasks first.')
    return
  }

  // Get the task details for confirmation message
  const selectedTasks = taskStore.tasks.filter(task => selectedTaskIds.includes(task.id))

  if (selectedTasks.length === 1) {
    // Single task deletion
    const task = selectedTasks[0]
    confirmMessage.value = `Delete task "${task.title}"?`
    confirmDetails.value = ['This will permanently remove the task from all views.']
  } else {
    // Multiple task deletion
    confirmMessage.value = `Delete ${selectedTasks.length} selected tasks?`
    const taskTitles = selectedTasks.map(task => `• ${task.title}`)
    confirmDetails.value = [
      'This will permanently remove the following tasks from all views:',
      ...taskTitles
    ]
  }

  confirmAction.value = async () => {
    // Use the unified undo system for simplified deletion
    console.log('🔧 App.vue: Starting deletion process, using unified undo system')
    console.log('🔧 App.vue: Current undo stack size:', undoHistory.undoCount.value)

    for (const taskId of selectedTaskIds) {
      console.log('🔧 App.vue: About to delete task with undo command:', taskId)

      // Use the unified undo system for direct deletion
      undoHistory.deleteTaskWithUndo(taskId)

      console.log('🔧 App.vue: Delete command executed for task:', taskId)
      console.log('🔧 App.vue: Undo stack size after deletion:', undoHistory.undoCount.value)
    }

    // Clear selection after deletion
    taskStore.clearSelection()

    console.log(`Deleted ${selectedTaskIds.length} tasks:`, selectedTaskIds)
  }

  showConfirmModal.value = true
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
    const { useUnifiedUndoRedo } = await import('@/composables/useUnifiedUndoRedo')
    const undoRedoActions = useUnifiedUndoRedo()
    await undoRedoActions.redo()
    console.log('✅ Redo successful - task should be deleted again')
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
  // Check if we should ignore keyboard shortcuts
  const target = event.target as HTMLElement
  if (shouldIgnoreElement(target)) return

  // Cmd/Ctrl+K to open Command Palette (Quick Add)
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    commandPaletteRef.value?.open()
  }

  // Cmd/Ctrl+P to open search (alternative)
  if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
    event.preventDefault()
    showSearchModal.value = true
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

  // Shift+1-5 for view switching
  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const key = event.key
    if (key >= '1' && key <= '5') {
      const route = viewRouteMap[key as keyof typeof viewRouteMap]
      if (route) {
        event.preventDefault()
        router.push(route)
      }
    }
  }
}

const handleSearchSelectTask = (task: Task) => {
  openEditTask(task)
}

const handleSearchSelectProject = (project: Project) => {
  // TODO: Navigate to project view or filter by project
  console.log('Selected project:', project)
}

// Error boundary handler
const handleViewError = (error: Error, info: any) => {
  console.error('View error caught by boundary:', error, info)
  // Could send to error tracking service here
}

// Handle project un-nesting (drag to "All Projects")
const handleProjectUnnest = (data: any) => {
  if (data.projectId) {
    // Remove parent relationship by setting parentId to null
    taskStore.updateProject(data.projectId, { parentId: null })
    console.log(`Project "${data.title}" un-nested to root level`)
  }
}

// Listen for context menu requests from Canvas/other views
const handleGlobalTaskContextMenu = (event: CustomEvent) => {
  const { event: mouseEvent, task, instanceId, isCalendarEvent } = event.detail

  // Store calendar-specific data for later use in delete handler
  if (isCalendarEvent && instanceId) {
    (contextMenuTask.value as any) = {
      ...task,
      instanceId,
      isCalendarEvent
    }
  }

  handleTaskContextMenu(mouseEvent, task)
}

// Initialize theme and app
onMounted(async () => {
  // Initialize cohesive theme system
  initializeTheme()

  // Load UI state from localStorage
  uiStore.loadState()

  // Load data from IndexedDB
  await taskStore.loadFromDatabase()
  await canvasStore.loadFromDatabase()

  // Request notification permission for timer
  timerStore.requestNotificationPermission()

  // Listen for task edit requests
  window.addEventListener('open-task-edit', handleOpenTaskEdit as EventListener)
  window.addEventListener('task-context-menu', handleGlobalTaskContextMenu as EventListener)

  // Add keyboard shortcut listener for search
  window.addEventListener('keydown', handleKeydown)

  // Auto-open auth modal if not authenticated (after auth state loads)
  // Wait for auth to initialize, then check if user is authenticated
  setTimeout(() => {
    if (!authStore.isLoading && !authStore.isAuthenticated && !uiStore.authModalOpen) {
      console.log('🔐 [APP.VUE] Auto-opening auth modal - user not authenticated')
      uiStore.openAuthModal('login', '/')
    }
  }, 1000) // Wait 1 second for auth to initialize
})

onUnmounted(() => {
  window.removeEventListener('open-task-edit', handleOpenTaskEdit as EventListener)
  window.removeEventListener('task-context-menu', handleGlobalTaskContextMenu as EventListener)
  window.removeEventListener('keydown', handleKeydown)
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
  min-height: 100vh;
  font-family: var(--font-sans);
  color: var(--text-primary);
  /* Use CSS Grid for flexible sidebar layout */
  display: grid;
  grid-template-columns: minmax(240px, 300px) 1fr;
  position: relative;
  overflow-x: hidden; /* Prevent horizontal overflow at root level */
  overflow-y: visible; /* Allow vertical scrolling */
}

/* When sidebar is hidden, collapse the first column */
.app.sidebar-hidden {
  grid-template-columns: 0 1fr;
}

/* Animated gradient overlay */
.app::before {
  content: '';
  position: absolute;
  inset: 0; /* RTL: direction-agnostic full coverage */
  background:
    radial-gradient(circle at 20% 50%, var(--purple-bg-subtle) 0%, transparent 50%),
    radial-gradient(circle at 80% 30%, var(--glass-bg-soft) 0%, transparent 50%),
    radial-gradient(circle at 60% 80%, var(--glass-bg-light) 0%, transparent 50%);
  pointer-events: none;
  animation: gradientShift 20s ease infinite;
}

@keyframes gradientShift {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}

/* LEFT SIDEBAR - Glass effect */
.sidebar {
  /* Remove fixed width - let CSS Grid control the width */
  min-width: 240px; /* Minimum width for usability */
  max-width: 300px; /* Maximum width to prevent overly wide sidebar */
  width: 100%; /* Fill the grid column */
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-soft) 100%
  );
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border-right: 1px solid var(--glass-border-hover);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  z-index: 100;
  box-shadow:
    var(--shadow-2xl),
    inset -1px 0 0 var(--glass-bg-heavy);
  contain: layout style; /* Performance optimization */
  overflow: hidden; /* Prevent sidebar content from causing horizontal scroll */
}

/* Sidebar toggle transitions */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.sidebar-slide-enter-to,
.sidebar-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.sidebar-header {
  padding: var(--space-10) var(--space-6) var(--space-6) var(--space-6);
  border-bottom: 1px solid var(--glass-bg-heavy);
  background: linear-gradient(
    180deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-weak) 100%
  );
}

.app-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.brand-icon {
  font-size: var(--text-xl);
}

.brand-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

/* Sidebar header buttons */
.sidebar-header button {
  width: 100%;
  margin-top: var(--space-2);
}

/* Icon button group */
.icon-button-group {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.icon-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.icon-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow);
}

.icon-btn:active {
  transform: scale(0.95);
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

/* NAVIGATION MENU */
.nav-menu {
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--border-subtle);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: var(--space-2) var(--space-6);
  color: var(--text-muted);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  position: relative;
}

.nav-item:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
}

.nav-icon {
  font-size: var(--text-base);
  width: 1.25rem;
  text-align: center;
}

.notification-badge {
  background: var(--color-danger);
  color: var(--state-active-text);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-lg);
  margin-inline-start: auto; /* RTL: push badge to end */
  min-width: 1.25rem;
  text-align: center;
}

/* PROJECTS SECTION */
.projects-section {
  padding: var(--space-4);
  flex: 1;
}

.section-title {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
  text-transform: none;
}

.project-parent {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: var(--space-2) 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
}

.expand-icon {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.project-children {
  margin-inline-start: 1rem; /* RTL: indent child projects */
  margin-bottom: 1rem;
}

.project-child {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: var(--space-1_5) 0;
  color: var(--text-muted);
  text-decoration: none;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.project-child:hover {
  color: var(--text-secondary);
}

.project-child.active {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.project-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--border-strong);
}

.project-dot.orange {
  background: var(--color-break);
}

.create-issue-btn {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-6);
  cursor: pointer;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.create-issue-btn:hover {
  background: var(--surface-elevated);
  border-color: var(--border-strong);
}

/* Sidebar footer removed - Settings moved to header */

/* Task Management Sidebar */
.quick-add-section {
  padding: var(--sidebar-quickadd-padding-y) var(--sidebar-quickadd-padding-x);
  border-bottom: 1px solid var(--border-subtle);
}

.quick-add-input {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
}

.quick-add-input:focus-within {
  border-color: var(--calendar-creating-border);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  box-shadow:
    var(--calendar-creating-bg),
    var(--shadow-lg);
}

.add-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.task-input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  width: 100%;
  outline: none;
}

.task-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.task-management-section {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-6);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  margin: 0;
  letter-spacing: 0.05em;
}

.section-icon {
  color: var(--text-muted);
}

.add-project-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 150ms ease;
}

.add-project-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  color: var(--text-secondary);
}

/* Smart Views Section */
.smart-views {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
}

.projects-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    var(--glass-bg-heavy) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  margin: var(--space-4) 0;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow-y: auto;
  max-height: calc(100vh - 500px); /* Leave space for header and controls */
  padding-right: var(--space-2); /* Prevent scroll from interfering with content */
}

/* Ensure the project tree items can use full width */
.projects-list .project-tree-item {
  width: 100%;
}

.project-group {
  display: flex;
  flex-direction: column;
}

/* Project Navigation Items - Modern, Spacious Design */
.project-nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  position: relative;
  min-height: 40px;
  margin-bottom: var(--space-1);
}

.project-nav-item.smart-view {
  margin-bottom: var(--space-1);
}

.view-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.project-nav-item.active .view-icon {
  color: var(--brand-primary);
}

/* Expand/Collapse Chevron */
.expand-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform var(--duration-fast) var(--spring-bouncy);
  cursor: pointer;
  padding: var(--space-1);
  margin-inline-start: calc(var(--space-1) * -1); /* RTL: align chevron */
}

.expand-chevron.expanded {
  transform: rotate(0deg);
}

.expand-chevron:not(.expanded) {
  transform: rotate(-90deg);
}

.expand-chevron:hover {
  color: var(--text-secondary);
}

.chevron-spacer {
  width: 14px;
  flex-shrink: 0;
}

.project-nav-item:hover {
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  transform: translateX(4px);
  box-shadow: var(--shadow-md);
}

.project-nav-item.active {
  background: linear-gradient(
    135deg,
    var(--purple-bg-start) 0%,
    var(--purple-bg-end) 100%
  );
  box-shadow:
    var(--shadow-lg),
    var(--purple-shadow-subtle);
}

.project-nav-item.active::before {
  content: '';
  position: absolute;
  inset-inline-start: 0; /* RTL: active indicator bar */
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: linear-gradient(
    180deg,
    var(--calendar-today-badge-start) 0%,
    var(--purple-bg-subtle) 100%
  );
  border-radius: var(--radius-full);
  box-shadow: var(--timer-shadow-glow);
}

/* Nested Projects */
.nested-projects {
  margin-inline-start: var(--space-6); /* RTL: indent nested projects */
  margin-top: var(--space-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.project-nav-item.nested {
  padding: var(--space-2) var(--space-3);
  min-height: 36px;
}

.project-nav-item.nested .project-name {
  font-size: var(--text-sm);
}

.project-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  opacity: 0.9;
  transition: all var(--duration-fast) ease;
}

.project-nav-item:hover .project-dot {
  opacity: 1;
  transform: scale(1.1);
}

.project-dot.small {
  width: 6px;
  height: 6px;
}

.project-name {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-nav-item.active .project-name {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.task-count {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  background: var(--glass-bg-heavy);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  min-width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.project-nav-item.active .task-count {
  background: var(--glass-border-hover);
  color: var(--text-primary);
}

/* Removed sidebar-task styles - tasks no longer shown in sidebar */
/* Sidebar footer removed - Settings moved to header */

/* MAIN CONTENT - Transparent with glass effects */
.main-content {
  /* Grid column automatically takes remaining space */
  background: transparent;
  padding: var(--space-10) var(--space-12); /* RTL: increased padding for less cramped feel */
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-height: 100vh;
  overflow-x: hidden; /* Prevent horizontal overflow from affecting main layout */
  overflow-y: visible; /* Allow vertical scrolling */
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* When sidebar is hidden, content expands naturally via flexbox */

/* BREADCRUMB */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.breadcrumb-item {
  cursor: pointer;
}

.breadcrumb-item:hover {
  color: var(--text-secondary);
}

.breadcrumb-item.current {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.breadcrumb-separator {
  color: var(--text-secondary);
}

/* HEADER SECTION */
.header-section {
  display: flex;
  justify-content: flex-start;
  align-items: center; /* Center align for better balance */
  gap: var(--space-4); /* Tighter spacing for less scattered appearance */
  margin-bottom: 1.5rem;

  /* CRITICAL FIX: Let drag events pass through header to canvas below */
  pointer-events: none;
  position: relative;
  z-index: 5; /* Above canvas but events pass through */
}

/* INTEGRATED CONTROL PANEL - Unified Clock + Timer Container */
.control-panel {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  margin-left: auto; /* Push to right side of header */

  /* Glass morphism styling */
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  /* Subtle depth */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1),
              0 1px 3px rgba(0, 0, 0, 0.08);

  /* Re-enable pointer events for interactions */
  pointer-events: auto;

  /* Smooth transitions */
  transition: all var(--duration-normal) var(--spring-smooth);
}

.control-panel:hover {
  background: var(--glass-bg-soft);
  border-color: var(--state-hover-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15),
              0 2px 6px rgba(0, 0, 0, 0.1);
}

/* USER PROFILE CONTAINER - Re-enable pointer events */
.user-profile-container {
  /* UserProfile component handles its own stacking and pointer events now */
  pointer-events: auto;
}

/* TIME DISPLAY CONTAINER - Re-enable pointer events */
.time-display-container {
  display: flex;
  align-items: center;
  pointer-events: auto;
}

.project-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;

  /* Re-enable pointer events for text selection */
  pointer-events: auto;
}

/* TIMER DISPLAY - Minimalistic Glass */
.timer-container {
  display: flex;
  align-items: center;

  /* Re-enable pointer events for timer interactions */
  pointer-events: auto;
}

.timer-display {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  /* Always render border - just change color */
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-5);
  /* Fixed min-height to prevent layout shift */
  min-height: 60px;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 var(--glass-bg-heavy);

  /* Pointer events enabled (inherited from timer-container) */
}

.timer-display.timer-active {
  background: linear-gradient(
    135deg,
    var(--timer-break-bg-start) 0%,
    var(--timer-break-bg-end) 100%
  );
  border-color: var(--timer-border-medium);
  box-shadow:
    var(--shadow-xl),
    0 0 24px var(--timer-break-bg-start),
    inset 0 1px 0 var(--border-medium);
}

.timer-display.timer-break {
  background: linear-gradient(
    135deg,
    var(--success-bg-start) 0%,
    var(--success-bg-end) 100%
  );
  border-color: var(--success-border);
  box-shadow:
    var(--shadow-xl),
    0 0 24px var(--success-bg-start),
    inset 0 1px 0 var(--border-medium);
}

.timer-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Animated emoticons for timer */
.timer-emoticon {
  font-size: var(--text-2xl);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.timer-emoticon.active {
  animation: emoticonBounce 1.5s ease-in-out infinite;
}

@keyframes emoticonBounce {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  25% {
    transform: translateY(-6px) scale(1.1);
  }
  50% {
    transform: translateY(0) scale(1);
  }
  75% {
    transform: translateY(-3px) scale(1.05);
  }
}

/* Stroke icon colors for timer */
.timer-stroke {
  color: var(--color-work);
  animation: pulse 2s infinite;
}

.coffee-stroke {
  color: var(--color-break);
}

.meditation-stroke {
  color: var(--color-focus);
}

.timer-display.timer-active .timer-stroke {
  animation: bounce 1s infinite;
}

.timer-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
}

.timer-time {
  font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  min-width: 4rem;
  letter-spacing: 0.025em;
}

.timer-task {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: var(--font-medium);
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timer-controls {
  display: flex;
  gap: 0.25rem;
}

.timer-start-options {
  display: flex;
  gap: 0.25rem;
}

.timer-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}

.timer-btn:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
}

.timer-start, .timer-resume {
  color: var(--color-work);
}

.timer-start:hover, .timer-resume:hover {
  background: var(--state-hover-bg);
  color: var(--color-work);
}

.timer-pause {
  color: var(--color-break);
}

.timer-pause:hover {
  background: var(--glass-bg-tint);
  color: var(--color-break);
}

.timer-stop {
  color: var(--color-danger);
}

.timer-stop:hover {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-3px); }
  60% { transform: translateY(-2px); }
}

/* View transition animations */
.view-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: visible;
  padding-inline-end: var(--space-2); /* RTL: scrollbar spacing */
  min-height: 0; /* Critical: allows flex child to shrink */
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

/* CONTENT HEADER */
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--nav-tabs-spacing-below);

  /* Visual separation from content below */
  border-bottom: 1px solid var(--glass-border-hover);  /* Match sidebar border color */
  padding-bottom: var(--nav-tabs-padding-bottom); /* Removed to create perfect T-junction with sidebar border */

  /* Extend border to meet sidebar - negative margin offset by padding */
  margin-left: calc(var(--space-12) * -1);
  margin-right: calc(var(--space-12) * -1);
  padding-left: var(--space-12);
  padding-right: var(--space-12);

  /* CRITICAL FIX: Let drag events pass through tabs to canvas below */
  pointer-events: none;
  position: relative;
  z-index: 5;
}

.view-tabs {
  display: flex;
  gap: 0.125rem;

  /* Re-enable pointer events for tab clicks */
  pointer-events: auto;
}

.view-tab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.view-tab:hover {
  color: var(--text-secondary);
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  box-shadow: var(--state-hover-shadow);
}

.view-tab.active {
  color: var(--state-active-text);
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  font-weight: var(--font-semibold);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.view-tab.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.view-tab.disabled:hover {
  background: transparent;
  color: var(--text-muted);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  margin-left: 6px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
}

.view-tab.active .tab-badge {
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}



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

/* Dark theme for task management sidebar */
.dark-theme .quick-add-section {
  border-bottom-color: var(--border-subtle);
}

.dark-theme .quick-add-input {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
}

.dark-theme .quick-add-input:focus-within {
  border-color: var(--color-navigation);
  box-shadow: var(--purple-glow-focus);
}

.dark-theme .add-icon {
  color: var(--text-muted);
}

.dark-theme .task-input {
  color: var(--text-primary);
}

.dark-theme .task-input::placeholder {
  color: var(--text-subtle);
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