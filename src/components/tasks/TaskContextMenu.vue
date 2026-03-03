<template>
  <Teleport to="body">
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

    <!-- Edit Task (single only) -->
    <button v-if="!isBatchOperation" class="menu-item" @click="handleEdit">
      <Pencil :size="16" class="menu-icon" />
      <span class="menu-text">Edit</span>
      <span class="menu-shortcut">Ctrl+E</span>
    </button>

    <!-- Mark as Done / Mark as To Do -->
    <button class="menu-item" @click="toggleDone">
      <CheckCircle :size="16" class="menu-icon" :class="{ 'icon-done': currentTask?.status === 'done' }" />
      <span class="menu-text">{{ doneToggleLabel }}</span>
    </button>

    <div class="menu-divider" />

    <!-- Due Date with submenu -->
    <div
      class="menu-item has-submenu"
      @mouseenter="openSubmenu('dueDate', $event)"
      @mouseleave="closeSubmenu('dueDate')"
    >
      <Calendar :size="16" class="menu-icon" />
      <span class="menu-text">Due Date</span>
      <span class="menu-item-value">{{ currentDueDateLabel }}</span>
      <ChevronRight :size="14" class="submenu-arrow" />
    </div>

    <!-- Priority with submenu -->
    <div
      class="menu-item has-submenu"
      @mouseenter="openSubmenu('priority', $event)"
      @mouseleave="closeSubmenu('priority')"
    >
      <span class="priority-dot-sm" :class="currentTask?.priority || 'none'" />
      <span class="menu-text">Priority</span>
      <span class="menu-item-value">{{ currentPriorityLabel }}</span>
      <ChevronRight :size="14" class="submenu-arrow" />
    </div>

    <!-- Project with submenu -->
    <div
      class="menu-item has-submenu"
      @mouseenter="openSubmenu('project', $event)"
      @mouseleave="closeSubmenu('project')"
    >
      <FolderOpen :size="16" class="menu-icon" />
      <span class="menu-text">Project</span>
      <span class="menu-item-value">{{ currentProjectLabel }}</span>
      <ChevronRight :size="14" class="submenu-arrow" />
    </div>

    <div class="menu-divider" />

    <!-- Start Timer -->
    <button class="menu-item" @click="startTimer">
      <Timer :size="16" class="menu-icon" />
      <span class="menu-text">Start Timer</span>
    </button>

    <!-- AI Assist -->
    <button class="menu-item menu-item--ai" @click="openAIAssist">
      <Sparkles :size="16" class="menu-icon menu-icon--ai" />
      <span class="menu-text">AI Assist</span>
    </button>

    <div class="menu-divider" />

    <!-- More submenu -->
    <div
      class="menu-item has-submenu"
      @mouseenter="openSubmenu('more', $event)"
      @mouseleave="closeSubmenu('more')"
    >
      <MoreHorizontal :size="16" class="menu-icon" />
      <span class="menu-text">More</span>
      <ChevronRight :size="14" class="submenu-arrow" />
    </div>

    <!-- MoreSubmenu with ALL event handlers including nested submenus -->
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
      @move-to-section="(taskId: string) => { closeAllSubmenusNow(); $emit('moveToSection', taskId); $emit('close') }"
      @clear-selection="() => { closeAllSubmenusNow(); clearSelection() }"
      @open-canvas-group="handleMoreCanvasGroup"
      @close-canvas-group="closeSubmenu('canvasGroup')"
      @open-duration="handleMoreDuration"
      @close-duration="closeSubmenu('duration')"
      @focus-mode="enterFocus"
      @start-now="() => { closeAllSubmenusNow(); startTaskNow(); emit('close') }"
      @permanent-delete="permanentlyDeleteTask"
    />

    <!-- DueDateSubmenu -->
    <DueDateSubmenu
      :is-visible="showDueDateSubmenu"
      :parent-visible="isVisible"
      :style="dueDateSubmenuStyle"
      :current-due-date="currentTask?.dueDate"
      @mouseenter="keepSubmenuOpen"
      @mouseleave="closeSubmenu('dueDate')"
      @select="(dateType: string) => { closeAllSubmenusNow(); setDueDate(dateType as 'today' | 'tomorrow' | 'weekend' | 'nextweek') }"
      @pick-date="handleDatePickerSelect"
      @clear-date="() => { closeAllSubmenusNow(); clearDueDate() }"
    />

    <!-- PrioritySubmenu -->
    <PrioritySubmenu
      :is-visible="showPrioritySubmenu"
      :parent-visible="isVisible"
      :style="prioritySubmenuStyle"
      :current-priority="currentTask?.priority"
      @mouseenter="keepSubmenuOpen"
      @mouseleave="closeSubmenu('priority')"
      @select="(p: 'high' | 'medium' | 'low') => { closeAllSubmenusNow(); setPriority(p) }"
      @clear-priority="() => { closeAllSubmenusNow(); clearPriority() }"
    />

    <!-- ProjectSubmenu -->
    <ProjectSubmenu
      :is-visible="showProjectSubmenu"
      :parent-visible="isVisible"
      :style="projectSubmenuStyle"
      :current-project-id="currentTask?.projectId"
      @mouseenter="keepSubmenuOpen"
      @mouseleave="closeSubmenu('project')"
      @select="(id: string | null) => { closeAllSubmenusNow(); setProject(id) }"
    />

    <!-- CanvasGroupSubmenu (triggered from More submenu) -->
    <CanvasGroupSubmenu
      :is-visible="showCanvasGroupSubmenu"
      :parent-visible="isVisible"
      :style="canvasGroupSubmenuStyle"
      :current-group-id="currentTask?.parentId"
      @mouseenter="keepSubmenuOpen"
      @mouseleave="closeSubmenu('canvasGroup')"
      @select="(id: string | null) => { closeAllSubmenusNow(); handleMoveToGroup(id) }"
    />

    <!-- DurationSubmenu (triggered from More submenu) -->
    <DurationSubmenu
      :is-visible="showDurationSubmenu"
      :parent-visible="isVisible"
      :style="durationSubmenuStyle"
      :current-duration="currentTask?.estimatedDuration"
      @mouseenter="keepSubmenuOpen"
      @mouseleave="closeSubmenu('duration')"
      @select="(d: number | null) => { closeAllSubmenusNow(); setDuration(d) }"
    />

    <div class="menu-divider" />

    <!-- Delete -->
    <button class="menu-item danger" @click="deleteTask">
      <Trash2 :size="16" class="menu-icon" />
      <span class="menu-text">{{ deleteText }}</span>
    </button>

    <!-- AI Assist Popover -->
    <AITaskAssistPopover
      :is-visible="showAIAssist"
      :task="currentTask"
      :x="aiAssistPosition.x"
      :y="aiAssistPosition.y"
      context="context-menu"
      @close="closeAIAssist"
      @accept-priority="handleAIAcceptPriority"
      @accept-breakdown="handleAIAcceptBreakdown"
      @accept-date="handleAIAcceptDate"
    />
  </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch, inject } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useProjectStore } from '@/stores/projects'
