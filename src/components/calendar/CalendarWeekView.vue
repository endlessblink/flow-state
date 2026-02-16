<script setup lang="ts">
import { ref, computed, inject, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { WeekEvent, DragGhost } from '@/types/tasks'
import type { TimeSlot } from '@/composables/calendar/useCalendarDayView'
import type { ExternalCalendarEvent } from '@/composables/calendar/useExternalCalendar'
import { truncateUrlsInText } from '@/utils/urlTruncate'

const props = defineProps<{
  weekDays: any[]
  workingHours: number[]
  weekEvents: WeekEvent[]
  currentTaskId?: string | null
  // Same props as CalendarDayView for drag/resize visual feedback
  dragGhost: DragGhost
  isDragging: boolean
  draggedEventId: string | null
  resizePreview?: {
    isResizing: boolean
    taskId: string | null
    previewDuration: number
    direction: 'top' | 'bottom'
  } | null
  externalEvents?: ExternalCalendarEvent[]
}>()

// Same emit signatures as CalendarDayView — uses TimeSlot for drop targets
defineEmits<{
  (e: 'dragover', event: DragEvent, slot: TimeSlot): void
  (e: 'dragenter', event: DragEvent, slot: TimeSlot): void
  (e: 'dragleave'): void
  (e: 'drop', event: DragEvent, slot: TimeSlot): void
  (e: 'eventDragStart', event: DragEvent, weekEvent: WeekEvent): void
  (e: 'eventDragEnd', event: DragEvent, weekEvent: WeekEvent): void
  (e: 'eventClick', event: MouseEvent, weekEvent: WeekEvent): void
  (e: 'eventDblClick', weekEvent: WeekEvent): void
  (e: 'eventContextMenu', event: MouseEvent, weekEvent: WeekEvent): void
  (e: 'cycleStatus', event: MouseEvent, weekEvent: WeekEvent): void
  (e: 'removeFromCalendar', weekEvent: WeekEvent): void
  (e: 'startTimer', weekEvent: WeekEvent): void
  (e: 'startResize', event: MouseEvent, weekEvent: WeekEvent, direction: 'top' | 'bottom'): void
  (e: 'cellDblClick', dateString: string, hour: number): void
}>()

// Inject helpers from parent CalendarView
const helpers = inject('calendar-helpers') as any
const {
  formatHour,
  formatEventTime,
  isCurrentWeekTimeCell,
  getPriorityClass,
  getTaskStatus,
  getStatusIcon,
  getStatusLabel
} = helpers

// TASK-1322: Tooltip with task description
const taskStore = useTaskStore()

const getEventTooltip = (event: any) => {
  const task = taskStore.getTask(event.taskId)
  const lines = [event.title]
  if (task?.description) {
    const plain = task.description.replace(/<[^>]*>/g, '').trim()
    if (plain) lines.push(plain.substring(0, 200))
  }
  const time = formatEventTime(event)
  if (time) lines.unshift(`🕐 ${time}`)
  const status = getStatusLabel(getTaskStatus(event))
  if (status) lines.push(`Status: ${status}`)
  return lines.join('\n')
}

// Local drag cell tracking for ghost preview positioning
const activeDragCell = ref<{ dayIndex: number; hour: number } | null>(null)

// BUG-1340: Clear activeDragCell when drag ends to prevent stuck ghost previews.
// Without this, dragging outside the calendar leaves activeDragCell set (only cleared on drop).
watch(() => props.isDragging, (dragging) => {
  if (!dragging) {
    activeDragCell.value = null
  }
})

// Create a TimeSlot from week cell data — same shape as day view slots
const createSlot = (dateString: string, hour: number): TimeSlot => ({
  id: `${dateString}-${hour}-0`,
  hour,
  minute: 0,
  slotIndex: hour * 2,
  date: dateString
})

// Group events by their starting cell for in-cell rendering (like day view)
const eventsByCell = computed(() => {
  const map = new Map<string, WeekEvent[]>()
  for (const event of props.weekEvents) {
    const startHour = Math.floor(event.startSlot / 2) + 6
    const key = `${event.dayIndex}-${startHour}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(event)
  }
  return map
})

const getEventsForCell = (dayIndex: number, hour: number): WeekEvent[] => {
  return eventsByCell.value.get(`${dayIndex}-${hour}`) || []
}

// TASK-1317: External events grouped by cell
const externalEventsByCell = computed(() => {
  const map = new Map<string, ExternalCalendarEvent[]>()
  if (!props.externalEvents?.length) return map
  for (const event of props.externalEvents) {
    const d = event.startTime
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dayIndex = props.weekDays.findIndex((day: any) => day.dateString === dateString)
    if (dayIndex === -1) continue
    const hour = d.getHours()
    const key = `${dayIndex}-${hour}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(event)
  }
  return map
})

// Absolute positioning for time-spanning blocks (like Google Calendar)
// Overlapping events split into side-by-side columns using event.column / event.totalColumns
const HALF_HOUR_HEIGHT = 30
const getWeekEventCellStyle = (event: WeekEvent) => {
  const topOffset = (event.startSlot % 2) * HALF_HOUR_HEIGHT
  const height = event.slotSpan * HALF_HOUR_HEIGHT
  if (event.totalColumns > 1) {
    const widthPercent = 100 / event.totalColumns
    const leftPercent = widthPercent * event.column
    return {
      position: 'absolute' as const,
      top: `${topOffset}px`,
      height: `${height}px`,
      width: `calc(${widthPercent}% - 4px)`,
      left: `calc(${leftPercent}% + 2px)`,
      zIndex: 10 + event.column
    }
  }
  return {
    position: 'absolute' as const,
    top: `${topOffset}px`,
    height: `${height}px`,
    left: '2px',
    right: '2px',
    zIndex: 10
  }
}

</script>

<template>
  <div class="week-view">
    <!-- Week Header -->
    <div class="week-header">
      <div class="week-time-label" />
      <div
        v-for="(day, index) in weekDays"
        :key="index"
        class="week-day-header"
      >
        <div class="week-day-name">
          {{ day.dayName }}
        </div>
        <div class="week-day-date">
          {{ day.date }}
        </div>
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
        <div class="week-time-grid">
          <div
            v-for="(day, dayIndex) in weekDays"
            :key="`col-${dayIndex}`"
            class="week-day-column"
          >
            <div
              v-for="hour in workingHours"
              :key="`${dayIndex}-${hour}`"
              class="week-time-cell"
              :class="{
                'current-time': isCurrentWeekTimeCell(day.dateString, hour),
                'drag-over': activeDragCell?.dayIndex === dayIndex && activeDragCell?.hour === hour
              }"
              @dragover.prevent="activeDragCell = { dayIndex, hour }; $emit('dragover', $event, createSlot(day.dateString, hour))"
              @dragenter.prevent="activeDragCell = { dayIndex, hour }; $emit('dragenter', $event, createSlot(day.dateString, hour))"
              @dragleave="$emit('dragleave')"
              @drop.prevent="activeDragCell = null; $emit('drop', $event, createSlot(day.dateString, hour))"
              @dblclick.self="$emit('cellDblClick', day.dateString, hour)"
            >
              <!-- Ghost Preview (during inbox drag) — same as day view -->
              <div
                v-if="dragGhost.visible && activeDragCell?.dayIndex === dayIndex && activeDragCell?.hour === hour"
                class="ghost-preview-inline"
                :style="{
                  position: 'absolute',
                  top: '0',
                  height: `${Math.ceil(dragGhost.duration / 30) * 30}px`,
                  left: '2px',
                  right: '2px',
                  zIndex: 40
                }"
              >
                <div class="ghost-content">
                  <span class="ghost-title">{{ dragGhost.title }}</span>
                  <span class="ghost-duration">{{ dragGhost.duration }}min</span>
                </div>
              </div>

              <!-- Week events as absolute-positioned time-spanning blocks -->
              <div
                v-for="event in getEventsForCell(dayIndex, hour)"
                :key="event.id"
                class="week-event"
                :class="{
                  'timer-active-event': currentTaskId === event.taskId,
                  'dragging': isDragging && draggedEventId === event.id,
                  'status-done': getTaskStatus(event) === 'done'
                }"
                :style="{ ...getWeekEventCellStyle(event), backgroundColor: event.color }"
                :title="getEventTooltip(event)"
                draggable="true"
                @dragstart="$emit('eventDragStart', $event, event)"
                @dragend="$emit('eventDragEnd', $event, event)"
                @click.stop="$emit('eventClick', $event, event)"
                @dblclick.stop="$emit('eventDblClick', event)"
                @contextmenu.prevent.stop="$emit('eventContextMenu', $event, event)"
              >
                <!-- Priority Stripe -->
                <div
                  class="priority-stripe"
                  :class="`priority-${getPriorityClass(event)}`"
                />

                <!-- Event Content — optimized for narrow columns -->
                <div class="event-content">
                  <span class="event-time">{{ formatEventTime(event) }}</span>
                  <span class="event-title" dir="auto">
                    {{ getStatusIcon(getTaskStatus(event)) }} {{ truncateUrlsInText(event.title) }}
                  </span>
                </div>

                <!-- Resize handle (bottom edge) — drag to change duration -->
                <div
                  class="resize-handle resize-handle-bottom"
                  title="Drag to change duration"
                  @mousedown.stop.prevent="$emit('startResize', $event, event, 'bottom')"
                />

                <!-- Resize Preview Overlay — shows new size during drag -->
                <div
                  v-if="resizePreview?.isResizing && resizePreview.taskId === event.taskId"
                  class="resize-preview-overlay"
                  :style="{
                    height: `${Math.ceil(resizePreview.previewDuration / 30) * 30}px`,
                    top: '0'
                  }"
                >
                  <span class="preview-duration">{{ resizePreview.previewDuration }}min</span>
                </div>
              </div>

              <!-- TASK-1317: External calendar events in this cell -->
              <div
                v-for="ext in (externalEventsByCell.get(`${dayIndex}-${hour}`) || [])"
                :key="`ext-${ext.id}`"
                class="week-event week-event--external"
                :style="{
                  position: 'absolute',
                  top: `${(ext.startTime.getMinutes() >= 30 ? 30 : 0)}px`,
                  height: `${Math.max(20, Math.ceil((ext.endTime.getTime() - ext.startTime.getTime()) / 60000 / 30) * 30)}px`,
                  right: '2px',
                  width: '35%',
                  borderColor: ext.color,
                  backgroundColor: ext.color + '20'
                }"
                :title="`${ext.title}${ext.location ? '\n📍 ' + ext.location : ''}`"
              >
                <span class="external-event-title" dir="auto">{{ ext.title }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.week-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.week-header {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  background: var(--glass-panel-bg);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 20;
}

.week-time-label {
  padding: var(--space-2) var(--space-4);
}

.week-day-header {
  padding: var(--space-3) var(--space-2);
  text-align: center;
  border-left: 1px solid var(--glass-border-light);
}

.week-day-name {
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: var(--space-0_5);
}

.week-day-date {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.week-grid-container {
  flex: 1;
  display: grid;
  grid-template-columns: 80px 1fr;
  overflow-y: auto;
  position: relative;
}

.week-time-labels {
  background: var(--glass-bg-subtle);
  border-right: 1px solid var(--border-subtle);
}

.week-time-label {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-xs);
  border-bottom: 1px solid var(--glass-border-light);
}

.week-days-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
}

