<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import type { WeekEvent, DragGhost } from '@/types/tasks'
import type { TimeSlot } from '@/composables/calendar/useCalendarDayView'

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
}>()

// Inject helpers from parent CalendarView
const helpers = inject('calendar-helpers') as any
const {
  formatHour,
  formatEventTime,
  isCurrentWeekTimeCell,
  getProjectVisual,
  getProjectName,
  getProjectColor,
  getPriorityClass,
  getPriorityLabel,
  getTaskStatus,
  getStatusIcon
} = helpers

// Local drag cell tracking for ghost preview positioning
const activeDragCell = ref<{ dayIndex: number; hour: number } | null>(null)

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

// Position event within its cell (like day view's getSlotTaskStyle)
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

              <!-- Events inside cell (same pattern as day view: events are children of slots) -->
              <div
                v-for="event in getEventsForCell(dayIndex, hour)"
                :key="event.id"
                class="week-event"
                :style="getWeekEventCellStyle(event)"
                :class="{
                  'multi-slot': event.slotSpan > 1,
                  'timer-active-event': currentTaskId === event.taskId,
                  'dragging': isDragging && draggedEventId === event.id,
                  'status-done': getTaskStatus(event) === 'done'
                }"
                draggable="true"
                @dragstart="$emit('eventDragStart', $event, event)"
                @dragend="$emit('eventDragEnd', $event, event)"
                @click="$emit('eventClick', $event, event)"
                @dblclick="$emit('eventDblClick', event)"
                @contextmenu.prevent="$emit('eventContextMenu', $event, event)"
              >
                <!-- Project Stripe -->
                <div
                  v-if="getProjectVisual(event).type === 'emoji'"
                  class="project-stripe project-emoji-stripe"
                  :title="`Project: ${getProjectName(event)}`"
                >
                  <ProjectEmojiIcon
                    :emoji="getProjectVisual(event).content"
                    size="xs"
                    class="project-emoji"
                  />
                </div>
                <div
                  v-else
                  class="project-stripe project-color-stripe"
                  :style="{ backgroundColor: getProjectColor(event) }"
                  :title="`Project: ${getProjectName(event)}`"
                />

                <!-- Priority Stripe -->
                <div
                  class="priority-stripe"
                  :class="`priority-${getPriorityClass(event)}`"
                  :title="`Priority: ${getPriorityLabel(event)}`"
                />

                <!-- Event Content -->
                <div class="event-content" dir="auto">
                  <div class="event-title" :title="event.title">
                    {{ event.title }}
                  </div>
                  <div v-if="formatEventTime(event)" class="event-meta">
                    <span class="event-time">{{ formatEventTime(event) }}</span>
                    <span class="event-duration">{{ event.duration }}min</span>
                  </div>
                </div>

                <!-- Resize Handles (same position as day view — after content) -->
                <div
                  class="resize-handle resize-top"
                  title="Drag to change start time"
                  @mousedown.stop="$emit('startResize', $event, event, 'top')"
                />
                <div
                  class="resize-handle resize-bottom"
                  title="Drag to change duration"
                  @mousedown.stop="$emit('startResize', $event, event, 'bottom')"
                />

                <!-- Resize Preview (same as day view) -->
                <div
                  v-if="resizePreview?.isResizing && resizePreview.taskId === event.taskId"
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

/* Week event — matches day view .slot-task styling (NO overflow: hidden) */
.week-event {
  position: absolute;
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-left: 4px solid var(--accent-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-1) var(--space-2);
  padding-left: calc(var(--space-2) - 2px);
  font-size: var(--text-xs);
  box-shadow: var(--shadow-sm);
  cursor: grab;
  z-index: 5;
  transition: all var(--duration-normal) var(--spring-smooth);
  pointer-events: auto;
  min-height: 24px;
}

.week-event:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  border-left-color: var(--accent-primary);
  border-left-width: 4px;
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
  z-index: 15;
}

.week-event.dragging {
  opacity: 0.4;
  cursor: grabbing;
}

.event-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.event-title {
  font-weight: var(--font-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
}

.event-time {
  opacity: 0.8;
}

.event-time::after {
  content: " · ";
  opacity: 0.5;
}

.event-duration {
  font-weight: var(--font-medium);
}

.project-stripe {
  width: 3px;
  border-radius: var(--radius-xs);
  height: calc(100% - 8px);
  position: absolute;
  left: 2px;
  top: var(--space-1);
}

.project-emoji-stripe {
  display: none;
}

.priority-stripe {
  width: 2px;
  border-radius: 1px;
  height: calc(100% - 12px);
  position: absolute;
  left: 0;
  top: var(--space-1_5);
}

/* Resize handles — IDENTICAL to day view (CalendarDayView.vue) */
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
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.resize-handle.resize-bottom {
  bottom: 0;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.week-event:hover .resize-handle {
  opacity: 1 !important;
  pointer-events: auto !important;
  background: rgba(99, 102, 241, 0.4) !important;
  transition: none !important;
}

/* Resize preview — IDENTICAL to day view */
.resize-preview-overlay {
  position: absolute;
  left: 0;
  right: 0;
  background: var(--color-indigo-bg-medium);
  border: 2px dashed rgba(99, 102, 241, 0.6);
  border-radius: var(--radius-md);
  pointer-events: none;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: var(--space-1);
}

.resize-preview-overlay .preview-duration {
  font-size: var(--text-xs);
  font-weight: 600;
  color: rgba(99, 102, 241, 0.9);
  background: rgba(255, 255, 255, 0.9);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
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
  border-color: var(--timer-active-border);
  box-shadow: var(--timer-active-glow), var(--timer-active-shadow);
  animation: timer-pulse 2s ease-in-out infinite;
}

@keyframes timer-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

/* BUG-1304: Visual indicator for done tasks — low opacity only, no strikethrough */
.week-event.status-done {
  filter: grayscale(0.6) brightness(0.85);
  opacity: 0.55;
}
</style>
