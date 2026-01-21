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
        :class="['mobile-task-item', { 'timer-active': isTimerActive(task.id) }]"
        @click="handleTaskClick(task)"
      >
        <div class="task-checkbox" @click.stop="toggleTask(task)">
          <div :class="['checkbox-circle', { checked: task.status === 'done' }]">
            <Check v-if="task.status === 'done'" :size="14" />
          </div>
        </div>

        <div class="task-content">
          <span :class="['task-title', { done: task.status === 'done' }]">{{ task.title }}</span>
          <div class="task-meta">
            <span v-if="task.priority && task.priority !== 'none'" :class="['priority-badge', task.priority]">
              {{ priorityLabel(task.priority) }}
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useTimerStore } from '@/stores/timer'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
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

// Debug info
const authStatus = computed(() => authStore.isAuthenticated ? 'Signed in' : 'Not signed in')
const userId = computed(() => authStore.user?.id?.substring(0, 8) + '...' || null)
const syncError = computed(() => lastSyncError.value)

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
  console.log('Task clicked', task.id)
  // Could open task detail modal
}

const startTimer = (task: Task) => {
  timerStore.startTimer(task.id, task.title)
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
  transition: transform 0.1s;
}

.mobile-task-item:active {
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
