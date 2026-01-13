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
      <Pencil :size="16" class="menu-icon" />
      <span class="menu-text">Edit</span>
      <span class="menu-shortcut">Ctrl+E</span>
    </button>

    <div v-if="!isBatchOperation" class="menu-divider" />

    <!-- Date Section - Compact Pills -->
    <div class="menu-section menu-section--tight">
      <div class="section-header section-header--inline">
        <Calendar :size="12" class="section-icon" />
        <span class="section-title">Date</span>
      </div>
      <div class="pill-row">
        <button class="pill-btn pill-btn--sm" @click="setDueDate('today')">Today</button>
        <button class="pill-btn pill-btn--sm" @click="setDueDate('tomorrow')">Tmrw</button>
        <button class="pill-btn pill-btn--sm" @click="setDueDate('weekend')">Wknd</button>
        <button class="pill-btn pill-btn--sm" @click="setDueDate('nextweek')">+1wk</button>
        <button class="pill-btn pill-btn--sm pill-btn--icon" title="Pick date" @click="setDueDate('custom')">
          <CalendarPlus :size="12" />
        </button>
      </div>
    </div>

    <!-- Priority Section - Compact Pills -->
    <div class="menu-section menu-section--tight">
      <div class="section-header section-header--inline">
        <Flag :size="12" class="section-icon" />
        <span class="section-title">Priority</span>
      </div>
      <div class="pill-row">
        <button
          class="pill-btn pill-btn--sm pill-btn--priority-high"
          :class="{ active: currentTask?.priority === 'high' }"
          @click="setPriority('high')"
        >
          <span class="priority-dot high" />
          High
        </button>
        <button
          class="pill-btn pill-btn--sm pill-btn--priority-medium"
          :class="{ active: currentTask?.priority === 'medium' }"
          @click="setPriority('medium')"
        >
          <span class="priority-dot medium" />
          Med
        </button>
        <button
          class="pill-btn pill-btn--sm pill-btn--priority-low"
          :class="{ active: currentTask?.priority === 'low' }"
          @click="setPriority('low')"
        >
          <span class="priority-dot low" />
          Low
        </button>
      </div>
    </div>

    <!-- Status & Duration Row -->
    <div class="inline-row">
      <!-- Status with Submenu -->
      <div
        class="inline-select"
        @mouseenter="openSubmenu('status', $event)"
        @mouseleave="closeSubmenu('status')"
      >
        <CheckCircle :size="14" class="inline-icon" />
        <span class="inline-value">{{ currentStatusLabel || 'Status' }}</span>
        <ChevronDown :size="12" class="inline-arrow" />
      </div>

      <!-- Duration with Submenu -->
      <div
        class="inline-select"
        @mouseenter="openSubmenu('duration', $event)"
        @mouseleave="closeSubmenu('duration')"
      >
        <Clock :size="14" class="inline-icon" />
        <span class="inline-value">{{ currentDurationLabel || 'Time' }}</span>
        <ChevronDown :size="12" class="inline-arrow" />
      </div>
    </div>

    <!-- Status Submenu -->
    <Teleport to="body">
      <div
        v-if="showStatusSubmenu"
        class="submenu"
        :style="statusSubmenuStyle"
        @mouseenter="_keepSubmenuOpen('status')"
        @mouseleave="closeSubmenu('status')"
      >
        <button
          v-for="status in statusOptions"
          :key="status.value"
          class="menu-item menu-item--sm"
          :class="{ active: currentTask?.status === status.value }"
          @click="setStatus(status.value)"
        >
          <component
            :is="status.icon"
            :size="14"
            class="status-icon"
            :class="[status.value]"
          />
          <span class="menu-text">{{ status.label }}</span>
        </button>
      </div>
    </Teleport>

    <!-- Duration Submenu -->
    <Teleport to="body">
      <div
        v-if="showDurationSubmenu"
        class="submenu"
        :style="durationSubmenuStyle"
        @mouseenter="_keepSubmenuOpen('duration')"
        @mouseleave="closeSubmenu('duration')"
      >
        <button
          v-for="dur in durationOptions"
          :key="dur.value ?? 'none'"
          class="menu-item menu-item--sm"
          :class="{ active: currentTask?.estimatedDuration === dur.value }"
          @click="setDuration(dur.value)"
        >
          <component
            :is="dur.icon"
            :size="14"
            class="duration-icon"
            :class="[dur.class]"
          />
          <span class="menu-text">{{ dur.label }}</span>
        </button>
      </div>
    </Teleport>

    <!-- Quick Actions Row -->
    <div class="action-bar">
      <button
        class="action-btn action-btn--done"
        :class="{ active: currentTask?.status === 'done' }"
        title="Mark Done (D)"
        @click="toggleDone"
      >
        <CheckCircle :size="16" />
        <span class="action-label">Done</span>
      </button>
      <button class="action-btn action-btn--start" title="Start Now (S)" @click="startTaskNow">
        <Play :size="16" />
        <span class="action-label">Start</span>
      </button>
      <button class="action-btn action-btn--timer" title="Start Timer (Space)" @click="startTimer">
        <Timer :size="16" />
        <span class="action-label">Timer</span>
      </button>
      <button class="action-btn action-btn--focus" title="Focus Mode (F)" @click="enterFocus">
        <Eye :size="16" />
        <span class="action-label">Focus</span>
      </button>
    </div>

    <!-- More Actions with Submenu -->
    <div
      class="menu-item has-submenu"
      @mouseenter="openSubmenu('more', $event)"
      @mouseleave="closeSubmenu('more')"
    >
      <MoreHorizontal :size="16" class="menu-icon" />
      <span class="menu-text">More</span>
      <ChevronRight :size="14" class="submenu-arrow" />
    </div>

    <!-- More Submenu -->
    <Teleport to="body">
      <div
        v-if="showMoreSubmenu"
        class="submenu"
        :style="moreSubmenuStyle"
        @mouseenter="_keepSubmenuOpen('more')"
        @mouseleave="closeSubmenu('more')"
      >
        <button class="menu-item menu-item--sm" @click="duplicateTask">
          <Copy :size="14" class="menu-icon" />
          <span class="menu-text">Duplicate</span>
        </button>
        <button
          v-if="!isBatchOperation"
          class="menu-item menu-item--sm"
          @click="currentTask && $emit('moveToSection', currentTask.id); $emit('close')"
        >
          <Layout :size="14" class="menu-icon" />
          <span class="menu-text">Move to Section</span>
        </button>
        <button v-if="isBatchOperation" class="menu-item menu-item--sm" @click="clearSelection">
          <X :size="14" class="menu-icon" />
          <span class="menu-text">Clear Selection</span>
        </button>
      </div>
    </Teleport>

    <div class="menu-divider" />

    <!-- Delete -->
    <button class="menu-item danger" @click="deleteTask">
      <Trash2 :size="16" class="menu-icon" />
      <span class="menu-text">{{ deleteText }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch, inject, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useCanvasStore } from '@/stores/canvas'
