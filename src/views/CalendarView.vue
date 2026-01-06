<template>
  <div class="calendar-layout">
    <!-- Status Overlays -->
    <CalendarStatusOverlays
      :system-healthy="systemHealthy"
      :system-health-message="systemHealthMessage"
      :operation-error="operationError"
      :operation-loading="operationLoading"
      @validate-stores="handleValidateStores"
      @retry-failed-operation="handleRetryFailedOperation"
      @clear-operation-error="handleClearOperationError"
      @reload-page="handleReloadPage"
    />

    <!-- Unified Inbox Panel -->
    <!-- key forces Vue to recreate component when switching views -->
    <Transition name="sidebar-slide">
      <UnifiedInboxPanel v-show="uiStore.secondarySidebarVisible" context="calendar" key="calendar-inbox" />
    </Transition>

    <!-- Task Edit Modal -->
    <TaskEditModal
      :is-open="isEditModalOpen"
      :task="selectedTask"
      @close="closeEditModal"
    />

    <!-- Quick Task Create Modal -->
    <QuickTaskCreate
      v-if="dragCreate.quickCreateData.startTime"
      :is-open="dragCreate.showQuickCreateModal.value"
      :start-time="dragCreate.quickCreateData.startTime || new Date()"
      :end-time="dragCreate.quickCreateData.endTime || new Date()"
      :duration="dragCreate.quickCreateData.duration"
      @close="dragCreate.showQuickCreateModal.value = false"
      @created="handleTaskCreated"
    />


    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :is-open="showConfirmModal"
      title="Delete Task"
      message="Are you sure you want to delete this task? You can press Ctrl+Z to undo."
      confirm-text="Delete"
      @confirm="confirmDeleteTask"
      @cancel="cancelDeleteTask"
    />

    <!-- Calendar Main Area -->
    <div class="calendar-main">
      <!-- Calendar Header -->
      <CalendarHeader
        :format-current-date="formatCurrentDate"
        :hide-calendar-done-tasks="hideCalendarDoneTasks"
        :view-mode="viewMode"
        @previous-day="previousDay"
        @next-day="nextDay"
        @go-to-today="goToToday"
        @toggle-done-tasks="taskStore.toggleCalendarDoneTasks()"
        @update:view-mode="viewMode = $event"
      />

      <!-- Calendar Grid - Day View -->
      <CalendarDayView
        v-if="viewMode === 'day'"
        :time-slots="timeSlots"
        :hours="hours"
        :is-viewing-today="isViewingToday"
        :time-indicator-position="timeIndicatorPosition"
        :drag-ghost="dragGhost"
        :active-drop-slot="activeDropSlot"
        :current-task-id="timerStore.currentTaskId"
        :is-dragging="isDragging"
        :dragged-event-id="draggedEventId"
        :hovered-event-id="hoveredEventId"
        :resize-preview="resizePreview"
        :format-hour="formatHour"
        :is-current-time-slot="isCurrentTimeSlot"
        :format-slot-time="formatSlotTime"
        :get-tasks-for-slot="getTasksForSlot"
        :is-task-primary-slot="isTaskPrimarySlot"
        :get-slot-task-style="getSlotTaskStyle"
        :get-project-visual="getProjectVisual"
        :get-project-name="getProjectName"
        :get-project-color="getProjectColor"
        :get-priority-class="getPriorityClass"
        :get-priority-label="getPriorityLabel"
        :get-task-status="getTaskStatus"
        :get-status-label="getStatusLabel"
        :get-status-icon="getStatusIcon"
        @dragover="onDragOver"
        @dragenter="onDragEnter"
        @dragleave="onDragLeave"
        @drop="onDropSlot"
        @slot-mouse-down="dragCreate.handleSlotMouseDown"
        @event-mouse-enter="handleSlotTaskMouseEnter"
        @event-mouse-leave="handleSlotTaskMouseLeave"
        @event-drag-start="handleEventDragStart"
        @event-drag-end="handleEventDragEnd"
        @event-click="handleEventClick"
        @event-dbl-click="handleEventDblClick"
        @event-context-menu="handleEventContextMenu"
        @cycle-status="cycleTaskStatus"
        @remove-from-calendar="handleRemoveFromCalendar"
        @start-resize="startResize"
      />

      <!-- Week View -->
      <CalendarWeekView
        v-else-if="viewMode === 'week'"
        :week-days="weekDays"
        :working-hours="workingHours"
        :week-events="weekEvents"
        :current-task-id="timerStore.currentTaskId"
        :format-hour="formatHour"
        :get-week-event-style="getWeekEventStyle"
        :is-current-week-time-cell="isCurrentWeekTimeCell"
        :get-project-visual="getProjectVisual"
        :get-project-name="getProjectName"
        :get-project-color="getProjectColor"
        :get-priority-class="getPriorityClass"
        :get-priority-label="getPriorityLabel"
        :get-task-status="getTaskStatus"
        :get-status-label="getStatusLabel"
        :get-status-icon="getStatusIcon"
        @week-drag-over="handleWeekDragOver"
        @week-drop="handleWeekDrop"
        @event-drag-start="handleEventDragStart"
        @event-drag-end="handleEventDragEnd"
        @event-click="handleEventClick"
        @event-dbl-click="handleEventDblClick"
        @event-context-menu="handleEventContextMenu"
        @cycle-status="cycleTaskStatus"
        @remove-from-calendar="handleRemoveFromCalendar"
        @start-resize="startWeekResize"
      />

      <!-- Month View -->
      <CalendarMonthView
        v-else-if="viewMode === 'month'"
        :month-days="monthDays"
        :current-task-id="timerStore.currentTaskId"
        :get-project-visual="getProjectVisual"
        :get-project-name="getProjectName"
        :get-project-color="getProjectColor"
        :get-priority-class="getPriorityClass"
        :get-priority-label="getPriorityLabel"
        :get-task-status="getTaskStatus"
        :get-status-label="getStatusLabel"
        :get-status-icon="getStatusIcon"
        :format-event-time="formatEventTime"
        @month-drop="handleMonthDrop"
        @month-day-click="handleMonthDayClick"
        @event-drag-start="handleMonthDragStart"
        @event-drag-end="handleMonthDragEnd"
        @event-dbl-click="handleEventDblClick"
        @event-context-menu="handleEventContextMenu"
        @cycle-status="cycleTaskStatus"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUIStore } from '@/stores/ui'
