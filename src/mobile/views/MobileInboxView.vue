<template>
  <div class="mobile-inbox">
    <!-- Debug Banner (tap to toggle) -->
    <div v-if="showDebug" class="debug-banner" @click="showDebug = false">
      <div><strong>Sync Debug</strong> (tap to hide)</div>
      <div>Auth: {{ authStatus }}</div>
      <div>User: {{ userId || 'none' }}</div>
      <div>Tasks loaded: {{ taskStore.tasks.length }}</div>
      <div>Filtered: {{ filteredTasks.length }}</div>
      <div v-if="syncError" class="error">Error: {{ syncError }}</div>
    </div>
    <button v-else class="debug-toggle" @click="showDebug = true">?</button>

    <!-- Header -->
    <div class="mobile-inbox-header">
      <h2>Inbox</h2>
      <div class="header-actions">
        <span class="task-count">{{ filteredTasks.length }}</span>
      </div>
    </div>

    <!-- Filter Chips -->
    <div class="filter-section">
      <div class="filter-chips">
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          :class="['filter-chip', { active: activeStatusFilter === filter.value }]"
          @click="setStatusFilter(filter.value)"
        >
          <component :is="filter.icon" :size="14" />
          {{ filter.label }}
        </button>
      </div>

      <!-- Sort toggle -->
      <div class="sort-section">
        <button class="sort-btn" @click="toggleSort">
          <ArrowUpDown :size="16" />
          {{ sortLabel }}
        </button>
      </div>
    </div>

    <!-- Task List -->
    <div class="mobile-task-list">
      <div v-if="filteredTasks.length === 0" class="empty-state">
        <Inbox :size="48" />
        <p v-if="activeStatusFilter === 'all'">No tasks yet</p>
        <p v-else>No {{ activeStatusFilter }} tasks</p>
      </div>

      <div
        v-for="task in filteredTasks"
        :key="task.id"
        :class="[
          'mobile-task-item',
          'long-press-item',
          { 'timer-active': isTimerActive(task.id) },
          { 'long-press-idle': getLongPressState(task.id).state === 'idle' },
          { 'long-press-pressing': getLongPressState(task.id).state === 'pressing' },
          { 'long-press-activated': getLongPressState(task.id).state === 'activated' }
        ]"
        :style="getLongPressStyles(task.id)"
        :data-long-press-state="getLongPressState(task.id).state"
        :data-task-id="task.id"
        @click="handleTaskClick(task)"
        @touchstart="handleTouchStart(task, $event)"
        @touchmove="handleTouchMove(task, $event)"
        @touchend="handleTouchEnd(task)"
        @touchcancel="handleLongPressCancel(task.id)"
        @contextmenu="handleContextMenu"
      >
        <div class="task-checkbox" @click.stop="toggleTask(task)">
          <div :class="['checkbox-circle', { checked: task.status === 'done' }]">
            <Check v-if="task.status === 'done'" :size="14" />
          </div>
        </div>

        <div class="task-content">
          <span :class="['task-title', { done: task.status === 'done' }]">{{ task.title }}</span>
          <div class="task-meta">
            <span v-if="task.priority" :class="['priority-badge', task.priority]">
              {{ priorityLabel(task.priority || 'none') }}
            </span>
            <span v-if="task.dueDate" :class="['due-date', { overdue: isOverdue(task.dueDate) }]">
              <Calendar :size="12" />
              {{ formatDueDate(task.dueDate) }}
            </span>
          </div>
        </div>

        <button class="timer-btn" @click.stop="startTimer(task)">
          <Play :size="16" />
        </button>
      </div>
    </div>

    <!-- Persistent Quick Add Bar -->
    <div class="quick-add-bar">
      <input
        ref="taskInput"
        v-model="newTaskTitle"
        type="text"
        placeholder="Add a task..."
        class="quick-add-input"
        @keydown.enter="submitTask"
      />
      <button
        class="add-btn"
        :disabled="!newTaskTitle.trim()"
        @click="submitTask"
      >
        <Plus :size="20" />
      </button>
    </div>

    <!-- Task Edit Bottom Sheet -->
    <TaskEditBottomSheet
      :is-open="isEditSheetOpen"
      :task="editingTask"
      @close="closeEditSheet"
      @save="handleSaveTask"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useTimerStore } from '@/stores/timer'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { type LongPressState } from '@/composables/useLongPress'
import TaskEditBottomSheet from '@/mobile/components/TaskEditBottomSheet.vue'
import {
  Plus, Check, Play, Calendar, Inbox,
  Circle, Clock, CheckCircle2, ArrowUpDown
} from 'lucide-vue-next'

