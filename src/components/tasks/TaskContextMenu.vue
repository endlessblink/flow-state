<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      ref="menuRef"
      class="context-menu"
      :style="menuPosition"
      @wheel.stop
      @pointerdown.stop
      @contextmenu.stop.prevent
    >
      <!-- Header for inbox/batch operations -->
      <div v-if="showInboxHeader" class="context-menu-header">
        <OverflowTooltip :text="displayHeaderText" tooltip-position="bottom">
          {{ displayHeaderText }}
        </OverflowTooltip>
      </div>

      <!-- Make the task currently receiving timer time unmistakable. -->
      <div v-if="runningTimerTask" class="running-task-indicator" role="status">
        <Timer :size="16" class="running-task-indicator__icon" />
        <div class="running-task-indicator__copy">
          <span class="running-task-indicator__label">{{ isCurrentTaskRunning ? 'Running now' : 'Timer running' }}</span>
          <OverflowTooltip :text="runningTimerTask.title" tooltip-position="bottom">
            <span class="running-task-indicator__title">{{ runningTimerTask.title }}</span>
          </OverflowTooltip>
        </div>
        <span class="running-task-indicator__time">{{ timerStore.displayTime }}</span>
      </div>

      <!-- Edit Task (single only) -->
      <button v-if="!isBatchOperation" class="menu-item" @click="handleEdit">
        <Pencil :size="16" class="menu-icon" />
        <span class="menu-text">Edit</span>
        <span class="menu-shortcut">Ctrl+E</span>
      </button>

      <!-- Mark as Done / Mark as To Do -->
      <button class="menu-item menu-item--done" @click="toggleDone">
        <CheckCircle :size="16" class="menu-icon" :class="{ 'icon-done': currentTask?.status === 'done' }" />
        <span class="menu-text">{{ doneToggleLabel }}</span>
      </button>

      <!-- Calendar-only: complete today's calendar occurrence without completing the task -->
      <button v-if="showCalendarDoneKeepTask" class="menu-item" @click="handleCalendarDoneKeepTask">
        <CheckCircle :size="16" class="menu-icon icon-done-for-now" />
        <span class="menu-text">Done for today</span>
      </button>

      <!-- Pin to Top / Unpin -->
      <button v-if="!isBatchOperation" class="menu-item" @click="togglePin">
        <component :is="currentTask?.isPinned ? PinOff : Pin" :size="16" class="menu-icon" />
        <span class="menu-text">{{ currentTask?.isPinned ? 'Unpin' : 'Pin to Top' }}</span>
      </button>

      <!-- TASK-1785 Push 2: Lock time on calendar (calendar context only) -->
      <button v-if="!isBatchOperation && context === 'calendar'" class="menu-item" @click="toggleCalendarLock">
        <LockOpen v-if="currentTask?.calendarLocked" :size="16" class="menu-icon" />
        <Lock v-else :size="16" class="menu-icon" />
        <span class="menu-text">{{ currentTask?.calendarLocked ? 'Unlock time' : 'Lock time on calendar' }}</span>
      </button>

      <div class="menu-divider" />

      <!-- Due Date with submenu -->
      <div
        class="menu-item has-submenu"
        @mouseenter="openSubmenu('dueDate', $event)"
        @mouseleave="handleTriggerLeave('dueDate', $event)"
      >
        <Calendar :size="16" class="menu-icon" />
        <span class="menu-text">Due Date</span>
        <OverflowTooltip :text="currentDueDateLabel" class="menu-item-value" tooltip-position="bottom">
          {{ currentDueDateLabel }}
        </OverflowTooltip>
        <ChevronRight :size="14" class="submenu-arrow" />
      </div>

      <!-- Priority with submenu -->
      <div
        class="menu-item has-submenu"
        @mouseenter="openSubmenu('priority', $event)"
        @mouseleave="handleTriggerLeave('priority', $event)"
      >
        <span class="priority-dot-sm" :class="currentTask?.priority || 'none'" />
        <span class="menu-text">Priority</span>
        <OverflowTooltip :text="currentPriorityLabel" class="menu-item-value" tooltip-position="bottom">
          {{ currentPriorityLabel }}
        </OverflowTooltip>
        <ChevronRight :size="14" class="submenu-arrow" />
      </div>

      <!-- Project with submenu -->
      <div
        class="menu-item has-submenu"
        @mouseenter="openSubmenu('project', $event)"
        @mouseleave="handleTriggerLeave('project', $event)"
      >
        <FolderOpen :size="16" class="menu-icon" />
        <span class="menu-text">Project</span>
        <OverflowTooltip :text="currentProjectLabel" class="menu-item-value" tooltip-position="bottom">
          {{ currentProjectLabel }}
        </OverflowTooltip>
        <ChevronRight :size="14" class="submenu-arrow" />
      </div>

      <div class="menu-divider" />

      <!-- Start Timer -->
      <button class="menu-item menu-item--timer" @click="startTimer">
        <Timer :size="16" class="menu-icon" />
        <span class="menu-text">Start Timer</span>
      </button>

      <!-- Stop the currently running timer from any task context menu -->
      <button
        v-if="timerStore.isTimerActive && !isBatchOperation"
        class="menu-item menu-item--timer menu-item--timer-stop"
        @click="stopTimer"
      >
        <Square :size="16" class="menu-icon" />
        <span class="menu-text">Stop Timer</span>
      </button>

      <!-- Open Thinking Flow (single task only) -->
      <button v-if="!isBatchOperation" class="menu-item" @click="handleOpenPlanningCanvas">
        <LayoutDashboard :size="16" class="menu-icon" />
        <span class="menu-text">Thinking Flow</span>
      </button>

      <!-- More submenu -->
      <div
        class="menu-item has-submenu"
        @mouseenter="openSubmenu('more', $event)"
        @mouseleave="handleTriggerLeave('more', $event)"
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
        :is-recurring="!!currentTask?.recurrenceRule"
        @mouseenter="handlePanelEnter"
        @mouseleave="handlePanelLeave('more')"
        @open-done-for-now="handleMoreDoneForNow"
        @close-done-for-now="closeSubmenu('doneForNow')"
        @done-fully="() => { closeAllSubmenusNow(); handleDoneFully() }"
        @duplicate="() => { closeAllSubmenusNow(); duplicateTask() }"
        @pin-quick-task="() => { closeAllSubmenusNow(); pinAsQuickTask() }"
        @clear-selection="() => { closeAllSubmenusNow(); clearSelection() }"
        @open-canvas-group="handleMoreCanvasGroup"
        @close-canvas-group="closeSubmenu('canvasGroup')"
        @open-duration="handleMoreDuration"
        @close-duration="closeSubmenu('duration')"
        @focus-mode="enterFocus"
        @start-now="() => { closeAllSubmenusNow(); startTaskNow(); emit('close') }"
        @ai-assist="(event: MouseEvent) => { closeAllSubmenusNow(); openAIAssist(event) }"
      />

      <!-- DueDateSubmenu -->
      <DueDateSubmenu
        :is-visible="showDueDateSubmenu"
        :parent-visible="isVisible"
        :style="dueDateSubmenuStyle"
        :current-due-date="currentTask?.dueDate"
        @mouseenter="handlePanelEnter"
        @mouseleave="handlePanelLeave('dueDate')"
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
        @mouseenter="handlePanelEnter"
        @mouseleave="handlePanelLeave('priority')"
        @select="(p: Exclude<TaskPriority, null>) => { closeAllSubmenusNow(); setPriority(p) }"
        @clear-priority="() => { closeAllSubmenusNow(); clearPriority() }"
      />

      <!-- ProjectSubmenu -->
      <ProjectSubmenu
        :is-visible="showProjectSubmenu"
        :parent-visible="isVisible"
        :style="projectSubmenuStyle"
        :current-project-id="currentTask?.projectId"
        @mouseenter="handlePanelEnter"
        @mouseleave="handlePanelLeave('project')"
        @select="(id: string | null) => { closeAllSubmenusNow(); setProject(id) }"
      />

      <!-- CanvasGroupSubmenu (triggered from More submenu) -->
      <CanvasGroupSubmenu
        :is-visible="showCanvasGroupSubmenu"
        :parent-visible="isVisible"
        :style="canvasGroupSubmenuStyle"
        :current-group-id="currentTask?.parentId"
        @mouseenter="handlePanelEnter"
        @mouseleave="handlePanelLeave('canvasGroup')"
        @select="(id: string | null) => { closeAllSubmenusNow(); handleMoveToGroup(id) }"
      />

      <!-- DurationSubmenu (triggered from More submenu) -->
      <DurationSubmenu
        :is-visible="showDurationSubmenu"
        :parent-visible="isVisible"
        :style="durationSubmenuStyle"
        :current-duration="currentTask?.estimatedDuration"
        @mouseenter="handlePanelEnter"
        @mouseleave="handlePanelLeave('duration')"
        @select="(d: number | null) => { closeAllSubmenusNow(); setDuration(d) }"
      />

      <!-- DoneForNowSubmenu (triggered from More submenu) -->
      <DoneForNowSubmenu
        :is-visible="showDoneForNowSubmenu"
        :parent-visible="isVisible"
        :style="doneForNowSubmenuStyle"
        :is-recurring="!!currentTask?.recurrenceRule"
        @mouseenter="handlePanelEnter"
        @mouseleave="handlePanelLeave('doneForNow')"
        @select-tomorrow="() => { closeAllSubmenusNow(); handleDoneForNowTomorrow() }"
        @select-next-occurrence="() => { closeAllSubmenusNow(); handleDoneForNowNextOccurrence() }"
        @pick-date="handleDoneForNowPickDate"
      />

      <div class="menu-divider" />

      <!-- Delete (soft - moves to trash) -->
      <button class="menu-item danger" @click="deleteTask">
        <Trash2 :size="16" class="menu-icon" />
        <span class="menu-text">{{ deleteText }}</span>
      </button>

      <!-- Permanent Delete (hard delete, bypasses trash) -->
      <button v-if="!isBatchOperation" class="menu-item danger permanent-delete" @click="permanentlyDeleteTask">
        <Trash2 :size="16" class="menu-icon" />
        <span class="menu-text">Permanently Delete</span>
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
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { isDoneForNowAlreadyCompletedError } from '@/services/tasks/doneForNow'
import { useCanvasStore } from '@/stores/canvas'
import { useProjectStore } from '@/stores/projects'
import { useTimerStore } from '@/stores/timer'
import {
  Calendar,
  CheckCircle,
  Timer,
  FolderOpen,
  ChevronRight,
  Pencil,
  Trash2,
  MoreHorizontal,
  Pin,
  PinOff,
  Lock,
  LockOpen,
  LayoutDashboard,
  Square
} from 'lucide-vue-next'
import { FOCUS_MODE_KEY } from '@/composables/useFocusMode'
import type { FocusModeState } from '@/composables/useFocusMode'
import type { Task } from '@/stores/tasks'
import type { TaskPriority } from '@/types/tasks'

