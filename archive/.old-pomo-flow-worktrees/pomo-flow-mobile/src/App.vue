<template>
  <n-config-provider :theme="darkTheme">
    <n-global-style />
    <n-message-provider>
  <!-- PROFESSIONAL PROJECT MANAGEMENT SYSTEM - CODOMO STYLE -->
  <div class="app">
    <!-- LEFT SIDEBAR NAVIGATION -->
    <aside class="sidebar">
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

        <!-- Theme Toggle -->
        <BaseButton variant="ghost" size="md" @click="toggleDarkMode">
          {{ isDarkMode ? '☀️ Light' : '🌙 Dark' }}
        </BaseButton>
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

        <!-- Smart Views - Using BaseNavItem for consistency -->
        <div class="smart-views">
          <!-- All Projects - Also serves as drop zone to un-nest projects -->
          <BaseNavItem
            :active="taskStore.activeProjectId === null && taskStore.activeSmartView === null"
            :count="taskStore.tasks.length"
            project-id="__root__"
            @click="selectAllProjects"
            @project-drop="handleProjectUnnest"
          >
            <template #icon>
              <Inbox :size="16" />
            </template>
            All Projects
          </BaseNavItem>

          <!-- Today -->
          <BaseNavItem
            :active="taskStore.activeSmartView === 'today'"
            :count="todayTaskCount"
            @click="selectSmartView('today')"
          >
            <template #icon>
              <Calendar :size="16" />
            </template>
            Today
          </BaseNavItem>


        </div>

        <!-- Projects Section Header -->
        <div class="projects-divider"></div>

        <!-- Project List - Using BaseNavItem for consistency -->
        <div class="projects-list">
          <!-- Root Projects -->
          <div
            v-for="project in rootProjects"
            :key="project.id"
            class="project-group"
          >
            <BaseNavItem
              :active="taskStore.activeProjectId === project.id"
              :project-id="project.id"
              :has-children="hasChildren(project.id)"
              :expanded="expandedProjects.includes(project.id)"
              :color-dot="project.color"
              :count="getProjectTaskCount(project.id)"
              @click="selectProject(project)"
              @toggle-expand="toggleProjectExpansion(project.id)"
              @contextmenu.prevent="handleProjectContextMenu($event, project)"
            >
              {{ project.name }}
            </BaseNavItem>

            <!-- Nested Children (if expanded) -->
            <div
              v-if="hasChildren(project.id) && expandedProjects.includes(project.id)"
              class="nested-projects"
            >
              <BaseNavItem
                v-for="child in getChildren(project.id)"
                :key="child.id"
                :active="taskStore.activeProjectId === child.id"
                :project-id="child.id"
                :color-dot="child.color"
                :count="getProjectTaskCount(child.id)"
                nested
                @click="selectProject(child)"
                @contextmenu.prevent="handleProjectContextMenu($event, child)"
              >
                {{ child.name }}
              </BaseNavItem>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings -->
      <div class="sidebar-footer">
        <BaseButton variant="ghost" size="md" @click="showSettings = true">
          <Settings :size="14" />
          Settings
        </BaseButton>
      </div>
    </aside>

    <!-- MAIN CONTENT AREA -->
    <main class="main-content">

      <!-- PROJECT TITLE AND TIMER -->
      <div class="header-section">
        <h1 class="project-title">{{ pageTitle }}</h1>

        <!-- POMODORO TIMER DISPLAY -->
        <div class="timer-container">
          <div class="timer-display" :class="{ 'timer-active': timerStore.isTimerActive, 'timer-break': timerStore.currentSession?.isBreak }">
            <div class="timer-icon">
              <!-- Animated emoticons when timer is active -->
              <span v-if="timerStore.isTimerActive && !timerStore.currentSession?.isBreak" class="timer-emoticon active">🍅</span>
              <span v-else-if="timerStore.isTimerActive && timerStore.currentSession?.taskId === 'short-break'" class="timer-emoticon active">☕</span>
              <span v-else-if="timerStore.isTimerActive && timerStore.currentSession?.isBreak" class="timer-emoticon active">🧘</span>
              <!-- Static icons when timer is inactive -->
              <Timer v-else-if="!timerStore.currentSession?.isBreak" :size="20" :stroke-width="1.5" class="timer-stroke" />
              <Coffee v-else-if="timerStore.currentSession?.taskId === 'short-break'" :size="20" :stroke-width="1.5" class="coffee-stroke" />
              <User v-else :size="20" :stroke-width="1.5" class="meditation-stroke" />
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

      <!-- VIEW TABS AND CONTROLS -->
      <div class="content-header">
        <div class="view-tabs">
          <router-link to="/" class="view-tab" active-class="active">Board</router-link>
          <router-link to="/calendar" class="view-tab" active-class="active">Calendar</router-link>
          <router-link to="/canvas" class="view-tab" active-class="active">Canvas</router-link>
          <button class="view-tab disabled" disabled>Table</button>
          <button class="view-tab disabled" disabled>List</button>
        </div>


      </div>

      <!-- ROUTER VIEW FOR DIFFERENT VIEWS -->
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <div class="view-wrapper">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </main>

    <!-- SETTINGS MODAL -->
    <SettingsModal
      :isOpen="showSettings"
      @close="showSettings = false"
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
      @close="closeTaskContextMenu"
      @edit="openEditTask"
      @confirmDelete="handleContextMenuDelete"
    />

    <!-- CONFIRMATION MODAL -->
    <ConfirmationModal
      :isOpen="showConfirmModal"
      :title="'Confirm Action'"
      :message="confirmMessage"
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
  </div>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NGlobalStyle, darkTheme } from 'naive-ui'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore, getTaskInstances } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useTheme } from '@/composables/useTheme'
