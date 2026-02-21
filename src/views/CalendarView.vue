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
      <UnifiedInboxPanel
        v-show="uiStore.secondarySidebarVisible"
        key="calendar-inbox"
        context="calendar"
        @calendar-drop-to-inbox="handleCalendarDropToInbox"
      />
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
    <div class="calendar-main scroll-container">
      <!-- Calendar Header -->
      <CalendarHeader
        :format-current-date="formatCurrentDate"
        :hide-calendar-done-tasks="hideCalendarDoneTasks"
        :view-mode="viewMode"
        :external-calendar-enabled="externalCalendar.hasEnabledCalendars.value || googleCalendar.isConnected.value"
        :external-calendar-loading="externalCalendar.isLoading.value || googleCalendar.isLoading.value"
        @previous-day="previousDay"
        @next-day="nextDay"
        @go-to-today="goToToday"
        @toggle-done-tasks="taskStore.toggleCalendarDoneTasks()"
        @update:view-mode="viewMode = $event"
        @sync-external-calendar="externalCalendar.syncNow"
        :google-calendar-connected="googleCalendar.isConnected.value"
        :show-google-events="googleCalendar.showGoogleEvents.value"
        @toggle-google-events="googleCalendar.showGoogleEvents.value = !googleCalendar.showGoogleEvents.value"
        @sync-google-calendar="googleCalendar.syncNow"
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
        :selected-event-ids="selectedEventIds"
        :resize-preview="resizePreview"
        :external-events="getMergedEventsForDate(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`)"
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
        @start-timer="startTimerOnCalendarEvent"
        @start-resize="startResize"
      />

      <!-- Week View -->
      <!-- Week View — uses same handlers as day view -->
      <CalendarWeekView
        v-else-if="viewMode === 'week'"
        :week-days="weekDays"
        :working-hours="workingHours"
        :week-events="weekEvents"
        :current-task-id="timerStore.currentTaskId"
        :drag-ghost="dragGhost"
        :is-dragging="isDragging"
        :dragged-event-id="draggedEventId"
        :selected-event-ids="selectedEventIds"
        :resize-preview="weekResizePreview"
        :external-events="mergedExternalEvents"
        @dragover="onDragOver"
        @dragenter="onDragEnter"
        @dragleave="onDragLeave"
        @drop="onDropSlot"
        @event-drag-start="handleEventDragStart"
        @event-drag-end="handleEventDragEnd"
        @event-click="handleEventClick"
        @event-dbl-click="handleEventDblClick"
        @event-context-menu="handleEventContextMenu"
        @cycle-status="cycleTaskStatus"
        @remove-from-calendar="handleRemoveFromCalendar"
        @start-timer="startTimerOnCalendarEvent"
        @start-resize="startWeekResize"
        @cell-dbl-click="handleWeekCellDblClick"
      />

      <!-- Month View -->
      <CalendarMonthView
        v-else-if="viewMode === 'month'"
        :month-days="monthDays"
        :current-task-id="timerStore.currentTaskId"
        :selected-event-ids="selectedEventIds"
        :external-events="mergedExternalEvents"
        @month-drop="handleMonthDrop"
        @month-day-click="handleMonthDayClick"
        @event-drag-start="handleMonthDragStart"
        @event-drag-end="handleMonthDragEnd"
        @event-click="handleEventClick"
        @event-dbl-click="handleEventDblClick"
        @event-context-menu="handleEventContextMenu"
        @cycle-status="cycleTaskStatus"
        @cell-dbl-click="handleMonthCellDblClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUIStore } from '@/stores/ui'
