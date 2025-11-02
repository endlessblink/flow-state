<template>
  <div
    v-if="isVisible"
    ref="menuRef"
    class="context-menu"
    :style="menuPosition"
  >
    <!-- Header for inbox/batch operations -->
    <div v-if="showInboxHeader" class="context-menu-header">
      {{ displayHeaderText }}
    </div>

    <!-- Edit Task (only show for single task, not batch) -->
    <button v-if="!isBatchOperation" class="menu-item" @click="handleEdit">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
      </svg>
      <span class="menu-text">Edit</span>
      <span class="menu-shortcut">Ctrl+E</span>
    </button>

    <div v-if="!isBatchOperation" class="menu-divider"></div>

    <!-- Date Section -->
    <div class="menu-section">
      <div class="section-header">
        <div class="section-label">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="section-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span class="section-title">Date</span>
        </div>
        <span class="section-shortcut">T</span>
      </div>
      <div class="icon-row">
        <!-- Today with Calendar icon (stroke style with color) -->
        <button class="icon-btn today-icon" @click="setDueDate('today')" title="Today">
          <Calendar :size="16" :stroke-width="1.5" class="calendar-stroke" />
        </button>
        <!-- Tomorrow with Sun icon (warm yellow) -->
        <button class="icon-btn sun-icon" @click="setDueDate('tomorrow')" title="Tomorrow">
          <Sun :size="16" :stroke-width="1.5" class="sun-stroke" />
        </button>
        <!-- Weekend with Moon icon (cool purple) -->
        <button class="icon-btn moon-icon" @click="setDueDate('weekend')" title="This Weekend">
          <Moon :size="16" :stroke-width="1.5" class="moon-stroke" />
        </button>
        <!-- Next Week with Arrow icon (blue) -->
        <button class="icon-btn next-week-icon" @click="setDueDate('nextweek')" title="Next Week">
          <ArrowRight :size="16" :stroke-width="1.5" class="arrow-stroke" />
        </button>
        <!-- More options -->
        <button class="icon-btn more-icon" @click="setDueDate('custom')" title="More Options">
          <MoreHorizontal :size="16" :stroke-width="1.5" class="more-stroke" />
        </button>
      </div>
    </div>

    <div class="menu-divider"></div>

    <!-- Priority Section -->
    <div class="menu-section">
      <div class="section-header">
        <div class="section-label">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="section-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 2H21l-3 6 3 6h-8.5l-1-2H5a2 2 0 00-2 2zm9-13.5V9"/>
          </svg>
          <span class="section-title">Priority</span>
        </div>
        <span class="section-shortcut">Y</span>
      </div>
      <div class="icon-row">
        <button
          class="icon-btn priority-high"
          :class="{ active: currentTask?.priority === 'high' }"
          @click="setPriority('high')"
          title="High Priority"
        >
          <div class="priority-rect high"></div>
        </button>
        <button
          class="icon-btn priority-medium"
          :class="{ active: currentTask?.priority === 'medium' }"
          @click="setPriority('medium')"
          title="Medium Priority"
        >
          <div class="priority-rect medium"></div>
        </button>
        <button
          class="icon-btn priority-low"
          :class="{ active: currentTask?.priority === 'low' }"
          @click="setPriority('low')"
          title="Low Priority"
        >
          <div class="priority-rect low"></div>
        </button>
      </div>
    </div>

    <div class="menu-divider"></div>

    <!-- Status Section -->
    <div class="menu-section">
      <div class="section-header">
        <div class="section-label">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="section-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
          </svg>
          <span class="section-title">Status</span>
        </div>
        <span class="section-shortcut">R</span>
      </div>
      <div class="status-row">
        <button
          class="status-btn status-planned"
          :class="{ active: currentTask?.status === 'planned' }"
          @click="setStatus('planned')"
          title="Planned"
        >
          <CalendarDays :size="16" :stroke-width="1.5" class="status-icon planned" />
        </button>
        <button
          class="status-btn status-in-progress"
          :class="{ active: currentTask?.status === 'in_progress' }"
          @click="setStatus('in_progress')"
          title="In Progress"
        >
          <Loader :size="16" :stroke-width="1.5" class="status-icon in-progress" />
        </button>
        <button
          class="status-btn status-done"
          :class="{ active: currentTask?.status === 'done' }"
          @click="setStatus('done')"
          title="Done"
        >
          <CheckCircle :size="16" :stroke-width="1.5" class="status-icon done" />
        </button>
        <button
          class="status-btn status-backlog"
          :class="{ active: currentTask?.status === 'backlog' }"
          @click="setStatus('backlog')"
          title="Backlog"
        >
          <Inbox :size="16" :stroke-width="1.5" class="status-icon backlog" />
        </button>
        <button
          class="status-btn status-on-hold"
          :class="{ active: currentTask?.status === 'on_hold' }"
          @click="setStatus('on_hold')"
          title="On Hold"
        >
          <PauseCircle :size="16" :stroke-width="1.5" class="status-icon on-hold" />
        </button>
      </div>
    </div>

    <div class="menu-divider"></div>

    <!-- Focus Mode -->
    <button class="menu-item focus-action" :class="{ 'menu-item--compact': compactMode }" @click="enterFocus">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
      <span v-if="!compactMode" class="menu-text">Focus Mode</span>
      <span class="menu-shortcut" :class="{ 'menu-shortcut--compact': compactMode }">F</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Start Now -->
    <button class="menu-item start-now-action" :class="{ 'menu-item--compact': compactMode }" @click="startTaskNow">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" class="menu-icon start-now-icon">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <span v-if="!compactMode" class="menu-text">Start Now</span>
      <span class="menu-shortcut" :class="{ 'menu-shortcut--compact': compactMode }">S</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Start Timer -->
    <button class="menu-item pomodoro-action" :class="{ 'menu-item--compact': compactMode }" @click="startTimer">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" class="menu-icon timer-icon">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <span v-if="!compactMode" class="menu-text">Start Timer</span>
      <span class="menu-shortcut" :class="{ 'menu-shortcut--compact': compactMode }">Space</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Duplicate -->
    <button class="menu-item" :class="{ 'menu-item--compact': compactMode }" @click="duplicateTask">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
      </svg>
      <span v-if="!compactMode" class="menu-text">Duplicate</span>
    </button>

    <!-- Clear Selection (only for batch operations) -->
    <button v-if="isBatchOperation" class="menu-item" @click="clearSelection">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      <span class="menu-text">Clear Selection</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Delete -->
    <button class="menu-item danger" @click="deleteTask">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
      <span class="menu-text">{{ deleteText }}</span>
      <span class="menu-shortcut">{{ deleteShortcut }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch, inject } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import type { Task } from '@/stores/tasks'
