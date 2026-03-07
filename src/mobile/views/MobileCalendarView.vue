<template>
  <div class="mobile-calendar">
    <!-- Calendar Header -->
    <div class="calendar-header">
      <div class="date-nav">
        <button class="nav-btn" @click="previousDay">
          <ChevronLeft :size="20" />
        </button>
        <button class="date-label" @click="goToToday">
          <span class="date-text">{{ formattedDate }}</span>
          <span v-if="isToday" class="today-badge">Today</span>
        </button>
        <button class="nav-btn" @click="nextDay">
          <ChevronRight :size="20" />
        </button>
      </div>
      <div class="header-meta">
        <span class="task-count">{{ dayTasks.length }} task{{ dayTasks.length !== 1 ? 's' : '' }}</span>
      </div>
    </div>

    <!-- Time Grid -->
    <div ref="timeGridRef" class="time-grid">
      <div
        v-for="hour in hours"
        :key="hour"
        class="time-row"
        @click="handleTimeSlotClick(hour)"
      >
        <span class="time-label">{{ formatHour(hour) }}</span>
        <div class="time-slot">
          <!-- Tasks in this hour -->
          <div
            v-for="task in getTasksAtHour(hour)"
            :key="task.id"
            class="task-event"
            :class="[
              `priority-${task.priority || 'none'}`,
              { 'timer-active': timerStore.isTimerActive && timerStore.currentTaskId === task.id }
            ]"
            :style="{ height: getTaskHeight(task) + 'px' }"
            @click.stop="openTask(task)"
          >
            <div class="event-title" dir="auto">{{ task.title }}</div>
            <div class="event-time">
              {{ task.scheduledTime }}
              <span v-if="task.estimatedDuration"> &middot; {{ task.estimatedDuration }}min</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Current Time Indicator -->
      <div
        v-if="isToday"
        class="time-indicator"
        :style="{ top: timeIndicatorTop + 'px' }"
      >
        <div class="indicator-dot" />
        <div class="indicator-line" />
      </div>
    </div>

    <!-- Unscheduled Tasks Section -->
    <div v-if="unscheduledTasks.length > 0" class="unscheduled-section">
      <button class="unscheduled-header" @click="showUnscheduled = !showUnscheduled">
        <span>Unscheduled ({{ unscheduledTasks.length }})</span>
        <ChevronDown :size="16" :class="{ rotated: showUnscheduled }" />
      </button>
      <Transition name="expand">
        <div v-if="showUnscheduled" class="unscheduled-list">
          <div
            v-for="task in unscheduledTasks"
            :key="task.id"
            class="unscheduled-task"
            :class="`priority-${task.priority || 'none'}`"
            @click="openTask(task)"
          >
            <div class="priority-dot" />
            <span class="task-title" dir="auto">{{ task.title }}</span>
            <span v-if="task.estimatedDuration" class="task-duration">{{ task.estimatedDuration }}m</span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Task Edit Bottom Sheet -->
    <TaskEditBottomSheet
      v-if="selectedTask"
      :task="selectedTask"
      :is-open="isEditOpen"
      @close="isEditOpen = false; selectedTask = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import TaskEditBottomSheet from '@/mobile/components/TaskEditBottomSheet.vue'
import type { Task } from '@/types/tasks'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

const currentDate = ref(new Date())
const showUnscheduled = ref(false)
const selectedTask = ref<Task | null>(null)
const isEditOpen = ref(false)
const timeGridRef = ref<HTMLElement | null>(null)
const timeIndicatorTop = ref(0)
let indicatorInterval: ReturnType<typeof setInterval> | null = null

// Hours to display (6 AM to 11 PM)
const hours = Array.from({ length: 18 }, (_, i) => i + 6)

const isToday = computed(() => {
  const now = new Date()
  return (
    currentDate.value.getFullYear() === now.getFullYear() &&
    currentDate.value.getMonth() === now.getMonth() &&
    currentDate.value.getDate() === now.getDate()
  )
})

const formattedDate = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
})