.week-time-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  height: 100%;
}

.week-day-column {
  border-left: 1px solid var(--glass-border-light);
}

/* Cell — overflow visible so blocks can extend beyond cell boundaries */
.week-time-cell {
  height: 60px;
  border-bottom: 1px solid var(--glass-border-light);
  position: relative;
  overflow: visible;
  transition: background var(--duration-fast);
}

.week-time-cell:hover {
  background: var(--glass-bg-tint);
}

.week-time-cell.drag-over {
  background: var(--glass-bg-soft);
  border-color: var(--accent-primary);
}

.week-time-cell.current-time {
  background: rgba(239, 68, 68, 0.05);
  box-shadow: inset 0 -2px 0 var(--color-danger);
}

/* Week event — absolute-positioned time-spanning block (like Google Calendar) */
.week-event {
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: white;
  cursor: grab;
  overflow: hidden;
  transition: filter var(--duration-fast), opacity var(--duration-fast);
}

.week-event:hover {
  filter: brightness(1.1);
}

.week-event.dragging {
  opacity: 0.35 !important;
  transform: scale(0.95);
  cursor: grabbing;
}

/* Event content — column layout, time at top, title below */
.event-content {
  padding: 2px 4px 2px 6px;
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  overflow: hidden;
}

/* Time — bold, always visible at top of block */
.event-time {
  font-weight: var(--font-bold);
  opacity: 0.9;
  font-size: 0.6rem;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.4;
}

