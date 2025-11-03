<template>
  <div class="task-sidebar">
    <!-- Sidebar Header -->
    <div class="sidebar-header">
      <div class="header-title">
        <ListTodo :size="16" :stroke-width="1.5" class="header-icon" />
        <span class="title-text">Tasks</span>
      </div>
      <button class="add-task-btn" @click="$emit('addTask')" title="Add new task">
        <Plus :size="16" :stroke-width="1.5" />
      </button>
    </div>

    <!-- Search & Filter -->
    <div class="sidebar-controls">
      <div class="search-box">
        <Search :size="14" :stroke-width="1.5" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search tasks..."
          class="search-input"
        />
      </div>

      <div class="filter-tabs">
        <button
          v-for="filter in filters"
          :key="filter.key"
          class="filter-tab"
          :class="{ active: activeFilter === filter.key }"
          @click="activeFilter = filter.key"
        >
          {{ filter.label }}
        </button>
      </div>
    </div>

    <!-- Task List - Drop zone to unschedule tasks -->
    <div
      class="task-list"
      @drop="handleDrop"
      @dragover.prevent
      @dragenter="isDragOver = true"
      @dragleave="isDragOver = false"
      :class="{ 'drag-over': isDragOver }"
    >
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="sidebar-task"
        :class="{ scheduled: task.scheduledDate }"
        draggable="true"
        @dragstart="handleDragStart($event, task)"
        @dblclick="$emit('editTask', task.id)"
        @contextmenu="handleContextMenu($event, task)"
      >
        <!-- Task Header -->
        <div class="task-header">
          <div class="task-title-row">
            <span class="task-title">{{ task.title }}</span>
            <div class="task-badges">
              <span v-if="task.scheduledDate" class="scheduled-badge" title="Scheduled">
                <Clock :size="12" :stroke-width="1.5" />
              </span>
              <span v-if="getTaskInstances(task).length > 0" class="instance-badge" :title="`${getTaskInstances(task).length} calendar instance(s)`">
                {{ getTaskInstances(task).length }}×
              </span>
              <span class="priority-badge" :class="task.priority" v-if="task.priority !== 'medium'">
                <Flag :size="12" :stroke-width="1.5" />
              </span>
            </div>
          </div>
          <div class="task-meta">
            <span class="pomodoro-count">
              <Timer :size="12" :stroke-width="1.5" />
              {{ task.completedPomodoros }}
            </span>
            <span v-if="task.subtasks.length > 0" class="subtask-count">
              {{ completedSubtasks(task) }}/{{ task.subtasks.length }}
            </span>
          </div>
        </div>

        <!-- Scheduled Time Display -->
        <div v-if="task.scheduledDate" class="scheduled-time">
          <Calendar :size="12" :stroke-width="1.5" />
          <span>{{ formatScheduledTime(task) }}</span>
        </div>

        <!-- Quick Actions -->
        <div class="task-actions">
          <button
            class="action-btn start-timer"
            @click="$emit('startTimer', task.id)"
            title="Start Timer"
          >
            <Play :size="12" :stroke-width="1.5" />
          </button>
          <button
            class="action-btn edit-task"
            @click="$emit('editTask', task.id)"
            title="Edit Task"
          >
            <Edit :size="12" :stroke-width="1.5" />
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredTasks.length === 0" class="empty-state">
        <div class="empty-icon">
          <ListTodo :size="32" :stroke-width="1.5" />
        </div>
        <p class="empty-message">No tasks found</p>
        <button class="empty-action" @click="$emit('addTask')">
          <Plus :size="16" :stroke-width="1.5" />
          Create your first task
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore, getTaskInstances } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'
import {
  ListTodo, Plus, Search, Clock, Flag, Timer, Calendar,
  Play, Edit
} from 'lucide-vue-next'

defineEmits<{
  addTask: []
  startTimer: [taskId: string]
  editTask: [taskId: string]
}>()

const taskStore = useTaskStore()

// Search and filtering
const searchQuery = ref('')
const activeFilter = ref('all')
const isDragOver = ref(false)

const filters = [
  { key: 'all', label: 'All' },
  { key: 'unscheduled', label: 'Unscheduled' },
  { key: 'scheduled', label: 'Scheduled' }
]

// Computed
const filteredTasks = computed(() => {
  let tasks = taskStore.filteredTasks

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    tasks = tasks.filter(task =>
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query)
    )
  }

  // Apply status filter
  switch (activeFilter.value) {
    case 'unscheduled':
      tasks = tasks.filter(task => !task.scheduledDate)
      break
    case 'scheduled':
      tasks = tasks.filter(task => task.scheduledDate)
      break
  }

  return tasks
})

// Helper functions
const completedSubtasks = (task: Task) => {
  return task.subtasks?.filter(st => st.isCompleted).length || 0
}

const formatScheduledTime = (task: Task) => {
  if (!task.scheduledDate) return ''

  const date = new Date(task.scheduledDate)
  const time = task.scheduledTime || ''

  if (time) {
    return `${date.toLocaleDateString()} ${time}`
  }
  return date.toLocaleDateString()
}

