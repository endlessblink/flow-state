<template>
  <div class="mobile-quick-sort">
    <!-- Grain Texture Overlay -->
    <div class="grain-overlay" aria-hidden="true"></div>

    <!-- Header -->
    <header class="qs-header">
      <button class="back-btn" @click="handleExit" aria-label="Exit Quick Sort">
        <X :size="24" />
      </button>
      <div class="header-content">
        <h1 class="qs-title">
          <Zap :size="20" class="zap-icon" />
          <span>Quick Sort</span>
        </h1>
        <p class="qs-subtitle">{{ activePhase === 'capture' ? 'Capture' : 'Swipe to sort' }}</p>
      </div>
      <div class="header-stats">
        <span class="stat-badge">{{ progress.current }}/{{ progress.total }}</span>
      </div>
    </header>

    <!-- Progress Bar -->
    <div class="progress-track" v-if="!isComplete && activePhase === 'sort'">
      <div
        class="progress-fill"
        :style="{ width: `${progress.percentage}%` }"
      ></div>
      <div class="progress-glow" :style="{ left: `${progress.percentage}%` }"></div>
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
              @keydown.enter="handleQuickAdd"
              autofocus
            />

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
          <h3 class="section-title">Just Added</h3>
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
        <!-- Swipe Instructions -->
        <div class="swipe-hints" v-if="!hasSwipedOnce">
          <div class="hint hint-left">
            <ChevronLeft :size="24" />
            <span>Delete</span>
          </div>
          <div class="hint hint-right">
            <span>Edit</span>
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
          ></div>

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
            <!-- Swipe Indicators -->
            <div
              class="swipe-indicator left"
              :style="{ opacity: leftOverlayOpacity }"
            >
              <div class="swipe-content">
                <Trash2 :size="32" />
                <span>Delete</span>
              </div>
            </div>
            <div
              class="swipe-indicator right"
              :style="{ opacity: rightOverlayOpacity }"
            >
              <div class="swipe-content">
                <Edit3 :size="32" />
                <span>Edit</span>
              </div>
            </div>

            <!-- Card Content -->
            <div class="card-content" v-if="currentTask">
              <!-- Priority Indicator -->
              <div
                class="priority-strip"
                :class="`priority-${currentTask.priority || 'none'}`"
              ></div>

              <h2 class="task-title">{{ currentTask.title }}</h2>

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
              >Low</button>
              <button
                class="pill"
                :class="{ active: currentTask?.priority === 'medium' }"
                @click="setPriority('medium')"
              >Med</button>
              <button
                class="pill"
                :class="{ active: currentTask?.priority === 'high' }"
                @click="setPriority('high')"
              >High</button>
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
              >Today</button>
              <button
                class="pill"
                :class="{ active: isTomorrow }"
                @click="setDueDate('tomorrow')"
              >Tmrw</button>
              <button
                class="pill"
                @click="setDueDate('in3days')"
              >+3d</button>
              <button
                class="pill"
                :class="{ active: isWeekend }"
                @click="setDueDate('weekend')"
              >Wknd</button>
              <button
                class="pill"
                @click="setDueDate('nextweek')"
              >+1wk</button>
              <button
                class="pill"
                @click="setDueDate('1month')"
              >+1mo</button>
              <button
                class="pill clear"
                @click="setDueDate('clear')"
              >
                <X :size="14" />
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="action-row">
            <button class="action-btn done" @click="handleMarkDone">
              <CheckCircle :size="24" />
              <span>Done</span>
            </button>
            <button class="action-btn skip" @click="handleSkip">
              <SkipForward :size="24" />
              <span>Skip</span>
            </button>
          </div>
        </div>
      </div>

      <!-- COMPLETION CELEBRATION -->
      <div v-else class="completion-phase">
        <div class="celebration-container">
          <div class="confetti-burst" ref="confettiRef"></div>

          <div class="celebration-icon">
            <PartyPopper :size="80" />
          </div>

          <h2 class="celebration-title">All Sorted!</h2>
          <p class="celebration-subtitle">You've processed all your tasks</p>

          <div class="session-summary" v-if="sessionSummary">
            <div class="summary-stat">
              <span class="stat-number">{{ sessionSummary.tasksProcessed }}</span>
              <span class="stat-label">Tasks</span>
            </div>
            <div class="summary-stat">
              <span class="stat-number">{{ formatDuration(sessionSummary.timeSpent) }}</span>
              <span class="stat-label">Time</span>
            </div>
            <div class="summary-stat" v-if="sessionSummary.efficiency > 0">
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
        <div v-if="showProjectSheet" class="sheet-overlay" @click="showProjectSheet = false">
          <div class="project-sheet" @click.stop>
            <div class="sheet-handle"></div>
            <h3 class="sheet-title">Assign to Project</h3>

            <div class="project-list">
              <button
                v-for="{ project, depth } in projectsWithDepth"
                :key="project.id"
                class="project-option"
                :style="{ paddingLeft: `${16 + depth * 24}px` }"
                @click="handleAssignProject(project.id)"
              >
                <span v-if="depth > 0" class="hierarchy-line" :style="{ width: `${depth * 24}px` }">
                  <span class="hierarchy-connector"></span>
                </span>
                <span
                  class="project-indicator"
                  :style="{ backgroundColor: project.color }"
                >
                  {{ project.emoji || project.name.charAt(0) }}
                </span>
                <span class="project-name">{{ project.name }}</span>
              </button>
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
              <button class="cancel-btn" @click="cancelDelete">Cancel</button>
              <button class="delete-btn" @click="confirmDelete">Delete</button>
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
            <div class="sheet-handle"></div>
            <h3 class="sheet-title">Quick Edit</h3>

            <!-- Priority Section -->
            <div class="edit-section">
              <span class="edit-label">Priority</span>
              <div class="priority-pills">
                <button class="pill" :class="{ active: currentTask?.priority === 'low' }" @click="setPriorityAndClose('low')">Low</button>
                <button class="pill" :class="{ active: currentTask?.priority === 'medium' }" @click="setPriorityAndClose('medium')">Med</button>
                <button class="pill" :class="{ active: currentTask?.priority === 'high' }" @click="setPriorityAndClose('high')">High</button>
              </div>
            </div>

            <!-- Date Section -->
            <div class="edit-section">
              <span class="edit-label">Due Date</span>
              <div class="date-pills">
                <button class="pill" @click="setDueDateAndClose('today')">Today</button>
                <button class="pill" @click="setDueDateAndClose('tomorrow')">Tmrw</button>
                <button class="pill" @click="setDueDateAndClose('in3days')">+3d</button>
                <button class="pill" @click="setDueDateAndClose('weekend')">Wknd</button>
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
import {
  Zap, X, Plus, CheckCircle, Calendar, CalendarPlus, Flag,
  ChevronLeft, ChevronRight, SkipForward, PartyPopper,
  ArrowLeft, Trash2, Edit3, FolderOpen
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
  uncategorizedTasks,
  progress,
  isComplete,
  startSession,
  endSession,
  categorizeTask,
  markTaskDone,
  markDoneAndDeleteTask,
  skipTask
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

// Card and swipe refs
const cardRef = ref<HTMLElement | null>(null)
const confettiRef = ref<HTMLElement | null>(null)

// Projects - hierarchical structure for nested display
const rootProjects = computed(() => projectStore.rootProjects)

// Build flat list with hierarchy info for display
interface ProjectWithDepth {
  project: typeof projectStore.projects.value[number]
  depth: number
}

const projectsWithDepth = computed(() => {
  const result: ProjectWithDepth[] = []

  const addProjectWithChildren = (project: typeof projectStore.projects.value[number], depth: number) => {
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
    // Show quick edit panel instead of project sheet
    showQuickEditPanel.value = true
  },
  onSwipeLeft: () => {
    hasSwipedOnce.value = true
    // Show delete confirmation instead of skip
    showDeleteConfirm.value = true
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
  const taskDate = new Date(currentTask.value.dueDate)
  const dayOfWeek = taskDate.getDay()
  return dayOfWeek === 0 || dayOfWeek === 6
})

// Actions
function handleQuickAdd() {
  if (!newTaskTitle.value.trim()) return

  let dueDate: string | undefined
  if (newTaskDue.value === 'today') {
    dueDate = new Date().toISOString()
  } else if (newTaskDue.value === 'tomorrow') {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    dueDate = tomorrow.toISOString()
  }

  const newTask = taskStore.createTask({
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

  categorizeTask(currentTask.value.id, projectId)
  showProjectSheet.value = false

  // Show celebration
  showCelebration.value = true
  setTimeout(() => {
    showCelebration.value = false
  }, 600)

  triggerHaptic('heavy')
}

function handleSkip() {
  skipTask()
  triggerHaptic('light')
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
  background: linear-gradient(
    165deg,
    hsl(230, 20%, 8%) 0%,
    hsl(245, 25%, 11%) 30%,
    hsl(250, 22%, 9%) 70%,
    hsl(230, 18%, 7%) 100%
  );
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
  z-index: 1;
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
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 10;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.08);
}

.header-content {
  flex: 1;
}

.qs-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.02em;
}

.zap-icon {
  color: var(--brand-primary);
}

.qs-subtitle {
  font-size: 0.75rem;
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
  background: linear-gradient(135deg, rgba(78, 205, 196, 0.2), rgba(78, 205, 196, 0.1));
  border: 1px solid rgba(78, 205, 196, 0.3);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--brand-primary);
  font-variant-numeric: tabular-nums;
}

/* ================================
   PROGRESS BAR
   ================================ */

.progress-track {
  position: relative;
  height: 3px;
  background: rgba(255, 255, 255, 0.05);
  z-index: 10;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-primary), hsl(174, 80%, 60%));
  transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.progress-glow {
  position: absolute;
  top: 50%;
  width: 20px;
  height: 20px;
  background: var(--brand-primary);
  border-radius: 50%;
  filter: blur(10px);
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
  z-index: 10;
}