import { useCalendarDragCreate } from '@/composables/useCalendarDragCreate'
import { useCalendarCore } from '@/composables/useCalendarCore'
import { useCalendarDayView } from '@/composables/calendar/useCalendarDayView'
import { useCalendarWeekView } from '@/composables/calendar/useCalendarWeekView'
import { useCalendarTimerIntegration } from '@/composables/calendar/useCalendarTimerIntegration'
import { useCalendarMonthView } from '@/composables/calendar/useCalendarMonthView'
import { useExternalCalendar } from '@/composables/calendar/useExternalCalendar'
import { useGoogleCalendar } from '@/composables/calendar/useGoogleCalendar'
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


import type { TimeSlot } from '@/composables/calendar/useCalendarDayView'
import { useDragAndDrop } from '@/composables/useDragAndDrop'

interface SortableEvent {
  item: HTMLElement
  newIndex: number
  [key: string]: unknown
}

const route = useRoute()
const router = useRouter()
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
  // Store validation logic
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
  handleEditTask,
  closeEditModal,
  handleConfirmDelete,
  confirmDeleteTask,
  cancelDeleteTask
} = useCalendarModals()

// Use global status filter directly from store (maintains reactivity)
const statusFilter = computed(() => taskStore.activeStatusFilter)


// Composables - Refactored logic into focused modules
// Restore missing definitions
let timeUpdateInterval: ReturnType<typeof setInterval> | null = null
let dragAbortController: AbortController | null = null
const DRAG_CAPTURE_OPTIONS = { capture: true, passive: false }

const dragCreate = useCalendarDragCreate()

const handleTaskCreated = () => {
  dragCreate.showQuickCreateModal.value = false
}

// Double-click empty cell in week view → open quick create modal
const handleWeekCellDblClick = (dateString: string, hour: number) => {
  const [year, month, day] = dateString.split('-').map(Number)
  const startTime = new Date(year, month - 1, day, hour, 0, 0, 0)
  const endTime = new Date(startTime.getTime() + 30 * 60000)
  dragCreate.quickCreateData.startTime = startTime
  dragCreate.quickCreateData.endTime = endTime
  dragCreate.quickCreateData.duration = 30
  dragCreate.showQuickCreateModal.value = true
}

// Double-click empty area in month day cell → open quick create modal
const handleMonthCellDblClick = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number)
  const now = new Date()
  // Default to current hour or 9 AM
  const defaultHour = (now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day)
    ? now.getHours()
    : 9
  const startTime = new Date(year, month - 1, day, defaultHour, 0, 0, 0)
  const endTime = new Date(startTime.getTime() + 30 * 60000)
  dragCreate.quickCreateData.startTime = startTime
  dragCreate.quickCreateData.endTime = endTime
  dragCreate.quickCreateData.duration = 30
  dragCreate.showQuickCreateModal.value = true
}
const eventHelpers = useCalendarCore()
const calendarScroll = useCalendarScroll()

// TASK-1285: Timer-calendar integration (growth map for real-time time block growth)
const timerIntegration = useCalendarTimerIntegration(currentDate)
const { timerGrowthMap, startTimerOnCalendarEvent } = timerIntegration

const dayView = useCalendarDayView(currentDate, statusFilter, timerGrowthMap)
const weekView = useCalendarWeekView(currentDate, statusFilter, timerGrowthMap)
const monthView = useCalendarMonthView(currentDate, statusFilter)

// TASK-1317: External calendar sync
const externalCalendar = useExternalCalendar()
const googleCalendar = useGoogleCalendar()

// TASK-1283: Merge Google Calendar + iCal external events
const mergedExternalEvents = computed(() => [
  ...(googleCalendar.showGoogleEvents.value ? googleCalendar.googleEvents.value : []),
  ...externalCalendar.allEvents.value
])

function getMergedEventsForDate(dateString: string) {
  return mergedExternalEvents.value.filter(event => {
    const d = event.startTime
    const eventDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return eventDate === dateString
  })
}

// Reactive current time for time indicator
const currentTime = ref(new Date())


