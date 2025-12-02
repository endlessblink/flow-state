<template>
<div class="calendar-layout">
    <!-- Calendar Inbox Panel -->
    <Transition name="sidebar-slide">
      <UnifiedInboxPanel
        v-show="uiStore.secondarySidebarVisible"
        context="calendar"
        :show-brain-dump="true"
        :start-collapsed="false"
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

    <!-- Task Context Menu -->
    <TaskContextMenu
      :isVisible="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="contextMenuTask"
      :compactMode="false"
      @close="closeContextMenu"
      @edit="handleEditTask"
      @confirmDelete="handleConfirmDelete"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :isOpen="showConfirmModal"
      title="Delete Task"
      message="Are you sure you want to delete this task? This action cannot be undone."
      confirmText="Delete"
      @confirm="confirmDeleteTask"
      @cancel="cancelDeleteTask"
    />

    <!-- Calendar Main Area -->
    <div class="calendar-main">
      <!-- Calendar Header -->
      <div class="calendar-header">
        <div class="date-navigation">
          <button class="nav-btn" @click="previousDay" title="Previous Day">
            <ChevronLeft :size="16" :stroke-width="1.5" />
          </button>
          <h2 class="current-date">{{ formatCurrentDate }}</h2>
          <button class="nav-btn" @click="nextDay" title="Next Day">
            <ChevronRight :size="16" :stroke-width="1.5" />
          </button>
        </div>
        <div class="header-actions">
          <button class="today-btn" @click="goToToday">
            <Calendar :size="16" :stroke-width="1.5" />
            Today
          </button>

          <!-- Project Filter -->
          <ProjectFilterDropdown />

          <!-- Hide Done Tasks Toggle -->
          

          <!-- Status Filters -->
          

          <div class="view-selector">
            <button
              class="view-btn"
              :class="{ active: viewMode === 'day' }"
              @click="viewMode = 'day'"
            >
              Day
            </button>
            <button
              class="view-btn"
              :class="{ active: viewMode === 'week' }"
              @click="viewMode = 'week'"
            >
              Week
            </button>
            <button
              class="view-btn"
              :class="{ active: viewMode === 'month' }"
              @click="viewMode = 'month'"
            >
              Month
            </button>
          </div>
        </div>
      </div>

      <!-- Calendar Grid - Day View (SLOT-BASED: tasks rendered INSIDE slots) -->
      <div v-if="viewMode === 'day'" class="calendar-grid">
        <div class="time-labels">
          <div
            v-for="hour in hours"
            :key="hour"
            class="time-label"
          >
            {{ formatHour(hour) }}
          </div>
        </div>

        <!-- Slots Container - Tasks render INSIDE slots (no absolute positioning) -->
        <div class="slots-container" ref="timeGridRef">
          <!-- Ghost Preview (only shown during inbox drag) -->
          <div v-if="dragGhost.visible" class="ghost-preview-inline" :style="{ gridRow: `${dragGhost.slotIndex + 1} / span ${Math.ceil(dragGhost.duration / 30)}` }">
            <div class="ghost-content">
              <div class="ghost-title">{{ dragGhost.title }}</div>
              <div class="ghost-duration">{{ dragGhost.duration }}min</div>
            </div>
          </div>

          <!-- Time Slots with tasks rendered inside -->
          <div
            v-for="slot in timeSlots"
            :key="slot.id"
            class="time-slot"
            :class="{
              'creating': dragCreate.isSlotInCreateRange(slot),
              'drag-over': activeDropSlot === slot.slotIndex,
              'current-time': isCurrentTimeSlot(slot)
            }"
            :data-slot-index="slot.slotIndex"
            :data-slot-date="slot.date"
            :data-hour="slot.hour"
            :data-minute="slot.minute"
            :data-time="formatSlotTime(slot)"
            @dragover.prevent="dayView.handleDragOver($event, timeSlotToDropTarget(slot))"
                @dragenter.prevent="dayView.handleDragEnter($event, timeSlotToDropTarget(slot))"
            @dragleave="dayView.handleDragLeave"
            @drop.prevent="dayView.handleDrop($event, timeSlotToDropTarget(slot))"
            @mousedown="dragCreate.handleSlotMouseDown($event, slot)"
          >
            <!-- Tasks rendered INSIDE the slot - ONLY PRIMARY SLOTS (no continuation artifacts) -->
            <template v-for="calEvent in getTasksForSlot(slot)" :key="`${calEvent.id}-${slot.slotIndex}`">
              <div
                v-if="isTaskPrimarySlot(slot, calEvent)"
                class="slot-task is-primary"
                :class="{
                  'timer-active-event': timerStore.currentTaskId === calEvent.taskId,
                  'dragging': isDragging && draggedEventId === calEvent.id,
                  'is-hovered': hoveredEventId === calEvent.id
                }"
                :style="{
                  height: `${(calEvent.slotSpan * 30) - 4}px`,
                  minHeight: `${(calEvent.slotSpan * 30) - 4}px`,
                  zIndex: 10
                }"
                @mouseenter="handleSlotTaskMouseEnter(calEvent.id)"
                @mouseleave="handleSlotTaskMouseLeave()"
                :data-duration="calEvent.duration"
                :data-task-id="calEvent.taskId"
                draggable="true"
                @dragstart="handleEventDragStart($event, calEvent)"
                @dragend="handleEventDragEnd($event, calEvent)"
                @click="handleEventClick($event, calEvent)"
                @dblclick="handleEventDblClick(calEvent)"
                @contextmenu.prevent="handleEventContextMenu($event, calEvent)"
              >
                <!-- CLEAN CALENDAR-ONLY DISPLAY -->
                <div class="calendar-task-content">
                  <div class="calendar-task-title">{{ calEvent.title }}</div>
                </div>

                <!-- Resize Handle (top for changing start time) -->
                <div
                  class="resize-handle resize-top"
                  @mousedown.stop="startResize($event, calEvent, 'top')"
                  title="Drag to change start time"
                ></div>

                <!-- Resize Handle (bottom for changing duration) -->
                <div
                  class="resize-handle resize-bottom"
                  @mousedown.stop="startResize($event, calEvent, 'bottom')"
                  title="Drag to change duration"
                ></div>

                <!-- Resize Preview Overlay -->
                <div
                  v-if="resizePreview?.isResizing && resizePreview.taskId === calEvent.taskId"
                  class="resize-preview-overlay"
                  :style="{
                    height: `${Math.ceil(resizePreview.previewDuration / 30) * 30}px`,
                    top: resizePreview.direction === 'top' ? 'auto' : '0',
                    bottom: resizePreview.direction === 'top' ? '0' : 'auto'
                  }"
                >
                  <span class="preview-duration">{{ resizePreview.previewDuration }}min</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Week View -->
      <div v-else-if="viewMode === 'week'" class="week-view">
        <!-- Week Header -->
        <div class="week-header">
          <div class="week-time-label"></div>
          <div
            v-for="(day, index) in weekDays"
            :key="index"
            class="week-day-header"
          >
            <div class="week-day-name">{{ day.dayName }}</div>
            <div class="week-day-date">{{ day.date }}</div>
          </div>
        </div>

        <!-- Week Grid Container -->
        <div class="week-grid-container">
          <!-- Time Labels -->
          <div class="week-time-labels">
            <div
              v-for="hour in workingHours"
              :key="hour"
              class="week-time-label"
            >
              {{ formatHour(hour) }}
            </div>
          </div>

          <!-- Week Days Grid -->
          <div class="week-days-grid">
            <!-- Time Grid Background with drop zones -->
            <div class="week-time-grid">
              <div
                v-for="(day, dayIndex) in weekDays"
                :key="`col-${dayIndex}`"
                class="week-day-column"
              >
                <div
                  v-for="(hour, hourIndex) in workingHours"
                  :key="`${dayIndex}-${hour}`"
                  class="week-time-cell"
                  @drop="handleWeekDrop($event, day.dateString, hour)"
                  @dragover.prevent="handleWeekDragOver"
                  @dragenter.prevent
                ></div>
              </div>
            </div>

            <!-- Events Layer -->
            <div class="week-events-layer">
              <div
                v-for="event in weekEvents"
                :key="event.id"
                class="week-event"
                :data-duration="event.duration"
                :style="getWeekEventStyle(event) as any"
                :class="{
                  'multi-slot': event.slotSpan > 1,
                  'timer-active-event': timerStore.currentTaskId === event.taskId
                }"
                draggable="true"
                @dragstart="handleEventDragStart($event, event)"
                @dragend="handleEventDragEnd($event, event)"
                @click="handleEventClick($event, event)"
              >
                <!-- Top Resize Handle -->
                <div
                  class="resize-handle resize-top"
                  @mousedown.stop="startWeekResize($event, event, 'top')"
                  title="Resize start time"
                ></div>

                <!-- Project Stripe -->
                <div
                  v-if="getProjectVisual(event).type === 'emoji'"
                  class="project-stripe project-emoji-stripe"
                  :title="`Project: ${getProjectName(event)}`"
                >
                  <ProjectEmojiIcon
                    :emoji="getProjectVisual(event).content"
                    size="xs"
                    :title="`Project: ${getProjectName(event)}`"
                    class="project-emoji"
                  />
                </div>
                <div
                  v-else
                  class="project-stripe project-color-stripe"
                  :style="{ backgroundColor: getProjectColor(event) }"
                  :title="`Project: ${getProjectName(event)}`"
                ></div>

                <!-- Priority Stripe -->
                <div
                  class="priority-stripe"
                  :class="`priority-${getPriorityClass(event)}`"
                  :title="`Priority: ${getPriorityLabel(event)}`"
                ></div>

                <!-- Event Content -->
                <div
                  class="event-content"
                  @dblclick="handleEventDblClick(event)"
                  @contextmenu.prevent="handleEventContextMenu($event, event)"
                >
                  <div class="event-header">
                    <div class="event-title">{{ event.title }}</div>
                    <div class="event-actions">
                      <div
                        class="status-indicator"
                        :class="`status-${getTaskStatus(event)}`"
                        @click.stop="cycleTaskStatus($event, event)"
                        :title="`Status: ${getStatusLabel(event)} (click to change)`"
                      >
                        {{ getStatusIcon(getTaskStatus(event)) }}
                      </div>
                      <button
                        class="remove-from-calendar-btn"
                        @click.stop="handleRemoveFromCalendar(event)"
                        :title="`Remove from calendar (move to inbox)`"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div class="event-duration">{{ event.duration }}min</div>
                </div>

                <!-- Bottom Resize Handle -->
                <div
                  class="resize-handle resize-bottom"
                  @mousedown.stop="startWeekResize($event, event, 'bottom')"
                  title="Resize end time"
                ></div>
              </div>
            </div>

            <!-- Current Time Indicator Layer (Above Events) -->
            <div class="week-current-time-layer">
              <div
                v-for="(day, dayIndex) in weekDays"
                :key="`time-${dayIndex}`"
                class="week-day-time-column"
              >
                <div
                  v-for="hour in workingHours"
                  :key="`time-${dayIndex}-${hour}`"
                  class="week-time-indicator"
                  :class="{ 'current-time': isCurrentWeekTimeCell(day.dateString, hour) }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Month View -->
      <div v-else-if="viewMode === 'month'" class="month-view">
        <!-- Month Grid -->
        <div class="month-grid">
          <div
            v-for="day in monthDays"
            :key="day.dateString"
            class="month-day-cell"
            :class="{
              'other-month': !day.isCurrentMonth,
              'today': day.isToday
            }"
            @drop="handleMonthDrop($event, day.dateString)"
            @dragover.prevent
            @dragenter.prevent
            @click="handleMonthDayClick(day.dateString)"
          >
            <div class="day-number">{{ day.dayNumber }}</div>

            <div class="day-events">
              <div
                v-for="event in day.events"
                :key="event.id"
                class="month-event"
                :class="{ 'timer-active-event': timerStore.currentTaskId === event.taskId }"
                :style="{ backgroundColor: event.color }"
                draggable="true"
                @dragstart="handleMonthDragStart($event, event)"
                @dragend="handleMonthDragEnd($event)"
                @dblclick.stop="handleEventDblClick(event)"
                @contextmenu.prevent.stop="handleEventContextMenu($event, event)"
                @click.stop
              >
                <!-- Project Stripe -->
              <div
                v-if="getProjectVisual(event).type === 'emoji'"
                class="project-indicator project-emoji-indicator"
                :title="`Project: ${getProjectName(event)}`"
              >
                <ProjectEmojiIcon
                  :emoji="getProjectVisual(event).content"
                  size="xs"
                  :title="`Project: ${getProjectName(event)}`"
                  class="project-emoji"
                />
              </div>
              <div
                v-else
                class="project-indicator project-color-indicator"
                :style="{ backgroundColor: getProjectColor(event) }"
                :title="`Project: ${getProjectName(event)}`"
              ></div>

              <!-- Priority Stripe -->
              <div
                class="priority-stripe"
                :class="`priority-${getPriorityClass(event)}`"
                :title="`Priority: ${getPriorityLabel(event)}`"
              ></div>
                <span class="event-time">{{ formatEventTime(event) }}</span>
                <span 
                  class="event-title-short"
                  @click.stop="cycleTaskStatus($event, event)"
                  :title="`Status: ${getStatusLabel(event)} (click to change)`"
                >
                  {{ getStatusIcon(getTaskStatus(event)) }} {{ event.title }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUIStore } from '@/stores/ui'
