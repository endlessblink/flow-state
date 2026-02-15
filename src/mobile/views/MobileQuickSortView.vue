<template>
  <div class="mobile-quick-sort">
    <!-- Grain Texture Overlay -->
    <div class="grain-overlay" aria-hidden="true" />

    <!-- Header -->
    <header class="qs-header">
      <button class="back-btn" aria-label="Exit Quick Sort" @click="handleExit">
        <X :size="24" />
      </button>
      <div class="header-content">
        <h1 class="qs-title">
          <Zap :size="20" class="zap-icon" />
          <span>Quick Sort</span>
        </h1>
        <p class="qs-subtitle">
          {{ activePhase === 'capture' ? 'Capture' : 'Swipe to sort' }}
        </p>
      </div>
      <div class="header-stats">
        <span class="stat-badge">{{ progress.current }}/{{ progress.total }}</span>
      </div>
    </header>

    <!-- Progress Bar -->
    <div v-if="!isComplete && activePhase === 'sort'" class="progress-track">
      <div
        class="progress-fill"
        :style="{ width: `${progress.percentage}%` }"
      />
      <div class="progress-glow" :style="{ left: `${progress.percentage}%` }" />
    </div>

    <!-- Phase Toggle -->
    <div class="phase-toggle">
      <button
        class="phase-btn"
        :class="{ active: activePhase === 'sort' }"
        @click="activePhase = 'sort'"
      >
        <Zap :size="16" />
        Sort
        <span v-if="uncategorizedCount > 0" class="count-badge">{{ uncategorizedCount }}</span>
      </button>
      <button
        class="phase-btn"
        :class="{ active: activePhase === 'capture' }"
        @click="activePhase = 'capture'"
      >
        <Plus :size="16" />
        Capture
      </button>
    </div>

    <!-- Task Context Bar (visible only in sort phase, reactive to task changes) -->
    <div v-if="activePhase === 'sort' && !isComplete && currentTask" class="task-context-bar">
      <!-- Due Date -->
      <div class="context-item">
        <CalendarDays :size="14" />
        <span v-if="taskDueDate" :class="{ 'overdue-text': isTaskOverdue }">{{ taskDueDate }}</span>
        <span v-else class="context-empty">No date</span>
      </div>

      <!-- Priority -->
      <div class="context-divider" />
      <div class="context-item">
        <span
          class="priority-indicator"
          :class="`priority-${currentTask.priority || 'none'}`"
        />
        <span class="capitalize">{{ currentTask.priority || 'None' }}</span>
      </div>

      <!-- Project -->
      <div class="context-divider" />
      <div class="context-item">
        <FolderOpen :size="14" />
        <span v-if="currentTaskProject" class="project-text">
          <span v-if="currentTaskProject.emoji" class="project-emoji">{{ currentTaskProject.emoji }}</span>
          {{ currentTaskProject.name }}
        </span>
        <span v-else class="context-empty">No project</span>
      </div>
    </div>

    <!-- Main Content -->
    <main class="qs-main">
      <!-- CAPTURE PHASE -->
      <div v-if="activePhase === 'capture'" class="capture-phase">
        <div class="capture-input-area">
          <div class="capture-card">
            <input
              ref="captureInputRef"
              v-model="newTaskTitle"
              type="text"
              class="capture-input"
              placeholder="What needs to be done?"
              autofocus
              @keydown.enter="handleQuickAdd"
            >

            <!-- Quick Actions -->
            <div class="quick-actions">
              <button
                class="quick-action-btn"
                :class="{ active: newTaskPriority === 'high' }"
                @click="newTaskPriority = newTaskPriority === 'high' ? undefined : 'high'"
              >
                <Flag :size="16" class="priority-high" />
                High
              </button>
              <button
                class="quick-action-btn"
                :class="{ active: newTaskDue === 'today' }"
                @click="newTaskDue = newTaskDue === 'today' ? undefined : 'today'"
              >
                <Calendar :size="16" />
                Today
              </button>
              <button
                class="quick-action-btn"
                :class="{ active: newTaskDue === 'tomorrow' }"
                @click="newTaskDue = newTaskDue === 'tomorrow' ? undefined : 'tomorrow'"
              >
                <CalendarPlus :size="16" />
                Tomorrow
              </button>
            </div>

            <button
              class="add-task-btn"
              :disabled="!newTaskTitle.trim()"
              @click="handleQuickAdd"
            >
              <Plus :size="20" />
              Add Task
            </button>
          </div>
        </div>

        <!-- Recently Added -->
        <div v-if="recentlyAdded.length > 0" class="recently-added">
          <h3 class="section-title">
            Just Added
          </h3>
          <TransitionGroup name="task-list" tag="ul" class="recent-list">
            <li
              v-for="task in recentlyAdded"
              :key="task.id"
              class="recent-item"
            >
              <CheckCircle :size="16" class="check-icon" />
              <span class="recent-title">{{ task.title }}</span>
            </li>
          </TransitionGroup>
        </div>
      </div>

      <!-- SORT PHASE -->
      <div v-else-if="!isComplete" class="sort-phase">
        <!-- Process Flow Indicator - Shows clear hierarchy -->
        <div class="process-flow-indicator">
          <div class="flow-step active">
            <span class="flow-icon">👀</span>
            <span class="flow-label">Review</span>
          </div>
          <div class="flow-arrow">
            →
          </div>
          <div class="flow-step">
            <span class="flow-icon">✏️</span>
            <span class="flow-label">Edit</span>
          </div>
          <div class="flow-arrow">
            →
          </div>
          <div class="flow-step">
            <span class="flow-icon">💾</span>
            <span class="flow-label">Save</span>
          </div>
        </div>

        <!-- Swipe Instructions - Clear hierarchy explanation -->
        <div v-if="!hasSwipedOnce" class="swipe-hints">
          <div class="hint hint-left">
            <ChevronLeft :size="24" />
            <span>Skip</span>
          </div>
          <div class="hint hint-right">
            <span>Exit</span>
            <ChevronRight :size="24" />
          </div>
        </div>

        <!-- Card Stack -->
        <div class="card-stack">
          <!-- Background cards (depth effect) -->
          <div
            v-for="(task, idx) in stackPreview"
            :key="task.id"
            class="stack-card"
            :style="{
              transform: `scale(${1 - idx * 0.05}) translateY(${idx * 8}px)`,
              opacity: 1 - idx * 0.3,
              zIndex: 10 - idx
            }"
          />

          <!-- Active Card -->
          <div
            ref="cardRef"
            class="task-card"
            :class="{
              'swiping': swipeState.isSwiping,
              'swipe-left': swipeDirection === 'left',
              'swipe-right': swipeDirection === 'right'
            }"
            :style="cardStyle"
          >
            <!-- Swipe Indicators - Clear action feedback -->
            <div
              class="swipe-indicator left"
              :style="{ opacity: leftOverlayOpacity }"
            >
              <div class="swipe-content">
                <SkipForward :size="32" />
                <span>Skip</span>
              </div>
            </div>
            <div
              class="swipe-indicator right"
              :style="{ opacity: rightOverlayOpacity }"
            >
              <div class="swipe-content">
                <X :size="32" />
                <span>Exit</span>
              </div>
            </div>

            <!-- Card Content with blur when swiping -->
            <div v-if="currentTask" class="card-content" :style="contentBlurStyle">
              <!-- Priority Indicator -->
              <div
                class="priority-strip"
                :class="`priority-${currentTask.priority || 'none'}`"
              />

              <h2 class="task-title" dir="auto">
                {{ currentTask.title }}
              </h2>

              <p v-if="currentTask.description" class="task-description">
                {{ truncateDescription(currentTask.description) }}
              </p>

              <!-- Metadata -->
              <div class="task-meta">
                <div v-if="currentTask.dueDate" class="meta-item">
                  <Calendar :size="14" />
                  <span>{{ formatDueDate(currentTask.dueDate) }}</span>
                </div>
                <div v-if="currentTask.priority" class="meta-item" :class="`priority-${currentTask.priority}`">
                  <Flag :size="14" />
                  <span class="capitalize">{{ currentTask.priority }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Edit Actions (Thumb Zone) -->
        <div class="thumb-zone">
          <!-- Priority Quick Edit -->
          <div class="quick-edit-row">
            <span class="edit-label">Priority</span>
            <div class="priority-pills">
              <button
                class="pill"
                :class="{ active: currentTask?.priority === 'low' }"
                @click="setPriority('low')"
              >
                Low
              </button>
              <button
                class="pill"
                :class="{ active: currentTask?.priority === 'medium' }"
                @click="setPriority('medium')"
              >
                Med
              </button>
              <button
                class="pill"
                :class="{ active: currentTask?.priority === 'high' }"
                @click="setPriority('high')"
              >
                High
              </button>
            </div>
          </div>

          <!-- Date Quick Edit - Scrollable -->
          <div class="quick-edit-row date-row">
            <span class="edit-label">Due</span>
            <div class="date-pills-scroll">
              <button
                class="pill"
                :class="{ active: isToday }"
                @click="setDueDate('today')"
              >
                ☀️ Today
              </button>
              <button
                class="pill"
                :class="{ active: isTomorrow }"
                @click="setDueDate('tomorrow')"
              >
                🌅 Tmrw
              </button>
              <button
                class="pill"
                @click="setDueDate('in3days')"
              >
                📅 +3d
              </button>
              <button
                class="pill"
                :class="{ active: isWeekend }"
                @click="setDueDate('weekend')"
              >
                🏖️ Wknd
              </button>
              <button
                class="pill"
                @click="setDueDate('nextweek')"
              >
                📆 +1wk
              </button>
              <button
                class="pill"
                @click="setDueDate('1month')"
              >
                🗓️ +1mo
              </button>
              <button
                class="pill clear"
                @click="setDueDate('clear')"
              >
                <X :size="14" />
              </button>
            </div>
          </div>

          <!-- Action Buttons - Four options: Done, Save, Assign, Delete -->
          <div class="action-row">
            <button class="action-btn done" @click="handleMarkDone">
              <CheckCircle :size="20" />
              <span>Done</span>
            </button>
            <button class="action-btn save" @click="handleSave">
              <Save :size="20" />
              <span>Save</span>
              <span v-if="isTaskDirty" class="dirty-dot" />
            </button>
            <button class="action-btn assign" @click="showProjectSheet = true">
              <FolderOpen :size="20" />
              <span>Assign</span>
            </button>
            <button class="action-btn delete" @click="showDeleteConfirm = true">
              <Trash2 :size="20" />
            </button>
          </div>
        </div>
      </div>

      <!-- COMPLETION CELEBRATION -->
      <div v-else class="completion-phase">
        <div class="celebration-container">
          <div ref="confettiRef" class="confetti-burst" />

          <div class="celebration-icon">
            <PartyPopper :size="80" />
          </div>

          <h2 class="celebration-title">
            All Sorted!
          </h2>
          <p class="celebration-subtitle">
            You've processed all your tasks
          </p>

          <div v-if="sessionSummary" class="session-summary">
            <div class="summary-stat">
              <span class="stat-number">{{ sessionSummary.tasksProcessed }}</span>
              <span class="stat-label">Tasks</span>
            </div>
            <div class="summary-stat">
              <span class="stat-number">{{ formatDuration(sessionSummary.timeSpent) }}</span>
              <span class="stat-label">Time</span>
            </div>
            <div v-if="sessionSummary.efficiency > 0" class="summary-stat">
              <span class="stat-number">{{ sessionSummary.efficiency.toFixed(1) }}</span>
              <span class="stat-label">Tasks/min</span>
            </div>
          </div>

          <button class="return-btn" @click="handleExit">
            <ArrowLeft :size="20" />
            Return to Tasks
          </button>
        </div>
      </div>
    </main>

    <!-- Project Selector Bottom Sheet -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="showProjectSheet" class="sheet-overlay" @click="showProjectSheet = false; projectSearch = ''">
          <div class="project-sheet" @click.stop>
            <div class="sheet-handle" />
            <h3 class="sheet-title">
              Where does this belong?
            </h3>

            <!-- Search Input (sticky) -->
            <div class="project-search-wrapper">
              <Search :size="16" class="search-icon" />
              <input
                v-model="projectSearch"
                type="text"
                class="project-search"
                placeholder="Search projects..."
              >
            </div>

            <div class="project-list">
              <!-- Keep in Inbox option - allows sorting without project assignment -->
              <button
                v-if="!projectSearch"
                class="project-option inbox-option"
                @click="handleSortWithoutProject"
              >
                <span class="project-indicator inbox-indicator">
                  📥
                </span>
                <span class="project-name">Keep in Inbox</span>
                <span class="option-hint">Sort without assigning</span>
              </button>

              <!-- Recent Projects (if no search and has recents) -->
              <div v-if="!projectSearch && recentProjects.length > 0" class="recent-projects-section">
                <span class="section-label">Recent</span>
                <div class="recent-projects-grid">
                  <button
                    v-for="project in recentProjects"
                    :key="project.id"
                    class="recent-project-chip"
                    @click="handleAssignProject(project.id)"
                  >
                    <span class="chip-emoji">{{ project.emoji || project.name.charAt(0) }}</span>
                    <span class="chip-name">{{ project.name }}</span>
                  </button>
                </div>
              </div>

              <div v-if="!projectSearch" class="project-divider">
                <span>{{ recentProjects.length > 0 ? 'All projects' : 'Or assign to project' }}</span>
              </div>

              <!-- Filtered/All Projects List -->
              <button
                v-for="{ project, depth } in filteredProjects"
                :key="project.id"
                class="project-option"
                :style="{ paddingLeft: `${16 + Math.min(depth, 2) * 24}px` }"
                @click="handleAssignProject(project.id)"
              >
                <span v-if="depth > 0" class="hierarchy-line" :style="{ width: `${Math.min(depth, 2) * 24}px` }">
                  <span class="hierarchy-connector" />
                </span>
                <span
                  class="project-indicator"
                  :style="{ backgroundColor: Array.isArray(project.color) ? project.color[0] : project.color }"
                >
                  {{ project.emoji || project.name.charAt(0) }}
                </span>
                <span class="project-name">{{ project.name }}</span>
                <span v-if="depth > 2" class="depth-indicator">+{{ depth - 2 }}</span>
              </button>

              <!-- No results message -->
              <div v-if="projectSearch && filteredProjects.length === 0" class="no-results">
                No projects match "{{ projectSearch }}"
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteConfirm" class="confirm-overlay">
          <div class="confirm-modal">
            <Trash2 :size="32" class="confirm-icon" />
            <h3>Delete this task?</h3>
            <p>This action cannot be undone</p>
            <div class="confirm-actions">
              <button class="cancel-btn" @click="cancelDelete">
                Cancel
              </button>
              <button class="delete-btn" @click="confirmDelete">
                Delete
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Quick Edit Panel -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="showQuickEditPanel" class="sheet-overlay" @click="showQuickEditPanel = false">
          <div class="quick-edit-sheet" @click.stop>
            <div class="sheet-handle" />
            <h3 class="sheet-title">
              Quick Edit
            </h3>

            <!-- Priority Section -->
            <div class="edit-section">
              <span class="edit-label">Priority</span>
              <div class="priority-pills">
                <button class="pill" :class="{ active: currentTask?.priority === 'low' }" @click="setPriorityAndClose('low')">
                  Low
                </button>
                <button class="pill" :class="{ active: currentTask?.priority === 'medium' }" @click="setPriorityAndClose('medium')">
                  Med
                </button>
                <button class="pill" :class="{ active: currentTask?.priority === 'high' }" @click="setPriorityAndClose('high')">
                  High
                </button>
              </div>
            </div>

            <!-- Date Section -->
            <div class="edit-section">
              <span class="edit-label">Due Date</span>
              <div class="date-pills">
                <button class="pill" @click="setDueDateAndClose('today')">
                  Today
                </button>
                <button class="pill" @click="setDueDateAndClose('tomorrow')">
                  Tmrw
                </button>
                <button class="pill" @click="setDueDateAndClose('in3days')">
                  +3d
                </button>
                <button class="pill" @click="setDueDateAndClose('weekend')">
                  Wknd
                </button>
              </div>
            </div>

            <!-- Assign to Project button -->
            <button class="assign-project-btn" @click="openProjectSheet">
              <FolderOpen :size="20" />
              Assign to Project
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Celebration Overlay -->
    <Transition name="celebration">
      <div v-if="showCelebration" class="mini-celebration">
        <CheckCircle :size="32" />
        <span>Sorted!</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import {
  Zap, X, Plus, CheckCircle, Calendar, CalendarPlus, CalendarDays, Flag,
  ChevronLeft, ChevronRight, SkipForward, PartyPopper,
  ArrowLeft, Trash2, Edit3, FolderOpen, Search, Save
} from 'lucide-vue-next'
import { useQuickSort } from '@/composables/useQuickSort'
import { useSwipeGestures } from '@/composables/useSwipeGestures'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import type { Task } from '@/types/tasks'
import type { SessionSummary } from '@/stores/quickSort'

const router = useRouter()
const taskStore = useTaskStore()
const projectStore = useProjectStore()

// Quick Sort composable
const {
  currentTask,
  currentTaskId,
  uncategorizedTasks,
  progress,
  isComplete,
  isTaskDirty,
  startSession,
  endSession,
  categorizeTask,
  saveTask,
  markTaskDone,
  markDoneAndDeleteTask,
  skipTask,
  undoLastCategorization
} = useQuickSort()

// UI State
const activePhase = ref<'sort' | 'capture'>('sort')
const showProjectSheet = ref(false)
const showCelebration = ref(false)
const hasSwipedOnce = ref(false)
const sessionSummary = ref<SessionSummary | null>(null)
const showDeleteConfirm = ref(false)
const showQuickEditPanel = ref(false)

// Capture phase state
const newTaskTitle = ref('')
const newTaskPriority = ref<'low' | 'medium' | 'high' | undefined>()
const newTaskDue = ref<'today' | 'tomorrow' | undefined>()
const recentlyAdded = ref<Task[]>([])
const captureInputRef = ref<HTMLInputElement | null>(null)

// Project picker state
const projectSearch = ref('')
const recentProjectIds = useLocalStorage<string[]>('quicksort-recent-projects', [])

// Card and swipe refs
const cardRef = ref<HTMLElement | null>(null)
const confettiRef = ref<HTMLElement | null>(null)

// Projects - hierarchical structure for nested display
const rootProjects = computed(() => projectStore.rootProjects)

// Build flat list with hierarchy info for display
interface ProjectWithDepth {
  project: typeof projectStore.projects[number]
  depth: number
}

const projectsWithDepth = computed(() => {
  const result: ProjectWithDepth[] = []

  const addProjectWithChildren = (project: typeof projectStore.projects[number], depth: number) => {
    result.push({ project, depth })
    const children = projectStore.getChildProjects(project.id)
    for (const child of children) {
      addProjectWithChildren(child, depth + 1)
    }
  }

  // Start from root projects
  for (const rootProject of rootProjects.value) {
    addProjectWithChildren(rootProject, 0)
  }

  return result
})

// Recent projects (last 4 used)
const recentProjects = computed(() =>
  recentProjectIds.value
    .slice(0, 4)
    .map(id => projectStore.projects.find(p => p.id === id))
    .filter((p): p is typeof projectStore.projects[number] => Boolean(p))
)

// Filtered projects for search
const filteredProjects = computed(() => {
  if (!projectSearch.value.trim()) return projectsWithDepth.value
  const search = projectSearch.value.toLowerCase()
  return projectsWithDepth.value.filter(({ project }) =>
    project.name.toLowerCase().includes(search)
  )
})

// Uncategorized count
const uncategorizedCount = computed(() => uncategorizedTasks.value.length)

// Stack preview (next 2 tasks)
const stackPreview = computed(() => {
  return uncategorizedTasks.value.slice(1, 3)
})

// Swipe gesture handling
const {
  swipeState,
  deltaX,
  progress: swipeProgress,
  direction: swipeDirection,
  triggerHaptic
} = useSwipeGestures(cardRef, {
  threshold: 120,
  velocityThreshold: 0.4,
  haptics: true,
  onSwipeRight: () => {
    hasSwipedOnce.value = true
    // Swipe right = Exit Quick Sort
    handleExit()
  },
  onSwipeLeft: () => {
    hasSwipedOnce.value = true
    // Swipe left = Skip to next task
    handleSkip()
  },
  onSwipeEnd: () => {
    // Reset card position handled by transition
  }
})

// Card transform style
const cardStyle = computed(() => {
  if (!swipeState.value.isSwiping) {
    return {
      transform: 'translateX(0) rotate(0deg)',
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }
  }

  const rotate = deltaX.value * 0.05
  const maxRotate = 15
  const clampedRotate = Math.max(-maxRotate, Math.min(maxRotate, rotate))

  return {
    transform: `translateX(${deltaX.value}px) rotate(${clampedRotate}deg)`,
    transition: 'none'
  }
})

// Overlay opacities
const leftOverlayOpacity = computed(() => {
  if (deltaX.value >= 0) return 0
  return Math.min(Math.abs(deltaX.value) / 120, 1) * 0.9
})

const rightOverlayOpacity = computed(() => {
  if (deltaX.value <= 0) return 0
  return Math.min(deltaX.value / 120, 1) * 0.9
})

// Content blur effect when swiping
const contentBlurStyle = computed(() => {
  const progress = Math.min(Math.abs(deltaX.value) / 100, 1)
  if (progress < 0.1) {
    return { filter: 'none', opacity: 1 }
  }
  const blurAmount = progress * 6 // Max 6px blur
  const dimAmount = 1 - (progress * 0.4) // Dim to 60%
  return {
    filter: `blur(${blurAmount}px)`,
    opacity: dimAmount,
    transition: swipeState.value.isSwiping ? 'none' : 'filter 0.2s ease, opacity 0.2s ease'
  }
})

// Date detection
const isToday = computed(() => {
  if (!currentTask.value?.dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const taskDate = new Date(currentTask.value.dueDate)
  taskDate.setHours(0, 0, 0, 0)
  return taskDate.getTime() === today.getTime()
})

const isTomorrow = computed(() => {
  if (!currentTask.value?.dueDate) return false
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const taskDate = new Date(currentTask.value.dueDate)
  taskDate.setHours(0, 0, 0, 0)
  return taskDate.getTime() === tomorrow.getTime()
})

const isWeekend = computed(() => {
  if (!currentTask.value?.dueDate) return false
  // Don't highlight Weekend if Today or Tomorrow is already active
  if (isToday.value || isTomorrow.value) return false
  const taskDate = new Date(currentTask.value.dueDate)
  const dayOfWeek = taskDate.getDay()
  return dayOfWeek === 0 || dayOfWeek === 6
})

// Actions
async function handleQuickAdd() {
  if (!newTaskTitle.value.trim()) return

  let dueDate: string | undefined
  if (newTaskDue.value === 'today') {
    dueDate = new Date().toISOString()
  } else if (newTaskDue.value === 'tomorrow') {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    dueDate = tomorrow.toISOString()
  }

  const newTask = await taskStore.createTask({
    title: newTaskTitle.value.trim(),
    priority: newTaskPriority.value,
    dueDate
  })

  // Add to recently added
  recentlyAdded.value.unshift(newTask)
  if (recentlyAdded.value.length > 5) {
    recentlyAdded.value.pop()
  }

  // Reset form
  newTaskTitle.value = ''
  newTaskPriority.value = undefined
  newTaskDue.value = undefined

  // Haptic feedback
  triggerHaptic('medium')

  // Refocus input
  nextTick(() => {
    captureInputRef.value?.focus()
  })
}

function handleAssignProject(projectId: string) {
  if (!currentTask.value) return

  // Track as recent project (dedupe, limit 10)
  recentProjectIds.value = [
    projectId,
    ...recentProjectIds.value.filter(id => id !== projectId)
  ].slice(0, 10)

  categorizeTask(currentTask.value.id, projectId)
  showProjectSheet.value = false
  projectSearch.value = '' // Reset search

  // NO celebration, NO auto-advance - task stays for further edits
  triggerHaptic('medium')
}

// Sort task without assigning to a project (keep in inbox)
function handleSortWithoutProject() {
  if (!currentTask.value) return
  categorizeTask(currentTask.value.id, '')
  showProjectSheet.value = false
  projectSearch.value = '' // Reset search
  // NO celebration, NO auto-advance - task stays for further edits
  triggerHaptic('medium')
}

function handleSkip() {
  skipTask()
  triggerHaptic('light')
}

function handleSave() {
  if (!currentTask.value) return
  saveTask()

  showCelebration.value = true
  setTimeout(() => {
    showCelebration.value = false
  }, 600)

  triggerHaptic('heavy')
}

function handleMarkDone() {
  if (!currentTask.value) return
  markTaskDone(currentTask.value.id)

  showCelebration.value = true
  setTimeout(() => {
    showCelebration.value = false
  }, 600)

  triggerHaptic('heavy')
}

async function setPriority(priority: 'low' | 'medium' | 'high') {
  if (!currentTask.value) return
  // AWAIT to ensure persistence before UI updates (BUG-1051)
  await taskStore.updateTask(currentTask.value.id, { priority })
  triggerHaptic('light')
}

async function setDueDate(preset: 'today' | 'tomorrow' | 'in3days' | 'weekend' | 'nextweek' | '1month' | 'clear') {
  if (!currentTask.value) return

  let dueDate: string | undefined
  const now = new Date()

  if (preset === 'today') {
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    dueDate = today.toISOString()
  } else if (preset === 'tomorrow') {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    dueDate = tomorrow.toISOString()
  } else if (preset === 'in3days') {
    const date = new Date(now)
    date.setDate(date.getDate() + 3)
    date.setHours(0, 0, 0, 0)
    dueDate = date.toISOString()
  } else if (preset === 'weekend') {
    const dayOfWeek = now.getDay()
    const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7
    const saturday = new Date(now)
    saturday.setDate(now.getDate() + (daysUntilSaturday || 7))
    saturday.setHours(0, 0, 0, 0)
    dueDate = saturday.toISOString()
  } else if (preset === 'nextweek') {
    const date = new Date(now)
    date.setDate(date.getDate() + 7)
    date.setHours(0, 0, 0, 0)
    dueDate = date.toISOString()
  } else if (preset === '1month') {
    const date = new Date(now)
    date.setMonth(date.getMonth() + 1)
    date.setHours(0, 0, 0, 0)
    dueDate = date.toISOString()
  } else {
    dueDate = undefined
  }

  // AWAIT to ensure persistence before UI updates (BUG-1051)
  await taskStore.updateTask(currentTask.value.id, { dueDate: dueDate || '' })
  triggerHaptic('light')
}

function handleExit() {
  router.push('/tasks')
}

function cancelDelete() {
  showDeleteConfirm.value = false
}

async function confirmDelete() {
  if (!currentTask.value) return
  // Use QuickSort's delete function which properly handles the flow (advances to next task, records action)
  // Must await so the task is removed before closing the dialog
  await markDoneAndDeleteTask(currentTask.value.id)
  showDeleteConfirm.value = false
  triggerHaptic('heavy')
}

function setPriorityAndClose(priority: 'low' | 'medium' | 'high') {
  setPriority(priority)
  showQuickEditPanel.value = false
}

function setDueDateAndClose(preset: 'today' | 'tomorrow' | 'in3days' | 'weekend' | 'nextweek' | '1month' | 'clear') {
  setDueDate(preset)
  showQuickEditPanel.value = false
}

function openProjectSheet() {
  showQuickEditPanel.value = false
  showProjectSheet.value = true
}

function truncateDescription(desc: string): string {
  if (desc.length <= 120) return desc
  return desc.slice(0, 120) + '...'
}

function formatDueDate(date: string): string {
  const d = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  d.setHours(0, 0, 0, 0)

  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes === 0) return `${remainingSeconds}s`
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// Task context computed properties (reactive to task changes)
const taskDueDate = computed(() => {
  if (!currentTask.value?.dueDate) return null
  const d = new Date(currentTask.value.dueDate)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const taskDate = new Date(d)
  taskDate.setHours(0, 0, 0, 0)
  const diffDays = Math.round((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
})

const isTaskOverdue = computed(() => {
  if (!currentTask.value?.dueDate) return false
  const d = new Date(currentTask.value.dueDate)
  if (isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return d.getTime() < today.getTime()
})

const currentTaskProject = computed(() => {
  if (!currentTask.value?.projectId) return null
  return projectStore.projects.find(p => p.id === currentTask.value!.projectId)
})

// Watch for completion
watch(isComplete, (completed) => {
  if (completed) {
    const summary = endSession()
    sessionSummary.value = summary || null
  }
})

// Lifecycle
onMounted(() => {
  startSession()
})
</script>

<style scoped>
/* ================================
   MOBILE QUICK SORT - "DECISIVE FLOW"
   Neo-brutalist meets fluid glass
   ================================ */

.mobile-quick-sort {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100vh;
  height: 100dvh; /* Dynamic viewport height - accounts for iOS browser chrome */
  display: flex;
  flex-direction: column;
  background: var(--app-background-gradient);
  color: var(--text-primary);
  overflow: hidden;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Grain texture overlay */
.grain-overlay {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: var(--z-base);
}

/* ================================
   HEADER
   ================================ */

.qs-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  padding-top: calc(var(--space-4) + env(safe-area-inset-top));
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-lg));
  -webkit-backdrop-filter: blur(var(--blur-lg));
  border-bottom: 1px solid var(--glass-border-light);
  z-index: var(--z-sticky);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--dropdown-trigger-height);
  height: var(--dropdown-trigger-height);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.back-btn:active {
  transform: scale(0.95);
  background: var(--glass-bg-light);
}

.header-content {
  flex: 1;
}

.qs-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  margin: 0;
  letter-spacing: -0.02em;
}

.zap-icon {
  color: var(--brand-primary);
}

.qs-subtitle {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-1) 0 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.header-stats {
  display: flex;
  align-items: center;
}

.stat-badge {
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* ================================
   PROGRESS BAR
   ================================ */

.progress-track {
  position: relative;
  height: 3px;
  background: var(--glass-bg-weak);
  z-index: var(--z-sticky);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-primary), hsl(174, 80%, 60%));
  transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.progress-glow {
  position: absolute;
  top: 50%;
  width: var(--space-5);
  height: var(--space-5);
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  filter: blur(var(--blur-sm));
  transform: translate(-50%, -50%);
  transition: left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ================================
   PHASE TOGGLE
   ================================ */

.phase-toggle {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  z-index: var(--z-sticky);
}

.phase-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-4);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.phase-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.phase-btn:active {
  transform: scale(0.98);
}

.count-badge {
  padding: var(--space-0_5) var(--space-2);
  background: var(--glass-border-hover);
  color: var(--text-primary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  min-width: 1.5rem;
  text-align: center;
}

/* When Sort tab is active, make badge more prominent */
.phase-btn.active .count-badge {
  background: var(--overlay-component-bg-lighter);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
}

/* ================================
   TASK CONTEXT BAR (REACTIVE)
   ================================ */

.task-context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1_5);
  padding: var(--space-2_5) var(--space-4);
  margin: 0 var(--space-5);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  z-index: var(--z-sticky);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.context-item {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.context-item:first-child {
  justify-content: flex-start;
}

.context-item:last-child {
  justify-content: flex-end;
}

.context-divider {
  width: 1px;
  height: var(--space-3);
  background: var(--border-subtle);
  opacity: 0.5;
}

.context-empty {
  color: var(--text-muted);
  opacity: 0.6;
}

.overdue-text {
  color: var(--color-priority-high);
  font-weight: var(--font-semibold);
}

.priority-indicator {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.priority-indicator.priority-high {
  background: var(--color-priority-high);
}

.priority-indicator.priority-medium {
  background: var(--color-priority-medium);
}

.priority-indicator.priority-low {
  background: var(--color-priority-low);
}

.priority-indicator.priority-none {
  background: var(--text-muted);
  opacity: 0.3;
}

.project-text {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-emoji {
  font-size: var(--text-sm);
  line-height: 1;
}

/* ================================
   MAIN CONTENT
   ================================ */

.qs-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: var(--z-base);
}

/* ================================
   CAPTURE PHASE
   ================================ */

.capture-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-5);
  overflow-y: auto;
}

.capture-input-area {
  margin-bottom: var(--space-6);
}

.capture-card {
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  padding: var(--space-5);
}

.capture-input {
  width: 100%;
  padding: var(--space-4);
  background: var(--overlay-component-bg-lighter);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  outline: none;
  transition: all var(--duration-normal) ease;
}

.capture-input::placeholder {
  color: var(--text-muted);
}

.capture-input:focus {
  border-color: var(--state-hover-border);
  box-shadow: 0 0 0 3px var(--state-hover-bg);
}

.quick-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
  flex-wrap: wrap;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.quick-action-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.quick-action-btn:active {
  transform: scale(0.95);
}

.priority-high {
  color: var(--color-priority-high);
}

.add-task-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: transparent;
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-base);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-task-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-task-btn:not(:disabled):active {
  transform: scale(0.98);
}

/* Recently Added */
.recently-added {
  flex: 1;
}

.section-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--space-3);
}