import {
  Calendar,
  CheckCircle,
  Timer,
  FolderOpen,
  ChevronRight,
  Pencil,
  Trash2,
  MoreHorizontal,
  Sparkles
} from 'lucide-vue-next'
import { FOCUS_MODE_KEY } from '@/composables/useFocusMode'
import type { FocusModeState } from '@/composables/useFocusMode'
import type { Task } from '@/stores/tasks'

// New Architecture Imports
import { useTaskContextMenuActions } from '@/composables/tasks/useTaskContextMenuActions'
import { useQuickTasks } from '@/composables/useQuickTasks'
import { useToast } from '@/composables/useToast'
import DueDateSubmenu from './context-menu/DueDateSubmenu.vue'
import PrioritySubmenu from './context-menu/PrioritySubmenu.vue'
import DurationSubmenu from './context-menu/DurationSubmenu.vue'
import MoreSubmenu from './context-menu/MoreSubmenu.vue'
import ProjectSubmenu from './context-menu/ProjectSubmenu.vue'
import CanvasGroupSubmenu from './context-menu/CanvasGroupSubmenu.vue'
import AITaskAssistPopover from '@/components/ai/AITaskAssistPopover.vue'
import { useMoveToCanvasGroup } from '@/composables/canvas/useMoveToCanvasGroup'

interface Props {
  isVisible: boolean
  x: number
  y: number
  task: Task | null
  compactMode?: boolean
  selectedCount?: number
  selectedIds?: string[]
  contextTask?: Task | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  edit: [taskId: string]
  confirmDelete: [taskId: string, instanceId?: string, isCalendarEvent?: boolean]
  confirmPermanentDelete: [taskId: string]
  clearSelection: []
  setPriority: [priority: 'low' | 'medium' | 'high']
  setStatus: [status: 'todo' | 'done']
  setDueDate: [dateType: 'today' | 'tomorrow' | 'weekend' | 'nextweek']
  enterFocusMode: []
  deleteSelected: []
  setDuration: [duration: number | null]
  moveToSection: [taskId: string]
  setProject: [projectId: string | null]
}>()

