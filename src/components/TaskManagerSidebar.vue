<template>
  <div class="task-sidebar">
    <!-- Sidebar Header -->
    <div class="sidebar-header">
      <div class="header-title">
        <ListTodo :size="16" :stroke-width="1.5" class="header-icon" />
        <span class="title-text">Tasks</span>
        <span class="task-count-badge">{{ filteredTasks.length }}</span>
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
          :class="{ 'search-focused': searchFocused }"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        />
        <div class="search-shortcut" v-if="!searchQuery">⌘K</div>
      </div>

      <div class="filter-tabs">
        <button
          v-for="filter in filters"
          :key="filter.key"
          class="filter-tab icon-only"
          :class="{ active: activeFilter === filter.key }"
          @click="activeFilter = filter.key"
          :title="filter.label"
        >
          <Inbox v-if="filter.key === 'all'" :size="16" />
          <Clock v-else-if="filter.key === 'unscheduled'" :size="16" />
          <Calendar v-else-if="filter.key === 'scheduled'" :size="16" />
        </button>

        <!-- Status Filters -->
        <button
          class="filter-tab icon-only status-filter"
          :class="{ active: taskStore.activeStatusFilter === null }"
          @click="taskStore.setActiveStatusFilter(null)"
          title="All Statuses"
        >
          <ListTodo :size="16" />
        </button>
        <button
          class="filter-tab icon-only status-filter"
          :class="{ active: taskStore.activeStatusFilter === 'planned' }"
          @click="taskStore.setActiveStatusFilter('planned')"
          title="Planned"
        >
          <Calendar :size="16" />
        </button>
        <button
          class="filter-tab icon-only status-filter"
          :class="{ active: taskStore.activeStatusFilter === 'in_progress' }"
          @click="taskStore.setActiveStatusFilter('in_progress')"
          title="In Progress"
        >
          <Play :size="16" />
        </button>
        <button
          class="filter-tab icon-only status-filter"
          :class="{ active: taskStore.activeStatusFilter === 'done' }"
          @click="taskStore.setActiveStatusFilter('done')"
          title="Completed"
        >
          <Check :size="16" />
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
        v-for="task in rootTasks"
        :key="task.id"
        class="hierarchical-task-container"
      >
        <!-- Parent task with expand/collapse -->
        <div
          class="sidebar-task hierarchical-parent-task"
          :class="{
            scheduled: task.scheduledDate,
            'has-children': taskStore.hasNestedTasks(task.id),
            expanded: expandedTasks.has(task.id)
          }"
          draggable="true"
          @dragstart="handleDragStart($event, task)"
          @dblclick="$emit('editTask', task.id)"
          @contextmenu="handleContextMenu($event, task)"
        >
          <!-- Task content with expand/collapse -->
          <div class="task-content-horizontal">
            <!-- Expand/collapse chevron -->
            <div
              v-if="taskStore.hasNestedTasks(task.id)"
              class="expand-chevron"
              :class="{ 'expanded': expandedTasks.has(task.id) }"
              @click.stop="toggleTaskExpand(task.id)"
            >
              <ChevronRight :size="14" :stroke-width="1.5" />
            </div>
            <div v-else class="expand-spacer"></div>

            <!-- Left side: Task info -->
            <div class="task-info">
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
                  <span v-if="taskStore.hasNestedTasks(task.id)" class="children-badge" :title="`${taskStore.getTaskChildren(task.id).length} nested task(s)`">
                    {{ taskStore.getTaskChildren(task.id).length }}
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
                <span v-if="task.scheduledDate" class="scheduled-time-inline">
                  <Calendar :size="12" :stroke-width="1.5" />
                  {{ formatScheduledTime(task) }}
                </span>
              </div>
            </div>

            <!-- Right side: Action buttons -->
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
        </div>

        <!-- Nested tasks (only show when parent is expanded) -->
        <Transition name="nested-tasks">
          <div v-if="expandedTasks.has(task.id)" class="nested-tasks-sidebar">
          <div
            v-for="childTask in taskStore.getTaskChildren(task.id)"
            :key="childTask.id"
            class="sidebar-task nested-task"
            :class="{ scheduled: childTask.scheduledDate }"
            draggable="true"
            @dragstart="handleDragStart($event, childTask)"
            @dblclick="$emit('editTask', childTask.id)"
            @contextmenu="handleContextMenu($event, childTask)"
          >
            <div class="task-content-horizontal">
              <!-- Indent spacer for nested tasks -->
              <div class="indent-spacer"></div>

              <!-- Left side: Task info -->
              <div class="task-info">
                <div class="task-title-row">
                  <span class="task-title">{{ childTask.title }}</span>
                  <div class="task-badges">
                    <span v-if="childTask.scheduledDate" class="scheduled-badge" title="Scheduled">
                      <Clock :size="12" :stroke-width="1.5" />
                    </span>
                    <span v-if="getTaskInstances(childTask).length > 0" class="instance-badge" :title="`${getTaskInstances(childTask).length} calendar instance(s)`">
                      {{ getTaskInstances(childTask).length }}×
                    </span>
                    <span class="priority-badge" :class="childTask.priority" v-if="childTask.priority !== 'medium'">
                      <Flag :size="12" :stroke-width="1.5" />
                    </span>
                  </div>
                </div>
                <div class="task-meta">
                  <span class="pomodoro-count">
                    <Timer :size="12" :stroke-width="1.5" />
                    {{ childTask.completedPomodoros }}
                  </span>
                  <span v-if="childTask.subtasks.length > 0" class="subtask-count">
                    {{ completedSubtasks(childTask) }}/{{ childTask.subtasks.length }}
                  </span>
                  <span v-if="childTask.scheduledDate" class="scheduled-time-inline">
                    <Calendar :size="12" :stroke-width="1.5" />
                    {{ formatScheduledTime(childTask) }}
                  </span>
                </div>
              </div>

              <!-- Right side: Action buttons -->
              <div class="task-actions">
                <button
                  class="action-btn start-timer"
                  @click="$emit('startTimer', childTask.id)"
                  title="Start Timer"
                >
                  <Play :size="12" :stroke-width="1.5" />
                </button>
                <button
                  class="action-btn edit-task"
                  @click="$emit('editTask', childTask.id)"
                  title="Edit Task"
                >
                  <Edit :size="12" :stroke-width="1.5" />
                </button>
              </div>
            </div>
          </div>
          </div>
        </Transition>
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
  Play, Edit, Inbox, ChevronRight, Check
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
const searchFocused = ref(false)

