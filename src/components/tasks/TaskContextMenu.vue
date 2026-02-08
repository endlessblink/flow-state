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
        <button class="pill-btn pill-btn--sm" @click="setDueDate('today')">
          Today
        </button>
        <button class="pill-btn pill-btn--sm" @click="setDueDate('tomorrow')">
          Tmrw
        </button>
        <button class="pill-btn pill-btn--sm" @click="setDueDate('weekend')">
          Wknd
        </button>
        <button class="pill-btn pill-btn--sm" @click="setDueDate('nextweek')">
          +1wk
        </button>
        <NPopover
          trigger="click"
          placement="right-start"
          :show="showDatePicker"
          @update:show="showDatePicker = $event"
        >
          <template #trigger>
            <button class="pill-btn pill-btn--sm pill-btn--icon" title="Pick date">
              <CalendarPlus :size="12" />
            </button>
          </template>
          <div class="date-picker-popover" @click.stop>
            <NDatePicker
              panel
              type="date"
              :value="currentDueDateTimestamp"
              :actions="null"
              @update:value="handleDatePickerSelect"
            />
            <div class="date-picker-footer">
              <button class="footer-btn" @click="setDueDate('nextmonth'); showDatePicker = false">
                +1mo
              </button>
              <button class="footer-btn" @click="setDueDate('twomonths'); showDatePicker = false">
                +2mo
              </button>
              <button class="footer-btn" @click="setDueDate('nextquarter'); showDatePicker = false">
                +3mo
              </button>
              <button class="footer-btn" @click="setDueDate('halfyear'); showDatePicker = false">
                +6mo
              </button>
              <button class="footer-btn footer-btn--now" @click="setDueDate('today'); showDatePicker = false">
                Now
              </button>
            </div>
          </div>
        </NPopover>
      </div>
    </div>

    <!-- Done for now - prominent action -->
    <button class="menu-item menu-item--highlight" @click="handleDoneForNow">
      <Clock :size="16" class="menu-icon" />
      <span class="menu-text">Done for now</span>
      <span class="menu-hint">→ Tomorrow</span>
    </button>

    <div class="menu-divider" />

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

    <!-- Decomposed Submenus -->
    <!-- BUG-1095: Pass parentVisible to ensure submenus close when parent closes -->
    <StatusSubmenu
      :is-visible="showStatusSubmenu"
      :parent-visible="isVisible"
      :style="statusSubmenuStyle"
      :current-status="currentTask?.status"
      @mouseenter="keepSubmenuOpen"
      @mouseleave="closeSubmenu('status')"
      @select="(s: string) => { closeAllSubmenusNow(); setStatus(s as 'planned' | 'in_progress' | 'done') }"
    />

    <DurationSubmenu
      :is-visible="showDurationSubmenu"
      :parent-visible="isVisible"
      :style="durationSubmenuStyle"
      :current-duration="currentTask?.estimatedDuration"
      @mouseenter="keepSubmenuOpen"
      @mouseleave="closeSubmenu('duration')"
      @select="(d: number | null) => { closeAllSubmenusNow(); setDuration(d) }"
    />

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

    <MoreSubmenu
      :is-visible="showMoreSubmenu"
      :parent-visible="isVisible"
      :style="moreSubmenuStyle"
      :is-batch-operation="isBatchOperation"
      :task-id="currentTask?.id"
      @mouseenter="keepSubmenuOpen"
      @mouseleave="closeSubmenu('more')"
      @done-for-now="() => { closeAllSubmenusNow(); handleDoneForNow() }"
      @duplicate="() => { closeAllSubmenusNow(); duplicateTask() }"
      @pin-quick-task="() => { closeAllSubmenusNow(); pinAsQuickTask() }"
      @move-to-section="taskId => { closeAllSubmenusNow(); $emit('moveToSection', taskId); $emit('close') }"
      @clear-selection="() => { closeAllSubmenusNow(); clearSelection() }"
    />

    <div class="menu-divider" />

    <!-- Delete -->
    <button class="menu-item danger" @click="deleteTask">
      <Trash2 :size="16" class="menu-icon" />
      <span class="menu-text">{{ deleteText }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch, inject } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import {
  Calendar,
  CalendarPlus,
  CheckCircle,
  Timer,
  Clock,
  Eye,
  Play,
  Flag,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  MoreHorizontal
} from 'lucide-vue-next'
import { NPopover, NDatePicker } from 'naive-ui'
import { FOCUS_MODE_KEY } from '@/composables/useFocusMode'
import type { FocusModeState } from '@/composables/useFocusMode'
import type { Task } from '@/stores/tasks'

// New Architecture Imports
import { useTaskContextMenuActions } from '@/composables/tasks/useTaskContextMenuActions'
import { useQuickTasks } from '@/composables/useQuickTasks'
import { useToast } from '@/composables/useToast'
import { statusOptions } from './context-menu/constants'
import StatusSubmenu from './context-menu/StatusSubmenu.vue'
import DurationSubmenu from './context-menu/DurationSubmenu.vue'
import MoreSubmenu from './context-menu/MoreSubmenu.vue'

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

// Use the new composable for business logic
const {
  currentTask,
  isBatchOperation,
  handleEdit,
  setDueDate,
  setPriority,
  setStatus,
  setDuration,
  toggleDone,
  startTaskNow,
  startTimer,
  duplicateTask,
  deleteTask,
  clearSelection
} = useTaskContextMenuActions(props, emit)

const focusModeState = inject<FocusModeState | null>(FOCUS_MODE_KEY, null)
const enterFocusModeFn = focusModeState?.enterFocusMode || null