.recent-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-bg-weak);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-2);
}

.check-icon {
  color: var(--color-success);
}

.recent-title {
  flex: 1;
  font-size: var(--text-base);
  color: var(--text-secondary);
}

/* Task list transitions */
.task-list-enter-active {
  transition: all var(--duration-slow) ease;
}

.task-list-leave-active {
  transition: all var(--duration-normal) ease;
}

.task-list-enter-from {
  opacity: 0;
  transform: translateY(calc(-1 * var(--space-2_5)));
}

.task-list-leave-to {
  opacity: 0;
  transform: translateX(calc(-1 * var(--space-5)));
}

/* ================================
   SORT PHASE
   ================================ */

.sort-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-4);
  padding-bottom: 0;
  overflow: hidden;
  min-height: 0; /* Allow flex shrinking */
}

/* Process Flow Indicator - Shows sorting hierarchy */
.process-flow-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  margin-bottom: var(--space-3);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border-light);
}

.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
  opacity: 0.5;
  transition: all var(--duration-normal) ease;
}

.flow-step.active {
  opacity: 1;
}

.flow-step.active .flow-label {
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.flow-icon {
  font-size: var(--text-base);
}

.flow-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.flow-arrow {
  color: var(--text-muted);
  font-size: var(--text-xs);
  opacity: 0.3;
}

/* Swipe hints */
.swipe-hints {
  display: flex;
  justify-content: space-between;
  padding: 0 var(--space-4);
  margin-bottom: var(--space-4);
  animation: fadeInOut 3s ease-in-out infinite;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.hint {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Card Stack */
.card-stack {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1000px;
  min-height: var(--kanban-column-min-height);
  max-height: 320px;
}

.stack-card {
  position: absolute;
  width: 92%;
  max-width: 360px;
  height: 240px;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-2xl);
}

/* Main Task Card */
.task-card {
  position: relative;
  width: 92%;
  max-width: 360px;
  min-height: 180px;
  max-height: 260px;
  background: linear-gradient(
    145deg,
    var(--canvas-task-bg),
    var(--surface-secondary)
  );
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  box-shadow:
    var(--shadow-2xl),
    var(--shadow-dark-lg),
    inset 0 1px 0 var(--glass-bg-weak);
  z-index: var(--z-sticky);
  touch-action: pan-y;
  user-select: none;
  overflow: hidden;
}

.task-card.swiping {
  cursor: grabbing;
}

/* Swipe Indicators */
.swipe-indicator {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-2xl);
  pointer-events: none;
  transition: opacity var(--duration-instant) ease;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-sticky); /* Above blurred content */
}

