<template>
  <div class="calendar-inbox-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="inbox-header">
      <button class="collapse-btn" :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'" @click="isCollapsed = !isCollapsed">
        <ChevronLeft v-if="!isCollapsed" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
      <h3 v-if="!isCollapsed" class="inbox-title">
        Inbox
      </h3>

      <!-- Expanded state count -->
      <span v-if="!isCollapsed" class="inbox-count">{{ inboxTasks.length }}</span>
    </div>

    <!-- Collapsed state task count indicators positioned under arrow -->
    <div v-if="isCollapsed" class="collapsed-badges-container">
      <!-- Show dual count when filter is active, single count when no filter -->
      <BaseBadge
        v-if="currentFilter === 'allTasks'"
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
        class="filter-btn"
        :class="[{ active: currentFilter === option.value }]"
        :title="option.label"
        @click="currentFilter = option.value"
      >
        <span class="filter-icon">{{ option.icon }}</span>
      </button>
    </div>

    <!-- Quick Add -->
    <div v-if="!isCollapsed" class="quick-add">
      <input
        v-model="newTaskTitle"
        placeholder="Quick add task (Enter)..."
        class="quick-add-input"
        @keydown.enter="addTask"
      >
    </div>

    <!-- Inbox Task List -->
    <div v-if="!isCollapsed" class="inbox-tasks">
      <!-- Empty State -->
      <div v-if="inboxTasks.length === 0" class="empty-inbox">
        <div class="empty-icon">
          📋
        </div>
        <p class="empty-text">
          No tasks in inbox
        </p>
        <p class="empty-subtext">
          All tasks are scheduled
        </p>
      </div>

      <!-- Task Cards with native HTML5 drag-drop (NOT vuedraggable - per PomoFlow spec) -->
      <div class="inbox-task-list">
        <div
          v-for="task in inboxTasks"
          :key="task.id"
          class="inbox-task-card"
          draggable="true"
          :class="{ 'is-dragging': draggingTaskId === task.id }"
          @dragstart="onDragStart($event, task)"
          @dragend="onDragEnd"
          @click="handleTaskClick($event, task)"
          @dblclick="handleTaskDoubleClick(task)"
          @contextmenu.prevent="handleTaskContextMenu($event, task)"
        >
          <div class="priority-stripe" :class="`priority-stripe-${task.priority}`" />

          <!-- Timer Active Badge -->
          <div v-if="isTimerActive(task.id)" class="timer-indicator" title="Timer Active">
            <Timer :size="12" />
          </div>

          <div class="task-content">
            <div class="task-title">
              {{ task.title }}
            </div>

            <!-- Enhanced metadata section -->
            <div class="task-metadata">
              <!-- Status badge -->
              <span class="status-badge">{{ statusLabel(task.status) }}</span>

              <!-- Due date badge -->
              <span v-if="task.dueDate" class="due-date-badge" title="Due Date">
                <Calendar :size="12" />
                {{ task.dueDate }}
              </span>

              <!-- Project visual indicator -->
              <span
                class="project-emoji-badge"
                :class="[`project-visual--${projectVisual(task.projectId).type}`, { 'project-visual--colored': projectVisual(task.projectId).type === 'css-circle' }]"
                :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
              >
                <ProjectEmojiIcon
                  v-if="projectVisual(task.projectId).type === 'emoji'"
                  :emoji="projectVisual(task.projectId).content"
                  size="sm"
                  :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
                />
                <span
                  v-else-if="projectVisual(task.projectId).type === 'css-circle'"
                  class="project-emoji project-css-circle"
                  :style="{ '--project-color': projectVisual(task.projectId).color }"
                >
                  {{ projectVisual(task.projectId).content }}
                </span>
                <span v-else class="project-emoji">{{ projectVisual(task.projectId).content }}</span>
              </span>

              <!-- Duration badge -->
              <span v-if="task.estimatedDuration" class="duration-badge">
                {{ task.estimatedDuration }}m
              </span>
            </div>
          </div>
          <!-- Quick Actions -->
          <div class="task-actions">
            <button
              class="action-btn"
              :title="`Start timer for ${task.title}`"
              @click="handleStartTimer(task)"
            >
              <Play :size="12" />
            </button>
            <button
              class="action-btn"
              :title="`Edit ${task.title}`"
              @click="handleEditTask(task)"
            >
              <Edit2 :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Add Task Button -->
    <div v-if="!isCollapsed" class="quick-add-task">
      <button
        class="add-task-btn"
        title="Add new task to inbox"
        @click="handleQuickAddTask"
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
  ChevronLeft, ChevronRight, Play, Edit2, Plus, Timer, Calendar
} from 'lucide-vue-next'
import BaseBadge from '@/components/base/BaseBadge.vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// State
const isCollapsed = ref(false)
const newTaskTitle = ref('')
const currentFilter = ref('unscheduled')
const draggingTaskId = ref<string | null>(null)