import type { Task } from '@/stores/tasks'
import {
  Calendar,
  CalendarPlus,
  CalendarDays,
  Loader,
  CheckCircle,
  Inbox,
  PauseCircle,
  Zap,
  Timer,
  Clock,
  HelpCircle,
  Layout,
  Eye,
  Play,
  Copy,
  Flag,
  ChevronRight,
  ChevronDown,
  Pencil,
  X,
  Trash2,
  MoreHorizontal
} from 'lucide-vue-next'
import { FOCUS_MODE_KEY } from '@/composables/useFocusMode'
import type { FocusModeState } from '@/composables/useFocusMode'

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
  setDuration: [duration: number | null]
  moveToSection: [taskId: string]
}>()

const taskStore = useTaskStore()
const timerStore = useTimerStore()
const canvasStore = useCanvasStore()
const router = useRouter()

const focusModeState = inject<FocusModeState | null>(FOCUS_MODE_KEY, null)
const enterFocusMode = focusModeState?.enterFocusMode || null

const menuRef = ref<HTMLElement | null>(null)

// Submenu state
const showStatusSubmenu = ref(false)
const showDurationSubmenu = ref(false)
const showMoreSubmenu = ref(false)
const submenuTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const statusSubmenuPosition = ref({ x: 0, y: 0 })
const durationSubmenuPosition = ref({ x: 0, y: 0 })
const moreSubmenuPosition = ref({ x: 0, y: 0 })