// Hierarchical task state
const expandedTasks = ref<Set<string>>(new Set())

// Toggle task expansion
const toggleTaskExpand = (taskId: string) => {
  if (expandedTasks.value.has(taskId)) {
    expandedTasks.value.delete(taskId)
  } else {
    expandedTasks.value.add(taskId)
  }
}

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

// Root tasks (tasks without parentTaskId) from filtered tasks
const rootTasks = computed(() => {
  return filteredTasks.value.filter(task => !task.parentTaskId)
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
  border-radius: var(--radius-xl); /* Moderate rounded corners */
  display: flex;
  flex-direction: column;
  max-height: 100%;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-4); /* Match calendar header vertical padding */
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
  color: var(--text-secondary);
}

.title-text {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  font-size: var(--text-base);
}

.task-count-badge {
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
  inset-inline-start: var(--space-4); /* RTL: icon at start */
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-input {
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-bg-heavy);
  color: var(--text-primary);
  padding-block: var(--space-3);
  padding-inline-end: var(--space-4);
  padding-inline-start: calc(var(--space-4) + 2rem); /* RTL: space for icon */
  border-radius: var(--radius-xl);
  width: 100%;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
  /* RTL support */
  text-align: start;
  direction: inherit;
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

.search-input.search-focused {
  border-color: var(--calendar-creating-border);
  background: var(--glass-bg-soft);
  box-shadow: var(--calendar-creating-bg);
}

.search-shortcut {
  position: absolute;
  inset-inline-end: var(--space-4); /* RTL: shortcut at end */
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  background: var(--glass-bg-heavy);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  opacity: 0.7;
  transition: all var(--duration-fast) var(--spring-smooth);
  pointer-events: none;
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

.filter-tab.icon-only {
  padding: var(--space-2);
  min-width: 36px;
  min-height: 36px;
  justify-content: center;
  display: flex;
  align-items: center;
}

.filter-tab:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.filter-tab.active {
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  color: white;
  font-weight: var(--font-semibold);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* Status filters - visual separation from schedule filters */
.filter-tab.status-filter {
  border-inline-start: 1px solid var(--glass-border); /* RTL: border at start */
  margin-inline-start: 2px; /* RTL: margin at start */
  padding-inline-start: 3px; /* RTL: padding at start */
}

.filter-tab.status-filter:hover {
  background: var(--glass-bg-heavy);
  border-inline-start-color: var(--brand-primary); /* RTL: border color at start */
}

.filter-tab.status-filter.active {
  background: var(--brand-primary-bg-subtle);
  border-inline-start-color: var(--brand-primary-border-medium); /* RTL: border color at start */
  color: var(--brand-primary);
}

.task-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
  transition: all var(--duration-normal) var(--spring-smooth);
  border-radius: var(--radius-2xl); /* Rounded edges for the task list container */
  margin: var(--space-2); /* Add margin for visual separation */
}

.task-list.drag-over {
  background: var(--surface-secondary);
  border: 2px dashed var(--color-success);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.sidebar-task {
  background: var(--surface-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl); /* Moderate rounding - not too much */
  padding: var(--space-2);
  margin-bottom: var(--space-2);
  cursor: move;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
  overflow: hidden; /* Clip content to rounded borders */
}

.sidebar-task:hover {
  background: var(--surface-hover);
  border-color: var(--border-medium);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.sidebar-task.scheduled {
  border-inline-start: 3px solid var(--color-success); /* RTL: border at start */
  border-start-start-radius: var(--radius-xl); /* RTL: top-left in LTR, top-right in RTL */
  border-end-start-radius: var(--radius-xl); /* RTL: bottom-left in LTR, bottom-right in RTL */
  box-shadow:
    var(--shadow-md),
    var(--calendar-current-time-glow);
}

/* New horizontal layout structure */
.task-content-horizontal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.125rem;
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
  color: white;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  background: var(--calendar-creating-bg);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
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
  flex-wrap: wrap;
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

.scheduled-time-inline {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-success);
  font-size: var(--text-xs);
}

.task-actions {
  display: flex;
  gap: 0.5rem;
  opacity: 1; /* Always visible */
  flex-shrink: 0;
}

.action-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-1);
  border-radius: var(--radius-lg);
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
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
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
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.empty-action:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* Hierarchical Task Styles */
.hierarchical-task-container {
  width: 100%;
  margin-bottom: var(--space-2);
}

.hierarchical-parent-task {
  position: relative;
}

.hierarchical-parent-task.has-children {
  border-inline-start: 3px solid var(--brand-primary); /* RTL: border at start */
  border-start-start-radius: var(--radius-xl); /* RTL: top-left → top-right */
  border-end-start-radius: var(--radius-xl); /* RTL: bottom-left → bottom-right */
}

.hierarchical-parent-task.has-children.expanded {
  border-inline-start-color: var(--state-active-border); /* RTL: border color at start */
  box-shadow:
    var(--shadow-md),
    var(--state-hover-glow);
}

.expand-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
  transition: transform var(--duration-fast) var(--spring-smooth);
  cursor: pointer;
  border-radius: var(--radius-sm);
  margin-inline-end: var(--space-1); /* RTL: margin at end */
  flex-shrink: 0;
}

.expand-chevron:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.expand-chevron.expanded {
  transform: rotate(90deg);
}

.hierarchical-parent-task.has-children .expand-chevron {
  color: var(--brand-primary);
}

.expand-spacer {
  width: 17px; /* Same width as expand-chevron */
  margin-inline-end: var(--space-1); /* RTL: margin at end */
  flex-shrink: 0;
}

.children-badge {
  background-color: var(--brand-primary);
  color: white;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  min-width: 18px;
  text-align: center;
}

.nested-tasks-sidebar {
  margin-inline-start: var(--space-4); /* RTL: margin at start */
  margin-top: var(--space-1);
  border-inline-start: 2px solid var(--border-subtle); /* RTL: border at start */
  padding-inline-start: var(--space-2); /* RTL: padding at start */
  padding-bottom: var(--space-1);
}

.nested-task {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  margin-bottom: var(--space-1);
}

.nested-task:hover {
  background: var(--surface-hover);
  border-color: var(--border-medium);
}

.indent-spacer {
  width: 20px;
  margin-inline-end: var(--space-1); /* RTL: margin at end */
  flex-shrink: 0;
}

/* Vue Transition for nested tasks expand/collapse */
.nested-tasks-enter-active,
.nested-tasks-leave-active {
  transition: all var(--duration-normal) var(--spring-smooth);
  overflow: hidden;
}

.nested-tasks-enter-from {
  opacity: 0;
  max-height: 0;
  transform: scaleY(0) translateY(-var(--space-4));
}

.nested-tasks-leave-to {
  opacity: 0;
  max-height: 0;
  transform: scaleY(0) translateY(-var(--space-4));
}

.nested-tasks-enter-to,
.nested-tasks-leave-from {
  opacity: 1;
  max-height: 500px; /* Sufficient height for typical nested tasks */
  transform: scaleY(1) translateY(0);
}

/* Design tokens provide universal theming - Updated with reduced vertical spacing */
</style>