/* Left swipe = Skip (muted) */
.swipe-indicator.left {
  border: 3px solid var(--glass-border-hover);
  background: var(--glass-bg-medium);
}

/* Right swipe = Exit (muted) */
.swipe-indicator.right {
  border: 3px solid var(--glass-border-hover);
  background: var(--glass-bg-medium);
}

.swipe-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: inherit;
}

/* Left swipe content = Skip (muted) */
.swipe-indicator.left .swipe-content {
  color: var(--text-secondary);
}

/* Right swipe content = Exit (muted) */
.swipe-indicator.right .swipe-content {
  color: var(--text-secondary);
}

.swipe-content span {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Card Content */
.card-content {
  position: relative;
  padding: var(--space-6);
  padding-bottom: var(--space-8);
  height: 100%;
  display: flex;
  flex-direction: column;
  z-index: 1; /* Below swipe indicators */
  will-change: filter, opacity;
}

.priority-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--space-1);
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
}

.priority-strip.priority-high {
  background: linear-gradient(90deg, var(--color-priority-high), hsl(0, 90%, 65%));
}

.priority-strip.priority-medium {
  background: linear-gradient(90deg, var(--color-priority-medium), hsl(38, 95%, 55%));
}

.priority-strip.priority-low {
  background: linear-gradient(90deg, var(--color-priority-low), hsl(217, 95%, 65%));
}