const dateString = computed(() => {
  const d = currentDate.value
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

// Tasks scheduled for the current date
const dayTasks = computed(() => {
  return taskStore._rawTasks.filter(
    (t) =>
      t.status !== 'done' &&
      t.scheduledDate === dateString.value &&
      t.scheduledTime
  )
})

// Tasks due today but not scheduled to a specific time
const unscheduledTasks = computed(() => {
  return taskStore._rawTasks.filter(
    (t) =>
      t.status !== 'done' &&
      (t.dueDate === dateString.value || t.scheduledDate === dateString.value) &&
      !t.scheduledTime
  )
})

function getTasksAtHour(hour: number) {
  return dayTasks.value.filter((t) => {
    if (!t.scheduledTime) return false
    const [h] = t.scheduledTime.split(':').map(Number)
    return h === hour
  })
}

function getTaskHeight(task: Task) {
  const duration = task.estimatedDuration || 30
  // Each hour row is 56px, so 1 minute = 56/60 px
  return Math.max(36, (duration / 60) * 56)
}

function formatHour(hour: number) {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

function previousDay() {
  const d = new Date(currentDate.value)
  d.setDate(d.getDate() - 1)
  currentDate.value = d
}

function nextDay() {
  const d = new Date(currentDate.value)
  d.setDate(d.getDate() + 1)
  currentDate.value = d
}

function goToToday() {
  currentDate.value = new Date()
}

function openTask(task: Task) {
  selectedTask.value = task
  isEditOpen.value = true
}

function handleTimeSlotClick(_hour: number) {
  // Future: could open quick-create with pre-filled time
}

function updateTimeIndicator() {
  const now = new Date()
  const minutesSince6AM = (now.getHours() - 6) * 60 + now.getMinutes()
  // Each hour row is 56px
  timeIndicatorTop.value = (minutesSince6AM / 60) * 56
}

function scrollToCurrentTime() {
  if (!timeGridRef.value || !isToday.value) return
  const now = new Date()
  const currentHour = now.getHours()
  // Scroll to 1 hour before current time
  const scrollHour = Math.max(6, currentHour - 1)
  const scrollTarget = ((scrollHour - 6) / 18) * timeGridRef.value.scrollHeight
  timeGridRef.value.scrollTop = scrollTarget
}

onMounted(() => {
  updateTimeIndicator()
  indicatorInterval = setInterval(updateTimeIndicator, 60000)
  nextTick(() => scrollToCurrentTime())
})

onUnmounted(() => {
  if (indicatorInterval) clearInterval(indicatorInterval)
})
</script>

<style scoped>
.mobile-calendar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-primary);
}

/* Header */
.calendar-header {
  padding: var(--space-3) var(--space-4);
  background: var(--surface-secondary);
  border-bottom: 1px solid var(--border-subtle);
}

.date-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.nav-btn:active {
  background: var(--surface-tertiary);
  color: var(--text-primary);
}

.date-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: var(--space-1) var(--space-3);
}

.date-text {
  font-size: var(--text-lg);
  font-weight: 600;
}

.today-badge {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.12);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
}

.header-meta {
  display: flex;
  justify-content: center;
  margin-top: var(--space-1);
}

.task-count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

/* Time Grid */
.time-grid {
  flex: 1;
  overflow-y: auto;
  position: relative;
  -webkit-overflow-scrolling: touch;
}

.time-row {
  display: flex;
  align-items: flex-start;
  min-height: 56px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
}

.time-row:active {
  background: rgba(255, 255, 255, 0.02);
}

.time-label {
  width: 52px;
  flex-shrink: 0;
  padding: var(--space-2) var(--space-2) 0 var(--space-3);
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: right;
}

.time-slot {
  flex: 1;
  padding: var(--space-1) var(--space-2) var(--space-1) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

/* Task Events */
.task-event {
  background: var(--glass-bg-soft);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  border-left: 3px solid var(--border-subtle);
  cursor: pointer;
  overflow: hidden;
  transition: background var(--duration-normal);
}

.task-event:active {
  background: var(--surface-tertiary);
}

.task-event.priority-high {
  border-left-color: var(--color-danger);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.08));
}

.task-event.priority-medium {
  border-left-color: var(--color-warning);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.08));
}

.task-event.priority-low {
  border-left-color: var(--color-info);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.08));
}

.task-event.priority-none {
  border-left-color: var(--text-tertiary);
}

.task-event.timer-active {
  border-left-color: var(--timer-active-border, #f59e0b);
  box-shadow: var(--timer-active-glow, 0 0 8px rgba(245, 158, 11, 0.3));
  animation: pulse-subtle 2s ease-in-out infinite;
}

@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

.event-title {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-time {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

/* Current Time Indicator */
.time-indicator {
  position: absolute;
  left: 52px;
  right: 0;
  height: 2px;
  z-index: 5;
  pointer-events: none;
}

.indicator-line {
  width: 100%;
  height: 2px;
  background: var(--color-danger);
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
}

.indicator-dot {
  position: absolute;
  left: -5px;
  top: -4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-danger);
}

/* Unscheduled Section */
.unscheduled-section {
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
}

.unscheduled-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
}

.unscheduled-header svg {
  transition: transform var(--duration-normal);
}

.unscheduled-header svg.rotated {
  transform: rotate(180deg);
}

.unscheduled-list {
  padding: 0 var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.unscheduled-task {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.unscheduled-task:active {
  background: var(--surface-tertiary);
}

.priority-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-tertiary);
}

.priority-high .priority-dot { background: var(--color-danger); }
.priority-medium .priority-dot { background: var(--color-warning); }
.priority-low .priority-dot { background: var(--color-info); }

.task-title {
  font-size: var(--text-sm);
  color: var(--text-primary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-duration {
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* Transitions */
.expand-enter-active,
.expand-leave-active {
  transition: all var(--duration-normal) ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

/* RTL Support */
[dir="rtl"] .time-label {
  text-align: left;
  padding-left: var(--space-2);
  padding-right: var(--space-3);
}

[dir="rtl"] .task-event {
  border-left: none;
  border-right: 3px solid var(--border-subtle);
}

[dir="rtl"] .task-event.priority-high { border-right-color: var(--color-danger); }
[dir="rtl"] .task-event.priority-medium { border-right-color: var(--color-warning); }
[dir="rtl"] .task-event.priority-low { border-right-color: var(--color-info); }

[dir="rtl"] .time-indicator {
  left: 0;
  right: 52px;
}

[dir="rtl"] .indicator-dot {
  left: auto;
  right: -5px;
}
</style>
