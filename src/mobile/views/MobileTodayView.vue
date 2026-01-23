<template>
  <div class="mobile-today">
    <div class="today-header">
      <div class="date-display">
        <h2>{{ dayOfWeek }}</h2>
        <span class="full-date">{{ formattedDate }}</span>
      </div>
      <div class="task-count">
        {{ todayTasks.length }} tasks
      </div>
    </div>

    <!-- Time-based sections -->
    <div class="time-sections">
      <!-- Overdue -->
      <div v-if="overdueTasks.length > 0" class="time-section overdue">
        <div class="section-header">
          <AlertCircle :size="16" />
          <span>Overdue</span>
          <span class="count">{{ overdueTasks.length }}</span>
        </div>
        <div class="task-list">
          <div
            v-for="task in overdueTasks"
            :key="task.id"
            :class="[
              'task-item',
              'long-press-item',
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
              <span v-if="task.dueDate" class="task-due overdue">{{ formatDueTime(task.dueDate) }}</span>
            </div>
            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Morning -->
      <div v-if="morningTasks.length > 0" class="time-section">
        <div class="section-header">
          <Sunrise :size="16" />
          <span>Morning</span>
          <span class="count">{{ morningTasks.length }}</span>
        </div>
        <div class="task-list">
          <div
            v-for="task in morningTasks"
            :key="task.id"
            :class="[
              'task-item',
              'long-press-item',
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
              <span v-if="task.dueDate" class="task-due">{{ formatDueTime(task.dueDate) }}</span>
            </div>
            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Afternoon -->
      <div v-if="afternoonTasks.length > 0" class="time-section">
        <div class="section-header">
          <Sun :size="16" />
          <span>Afternoon</span>
          <span class="count">{{ afternoonTasks.length }}</span>
        </div>
        <div class="task-list">
          <div
            v-for="task in afternoonTasks"
            :key="task.id"
            :class="[
              'task-item',
              'long-press-item',
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
              <span v-if="task.dueDate" class="task-due">{{ formatDueTime(task.dueDate) }}</span>
            </div>
            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Evening -->
      <div v-if="eveningTasks.length > 0" class="time-section">
        <div class="section-header">
          <Moon :size="16" />
          <span>Evening</span>
          <span class="count">{{ eveningTasks.length }}</span>
        </div>
        <div class="task-list">
          <div
            v-for="task in eveningTasks"
            :key="task.id"
            :class="[
              'task-item',
              'long-press-item',
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
              <span v-if="task.dueDate" class="task-due">{{ formatDueTime(task.dueDate) }}</span>
            </div>
            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- No specific time -->
      <div v-if="untimedTasks.length > 0" class="time-section">
        <div class="section-header">
          <Calendar :size="16" />
          <span>Anytime Today</span>
          <span class="count">{{ untimedTasks.length }}</span>
        </div>
        <div class="task-list">
          <div
            v-for="task in untimedTasks"
            :key="task.id"
            :class="[
              'task-item',
              'long-press-item',
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
            </div>
            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="todayTasks.length === 0" class="empty-state">
        <CheckCircle :size="48" />
        <h3>All clear for today!</h3>
        <p>No tasks scheduled. Add one from Inbox.</p>
      </div>
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
// @ts-ignore - Avoid strict type check on imported Task type if causing issues
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { type LongPressState } from '@/composables/useLongPress'
import TaskEditBottomSheet from '@/mobile/components/TaskEditBottomSheet.vue'
import {
  Check, Play, AlertCircle, Sunrise, Sun, Moon, Calendar, CheckCircle
} from 'lucide-vue-next'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Edit sheet state
const isEditSheetOpen = ref(false)
const editingTask = ref<Task | null>(null)
// Track if long-press was activated (to prevent tap action)
const wasLongPressActivated = ref(false)

// Date formatting
const now = new Date()
const dayOfWeek = computed(() => {
  return now.toLocaleDateString('en-US', { weekday: 'long' })
})
const formattedDate = computed(() => {
  return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
})

// Get today's date boundaries
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

// Filter tasks for today (exclude completed tasks - TASK-1004)
const todayTasks = computed(() => {
  return taskStore.tasks.filter(t => {
    if (!t.dueDate || t.status === 'done') return false
    const dueDate = new Date(t.dueDate)
    return dueDate >= todayStart && dueDate <= todayEnd
  })
})

// Overdue tasks (before today)
const overdueTasks = computed(() => {
  return taskStore.tasks.filter(t => {
    if (!t.dueDate || t.status === 'done') return false
    const dueDate = new Date(t.dueDate)
    return dueDate < todayStart
  })
})

// Time-based categorization
const getTaskHour = (task: Task): number | null => {
  if (!task.dueDate) return null
  return new Date(task.dueDate).getHours()
}

const morningTasks = computed(() => {
  return todayTasks.value.filter(t => {
    const hour = getTaskHour(t)
    return hour !== null && hour >= 6 && hour < 12
  })
})

const afternoonTasks = computed(() => {
  return todayTasks.value.filter(t => {
    const hour = getTaskHour(t)
    return hour !== null && hour >= 12 && hour < 18
  })
})