// Status options (Done first - most used)
const statusOptions = [
  { value: 'done', label: 'Done', icon: markRaw(CheckCircle) },
  { value: 'in_progress', label: 'In Progress', icon: markRaw(Loader) },
  { value: 'planned', label: 'Planned', icon: markRaw(CalendarDays) },
  { value: 'backlog', label: 'Backlog', icon: markRaw(Inbox) },
  { value: 'on_hold', label: 'On Hold', icon: markRaw(PauseCircle) }
] as const

// Duration options
const durationOptions = [
  { value: 15, label: '15 min', icon: markRaw(Zap), class: 'quick' },
  { value: 30, label: '30 min', icon: markRaw(Timer), class: 'short' },
  { value: 60, label: '1 hour', icon: markRaw(Timer), class: 'medium' },
  { value: 120, label: '2 hours', icon: markRaw(Clock), class: 'long' },
  { value: null, label: 'None', icon: markRaw(HelpCircle), class: 'none' }
] as const

// Computed properties
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

const currentStatusLabel = computed(() => {
  const status = currentTask.value?.status
  return statusOptions.find(s => s.value === status)?.label || ''
})

const currentDurationLabel = computed(() => {
  const duration = currentTask.value?.estimatedDuration
  if (!duration) return ''
  if (duration === 15) return '15m'
  if (duration === 30) return '30m'
  if (duration === 60) return '1h'
  if (duration === 120) return '2h'
  return `${duration}m`
})

const deleteText = computed(() => {
  if (isBatchOperation.value) {
    return `Delete ${props.selectedCount}`
  }
  const task = currentTask.value as unknown as { isCalendarEvent?: boolean }
  return task?.isCalendarEvent ? 'Remove' : 'Delete'
})

// Menu positioning
const menuPosition = computed(() => {
  if (!menuRef.value) {
    return { left: props.x + 'px', top: props.y + 'px' }
  }

  const menuHeight = menuRef.value.offsetHeight || 400
  const menuWidth = menuRef.value.offsetWidth || 240
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const padding = 8

  let left = props.x
  let top = props.y

  if (top + menuHeight > viewportHeight - padding) {
    top = props.y - menuHeight
  }
  if (left + menuWidth > viewportWidth - padding) {
    left = viewportWidth - menuWidth - padding
  }
  if (left < padding) left = padding
  if (top < padding) top = padding

  return { left: left + 'px', top: top + 'px', position: 'absolute' as const }
})

// Submenu styles
const statusSubmenuStyle = computed(() => ({
  left: statusSubmenuPosition.value.x + 'px',
  top: statusSubmenuPosition.value.y + 'px'
}))

const durationSubmenuStyle = computed(() => ({
  left: durationSubmenuPosition.value.x + 'px',
  top: durationSubmenuPosition.value.y + 'px'
}))

const moreSubmenuStyle = computed(() => ({
  left: moreSubmenuPosition.value.x + 'px',
  top: moreSubmenuPosition.value.y + 'px'
}))

