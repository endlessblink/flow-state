<script setup lang="ts">
import { ref, inject, computed } from 'vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import { useCalendarCore } from '@/composables/useCalendarCore'
import { useTaskStore } from '@/stores/tasks'
import type { CalendarEvent } from '@/types/tasks'
import type { MonthDay } from '@/composables/calendar/useCalendarMonthView'
import type { ExternalCalendarEvent } from '@/composables/calendar/useExternalCalendar'
import { truncateUrlsInText } from '@/utils/urlTruncate'

const props = defineProps<{
  monthDays: MonthDay[]
  currentTaskId?: string | null
  selectedEventIds?: Set<string>
  externalEvents?: ExternalCalendarEvent[]
}>()
const emit = defineEmits<{
  (e: 'monthDrop', event: DragEvent, dateString: string): void
  (e: 'monthDayClick', dateString: string): void
  (e: 'eventDragStart', event: DragEvent, calEvent: CalendarEvent): void
  (e: 'eventDragEnd', event: DragEvent): void
  (e: 'eventClick', event: MouseEvent, calEvent: CalendarEvent): void
  (e: 'eventDblClick', calEvent: CalendarEvent): void
  (e: 'eventContextMenu', event: MouseEvent, calEvent: CalendarEvent): void
  (e: 'cycleStatus', event: MouseEvent, calEvent: CalendarEvent): void
  (e: 'cellDblClick', dateString: string): void
}>()

// Local drag state for visual feedback
const activeDragDay = ref<string | null>(null)
const draggedEventId = ref<string | null>(null)

const handleCellDragEnter = (dateString: string) => {
  activeDragDay.value = dateString
}

const handleCellDragLeave = (event: DragEvent, dateString: string) => {
  // Only clear if actually leaving the cell (not entering a child element)
  const related = event.relatedTarget as HTMLElement | null
  const cell = event.currentTarget as HTMLElement
  if (!related || !cell.contains(related)) {
    if (activeDragDay.value === dateString) {
      activeDragDay.value = null
    }
  }
}

const handleCellDrop = (event: DragEvent, dateString: string) => {
  activeDragDay.value = null
  emit('monthDrop', event, dateString)
}

const handleEventDragStart = (event: DragEvent, calEvent: CalendarEvent) => {
  draggedEventId.value = calEvent.taskId
  emit('eventDragStart', event, calEvent)
}

const handleEventDragEnd = (event: DragEvent) => {
  draggedEventId.value = null
  activeDragDay.value = null
  emit('eventDragEnd', event)
}

// External events grouped by date
const externalEventsByDate = computed(() => {
  const map = new Map<string, ExternalCalendarEvent[]>()
  if (!props.externalEvents?.length) return map
  for (const event of props.externalEvents) {
    const d = event.startTime
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!map.has(dateString)) map.set(dateString, [])
    map.get(dateString)!.push(event)
  }
  return map
})

// Inject helpers from parent CalendarView
interface CalendarHelpers {
  getProjectVisual: (event: { projectId?: string }) => { type: 'color' | 'emoji'; content: string }
  getProjectName: (event: CalendarEvent) => string
  getProjectColor: (event: CalendarEvent) => string
  getPriorityClass: (event: CalendarEvent) => string
  getPriorityLabel: (event: CalendarEvent) => string
  getTaskStatus: (event: CalendarEvent) => string
  getStatusLabel: (event: CalendarEvent) => string
  getStatusIcon: (status: string) => string
  formatEventTime: (event: CalendarEvent) => string
}
const {
  getProjectVisual,
  getProjectName,
  getProjectColor,
  getPriorityClass,
  getPriorityLabel,
  getTaskStatus,
  getStatusLabel,
  getStatusIcon,
  formatEventTime
} = inject('calendar-helpers') as CalendarHelpers

// TASK-1321: Dynamic weekday headers based on weekStartsOn setting
const { getWeekDayHeaders } = useCalendarCore()
const weekDayHeaders = computed(() => getWeekDayHeaders())