.priority-strip.priority-none {
  background: transparent;
}

.task-title {
  font-size: 1.375rem; /* no-token */
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  margin: 0 0 var(--space-3);
  color: var(--text-primary);
  letter-spacing: -0.01em;
  overflow-wrap: anywhere; /* Break long URLs/strings that have no spaces */
  word-break: break-word;
  /* Hard height cap — reliable fallback for all browsers */
  max-height: 5.2em; /* ~3 lines at line-height 1.25 + small buffer */
  overflow: hidden;
  /* Progressive enhancement: show ellipsis where supported */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  /* RTL support */
  text-align: start;
  unicode-bidi: plaintext;
}

.task-description {
  flex: 1;
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
  margin: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.task-meta {
  display: flex;
  gap: var(--space-3);
  margin-top: auto;
  padding-top: var(--space-3);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-2_5);
  background: var(--glass-bg-weak);
  border-radius: var(--radius-md);
  font-size: var(--text-meta);
  color: var(--text-muted);
}

.meta-item.priority-high {
  color: var(--color-priority-high);
  background: var(--priority-high-bg);
}

.meta-item.priority-medium {
  color: var(--color-priority-medium);
  background: var(--priority-medium-bg);
}

.meta-item.priority-low {
  color: var(--color-priority-low);
  background: var(--priority-low-bg);
}