.phase-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-4);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.phase-btn.active {
  background: linear-gradient(135deg, rgba(78, 205, 196, 0.15), rgba(78, 205, 196, 0.05));
  border-color: rgba(78, 205, 196, 0.4);
  color: var(--brand-primary);
}

.phase-btn:active {
  transform: scale(0.98);
}

.count-badge {
  padding: var(--space-0_5) var(--space-2);
  background: rgba(78, 205, 196, 0.2);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
}

/* ================================
   MAIN CONTENT
   ================================ */

.qs-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 5;
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-2xl);
  padding: var(--space-5);
}

.capture-input {
  width: 100%;
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: 1.125rem;
  font-weight: 500;
  outline: none;
  transition: all 0.2s ease;
}

.capture-input::placeholder {
  color: var(--text-muted);
}

.capture-input:focus {
  border-color: rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-action-btn.active {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.4);
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
  background: linear-gradient(135deg, rgba(78, 205, 196, 0.9), rgba(78, 205, 196, 0.7));
  border: none;
  border-radius: var(--radius-lg);
  color: hsl(230, 20%, 8%);
  font-size: 1rem;
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
  font-size: 0.75rem;
  font-weight: 600;
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
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-2);
}

.check-icon {
  color: var(--color-success);
}

.recent-title {
  flex: 1;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

/* Task list transitions */
.task-list-enter-active {
  transition: all 0.3s ease;
}

.task-list-leave-active {
  transition: all 0.2s ease;
}

.task-list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.task-list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
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
  font-size: 0.75rem;
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
  min-height: 200px;
  max-height: 320px;
}