const eveningTasks = computed(() => {
  return todayTasks.value.filter(t => {
    const hour = getTaskHour(t)
    return hour !== null && (hour >= 18 || hour < 6)
  })
})

const untimedTasks = computed(() => {
  return todayTasks.value.filter(t => {
    if (!t.dueDate) return true
    const dueDate = new Date(t.dueDate)
    // Check if it's just a date without specific time (midnight)
    return dueDate.getHours() === 0 && dueDate.getMinutes() === 0
  })
})

const formatDueTime = (dueDate: string | Date | undefined): string => {
  if (!dueDate) return ''
  const date = new Date(dueDate)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
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

// ===== Long-press visual feedback system =====
// Enables "long press to edit" with subtle scale-up, shadow, and haptic feedback

const longPressStates = ref<Map<string, { state: LongPressState; progress: number }>>(new Map())
const activeLongPressTaskId = ref<string | null>(null)

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
      boxShadow: '',
      transition: 'transform var(--duration-normal) var(--spring-smooth), box-shadow var(--duration-normal) var(--spring-smooth)'
    }
  }

  if (lpState.state === 'pressing') {
    const scale = 1 + (lpState.progress * 0.03)
    const shadowOpacity = 0.05 + (lpState.progress * 0.2)
    const shadowBlur = 3 + (lpState.progress * 21)
    const shadowY = 1 + (lpState.progress * 11)

    return {
      transform: `scale(${scale.toFixed(4)})`,
      boxShadow: `0 ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity.toFixed(2)})`,
      transition: 'none'
    }
  }

  return {
    transform: 'scale(1.03)',
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.25), 0 0 0 2px var(--brand-primary, #4ECDC4)',
    transition: 'transform var(--duration-fast) var(--spring-bounce), box-shadow var(--duration-fast) var(--spring-smooth)'
  }
}

// Long-press handlers
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
  longPressStates.value.set(task.id, { state: 'activated', progress: 1 })
  wasLongPressActivated.value = true

  // Open edit bottom sheet for the task
  handleEditTask(task)

  setTimeout(() => resetLongPressState(task.id), 300)
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

// Touch event handlers
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let progressInterval: ReturnType<typeof setInterval> | null = null
let startTime = 0
const LONG_PRESS_DURATION = 500
const MOVEMENT_THRESHOLD = 10
let startX = 0
let startY = 0

const handleTouchStart = (task: Task, e: TouchEvent) => {
  const touch = e.touches[0]
  startX = touch.clientX
  startY = touch.clientY
  startTime = Date.now()

  handleLongPressStart(task.id)

  progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / LONG_PRESS_DURATION, 1)
    handleLongPressProgress(task.id, progress)

    if (progress >= 0.25 && progress < 0.26) triggerHaptic(10)
    if (progress >= 0.5 && progress < 0.51) triggerHaptic(10)
    if (progress >= 0.75 && progress < 0.76) triggerHaptic(10)
  }, 16)

  longPressTimer = setTimeout(() => {
    clearInterval(progressInterval!)
    progressInterval = null
    triggerHaptic(50)
    handleLongPressActivated(task)
  }, LONG_PRESS_DURATION)
}

const handleTouchMove = (task: Task, e: TouchEvent) => {
  if (!activeLongPressTaskId.value || activeLongPressTaskId.value !== task.id) return

  const touch = e.touches[0]
  const deltaX = Math.abs(touch.clientX - startX)
  const deltaY = Math.abs(touch.clientY - startY)

  if (deltaX > MOVEMENT_THRESHOLD || deltaY > MOVEMENT_THRESHOLD) {
    clearLongPressTimers()
    handleLongPressCancel(task.id)
  }
}

const handleTouchEnd = (task: Task) => {
  clearLongPressTimers()
  const lpState = getLongPressState(task.id)
  if (lpState.state === 'pressing') {
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

const triggerHaptic = (duration: number = 50) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration)
    } catch {
      // Vibration API not supported
    }
  }
}

onUnmounted(() => {
  clearLongPressTimers()
})
</script>

<style scoped>
.mobile-today {
  padding: 16px;
  padding-bottom: 100px;
  min-height: 100vh;
  background: var(--app-background-gradient);
}

.today-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.date-display h2 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.full-date {
  font-size: 14px;
  color: var(--text-tertiary);
}

.task-count {
  background: var(--surface-secondary);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.time-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.time-section {
  background: var(--surface-primary);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.time-section.overdue {
  border-left: 3px solid var(--danger-text);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.section-header .count {
  margin-left: auto;
  background: var(--surface-secondary);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface-secondary);
  border-radius: 12px;
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
.task-item.long-press-pressing:active,
.task-item.long-press-activated:active {
  transform: none;
}

/* Only apply press-down on quick taps (idle state) */
.task-item.long-press-idle:active {
  transform: scale(0.98);
}

.task-checkbox {
  padding: 4px;
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
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
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

.task-due {
  font-size: 12px;
  color: var(--text-tertiary);
}

.task-due.overdue {
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
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.empty-state h3 {
  margin: 16px 0 8px;
  font-size: 20px;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>