// Destructure commonly used items from composables
const { hours, timeSlots, dragGhost, isDragging, draggedEventId, activeDropSlot, handleDragEnter, handleDragOver, handleDragLeave, handleDrop, handleEventDragStart: _rawEventDragStart, handleEventDragEnd: _rawEventDragEnd, startResize, resizePreview, getTasksForSlot, isTaskPrimarySlot, getSlotTaskStyle } = dayView


const { workingHours, weekDays, weekEvents, getWeekEventStyle, isCurrentWeekTimeCell, startWeekResize, resizePreview: weekResizePreview } = weekView

const { monthDays, handleMonthDragStart: _rawMonthDragStart, handleMonthDrop, handleMonthDragEnd: _rawMonthDragEnd, handleMonthDayClick: monthDayClickHandler } = monthView

// FEATURE-1336b: Bridge calendar drag events to global useDragAndDrop for sidebar drops
const { startDrag: startGlobalDrag, endDrag: endGlobalDrag } = useDragAndDrop()

const handleEventDragStart = (event: DragEvent, calendarEvent: any) => {
  _rawEventDragStart(event, calendarEvent)
  // Unified ghost pill — composable now handles startGlobalDrag with event
}

const handleEventDragEnd = (event: DragEvent, calendarEvent: any) => {
  _rawEventDragEnd(event, calendarEvent)
  // endGlobalDrag is called inside the composable's handleEventDragEnd
}

const handleMonthDragStart = (event: DragEvent, calendarEvent: any) => {
  _rawMonthDragStart(event, calendarEvent)
  if (calendarEvent.taskId) {
    // Unified ghost pill — pass event for setDragImage
    // BUG-1361: sidebar-only — calendar has its own ghost preview
    startGlobalDrag({
      type: 'task',
      taskId: calendarEvent.taskId,
      title: calendarEvent.title || '',
      source: 'calendar',
      ghostMode: 'sidebar-only'
    }, event)
  }
}

const handleMonthDragEnd = (event: DragEvent) => {
  _rawMonthDragEnd(event)
  endGlobalDrag()
}

const { formatHour, formatEventTime, getPriorityClass, getPriorityLabel,
        getTaskStatus, getStatusLabel, getStatusIcon, cycleTaskStatus,
        getProjectColor, getProjectName, getProjectVisual,
        formatSlotTime, isCurrentTimeSlot: checkCurrentTimeSlot } = eventHelpers

// Destructure scroll composable
const { setupScrollSync, cleanupScrollSync, scrollToCurrentTime } = calendarScroll

// Wrapper for isCurrentTimeSlot that passes current time
const isCurrentTimeSlot = (slot: TimeSlot) => checkCurrentTimeSlot(slot, currentTime.value)