import { useCalendarDragCreate } from '@/composables/useCalendarDragCreate'
import { useCalendarCore } from '@/composables/useCalendarCore'
import { useCalendarDayView } from '@/composables/calendar/useCalendarDayView'
import { useCalendarWeekView } from '@/composables/calendar/useCalendarWeekView'
import { useCalendarMonthView } from '@/composables/calendar/useCalendarMonthView'
import { useCalendarInteractionHandlers } from '@/composables/calendar/useCalendarInteractionHandlers'
import { useCalendarModals } from '@/composables/calendar/useCalendarModals'
import { useCalendarNavigation } from '@/composables/calendar/useCalendarNavigation'
import { useCalendarScroll } from '@/composables/calendar/useCalendarScroll'
import UnifiedInboxPanel from '@/components/inbox/UnifiedInboxPanel.vue'
import CalendarStatusOverlays, { type OperationError, type OperationLoading } from '@/components/calendar/CalendarStatusOverlays.vue'
import CalendarHeader from '@/components/calendar/CalendarHeader.vue'
import CalendarDayView from '@/components/calendar/CalendarDayView.vue'
import CalendarWeekView from '@/components/calendar/CalendarWeekView.vue'
import CalendarMonthView from '@/components/calendar/CalendarMonthView.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import QuickTaskCreate from '@/components/tasks/QuickTaskCreate.vue'
import ProjectFilterDropdown from '@/components/projects/ProjectFilterDropdown.vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import { ChevronLeft, ChevronRight, Calendar, Eye, EyeOff, ListTodo as _ListTodo, Play as _Play, Check as _Check, Video as _Video, VideoOff as _VideoOff, Download as _Download } from 'lucide-vue-next'
import { dragRecorder as _dragRecorder, type InteractionAnalysis } from '@/utils/DragInteractionRecorder'
import type { CalendarEvent } from '@/types/tasks'
import type { TimeSlot } from '@/composables/calendar/useCalendarDayView'

