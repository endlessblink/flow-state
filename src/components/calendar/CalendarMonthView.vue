<script setup lang="ts">
import { ref, inject, computed } from 'vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import { useCalendarCore } from '@/composables/useCalendarCore'
import { useTaskStore } from '@/stores/tasks'
import type { CalendarEvent } from '@/types/tasks'
import type { MonthDay } from '@/composables/calendar/useCalendarMonthView'
import type { ExternalCalendarEvent } from '@/composables/calendar/useExternalCalendar'
import { truncateUrlsInText } from '@/utils/urlTruncate'

const props = defineProps<{
  monthDays: MonthDay[]
  currentTaskId?: string | null
  externalEvents?: ExternalCalendarEvent[]
}>()
const emit = defineEmits<{
  (e: 'monthDrop', event: DragEvent, dateString: string): void
  (e: 'monthDayClick', dateString: string): void
  (e: 'eventDragStart', event: DragEvent, calEvent: CalendarEvent): void
  (e: 'eventDragEnd', event: DragEvent): void
  (e: 'eventDblClick', calEvent: CalendarEvent): void
  (e: 'eventContextMenu', event: MouseEvent, calEvent: CalendarEvent): void
  (e: 'cycleStatus', event: MouseEvent, calEvent: CalendarEvent): void
  (e: 'cellDblClick', dateString: string): void
}>()

// Debounce single-click vs double-click on day cells
// Single click → navigate to day view, Double click → open create modal
let clickTimer: ReturnType<typeof setTimeout> | null = null
const handleDayCellClick = (dateString: string) => {
  if (clickTimer) clearTimeout(clickTimer)
  clickTimer = setTimeout(() => {
    emit('monthDayClick', dateString)
  }, 250)
}
const handleDayCellDblClick = (dateString: string) => {
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null }
  emit('cellDblClick', dateString)
}

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
const helpers = inject('calendar-helpers') as any
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
} = helpers

// TASK-1321: Dynamic weekday headers based on weekStartsOn setting
const { getWeekDayHeaders } = useCalendarCore()
const weekDayHeaders = computed(() => getWeekDayHeaders())

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
        @click="handleDayCellClick(day.dateString)"
        @dblclick.stop="handleDayCellDblClick(day.dateString)"
      >
        <div class="day-number">
          {{ day.dayNumber }}
        </div>

        <div class="day-events">
          <div
            v-for="event in day.events"
            :key="event.id"
            class="month-event"
            :class="{ 'timer-active-event': currentTaskId === event.taskId, 'status-done': getTaskStatus(event) === 'done', 'dragging': draggedEventId === event.taskId }"
            :style="{ backgroundColor: event.color }"
            :title="getEventTooltip(event)"
            draggable="true"
            @dragstart="handleEventDragStart($event, event)"
            @dragend="handleEventDragEnd($event)"
            @dblclick.stop="$emit('eventDblClick', event)"
            @contextmenu.prevent.stop="$emit('eventContextMenu', $event, event)"
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
            />

            <!-- Priority Stripe -->
            <div
              class="priority-stripe"
              :class="`priority-${getPriorityClass(event)}`"
              :title="`Priority: ${getPriorityLabel(event)}`"
            />
            <span v-if="formatEventTime(event)" class="event-time">{{ formatEventTime(event) }}</span>
            <span
              class="event-title-short"
              dir="auto"
              :title="event.title"
              @click.stop="$emit('cycleStatus', $event, event)"
            >
              {{ getStatusIcon(getTaskStatus(event)) }} {{ truncateUrlsInText(event.title) }}
            </span>
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
            <span class="event-title-short" dir="auto">{{ ext.title }}</span>
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
  background: rgba(99, 102, 241, 0.2) !important;
  box-shadow: inset 0 0 0 2px rgba(99, 102, 241, 0.5) !important;
  opacity: 1 !important;
}

.month-day-cell.other-month {
  background: var(--glass-bg-tint);
  opacity: 0.6;
}

.month-day-cell.today {
  background: rgba(239, 68, 68, 0.05);
}

.day-number {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-align: right;
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
  margin-left: auto;
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
  padding-left: var(--space-2_5);
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
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

/* BUG-1304: Visual indicator for done tasks — low opacity only, no strikethrough */
.month-event.status-done {
  filter: grayscale(0.6) brightness(0.85);
  opacity: 0.55;
}

.month-event.dragging {
  opacity: 0.35 !important;
  transform: scale(0.95);
}

/* TASK-1317: External calendar events */
.month-event--external {
  background: transparent !important;
  border: 1px solid;
  color: var(--text-secondary) !important;
  cursor: default;
  padding-left: var(--space-1);
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