import { useCalendarDragCreate } from '@/composables/useCalendarDragCreate'
import { useCalendarEventHelpers } from '@/composables/calendar/useCalendarEventHelpers'
import { useCalendarDayView } from '@/composables/calendar/useCalendarDayView'
import { useCalendarWeekView } from '@/composables/calendar/useCalendarWeekView'
import { useCalendarMonthView } from '@/composables/calendar/useCalendarMonthView'
import UnifiedInboxPanel from '@/components/base/UnifiedInboxPanel.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import TaskContextMenu from '@/components/TaskContextMenu.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import QuickTaskCreate from '@/components/QuickTaskCreate.vue'
import ProjectFilterDropdown from '@/components/ProjectFilterDropdown.vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import { ChevronLeft, ChevronRight, Calendar, Eye, EyeOff, ListTodo, Play, Check, Video, VideoOff, Download } from 'lucide-vue-next'
import { dragRecorder, type InteractionAnalysis } from '@/utils/DragInteractionRecorder'

const taskStore = useTaskStore()
const timerStore = useTimerStore()
const uiStore = useUIStore()

// View state
const currentDate = ref(new Date())
const viewMode = ref<'day' | 'week' | 'month'>('day')
// Use global status filter directly from store (maintains reactivity)
const statusFilter = computed(() => taskStore.activeStatusFilter)
const timeGridRef = ref<HTMLElement | null>(null)

// Recording state
const isRecording = ref(false)
const recordingStatus = ref({ duration: 0, eventsCaptured: 0 })
const lastAnalysis = ref<InteractionAnalysis | null>(null)
const showRecordingPanel = ref(false)