// TASK-1322: Tooltip with task description
const taskStore = useTaskStore()

const getEventTooltip = (event: CalendarEvent) => {
  // TASK-1418: Virtual events get a "Recurring preview" tooltip
  if (event.isVirtual) {
    const dateStr = event.startTime?.toISOString?.()?.slice(0, 10) || ''
    return `Recurring — will be created on ${dateStr}`
  }
  const task = taskStore.getTask(event.taskId)
  const lines = [event.title]
  if (task?.description) {
    const plain = task.description.replace(/<[^>]*>/g, '').trim()
    if (plain) lines.push(plain.substring(0, 200))
  }
  const time = formatEventTime(event)
  if (time) lines.unshift(`🕐 ${time}`)
  const status = getStatusLabel(event)
  if (status) lines.push(`Status: ${status}`)
  return lines.join('\n')
}

</script>

<template>
  <div class="month-view">
    <!-- Day-of-week header row -->
    <div class="month-weekday-header">
      <div v-for="day in weekDayHeaders" :key="day" class="weekday-label">
        {{ day }}
      </div>
    </div>

    <!-- Month Grid -->
    <div class="month-grid">
      <div
        v-for="day in monthDays"
        :key="day.dateString"
        class="month-day-cell"
        :class="{
          'other-month': !day.isCurrentMonth,
          'today': day.isToday,
          'drag-over': activeDragDay === day.dateString
        }"
        @drop.prevent="handleCellDrop($event, day.dateString)"
        @dragover.prevent
        @dragenter.prevent="handleCellDragEnter(day.dateString)"
        @dragleave="handleCellDragLeave($event, day.dateString)"
        @dblclick.stop="$emit('cellDblClick', day.dateString)"
      >
        <div class="day-number">
          {{ day.dayNumber }}
        </div>

        <div class="day-events">
          <div
            v-for="event in day.events"
            :key="event.id"
            class="month-event"
            :class="{
              'timer-active-event': currentTaskId === event.taskId,
              'selected': selectedEventIds?.has(event.id),
              'status-done': getTaskStatus(event) === 'done',
              'status-active': getTaskStatus(event) === 'todo',
              'dragging': draggedEventId === event.taskId,
              'month-event--virtual': event.isVirtual
            }"
            :style="{ backgroundColor: event.isVirtual ? undefined : event.color }"
            :title="getEventTooltip(event)"
            :draggable="!event.isVirtual"
            @dragstart="!event.isVirtual && handleEventDragStart($event, event)"
            @dragend="!event.isVirtual && handleEventDragEnd($event)"
            @click.stop="!event.isVirtual && $emit('eventClick', $event, event)"
            @dblclick.stop="!event.isVirtual && $emit('eventDblClick', event)"
            @contextmenu.prevent.stop="!event.isVirtual && $emit('eventContextMenu', $event, event)"
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
            />

            <!-- Priority Stripe -->
            <div
              class="priority-stripe"
              :class="`priority-${getPriorityClass(event)}`"
              :title="`Priority: ${getPriorityLabel(event)}`"
            />
            <span v-if="formatEventTime(event)" class="event-time">{{ formatEventTime(event) }}</span>
            <OverflowTooltip
              class="event-title-short"
              :text="event.title"
              multiline
              :line-clamp="2"
              dir="auto"
              @click.stop="$emit('cycleStatus', $event, event)"
            >
              {{ getStatusIcon(getTaskStatus(event)) }} {{ truncateUrlsInText(event.title) }}
            </OverflowTooltip>
          </div>

          <!-- TASK-1317: External calendar events (read-only pills) -->
          <div
            v-for="ext in (externalEventsByDate.get(day.dateString) || [])"
            :key="`ext-${ext.id}`"
            class="month-event month-event--external"
            :style="{ borderColor: ext.color, backgroundColor: ext.color + '20' }"
            :title="`${ext.title}${ext.location ? '\n📍 ' + ext.location : ''}`"
          >
            <div class="external-dot" :style="{ backgroundColor: ext.color }" />
            <OverflowTooltip
              class="event-title-short"
              :text="ext.title"
              multiline
              :line-clamp="2"
              dir="auto"
            >
              {{ ext.title }}
            </OverflowTooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.month-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.month-weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: var(--glass-border-light);
  flex-shrink: 0;
}