.capitalize {
  text-transform: capitalize;
}

/* ================================
   THUMB ZONE (Bottom Controls)
   ================================ */

.thumb-zone {
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom, var(--space-6)));
  background: linear-gradient(to top, var(--overlay-bg), var(--overlay-component-bg-lighter), transparent);
  margin-top: auto;
  flex-shrink: 0;
}

.quick-edit-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  margin-bottom: var(--space-2);
}

.edit-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  min-width: 52px;
}

.priority-pills,
.date-pills {
  display: flex;
  gap: var(--space-1_5);
  flex: 1;
}

.date-pills-scroll {
  display: flex;
  gap: var(--space-2_5);
  flex: 1;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 2px; /* Prevent cut-off on scroll */
  padding-inline-end: var(--space-4);
  scroll-snap-type: x proximity;
}

.date-pills-scroll::-webkit-scrollbar {
  display: none;
}

.date-row {
  overflow: visible;
}

.pill {
  flex: 0 0 auto;
  padding: var(--space-2) var(--space-2_5);
  min-height: var(--dropdown-trigger-height-compact);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
}

.priority-pills .pill {
  flex: 1;
}

.pill.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.pill.clear {
  flex: 0;
  padding: var(--space-2);
  color: var(--text-muted);
}

.pill:active {
  transform: scale(0.95);
}