// TASK-1429: Initialize canvas group move composable at setup time
const { moveToGroupWithToast } = useMoveToCanvasGroup()

// Use the new composable for business logic
const {
  currentTask,
  isBatchOperation,
  handleEdit,
  setDueDate,
  setPriority,
  setStatus,
  setDuration,
  setProject,
  toggleDone,
  startTaskNow,
  startTimer,
  duplicateTask,
  deleteTask,
  clearSelection
} = useTaskContextMenuActions(props, emit as (event: string, ...args: unknown[]) => void)

const focusModeState = inject<FocusModeState | null>(FOCUS_MODE_KEY, null)
const enterFocusModeFn = focusModeState?.enterFocusMode || null

// Direct store access for custom date handling
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const projectStore = useProjectStore()

const menuRef = ref<HTMLElement | null>(null)

// AI Assist popover state
const showAIAssist = ref(false)
const aiAssistPosition = ref({ x: 0, y: 0 })

// Submenu state
const showDueDateSubmenu = ref(false)
const showPrioritySubmenu = ref(false)
const showDurationSubmenu = ref(false)
const showMoreSubmenu = ref(false)
const showProjectSubmenu = ref(false)
const showCanvasGroupSubmenu = ref(false)
const submenuTimeouts = ref(new Map<string, ReturnType<typeof setTimeout>>())
const dueDateSubmenuPosition = ref({ x: 0, y: 0 })
const prioritySubmenuPosition = ref({ x: 0, y: 0 })
const durationSubmenuPosition = ref({ x: 0, y: 0 })
const moreSubmenuPosition = ref({ x: 0, y: 0 })
const projectSubmenuPosition = ref({ x: 0, y: 0 })
const canvasGroupSubmenuPosition = ref({ x: 0, y: 0 })

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

const doneToggleLabel = computed(() => {
  if (isBatchOperation.value) {
    return `Mark ${props.selectedCount} as Done`
  }
  return currentTask.value?.status === 'done' ? 'Mark as To Do' : 'Mark as Done'
})