import { useFavicon } from '@/composables/useFavicon'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseNavItem from '@/components/base/BaseNavItem.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import ProjectModal from '@/components/ProjectModal.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import TaskContextMenu from '@/components/TaskContextMenu.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import SearchModal from '@/components/SearchModal.vue'
import type { Task, Project } from '@/stores/tasks'
import {
  Play, Pause, Square, Plus, Settings,
  Inbox, Bell, FileText, Archive,
  Coffee, User, Timer, FolderOpen, ChevronDown,
  Clock, Flag, Calendar, Edit, Trash2
} from 'lucide-vue-next'

// Stores
const timerStore = useTimerStore()
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()

// Theme management - using new cohesive design system
const { isDarkMode, toggleTheme, initializeTheme } = useTheme()

// Favicon management - dynamic based on timer state
useFavicon()

// Settings modal state
const showSettings = ref(false)

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

// Confirmation modal state
const showConfirmModal = ref(false)
const confirmAction = ref<() => void>(() => {})
const confirmMessage = ref('')

// Search modal state
const showSearchModal = ref(false)

// Computed Properties for Project Hierarchy
const rootProjects = computed(() => {
  return taskStore.projects.filter(p => !p.parentId)
})

const getChildren = (parentId: string) => {
  return taskStore.projects.filter(p => p.parentId === parentId)
}

const hasChildren = (projectId: string) => {
  return taskStore.projects.some(p => p.parentId === projectId)
}

