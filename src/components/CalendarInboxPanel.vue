<template>
  <div class="calendar-inbox-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="inbox-header">
      <button @click="isCollapsed = !isCollapsed" class="collapse-btn" :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'">
        <ChevronLeft v-if="!isCollapsed" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
      <h3 v-if="!isCollapsed" class="inbox-title">Inbox</h3>

      <!-- Expanded state count -->
      <span v-if="!isCollapsed" class="inbox-count">{{ inboxTasks.length }}</span>
    </div>

    <!-- Collapsed state task count indicators positioned under arrow -->
    <div v-if="isCollapsed" class="collapsed-badges-container">
      <!-- Show dual count when filter is active, single count when in default state -->
      <BaseBadge
        v-if="currentFilter === 'unscheduled'"
        variant="count"
        size="sm"
        rounded
      >
        {{ baseInboxTasks.length }}
      </BaseBadge>
      <div v-else class="dual-badges">
        <BaseBadge
          variant="count"
          size="sm"
          rounded
          class="total-count"
        >
          {{ baseInboxTasks.length }}
        </BaseBadge>
        <BaseBadge
          variant="info"
          size="sm"
          rounded
          class="filtered-count"
        >
          {{ inboxTasks.length }}
        </BaseBadge>
      </div>
    </div>

    <!-- Filter Toggle -->
    <div v-if="!isCollapsed" class="filter-toggle">
      <button
        v-for="option in filterOptions"
        :key="option.value"
        :class="['filter-btn', { active: currentFilter === option.value }]"
        @click="currentFilter = option.value"
        :title="option.label"
      >
        <span class="filter-icon">{{ option.icon }}</span>
      </button>
    </div>

    <!-- Quick Add -->
    <div v-if="!isCollapsed" class="quick-add">
      <input
        v-model="newTaskTitle"
        @keydown.enter="addTask"
        placeholder="Quick add task (Enter)..."
        class="quick-add-input"
      />
    </div>

    <!-- Inbox Task List -->
    <div v-if="!isCollapsed" class="inbox-tasks">
      <!-- Empty State -->
      <div v-if="inboxTasks.length === 0" class="empty-inbox">
        <div class="empty-icon">📋</div>
        <p class="empty-text">No tasks in inbox</p>
        <p class="empty-subtext">All tasks are scheduled</p>
      </div>

      <!-- Task Cards -->
      <div
        v-for="task in inboxTasks"
        :key="task.id"
        class="inbox-task-card"
        draggable="true"
        @click="handleTaskClick($event, task)"
        @dblclick="handleTaskDoubleClick(task)"
        @contextmenu.prevent="handleTaskContextMenu($event, task)"
        @dragstart="handleDragStart($event, task)"
      >
        <div class="priority-stripe" :class="`priority-stripe-${task.priority}`"></div>
        <div class="task-content">
          <div class="task-title">{{ task.title }}</div>
          <div class="task-meta">
            <span class="task-project">{{ getProjectName(task.projectId) }}</span>
            <span v-if="task.estimatedDuration" class="duration-badge">
              {{ task.estimatedDuration }}m
            </span>
          </div>
        </div>
        <!-- Quick Actions -->
        <div class="task-actions">
          <button
            class="action-btn"
            @click="handleStartTimer(task)"
            :title="`Start timer for ${task.title}`"
          >
            <Play :size="12" />
          </button>
          <button
            class="action-btn"
            @click="handleEditTask(task)"
            :title="`Edit ${task.title}`"
          >
            <Edit2 :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Add Task Button -->
    <div v-if="!isCollapsed" class="quick-add-task">
      <button
        class="add-task-btn"
        @click="handleQuickAddTask"
        title="Add new task to inbox"
      >
        <Plus :size="14" />
        Add Task
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import {
  ChevronLeft, ChevronRight, Play, Edit2, Plus
} from 'lucide-vue-next'
import BaseBadge from '@/components/base/BaseBadge.vue'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// State
const isCollapsed = ref(false)
const newTaskTitle = ref('')
const currentFilter = ref('unscheduled')

// Filter options
const filterOptions = [
  { value: 'today', label: 'Today', icon: '☀️' },
  { value: 'unscheduled', label: 'Unscheduled', icon: '📅' },
  { value: 'notOnCanvas', label: 'Not on Canvas', icon: '🎯' },
  { value: 'incomplete', label: 'Incomplete', icon: '⚡' },
  { value: 'allTasks', label: 'All Tasks', icon: '📋' }
]