import { Calendar, Sun, Moon, ArrowRight, MoreHorizontal, CalendarDays, Loader, CheckCircle, Inbox, PauseCircle } from 'lucide-vue-next'
import { FOCUS_MODE_KEY } from '@/composables/useFocusMode'

interface Props {
  isVisible: boolean
  x: number
  y: number
  task: Task | null
  compactMode?: boolean
  selectedCount?: number
  contextTask?: Task | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  edit: [taskId: string]
  confirmDelete: [taskId: string, instanceId?: string, isCalendarEvent?: boolean]
  clearSelection: []
  setPriority: [priority: 'low' | 'medium' | 'high']
  setStatus: [status: 'planned' | 'in_progress' | 'done']
  setDueDate: [dateType: 'today' | 'tomorrow' | 'weekend' | 'nextweek']
  enterFocusMode: []
  deleteSelected: []
}>()

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Optional focus mode injection - uses Symbol from useFocusMode.ts
const focusModeState = inject(FOCUS_MODE_KEY, null)
const enterFocusMode = focusModeState?.enterFocusMode || null

const menuRef = ref<HTMLElement | null>(null)

// Computed properties for inbox/batch support
const isBatchOperation = computed(() => (props.selectedCount || 0) > 1)
const currentTask = computed(() => props.contextTask || props.task)