/* Title — aggressive truncation for narrow 1/7th columns */
.event-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  line-height: 1.2;
  font-size: 0.65rem;
}

/* Priority stripe — thin left edge */
.priority-stripe {
  width: 3px;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

/* Resize handle — appears on hover at bottom edge of event block */
.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.resize-handle-bottom {
  bottom: 0;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  background: rgba(255, 255, 255, 0.3);
}

.week-event:hover .resize-handle {
  opacity: 1;
}

/* Resize preview overlay — dashed outline showing new size during drag */
.resize-preview-overlay {
  position: absolute;
  left: 0;
  right: 0;
  background: rgba(99, 102, 241, 0.12);
  border: 2px dashed rgba(99, 102, 241, 0.6);
  border-radius: var(--radius-sm);
  pointer-events: none;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 2px;
}

.resize-preview-overlay .preview-duration {
  font-size: 10px;
  font-weight: 600;
  color: rgba(99, 102, 241, 0.9);
  background: rgba(255, 255, 255, 0.9);
  padding: 1px var(--space-1);
  border-radius: var(--radius-sm);
  line-height: 1.3;
}

/* Ghost preview — IDENTICAL to day view */
.ghost-preview-inline {
  background: linear-gradient(135deg, var(--calendar-ghost-bg-start) 0%, var(--calendar-ghost-bg-end) 100%);
  backdrop-filter: blur(8px);
  border: 3px solid var(--calendar-ghost-border);
  border-radius: var(--radius-lg);
  pointer-events: none;
  z-index: 40;
}

.ghost-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  gap: var(--space-1);
}

.ghost-title {
  font-weight: 700;
  font-size: var(--text-xs);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  padding: 0 var(--space-1);
}

.ghost-duration {
  font-size: var(--text-xs);
  font-weight: 500;
  opacity: 0.9;
  background: var(--border-hover);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-lg);
}

/* Timer active glow */
.week-event.timer-active-event {
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  animation: timer-pulse 2s ease-in-out infinite;
}

@keyframes timer-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

/* BUG-1304: Visual indicator for done tasks */
.week-event.status-done {
  filter: grayscale(0.6) brightness(0.85);
  opacity: 0.55;
}

/* TASK-1317: External calendar events */
.week-event--external {
  background: transparent !important;
  border: 1px solid;
  color: var(--text-secondary) !important;
  cursor: default;
  padding-left: var(--space-1);
}

.week-event--external:hover {
  filter: brightness(1.1);
}

.week-event--external .external-event-title {
  font-size: 10px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 4px;
}
</style>