// Direct store access for custom date handling
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()

const menuRef = ref<HTMLElement | null>(null)
const showDatePicker = ref(false)

// Submenu state
const showStatusSubmenu = ref(false)
const showDurationSubmenu = ref(false)
const showMoreSubmenu = ref(false)
const submenuTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const statusSubmenuPosition = ref({ x: 0, y: 0 })
const durationSubmenuPosition = ref({ x: 0, y: 0 })
const moreSubmenuPosition = ref({ x: 0, y: 0 })

// Computed properties for display
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
  const task = currentTask.value
  return (task && 'isCalendarEvent' in task && (task as any).isCalendarEvent) ? 'Remove' : 'Delete'
})

// Date picker value (timestamp in milliseconds for Naive UI)
const currentDueDateTimestamp = computed(() => {
  const dueDate = currentTask.value?.dueDate
  if (!dueDate) return null
  const date = new Date(dueDate)
  return isNaN(date.getTime()) ? null : date.getTime()
})

// Handle date selection from picker - directly update task store
const handleDatePickerSelect = async (timestamp: number | null) => {
  if (!timestamp || !currentTask.value) return

  // Use local date components to avoid timezone shift
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const formattedDate = `${year}-${month}-${day}`

  // Close the popover first
  showDatePicker.value = false

  // Update the task directly via task store
  try {
    await taskStore.updateTaskWithUndo(currentTask.value.id, { dueDate: formattedDate })
    canvasStore.requestSync('user:context-menu')
  } catch (error) {
    console.error('Error updating task due date:', error)
  }

  emit('close')
}

// Handle "Done for now" - reschedule task to tomorrow with tracking badge
const handleDoneForNow = async () => {
  // BUG-1095: Close menu FIRST to prevent "stuck" menu
  emit('close')

  if (!currentTask.value) return

  const { showToast } = useToast()

  // Calculate tomorrow's date
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  const tomorrowStr = `${year}-${month}-${day}`

  try {
    // Set both dueDate and doneForNowUntil to track the badge
    await taskStore.updateTaskWithUndo(currentTask.value.id, {
      dueDate: tomorrowStr,
      doneForNowUntil: tomorrowStr
    })
    canvasStore.requestSync('user:context-menu')
    showToast('Moved to tomorrow', 'success', { duration: 2000 })
  } catch (error) {
    console.error('Error updating task due date:', error)
    showToast('Failed to reschedule task', 'error')
  }
}

// FEATURE-1248: Pin task as quick task shortcut
const { pinFromTask } = useQuickTasks()
const pinAsQuickTask = async () => {
    emit('close')
    if (!currentTask.value) return
    const { showToast } = useToast()
    try {
        await pinFromTask(currentTask.value)
        showToast('Pinned as Quick Task', 'success', { duration: 2000 })
    } catch (error) {
        console.error('Error pinning quick task:', error)
        showToast('Failed to pin task', 'error')
    }
}

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

  // BUG-1095: Close ALL other submenus before opening a new one
  showStatusSubmenu.value = false
  showDurationSubmenu.value = false
  showMoreSubmenu.value = false

  const target = event.currentTarget as HTMLElement
  const triggerRect = target.getBoundingClientRect()
  const menuRect = menuRef.value?.getBoundingClientRect()
  const submenuWidth = 150

  // BUG-1095: Position to the right of the MENU, not the trigger
  let x = menuRect ? menuRect.right + 4 : triggerRect.right + 4
  // Y position stays relative to trigger for vertical alignment
  let y = triggerRect.top

  // Flip to left if not enough space on right
  if (x + submenuWidth > window.innerWidth - 8) {
    x = menuRect ? menuRect.left - submenuWidth - 4 : triggerRect.left - submenuWidth - 4
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

const keepSubmenuOpen = () => {
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

// BUG-1095: Immediately close ALL submenus - no timeout
const closeAllSubmenusNow = () => {
  if (submenuTimeout.value) {
    clearTimeout(submenuTimeout.value)
    submenuTimeout.value = null
  }
  showStatusSubmenu.value = false
  showDurationSubmenu.value = false
  showMoreSubmenu.value = false
}

const enterFocus = () => {
  // BUG-1095: Close submenus first
  closeAllSubmenusNow()
  emit('close')

  if (currentTask.value && !isBatchOperation.value && enterFocusModeFn) {
    enterFocusModeFn(currentTask.value.id)
  } else if (isBatchOperation.value) {
    emit('enterFocusMode')
  }
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

/* Highlighted menu item - stands out */
.menu-item--highlight {
  background: var(--amber-bg-light);
  border-left: var(--space-0_75) solid var(--amber-text);
  margin: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  width: calc(100% - var(--space-4));
}
.menu-item--highlight:hover {
  background: var(--amber-bg-medium);
}
.menu-item--highlight .menu-icon {
  color: var(--amber-text);
}

.menu-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  opacity: 0.7;
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
  width: var(--space-1_75);
  height: var(--space-1_75);
  border-radius: var(--radius-full);
}

.priority-dot.high { background: var(--color-priority-high); }
.priority-dot.medium { background: var(--color-priority-medium); }
.priority-dot.low { background: var(--color-priority-low); }

/* Date Picker Popover */
.date-picker-popover {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.date-picker-footer {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border);
}

.footer-btn {
  padding: 0 var(--space-2);
  height: var(--space-7);
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.footer-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.footer-btn--now {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: white;
}

.footer-btn--now:hover {
  background: var(--brand-primary-hover, var(--brand-primary));
}

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
</style>