const taskStore = useTaskStore()
const authStore = useAuthStore()
const timerStore = useTimerStore()
const { lastSyncError } = useSupabaseDatabase()

// State
const newTaskTitle = ref('')
const taskInput = ref<HTMLInputElement | null>(null)
const showDebug = ref(false)
const activeStatusFilter = ref<string>('active')
const sortBy = ref<'newest' | 'priority' | 'dueDate'>('newest')

// Edit sheet state
const isEditSheetOpen = ref(false)
const editingTask = ref<Task | null>(null)

// Debug info
const authStatus = computed(() => authStore.isAuthenticated ? 'Signed in' : 'Not signed in')
const userId = computed(() => authStore.user?.id?.substring(0, 8) + '...' || null)
const syncError = computed(() => lastSyncError.value)

// Long-press state tracking for each task item
const longPressStates = ref<Map<string, { state: LongPressState; progress: number }>>(new Map())
const activeLongPressTaskId = ref<string | null>(null)
// Track if long-press was activated (to prevent tap action)
const wasLongPressActivated = ref(false)

// Get long-press state for a task
const getLongPressState = (taskId: string) => {
  return longPressStates.value.get(taskId) || { state: 'idle' as LongPressState, progress: 0 }
}

// Get dynamic styles for long-press visual feedback
const getLongPressStyles = (taskId: string) => {
  const lpState = getLongPressState(taskId)

  if (lpState.state === 'idle') {
    return {
      transform: 'scale(1)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      transition: 'transform var(--duration-normal) var(--spring-smooth), box-shadow var(--duration-normal) var(--spring-smooth)'
    }
  }

  if (lpState.state === 'pressing') {
    // Progressive scale from 1.0 to 1.03 during press
    const scale = 1 + (lpState.progress * 0.03)
    // Progressive shadow elevation
    const shadowOpacity = 0.05 + (lpState.progress * 0.2)
    const shadowBlur = 3 + (lpState.progress * 21)
    const shadowY = 1 + (lpState.progress * 11)

    return {
      transform: `scale(${scale.toFixed(4)})`,
      boxShadow: `0 ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity.toFixed(2)})`,
      transition: 'none'
    }
  }

  // Activated state
  return {
    transform: 'scale(1.03)',
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.25), 0 0 0 2px var(--brand-primary, #4ECDC4)',
    transition: 'transform var(--duration-fast) var(--spring-bounce), box-shadow var(--duration-fast) var(--spring-smooth)'
  }
}

// Long-press handlers for individual task items
const handleLongPressStart = (taskId: string) => {
  activeLongPressTaskId.value = taskId
  longPressStates.value.set(taskId, { state: 'pressing', progress: 0 })
}

const handleLongPressProgress = (taskId: string, progress: number) => {
  const current = longPressStates.value.get(taskId)
  if (current) {
    longPressStates.value.set(taskId, { ...current, progress })
  }
}

const handleLongPressActivated = (task: Task) => {
  const taskId = task.id
  longPressStates.value.set(taskId, { state: 'activated', progress: 1 })
  wasLongPressActivated.value = true

  // Open edit bottom sheet for the task
  handleEditTask(task)

  // Reset state after a brief delay to show activation feedback
  setTimeout(() => {
    resetLongPressState(taskId)
  }, 300)
}

const handleLongPressCancel = (taskId: string) => {
  resetLongPressState(taskId)
}

const resetLongPressState = (taskId: string) => {
  longPressStates.value.set(taskId, { state: 'idle', progress: 0 })
  if (activeLongPressTaskId.value === taskId) {
    activeLongPressTaskId.value = null
  }
}

// Open edit bottom sheet for task
const handleEditTask = (task: Task) => {
  editingTask.value = task
  isEditSheetOpen.value = true
}

// Close edit bottom sheet
const closeEditSheet = () => {
  isEditSheetOpen.value = false
  // Delay clearing the task to allow close animation
  setTimeout(() => {
    editingTask.value = null
  }, 300)
}

// Save task changes from edit sheet
const handleSaveTask = (taskId: string, updates: Partial<Task>) => {
  taskStore.updateTask(taskId, updates)
}

// Prevent context menu during long-press
const handleContextMenu = (e: Event) => {
  const target = e.currentTarget as HTMLElement
  const state = target?.dataset?.longPressState
  if (state === 'pressing' || state === 'activated') {
    e.preventDefault()
  }
}

// Touch event handlers for long-press detection
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let progressInterval: ReturnType<typeof setInterval> | null = null
let startTime = 0
const LONG_PRESS_DURATION = 500 // ms
const MOVEMENT_THRESHOLD = 10 // px
let startX = 0
let startY = 0