// Computed
const baseInboxTasks = computed(() => {
  // Get all inbox tasks regardless of filter
  const allTasks = taskStore.tasks
  return allTasks.filter(task => {
    const isInInbox = task.isInInbox !== false && !task.canvasPosition && task.status !== 'done'
    return isInInbox
  })
})

const inboxTasks = computed(() => {
  // Use raw tasks instead of filteredTasks to avoid conflicts with smart views
  // Calendar inbox should work independently of smart view filtering
  const allTasks = taskStore.tasks

  
  const filtered = allTasks.filter(task => {
    // SIMPLIFIED: Check if task is in inbox (not scheduled on calendar)
    const isInInbox = task.isInInbox !== false && !task.canvasPosition && task.status !== 'done'

    // Filter logic based on current selection - simplified for dueDate only
    let passesFilter = false
    switch (currentFilter.value) {
      case 'today': {
        const todayStr = new Date().toISOString().split('T')[0]
        passesFilter = task.dueDate === todayStr && isInInbox
        break
      }
      case 'unscheduled':
        passesFilter = !task.dueDate && isInInbox
        break
      case 'notOnCanvas':
        passesFilter = !task.canvasPosition && isInInbox
        break
      case 'incomplete':
        passesFilter = task.status !== 'done' && isInInbox
        break
      case 'allTasks':
        passesFilter = isInInbox
        break
      default:
        passesFilter = !task.dueDate && isInInbox
    }

    // Debug: Log filter reasoning
    console.log(`🔍 [${currentFilter.value}] Task "${task.title}":`, {
      passesFilter,
      dueDate: task.dueDate,
      status: task.status,
      canvasPosition: !!task.canvasPosition,
      isInInbox
    })

    return passesFilter
  })

  console.log(`🔍 DEBUG [${currentFilter.value}]: ${filtered.length} tasks in inbox:`, filtered.map(t => t.title))
  return filtered
})

// Methods
const getProjectName = (projectId: string) => {
  const project = taskStore.getProjectById(projectId)
  return project?.name || 'My Tasks'
}

const addTask = () => {
  if (!newTaskTitle.value.trim()) return

  taskStore.createTask({
    title: newTaskTitle.value.trim(),
    description: '',
    status: 'planned',
    projectId: '1', // Default project
    isInInbox: true
  })

  newTaskTitle.value = ''
}

const handleTaskClick = (event: MouseEvent, task: Task) => {
  // Allow friction-free dragging
}

const handleTaskDoubleClick = (task: Task) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: task.id }
  }))
}

const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
  event.preventDefault()
  event.stopPropagation()

  window.dispatchEvent(new CustomEvent('task-context-menu', {
    detail: {
      event,
      task,
      instanceId: undefined,
      isCalendarEvent: false
    }
  }))
}

const handleDragStart = (event: DragEvent, task: Task) => {
  if (!event.dataTransfer) return

  // DEBUG LOG: Track task drag from inbox
  console.log(`🚀 INBOX DRAG START: Task "${task.title}" (ID: ${task.id})`)
  console.log(`🚀 INBOX DRAG START: Task inbox status:`, task.isInInbox)
  console.log(`🚀 INBOX DRAG START: Task instances:`, task.instances?.length || 0)

  // Match canvas panel drag data format exactly
  const dragData = {
    taskIds: [task.id], // Array format for consistency
    fromInbox: true,
    taskId: task.id, // Single task ID for backward compatibility
    title: task.title,
    source: 'calendar-inbox'
  }

  // Set multiple data formats for cross-browser compatibility
  const dataString = JSON.stringify(dragData)
  event.dataTransfer.setData('application/json', dataString)
  event.dataTransfer.setData('text/plain', dataString)
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.dropEffect = 'move'

  // Visual feedback
  if (event.target instanceof HTMLElement) {
    event.target.style.opacity = '0.5'
    setTimeout(() => {
      if (event.target instanceof HTMLElement) {
        event.target.style.opacity = '1'
      }
    }, 100)
  }
}

const handleStartTimer = (task: Task) => {
  timerStore.startTimer(task.id)
}

const handleEditTask = (task: Task) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: task.id }
  }))
}

const handleQuickAddTask = () => {
  // Open QuickTaskCreate modal instead of creating hardcoded task
  window.dispatchEvent(new CustomEvent('open-quick-task-create', {
    detail: {
      defaultProjectId: '1',
      defaultPriority: 'medium',
      estimatedDuration: 30
    }
  }))
}
</script>

<style scoped>
/* UNIFIED DESIGN SYSTEM - Outlined + Glass with Green Accent */