.weekday-label {
  background: var(--glass-panel-bg);
  padding: var(--space-2);
  text-align: center;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
}

.month-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 1px;
  background: var(--glass-border-light);
  overflow-y: auto;
}

.month-day-cell {
  background: var(--glass-panel-bg);
  min-height: 120px;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  cursor: pointer;
  transition: background var(--duration-fast);
}

.month-day-cell:hover {
  background: var(--glass-bg-subtle);
}

.month-day-cell.drag-over {
  background: var(--calendar-creating-bg) !important;
  box-shadow: inset 0 0 0 2px var(--purple-border-strong) !important;
  opacity: 1 !important;
}

.month-day-cell.other-month {
  background: var(--glass-bg-tint);
  opacity: 0.6;
}

.month-day-cell.today {
  background: var(--danger-bg-subtle);
}

.day-number {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-align: end;
}

.month-day-cell.today .day-number {
  color: var(--color-danger);
  background: var(--color-danger);
  color: white;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-inline-start: auto;
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  flex: 1;
  overflow-y: auto;
}

/* TASK-1322: Vertical compact layout — shows more content per event */
.month-event {
  padding: var(--space-0_5) var(--space-1);
  padding-inline-start: var(--space-2_5);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: white;
  cursor: grab;
  position: relative;
  line-height: 1.3;
}

.month-event.timer-active-event {
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.5);
}

/* TASK-1362: Selected state */
.month-event.selected {
  outline: 2px solid var(--brand-primary);
  outline-offset: -1px;
  box-shadow: 0 0 6px var(--brand-primary-dim);
}

.event-time {
  font-weight: var(--font-bold);
  opacity: 0.8;
  font-size: 0.6rem;
  display: block;
  margin-bottom: 1px;
}

.project-indicator {
  width: 4px;
  height: calc(100% - 4px);
  border-radius: var(--radius-xs);
  position: absolute;
  left: var(--space-0_5);
  top: var(--space-0_5);
}

.project-emoji-indicator {
  width: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.priority-stripe {
  width: 2px;
  height: calc(100% - 6px);
  border-radius: 1px;
  position: absolute;
  left: 0;
  top: 3px;
}

.event-title-short {
  word-break: break-word;
}

/* TASK-1409: Visual indicator for in-progress tasks */
.month-event.status-active {
  border-inline-start: 2px solid var(--brand-primary);
  box-shadow: inset 2px 0 6px -2px var(--brand-primary-dim);
}

/* BUG-1304 + BUG-1343: Visual indicator for done tasks */
.month-event.status-done {
  filter: grayscale(0.6) brightness(0.85);
  opacity: 0.55;
}

.month-event.status-done .event-title-short {
  text-decoration: line-through;
}

.month-event.dragging {
  opacity: 0.35 !important;
  transform: scale(0.95);
}

/* TASK-1418: Virtual recurring event ghost styling */
.month-event--virtual {
  opacity: 0.5;
  border-style: dashed !important;
  border-width: 1px;
  border-color: var(--brand-primary);
  background: var(--glass-bg-subtle) !important;
  color: var(--text-primary) !important;
  pointer-events: none;
  cursor: default;
}

.month-event--virtual .event-title-short::before {
  content: '\1F501 ';
  font-size: 10px;
}

/* TASK-1317: External calendar events */
.month-event--external {
  background: transparent !important;
  border: 1px solid;
  color: var(--text-secondary) !important;
  cursor: default;
  padding-inline-start: var(--space-1);
}

.month-event--external:hover {
  filter: brightness(1.1);
}

.external-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