// Filter options - calendar-only filters (no canvas-related options)
const filterOptions = [
  { value: 'today', label: 'Today', icon: '☀️' },
  { value: 'unscheduled', label: 'Unscheduled', icon: '📅' },
  { value: 'incomplete', label: 'Incomplete', icon: '⚡' },
  { value: 'allTasks', label: 'All Tasks', icon: '📋' }
]

// Computed
const baseInboxTasks = computed(() => {
  // Calendar inbox: Show tasks NOT scheduled on the calendar grid
  // "Scheduled" means having instances (time slots) - NOT just having a dueDate
  // dueDate is just a deadline, it doesn't put task on the calendar grid
  // IGNORE canvasPosition - that's for Canvas inbox only
  const allTasks = taskStore.tasks
  return allTasks.filter(task => {
    if (task.status === 'done') return false

    // Only check for actual calendar scheduling (instances or legacy scheduled date/time)
    // dueDate does NOT count as "on the calendar"
    const hasInstances = task.instances && task.instances.length > 0
    const hasLegacySchedule = (task.scheduledDate && task.scheduledDate.trim() !== '') &&
                             (task.scheduledTime && task.scheduledTime.trim() !== '')

    // Show in calendar inbox if task has NO calendar instances
    return !hasInstances && !hasLegacySchedule
  })
})

const inboxTasks = computed(() => {
  // Use raw tasks instead of filteredTasks to avoid conflicts with smart views
  // Calendar inbox should work independently of smart view filtering
  const allTasks = taskStore.tasks


  const filtered = allTasks.filter(task => {
    // Calculate task properties - calendar-only checks
    // "On the calendar" = has instances (time slots), NOT just dueDate
    const hasInstances = task.instances && task.instances.length > 0
    const hasLegacySchedule = (task.scheduledDate && task.scheduledDate.trim() !== '') &&
                             (task.scheduledTime && task.scheduledTime.trim() !== '')
    const isNotDone = task.status !== 'done'

    // Calendar inbox: IGNORE canvas state (isInInbox, canvasPosition)
    // A task is "not on calendar" if it has no instances
    const isNotOnCalendar = !hasInstances && !hasLegacySchedule

    // Filter logic based on current selection
    let passesFilter = false
    switch (currentFilter.value) {
      case 'today': {
        const todayStr = new Date().toISOString().split('T')[0]

        // Check if task is due today (dueDate) but NOT on calendar (no instances)
        const isDueToday = task.dueDate === todayStr

        // Show tasks due today that are NOT on the calendar grid
        passesFilter = isDueToday && isNotOnCalendar && isNotDone
        break
      }
      case 'unscheduled':
        // Show tasks NOT on the calendar (no instances)
        passesFilter = isNotOnCalendar && isNotDone
        break
      case 'incomplete':
        // Show all incomplete tasks NOT on the calendar
        passesFilter = isNotOnCalendar && isNotDone
        break
      case 'allTasks':
        // Show all tasks NOT on the calendar
        passesFilter = isNotOnCalendar && isNotDone
        break
      default:
        passesFilter = isNotOnCalendar && isNotDone
    }

    return passesFilter
  })

  console.log(`🔍 DEBUG [${currentFilter.value}]: ${filtered.length} tasks in inbox:`, filtered.map(t => t.title))
  return filtered
})

// Computed properties for task visual enhancements
const projectVisual = computed(() => (projectId: string) =>
  taskStore.getProjectVisual(projectId)
)

const isTimerActive = computed(() => (taskId: string) => {
  return timerStore.isTimerActive && timerStore.currentTaskId === taskId
})

const statusLabel = computed(() => (status: string) => {
  const labels: Record<string, string> = {
    planned: 'Plan',
    in_progress: 'Active',
    done: 'Done',
    backlog: 'Back',
    on_hold: 'Hold'
  }
  return labels[status] || 'Unknown'
})

// Methods
const _getProjectName = (projectId: string) => {
  const project = taskStore.getProjectById(projectId)
  return project?.name || 'Uncategorized'
}

const addTask = () => {
  if (!newTaskTitle.value.trim()) return

  taskStore.createTask({
    title: newTaskTitle.value.trim(),
    description: '',
    status: 'planned',
    projectId: null, // Uncategorized
    isInInbox: true
  })

  newTaskTitle.value = ''
}