const handleTouchStart = (task: Task, e: TouchEvent) => {
  const touch = e.touches[0]
  startX = touch.clientX
  startY = touch.clientY
  startTime = Date.now()

  handleLongPressStart(task.id)

  // Start progress tracking
  progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / LONG_PRESS_DURATION, 1)
    handleLongPressProgress(task.id, progress)

    // Check for milestone haptics
    if (progress >= 0.25 && progress < 0.26) triggerHaptic(10)
    if (progress >= 0.5 && progress < 0.51) triggerHaptic(10)
    if (progress >= 0.75 && progress < 0.76) triggerHaptic(10)
  }, 16) // ~60fps

  // Set activation timer
  longPressTimer = setTimeout(() => {
    clearInterval(progressInterval!)
    progressInterval = null
    triggerHaptic(50) // Strong haptic on activation
    handleLongPressActivated(task)
  }, LONG_PRESS_DURATION)
}

const handleTouchMove = (task: Task, e: TouchEvent) => {
  if (!activeLongPressTaskId.value || activeLongPressTaskId.value !== task.id) return

  const touch = e.touches[0]
  const deltaX = Math.abs(touch.clientX - startX)
  const deltaY = Math.abs(touch.clientY - startY)

  // Cancel if moved too far
  if (deltaX > MOVEMENT_THRESHOLD || deltaY > MOVEMENT_THRESHOLD) {
    clearLongPressTimers()
    handleLongPressCancel(task.id)
  }
}

const handleTouchEnd = (task: Task) => {
  clearLongPressTimers()
  const lpState = getLongPressState(task.id)

  if (lpState.state === 'pressing') {
    // Released before activation - cancel and allow tap
    handleLongPressCancel(task.id)
    wasLongPressActivated.value = false
  }

  // Reset long-press activated flag after a short delay
  // This prevents the click event from firing right after long-press
  setTimeout(() => {
    wasLongPressActivated.value = false
  }, 100)
}

const clearLongPressTimers = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
}

// Haptic feedback helper
const triggerHaptic = (duration: number = 50) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration)
    } catch {
      // Vibration API not supported
    }
  }
}

// Cleanup on unmount
onUnmounted(() => {
  clearLongPressTimers()
})

// Filter configuration
const statusFilters = [
  { value: 'all', label: 'All', icon: Inbox },
  { value: 'active', label: 'Active', icon: Circle },
  { value: 'planned', label: 'Planned', icon: Clock },
  { value: 'done', label: 'Done', icon: CheckCircle2 },
]

// Computed
const filteredTasks = computed(() => {
  let tasks = [...taskStore.tasks]

  // Status filter
  if (activeStatusFilter.value === 'active') {
    tasks = tasks.filter(t => t.status !== 'done')
  } else if (activeStatusFilter.value !== 'all') {
    tasks = tasks.filter(t => t.status === activeStatusFilter.value)
  }

  // Sort
  switch (sortBy.value) {
    case 'priority':
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 }
      tasks.sort((a, b) =>
        (priorityOrder[a.priority || 'none'] || 4) - (priorityOrder[b.priority || 'none'] || 4)
      )
      break
    case 'dueDate':
      tasks.sort((a, b) => {
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
      break
    case 'newest':
    default:
      tasks.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bTime - aTime
      })
  }

  return tasks
})

const sortLabel = computed(() => {
  switch (sortBy.value) {
    case 'priority': return 'Priority'
    case 'dueDate': return 'Due'
    default: return 'Newest'
  }
})

// Actions
const setStatusFilter = (filter: string) => {
  activeStatusFilter.value = filter
}

const toggleSort = () => {
  const sortOptions: Array<'newest' | 'priority' | 'dueDate'> = ['newest', 'priority', 'dueDate']
  const currentIndex = sortOptions.indexOf(sortBy.value)
  sortBy.value = sortOptions[(currentIndex + 1) % sortOptions.length]
}

const submitTask = () => {
  if (!newTaskTitle.value.trim()) return

  taskStore.createTask({
    title: newTaskTitle.value,
    status: 'planned'
  })

  newTaskTitle.value = ''
  taskInput.value?.focus()
}

const toggleTask = (task: Task) => {
  const newStatus = task.status === 'done' ? 'planned' : 'done'
  taskStore.updateTask(task.id, { status: newStatus })
}

const handleTaskClick = (task: Task) => {
  // Don't trigger click if long-press was just activated
  if (wasLongPressActivated.value) {
    wasLongPressActivated.value = false
    return
  }
  // Normal tap - could open task detail or do nothing
  // For now, we only use long-press to edit
}

const startTimer = (task: Task) => {
  timerStore.startTimer(task.id)
}

const isTimerActive = (taskId: string) => {
  return timerStore.isTimerActive && timerStore.currentTaskId === taskId
}