interface SortableEvent {
  item: HTMLElement
  newIndex: number
  [key: string]: unknown
}

const taskStore = useTaskStore()
const timerStore = useTimerStore()
const uiStore = useUIStore()

// System Health & Status Overlays
const operationLoading = ref<OperationLoading>({ loading: false, syncing: false })
const operationError = ref<OperationError | null>(null)
// Basic system health check - ensure stores are initialized
const systemHealthy = computed(() => !!taskStore && !!timerStore && !!uiStore)
const systemHealthMessage = computed(() => !systemHealthy.value ? 'Critical stores failed to initialize' : '')

const handleValidateStores = () => {
  console.log('Validating stores...', {
    taskStore: !!taskStore,
    timerStore: !!timerStore,
    uiStore: !!uiStore
  })
}

const handleRetryFailedOperation = () => {
  if (operationError.value?.retryable) {
    operationError.value = null
    // Simple retry strategy: reload page for system-level errors
    window.location.reload()
  }
}

const handleClearOperationError = () => {
  operationError.value = null
}

const handleReloadPage = () => {
  window.location.reload()
}

// Extract reactive refs from store
// TASK-076: Use calendar-specific done filter
const { hideCalendarDoneTasks } = storeToRefs(taskStore)

// Navigation (Extracted)
const {
  currentDate,
  viewMode,
  isViewingToday,
  formatCurrentDate,
  previousDay,
  nextDay,
  goToToday
} = useCalendarNavigation()

// Modals (Extracted)
const {
  isEditModalOpen,
  selectedTask,
  showConfirmModal,
  taskToDelete,
  handleEditTask,
  closeEditModal,
  handleConfirmDelete,
  confirmDeleteTask,
  cancelDeleteTask
} = useCalendarModals()

// View state
// Use global status filter directly from store (maintains reactivity)
const statusFilter = computed(() => taskStore.activeStatusFilter)
const timeGridRef = ref<HTMLElement | null>(null)

// Recording state
const _isRecording = ref(false)
const _recordingStatus = ref({ duration: 0, eventsCaptured: 0 })
const _lastAnalysis = ref<InteractionAnalysis | null>(null)
const _showRecordingPanel = ref(false)

// Status filter change handler using global TaskStore
const _handleStatusFilterChange = (_event: MouseEvent, newFilter: 'planned' | 'in_progress' | 'done' | null) => {
  taskStore.setActiveStatusFilter(newFilter)
}

// Composables - Refactored logic into focused modules
const dragCreate = useCalendarDragCreate()
const eventHelpers = useCalendarCore()
const calendarScroll = useCalendarScroll()
const dayView = useCalendarDayView(currentDate, statusFilter)
const weekView = useCalendarWeekView(currentDate, statusFilter)
const monthView = useCalendarMonthView(currentDate, statusFilter)

// Reactive current time for time indicator
const currentTime = ref(new Date())
let timeUpdateInterval: NodeJS.Timeout | null = null

// Hover state tracking (Moved to useCalendarInteractionHandlers)

// Destructure commonly used items from composables
const { hours, timeSlots, calendarEvents: _calendarEvents, dragGhost, dragMode: _dragMode, getEventStyle: _getEventStyle, getGhostStyle: _getGhostStyle,
        isDragging, draggedEventId, activeDropSlot, handleDragEnter, handleDragOver, handleDragLeave, handleDrop, handleEventDragStart, handleEventDragEnd,
        handleEventMouseDown: _handleEventMouseDown, startResize, resizePreview, getTasksForSlot, isTaskPrimarySlot, getSlotTaskStyle } = dayView