// Interaction Handlers (Extracted)
const {
  hoveredEventId,
  selectedEventIds,
  handleSlotTaskMouseEnter,
  handleSlotTaskMouseLeave,
  handleEventDblClick,
  handleEventContextMenu,
  handleRemoveFromCalendar,
  handleEventClick,
  handleKeyDown,
  handleEscapeKey,
  handleMonthDayClick,
  clearSelection
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

// Provide helpers to sub-components (Day/Week views) to reduce props
provide('calendar-helpers', {
  formatHour,
  formatEventTime,
  getPriorityClass,
  getPriorityLabel,
  getTaskStatus,
  getStatusLabel,
  getStatusIcon,
  cycleTaskStatus,
  getProjectColor,
  getProjectName,
  getProjectVisual,
  formatSlotTime,
  isCurrentTimeSlot,
  getTasksForSlot,
  isTaskPrimarySlot,
  getSlotTaskStyle,
  handleRemoveFromCalendar,
  getWeekEventStyle,
  isCurrentWeekTimeCell,
  getExternalEventsForDate: getMergedEventsForDate
})

// Positioning and sizing for slot tasks are handled by getSlotTaskStyle from useCalendarDayView

// vuedraggable integration for calendar time grid drop zone
// This provides an alternative to native HTML5 drag-drop for better mobile support
const timeGridDropList = ref<unknown[]>([])

const _handleVueDraggableAdd = async (evt: SortableEvent) => {
  // When a task is dropped via vuedraggable, schedule it to the drop time
  const droppedElement = evt.item
  const taskId = droppedElement?.dataset?.taskId

  if (!taskId) {
    return
  }

  // Find the target time slot from drop position
  const dropIndex = evt.newIndex
  const slot = timeSlots.value[dropIndex]

  if (slot) {
    const targetDate = new Date(currentDate.value)
    targetDate.setHours(slot.hour, slot.minute, 0, 0)
    const dateStr = targetDate.toISOString().split('T')[0]
    const timeStr = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`

    const task = taskStore.getTask(taskId)
    // BUG-1325: Create explicit instance instead of setting legacy scheduledDate
    await taskStore.updateTaskWithUndo(taskId, {
      instances: [{
        id: `instance-${taskId}-${Date.now()}`,
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        duration: task?.estimatedDuration || 60
      }]
    })
  }

  // Clear the drop list since we don't actually display items in it
  timeGridDropList.value = []
}

const _handleVueDraggableChange = (_evt: unknown) => {
  // Optional: handle change events for debugging
  
}

// Native HTML5 Drag-Drop handlers for inbox → calendar (per FlowState Development Prompt)
// CRITICAL: @dragover.prevent is required or @drop never fires
// These wrap the composable handlers with proper event handling
const onDragOver = (e: DragEvent, slot: TimeSlot) => {
  // CRITICAL: preventDefault() already called by @dragover.prevent modifier
  // BUT we must set dropEffect to validate this as a drop target
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  

  // Call the existing handler from composable
  handleDragOver(e, slot)
}

const onDragEnter = (e: DragEvent, slot: TimeSlot) => {
  // CRITICAL: preventDefault() already called by @dragenter.prevent modifier
  // Set dropEffect to validate this as a drop target
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  

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

  

  // Use existing handleDrop from composable
  handleDrop(e, slot)
}

// ✅ CAPTURE PHASE HANDLERS
const handleDragEnterCapture = (e: Event) => {
  const dragEvent = e as DragEvent
  const slot = (dragEvent.target as HTMLElement).closest('.time-slot')
  if (!slot) return
  dragEvent.stopImmediatePropagation()
  const idx = parseInt(slot.getAttribute('data-slot-index') || '-1')
  if (idx === -1) return
  const slotObj = timeSlots.value[idx]
  if (slotObj) handleDragEnter(dragEvent, slotObj)
}

const handleDragOverCapture = (e: Event) => {
  const dragEvent = e as DragEvent
  const slot = (dragEvent.target as HTMLElement).closest('.time-slot')
  if (!slot) return
  dragEvent.preventDefault()
  dragEvent.stopImmediatePropagation()
  if (dragEvent.dataTransfer) dragEvent.dataTransfer.dropEffect = 'move'
  const idx = parseInt(slot.getAttribute('data-slot-index') || '-1')
  if (idx === -1) return
  const slotObj = timeSlots.value[idx]
  if (slotObj) {
    activeDropSlot.value = idx
    handleDragOver(dragEvent, slotObj)
  }
}

const handleDragLeaveCapture = (e: Event) => {
  const dragEvent = e as DragEvent
  const slot = (dragEvent.target as HTMLElement).closest('.time-slot')
  if (!slot) return
  dragEvent.stopImmediatePropagation()
  const idx = parseInt(slot.getAttribute('data-slot-index') || '-1')
  if (idx === -1) return
  activeDropSlot.value = null
  const slotObj = timeSlots.value[idx]
  if (slotObj) handleDragLeave()
}

const handleDropCapture = (e: Event) => {
  const dragEvent = e as DragEvent
  const slot = (dragEvent.target as HTMLElement).closest('.time-slot')
  if (!slot) return
  dragEvent.preventDefault()
  dragEvent.stopImmediatePropagation()
  const idx = parseInt(slot.getAttribute('data-slot-index') || '-1')
  if (idx === -1) return
  activeDropSlot.value = null
  const slotObj = timeSlots.value[idx]
  if (slotObj) handleDrop(dragEvent, slotObj)
}

// BUG-1340: Document-level dragend safety net — resets ALL calendar drag state
// regardless of drag source (inbox, calendar, kanban) or drop target.
// The dragend event fires on the source element and bubbles to document on EVERY drag end.
// BUG-1361: Also clean up global drag state (ghost pill, body class) because
// when inbox tasks are dropped on calendar, the source card may be removed from DOM
// by reactive filtering before @dragend fires, leaving ghost pills stuck on screen.
const handleGlobalDragEnd = () => {
  // BUG-1351: Replace entire object for guaranteed prop reactivity
  dragGhost.value = { visible: false, title: '', duration: 30, slotIndex: 0 }
  activeDropSlot.value = null
  isDragging.value = false
  draggedEventId.value = null

  // BUG-1361: Clean up global drag ghost pill + body class.
  // Safe to call even if already cleaned up (endGlobalDrag is idempotent).
  endGlobalDrag()
}

// TASK-1362: Handle calendar event dropped back onto inbox panel
const handleCalendarDropToInbox = (taskId: string) => {
  taskStore.unscheduleTaskWithUndo(taskId)
  clearSelection()
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

  // BUG-1090: Check for startNow query param (from START button navigation)
  // This replaces the event-based approach that had a race condition
  if (route.query.startNow === 'true') {
    // Navigate to today and scroll to current time
    handleStartTaskNow()
    // Clear the query param to prevent re-triggering on refresh
    router.replace({ path: '/calendar', query: {} })
  } else {
    // Scroll to current time on mount
    scrollToCurrentTime()
  }

  // Add event listeners
  window.addEventListener('start-task-now', handleStartTaskNow)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keydown', handleEscapeKey)

  // ✅ ADD CAPTURE PHASE DRAG EVENT LISTENERS
  const calendarEl = document.querySelector('.calendar-main')
  if (calendarEl) {
    dragAbortController = new AbortController()
    const { signal } = dragAbortController

    // Third parameter = { capture: true, signal } enables CAPTURE PHASE and AUTO-CLEANUP
    calendarEl.addEventListener('dragenter', handleDragEnterCapture, { ...DRAG_CAPTURE_OPTIONS, signal })
    calendarEl.addEventListener('dragover', handleDragOverCapture, { ...DRAG_CAPTURE_OPTIONS, signal })
    calendarEl.addEventListener('dragleave', handleDragLeaveCapture, { ...DRAG_CAPTURE_OPTIONS, signal })
    calendarEl.addEventListener('drop', handleDropCapture, { ...DRAG_CAPTURE_OPTIONS, signal })
  }

  // BUG-1340: Document-level dragend safety net — fires on every drag end regardless of
  // drop target, covering inbox-to-calendar drags, cross-component drags, and browser edge cases.
  document.addEventListener('dragend', handleGlobalDragEnd)
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
  window.removeEventListener('keydown', handleEscapeKey)

  // ✅ CLEANUP CAPTURE PHASE DRAG EVENT LISTENERS
  dragAbortController?.abort()
  dragAbortController = null

  // BUG-1340: Remove document-level dragend safety net
  document.removeEventListener('dragend', handleGlobalDragEnd)
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


</script>

<style scoped>
.calendar-layout {
  display: flex;
  flex: 1;
  background: var(--app-background-gradient);
  overflow: clip;
  min-height: 0;
  position: relative;
  z-index: 1;
  border-radius: var(--radius-lg) 0 0 0;
}

/* Uses .scroll-container utility for flex:1, overflow-y:auto, min-height:0 */
.calendar-main {
  display: flex;
  flex-direction: column;
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