// Debug function to inventory all tasks with their statuses
const debugTaskInventory = () => {
  console.log('🚨 CALENDAR VIEW: === TASK INVENTORY DEBUG ===')
  console.log('🚨 CALENDAR VIEW: Total tasks in store:', taskStore.tasks.length)

  const tasksByStatus = {
    planned: taskStore.tasks.filter(t => t.status === 'planned'),
    'in-progress': taskStore.tasks.filter(t => t.status === 'in_progress'),
    done: taskStore.tasks.filter(t => t.status === 'done'),
    backlog: taskStore.tasks.filter(t => t.status === 'backlog'),
    'on_hold': taskStore.tasks.filter(t => t.status === 'on_hold')
  }

  console.log('🚨 CALENDAR VIEW: Tasks by status:')
  Object.entries(tasksByStatus).forEach(([status, tasks]) => {
    console.log(`🚨 CALENDAR VIEW:   ${status}: ${tasks.length} tasks`)
    tasks.forEach(task => {
      console.log(`🚨 CALENDAR VIEW:     - "${task.title}" (ID: ${task.id})`)
      const instances = taskStore.getTaskInstances(task)
      if (instances.length > 0) {
        console.log(`🚨 CALENDAR VIEW:       Instances: ${instances.map(i => `${i.scheduledDate} ${i.scheduledTime}`).join(', ')}`)
      }
    })
  })

  console.log('🚨 CALENDAR VIEW: Current filtered tasks:', taskStore.filteredTasks.length)
  console.log('🚨 CALENDAR VIEW: Current calendar events:', calendarEvents.value.length)
  console.log('🚨 CALENDAR VIEW: === END TASK INVENTORY ===')
}

// Status filter change handler using global TaskStore
const handleStatusFilterChange = (event: MouseEvent, newFilter: 'planned' | 'in_progress' | 'done' | null) => {
  // Prevent event bubbling that might interfere with other click handlers
  event.stopPropagation()
  console.log('🚨 CALENDAR VIEW: Status filter button clicked!')
  console.log('🚨 CALENDAR VIEW: Previous filter:', statusFilter.value)
  console.log('🚨 CALENDAR VIEW: New filter:', newFilter)
  console.log('🚨 CALENDAR VIEW: Event target:', event.target)

  // Show task inventory before filter change
  debugTaskInventory()

  // Use global TaskStore method to set status filter
  taskStore.setActiveStatusFilter(newFilter)

  console.log('🚨 CALENDAR VIEW: Filter updated via TaskStore, current value:', statusFilter.value)
  console.log('🚨 CALENDAR VIEW: Task store filteredTasks count:', taskStore.filteredTasks.length)

  // Force Vue reactivity check
  nextTick(() => {
    console.log('🚨 CALENDAR VIEW: After nextTick, filter value:', statusFilter.value)
    console.log('🚨 CALENDAR VIEW: Task store filteredTasks count after tick:', taskStore.filteredTasks.length)
    console.log('🚨 CALENDAR VIEW: Calendar events after filter:', calendarEvents.value.length)

    // Show which calendar events passed the filter
    console.log('🚨 CALENDAR VIEW: Calendar events after filter:')
    calendarEvents.value.forEach(event => {
      const task = taskStore.tasks.find(t => t.id === event.taskId)
      console.log(`🚨 CALENDAR VIEW:   - "${event.title}" (Status: ${task?.status}, Task ID: ${event.taskId})`)
    })
  })
}

// Composables - Refactored logic into focused modules
const dragCreate = useCalendarDragCreate()
const eventHelpers = useCalendarEventHelpers()
const dayView = useCalendarDayView(currentDate, statusFilter)
const weekView = useCalendarWeekView(currentDate, statusFilter)
const monthView = useCalendarMonthView(currentDate, statusFilter)

// Helper function to convert TimeSlot to DropTarget for unified drag system
const timeSlotToDropTarget = (slot: any) => ({
  type: 'time-slot' as const,
  date: slot.date,
  time: `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`,
  slotIndex: slot.slotIndex
})

// Reactive current time for time indicator
const currentTime = ref(new Date())
let timeUpdateInterval: NodeJS.Timeout | null = null

// Task Edit Modal state
const isEditModalOpen = ref(false)
const selectedTask = ref<Task | null>(null)

// Context menu state
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)

// Delete confirmation modal state
const showConfirmModal = ref(false)
const taskToDelete = ref<string | null>(null)

// Calendar event selection state for keyboard operations - now supports multi-select
const selectedCalendarEvents = ref<any[]>([])

// Hover state for slot tasks - used to show resize handles (draggable elements have inconsistent :hover)
const hoveredEventId = ref<string | null>(null)

// Methods for hover tracking (inline handlers don't work reliably with draggable elements)
const handleSlotTaskMouseEnter = (eventId: string) => {
  hoveredEventId.value = eventId
}
const handleSlotTaskMouseLeave = () => {
  hoveredEventId.value = null
}

// Destructure commonly used items from composables
const { hours, timeSlots, calendarEvents, dragGhost, dragMode, getEventStyle, getGhostStyle,
        isDragging, draggedEventId, activeDropSlot, handleDragEnter, handleDragOver, handleDragLeave, handleDrop, handleEventDragStart, handleEventDragEnd,
        handleEventMouseDown, startResize, resizePreview, getTasksForSlot, isTaskPrimarySlot } = dayView

const { workingHours, weekDays, weekEvents, getWeekEventStyle, handleWeekEventMouseDown,
        handleWeekDragOver, handleWeekDrop, startWeekResize, isCurrentWeekTimeCell } = weekView

const { monthDays, handleMonthDragStart, handleMonthDrop, handleMonthDragEnd, handleMonthDayClick: monthDayClickHandler } = monthView

const { formatHour, formatEventTime, getPriorityClass, getPriorityLabel,
        getTaskStatus, getStatusLabel, getStatusIcon, cycleTaskStatus,
        getProjectColor, getProjectEmoji, getProjectName } = eventHelpers

// Helper function to get project visual for calendar events
const getProjectVisual = (event: any) => {
  if (!event.projectId) return { type: 'default', content: '📁' }
  return taskStore.getProjectVisual(event.projectId)
}

// vuedraggable integration for calendar time grid drop zone
// This provides an alternative to native HTML5 drag-drop for better mobile support
const timeGridDropList = ref<any[]>([])

const handleVueDraggableAdd = (evt: any) => {
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

const handleVueDraggableChange = (evt: any) => {
  // Optional: handle change events for debugging
  console.log('[Calendar] vuedraggable change:', evt)
}

// Helper to format slot time for data attribute
const formatSlotTime = (slot: any) => {
  return `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
}

// Unified drag handlers are now used directly from dayView composable
// This eliminates duplicate wrapper methods and centralizes drag logic

// ✅ CAPTURE PHASE HANDLERS
const handleDragEnterCapture = (e: DragEvent) => {
  const slot = (e.target as HTMLElement).closest('.time-slot')
  if (!slot) return
  e.stopImmediatePropagation()
  const idx = parseInt(slot.getAttribute('data-slot-index') || '-1')
  if (idx === -1) return
  const slotObj = timeSlots.value[idx]
  if (slotObj) dayView.handleDragEnter(e, timeSlotToDropTarget(slotObj))
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
    dayView.handleDragOver(e, timeSlotToDropTarget(slotObj))
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
  if (slotObj) dayView.handleDrop(e, timeSlotToDropTarget(slotObj))
}

// Scroll synchronization
let calendarEventsContainer: HTMLElement | null = null
let timeLabelsContainer: HTMLElement | null = null
let scrollHandler: ((event: Event) => void) | null = null

const setupScrollSync = () => {
  // Use nextTick to ensure DOM is ready
  nextTick(() => {
    calendarEventsContainer = document.querySelector('.calendar-events-container') as HTMLElement
    timeLabelsContainer = document.querySelector('.time-labels') as HTMLElement

    if (calendarEventsContainer && timeLabelsContainer) {
      scrollHandler = () => {
        if (timeLabelsContainer && calendarEventsContainer) {
          timeLabelsContainer.scrollTop = calendarEventsContainer.scrollTop
        }
      }

      calendarEventsContainer.addEventListener('scroll', scrollHandler, { passive: true })
    }
  })
}

// Scroll to current time functionality
const scrollToCurrentTime = () => {
  // Use nextTick to ensure DOM is ready and time slots are rendered
  nextTick(() => {
    const container = document.querySelector('.calendar-grid') as HTMLElement
    if (!container) return

    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    // Calculate which time slot to scroll to (30-minute slots)
    const slotIndex = Math.floor((currentHour * 2) + (currentMinute >= 30 ? 1 : 0))
    const slotHeight = 30 // Each slot is 30px high

    // Calculate scroll position with some offset to show current time in upper portion
    const scrollTop = slotIndex * slotHeight - 100 // 100px offset from top

    // Scroll to the calculated position
    container.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth'
    })
  })
}

const cleanupScrollSync = () => {
  if (calendarEventsContainer && scrollHandler) {
    calendarEventsContainer.removeEventListener('scroll', scrollHandler)
  }
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
  window.addEventListener('task-context-menu', handleInboxContextMenu)

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
  window.removeEventListener('task-context-menu', handleInboxContextMenu)

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

watch(currentDate, (newDate, oldDate) => {
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

// Helper to get week start (for date formatting only)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Formatted current date for header
const formatCurrentDate = computed(() => {
  if (viewMode.value === 'week') {
    const weekStart = getWeekStart(currentDate.value)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
    const year = weekStart.getFullYear()

    if (startMonth === endMonth) {
      return `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${year}`
    } else {
      return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}, ${year}`
    }
  }

  if (viewMode.value === 'month') {
    return currentDate.value.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    })
  }

  return currentDate.value.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