// Submenu handlers
const openSubmenu = (type: 'status' | 'duration' | 'more', event: MouseEvent) => {
  if (submenuTimeout.value) {
    clearTimeout(submenuTimeout.value)
    submenuTimeout.value = null
  }

  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const submenuWidth = 150

  let x = rect.right + 4
  let y = rect.top

  if (x + submenuWidth > window.innerWidth - 8) {
    x = rect.left - submenuWidth - 4
  }

  const submenuHeight = type === 'more' ? 100 : 180
  if (y + submenuHeight > window.innerHeight - 8) {
    y = window.innerHeight - submenuHeight - 8
  }

  if (type === 'status') {
    statusSubmenuPosition.value = { x, y }
    showStatusSubmenu.value = true
  } else if (type === 'duration') {
    durationSubmenuPosition.value = { x, y }
    showDurationSubmenu.value = true
  } else {
    moreSubmenuPosition.value = { x, y }
    showMoreSubmenu.value = true
  }
}

const _keepSubmenuOpen = (_type: 'status' | 'duration' | 'more') => {
  if (submenuTimeout.value) {
    clearTimeout(submenuTimeout.value)
    submenuTimeout.value = null
  }
}

const closeSubmenu = (type: 'status' | 'duration' | 'more') => {
  submenuTimeout.value = setTimeout(() => {
    if (type === 'status') showStatusSubmenu.value = false
    else if (type === 'duration') showDurationSubmenu.value = false
    else showMoreSubmenu.value = false
  }, 150)
}

// Actions
const handleEdit = () => {
  if (currentTask.value && !isBatchOperation.value) {
    emit('edit', currentTask.value.id)
  }
  emit('close')
}

const setDueDate = async (dateType: string) => {
  if (!currentTask.value) return

  if (isBatchOperation.value) {
    emit('setDueDate', dateType as 'today' | 'tomorrow' | 'weekend' | 'nextweek')
    emit('close')
    return
  }

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
    case 'weekend': {
      dueDate = new Date(today)
      const daysUntilSaturday = (6 - today.getDay()) % 7 || 7
      dueDate.setDate(today.getDate() + daysUntilSaturday)
      break
    }
    case 'nextweek': {
      dueDate = new Date(today)
      const daysUntilNextMonday = (8 - today.getDay()) % 7 || 7
      dueDate.setDate(today.getDate() + daysUntilNextMonday)
      break
    }
    case 'custom': {
      const currentDate = currentTask.value.dueDate
      const newDate = prompt('Set due date (MM/DD/YYYY):', currentDate)
      if (newDate && newDate !== currentDate) {
        try {
          await taskStore.updateTaskWithUndo(currentTask.value.id, { dueDate: newDate })
          canvasStore.requestSync('user:context-menu')
        } catch (error) {
          console.error('Error updating task due date:', error)
        }
      }
      emit('close')
      return
    }
    default:
      return
  }

  if (dueDate) {
    try {
      const formattedDate = dueDate.toLocaleDateString()
      await taskStore.updateTaskWithUndo(currentTask.value.id, { dueDate: formattedDate })
      canvasStore.requestSync('user:context-menu')
    } catch (error) {
      console.error('Error setting due date:', error)
    }
  }
  emit('close')
}

const setPriority = async (priority: 'high' | 'medium' | 'low') => {
  if (isBatchOperation.value) {
    emit('setPriority', priority)
  } else if (currentTask.value) {
    try {
      await taskStore.updateTaskWithUndo(currentTask.value.id, { priority })
      canvasStore.requestSync('user:context-menu')
    } catch (error) {
      console.error('Error setting priority:', error)
    }
  }
  emit('close')
}

const setStatus = async (status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold') => {
  if (isBatchOperation.value) {
    emit('setStatus', status as 'planned' | 'in_progress' | 'done')
  } else if (currentTask.value) {
    try {
      await taskStore.updateTaskWithUndo(currentTask.value.id, { status })
      canvasStore.requestSync('user:context-menu')
    } catch (error) {
      console.error('Error setting status:', error)
    }
  }
  showStatusSubmenu.value = false
  emit('close')
}