const showInboxHeader = computed(() => {
  return (props.selectedCount && props.selectedCount > 0) || props.contextTask
})

const displayHeaderText = computed(() => {
  if (props.contextTask) {
    return props.contextTask.title
  } else if (props.selectedCount && props.selectedCount > 1) {
    return `${props.selectedCount} selected`
  }
  return ''
})

const deleteText = computed(() => {
  if (isBatchOperation.value) {
    return `Delete ${props.selectedCount} tasks`
  }
  return (currentTask.value as any)?.isCalendarEvent ? 'Remove from Calendar' : 'Delete'
})

const deleteShortcut = computed(() => {
  if (isBatchOperation.value) {
    return 'Delete'
  }
  return (currentTask.value as any)?.isCalendarEvent ? 'Remove' : 'Delete'
})

// Smart positioning to prevent cutoff
const menuPosition = computed(() => {
  if (!menuRef.value) {
    return { left: props.x + 'px', top: props.y + 'px' }
  }

  const menuHeight = menuRef.value.offsetHeight || 400 // Estimated height
  const menuWidth = menuRef.value.offsetWidth || 240
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const padding = 8 // Padding from viewport edge

  let left = props.x
  let top = props.y

  // Check if menu overflows bottom of viewport
  if (top + menuHeight > viewportHeight - padding) {
    // Flip to render above the click point
    top = props.y - menuHeight
  }

  // Check if menu overflows right of viewport
  if (left + menuWidth > viewportWidth - padding) {
    left = viewportWidth - menuWidth - padding
  }

  // Ensure menu doesn't go off-screen on the left
  if (left < padding) {
    left = padding
  }

  // Ensure menu doesn't go off-screen on the top
  if (top < padding) {
    top = padding
  }

  return {
    left: left + 'px',
    top: top + 'px'
  }
})

// Actions
const handleEdit = () => {
  if (currentTask.value && !isBatchOperation.value) {
    emit('edit', currentTask.value.id)
  }
  emit('close')
}

const setDueDate = (dateType: string) => {
  if (!currentTask.value) return

  if (isBatchOperation.value) {
    // Emit for batch operations in InboxPanel
    emit('setDueDate', dateType as 'today' | 'tomorrow' | 'weekend' | 'nextweek')
    emit('close')
    return
  }

  // Single task operation
  const today = new Date()
  let dueDate: Date | null = null

  switch (dateType) {
    case 'today':
      dueDate = today
      break
    case 'tomorrow':
      dueDate = new Date(today)
      dueDate.setDate(today.getDate() + 1)
      break
    case 'weekend':
      dueDate = new Date(today)
      const daysUntilSaturday = (6 - today.getDay()) % 7 || 7
      dueDate.setDate(today.getDate() + daysUntilSaturday)
      break
    case 'nextweek':
      dueDate = new Date(today)
      const daysUntilNextMonday = (8 - today.getDay()) % 7 || 7
      dueDate.setDate(today.getDate() + daysUntilNextMonday)
      break
    case 'custom':
      const currentDate = currentTask.value.dueDate
      const newDate = prompt('Set due date (MM/DD/YYYY):', currentDate)
      if (newDate && newDate !== currentDate) {
        taskStore.updateTaskWithUndo(currentTask.value.id, { dueDate: newDate })
      }
      emit('close')
      return
    default:
      return
  }

  if (dueDate) {
    const formattedDate = dueDate.toLocaleDateString()
    taskStore.updateTaskWithUndo(currentTask.value.id, { dueDate: formattedDate })
  }
  emit('close')
}

