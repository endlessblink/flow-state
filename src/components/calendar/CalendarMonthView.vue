<script setup lang="ts">
import { inject } from 'vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import type { CalendarEvent } from '@/types/tasks'
import type { MonthDay } from '@/composables/calendar/useCalendarMonthView'

defineProps<{
  monthDays: MonthDay[]
  currentTaskId?: string | null
}>()
defineEmits<{
  (e: 'monthDrop', event: DragEvent, dateString: string): void
  (e: 'monthDayClick', dateString: string): void
  (e: 'eventDragStart', event: DragEvent, calEvent: CalendarEvent): void
  (e: 'eventDragEnd', event: DragEvent): void
  (e: 'eventDblClick', calEvent: CalendarEvent): void
  (e: 'eventContextMenu', event: MouseEvent, calEvent: CalendarEvent): void
  (e: 'cycleStatus', event: MouseEvent, calEvent: CalendarEvent): void
}>()
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

</script>

<template>
  <div class="month-view">
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
        @drop="$emit('monthDrop', $event, day.dateString)"
        @dragover.prevent
        @dragenter.prevent
        @click="$emit('monthDayClick', day.dateString)"
      >
        <div class="day-number">
          {{ day.dayNumber }}
        </div>

        <div class="day-events">
          <div
            v-for="event in day.events"
            :key="event.id"
            class="month-event"
            :class="{ 'timer-active-event': currentTaskId === event.taskId, 'status-done': getTaskStatus(event) === 'done' }"
            :style="{ backgroundColor: event.color }"
            draggable="true"
            @dragstart="$emit('eventDragStart', $event, event)"
            @dragend="$emit('eventDragEnd', $event)"
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
            <span class="event-time">{{ formatEventTime(event) }}</span>
            <span 
              class="event-title-short"
              :title="`Status: ${getStatusLabel(event)} (click to change)`"
              @click.stop="$emit('cycleStatus', $event, event)"
            >
              {{ getStatusIcon(getTaskStatus(event)) }} {{ event.title }}
            </span>
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

.month-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 1px;
  background: var(--border-faint);
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

.month-event {
  padding: var(--space-0_5) var(--space-1);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  cursor: grab;
  position: relative;
  padding-left: var(--space-2_5);
}

.month-event.timer-active-event {
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.5);
}

.event-time {
  font-weight: var(--font-bold);
  opacity: 0.9;
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
  overflow: hidden;
  text-overflow: ellipsis;
}

/* BUG-1304: Visual indicator for done tasks */
.month-event.status-done {
  filter: grayscale(0.6) brightness(0.85);
  opacity: 0.65;
}

.month-event.status-done .event-title-short {
  text-decoration: line-through;
}
</style>
