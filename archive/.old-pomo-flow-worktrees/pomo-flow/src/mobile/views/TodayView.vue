<template>
  <div class="today-view">
    <!-- Header with sync status -->
    <header class="view-header">
      <div class="header-content">
        <div>
          <h1 class="view-title">Today</h1>
          <p class="view-subtitle">{{ formatDate(new Date()) }}</p>
        </div>

        <div class="sync-status" :class="syncStatus">
          <span class="sync-icon">{{ syncIcon }}</span>
          <span class="sync-text">{{ syncText }}</span>
        </div>
      </div>

      <!-- Progress bar -->
      <div v-if="todayTasks.length > 0" class="progress-container">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${completionPercentage}%` }"
          />
        </div>
        <p class="progress-text">
          {{ completedCount }} of {{ todayTasks.length }} completed
        </p>
      </div>
    </header>

    <!-- Active Pomodoro Timer -->
    <div v-if="activePomodoro" class="pomodoro-card">
      <div class="pomodoro-header">
        <span class="pomodoro-label">
          {{ activePomodoro.type === 'work' ? '🍅 Focus Time' : '☕ Break Time' }}
        </span>
        <button class="pomodoro-stop" @click="stopPomodoro">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="pomodoro-timer">
        {{ formatTime(remainingTime) }}
      </div>

      <div v-if="activePomodoro.taskId" class="pomodoro-task">
        Working on: {{ getTaskTitle(activePomodoro.taskId) }}
      </div>

      <div class="pomodoro-actions">
        <button
          class="pomodoro-button secondary"
          @click="pausePomodoro"
        >
          {{ activePomodoro.isPaused ? 'Resume' : 'Pause' }}
        </button>
        <button
          class="pomodoro-button primary"
          @click="completePomodoro"
        >
          Complete
        </button>
      </div>
    </div>

    <!-- Task List -->
    <div class="tasks-section">
      <div class="section-header">
        <h2 class="section-title">Tasks</h2>
        <button
          v-if="!showCompletedTasks && completedCount > 0"
          class="show-completed-button"
          @click="showCompletedTasks = true"
        >
          Show {{ completedCount }} completed
        </button>
      </div>

      <TaskList
        :tasks="visibleTasks"
        :projects="projects"
        @task-click="handleTaskClick"
        @task-complete="handleTaskComplete"
        @task-delete="handleTaskDelete"
        @refresh="handleRefresh"
      />
    </div>

    <!-- Floating Action Button -->
    <button
      class="fab"
      @click="showQuickCapture = true"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
    </button>

    <!-- Quick Capture Modal -->
    <QuickCapture
      v-model="showQuickCapture"
      :projects="projects"
      @create="handleCreateTask"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { format, isToday, startOfDay, endOfDay } from 'date-fns'
import TaskList from '../components/TaskList.vue'
import QuickCapture from '../components/QuickCapture.vue'
import { useTaskStore } from '@/stores/tasks'
import { notificationService } from '../services/notificationService'
import type { Task, Project } from '@/stores/tasks'

// Use Pinia stores
const taskStore = useTaskStore()

// Reactive state
const tasks = computed(() => taskStore.tasks)
const projects = computed(() => taskStore.projects)
const activePomodoro = ref<any | null>(null)
const remainingTime = ref(0)
const showCompletedTasks = ref(false)
const showQuickCapture = ref(false)

let pomodoroInterval: NodeJS.Timeout | null = null

// Sync status (offline for now, will integrate Yjs later)
const syncStatus = ref('offline')
const syncIcon = computed(() => '✈')
const syncText = computed(() => 'Offline')

// Today's tasks
const todayTasks = computed(() => {
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return tasks.value.filter(task => {
    // Tasks with due date today
    if (task.dueDate === todayStr) return true

    // Tasks with instances scheduled for today
    if (task.instances?.some(inst => inst.scheduledDate === todayStr)) return true

    // Tasks in progress
    if (task.status === 'in_progress') return true

    return false
  })
})

const visibleTasks = computed(() => {
  if (showCompletedTasks.value) {
    return todayTasks.value
  }
  return todayTasks.value.filter(task => task.status !== 'done')
})

const completedCount = computed(() =>
  todayTasks.value.filter(task => task.status === 'done').length
)

const completionPercentage = computed(() => {
  if (todayTasks.value.length === 0) return 0
  return Math.round((completedCount.value / todayTasks.value.length) * 100)
})

// Lifecycle
onMounted(async () => {
  // Initialize notification service
  await notificationService.initialize()
  await notificationService.registerNotificationActions()

  // Request notification permissions
  const hasPermission = await notificationService.checkPermissions()
  if (!hasPermission) {
    await notificationService.requestPermissions()
  }

  // Load tasks from database
  await taskStore.loadFromDatabase()

  // Set up notification event listeners
  window.addEventListener('pomodoro:complete', handlePomodoroCompleteEvent)
  window.addEventListener('pomodoro:extend', handlePomodoroExtendEvent)
  window.addEventListener('pomodoro:skip', handlePomodoroSkipEvent)

  console.log('✅ Mobile app initialized')
})

onUnmounted(() => {
  stopPomodoroTimer()
})

// Pomodoro timer
function startPomodoroTimer() {
  stopPomodoroTimer()

  pomodoroInterval = setInterval(() => {
    if (!activePomodoro.value || activePomodoro.value.isPaused) return

    const elapsed = Date.now() - activePomodoro.value.startTime
    remainingTime.value = Math.max(0, activePomodoro.value.duration - Math.floor(elapsed / 1000))

    if (remainingTime.value === 0) {
      handlePomodoroComplete()
    }
  }, 100)
}

function stopPomodoroTimer() {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval)
    pomodoroInterval = null
  }
}

function pausePomodoro() {
  if (!activePomodoro.value) return
  // TODO: Implement pomodoro pause
}

function stopPomodoro() {
  activePomodoro.value = null
  stopPomodoroTimer()
}

function completePomodoro() {
  if (!activePomodoro.value?.taskId) return

  // Increment task's pomodoro count
  const taskId = activePomodoro.value.taskId
  const task = tasks.value.find(t => t.id === taskId)

  if (task) {
    taskStore.updateTask(taskId, {
      completedPomodoros: (task.completedPomodoros || 0) + 1
    })
  }

  // Show success notification
  notificationService.hapticSuccess()

  stopPomodoro()
}

function handlePomodoroComplete() {
  // Show notification
  notificationService.showCustomNotification(
    'Pomodoro Complete! 🍅',
    'Great work! Time for a break.',
    { type: 'pomodoro-complete' }
  )

  completePomodoro()
}

// Notification event handlers
function handlePomodoroCompleteEvent(event: Event) {
  const customEvent = event as CustomEvent
  console.log('Pomodoro complete event:', customEvent.detail)
  completePomodoro()
}

function handlePomodoroExtendEvent(event: Event) {
  const customEvent = event as CustomEvent
  console.log('Pomodoro extend event:', customEvent.detail)
  // TODO: Extend pomodoro by 5 minutes
}

function handlePomodoroSkipEvent(event: Event) {
  const customEvent = event as CustomEvent
  console.log('Pomodoro skip event:', customEvent.detail)
  stopPomodoro()
}

// Task handlers
function handleTaskClick(task: Task) {
  // TODO: Open task detail modal
  console.log('Task clicked:', task)
}

async function handleTaskComplete(taskId: string) {
  taskStore.updateTask(taskId, {
    status: 'done',
    updatedAt: new Date()
  })

  // Haptic feedback
  await notificationService.hapticSuccess()
}

async function handleTaskDelete(taskId: string) {
  // TODO: Show confirmation dialog
  taskStore.deleteTask(taskId)

  // Haptic feedback
  await notificationService.hapticFeedback('light')
}

async function handleRefresh() {
  // Reload from database
  await taskStore.loadFromDatabase()
  await notificationService.hapticFeedback('medium')
}

function handleCreateTask(taskData: {
  title: string
  projectId?: string
  priority: string
  dueDate?: number
}) {
  taskStore.createTask({
    title: taskData.title,
    status: 'planned',
    priority: taskData.priority as Task['priority'],
    projectId: taskData.projectId || '1',
    dueDate: taskData.dueDate ? format(new Date(taskData.dueDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  })

  // Haptic feedback
  notificationService.hapticSuccess()
}

// Helper functions
function formatDate(date: Date): string {
  return format(date, 'EEEE, MMMM d')
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function getTaskTitle(taskId: string): string {
  return tasks.value.find(t => t.id === taskId)?.title || 'Unknown task'
}
</script>

<style scoped>
.today-view {
  position: relative;
  height: 100vh;
  background: var(--neutral-900);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Header */
.view-header {
  padding: var(--space-4) var(--space-4) var(--space-3);
  background: var(--neutral-900);
  border-bottom: 1px solid var(--neutral-800);
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.view-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--neutral-100);
  margin-bottom: var(--space-1);
}

.view-subtitle {
  font-size: var(--text-sm);
  color: var(--neutral-500);
}

.sync-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--neutral-800);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  color: var(--neutral-400);
}

.sync-status.synced {
  color: var(--status-success);
}

.sync-status.syncing {
  color: var(--accent-blue);
}

.sync-status.offline {
  color: var(--neutral-500);
}

.progress-container {
  margin-top: var(--space-4);
}

.progress-bar {
  height: 6px;
  background: var(--neutral-800);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--space-2);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(to right, var(--accent-blue), var(--accent-purple));
  transition: width 0.3s ease;
}

.progress-text {
  font-size: var(--text-xs);
  color: var(--neutral-500);
  text-align: center;
}

/* Pomodoro Card */
.pomodoro-card {
  margin: var(--space-4);
  padding: var(--space-6);
  background: linear-gradient(135deg, var(--accent-red), var(--accent-orange));
  border-radius: var(--radius-xl);
  text-align: center;
  color: white;
}

.pomodoro-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.pomodoro-label {
  font-size: var(--text-sm);
  font-weight: 600;
  opacity: 0.9;
}

.pomodoro-stop {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: var(--radius-full);
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.pomodoro-stop:hover {
  background: rgba(255, 255, 255, 0.3);
}

.pomodoro-timer {
  font-size: 4rem;
  font-weight: 700;
  margin-bottom: var(--space-2);
  font-variant-numeric: tabular-nums;
}

.pomodoro-task {
  font-size: var(--text-sm);
  opacity: 0.9;
  margin-bottom: var(--space-6);
}

.pomodoro-actions {
  display: flex;
  gap: var(--space-3);
}

.pomodoro-button {
  flex: 1;
  padding: var(--space-3);
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.pomodoro-button.primary {
  background: white;
  color: var(--accent-red);
}

.pomodoro-button.secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.pomodoro-button:active {
  transform: scale(0.98);
}

/* Tasks Section */
.tasks-section {
  flex: 1;
  overflow-y: auto;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-4) var(--space-2);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--neutral-100);
}

.show-completed-button {
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--accent-blue);
  cursor: pointer;
  transition: all 0.2s;
}

.show-completed-button:hover {
  background: var(--neutral-800);
}

/* Floating Action Button */
.fab {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-4);
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-blue);
  border: none;
  border-radius: var(--radius-full);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.2s;
  z-index: 100;
}

.fab:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.fab:active {
  transform: scale(0.95);
}
</style>