// New Architecture Imports
import { useTaskContextMenuActions } from '@/composables/tasks/useTaskContextMenuActions'
import { useCanvasModalsStore } from '@/stores/canvas/modals'
import { findMatchingGroupForDueDate } from '@/composables/canvas/useSmartGroupMatcher'
import { useQuickTasks } from '@/composables/useQuickTasks'
import { useToast } from '@/composables/useToast'
import { beginPermanentDeleteTrace, logPermanentDeleteTrace } from '@/utils/permanentDeleteTrace'
import { reconcileStaleInstancesForDueDate } from '@/utils/dueDateInstances'
import { buildCalendarDoneForTodayUpdate } from '@/utils/calendar/completeCalendarOccurrence'
import DueDateSubmenu from './context-menu/DueDateSubmenu.vue'
import PrioritySubmenu from './context-menu/PrioritySubmenu.vue'
import DurationSubmenu from './context-menu/DurationSubmenu.vue'
import MoreSubmenu from './context-menu/MoreSubmenu.vue'
import ProjectSubmenu from './context-menu/ProjectSubmenu.vue'
import CanvasGroupSubmenu from './context-menu/CanvasGroupSubmenu.vue'
import DoneForNowSubmenu from './context-menu/DoneForNowSubmenu.vue'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import AITaskAssistPopover from '@/components/ai/AITaskAssistPopover.vue'
import { useMoveToCanvasGroup } from '@/composables/canvas/useMoveToCanvasGroup'
import { useSubmenuSafePolygon } from '@/composables/useSubmenuSafePolygon'