const { workingHours, weekDays, weekEvents, getWeekEventStyle, handleWeekEventMouseDown: _handleWeekEventMouseDown,
        handleWeekDragOver, handleWeekDrop, startWeekResize, isCurrentWeekTimeCell } = weekView

const { monthDays, handleMonthDragStart, handleMonthDrop, handleMonthDragEnd, handleMonthDayClick: monthDayClickHandler } = monthView

const { formatHour, formatEventTime, getPriorityClass, getPriorityLabel,
        getTaskStatus, getStatusLabel, getStatusIcon, cycleTaskStatus,
        getProjectColor, getProjectEmoji: _getProjectEmoji, getProjectName, getProjectVisual,
        formatSlotTime, isCurrentTimeSlot: checkCurrentTimeSlot, getWeekStart } = eventHelpers

// Destructure scroll composable
const { setupScrollSync, cleanupScrollSync, scrollToCurrentTime } = calendarScroll

// Wrapper for isCurrentTimeSlot that passes current time
const isCurrentTimeSlot = (slot: TimeSlot) => checkCurrentTimeSlot(slot, currentTime.value)

// Interaction Handlers (Extracted)
const {
  selectedCalendarEvents,
  hoveredEventId,
  handleSlotTaskMouseEnter,
  handleSlotTaskMouseLeave,
  handleEventDblClick,
  handleEventContextMenu,
  handleRemoveFromCalendar,
  handleEventClick,
  handleKeyDown,
  handleMonthDayClick
} = useCalendarInteractionHandlers(
  isDragging,
  viewMode,
  handleEditTask,
  handleConfirmDelete,
  monthDayClickHandler
)

// Time indicator position

const timeIndicatorPosition = computed(() => {
  // Calculate position in pixels from top of slots container
  // Each 30-minute slot is 30px, so 1 minute = 1px
  const hours = currentTime.value.getHours()
  const minutes = currentTime.value.getMinutes()
  return (hours * 60) + minutes
})

// Positioning and sizing for slot tasks are handled by getSlotTaskStyle from useCalendarDayView

// vuedraggable integration for calendar time grid drop zone
// This provides an alternative to native HTML5 drag-drop for better mobile support
const timeGridDropList = ref<unknown[]>([])

const _handleVueDraggableAdd = (evt: SortableEvent) => {
  // When a task is dropped via vuedraggable, schedule it to the drop time
  const droppedElement = evt.item
  const taskId = droppedElement?.dataset?.taskId

  if (!taskId) {
    console.warn('[Calendar] vuedraggable drop: no taskId found on dropped element')
    return
  }

  // Find the target time slot from drop position
  const dropIndex = evt.newIndex
  const slot = timeSlots.value[dropIndex]

  if (slot) {
    const targetDate = new Date(currentDate.value)
    targetDate.setHours(slot.hour, slot.minute, 0, 0)

    console.log(`📅 [Calendar] vuedraggable: Scheduling task ${taskId} to ${targetDate.toISOString()}`)
    taskStore.updateTaskWithUndo(taskId, { scheduledDate: targetDate.toISOString() })
  }

  // Clear the drop list since we don't actually display items in it
  timeGridDropList.value = []
}

const _handleVueDraggableChange = (evt: unknown) => {
  // Optional: handle change events for debugging
  console.log('[Calendar] vuedraggable change:', evt)
}

// Native HTML5 Drag-Drop handlers for inbox → calendar (per PomoFlow Development Prompt)
// CRITICAL: @dragover.prevent is required or @drop never fires
// These wrap the composable handlers with proper event handling
const onDragOver = (e: DragEvent, slot: TimeSlot) => {
  // CRITICAL: preventDefault() already called by @dragover.prevent modifier
  // BUT we must set dropEffect to validate this as a drop target
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  console.log('🔄 [CalendarDrag] onDragOver - drop target validated for slot:', slot.slotIndex)

  // Call the existing handler from composable
  handleDragOver(e, slot)
}