// Current time slot detection (not extracted to composable as it uses local currentTime ref)
const isCurrentTimeSlot = (slot: any) => {
  const now = currentTime.value
  const slotDate = new Date(`${slot.date}T${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`)
  const slotEnd = new Date(slotDate.getTime() + 30 * 60000)

  return now >= slotDate && now < slotEnd &&
         slot.date === now.toISOString().split('T')[0]
}

const previousDay = () => {
  const date = new Date(currentDate.value)
  date.setDate(date.getDate() - 1)
  currentDate.value = date
}

const nextDay = () => {
  const date = new Date(currentDate.value)
  date.setDate(date.getDate() + 1)
  currentDate.value = date
}

const goToToday = () => {
  currentDate.value = new Date()
  // Scroll to current time after navigating to today
  setTimeout(() => scrollToCurrentTime(), 100)
}

const handleAddTask = () => {
  // Open QuickTaskCreate modal instead of creating a hardcoded task
  const now = new Date()
  const dateStr = currentDate.value.toISOString().split('T')[0]
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:00`

  // Store task data for the modal
  dragCreate.quickCreateData.startTime = new Date(`${dateStr}T${timeStr}`)
  dragCreate.quickCreateData.duration = 60
  dragCreate.showQuickCreateModal.value = true
}

const handleStartTimer = (taskId: string) => {
  timerStore.startTimer(taskId)
}

const handleEditTask = (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (task) {
    selectedTask.value = task
    isEditModalOpen.value = true
  }
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  selectedTask.value = null
}

const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuTask.value = null
}

// Handle custom context menu event from CalendarInboxPanel
const handleInboxContextMenu = (event: Event) => {
  const customEvent = event as CustomEvent<{
    event: MouseEvent
    task: Task
    instanceId?: string
    isCalendarEvent: boolean
  }>

  const { event: mouseEvent, task } = customEvent.detail

  contextMenuX.value = mouseEvent.clientX
  contextMenuY.value = mouseEvent.clientY
  contextMenuTask.value = task
  showContextMenu.value = true
}

// Delete confirmation handlers
const handleConfirmDelete = (taskId: string) => {
  taskToDelete.value = taskId
  showConfirmModal.value = true
}

const confirmDeleteTask = async () => {
  if (taskToDelete.value) {
    try {
      await taskStore.deleteTaskWithUndo(taskToDelete.value)
      taskToDelete.value = null
    } catch (error) {
      console.error('❌ Error deleting task:', error)
    }
  }
  showConfirmModal.value = false
}

const cancelDeleteTask = () => {
  taskToDelete.value = null
  showConfirmModal.value = false
}

// Task modal handlers
const handleTaskCreated = (task: Task) => {
  console.log('Task created:', task)
  dragCreate.showQuickCreateModal.value = false
  dragCreate.resetCreateDrag()
}

// Event interaction handlers
const handleEventDblClick = (calendarEvent: any) => {
  handleEditTask(calendarEvent.taskId)
}

const handleEventContextMenu = (mouseEvent: MouseEvent, calendarEvent: any) => {
  mouseEvent.preventDefault()
  mouseEvent.stopPropagation()

  const task = taskStore.tasks.find(t => t.id === calendarEvent.taskId)
  if (!task) return

  // Set context menu state
  contextMenuX.value = mouseEvent.clientX
  contextMenuY.value = mouseEvent.clientY
  contextMenuTask.value = task
  showContextMenu.value = true
}

// Remove task from calendar timeline and move to inbox
const handleRemoveFromCalendar = (calendarEvent: any) => {
  console.log(`🗑️ Removing task "${calendarEvent.title}" from calendar`)

  // Find the task
  const task = taskStore.tasks.find(t => t.id === calendarEvent.taskId)
  if (!task) {
    console.warn(`Task not found for calendar event: ${calendarEvent.taskId}`)
    return
  }

  // Use the unscheduleTask method to remove from calendar and move to inbox
  taskStore.unscheduleTask(task.id)

  console.log(`✅ Task "${task.title}" removed from calendar and moved to inbox`)
}

// Calendar event selection for keyboard operations - now supports multi-select
const handleEventClick = (mouseEvent: MouseEvent, calendarEvent: any) => {
  const eventElement = mouseEvent.currentTarget as HTMLElement
  const isCtrlOrCmd = mouseEvent.ctrlKey || mouseEvent.metaKey

  console.log('🖱️ Calendar event click:', {
    eventId: calendarEvent.id,
    eventTitle: calendarEvent.title,
    isCtrlMultiSelect: isCtrlOrCmd,
    currentSelection: selectedCalendarEvents.value.map(e => e.id),
    selectedCount: selectedCalendarEvents.value.length
  })

  // IMPORTANT: Don't handle clicks if a drag operation is in progress
  // This prevents interference with drag-drop functionality
  if (isDragging.value) {
    console.log('🚫 Click ignored - drag operation in progress')
    return
  }

  if (isCtrlOrCmd) {
    // Multi-select: toggle event in selection array
    const index = selectedCalendarEvents.value.findIndex(e => e.id === calendarEvent.id)

    if (index > -1) {
      // Remove from selection
      console.log('🖱️ Removing from multi-select:', calendarEvent.title)
      selectedCalendarEvents.value.splice(index, 1)
      eventElement.classList.remove('selected')
    } else {
      // Add to selection
      console.log('🖱️ Adding to multi-select:', calendarEvent.title)
      selectedCalendarEvents.value.push(calendarEvent)
      eventElement.classList.add('selected')
    }
  } else {
    // Single select: clear previous and select only this
    console.log('🖱️ Single select (clearing previous):', calendarEvent.title)

    // Check if clicking same event (toggle deselect)
    if (selectedCalendarEvents.value.length === 1 && selectedCalendarEvents.value[0].id === calendarEvent.id) {
      // Deselect
      console.log('🖱️ Deselecting event:', calendarEvent.title)
      selectedCalendarEvents.value = []
      eventElement.classList.remove('selected')
    } else {
      // Clear previous selections
      document.querySelectorAll('.calendar-event.selected, .week-event.selected').forEach(el => {
        el.classList.remove('selected')
      })

      // Select new event
      selectedCalendarEvents.value = [calendarEvent]
      eventElement.classList.add('selected')
    }
  }
}

// Delete key handler for calendar events - supports multiple selected
const handleKeyDown = (event: KeyboardEvent) => {
  const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'
  if (!isDeleteKey) return

  // Only proceed if we have selected calendar events
  if (selectedCalendarEvents.value.length === 0) return

  // Prevent default behavior
  event.preventDefault()
  event.stopPropagation()

  console.log('🗑️ Calendar Delete: Removing', selectedCalendarEvents.value.length, 'selected tasks')

  // Remove each selected calendar event
  selectedCalendarEvents.value.forEach(calendarEvent => {
    const task = taskStore.tasks.find(t => t.id === calendarEvent.taskId)
    if (!task) return

    console.log('🗑️ Calendar Delete: Removing calendar instance and moving task to inbox:', task.title)

    // Use the same unschedule logic as the "Remove from Calendar" button
    // This preserves canvas position and ensures consistent behavior
    taskStore.unscheduleTaskWithUndo(task.id)
  })

  // Clear selection and DOM
  selectedCalendarEvents.value = []
  document.querySelectorAll('.calendar-event.selected, .week-event.selected').forEach(el => {
    el.classList.remove('selected')
  })
}

// Month day click wraps composable handler with viewMode ref
const handleMonthDayClick = (dateString: string) => {
  monthDayClickHandler(dateString, viewMode)
}

// Debug function to test toggle functionality
const handleToggleDoneTasks = (event: MouseEvent) => {
  // Prevent event bubbling that might interfere with other click handlers
  event.stopPropagation()
  console.log('🔧 CalendarView: Toggle button clicked!')
  console.log('🔧 CalendarView: Current hideDoneTasks value:', taskStore.hideDoneTasks)

  try {
    taskStore.toggleHideDoneTasks()
    console.log('🔧 CalendarView: After toggle - hideDoneTasks value:', taskStore.hideDoneTasks)
    console.log('🔧 CalendarView: Method call successful')
  } catch (error) {
    console.error('🔧 CalendarView: Error calling toggleHideDoneTasks:', error)
  }
}
</script>

<style scoped>
.calendar-layout {
  display: flex;
  flex: 1;
  background: var(--surface-primary);
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

.calendar-header {
  position: sticky;
  top: 0;
  z-index: 200; /* Above all calendar content and events */
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-8);
  /* Solid background to ensure visibility when sticky */
  background: var(--surface-primary);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-md);
  box-shadow: var(--shadow-lg);
}

.date-navigation {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.nav-btn {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
}

.nav-btn:hover {
  background: linear-gradient(
    135deg,
    var(--border-medium) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-xl);
}

.current-date {
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0;
  text-shadow: var(--shadow-sm);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.today-btn {
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.today-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.view-selector {
  display: flex;
  gap: var(--space-1);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  box-shadow: inset var(--shadow-sm);
}

.view-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.view-btn:hover {
  color: var(--text-primary);
  background: var(--glass-bg-heavy);
}

.view-btn.active {
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* Status Filters - Cohesive Design System */
.status-filters {
  display: flex;
  gap: var(--space-1);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  box-shadow: inset var(--shadow-sm);
}

.status-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  position: relative;
  z-index: 1;
  pointer-events: auto;
}

.status-btn.icon-only {
  padding: var(--space-2);
  min-width: 36px;
  min-height: 36px;
  justify-content: center;
  display: flex;
  align-items: center;
}

.status-btn:hover {
  color: var(--text-primary);
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  box-shadow: var(--state-hover-shadow);
}

.status-btn.active {
  color: var(--state-active-text);
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* Hide Done Tasks Toggle - Calendar */
.hide-done-toggle {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
  position: relative;
  z-index: 1000;
  pointer-events: auto;
  user-select: none;
}

.hide-done-toggle.icon-only {
  padding: var(--space-2);
  min-width: 40px;
  min-height: 40px;
  justify-content: center;
}

.hide-done-toggle:hover {
  background: linear-gradient(
    135deg,
    var(--state-hover-bg) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.hide-done-toggle.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.calendar-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 80px 1fr;
  overflow: visible;
  min-height: 0; /* Allow flex child to shrink below content size */
  position: relative;
  z-index: 1;
}

.time-labels {
  background: linear-gradient(
    135deg,
    var(--glass-bg-tint) 0%,
    var(--glass-bg-weak) 100%
  );
  backdrop-filter: blur(16px);
  border-inline-end: 1px solid var(--glass-border-light); /* RTL: time labels border */
  overflow-y: auto;
  box-shadow: var(--shadow-xs);
  scrollbar-width: none; /* Firefox */
}

.time-labels::-webkit-scrollbar {
  display: none; /* Chrome/Safari - hide scrollbar but keep functionality */
}

.time-label {
  height: 60px;
  display: flex;
  align-items: flex-start;
  justify-content: end; /* RTL: align time labels to end */
  padding-top: var(--space-1);
  padding-inline-end: var(--space-3); /* RTL: time label padding */
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-bottom: 1px solid var(--glass-bg-tint);
}

.calendar-events-container {
  position: relative;
  background: linear-gradient(
    180deg,
    var(--glass-bg-subtle) 0%,
    transparent 100%
  );
  overflow-y: auto;
}

/* Slot-based Calendar Styles (NEW ARCHITECTURE) */

/* Slot container replaces events-layer - normal flex layout, not positioned */
.slots-container {
  position: relative;
  background: linear-gradient(
    180deg,
    var(--glass-bg-subtle) 0%,
    transparent 100%
  );
  overflow-y: auto;
  z-index: 2;
  /* Same scrollbar styles as old calendar-events-container */
}

/* Custom minimalist scrollbar styling */
.slots-container::-webkit-scrollbar {
  width: 6px;
}

.slots-container::-webkit-scrollbar-track {
  background: transparent;
}

.slots-container::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.slots-container::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

/* Firefox scrollbar styling */
.slots-container {
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

/* Slot tasks are normal flow children, NOT absolute positioned */
.slot-task {
  position: relative; /* NOT absolute - normal flow */
  margin: 2px 4px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: var(--surface-tertiary);
  color: var(--text-primary);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  pointer-events: auto;
  box-shadow: var(--shadow-sm);
  cursor: grab;
  min-height: 24px;
  font-size: var(--text-xs);
  z-index: 5; /* Above time slots to allow drag and resize interactions */
}

.slot-task:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.slot-task.selected {
  background: var(--state-selected-bg);
  border: 2px solid var(--state-selected-border);
  box-shadow: var(--state-selected-shadow), var(--state-selected-glow);
  z-index: 15;
}

/* Drag states for slot tasks */
.slot-task.dragging {
  opacity: 0.5;
  transform: scale(0.95);
  cursor: grabbing;
  border: 2px dashed var(--state-selected-border);
  background: var(--state-selected-bg);
  box-shadow: var(--state-selected-shadow), var(--state-selected-glow);
  z-index: 100;
  pointer-events: none; /* Allow drops to pass through to time slots */
}

.slot-task[draggable="true"]:hover {
  cursor: grab;
}

.slot-task[draggable="true"]:active {
  cursor: grabbing;
}

/* Primary slot shows full task content */
.slot-task.is-primary {
  border-left: 4px solid var(--accent-primary);
  padding-left: calc(var(--space-3) - 2px); /* Adjust for thicker left border */
}

/* Continuation slot shows minimal indicator */
.slot-task:not(.is-primary) {
  opacity: 0.7;
  font-size: var(--text-xs);
  padding: 1px var(--space-2);
  min-height: 16px;
  cursor: default; /* Can't drag continuation slots */
  pointer-events: none; /* Only primary slot is draggable */
}

.continuation-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-style: italic;
}

.continuation-indicator::before {
  content: '↳';
  color: var(--text-muted);
}

/* Task content layout for primary slots */
.task-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
}

.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

/* Clean calendar-specific task styling */
.calendar-task-content {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 20px;
}

.calendar-task-title {
  color: var(--text-primary);
  font-weight: var(--font-medium);
  font-size: var(--text-xs);
  line-height: 1.3;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  flex: 1;
}

.task-title {
  flex: 1;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-actions {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.slot-task:hover .task-actions {
  opacity: 1;
}

.task-duration {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: var(--glass-bg-subtle);
  padding: 2px var(--space-1);
  border-radius: var(--radius-sm);
}

/* Resize handles for day view tasks */
.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 8px;
  background: transparent;
  cursor: ns-resize;
  z-index: 20;
  opacity: 0;
  transition: all var(--duration-fast);
  pointer-events: none;
}

.resize-handle.resize-top {
  top: 0;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.resize-handle.resize-bottom {
  bottom: 0;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}

/* Use both :hover and .is-hovered class for resize handle visibility
   The .is-hovered class is set via JS because draggable elements have inconsistent :hover behavior
   transition: none is required to prevent the transition from blocking immediate opacity change */
.slot-task.is-primary:hover .resize-handle,
.slot-task.is-primary.is-hovered .resize-handle {
  opacity: 1 !important;
  pointer-events: auto !important;
  background: rgba(99, 102, 241, 0.4) !important;
  transition: none !important;
}

.resize-handle:hover {
  background: rgba(99, 102, 241, 0.7) !important;
}

/* Resize Preview Overlay - shows projected size during resize drag */
.resize-preview-overlay {
  position: absolute;
  left: 0;
  right: 0;
  background: rgba(99, 102, 241, 0.15);
  border: 2px dashed rgba(99, 102, 241, 0.6);
  border-radius: var(--radius-md);
  pointer-events: none;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 4px;
}

.resize-preview-overlay .preview-duration {
  font-size: 11px;
  font-weight: 600;
  color: rgba(99, 102, 241, 0.9);
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

/* Ghost preview for drag operations - inline version */
.ghost-preview-inline {
  background: linear-gradient(
    135deg,
    var(--calendar-ghost-bg-start) 0%,
    var(--calendar-ghost-bg-end) 100%
  );
  backdrop-filter: blur(8px);
  border: 3px solid var(--calendar-ghost-border);
  border-radius: var(--radius-lg);
  pointer-events: none;
  animation: ghostPulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 25px rgba(99, 102, 241, 0.8), var(--calendar-ghost-shadow);
  margin: 2px 4px;
  padding: var(--space-2) var(--space-3);
  min-height: 24px;
  opacity: 0.95 !important;
  transform: scale(1.02);
}

/* Remove old absolute positioned calendar-event styles - these are obsolete */
/* .calendar-event { ... } styles are no longer used */

/* Keep these utility styles for timer active state */
.slot-task.timer-active-event {
  border: 2px solid var(--timer-active-border);
  background: linear-gradient(
    135deg,
    var(--timer-active-bg-start) 0%,
    var(--timer-active-bg-end) 100%
  );
  box-shadow:
    var(--timer-active-glow),
    var(--timer-active-shadow),
    inset 0 1px 0 var(--glass-border-hover);
  animation: timerPulse 2s ease-in-out infinite;
}

/* Dark minimalist scrollbar for calendar-main */
.calendar-main::-webkit-scrollbar {
  width: 6px;
}

.calendar-main::-webkit-scrollbar-track {
  background: transparent;
}

.calendar-main::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.calendar-main::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

.calendar-main {
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

.time-grid {
  position: relative;
  z-index: 5; /* Below events layer to allow drag interactions */
  /* Remove pointer-events: none to allow drag operations to reach time slots */
}

.time-slot {
  height: 30px;
  border-bottom: 1px solid var(--glass-bg-light);
  position: relative;
  z-index: 1; /* Below calendar events to allow drag and resize interactions */
  transition: all var(--duration-fast) var(--spring-smooth);
  cursor: crosshair; /* Indicate drop targets */
}

/* Empty slots still capture events for drag-drop */
.time-slot:empty,
.time-slot:not(:has(.slot-task)) {
  pointer-events: auto;
}

/* CRITICAL: Slots with tasks let events pass through to children */
.time-slot:has(.slot-task) {
  pointer-events: none;
}

/* Ensure task elements can receive events */
.time-slot:has(.slot-task) .slot-task {
  pointer-events: auto;
}

/* Allow pointer events for drag-drop operations */
.events-layer.drag-active .time-slot,
.slots-container.drag-active .time-slot {
  pointer-events: auto;
}

/* Override during drag operations to maintain drop functionality */
.time-slot.drag-over,
.time-slot.creating {
  pointer-events: auto !important;
  cursor: crosshair !important;
}

.time-slot:hover {
  background: linear-gradient(
    135deg,
    var(--calendar-hover-bg-medium) 0%,
    var(--calendar-hover-bg) 100%
  );
}

.time-slot.creating {
  background: linear-gradient(
    135deg,
    var(--calendar-creating-bg) 0%,
    var(--calendar-creating-bg-alt) 100%
  );
  border-color: var(--calendar-creating-border);
}

/* Drag-over visual feedback for drop zones */
.time-slot.drag-over {
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.3) 0%,
    rgba(79, 70, 229, 0.2) 100%
  );
  border: 3px solid var(--state-selected-border);
  border-style: solid;
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(99, 102, 241, 0.6), var(--state-selected-shadow), var(--state-selected-glow);
  z-index: 10;
}

/* Drag target indicator for better UX */
.events-layer.drag-active {
  pointer-events: auto;
}

.events-layer.drag-active .time-slot {
  position: relative;
}

.events-layer.drag-active .time-slot::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px dashed var(--state-selected-border);
  border-radius: var(--radius-lg);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--spring-smooth);
  pointer-events: none;
}

.events-layer.drag-active .time-slot.drag-over::before {
  opacity: 1;
}

.current-time-layer {
  position: absolute;
  inset: 0; /* RTL: full coverage layer */
  z-index: 50;
  pointer-events: none;
}

.time-indicator {
  height: 30px;
  pointer-events: none;
  position: relative;
  z-index: 50;
}

.time-indicator.current-time {
  height: 0;
  border-top: 2px solid var(--calendar-current-time-border);
  box-shadow: var(--calendar-current-time-glow);
}

.ghost-preview {
  position: absolute;
  z-index: 5;
  background: linear-gradient(
    135deg,
    var(--calendar-ghost-bg-start) 0%,
    var(--calendar-ghost-bg-end) 100%
  );
  backdrop-filter: blur(8px);
  border: 2px dashed var(--calendar-ghost-border);
  border-radius: var(--radius-lg);
  pointer-events: none;
  animation: ghostPulse 1.5s ease-in-out infinite;
  box-shadow: var(--calendar-ghost-shadow);
}

.ghost-content {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}

.ghost-title {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  opacity: 0.9;
  margin-bottom: var(--space-1);
}

.ghost-duration {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  opacity: 0.8;
}

@keyframes ghostPulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.9;
  }
}

.events-layer {
  position: absolute;
  top: 0;
  inset-inline: 0; /* RTL: full width events layer */
  z-index: 10;
  /* Remove pointer-events: none to allow drag operations on calendar events */
}

.calendar-event {
  position: absolute;
  z-index: 1;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  /* Dark solid background like kanban */
  background: var(--surface-tertiary);
  color: var(--text-primary);
  font-weight: var(--font-medium);
  overflow: visible;
  display: flex;
  flex-direction: column;
  transition: all var(--duration-normal) var(--spring-smooth);
  pointer-events: auto;
  box-shadow: var(--shadow-sm);
}

.calendar-event:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.calendar-event.selected {
  background: var(--state-selected-bg);
  border: 2px solid var(--state-selected-border);
  box-shadow: var(--state-selected-shadow), var(--state-selected-glow);
  z-index: 15;
}

/* Drag states for calendar events */
.calendar-event.dragging {
  opacity: 0.5;
  transform: scale(0.95);
  cursor: grabbing;
  border: 2px dashed var(--state-selected-border);
  background: var(--state-selected-bg);
  box-shadow: var(--state-selected-shadow), var(--state-selected-glow);
  z-index: 100;
  pointer-events: none; /* CRITICAL: Allow drops to pass through to time slots */
}

.calendar-event[draggable="true"]:hover {
  cursor: grab;
}

.calendar-event[draggable="true"]:active {
  cursor: grabbing;
}

/* Active pomodoro timer highlight */
.calendar-event.timer-active-event {
  border: 2px solid var(--timer-active-border);
  background: linear-gradient(
    135deg,
    var(--timer-active-bg-start) 0%,
    var(--timer-active-bg-end) 100%
  );
  box-shadow:
    var(--timer-active-glow),
    var(--timer-active-shadow),
    inset 0 1px 0 var(--glass-border-hover);
  animation: timerPulse 2s ease-in-out infinite;
}

@keyframes timerPulse {
  0%, 100% {
    box-shadow:
      var(--timer-active-glow),
      var(--timer-active-shadow),
      inset 0 1px 0 var(--glass-border-hover);
  }
  50% {
    box-shadow:
      var(--timer-active-glow-strong),
      var(--timer-active-shadow-hover),
      inset 0 1px 0 var(--border-hover);
  }
}

.calendar-event.multi-slot {
  min-height: 60px;
}

/* Project stripe - matching kanban/inbox pattern */
.calendar-event .project-stripe {
  position: absolute;
  top: 0;
  inset-inline-start: 0; /* RTL: project stripe position */
  width: 4px;
  height: 100%;
  border-start-start-radius: var(--radius-sm); /* RTL: top-left in LTR, top-right in RTL */
  border-end-start-radius: var(--radius-sm); /* RTL: bottom-left in LTR, bottom-right in RTL */
  z-index: 2; /* Above priority stripe */
}

.calendar-event .project-emoji-stripe {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
  width: 16px; /* Wider for emoji */
  opacity: 0.9;
}

.calendar-event .project-color-stripe {
  opacity: 0.9;
}

/* Priority stripe - matching kanban/inbox pattern */
.calendar-event .priority-stripe {
  position: absolute;
  top: 0;
  inset-inline-start: 4px; /* RTL: offset to the right of project stripe */
  width: 4px;
  height: 100%;
  border-start-end-radius: var(--radius-sm); /* RTL: top-right in LTR, top-left in RTL */
  border-end-end-radius: var(--radius-sm); /* RTL: bottom-right in LTR, bottom-left in RTL */
  z-index: 1;
}

.calendar-event .priority-stripe.priority-high {
  background: linear-gradient(180deg, var(--color-priority-high) 0%, #ff6b6b 100%);
  box-shadow: 0 0 8px rgba(255, 107, 107, 0.3);
}

.calendar-event .priority-stripe.priority-medium {
  background: var(--color-priority-medium);
  box-shadow: var(--priority-medium-glow);
}

.calendar-event .priority-stripe.priority-low {
  background: linear-gradient(180deg, var(--color-priority-low) 0%, #48dbfb 100%);
  box-shadow: 0 0 8px rgba(72, 219, 251, 0.3);
}

/* 30-minute tasks: horizontal layout */
.calendar-event[data-duration="30"] .event-content {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 2px var(--space-2);
}

.calendar-event[data-duration="30"] .event-title {
  margin-bottom: 0;
  margin-inline-end: var(--space-1); /* RTL: title spacing */
  font-size: 10px;
}

.event-content {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  cursor: move;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2px;
}

.event-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.remove-from-calendar-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  opacity: 0;
  transition: all var(--duration-fast) ease;
  line-height: 1;
}

.calendar-event:hover .remove-from-calendar-btn {
  opacity: 1;
}

.remove-from-calendar-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
  transform: scale(1.1);
}

.status-indicator {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
  margin-inline-start: var(--space-1); /* RTL: status indicator spacing */
}

.status-indicator:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--brand-primary);
  transform: scale(1.1);
}

.status-indicator.status-planned {
  background: var(--brand-primary-bg-subtle);
  border-color: var(--brand-primary-border-medium);
  color: var(--brand-primary);
}

.status-indicator.status-in_progress {
  background: var(--color-priority-medium-bg-subtle);
  border-color: var(--color-priority-medium-border-medium);
  color: var(--color-priority-medium);
}

.status-indicator.status-done {
  background: var(--color-work-bg-subtle);
  border-color: var(--color-work-border-medium);
  color: var(--color-work);
}

.status-indicator.status-backlog,
.status-indicator.status-on_hold {
  background: var(--glass-bg-tint);
  border-color: var(--glass-bg-heavy);
  color: var(--text-muted);
}

.event-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  line-height: 1.3;
  margin-bottom: 2px;
  word-wrap: break-word;
  overflow: visible;
}

.event-duration {
  font-size: var(--text-xs);
  opacity: 0.8;
}

/* Week View Styles */
.week-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.week-header {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--glass-bg-heavy);
  min-height: 80px;
  flex-shrink: 0;
  box-shadow: var(--shadow-md);
}

.week-time-label {
  background: linear-gradient(
    135deg,
    var(--glass-bg-tint) 0%,
    var(--glass-bg-weak) 100%
  );
}

.week-day-header {
  padding: var(--space-4);
  text-align: center;
  border-inline-start: 1px solid var(--glass-border-light); /* RTL: day header border */
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.week-day-header:hover {
  background: var(--glass-bg-tint);
}

.week-day-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: var(--space-1);
}

.week-day-date {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.week-grid-container {
  flex: 1;
  display: grid;
  grid-template-columns: 80px 1fr;
  overflow: hidden;
}

.week-time-labels {
  background: var(--bg-secondary);
  border-inline-end: 1px solid var(--border-primary); /* RTL: week time labels border */
  overflow: hidden;
}

.week-time-label {
  height: 60px;
  display: flex;
  align-items: flex-start;
  justify-content: end; /* RTL: align time labels to end */
  padding-top: 0.25rem;
  padding-inline-end: 0.5rem; /* RTL: week time label padding */
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-bottom: 1px solid var(--border-primary);
}

.week-days-grid {
  position: relative;
  overflow-y: auto;
  background: var(--surface-primary);
}

/* Custom minimalist scrollbar for week view */
.week-days-grid::-webkit-scrollbar {
  width: 6px;
}

.week-days-grid::-webkit-scrollbar-track {
  background: transparent;
}

.week-days-grid::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.week-days-grid::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

.week-days-grid {
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

.week-time-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  position: relative;
  z-index: 1;
  pointer-events: none;
}

.week-time-grid > * {
  pointer-events: auto;
}

.week-day-column {
  border-inline-start: 1px solid var(--border-primary); /* RTL: week day column border */
}

.week-day-column:first-child {
  border-inline-start: none; /* RTL: remove first column border */
}

.week-time-cell {
  height: 60px;
  border-bottom: 1px solid var(--border-primary);
  transition: all var(--transition-fast);
}

.week-time-cell:hover {
  background: var(--week-hover-bg);
}

.week-events-layer {
  position: absolute;
  top: 0;
  inset-inline: 0; /* RTL: full width week events layer */
  z-index: 10;
  pointer-events: none;
}

.week-current-time-layer {
  position: absolute;
  inset: 0; /* RTL: full coverage week current time layer */
  z-index: 50;
  pointer-events: none;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.week-day-time-column {
  display: flex;
  flex-direction: column;
  position: relative;
}

.week-time-indicator {
  height: 60px;
  pointer-events: none;
  position: relative;
  z-index: 50;
}

.week-time-indicator.current-time {
  height: 0;
  border-top: 2px solid var(--calendar-current-time-border);
  box-shadow: var(--calendar-current-time-glow);
}

.week-event {
  position: relative;
  z-index: 1;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  /* Dark solid background like kanban */
  background: var(--surface-tertiary);
  color: var(--text-primary);
  font-weight: var(--font-medium);
  padding: 2px var(--space-2);
  overflow: hidden;
  transition: all var(--duration-normal) var(--spring-smooth);
  pointer-events: auto;
  cursor: move;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.week-event:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.week-event.selected {
  background: var(--state-selected-bg);
  border: 2px solid var(--state-selected-border);
  box-shadow: var(--state-selected-shadow), var(--state-selected-glow);
  z-index: 15;
}

/* Project stripe for week events */
.week-event .project-stripe {
  position: absolute;
  top: 0;
  inset-inline-start: 0; /* RTL: week event project stripe position */
  width: 4px;
  height: 100%;
  border-start-start-radius: var(--radius-sm); /* RTL: top-left in LTR, top-right in RTL */
  border-end-start-radius: var(--radius-sm); /* RTL: bottom-left in LTR, bottom-right in RTL */
  z-index: 2; /* Above priority stripe */
}

.week-event .project-emoji-stripe {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
  width: 16px; /* Wider for emoji */
  opacity: 0.9;
}

.week-event .project-color-stripe {
  opacity: 0.9;
}

/* Priority stripe for week events */
.week-event .priority-stripe {
  position: absolute;
  top: 0;
  inset-inline-start: 4px; /* RTL: offset to the right of project stripe */
  width: 4px;
  height: 100%;
  border-start-end-radius: var(--radius-sm); /* RTL: top-right in LTR, top-left in RTL */
  border-end-end-radius: var(--radius-sm); /* RTL: bottom-right in LTR, bottom-left in RTL */
  z-index: 1;
}

.week-event .priority-stripe.priority-high {
  background: linear-gradient(180deg, var(--color-priority-high) 0%, #ff6b6b 100%);
  box-shadow: 0 0 8px rgba(255, 107, 107, 0.3);
}

.week-event .priority-stripe.priority-medium {
  background: var(--color-priority-medium);
  box-shadow: var(--priority-medium-glow);
}

.week-event .priority-stripe.priority-low {
  background: linear-gradient(180deg, var(--color-priority-low) 0%, #48dbfb 100%);
  box-shadow: 0 0 8px rgba(72, 219, 251, 0.3);
}

/* Week view active pomodoro highlight */
.week-event.timer-active-event {
  border: 2px solid var(--timer-active-border);
  background: linear-gradient(
    135deg,
    var(--timer-active-bg-start) 0%,
    var(--timer-active-bg-end) 100%
  );
  box-shadow:
    var(--timer-active-glow),
    var(--shadow-md),
    inset 0 1px 0 var(--border-medium);
  animation: timerPulse 2s ease-in-out infinite;
}

.week-event .event-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  line-height: 1.3;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.week-event .event-duration {
  font-size: var(--text-xs);
  opacity: 0.8;
}

.week-event .event-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0;
}

.week-event .event-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2px;
}

.week-event .event-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.week-event .remove-from-calendar-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  opacity: 0;
  transition: all var(--duration-fast) ease;
  line-height: 1;
}

.week-event:hover .remove-from-calendar-btn {
  opacity: 1;
}

.week-event .status-indicator {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
  margin-inline-start: var(--space-2); /* RTL: week event status indicator spacing */
}

.week-event .status-indicator:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--brand-primary);
  transform: scale(1.1);
}

.week-event .status-indicator.status-planned {
  background: var(--brand-primary-bg-subtle);
  border-color: var(--brand-primary-border-medium);
  color: var(--brand-primary);
}

.week-event .status-indicator.status-in_progress {
  background: var(--color-priority-medium-bg-subtle);
  border-color: var(--color-priority-medium-border-medium);
  color: var(--color-priority-medium);
}

.week-event .status-indicator.status-done {
  background: var(--color-work-bg-subtle);
  border-color: var(--color-work-border-medium);
  color: var(--color-work);
}

.week-event .status-indicator.status-backlog,
.week-event .status-indicator.status-on_hold {
  background: var(--glass-bg-tint);
  border-color: var(--glass-bg-heavy);
  color: var(--text-muted);
}

/* Week view resize handles */
.week-event .resize-handle {
  position: absolute;
  inset-inline: 0; /* RTL: full width resize handle */
  height: 24px;
  background: transparent;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  z-index: 20;
  opacity: 0;
  pointer-events: auto;
}

.week-event:hover .resize-handle {
  opacity: 1;
  pointer-events: auto;
}

.week-event .resize-handle.resize-top {
  top: -12px;
}

.week-event .resize-handle.resize-bottom {
  bottom: -12px;
}

.week-event .resize-handle:hover {
  background: var(--glass-border);
}

.week-event .resize-handle::after {
  content: '';
  width: 24px;
  height: 3px;
  background: var(--glass-handle);
  border-radius: var(--radius-xs);
  transition: all var(--transition-fast);
}

.week-event .resize-handle:hover::after {
  background: var(--brand-primary);
  height: 4px;
  width: 32px;
}

/* 30-minute tasks in week view */
.week-event[data-duration="30"] .resize-handle {
  height: 8px;
}

.week-event[data-duration="30"] .resize-handle.resize-top {
  top: 0;
}

.week-event[data-duration="30"] .resize-handle.resize-bottom {
  bottom: 0;
}

.week-event[data-duration="30"] .event-content {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0;
}

.week-event[data-duration="30"] .event-title {
  margin-bottom: 0;
  margin-inline-end: var(--space-2); /* RTL: week event title spacing */
  flex: 1;
}

/* Month View Styles */
.month-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  flex: 1;
  gap: 1px;
  background: var(--border-primary);
}

.month-day-cell {
  background: linear-gradient(
    135deg,
    var(--glass-bg-light) 0%,
    var(--glass-bg-subtle) 100%
  );
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  min-height: 100px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  overflow: hidden;
}

.month-day-cell:hover {
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  backdrop-filter: blur(8px);
}

.month-day-cell.other-month {
  background: var(--glass-bg-subtle);
  opacity: 0.4;
}

.month-day-cell.today {
  background: linear-gradient(
    135deg,
    var(--calendar-today-bg-start) 0%,
    var(--calendar-today-bg-end) 100%
  );
  border: 1px solid var(--calendar-today-border);
  box-shadow: var(--calendar-today-glow);
}

.month-day-cell.today .day-number {
  background: linear-gradient(
    135deg,
    var(--calendar-today-badge-start) 0%,
    var(--calendar-today-badge-end) 100%
  );
  color: white;
  border-radius: var(--radius-full);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--calendar-today-badge-shadow);
}

.day-number {
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.month-event {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: move;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  gap: var(--space-1);
  align-items: center;
  transition: all var(--duration-fast) var(--spring-smooth);
  border: 1px solid var(--glass-border-medium);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-sm);
}

.month-event:hover {
  border-color: var(--glass-border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
  background: linear-gradient(
    135deg,
    var(--border-medium) 0%,
    var(--glass-bg-soft) 100%
  );
}

/* Project indicator for month events */
.month-event .project-indicator {
  position: absolute;
  top: 0;
  inset-inline-start: 0; /* RTL: month event project indicator position */
  width: 3px;
  height: 100%;
  border-start-start-radius: var(--radius-sm); /* RTL: top-left in LTR, top-right in RTL */
  border-end-start-radius: var(--radius-sm); /* RTL: bottom-left in LTR, bottom-right in RTL */
  z-index: 2; /* Above priority stripe */
}

.month-event .project-emoji-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
  width: 12px; /* Wider for emoji */
  opacity: 0.9;
}

.month-event .project-color-indicator {
  opacity: 0.9;
}

/* Priority stripe for month events */
.month-event .priority-stripe {
  position: absolute;
  top: 0;
  inset-inline-start: 3px; /* RTL: offset to the right of project indicator */
  width: 3px;
  height: 100%;
  border-start-end-radius: var(--radius-sm); /* RTL: top-right in LTR, top-left in RTL */
  border-end-end-radius: var(--radius-sm); /* RTL: bottom-right in LTR, bottom-left in RTL */
  z-index: 1;
}

.month-event .priority-stripe.priority-high {
  background: linear-gradient(180deg, var(--color-priority-high) 0%, #ff6b6b 100%);
}

.month-event .priority-stripe.priority-medium {
  background: var(--color-priority-medium);
}

.month-event .priority-stripe.priority-low {
  background: linear-gradient(180deg, var(--color-priority-low) 0%, #48dbfb 100%);
}

/* Month view active pomodoro highlight */
.month-event.timer-active-event {
  border: 2px solid var(--timer-active-border);
  background: linear-gradient(
    135deg,
    var(--timer-active-month-bg-start) 0%,
    var(--timer-active-month-bg-end) 100%
  );
  box-shadow:
    var(--timer-active-month-glow),
    var(--shadow-md);
  animation: timerPulse 2s ease-in-out infinite;
  font-weight: var(--font-semibold);
}

.event-time {
  font-weight: var(--font-medium);
  opacity: 0.9;
}

.event-title-short {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>