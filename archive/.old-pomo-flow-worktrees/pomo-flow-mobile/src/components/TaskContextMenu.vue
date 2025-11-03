<template>
  <div
    v-if="isVisible"
    ref="menuRef"
    class="context-menu"
    :style="menuPosition"
  >
    <!-- Edit Task -->
    <button class="menu-item" @click="handleEdit">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
      </svg>
      <span class="menu-text">Edit</span>
      <span class="menu-shortcut">Ctrl+E</span>
    </button>

    <div class="menu-divider"></div>

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
          class="icon-btn"
          :class="{ active: task?.priority === 'high' }"
          @click="setPriority('high')"
          title="High Priority"
        >
          <div class="priority-rect red"></div>
        </button>
        <button
          class="icon-btn"
          :class="{ active: task?.priority === 'medium' }"
          @click="setPriority('medium')"
          title="Medium Priority"
        >
          <div class="priority-rect orange"></div>
        </button>
        <button
          class="icon-btn"
          :class="{ active: task?.priority === 'low' }"
          @click="setPriority('low')"
          title="Low Priority"
        >
          <div class="priority-rect blue"></div>
        </button>
      </div>
    </div>

    <div class="menu-divider"></div>

    <!-- Start Timer -->
    <button class="menu-item pomodoro-action" @click="startTimer">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" class="menu-icon timer-icon">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <span class="menu-text">Start Timer</span>
      <span class="menu-shortcut">Space</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Duplicate -->
    <button class="menu-item" @click="duplicateTask">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
      </svg>
      <span class="menu-text">Duplicate</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Delete -->
    <button class="menu-item danger" @click="deleteTask">
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="menu-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
      <span class="menu-text">Delete</span>
      <span class="menu-shortcut">Delete</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import type { Task } from '@/stores/tasks'
import { Calendar, Sun, Moon, ArrowRight, MoreHorizontal } from 'lucide-vue-next'

interface Props {
  isVisible: boolean
  x: number
  y: number
  task: Task | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  edit: [taskId: string]
  confirmDelete: [taskId: string]
}>()

const taskStore = useTaskStore()
const timerStore = useTimerStore()
const menuRef = ref<HTMLElement | null>(null)

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
  if (props.task) {
    emit('edit', props.task.id)
  }
  emit('close')
}

const setDueDate = (dateType: string) => {
  if (!props.task) return

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
      const currentDate = props.task.dueDate
      const newDate = prompt('Set due date (MM/DD/YYYY):', currentDate)
      if (newDate && newDate !== currentDate) {
        taskStore.updateTask(props.task.id, { dueDate: newDate })
      }
      emit('close')
      return
    default:
      return
  }

  if (dueDate) {
    const formattedDate = dueDate.toLocaleDateString()
    taskStore.updateTask(props.task.id, { dueDate: formattedDate })
  }
  emit('close')
}

const setPriority = (priority: 'high' | 'medium' | 'low') => {
  if (props.task) {
    taskStore.updateTask(props.task.id, { priority })
  }
  emit('close')
}

const startTimer = () => {
  if (props.task) {
    timerStore.startTimer(props.task.id, timerStore.settings.workDuration, false)
  }
  emit('close')
}

const duplicateTask = () => {
  if (props.task) {
    const duplicate = taskStore.createTask({
      title: props.task.title + ' (Copy)',
      description: props.task.description,
      status: props.task.status,
      priority: props.task.priority
    })
    console.log('Duplicated task:', duplicate.title)
  }
  emit('close')
}

const deleteTask = () => {
  if (props.task) {
    emit('confirmDelete', props.task.id)
  }
  emit('close')
}

// Click outside handler
const handleClickOutside = (event: MouseEvent) => {
  const menu = document.querySelector('.context-menu')
  if (menu && !menu.contains(event.target as Node)) {
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
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-xl);
  box-shadow:
    0 24px 48px var(--shadow-strong),
    0 12px 24px var(--shadow-strong),
    inset 0 1px 0 var(--glass-bg-medium);
  padding: var(--space-2) 0;
  min-width: 240px;
  z-index: 1000;
  animation: menuSlideIn var(--duration-fast) var(--spring-bounce);
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

.menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.menu-item:hover {
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(8px);
}

.menu-item.danger {
  color: var(--color-danger);
}

.menu-item.danger:hover {
  background: linear-gradient(
    135deg,
    var(--danger-bg-subtle) 0%,
    var(--danger-bg-light) 100%
  );
}

.menu-item.pomodoro-action {
  color: var(--color-work);
}

.menu-item.pomodoro-action:hover {
  background: linear-gradient(
    135deg,
    var(--success-bg-subtle) 0%,
    var(--success-bg-light) 100%
  );
}

.menu-icon {
  flex-shrink: 0;
}

.timer-icon {
  color: var(--color-work);
}

.menu-text {
  flex: 1;
  font-weight: var(--font-medium);
}

.menu-shortcut {
  color: var(--text-subtle);
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
}

.menu-divider {
  height: 1px;
  background: var(--glass-bg-soft);
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
  color: var(--text-primary);
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
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  box-shadow: 0 2px 4px var(--shadow-subtle);
}

.icon-btn:hover {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--glass-border-medium);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px var(--shadow-subtle);
}

.icon-btn.active {
  background: linear-gradient(
    135deg,
    var(--purple-border-light) 0%,
    var(--purple-bg-subtle) 100%
  );
  border-color: var(--purple-shadow-strong);
  box-shadow:
    0 4px 8px var(--purple-border-subtle),
    0 0 12px var(--purple-bg-subtle);
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

.priority-rect.red {
  background: var(--color-danger);
}

.priority-rect.orange {
  background: var(--color-break);
}

.priority-rect.blue {
  background: var(--brand-primary);
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

/* Remove light theme overrides - using design tokens for all themes */
</style>