/* Action Row - 4 buttons: Done, Save, Assign, Delete */
.action-row {
  display: flex;
  gap: var(--space-2);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
}

.action-btn {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5);
  padding: var(--space-2_5) var(--space-2);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.action-btn.done {
  color: var(--color-success);
  border-color: var(--success-border);
}

.action-btn.done:active {
  background: var(--success-bg-subtle);
}

.action-btn.assign {
  color: var(--brand-primary);
  border-color: var(--state-hover-border);
}

.action-btn.assign:active {
  background: var(--state-hover-bg);
}

.action-btn.save {
  color: var(--brand-primary);
  border-color: var(--state-hover-border);
  position: relative;
}

.action-btn.save:active {
  background: var(--state-hover-bg);
}

.dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  animation: dirty-pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes dirty-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

.action-btn.delete {
  flex: 0 0 auto;
  padding: var(--space-2_5);
  color: var(--color-danger);
  border-color: var(--danger-border-subtle);
}

.action-btn.delete:active {
  background: var(--danger-bg-subtle);
}

.action-btn:active {
  transform: scale(0.95);
}

/* ================================
   COMPLETION PHASE
   ================================ */

.completion-phase {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.celebration-container {
  text-align: center;
  max-width: 320px;
}

.confetti-burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.celebration-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, var(--state-active-bg), var(--state-hover-bg));
  border: var(--task-card-selection-border) solid var(--state-hover-border);
  border-radius: var(--radius-full);
  color: var(--brand-primary);
  margin-bottom: var(--space-6);
  animation: celebratePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes celebratePop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.celebration-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-2);
  background: linear-gradient(135deg, var(--brand-primary), hsl(174, 80%, 70%));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.celebration-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0 0 var(--space-8);
}