interface Props {
  isVisible: boolean
  x: number
  y: number
  task: Task | null
  compactMode?: boolean
  selectedCount?: number
  selectedIds?: string[]
  // TASK-1785 Push 2: where this menu was opened from. 'calendar' surfaces the
  // "Lock time on calendar" toggle; other surfaces hide it (field is calendar-only).
  context?: 'calendar' | 'board' | 'list' | 'canvas'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  edit: [taskId: string]
  confirmDelete: [taskId: string, instanceId?: string, isCalendarEvent?: boolean]
  confirmPermanentDelete: [taskId: string]
  clearSelection: []
  setPriority: [priority: Exclude<TaskPriority, null>]
  setStatus: [status: 'todo' | 'done']
  setDueDate: [dateType: 'today' | 'tomorrow' | 'weekend' | 'nextweek']
  enterFocusMode: []
  deleteSelected: []
  setDuration: [duration: number | null]
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
  setDuration,
  setProject,
  toggleDone,
  startTaskNow,
  startTimer,
  duplicateTask,
  deleteTask,
  clearSelection
} = useTaskContextMenuActions(props, emit as (event: string, ...args: unknown[]) => void)

const canvasModalsStore = useCanvasModalsStore()

const handleOpenPlanningCanvas = () => {
  if (currentTask.value?.id) {
    canvasModalsStore.openMiniCanvas(currentTask.value.id)
    emit('close')
  }
}

const focusModeState = inject<FocusModeState | null>(FOCUS_MODE_KEY, null)
const enterFocusModeFn = focusModeState?.enterFocusMode || null
const router = useRouter()

// Direct store access for custom date handling
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const projectStore = useProjectStore()
const timerStore = useTimerStore()

const stopTimer = async () => {
  emit('close')
  await timerStore.stopTimer()
}

const runningTimerTask = computed(() => {
  if (!timerStore.isTimerActive || !timerStore.currentTaskId || timerStore.currentTaskId === 'general') return null
  return taskStore.getTask(timerStore.currentTaskId)
})