const onDragEnter = (e: DragEvent, slot: TimeSlot) => {
  // CRITICAL: preventDefault() already called by @dragenter.prevent modifier
  // Set dropEffect to validate this as a drop target
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  console.log('📍 [CalendarDrag] onDragEnter - slot entered:', slot.slotIndex)

  // Track active drop slot for visual feedback (handled by composable)
  handleDragEnter(e, slot)
}

const onDragLeave = () => {
  handleDragLeave()
}

const onDropSlot = (e: DragEvent, slot: TimeSlot) => {
  // CRITICAL: preventDefault() already called by @drop.prevent modifier
  // BUT be explicit for clarity and add stopPropagation
  e.preventDefault()
  e.stopPropagation()

  console.log('🎯 [CalendarDrag] onDropSlot called for slot:', slot.slotIndex)

  // Use existing handleDrop from composable
  handleDrop(e, slot)
}

// ✅ CAPTURE PHASE HANDLERS
const handleDragEnterCapture = (e: DragEvent) => {
  const slot = (e.target as HTMLElement).closest('.time-slot')
  if (!slot) return
  e.stopImmediatePropagation()
  const idx = parseInt(slot.getAttribute('data-slot-index') || '-1')
  if (idx === -1) return
  const slotObj = timeSlots.value[idx]
  if (slotObj) handleDragEnter(e, slotObj)
}

const handleDragOverCapture = (e: DragEvent) => {
  const slot = (e.target as HTMLElement).closest('.time-slot')
  if (!slot) return
  e.preventDefault()
  e.stopImmediatePropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const idx = parseInt(slot.getAttribute('data-slot-index') || '-1')
  if (idx === -1) return
  const slotObj = timeSlots.value[idx]
  if (slotObj) {
    activeDropSlot.value = idx
    handleDragOver(e, slotObj)
  }
}

const handleDragLeaveCapture = (e: DragEvent) => {
  const slot = (e.target as HTMLElement).closest('.time-slot')
  if (!slot) return
  e.stopImmediatePropagation()
  const idx = parseInt(slot.getAttribute('data-slot-index') || '-1')
  if (idx === -1) return
  activeDropSlot.value = null
  const slotObj = timeSlots.value[idx]
  if (slotObj) handleDragLeave()
}

const handleDropCapture = (e: DragEvent) => {
  const slot = (e.target as HTMLElement).closest('.time-slot')
  if (!slot) return
  e.preventDefault()
  e.stopImmediatePropagation()
  const idx = parseInt(slot.getAttribute('data-slot-index') || '-1')
  if (idx === -1) return
  activeDropSlot.value = null
  const slotObj = timeSlots.value[idx]
  if (slotObj) handleDrop(e, slotObj)
}

// Listen for start-task-now events
const handleStartTaskNow = () => {
  // Ensure we're in day view
  if (viewMode.value !== 'day') {
    viewMode.value = 'day'
  }

  // Navigate to today if not already there
  const today = new Date()
  if (currentDate.value.toDateString() !== today.toDateString()) {
    currentDate.value = today
  }

  // Scroll to current time after a short delay to ensure DOM is updated
  setTimeout(() => {
    scrollToCurrentTime()
  }, 100)
}

onMounted(() => {
  setupScrollSync()

  // Update current time every 30 seconds for smoother time indicator movement
  currentTime.value = new Date()
  timeUpdateInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 30000) // Update every 30 seconds

  // Scroll to current time on mount
  scrollToCurrentTime()

  // Add event listeners
  window.addEventListener('start-task-now', handleStartTaskNow)
  window.addEventListener('keydown', handleKeyDown)

  // ✅ ADD CAPTURE PHASE DRAG EVENT LISTENERS
  const calendarEl = document.querySelector('.calendar-main')
  if (calendarEl) {
    // Third parameter = true enables CAPTURE PHASE
    calendarEl.addEventListener('dragenter', (e: Event) => handleDragEnterCapture(e as DragEvent), true)
    calendarEl.addEventListener('dragover', (e: Event) => handleDragOverCapture(e as DragEvent), true)
    calendarEl.addEventListener('dragleave', (e: Event) => handleDragLeaveCapture(e as DragEvent), true)
    calendarEl.addEventListener('drop', (e: Event) => handleDropCapture(e as DragEvent), true)
    console.log('✅ [CalendarDrag] Capture phase listeners attached to .calendar-main')
  } else {
    console.error('❌ [CalendarDrag] .calendar-main element not found for capture listeners')
  }
})