.session-summary {
  display: flex;
  justify-content: center;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-number {
  font-size: 1.75rem; /* no-token */
  font-weight: var(--font-bold);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.return-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.return-btn:active {
  transform: scale(0.98);
  background: var(--glass-bg-light);
}

/* ================================
   PROJECT SHEET
   ================================ */

.sheet-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  display: flex;
  align-items: flex-end;
  z-index: var(--z-dropdown);
}

.project-sheet {
  width: 100%;
  max-height: 70vh;
  background: var(--surface-primary);
  border-top-left-radius: var(--radius-2xl);
  border-top-right-radius: var(--radius-2xl);
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.sheet-handle {
  width: var(--dropdown-trigger-height-compact);
  height: var(--space-1);
  background: var(--glass-border-strong);
  border-radius: var(--radius-full);
  margin: 0 auto var(--space-5);
}

.sheet-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-4);
  text-align: center;
}

/* Project Search */
.project-search-wrapper {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  z-index: var(--z-base);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.project-search {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-base);
  outline: none;
}

.project-search::placeholder {
  color: var(--text-muted);
}

/* Recent Projects Section */
.recent-projects-section {
  margin-bottom: var(--space-3);
}

.section-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-2);
}

.recent-projects-grid {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: var(--space-1);
}

.recent-projects-grid::-webkit-scrollbar {
  display: none;
}

.recent-project-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--brand-bg-subtle);
  border: 1px solid var(--brand-border-subtle);
  border-radius: var(--radius-full);
  color: var(--text-primary);
  font-size: var(--text-meta);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
  white-space: nowrap;
  box-shadow: var(--shadow-xs);
}

.recent-project-chip:active {
  transform: scale(0.95);
  background: var(--state-active-bg);
  box-shadow: var(--shadow-sm);
}

.chip-emoji {
  font-size: var(--text-base);
}