const isCurrentTaskRunning = computed(() => {
  const taskId = currentTask.value?.id
  return !!taskId && !!runningTimerTask.value && timerStore.currentTaskId === taskId
})

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
const showDoneForNowSubmenu = ref(false)
const submenuTimeouts = ref(new Map<string, ReturnType<typeof setTimeout>>())
const dueDateSubmenuPosition = ref({ x: 0, y: 0 })
const prioritySubmenuPosition = ref({ x: 0, y: 0 })
const durationSubmenuPosition = ref({ x: 0, y: 0 })
const moreSubmenuPosition = ref({ x: 0, y: 0 })
const projectSubmenuPosition = ref({ x: 0, y: 0 })
const canvasGroupSubmenuPosition = ref({ x: 0, y: 0 })
const doneForNowSubmenuPosition = ref({ x: 0, y: 0 })

// TASK-1445: Safe polygon hover intent for submenu navigation
const safePolygon = useSubmenuSafePolygon()

// TASK-1445: Submenu type and delayed switching state
type SubmenuType = 'dueDate' | 'priority' | 'duration' | 'more' | 'project' | 'canvasGroup' | 'doneForNow'
const submenuSwitchTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const pendingSubmenuType = ref<SubmenuType | null>(null)

// Computed properties for display
const showInboxHeader = computed(() => {
  return (props.selectedCount && props.selectedCount > 0) || props.task
})