// Helpers
const priorityLabel = (priority: string) => {
  const labels: Record<string, string> = {
    critical: 'P0',
    high: 'P1',
    medium: 'P2',
    low: 'P3'
  }
  return labels[priority] || priority
}

const formatDueDate = (dueDate: string | Date): string => {
  const date = new Date(dueDate)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow'
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

const isOverdue = (dueDate: string | Date): boolean => {
  return new Date(dueDate) < new Date()
}
</script>

<style scoped>
.mobile-inbox {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-bottom: 140px; /* Space for quick-add + nav */
}

.mobile-inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  position: sticky;
  top: 0;
  background: var(--app-background-gradient);
  z-index: 10;
}

.mobile-inbox-header h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.task-count {
  background: var(--surface-secondary);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Filter Section */
.filter-section {
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.filter-chips::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-chip.active {
  background: var(--primary-brand);
  border-color: var(--primary-brand);
  color: white;
}

.sort-section {
  display: flex;
  justify-content: flex-end;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: var(--surface-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

/* Task List */
.mobile-task-list {
  flex: 1;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-task-item {
  display: flex;
  align-items: center;
  background: var(--surface-primary);
  padding: 14px;
  border-radius: 12px;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  cursor: pointer;
  /* GPU acceleration for smooth long-press animations */
  will-change: transform, box-shadow;
  transform: translateZ(0);
  /* Base transition - overridden during long-press by inline styles */
  transition:
    transform var(--duration-normal, 200ms) var(--spring-smooth, cubic-bezier(0.25, 0.46, 0.45, 0.94)),
    box-shadow var(--duration-normal, 200ms) var(--spring-smooth, cubic-bezier(0.25, 0.46, 0.45, 0.94));
  /* Prevent text selection during long press */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* Disable default active state when long-pressing */
.mobile-task-item.long-press-pressing:active,
.mobile-task-item.long-press-activated:active {
  transform: none; /* Let JS control the transform */
}

/* Only apply press-down on quick taps (idle state) */
.mobile-task-item.long-press-idle:active {
  transform: scale(0.98);
}

.mobile-task-item.timer-active {
  border: 2px solid var(--timer-active-border, var(--primary-brand));
  box-shadow: 0 0 12px var(--timer-active-glow, rgba(var(--primary-brand-rgb), 0.2));
}

.task-checkbox {
  padding: 4px;
  flex-shrink: 0;
}

.checkbox-circle {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-subtle);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.checkbox-circle.checked {
  background: var(--primary-brand);
  border-color: var(--primary-brand);
  color: white;
}

.task-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-title {
  font-size: 15px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-title.done {
  text-decoration: line-through;
  color: var(--text-muted);
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.priority-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--surface-tertiary);
  color: var(--text-secondary);
}

.priority-badge.critical { background: var(--danger-bg-subtle); color: var(--danger-text); }
.priority-badge.high { background: var(--warning-bg-subtle); color: var(--warning-text); }
.priority-badge.medium { background: var(--primary-brand-bg-subtle); color: var(--primary-brand); }
.priority-badge.low { background: var(--surface-tertiary); color: var(--text-muted); }

.due-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.due-date.overdue {
  color: var(--danger-text);
}

.timer-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--primary-brand-bg-subtle);
  color: var(--primary-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.timer-btn:active {
  transform: scale(0.95);
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 60px 20px;
}

.empty-state p {
  margin-top: 12px;
}

/* Persistent Quick Add Bar */
.quick-add-bar {
  position: fixed;
  bottom: 64px; /* Above nav */
  left: 0;
  right: 0;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--surface-primary);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  gap: 12px;
  z-index: 50;
  box-shadow: 0 -4px 12px rgba(0,0,0,0.08);
}

.quick-add-input {
  flex: 1;
  padding: 12px 16px;
  border-radius: 24px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-primary);
  font-size: 16px;
  outline: none;
}

.quick-add-input:focus {
  border-color: var(--primary-brand);
  box-shadow: 0 0 0 2px rgba(var(--primary-brand-rgb), 0.1);
}

.add-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--primary-brand);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(var(--primary-brand-rgb), 0.3);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-btn:active:not(:disabled) {
  transform: scale(0.95);
}

/* Debug Banner */
.debug-banner {
  background: rgba(0, 0, 0, 0.85);
  color: #0f0;
  font-family: monospace;
  font-size: 11px;
  padding: 8px 12px;
  margin: 8px 16px;
  border-radius: 8px;
  line-height: 1.6;
}

.debug-banner .error {
  color: #f66;
}

.debug-toggle {
  position: fixed;
  top: 60px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  z-index: 1000;
}
</style>