.chip-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Depth indicator for deeply nested items */
.depth-indicator {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-weak);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  margin-left: auto;
}

/* No results message */
.no-results {
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-lg);
  margin: var(--space-4) 0;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.project-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-xl);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

.hierarchy-line {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  height: 100%;
  display: flex;
  align-items: center;
}

.hierarchy-connector {
  width: var(--space-3);
  height: 1px;
  background: var(--border-subtle);
  margin-left: auto;
  border-radius: 1px;
}

.project-option:active {
  background: var(--glass-bg-light);
  transform: scale(0.98);
}

.project-indicator {
  width: var(--project-indicator-size-md);
  height: var(--project-indicator-size-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  font-size: var(--text-xl);
}

.project-name {
  flex: 1;
  text-align: left;
}

/* Inbox option - special styling */
.inbox-option {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
  flex-wrap: wrap;
}

.inbox-indicator {
  background: transparent !important;
}

.option-hint {
  width: 100%;
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--space-1);
  padding-left: calc(var(--project-indicator-size-md) + var(--space-3));
}

/* Project divider */
.project-divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-4) 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.project-divider::before,
.project-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}

/* Sheet transition */
.sheet-enter-active,
.sheet-leave-active {
  transition: all var(--duration-slow) cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .project-sheet,
.sheet-leave-to .project-sheet {
  transform: translateY(100%);
}

/* ================================
   MINI CELEBRATION
   ================================ */

.mini-celebration {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-8);
  background: var(--success-border-active);
  border-radius: var(--radius-2xl);
  color: white;
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  z-index: var(--z-modal);
  pointer-events: none;
}

.celebration-enter-active {
  animation: miniCelebrate 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.celebration-leave-active {
  animation: miniCelebrate var(--duration-slow) ease reverse;
}

@keyframes miniCelebrate {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  50% { transform: translate(-50%, -50%) scale(1.1); }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

/* ================================
   DELETE CONFIRMATION MODAL
   ================================ */

.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-dark);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.confirm-modal {
  background: linear-gradient(145deg, var(--canvas-task-bg), var(--surface-secondary));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  text-align: center;
  max-width: 320px;
  margin: var(--space-4);
}

.confirm-icon {
  color: var(--color-danger);
  margin: 0 auto var(--space-4);
}

.confirm-modal h3 {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-2);
}

.confirm-modal p {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-6);
}

.confirm-actions {
  display: flex;
  gap: var(--space-3);
}

.confirm-actions button {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.cancel-btn {
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.cancel-btn:active {
  background: var(--glass-bg-light);
}

.delete-btn {
  background: var(--color-danger);
  border: none;
  color: white;
}

.delete-btn:active {
  opacity: 0.9;
  transform: scale(0.98);
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all var(--duration-normal) ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .confirm-modal,
.modal-leave-to .confirm-modal {
  transform: scale(0.95);
}

/* ================================
   QUICK EDIT PANEL
   ================================ */

.quick-edit-sheet {
  width: 100%;
  max-height: 60vh;
  background: linear-gradient(
    180deg,
    hsl(240, 20%, 12%) 0%,
    hsl(240, 18%, 10%) 100%
  );
  border-top-left-radius: var(--radius-2xl);
  border-top-right-radius: var(--radius-2xl);
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
}

.edit-section {
  margin-bottom: var(--space-5);
}

.edit-section .edit-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-2);
}

.edit-section .priority-pills,
.edit-section .date-pills {
  display: flex;
  gap: var(--space-2);
}

.edit-section .pill {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.edit-section .pill.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.edit-section .pill:active {
  transform: scale(0.98);
}

.assign-project-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--state-hover-bg);
  border: 1px solid var(--state-hover-border);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
  margin-top: var(--space-4);
}

.assign-project-btn:active {
  background: var(--state-active-bg);
  transform: scale(0.98);
}

/* ================================
   SMALL SCREEN ADAPTATIONS
   ================================ */

@media (max-height: 700px) {
  .card-stack {
    max-height: 200px;
    min-height: 160px;
  }

  .task-card {
    max-height: 180px;
    min-height: 140px;
  }

  .stack-card {
    height: 160px;
  }

  .card-content {
    padding: var(--space-4);
    padding-bottom: var(--space-5);
  }

  .task-title {
    font-size: var(--text-lg);
    max-height: 3.8em; /* ~3 lines */
    -webkit-line-clamp: 2;
  }

  .process-flow-indicator {
    display: none;
  }
}

/* ================================
   ACCESSIBILITY - REDUCED MOTION
   ================================ */

@media (prefers-reduced-motion: reduce) {
  .task-card,
  .progress-fill,
  .progress-glow,
  .celebration-icon,
  .mini-celebration,
  .dirty-dot {
    animation: none !important;
    transition: none !important;
  }

  .swipe-hints {
    animation: none;
    opacity: 0.5;
  }
}

/* ================================
   RTL LAYOUT SUPPORT
   ================================ */

[dir="rtl"] .qs-header {
  flex-direction: row-reverse;
}

[dir="rtl"] .header-content {
  text-align: right;
}

[dir="rtl"] .qs-title {
  flex-direction: row-reverse;
}

[dir="rtl"] .card-content {
  text-align: right;
}

[dir="rtl"] .task-meta {
  flex-direction: row-reverse;
}

[dir="rtl"] .meta-item {
  flex-direction: row-reverse;
}

[dir="rtl"] .quick-edit-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .priority-pills,
[dir="rtl"] .date-pills,
[dir="rtl"] .date-pills-scroll {
  flex-direction: row-reverse;
}

[dir="rtl"] .action-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .action-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .quick-actions {
  flex-direction: row-reverse;
}

[dir="rtl"] .quick-action-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .recent-item {
  flex-direction: row-reverse;
}

[dir="rtl"] .capture-input {
  text-align: right;
  direction: rtl;
}

[dir="rtl"] .project-option {
  flex-direction: row-reverse;
}

[dir="rtl"] .project-name {
  text-align: right;
}

[dir="rtl"] .swipe-hints {
  flex-direction: row-reverse;
}

[dir="rtl"] .hint-left {
  flex-direction: row-reverse;
}

[dir="rtl"] .hint-right {
  flex-direction: row-reverse;
}

[dir="rtl"] .phase-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .add-task-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .return-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .assign-project-btn {
  flex-direction: row-reverse;
}
</style>