onUnmounted(() => {
  cleanupScrollSync()

  // Clean up time update interval
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval)
    timeUpdateInterval = null
  }

  // Remove event listeners
  window.removeEventListener('start-task-now', handleStartTaskNow)
  window.removeEventListener('keydown', handleKeyDown)

  // ✅ CLEANUP CAPTURE PHASE DRAG EVENT LISTENERS
  const calendarEl = document.querySelector('.calendar-main')
  if (calendarEl) {
    // Note: Can't remove arrow functions added with addEventListener
    // This is expected - the capture phase listeners will persist until page unload
    console.log('✅ [CalendarDrag] Capture phase listeners cleanup skipped (arrow functions persist)')
  }
})

// Watchers for auto-scrolling to current time
watch(viewMode, (newMode) => {
  if (newMode === 'day') {
    // Scroll to current time when switching to day view
    setTimeout(() => scrollToCurrentTime(), 100)
  }
})

watch(currentDate, (newDate, _oldDate) => {
  if (viewMode.value === 'day') {
    // Check if it's today's date
    const today = new Date()
    const isToday = newDate.toDateString() === today.toDateString()

    if (isToday) {
      // Scroll to current time when navigating to today
      setTimeout(() => scrollToCurrentTime(), 100)
    }
  }
}, { immediate: false })

// DATE FORMATTED (Moved to useCalendarNavigation)

// NAVIGATION HANDLERS (Moved to useCalendarNavigation)

const _handleAddTask = () => {
  // Open QuickTaskCreate modal instead of creating a hardcoded task
  const now = new Date()
  const dateStr = currentDate.value.toISOString().split('T')[0]
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:00`

  // Store task data for the modal
  dragCreate.quickCreateData.startTime = new Date(`${dateStr}T${timeStr}`)
  dragCreate.quickCreateData.duration = 60
  dragCreate.showQuickCreateModal.value = true
}

const _handleStartTimer = (taskId: string) => {
  timerStore.startTimer(taskId)
}

// MODAL HANDLERS (Moved to useCalendarModals)

// CONTEXT MENU HANDLERS (Moved to useCalendarInteractionHandlers)

// DELETE HANDLERS (Moved to useCalendarModals)

// TASK CREATED HANDLER
const handleTaskCreated = (task: Task) => {
  console.log('Task created:', task)
  dragCreate.showQuickCreateModal.value = false
  dragCreate.resetCreateDrag()
}

// Event interaction handlers
// EVENT HANDLERS (Moved to useCalendarInteractionHandlers)

// Toggle hide done tasks (TASK-076: calendar-specific)
const _handleToggleDoneTasks = (_event: MouseEvent) => {
  taskStore.toggleCalendarDoneTasks()
}
</script>

<style scoped>
.calendar-layout {
  display: flex;
  flex: 1;
  background: var(--app-background-gradient);
  overflow: visible;
  min-height: 0;
  position: relative;
  z-index: 1;
}

.calendar-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  position: relative;
  z-index: 1;
}

/* Transitions */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: all var(--duration-normal) var(--spring-smooth);
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Custom scrollbar for calendar-main */
.calendar-main::-webkit-scrollbar {
  width: 6px;
}

.calendar-main::-webkit-scrollbar-track {
  background: transparent;
}

.calendar-main::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
}

.calendar-main {
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}
</style>