const displayHeaderText = computed(() => {
  if (props.task) {
    return props.task.title
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

const showCalendarDoneKeepTask = computed(() =>
  !isBatchOperation.value &&
  props.context === 'calendar' &&
  currentTask.value?.status !== 'done'
)

const currentDueDateLabel = computed(() => {
  const dueDate = currentTask.value?.dueDate
  if (!dueDate) return ''
  // BUG-1901: compare the DATE PART as a string — this was the only due-date
  // formatter that parsed via `new Date(dueDate)`, so a dueDate carrying a
  // late-UTC time (e.g. 21:00Z) rendered +1 day in UTC+ timezones while every
  // other surface (dueStatus.ts, normalizeDueDate) string-slices the date.
  const dueDateOnly = dueDate.split('T')[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateOnly)) return ''
  const local = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const now = new Date()
  if (dueDateOnly === local(now)) return 'Today'
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (dueDateOnly === local(tomorrow)) return 'Tomorrow'
  // Format as "Mar 15" style — parse date-only as local midnight
  const [y, m, d] = dueDateOnly.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
    // BUG-1909: stale PAST instances follow an explicit due-date pick, else the
    // badge stays pinned to "Overdue <old date>" and the pick looks like a no-op
    const reconciled = reconcileStaleInstancesForDueDate(taskStore.getTask(taskId), formattedDate)
    await taskStore.updateTaskWithUndo(taskId, {
      dueDate: formattedDate,
      ...(reconciled ? { instances: reconciled } : {})
    })
    // TASK-1362: Also move calendar instance to selected date
    if (isCalendarEvent && calendarInstanceId) {
      await taskStore.updateTaskInstance(taskId, calendarInstanceId, { scheduledDate: formattedDate })
    }
    canvasStore.requestSync('user:context-menu')
    // Auto-route to matching canvas group (Today, Tomorrow, day-of-week groups).
    // TASK-1756 v6: skipDueDateInheritance — we JUST set dueDate above from
    // the user's exact pick (e.g. +1 month). If the matching group is a
    // day-of-week one, moveToGroupWithToast would otherwise overwrite our
    // dueDate with the group's this-week target (e.g. Tuesday→21.4), silently
    // undoing the reschedule.
    const matchingGroup = findMatchingGroupForDueDate(formattedDate, canvasStore._rawGroups)
    if (matchingGroup) {
      await moveToGroupWithToast(taskId, matchingGroup.id, { skipDueDateInheritance: true })
    }
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
    useToast().showToast('Failed to clear due date. Refresh and try again.', 'error')
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
    useToast().showToast('Failed to clear priority. Refresh and try again.', 'error')
  }
  emit('close')
}

// Handle "Done for now" > Tomorrow — reschedule to tomorrow (non-recurring behavior)
const handleDoneForNowTomorrow = async () => {
  // BUG-1184: Capture task data BEFORE closing menu
  const taskId = currentTask.value?.id
  const task = currentTask.value
  const calendarInstanceId = (currentTask.value as unknown as Record<string, unknown>)?.instanceId as string | undefined
  const isCalendarEvent = (currentTask.value as unknown as Record<string, unknown>)?.isCalendarEvent as boolean | undefined

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
    // BUG-1429: Without updating scheduledDate, isTodayTask still matches on the old date
    const updatePayload = isCalendarEvent && calendarInstanceId && task
      ? buildCalendarDoneForTodayUpdate(task, calendarInstanceId, tomorrowStr)
      : {
        dueDate: tomorrowStr,
        doneForNowUntil: tomorrowStr,
        ...(task?.scheduledDate ? { scheduledDate: tomorrowStr } : {})
      }
    await taskStore.updateTaskWithUndo(taskId, updatePayload)
    canvasStore.requestSync('user:context-menu')
    showToast('Moved to tomorrow', 'success', { duration: 2000 })
  } catch (error) {
    console.error('Error in done-for-now (tomorrow):', error)
    showToast('Failed to reschedule task', 'error')
  }
}

// Handle "Done for now" > Next occurrence — for recurring tasks
const handleDoneForNowNextOccurrence = async () => {
  const taskId = currentTask.value?.id

  emit('close')

  if (!taskId) return

  const { showToast } = useToast()

  try {
    // TASK-1532: Recurring tasks use doneForNow — creates completion record + advances to next occurrence
    await taskStore.doneForNow(taskId)
    canvasStore.requestSync('user:context-menu')
    showToast('Completed for today, next occurrence scheduled', 'success', { duration: 2000 })
  } catch (error) {
    console.error('Error in done-for-now (next occurrence):', error)
    if (isDoneForNowAlreadyCompletedError(error)) {
      try {
        await taskStore.initializeFromDatabase()
        canvasStore.requestSync('user:context-menu')
      } catch (refreshError) {
        console.warn('[Tasks] Already-completed occurrence refresh failed:', refreshError)
      }
    } else {
      showToast('Failed to complete task', 'error')
    }
  }
}

const handleCalendarDoneKeepTask = async () => {
  if (currentTask.value?.recurrenceRule) {
    await handleDoneForNowNextOccurrence()
    return
  }

  await handleDoneForNowTomorrow()
}

// Handle "Done for now" > Pick a date — custom date picker
const handleDoneForNowPickDate = async (timestamp: number) => {
  const taskId = currentTask.value?.id
  const task = currentTask.value
  const calendarInstanceId = (currentTask.value as unknown as Record<string, unknown>)?.instanceId as string | undefined
  const isCalendarEvent = (currentTask.value as unknown as Record<string, unknown>)?.isCalendarEvent as boolean | undefined

  closeAllSubmenusNow()
  emit('close')

  if (!taskId) return

  const { showToast } = useToast()

  // Format date as YYYY-MM-DD using local date components
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`

  try {
    if (task?.recurrenceRule) {
      // Recurring: complete and assign the approved next date atomically.
      await taskStore.doneForNow(taskId, { nextDueDate: dateStr })
      canvasStore.requestSync('user:context-menu')
      showToast(`Completed for today, next on ${dateStr}`, 'success', { duration: 2000 })
    } else {
      // Non-recurring: same as tomorrow but with custom date
      const updatePayload: Record<string, string> = {
        dueDate: dateStr,
        doneForNowUntil: dateStr
      }
      if (task?.scheduledDate) {
        updatePayload.scheduledDate = dateStr
      }
      await taskStore.updateTaskWithUndo(taskId, updatePayload)
      if (isCalendarEvent && calendarInstanceId) {
        await taskStore.updateTaskInstance(taskId, calendarInstanceId, { scheduledDate: dateStr })
      }
      canvasStore.requestSync('user:context-menu')
      showToast(`Moved to ${dateStr}`, 'success', { duration: 2000 })
    }
  } catch (error) {
    console.error('Error in done-for-now pick date:', error)
    if (isDoneForNowAlreadyCompletedError(error)) {
      try {
        await taskStore.initializeFromDatabase()
        canvasStore.requestSync('user:context-menu')
      } catch (refreshError) {
        console.warn('[Tasks] Already-completed occurrence refresh failed:', refreshError)
      }
    } else {
      showToast('Failed to reschedule task', 'error')
    }
  }
}

// Handle "Done fully (stop recurring)" - permanently complete a recurring task
const handleDoneFully = async () => {
  const taskId = currentTask.value?.id
  emit('close')
  if (!taskId) return
  const { showToast } = useToast()
  try {
    // Done fully = just mark as done (existing behavior handles recurrence clone + archive)
    await taskStore.updateTaskWithUndo(taskId, { status: 'done' })
    showToast('Task completed permanently', 'success', { duration: 2000 })
  } catch (error) {
    console.error('Error in done-fully:', error)
    showToast('Failed to complete task', 'error')
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

// Toggle pin to top
const togglePin = async () => {
  if (!currentTask.value) return
  try {
    await taskStore.updateTaskWithUndo(currentTask.value.id, { isPinned: !currentTask.value.isPinned })
  } catch (error) {
    console.error('Error toggling task pin:', error)
    useToast().showToast('Failed to update pin. Refresh and try again.', 'error')
  }
  emit('close')
}

// TASK-1785 Push 2: toggle calendar ripple-shift lock (skip-protect)
const toggleCalendarLock = async () => {
  if (!currentTask.value) return
  const nextLocked = !currentTask.value.calendarLocked
  const { showToast } = useToast()
  try {
    await taskStore.updateTaskWithUndo(currentTask.value.id, { calendarLocked: nextLocked })
    showToast(
      nextLocked ? 'Time locked on calendar' : 'Time unlocked on calendar',
      'success',
      { duration: 1800 }
    )
  } catch (error) {
    console.error('Error toggling calendar lock:', error)
    showToast('Failed to update calendar lock. Refresh and try again.', 'error')
  }
  emit('close')
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
// TASK-1445: Close sibling nested submenu (Duration) to prevent overlap
const handleMoreCanvasGroup = (event: MouseEvent) => {
  showDurationSubmenu.value = false
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
// TASK-1445: Close sibling nested submenu (Canvas Group) to prevent overlap
const handleMoreDuration = (event: MouseEvent) => {
  showCanvasGroupSubmenu.value = false
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

// Handle MoreSubmenu nested DoneForNow submenu positioning
const handleMoreDoneForNow = (event: MouseEvent) => {
  showDurationSubmenu.value = false
  showCanvasGroupSubmenu.value = false
  const target = event.currentTarget as HTMLElement
  const triggerRect = target.getBoundingClientRect()
  const submenuWidth = 180
  let x = triggerRect.right + 4
  let y = triggerRect.top
  if (x + submenuWidth > window.innerWidth - 8) {
    x = triggerRect.left - submenuWidth - 4
  }
  if (y + 200 > window.innerHeight - 8) {
    y = window.innerHeight - 200 - 8
  }
  doneForNowSubmenuPosition.value = { x, y }
  showDoneForNowSubmenu.value = true
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
    await taskStore.createTaskWithUndo({
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

const doneForNowSubmenuStyle = computed(() => ({
  left: doneForNowSubmenuPosition.value.x + 'px',
  top: doneForNowSubmenuPosition.value.y + 'px'
}))

// Submenu handlers
const clearAllSubmenuTimeouts = () => {
  for (const t of submenuTimeouts.value.values()) clearTimeout(t)
  submenuTimeouts.value.clear()
}

// TASK-1445: Cancel any pending submenu switch timer
const cancelPendingSwitch = () => {
  if (submenuSwitchTimer.value) {
    clearTimeout(submenuSwitchTimer.value)
    submenuSwitchTimer.value = null
    pendingSubmenuType.value = null
  }
}

// TASK-1445: Check which submenu is currently open
const getCurrentOpenSubmenu = (): SubmenuType | null => {
  if (showDueDateSubmenu.value) return 'dueDate'
  if (showPrioritySubmenu.value) return 'priority'
  if (showProjectSubmenu.value) return 'project'
  if (showMoreSubmenu.value) return 'more'
  if (showDurationSubmenu.value) return 'duration'
  if (showCanvasGroupSubmenu.value) return 'canvasGroup'
  if (showDoneForNowSubmenu.value) return 'doneForNow'
  return null
}

const isSubmenuOpen = (type: SubmenuType): boolean => {
  switch (type) {
    case 'dueDate': return showDueDateSubmenu.value
    case 'priority': return showPrioritySubmenu.value
    case 'duration': return showDurationSubmenu.value
    case 'more': return showMoreSubmenu.value
    case 'project': return showProjectSubmenu.value
    case 'canvasGroup': return showCanvasGroupSubmenu.value
    case 'doneForNow': return showDoneForNowSubmenu.value
  }
}

// TASK-1445: Perform the actual submenu open (positioning + visibility).
// Extracted so openSubmenu() can delay the call when switching between submenus.
const performSubmenuOpen = (type: SubmenuType, triggerRect: DOMRect) => {
  clearAllSubmenuTimeouts()
  safePolygon.stopTracking()

  // BUG-1095: Close ALL other submenus before opening a new one
  showDueDateSubmenu.value = false
  showPrioritySubmenu.value = false
  showDurationSubmenu.value = false
  showMoreSubmenu.value = false
  showProjectSubmenu.value = false
  showCanvasGroupSubmenu.value = false
  showDoneForNowSubmenu.value = false

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
  } else if (type === 'doneForNow') {
    doneForNowSubmenuPosition.value = { x, y }
    showDoneForNowSubmenu.value = true
  } else {
    moreSubmenuPosition.value = { x, y }
    showMoreSubmenu.value = true
  }
}

// TASK-1445: Open a submenu. When switching between submenus, delay 80ms
// so the cursor can pass through adjacent triggers (diagonal movement)
// without immediately closing the current submenu.
const openSubmenu = (type: SubmenuType, event: MouseEvent) => {
  const currentlyOpen = getCurrentOpenSubmenu()
  // Already showing the same submenu — nothing to do
  if (currentlyOpen === type) return

  cancelPendingSwitch()

  // Capture trigger rect now (event.currentTarget becomes null after handler)
  const triggerRect = (event.currentTarget as HTMLElement).getBoundingClientRect()

  if (currentlyOpen) {
    // Another submenu is already open — delay the switch so diagonal cursor
    // movement toward the current submenu isn't interrupted.
    pendingSubmenuType.value = type
    submenuSwitchTimer.value = setTimeout(() => {
      submenuSwitchTimer.value = null
      pendingSubmenuType.value = null
      performSubmenuOpen(type, triggerRect)
    }, 80)
    return
  }

  // No submenu open yet — open immediately
  performSubmenuOpen(type, triggerRect)
}

// TASK-1445: Get the known rect of a submenu by type (position + estimated size)
const getSubmenuRect = (type: SubmenuType) => {
  const posMap: Record<SubmenuType, { value: { x: number; y: number } }> = {
    dueDate: dueDateSubmenuPosition,
    priority: prioritySubmenuPosition,
    duration: durationSubmenuPosition,
    more: moreSubmenuPosition,
    project: projectSubmenuPosition,
    canvasGroup: canvasGroupSubmenuPosition,
    doneForNow: doneForNowSubmenuPosition,
  }
  const sizeMap: Record<SubmenuType, { width: number; height: number }> = {
    dueDate: { width: 180, height: 300 },
    priority: { width: 150, height: 160 },
    duration: { width: 150, height: 180 },
    more: { width: 180, height: 360 },
    project: { width: 200, height: 250 },
    canvasGroup: { width: 200, height: 250 },
    doneForNow: { width: 180, height: 200 },
  }
  const pos = posMap[type].value
  const size = sizeMap[type]
  return { x: pos.x, y: pos.y, width: size.width, height: size.height }
}

// Actually close a submenu (called by safe polygon or panel leave).
// TASK-1445: Nested submenus (canvasGroup, duration) close ONLY themselves.
// The parent MoreSubmenu closes only via its own handlePanelLeave or closeAllSubmenusNow.
const actuallyCloseSubmenu = (type: SubmenuType) => {
  if (type === 'dueDate') showDueDateSubmenu.value = false
  else if (type === 'priority') showPrioritySubmenu.value = false
  else if (type === 'duration') showDurationSubmenu.value = false
  else if (type === 'project') showProjectSubmenu.value = false
  else if (type === 'canvasGroup') showCanvasGroupSubmenu.value = false
  else if (type === 'doneForNow') showDoneForNowSubmenu.value = false
  else if (type === 'more') {
    // Only close 'more' if no nested child submenu is still open
    if (!showCanvasGroupSubmenu.value && !showDurationSubmenu.value && !showDoneForNowSubmenu.value) {
      showMoreSubmenu.value = false
    }
  }
}

// TASK-1445: When cursor leaves a TRIGGER item, use safe polygon tracking
// instead of a blind timeout. Only track if that submenu is actually open.
const handleTriggerLeave = (type: SubmenuType, event: MouseEvent) => {
  // Cancel pending switch if cursor left the target trigger before delay elapsed
  if (pendingSubmenuType.value === type) {
    cancelPendingSwitch()
  }

  // Only start polygon tracking if this type's submenu is actually visible
  if (!isSubmenuOpen(type)) return

  clearAllSubmenuTimeouts()
  const rect = getSubmenuRect(type)
  safePolygon.startTracking(event, rect, () => {
    actuallyCloseSubmenu(type)
  })
}

// When cursor enters a submenu PANEL, stop polygon tracking — cursor landed
const handlePanelEnter = () => {
  cancelPendingSwitch()
  clearAllSubmenuTimeouts()
  safePolygon.stopTracking()
}

// When cursor leaves a submenu PANEL, use a short delay
const handlePanelLeave = (type: SubmenuType) => {
  const existing = submenuTimeouts.value.get(type)
  if (existing) clearTimeout(existing)

  const timeout = setTimeout(() => {
    submenuTimeouts.value.delete(type)
    actuallyCloseSubmenu(type)
  }, 150)
  submenuTimeouts.value.set(type, timeout)
}

// Legacy closeSubmenu kept for nested submenu triggers in MoreSubmenu
const closeSubmenu = (type: SubmenuType) => {
  const existing = submenuTimeouts.value.get(type)
  if (existing) clearTimeout(existing)

  const timeout = setTimeout(() => {
    submenuTimeouts.value.delete(type)
    actuallyCloseSubmenu(type)
  }, 300)
  submenuTimeouts.value.set(type, timeout)
}

// BUG-1095: Immediately close ALL submenus - no timeout
const closeAllSubmenusNow = () => {
  cancelPendingSwitch()
  clearAllSubmenuTimeouts()
  safePolygon.stopTracking()
  showDueDateSubmenu.value = false
  showPrioritySubmenu.value = false
  showDurationSubmenu.value = false
  showMoreSubmenu.value = false
  showProjectSubmenu.value = false
  showCanvasGroupSubmenu.value = false
  showDoneForNowSubmenu.value = false
}

const enterFocus = () => {
  // BUG-1095: Close submenus first
  closeAllSubmenusNow()
  emit('close')

  if (currentTask.value && !isBatchOperation.value) {
    if (enterFocusModeFn) {
      enterFocusModeFn(currentTask.value.id)
    } else {
      router.push(`/focus/${currentTask.value.id}`)
    }
  } else if (isBatchOperation.value) {
    emit('enterFocusMode')
  }
}

const permanentlyDeleteTask = () => {
  if (!isBatchOperation.value && currentTask.value) {
    beginPermanentDeleteTrace(currentTask.value.id, 'TaskContextMenu.permanentlyDeleteTask', {
      context: props.context,
      title: currentTask.value.title,
    })
    logPermanentDeleteTrace(currentTask.value.id, 'context-menu.emit-confirm-permanent-delete')
    emit('confirmPermanentDelete', currentTask.value.id)
  }
  emit('close')
}

// Escape key handler
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeAllSubmenusNow()
    emit('close')
  }
}

const isOwnedMenuTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  if (menuRef.value?.contains(target)) return true

  // Submenus and library popovers are teleported to body, so they must count as
  // part of this interaction surface for outside-dismiss purposes.
  return !!target.closest('.submenu, .n-date-picker, .n-date-panel, .n-popover, .ai-assist-popover')
}

const closeFromOutside = (target: EventTarget | null) => {
  if (isOwnedMenuTarget(target)) return
  closeAllSubmenusNow()
  emit('close')
}

const handleOutsidePointerDown = (event: PointerEvent) => {
  closeFromOutside(event.target)
}

const handleOutsideContextMenu = (event: MouseEvent) => {
  closeFromOutside(event.target)
}

let outsideDismissListenerTimer: ReturnType<typeof setTimeout> | null = null

const addOutsideDismissListeners = () => {
  document.addEventListener('pointerdown', handleOutsidePointerDown, true)
  document.addEventListener('contextmenu', handleOutsideContextMenu, true)
}

const removeOutsideDismissListeners = () => {
  if (outsideDismissListenerTimer) {
    clearTimeout(outsideDismissListenerTimer)
    outsideDismissListenerTimer = null
  }
  document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
  document.removeEventListener('contextmenu', handleOutsideContextMenu, true)
}

watch(
  () => props.isVisible,
  (isVisible) => {
    if (isVisible) {
      removeOutsideDismissListeners()
      outsideDismissListenerTimer = setTimeout(() => {
        outsideDismissListenerTimer = null
        addOutsideDismissListeners()
      }, 0)
      document.addEventListener('keydown', handleKeyDown)
    } else {
      removeOutsideDismissListeners()
      document.removeEventListener('keydown', handleKeyDown)
      showDueDateSubmenu.value = false
      showPrioritySubmenu.value = false
      showDurationSubmenu.value = false
      showMoreSubmenu.value = false
      showProjectSubmenu.value = false
      showCanvasGroupSubmenu.value = false
      showDoneForNowSubmenu.value = false
      showAIAssist.value = false
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  removeOutsideDismissListeners()
  document.removeEventListener('keydown', handleKeyDown)
  cancelPendingSwitch()
  clearAllSubmenuTimeouts()
  safePolygon.stopTracking()
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
  z-index: var(--z-context-menu, 9999);
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
  overflow: hidden;
}

.running-task-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 var(--space-2) var(--space-1);
  padding: var(--space-2) var(--space-2_5);
  border: 1px solid var(--amber-border, rgba(245, 158, 11, 0.45));
  border-radius: var(--radius-md);
  background: var(--amber-bg-soft, rgba(245, 158, 11, 0.12));
  color: var(--amber-text);
}

.running-task-indicator__icon {
  flex-shrink: 0;
  animation: running-task-pulse 1.6s ease-in-out infinite;
}

.running-task-indicator__copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.running-task-indicator__label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  line-height: 1.2;
}

.running-task-indicator__title {
  display: block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: var(--text-xs);
  line-height: 1.3;
}

.running-task-indicator__time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

@keyframes running-task-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
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
  max-width: 100px;
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

/* TASK-1485: Mark Done line is teal */
.menu-item--done { color: var(--brand-primary); }
.menu-item--done:hover { background: var(--brand-bg-subtle); }
.menu-item--done .menu-icon { color: var(--brand-primary); opacity: 1; }

/* Start Timer line is amber */
.menu-item--timer { color: var(--amber-text); }
.menu-item--timer:hover { background: var(--amber-bg-soft); }
.menu-item--timer .menu-icon { color: var(--amber-text); opacity: 1; }

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

/* Permanent delete - slightly more dangerous appearance */
.menu-item.permanent-delete {
  opacity: 0.7;
}
.menu-item.permanent-delete:hover {
  opacity: 1;
}
</style>