const setPriority = (priority: 'high' | 'medium' | 'low') => {
  if (isBatchOperation.value) {
    // Emit for batch operations in InboxPanel
    emit('setPriority', priority)
  } else if (currentTask.value) {
    taskStore.updateTaskWithUndo(currentTask.value.id, { priority })
  }
  emit('close')
}

const setStatus = (status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold') => {
  if (isBatchOperation.value) {
    // Emit for batch operations in InboxPanel
    emit('setStatus', status as 'planned' | 'in_progress' | 'done')
  } else if (currentTask.value) {
    taskStore.updateTaskWithUndo(currentTask.value.id, { status })
  }
  emit('close')
}

const clearSelection = () => {
  emit('clearSelection')
  emit('close')
}

const enterFocus = () => {
  if (currentTask.value && !isBatchOperation.value && enterFocusMode) {
    enterFocusMode(currentTask.value.id)
  } else if (isBatchOperation.value) {
    emit('enterFocusMode')
  }
  emit('close')
}

const startTaskNow = () => {
  if (currentTask.value && !isBatchOperation.value) {
    taskStore.startTaskNowWithUndo(currentTask.value.id)

    // Start the pomodoro timer immediately
    timerStore.startTimer(currentTask.value.id, timerStore.settings.workDuration, false)

    // Navigate to calendar view if not already there
    const router = inject('router', null)
    if (router && router.currentRoute.value.name !== 'calendar') {
      router.push('/calendar')
    }

    // Emit calendar navigation event to scroll to current time
    window.dispatchEvent(new CustomEvent('start-task-now', {
      detail: { taskId: currentTask.value.id }
    }))
  }
  emit('close')
}

const startTimer = () => {
  if (currentTask.value && !isBatchOperation.value) {
    timerStore.startTimer(currentTask.value.id, timerStore.settings.workDuration, false)
  }
  emit('close')
}

const duplicateTask = () => {
  if (currentTask.value && !isBatchOperation.value) {
    const duplicate = taskStore.createTaskWithUndo({
      title: currentTask.value.title + ' (Copy)',
      description: currentTask.value.description,
      status: currentTask.value.status,
      priority: currentTask.value.priority
    })
    console.log('Duplicated task:', duplicate.title)
  }
  emit('close')
}

const deleteTask = () => {
  if (isBatchOperation.value) {
    emit('deleteSelected')
  } else if (currentTask.value) {
    // Check if this is a calendar event by checking for calendar-specific properties
    const taskData = currentTask.value as any
    const instanceId = taskData.instanceId
    const isCalendarEvent = taskData.isCalendarEvent

    emit('confirmDelete', currentTask.value.id, instanceId, isCalendarEvent)
  }
  emit('close')
}

// Click outside handler
const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    // Clicking outside - close the menu
    emit('close')
  }
}

// Add/remove event listener when menu visibility changes
watch(() => props.isVisible, (isVisible) => {
  if (isVisible) {
    // Add listener on next tick to avoid closing immediately
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--surface-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2) 0;
  min-width: 200px;
  z-index: 1000;
  animation: menuSlideIn var(--duration-fast) var(--spring-smooth);
}

@keyframes menuSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.context-menu-header {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--blue-text);
  background: var(--blue-bg-subtle);
  border-radius: var(--radius-md);
  margin: var(--space-2) var(--space-3);
  text-align: center;
}

.menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  transition: background-color 0.15s ease;
}

.menu-item:hover {
  background: var(--bg-hover);
}

.menu-item.danger {
  color: var(--danger-text);
}

.menu-item.danger:hover {
  background: var(--danger-bg-subtle);
}

.menu-item.pomodoro-action {
  color: var(--color-work);
}

.menu-item.focus-action {
  color: var(--color-focus);
}

.menu-item.start-now-action {
  color: var(--color-break);
}

.menu-item.start-now-action:hover {
  background: var(--orange-bg-subtle);
}

.start-now-icon {
  color: var(--color-break);
}

.menu-item.focus-action:hover {
  background: var(--purple-bg-subtle);
}