.calendar-inbox-panel {
  width: 320px;
  margin: var(--space-4) 0 var(--space-4) var(--space-4);
  max-height: calc(100vh - 220px);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow: visible;
  transition: width var(--duration-normal) var(--spring-smooth), padding var(--duration-normal);
  /* Clean solid background matching target design */
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 16px; /* Moderate rounded corners */
  box-shadow: var(--shadow-sm);
}

.calendar-inbox-panel.collapsed {
  width: 60px;
  padding: var(--space-4) var(--space-2);
}

.inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.collapse-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow);
}

.inbox-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  flex: 1;
}

.inbox-count {
  background: var(--glass-bg-heavy);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.collapsed-badges-container {
  @apply flex flex-col items-center gap-1;
  margin-top: var(--space-2);
  width: 100%;
  overflow: visible;
}

.dual-badges {
  @apply flex flex-col items-center gap-1;
}

.dual-badges .total-count {
  @apply opacity-70;
}

.dual-badges .filtered-count {
  @apply scale-90;
}

.filter-toggle {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  padding: var(--space-1);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.filter-toggle::-webkit-scrollbar {
  display: none;
}

.filter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 32px;
  height: 32px;
}

.filter-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-medium);
  color: var(--text-secondary);
  transform: translateY(-1px);
}

.filter-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow);
}

.filter-icon {
  font-size: var(--text-base);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-add {
  margin-bottom: var(--space-2);
}

.quick-add-input {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.quick-add-input:focus {
  outline: none;
  border-color: var(--state-active-border);
  background: var(--glass-bg-soft);
  box-shadow: var(--state-hover-shadow);
}

.quick-add-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.inbox-tasks {
  flex: 1;
  overflow-x: visible;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  margin: calc(var(--space-2) * -1) calc(var(--space-4) * -1);
}

.empty-inbox {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  color: var(--text-muted);
}

.empty-icon {
  font-size: var(--text-4xl);
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.empty-text {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin: 0 0 var(--space-1) 0;
}

.empty-subtext {
  font-size: var(--text-xs);
  margin: 0;
  opacity: 0.7;
}

/* Unified card styling - subtle at rest, vibrant on hover */
.inbox-task-card {
  position: relative;
  padding: var(--space-4);
  margin-bottom: var(--space-1);
  cursor: move;
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.inbox-task-card:last-child {
  margin-bottom: 0;
}

.inbox-task-card:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  transform: translateY(-2px) scale(1.01);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
  z-index: 10;
}

/* Hover state: Enhanced visibility */
.inbox-task-card:hover .task-title {
  color: var(--text-primary);
}

.inbox-task-card:hover .task-meta {
  opacity: 0.95;
}

.priority-stripe {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.priority-stripe.priority-high {
  background: linear-gradient(180deg, var(--color-priority-high) 0%, #ff6b6b 100%);
  box-shadow: 0 0 6px rgba(255, 107, 107, 0.3);
}

.priority-stripe.priority-medium {
  background: linear-gradient(180deg, var(--color-priority-medium) 0%, #feca57 100%);
  box-shadow: 0 0 6px rgba(254, 202, 87, 0.3);
}

.priority-stripe.priority-low {
  background: linear-gradient(180deg, var(--color-priority-low) 0%, #48dbfb 100%);
  box-shadow: 0 0 6px rgba(72, 219, 251, 0.3);
}

.priority-stripe.priority-none {
  background: var(--glass-bg-heavy);
}

.task-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  transition: color var(--duration-normal);
  margin-bottom: var(--space-1);
  word-wrap: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.task-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--text-xs);
  color: var(--text-muted);
  transition: opacity var(--duration-normal);
}

.task-project {
  background: var(--glass-bg-heavy);
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  font-weight: var(--font-medium);
}

.duration-badge {
  display: flex;
  align-items: center;
  gap: 2px;
}

.task-actions {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}

.inbox-task-card:hover .task-actions {
  opacity: 1;
}

.action-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) ease;
  flex-shrink: 0;
}

.action-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-medium);
  color: var(--text-secondary);
  transform: scale(1.05);
}

.quick-add-task {
  border-top: 1px solid var(--glass-bg-heavy);
  padding-top: var(--space-3);
  margin-top: var(--space-3);
}

.add-task-btn {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.add-task-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-medium);
  color: var(--text-secondary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.add-task-btn:active {
  transform: translateY(0);
}

/* Unified scrollbar styling */
.inbox-tasks::-webkit-scrollbar {
  width: 6px;
}

.inbox-tasks::-webkit-scrollbar-track {
  background: transparent;
}

.inbox-tasks::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
  transition: background var(--duration-fast);
}

.inbox-tasks::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

.inbox-tasks {
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}
</style>