.stack-card {
  position: absolute;
  width: 92%;
  max-width: 360px;
  height: 240px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
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
    rgba(30, 32, 45, 0.95),
    rgba(25, 27, 38, 0.98)
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.4),
    0 8px 24px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  z-index: 20;
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
  transition: opacity 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.swipe-indicator.left {
  border: 3px solid var(--color-danger, #ef4444);
  background: rgba(239, 68, 68, 0.1);
}

.swipe-indicator.right {
  border: 3px solid var(--color-success, #10b981);
  background: rgba(16, 185, 129, 0.1);
}

.swipe-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: inherit;
}

.swipe-indicator.left .swipe-content {
  color: var(--color-danger, #ef4444);
}

.swipe-indicator.right .swipe-content {
  color: var(--color-success, #10b981);
}

.swipe-content span {
  font-size: 0.875rem;
  font-weight: 700;
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
}

.priority-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
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
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 var(--space-3);
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.task-description {
  flex: 1;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--text-secondary);
  margin: 0;
  overflow: hidden;
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
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.meta-item.priority-high {
  color: var(--color-priority-high);
  background: rgba(239, 68, 68, 0.1);
}

.meta-item.priority-medium {
  color: var(--color-priority-medium);
  background: rgba(245, 158, 11, 0.1);
}

.meta-item.priority-low {
  color: var(--color-priority-low);
  background: rgba(59, 130, 246, 0.1);
}

.capitalize {
  text-transform: capitalize;
}

/* ================================
   THUMB ZONE (Bottom Controls)
   ================================ */

.thumb-zone {
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom, 24px));
  background: linear-gradient(to top, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.2), transparent);
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
  font-size: 0.6875rem;
  font-weight: 600;
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
  gap: var(--space-1_5);
  flex: 1;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 2px; /* Prevent cut-off on scroll */
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.priority-pills .pill {
  flex: 1;
}

.pill.active {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.4);
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

/* Action Row */
.action-row {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
}

.action-btn {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.done {
  color: var(--color-success);
  border-color: rgba(16, 185, 129, 0.2);
}

.action-btn.done:active {
  background: rgba(16, 185, 129, 0.15);
}

.action-btn.skip {
  color: var(--text-muted);
}

.action-btn.skip:active {
  background: rgba(255, 255, 255, 0.05);
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
  background: linear-gradient(135deg, rgba(78, 205, 196, 0.2), rgba(78, 205, 196, 0.05));
  border: 2px solid rgba(78, 205, 196, 0.3);
  border-radius: 50%;
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
  font-size: 2rem;
  font-weight: 800;
  margin: 0 0 var(--space-2);
  background: linear-gradient(135deg, var(--brand-primary), hsl(174, 80%, 70%));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.celebration-subtitle {
  font-size: 1rem;
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
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.return-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.return-btn:active {
  transform: scale(0.98);
  background: rgba(255, 255, 255, 0.08);
}

/* ================================
   PROJECT SHEET
   ================================ */

.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  z-index: 100;
}

.project-sheet {
  width: 100%;
  max-height: 70vh;
  background: linear-gradient(
    180deg,
    hsl(240, 20%, 12%) 0%,
    hsl(240, 18%, 10%) 100%
  );
  border-top-left-radius: var(--radius-2xl);
  border-top-right-radius: var(--radius-2xl);
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.sheet-handle {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-full);
  margin: 0 auto var(--space-5);
}

.sheet-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0 0 var(--space-5);
  text-align: center;
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
  padding: var(--space-4);
  padding-right: var(--space-4);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
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
  width: 12px;
  height: 2px;
  background: rgba(255, 255, 255, 0.15);
  margin-left: auto;
  border-radius: 1px;
}

.project-option:active {
  background: rgba(255, 255, 255, 0.06);
  transform: scale(0.98);
}

.project-indicator {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-size: 1.25rem;
}

.project-name {
  flex: 1;
  text-align: left;
}

/* Sheet transition */
.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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
  background: rgba(16, 185, 129, 0.95);
  border-radius: var(--radius-2xl);
  color: white;
  font-size: 1.25rem;
  font-weight: 700;
  z-index: 200;
  pointer-events: none;
}

.celebration-enter-active {
  animation: miniCelebrate 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.celebration-leave-active {
  animation: miniCelebrate 0.3s ease reverse;
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
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.confirm-modal {
  background: linear-gradient(145deg, rgba(30, 32, 45, 0.98), rgba(25, 27, 38, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  text-align: center;
  max-width: 320px;
  margin: var(--space-4);
}

.confirm-icon {
  color: var(--color-danger, #ef4444);
  margin: 0 auto var(--space-4);
}

.confirm-modal h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 var(--space-2);
}

.confirm-modal p {
  color: var(--text-secondary);
  font-size: 0.875rem;
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
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
}

.cancel-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

.delete-btn {
  background: var(--color-danger, #ef4444);
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
  transition: all 0.2s ease;
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
  font-size: 0.6875rem;
  font-weight: 600;
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.edit-section .pill.active {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.4);
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
  background: rgba(78, 205, 196, 0.1);
  border: 1px solid rgba(78, 205, 196, 0.3);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: var(--space-4);
}

.assign-project-btn:active {
  background: rgba(78, 205, 196, 0.15);
  transform: scale(0.98);
}

/* ================================
   ACCESSIBILITY - REDUCED MOTION
   ================================ */

@media (prefers-reduced-motion: reduce) {
  .task-card,
  .progress-fill,
  .progress-glow,
  .celebration-icon,
  .mini-celebration {
    animation: none !important;
    transition: none !important;
  }

  .swipe-hints {
    animation: none;
    opacity: 0.5;
  }
}
</style>