// Smart View Counts
const todayTaskCount = computed(() => {
  const todayStr = new Date().toISOString().split('T')[0]
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return taskStore.tasks.filter(task => {
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



// Dynamic page title
const pageTitle = computed(() => {
  if (taskStore.activeSmartView === 'today') return 'Today'

  if (taskStore.activeProjectId) {
    const project = taskStore.projects.find(p => p.id === taskStore.activeProjectId)
    return project ? project.name : 'My Tasks'
  }

  return 'My Tasks'
})

// Theme toggle - using new cohesive design system
const toggleDarkMode = () => {
  toggleTheme()
}


// Timer methods
const startQuickTimer = () => {
  // Start a general 25-minute timer (no specific task)
  timerStore.startTimer('general')
}

const startShortBreak = () => {
  // Start a 5-minute break timer
  timerStore.startTimer('short-break', timerStore.settings.shortBreakDuration, true)
}

const startLongBreak = () => {
  // Start a 15-minute long break timer
  timerStore.startTimer('long-break', timerStore.settings.longBreakDuration, true)
}

// Task management methods
const createQuickTask = () => {
  if (newTaskTitle.value.trim()) {
    taskStore.createTask({
      title: newTaskTitle.value.trim(),
      description: '',
      status: 'planned',
      projectId: '1' // Default project
    })
    newTaskTitle.value = ''
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

const selectAllProjects = () => {
  taskStore.setActiveProject(null)
  taskStore.setSmartView(null)
}

const selectSmartView = (view: 'today') => {
  taskStore.setSmartView(view)
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
  taskStore.createTask({
    title: 'New Task',
    description: '',
    status: 'planned',
    projectId
  })
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
  // TODO: Show project context menu
  console.log('Project context menu for:', project.name)
}

const confirmDeleteProject = (project: Project) => {
  confirmMessage.value = `Delete project "${project.name}" and all its tasks?`
  confirmAction.value = () => deleteProject(project.id)
  showConfirmModal.value = true
}

const deleteProject = (projectId: string) => {
  // Delete all tasks in project first
  const projectTasks = taskStore.tasks.filter(task => task.projectId === projectId)
  projectTasks.forEach(task => taskStore.deleteTask(task.id))

  // Delete project
  const projectIndex = taskStore.projects.findIndex(p => p.id === projectId)
  if (projectIndex !== -1) {
    taskStore.projects.splice(projectIndex, 1)
  }
}

// Task management methods
const openEditTask = (task: Task) => {
  editingTask.value = task
  showTaskEditModal.value = true
}

const confirmDeleteTask = (task: Task) => {
  confirmMessage.value = `Delete task "${task.title}"?`
  confirmAction.value = () => taskStore.deleteTask(task.id)
  showConfirmModal.value = true
}

const handleContextMenuDelete = (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (task) {
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
const executeConfirmAction = () => {
  confirmAction.value()
  showConfirmModal.value = false
  confirmAction.value = () => {}
  confirmMessage.value = ''
}

const cancelConfirmAction = () => {
  showConfirmModal.value = false
  confirmAction.value = () => {}
  confirmMessage.value = ''
}

// Listen for task edit requests from calendar/other views
const handleOpenTaskEdit = (event: CustomEvent) => {
  const task = taskStore.tasks.find(t => t.id === event.detail.taskId)
  if (task) {
    openEditTask(task)
  }
}

// Search modal handlers
const handleKeydown = (event: KeyboardEvent) => {
  // Ctrl+K or Cmd+K to open search
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    showSearchModal.value = true
  }
}

const handleSearchSelectTask = (task: Task) => {
  openEditTask(task)
}

const handleSearchSelectProject = (project: Project) => {
  // TODO: Navigate to project view or filter by project
  console.log('Selected project:', project)
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
  const { event: mouseEvent, task } = event.detail
  handleTaskContextMenu(mouseEvent, task)
}

// Initialize theme and app
onMounted(async () => {
  // Initialize cohesive theme system
  initializeTheme()

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
  display: flex;
  position: relative;
  overflow: hidden;
}

/* Animated gradient overlay */
.app::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  width: 260px;
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
  z-index: 10;
  box-shadow:
    var(--shadow-2xl),
    inset -1px 0 0 var(--glass-bg-heavy);
}

.sidebar-header {
  padding: var(--space-6) var(--space-6);
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
  margin-bottom: var(--space-4);
}

.brand-icon {
  font-size: var(--text-xl);
}

.brand-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

/* Removed - using BaseButton now */
.sidebar-header button {
  width: 100%;
  margin-top: var(--space-2);
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
  margin-left: auto;
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
  margin-left: 1rem;
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

/* Removed - using BaseButton now */
.sidebar-footer button {
  width: 100%;
}

/* Task Management Sidebar */
.quick-add-section {
  padding: var(--space-4) var(--space-6);
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
  margin-left: calc(var(--space-1) * -1);
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
  left: 0;
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
  margin-left: var(--space-6);
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

.sidebar-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border-subtle);
}

/* MAIN CONTENT - Transparent with glass effects */
.main-content {
  flex: 1;
  background: transparent;
  padding: var(--space-8) var(--space-10);
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}

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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.project-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

/* TIMER DISPLAY - Minimalistic Glass */
.timer-container {
  display: flex;
  align-items: center;
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
  overflow-y: auto;
  padding-right: var(--space-2);
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
  margin-bottom: 1.5rem;
}

.view-tabs {
  display: flex;
  gap: 0.125rem;
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

.theme-toggle {
  background: var(--surface-secondary);
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-6);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.theme-toggle:hover {
  background: var(--surface-tertiary);
  border-color: var(--border-strong);
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

.dark-theme .sidebar-footer {
  border-top-color: var(--border-subtle);
}

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



.dark-theme .theme-toggle {
  background: var(--surface-secondary);
  border-color: var(--border-subtle);
  color: var(--text-muted);
}

.dark-theme .theme-toggle:hover {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
}

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