const currentDueDateLabel = computed(() => {
  const dueDate = currentTask.value?.dueDate
  if (!dueDate) return ''
  const due = new Date(dueDate)
  if (isNaN(due.getTime())) return ''
  const today = new Date()
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (isSameDay(due, today)) return 'Today'
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (isSameDay(due, tomorrow)) return 'Tomorrow'
  // Format as "Mar 15" style
  return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

const currentPriorityLabel = computed(() => {
  const priority = currentTask.value?.priority
  if (!priority) return ''
  return priority.charAt(0).toUpperCase() + priority.slice(1)
})

// TASK-1336: Project label for context menu
const currentProjectLabel = computed(() => {
  const projectId = currentTask.value?.projectId
  if (!projectId) return 'No Project'
  return projectStore.getProjectDisplayName(projectId)
})

const deleteText = computed(() => {
  if (isBatchOperation.value) {
    return `Delete ${props.selectedCount}`
  }
  const task = currentTask.value
  return (task && 'isCalendarEvent' in task && (task as Record<string, unknown>).isCalendarEvent) ? 'Remove' : 'Delete'
})

// Handle date selection from DueDateSubmenu picker - directly update task store
const handleDatePickerSelect = async (timestamp: number) => {
  if (!currentTask.value) return

  // Use local date components to avoid timezone shift
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const formattedDate = `${year}-${month}-${day}`

  // TASK-1362: Capture calendar instance info before menu closes
  const taskId = currentTask.value.id
  const calendarInstanceId = (currentTask.value as unknown as Record<string, unknown>)?.instanceId as string | undefined
  const isCalendarEvent = (currentTask.value as unknown as Record<string, unknown>)?.isCalendarEvent as boolean | undefined

  closeAllSubmenusNow()

  // Update the task directly via task store
  try {
    await taskStore.updateTaskWithUndo(taskId, { dueDate: formattedDate })
    // TASK-1362: Also move calendar instance to selected date
    if (isCalendarEvent && calendarInstanceId) {
      await taskStore.updateTaskInstance(taskId, calendarInstanceId, { scheduledDate: formattedDate })
    }
    canvasStore.requestSync('user:context-menu')
  } catch (error) {
    console.error('Error updating task due date:', error)
  }

  emit('close')
}

// Clear due date
const clearDueDate = async () => {
  if (!currentTask.value) return
  try {
    await taskStore.updateTaskWithUndo(currentTask.value.id, { dueDate: '' })
    canvasStore.requestSync('user:context-menu')
  } catch (error) {
    console.error('Error clearing task due date:', error)
  }
  emit('close')
}

// Clear priority
const clearPriority = async () => {
  if (!currentTask.value) return
  try {
    await taskStore.updateTaskWithUndo(currentTask.value.id, { priority: null })
    canvasStore.requestSync('user:context-menu')
  } catch (error) {
    console.error('Error clearing task priority:', error)
  }
  emit('close')
}

// Handle "Done for now" - reschedule task to tomorrow with tracking badge
const handleDoneForNow = async () => {
  // BUG-1184: Capture task data BEFORE closing menu
  const taskId = currentTask.value?.id
  const calendarInstanceId = (currentTask.value as unknown as Record<string, unknown>)?.instanceId as string | undefined
  const isCalendarEvent = (currentTask.value as unknown as Record<string, unknown>)?.isCalendarEvent as boolean | undefined

  // BUG-1095: Close menu FIRST to prevent "stuck" menu
  emit('close')

  if (!taskId) return

  const { showToast } = useToast()

  // Calculate tomorrow's date
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  const tomorrowStr = `${year}-${month}-${day}`

  try {
    const task = currentTask.value
    // Set dueDate, doneForNowUntil, and scheduledDate (if present) to tomorrow
    // BUG-1429: Without updating scheduledDate, isTodayTask still matches on the old date
    const updatePayload: Record<string, string> = {
      dueDate: tomorrowStr,
      doneForNowUntil: tomorrowStr
    }
    if (task?.scheduledDate) {
      updatePayload.scheduledDate = tomorrowStr
    }
    await taskStore.updateTaskWithUndo(taskId, updatePayload)
    // TASK-1362: Also move calendar instance to tomorrow
    if (isCalendarEvent && calendarInstanceId) {
      await taskStore.updateTaskInstance(taskId, calendarInstanceId, { scheduledDate: tomorrowStr })
    }
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

// TASK-1429: Handle Canvas Group selection — calls composable directly (no emit chain)
const handleMoveToGroup = async (groupId: string | null) => {
  const ids = props.selectedIds?.length ? [...props.selectedIds] : currentTask.value ? [currentTask.value.id] : []
  console.log('[MOVE-GROUP] handleMoveToGroup', { groupId, ids })
  emit('close')
  if (ids.length === 0) return
  await moveToGroupWithToast(ids, groupId)
}

// Handle MoreSubmenu nested Canvas Group submenu positioning
const handleMoreCanvasGroup = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const triggerRect = target.getBoundingClientRect()
  const submenuWidth = 200
  let x = triggerRect.right + 4
  let y = triggerRect.top
  if (x + submenuWidth > window.innerWidth - 8) {
    x = triggerRect.left - submenuWidth - 4
  }
  if (y + 250 > window.innerHeight - 8) {
    y = window.innerHeight - 250 - 8
  }
  canvasGroupSubmenuPosition.value = { x, y }
  showCanvasGroupSubmenu.value = true
}

// Handle MoreSubmenu nested Duration submenu positioning
const handleMoreDuration = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const triggerRect = target.getBoundingClientRect()
  const submenuWidth = 150
  let x = triggerRect.right + 4
  let y = triggerRect.top
  if (x + submenuWidth > window.innerWidth - 8) {
    x = triggerRect.left - submenuWidth - 4
  }
  if (y + 180 > window.innerHeight - 8) {
    y = window.innerHeight - 180 - 8
  }
  durationSubmenuPosition.value = { x, y }
  showDurationSubmenu.value = true
}

// AI Assist handlers
const openAIAssist = (_event: MouseEvent) => {
  const menuRect = menuRef.value?.getBoundingClientRect()
  if (menuRect) {
    aiAssistPosition.value = {
      x: menuRect.right + 4,
      y: menuRect.top
    }
  } else {
    aiAssistPosition.value = { x: props.x + 240, y: props.y }
  }
  showAIAssist.value = true
}

const closeAIAssist = () => {
  showAIAssist.value = false
}

const handleAIAcceptPriority = (priority: string, duration: number) => {
  if (!currentTask.value) return
  const validPriority = ['low', 'medium', 'high'].includes(priority) ? priority as 'low' | 'medium' | 'high' : undefined
  if (validPriority) setPriority(validPriority)
  if (duration) setDuration(duration)
  emit('close')
}

const handleAIAcceptBreakdown = async (tasks: Array<{ title: string; priority?: string }>) => {
  for (const t of tasks) {
    const validPriority = ['low', 'medium', 'high'].includes(t.priority || '') ? t.priority as 'low' | 'medium' | 'high' : 'medium'
    await taskStore.createTask({
      title: t.title,
      priority: validPriority,
      status: 'todo'
    })
  }
  showAIAssist.value = false
  emit('close')
}

const handleAIAcceptDate = async (date: string) => {
  if (!currentTask.value) return
  try {
    await taskStore.updateTaskWithUndo(currentTask.value.id, { dueDate: date })
    canvasStore.requestSync('user:context-menu')
  } catch (error) {
    console.error('Error updating task due date from AI:', error)
  }
  showAIAssist.value = false
  emit('close')
}

// Menu positioning
const menuPosition = computed(() => {
  if (!menuRef.value) {
    return { left: props.x + 'px', top: props.y + 'px', position: 'fixed' as const }
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

  return { left: left + 'px', top: top + 'px', position: 'fixed' as const }
})

// Submenu styles
const dueDateSubmenuStyle = computed(() => ({
  left: dueDateSubmenuPosition.value.x + 'px',
  top: dueDateSubmenuPosition.value.y + 'px'
}))

const prioritySubmenuStyle = computed(() => ({
  left: prioritySubmenuPosition.value.x + 'px',
  top: prioritySubmenuPosition.value.y + 'px'
}))

const durationSubmenuStyle = computed(() => ({
  left: durationSubmenuPosition.value.x + 'px',
  top: durationSubmenuPosition.value.y + 'px'
}))

const moreSubmenuStyle = computed(() => ({
  left: moreSubmenuPosition.value.x + 'px',
  top: moreSubmenuPosition.value.y + 'px'
}))

const projectSubmenuStyle = computed(() => ({
  left: projectSubmenuPosition.value.x + 'px',
  top: projectSubmenuPosition.value.y + 'px'
}))

const canvasGroupSubmenuStyle = computed(() => ({
  left: canvasGroupSubmenuPosition.value.x + 'px',
  top: canvasGroupSubmenuPosition.value.y + 'px'
}))

// Submenu handlers
const clearAllSubmenuTimeouts = () => {
  for (const t of submenuTimeouts.value.values()) clearTimeout(t)
  submenuTimeouts.value.clear()
}

const openSubmenu = (type: 'dueDate' | 'priority' | 'duration' | 'more' | 'project' | 'canvasGroup', event: MouseEvent) => {
  clearAllSubmenuTimeouts()

  // BUG-1095: Close ALL other submenus before opening a new one
  showDueDateSubmenu.value = false
  showPrioritySubmenu.value = false
  showDurationSubmenu.value = false
  showMoreSubmenu.value = false
  showProjectSubmenu.value = false
  showCanvasGroupSubmenu.value = false

  const target = event.currentTarget as HTMLElement
  const triggerRect = target.getBoundingClientRect()
  const menuRect = menuRef.value?.getBoundingClientRect()
  const submenuWidth = (type === 'project' || type === 'canvasGroup') ? 200 : (type === 'dueDate') ? 180 : 150

  // BUG-1095: Position to the right of the MENU, not the trigger
  let x = menuRect ? menuRect.right + 4 : triggerRect.right + 4
  // Y position stays relative to trigger for vertical alignment
  let y = triggerRect.top

  // Flip to left if not enough space on right
  if (x + submenuWidth > window.innerWidth - 8) {
    x = menuRect ? menuRect.left - submenuWidth - 4 : triggerRect.left - submenuWidth - 4
  }

  const submenuHeight = type === 'more' ? 360 : (type === 'project' || type === 'canvasGroup') ? 250 : (type === 'dueDate') ? 300 : 180
  if (y + submenuHeight > window.innerHeight - 8) {
    y = window.innerHeight - submenuHeight - 8
  }

  if (type === 'dueDate') {
    dueDateSubmenuPosition.value = { x, y }
    showDueDateSubmenu.value = true
  } else if (type === 'priority') {
    prioritySubmenuPosition.value = { x, y }
    showPrioritySubmenu.value = true
  } else if (type === 'duration') {
    durationSubmenuPosition.value = { x, y }
    showDurationSubmenu.value = true
  } else if (type === 'project') {
    projectSubmenuPosition.value = { x, y }
    showProjectSubmenu.value = true
  } else if (type === 'canvasGroup') {
    canvasGroupSubmenuPosition.value = { x, y }
    showCanvasGroupSubmenu.value = true
  } else {
    moreSubmenuPosition.value = { x, y }
    showMoreSubmenu.value = true
  }
}

const keepSubmenuOpen = () => {
  clearAllSubmenuTimeouts()
}

const closeSubmenu = (type: 'dueDate' | 'priority' | 'duration' | 'more' | 'project' | 'canvasGroup') => {
  // Clear any existing timeout for this type
  const existing = submenuTimeouts.value.get(type)
  if (existing) clearTimeout(existing)

  const timeout = setTimeout(() => {
    submenuTimeouts.value.delete(type)
    if (type === 'dueDate') showDueDateSubmenu.value = false
    else if (type === 'priority') showPrioritySubmenu.value = false
    else if (type === 'duration') {
      showDurationSubmenu.value = false
      // Also close More if no nested child is open
      if (!showCanvasGroupSubmenu.value) showMoreSubmenu.value = false
    }
    else if (type === 'project') showProjectSubmenu.value = false
    else if (type === 'canvasGroup') {
      showCanvasGroupSubmenu.value = false
      // Also close More if no nested child is open
      if (!showDurationSubmenu.value) showMoreSubmenu.value = false
    }
    else {
      // Closing 'more' — skip if a nested child submenu is still open
      if (!showCanvasGroupSubmenu.value && !showDurationSubmenu.value) {
        showMoreSubmenu.value = false
      }
    }
  }, 150)
  submenuTimeouts.value.set(type, timeout)
}

// BUG-1095: Immediately close ALL submenus - no timeout
const closeAllSubmenusNow = () => {
  clearAllSubmenuTimeouts()
  showDueDateSubmenu.value = false
  showPrioritySubmenu.value = false
  showDurationSubmenu.value = false
  showMoreSubmenu.value = false
  showProjectSubmenu.value = false
  showCanvasGroupSubmenu.value = false
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

const permanentlyDeleteTask = () => {
  if (!isBatchOperation.value && currentTask.value) {
    emit('confirmPermanentDelete', currentTask.value.id)
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
    showDueDateSubmenu.value = false
    showPrioritySubmenu.value = false
    showDurationSubmenu.value = false
    showMoreSubmenu.value = false
    showProjectSubmenu.value = false
    showCanvasGroupSubmenu.value = false
    showAIAssist.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  clearAllSubmenuTimeouts()
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  padding: var(--space-2) 0;
  min-width: 240px;
  max-width: 280px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  z-index: 9999;
  animation: menuSlideIn 150ms ease-out;
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
  text-align: start;
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

.menu-icon { flex-shrink: 0; opacity: 0.8; }
.menu-text { flex: 1; }
.menu-shortcut { color: var(--text-muted); font-size: var(--text-xs); opacity: 0.6; }

.menu-divider {
  height: 1px;
  background: var(--glass-bg-heavy);
  margin: var(--space-2) 0;
}

/* Current value shown on right side of submenu trigger */
.menu-item-value {
  color: var(--text-muted);
  font-size: var(--text-xs);
  margin-inline-start: auto;
  margin-inline-end: var(--space-1);
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Small priority dot for the priority trigger item */
.priority-dot-sm {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.priority-dot-sm.high { background: var(--color-priority-high); }
.priority-dot-sm.medium { background: var(--color-priority-medium); }
.priority-dot-sm.low { background: var(--color-priority-low); }
.priority-dot-sm.none { background: var(--text-muted); opacity: 0.4; }

/* Done checkmark teal color */
.icon-done { color: var(--brand-primary); opacity: 1; }

/* AI Assist Menu Item */
.menu-item--ai {
  color: var(--brand-primary);
}

.menu-item--ai:hover {
  background: var(--brand-bg-subtle);
}

.menu-icon--ai {
  color: var(--brand-primary);
  opacity: 1;
}

/* Submenu */
.has-submenu { position: relative; }
.submenu-arrow { color: var(--text-muted); margin-inline-start: auto; }
</style>