const setDuration = async (duration: number | null) => {
  if (isBatchOperation.value) {
    emit('setDuration', duration)
  } else if (currentTask.value) {
    try {
      await taskStore.updateTaskWithUndo(currentTask.value.id, { estimatedDuration: duration ?? undefined })
      canvasStore.requestSync('user:context-menu')
    } catch (error) {
      console.error('Error setting estimated duration:', error)
    }
  }
  showDurationSubmenu.value = false
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

const toggleDone = async () => {
  if (isBatchOperation.value) {
    emit('setStatus', 'done')
  } else if (currentTask.value) {
    const newStatus = currentTask.value.status === 'done' ? 'planned' : 'done'
    try {
      await taskStore.updateTaskWithUndo(currentTask.value.id, { status: newStatus })
      canvasStore.requestSync('user:context-menu')
    } catch (error) {
      console.error('Error toggling done status:', error)
    }
  }
  emit('close')
}

const startTaskNow = () => {
  if (currentTask.value && !isBatchOperation.value) {
    taskStore.startTaskNowWithUndo(currentTask.value.id)
    timerStore.startTimer(currentTask.value.id, timerStore.settings.workDuration, false)

    if (router.currentRoute.value.name !== 'calendar') {
      router.push('/calendar')
    }

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

const duplicateTask = async () => {
  if (currentTask.value && !isBatchOperation.value) {
    try {
      await taskStore.createTaskWithUndo({
        title: currentTask.value.title + ' (Copy)',
        description: currentTask.value.description,
        status: currentTask.value.status,
        priority: currentTask.value.priority
      })
    } catch (error) {
      console.error('Error duplicating task:', error)
    }
  }
  showMoreSubmenu.value = false
  emit('close')
}

const deleteTask = () => {
  if (isBatchOperation.value) {
    emit('deleteSelected')
  } else if (currentTask.value) {
    const taskData = currentTask.value as unknown as { instanceId?: string; isCalendarEvent?: boolean }
    emit('confirmDelete', currentTask.value.id, taskData.instanceId, taskData.isCalendarEvent)
  }
  emit('close')
}

// Click outside handler
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (target.closest('.submenu')) return
  if (menuRef.value && !menuRef.value.contains(target)) {
    emit('close')
  }
}

watch(() => props.isVisible, (isVisible) => {
  if (isVisible) {
    setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
    showStatusSubmenu.value = false
    showDurationSubmenu.value = false
    showMoreSubmenu.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (submenuTimeout.value) clearTimeout(submenuTimeout.value)
})
</script>

<style scoped>
.context-menu {
  position: absolute;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow);
  padding: var(--space-2) 0;
  min-width: 240px;
  max-width: 280px;
  z-index: var(--z-dropdown);
  animation: menuSlideIn var(--duration-fast) var(--ease-out);
}

@keyframes menuSlideIn {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.context-menu-header {
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  background: var(--glass-bg-light);
  border-bottom: 1px solid var(--glass-border-light);
  margin-bottom: var(--space-1);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Menu Items */
.menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: background var(--duration-fast);
}

.menu-item:hover { background: var(--glass-bg-heavy); }
.menu-item.active { color: var(--brand-primary); }
.menu-item.danger { color: var(--danger-text); }
.menu-item.danger:hover { background: var(--danger-bg-subtle); }

.menu-item--sm {
  padding: var(--space-1_5) var(--space-2_5);
  font-size: var(--text-xs);
}

.menu-icon { flex-shrink: 0; opacity: 0.8; }
.menu-text { flex: 1; }
.menu-shortcut { color: var(--text-muted); font-size: var(--text-xs); opacity: 0.6; }

.menu-divider {
  height: 1px;
  background: var(--glass-bg-heavy);
  margin: var(--space-2) 0;
}

/* Sections */
.menu-section { padding: var(--space-1_5) var(--space-3); }
.menu-section--tight { padding: var(--space-1_5) var(--space-3) var(--space-2); }

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  margin-bottom: var(--space-2);
}

.section-header--inline {
  margin-bottom: var(--space-1_5);
}

.section-icon { color: var(--text-muted); opacity: 0.6; }
.section-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Pill Row */
.pill-row {
  display: flex;
  gap: var(--space-1_5);
  flex-wrap: nowrap;
}

.pill-btn {
  padding: var(--space-1) var(--space-2_5);
  border-radius: var(--radius-xl);
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  white-space: nowrap;
}

.pill-btn--sm { padding: var(--space-1) var(--space-2); font-size: var(--text-xs); }

.pill-btn:hover {
  background: var(--glass-border);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.pill-btn.active {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.pill-btn--icon {
  padding: var(--space-0_5) var(--space-1);
  min-width: 24px;
  justify-content: center;
}

/* Priority Pills */
.pill-btn--priority-high:hover,
.pill-btn--priority-high.active {
  background: var(--priority-high-bg);
  border-color: var(--color-priority-high);
  color: var(--color-priority-high);
}

.pill-btn--priority-medium:hover,
.pill-btn--priority-medium.active {
  background: var(--priority-medium-bg);
  border-color: var(--color-priority-medium);
  color: var(--color-priority-medium);
}

.pill-btn--priority-low:hover,
.pill-btn--priority-low.active {
  background: var(--priority-low-bg);
  border-color: var(--color-priority-low);
  color: var(--color-priority-low);
}

.priority-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
}

.priority-dot.high { background: var(--color-priority-high); }
.priority-dot.medium { background: var(--color-priority-medium); }
.priority-dot.low { background: var(--color-priority-low); }

/* Inline Row for Status/Duration */
.inline-row {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-1_5) var(--space-3) var(--space-2_5);
}

.inline-select {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-2_5);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-bg-heavy);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.inline-select:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
}