const handleDragStart = (event: DragEvent, task: Task) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify({
      type: 'task',
      taskId: task.id,
      title: task.title
    }))
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleContextMenu = (event: MouseEvent, task: Task) => {
  event.preventDefault()
  event.stopPropagation()

  // Dispatch custom event for App.vue to handle
  window.dispatchEvent(new CustomEvent('task-context-menu', {
    detail: { event, task }
  }))
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false

  console.log('📥 Drop event received in sidebar')

  const data = event.dataTransfer?.getData('application/json')
  console.log('📦 Drag data:', data)

  if (!data) {
    console.log('❌ No drag data found')
    return
  }

  try {
    const dragData = JSON.parse(data)
    console.log('📋 Parsed drag data:', dragData)

    // Check if this is a calendar event being unscheduled
    if (dragData.taskId && dragData.instanceId) {
      // Delete the task instance to unschedule it
      taskStore.deleteTaskInstance(dragData.taskId, dragData.instanceId)
      console.log('✅ Task unscheduled:', dragData.taskId, dragData.instanceId)
    } else {
      console.log('❌ Missing taskId or instanceId in drag data')
    }
  } catch (error) {
    console.error('❌ Error parsing drag data:', error)
  }
}
</script>

<style scoped>
.task-sidebar {
  width: 300px;
  background: var(--surface-secondary); /* Clean solid background */
  border: 1px solid var(--border-subtle); /* Subtle stroke border */
  border-radius: 16px; /* Moderate rounded corners */
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--glass-bg-heavy);
  background: linear-gradient(
    180deg,
    var(--glass-bg-tint) 0%,
    transparent 100%
  );
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  color: var(--brand-primary);
}

.title-text {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  font-size: var(--text-base);
}

.add-task-btn {
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.add-task-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

.sidebar-controls {
  padding: var(--space-4);
  border-bottom: 1px solid var(--glass-bg-heavy);
}

.search-box {
  position: relative;
  margin-bottom: var(--space-4);
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-input {
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-bg-heavy);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4) var(--space-3) calc(var(--space-4) + 2rem);
  border-radius: var(--radius-xl);
  width: 100%;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.search-input:focus {
  outline: none;
  border-color: var(--calendar-creating-border);
  background: var(--glass-bg-soft);
  box-shadow: var(--calendar-creating-bg);
}

.search-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.filter-tabs {
  display: flex;
  gap: 0.25rem;
}

.filter-tab {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.filter-tab:hover {
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
}

.filter-tab.active {
  background: linear-gradient(
    135deg,
    var(--purple-bg-subtle) 0%,
    var(--purple-bg-subtle) 100%
  );
  color: white;
  box-shadow:
    var(--calendar-today-badge-shadow);
}

.task-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
  transition: all var(--duration-normal) var(--spring-smooth);
  border-radius: 24px; /* Rounded edges for the task list container */
  margin: var(--space-2); /* Add margin for visual separation */
}

.task-list.drag-over {
  background: linear-gradient(
    135deg,
    var(--success-bg-start) 0%,
    var(--glass-bg-heavy) 100%
  );
  border: 2px dashed var(--color-success);
  border-radius: var(--radius-lg);
}

.sidebar-task {
  background: var(--surface-primary);
  border: 1px solid var(--border-subtle);
  border-radius: 16px; /* Moderate rounding - not too much */
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  cursor: move;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
  overflow: hidden; /* Clip content to rounded borders */
}

.sidebar-task:hover {
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-medium) 100%
  );
  border-color: var(--glass-border-medium);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.sidebar-task.scheduled {
  border-left: 3px solid var(--color-success);
  border-top-left-radius: 16px; /* Maintain rounded corner with thick border */
  border-bottom-left-radius: 16px; /* Maintain rounded corner with thick border */
  box-shadow:
    var(--shadow-md),
    var(--calendar-current-time-glow);
}

.task-header {
  margin-bottom: 0.5rem;
}

.task-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.25rem;
}

.task-title {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: var(--leading-tight);
  flex: 1;
}

.task-badges {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}

.scheduled-badge {
  color: var(--color-success);
  display: flex;
  align-items: center;
}

.instance-badge {
  color: var(--brand-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  background: var(--calendar-creating-bg);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
}

.priority-badge {
  display: flex;
  align-items: center;
}

.priority-badge.high {
  color: var(--priority-high);
}

.priority-badge.low {
  color: var(--priority-low);
}

.task-meta {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.pomodoro-count {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.subtask-count {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.scheduled-time {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-success);
  font-size: var(--text-xs);
  margin-bottom: var(--space-2);
}

.task-actions {
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 150ms ease;
}

.sidebar-task:hover .task-actions {
  opacity: 1;
}

.action-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-1);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.action-btn.start-timer:hover {
  background: var(--color-work);
  border-color: var(--color-work);
  color: var(--state-active-text);
}

.action-btn.edit-task:hover {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: var(--state-active-text);
}

.empty-state {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  color: var(--text-subtle);
}

.empty-icon {
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-message {
  font-size: var(--text-sm);
  margin-bottom: 1rem;
}

.empty-action {
  background: linear-gradient(
    135deg,
    var(--calendar-today-badge-start) 0%,
    var(--calendar-today-badge-end) 100%
  );
  border: 1px solid var(--purple-border-medium);
  color: white;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-xl);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 auto;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow:
    0 8px 16px var(--purple-border-medium),
    0 0 20px var(--purple-glow-subtle);
}

.empty-action:hover {
  background: linear-gradient(
    135deg,
    var(--calendar-today-badge-start) 0%,
    var(--calendar-today-badge-end) 100%
  );
  transform: translateY(-2px);
  box-shadow:
    0 12px 24px var(--calendar-creating-border),
    0 0 30px var(--purple-border-medium);
}

/* Design tokens provide universal theming */
</style>