const handleTaskClick = (_event: MouseEvent, _task: Task) => {
  // IMPORTANT: Don't handle clicks if a drag operation is in progress
  // This prevents interference with drag-drop functionality
  if (draggingTaskId.value) {
    console.log('🚫 Task click ignored - drag operation in progress')
    return
  }

  // Allow friction-free dragging - no other click handling needed
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

// Native HTML5 Drag-Drop handlers (per PomoFlow Development Prompt)
// DO NOT use vuedraggable for calendar grid - Native HTML5 + data attributes is simpler

const onDragStart = (e: DragEvent, task: Task) => {
  if (!e.dataTransfer) return

  draggingTaskId.value = task.id
  e.dataTransfer.effectAllowed = 'move'

  // Set global drag state for fallback mechanism (when dataTransfer is not available)
  ;(window as any).__draggingTaskId = task.id
  document.documentElement.setAttribute('data-dragging-task-id', task.id)

  // Include taskId explicitly for handleDrop compatibility
  const dragData = {
    ...task,
    taskId: task.id, // Explicit taskId for calendar drop handler
    source: 'calendar-inbox'
  }
  e.dataTransfer.setData('application/json', JSON.stringify(dragData))

  // Create a custom drag image for better visual feedback
  const dragElement = e.target as HTMLElement
  if (dragElement) {
    // Find the task card container (not just the text within)
    const taskCard = dragElement.closest('.inbox-task-card') || dragElement

    // Create a clone for the drag image
    const dragImage = taskCard.cloneNode(true) as HTMLElement
    dragImage.style.opacity = '0.9'
    dragImage.style.transform = 'rotate(-3deg)'
    dragImage.style.maxWidth = '250px'
    dragImage.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)'
    dragImage.style.borderRadius = '8px'
    dragImage.style.backgroundColor = 'rgba(0, 0, 0, 0.95)'
    dragImage.style.border = '2px solid var(--brand-primary)'

    // Temporarily add to body to create image
    document.body.appendChild(dragImage)

    // Set the drag image
    try {
      e.dataTransfer.setDragImage(dragImage, 20, 20)
      console.log('✅ [CalendarInboxDrag] Custom drag image set successfully')

      // Remove the temporary element after a short delay
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage)
        }
      }, 100)
    } catch (error) {
      console.warn('⚠️ [CalendarInboxDrag] Could not set custom drag image, using default:', error)
      // Fallback: use the original element
      e.dataTransfer.setDragImage(taskCard, 20, 20)
    }
  }

  console.log(`[Drag] Started dragging: "${task.title}" (ID: ${task.id})`)
  console.log(`[Drag] Task inbox status:`, task.isInInbox)
  console.log(`[Drag] Task instances:`, task.instances?.length || 0)
}

const onDragEnd = () => {
  draggingTaskId.value = null

  // Clean up global drag state
  delete (window as any).__draggingTaskId
  document.documentElement.removeAttribute('data-dragging-task-id')

  console.log('[Drag] Drag ended')
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
  position: relative;
  z-index: 100;
  /* Clean solid background matching target design */
  background: var(--glass-bg-solid);
  border: 1px solid var(--glass-border);
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
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  z-index: 100;
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
  z-index: 100;
}

.inbox-task-card.is-dragging {
  z-index: 1000;
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
  bottom: 0;
  left: 0;
  width: 3px;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  margin: 0;
  padding: 0;
}

.priority-stripe.priority-high {
  background: var(--color-priority-high);
}

.priority-stripe.priority-medium {
  background: var(--color-priority-medium);
}

.priority-stripe.priority-low {
  background: var(--color-priority-low);
}

.priority-stripe.priority-none {
  background: transparent;
}

/* Timer Active Badge */
.timer-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 8px var(--brand-primary);
  animation: timerPulse 2s ease-in-out infinite;
  z-index: 5;
}

@keyframes timerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 8px var(--brand-primary);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 2px 16px var(--brand-primary);
  }
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
  margin-bottom: var(--space-2);
  margin-top: var(--space-1);
  word-wrap: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1_5);
  align-items: center;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  transition: opacity var(--duration-normal);
}

/* Enhanced metadata badges */
.status-badge,
.due-date-badge,
.duration-badge,
.project-emoji-badge {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  font-weight: var(--font-medium);
  box-shadow: 0 2px 4px var(--shadow-subtle);
  white-space: nowrap;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  max-width: 120px;
}

.status-badge {
  background: var(--glass-bg-heavy);
  color: var(--text-muted);
}

.due-date-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.duration-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* Project visual badge styles */
.project-emoji-badge {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.project-emoji-badge:hover {
  background: var(--brand-bg-subtle-hover);
  border-color: var(--brand-border);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px var(--shadow-subtle);
}

.project-emoji {
  font-size: 12px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-emoji.project-css-circle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--project-color, var(--color-primary));
  box-shadow: var(--project-indicator-shadow);
  position: relative;
  font-size: 8px;
  color: white;
  font-weight: var(--font-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) ease;
}

.project-emoji-badge:hover .project-emoji.project-css-circle {
  transform: scale(1.2);
  box-shadow: 0 0 8px var(--project-color);
}

.project-emoji-badge.project-visual--colored {
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
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

/* Native HTML5 drag-drop container (per PomoFlow spec) */
.inbox-task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 50px;
}

/* Drag state for inbox task cards - native HTML5 */
.inbox-task-card.is-dragging {
  opacity: 0.5;
  cursor: grabbing;
  transform: scale(0.98);
  border: 2px dashed var(--brand-primary) !important;
  background: var(--state-selected-bg) !important;
}

.inbox-task-card[draggable="true"] {
  cursor: grab;
}

.inbox-task-card[draggable="true"]:active {
  cursor: grabbing;
}
</style>