.inline-icon { color: var(--text-muted); flex-shrink: 0; }
.inline-value { flex: 1; font-size: var(--text-xs); color: var(--text-secondary); }
.inline-arrow { color: var(--text-muted); opacity: 0.5; }

/* Action Bar */
.action-bar {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  justify-content: space-between;
}

.action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2_5) var(--space-1_5);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-bg-heavy);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  color: var(--text-secondary);
}

.action-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.action-btn--done { color: var(--color-work); }
.action-btn--done:hover { background: var(--status-done-bg); border-color: var(--color-work); }
.action-btn--done.active {
  background: var(--status-done-bg);
  border-color: var(--color-work);
  color: var(--color-work);
}

.action-btn--start { color: var(--color-break); }
.action-btn--start:hover { background: var(--status-in-progress-bg); border-color: var(--color-break); }

.action-btn--timer { color: var(--brand-primary); }
.action-btn--timer:hover { background: var(--brand-bg-subtle); border-color: var(--brand-primary); }

.action-btn--focus { color: var(--color-focus); }
.action-btn--focus:hover { background: var(--status-on-hold-bg); border-color: var(--color-focus); }

.action-label { font-size: var(--text-xs); font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; }

/* Submenu */
.has-submenu { position: relative; }
.submenu-arrow { color: var(--text-muted); margin-left: auto; }

.submenu {
  position: fixed;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow);
  padding: var(--space-1) 0;
  min-width: 130px;
  z-index: calc(var(--z-dropdown) + 1);
  animation: menuSlideIn var(--duration-fast) var(--ease-out);
}

/* Status Icons */
.status-icon { flex-shrink: 0; }
.status-icon.planned { color: var(--color-info); }
.status-icon.in_progress { color: var(--color-break); }
.status-icon.done { color: var(--color-work); }
.status-icon.backlog { color: var(--text-muted); }
.status-icon.on_hold { color: var(--color-danger); }

/* Duration Icons */
.duration-icon { flex-shrink: 0; }
.duration-icon.quick { color: var(--green-text); }
.duration-icon.short { color: var(--color-work); }
.duration-icon.medium { color: var(--orange-text); }
.duration-icon.long { color: var(--danger-text); }
.duration-icon.none { color: var(--text-muted); }
</style>