.menu-item.pomodoro-action:hover {
  background: var(--success-bg-subtle);
}

.menu-icon {
  flex-shrink: 0;
}

.timer-icon {
  color: var(--color-work);
}

.menu-text {
  flex: 1;
  font-weight: var(--font-normal);
}

.menu-shortcut {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
}

.menu-divider {
  height: 1px;
  background: var(--border-secondary);
  margin: var(--space-2) 0;
}

/* Aligned Sections */
.menu-section {
  padding: var(--space-3) var(--space-4);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.section-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-icon {
  color: var(--text-muted);
}

.section-title {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.section-shortcut {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  opacity: 0.7;
}

.icon-row {
  display: flex;
  gap: 0.5rem;
}

.icon-btn {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.icon-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

/* Priority-specific active states */
.icon-btn.priority-high.active {
  background: var(--danger-bg-light);
  border-color: var(--color-priority-high);
  color: var(--color-priority-high);
}

.icon-btn.priority-medium.active {
  background: var(--orange-bg-medium);
  border-color: var(--color-priority-medium);
  color: var(--color-priority-medium);
}

.icon-btn.priority-low.active {
  background: var(--blue-bg-subtle);
  border-color: var(--color-priority-low);
  color: var(--color-priority-low);
}

.today-badge {
  background: var(--brand-primary);
  color: var(--state-active-text);
  border-radius: var(--radius-sm);
  width: 20px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.today-number {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  line-height: 1;
}

.priority-rect {
  width: 12px;
  height: 8px;
  border-radius: var(--radius-xs);
}

.priority-rect.high {
  background: var(--color-priority-high);
}

.priority-rect.medium {
  background: var(--color-priority-medium);
}

.priority-rect.low {
  background: var(--color-priority-low);
}

/* Colored stroke icons for dates */
.calendar-stroke {
  color: var(--color-work);
}

.sun-stroke {
  color: var(--color-break);
}

.moon-stroke {
  color: var(--color-focus);
}

.arrow-stroke {
  color: var(--color-navigation);
}

.more-stroke {
  color: var(--text-muted);
}

/* Status row and circles */
.status-row {
  display: flex;
  gap: 0.5rem;
}

.status-btn {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.status-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

/* Status-specific active states */
.status-btn.status-planned.active {
  background: var(--blue-bg-subtle);
  border-color: var(--color-info);
  color: var(--color-info);
}

.status-btn.status-in-progress.active {
  background: var(--orange-bg-medium);
  border-color: var(--color-break);
  color: var(--color-break);
}

.status-btn.status-done.active {
  background: var(--success-bg-light);
  border-color: var(--color-work);
  color: var(--color-work);
}

.status-btn.status-backlog.active {
  background: rgba(156, 163, 175, 0.1);
  border-color: var(--text-muted);
  color: var(--text-muted);
}

.status-btn.status-on-hold.active {
  background: var(--danger-bg-light);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.status-icon {
  color: var(--text-muted);
  transition: color 0.15s ease;
}

.status-icon.planned {
  color: var(--color-info);
}

.status-icon.in-progress {
  color: var(--color-break);
}

.status-icon.done {
  color: var(--color-work);
}

.status-icon.backlog {
  color: var(--text-muted);
}

.status-icon.on-hold {
  color: var(--color-danger);
}

/* Compact mode for menu items */
.menu-item--compact {
  padding: var(--space-2) var(--space-3);
  min-width: auto;
  width: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
}

.menu-item--compact .menu-icon {
  margin: 0;
}

.menu-shortcut--compact {
  position: absolute;
  right: var(--space-2);
  font-size: 10px;
  opacity: 0.8;
  background: var(--glass-bg-medium);
  padding: 1px 4px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
}

/* Compact mode adjustments for context menu width */
.context-menu:has(.menu-item--compact) {
  min-width: auto;
  width: auto;
}

/* Remove light theme overrides - using design tokens for all themes */
</style>