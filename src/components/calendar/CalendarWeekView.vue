<script setup lang="ts">
import { inject } from 'vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import type { WeekEvent } from '@/types/tasks'

defineProps<{
  weekDays: any[]
  workingHours: number[]
  weekEvents: WeekEvent[]
  currentTaskId?: string | null
}>()
defineEmits<{
  (e: 'weekDragOver', event: DragEvent): void
  (e: 'weekDrop', event: DragEvent, dateString: string, hour: number): void
  (e: 'eventDragStart', event: DragEvent, weekEvent: WeekEvent): void
  (e: 'eventDragEnd', event: DragEvent, weekEvent: WeekEvent): void
  (e: 'eventClick', event: MouseEvent, weekEvent: WeekEvent): void
  (e: 'eventDblClick', weekEvent: WeekEvent): void
  (e: 'eventContextMenu', event: MouseEvent, weekEvent: WeekEvent): void
  (e: 'cycleStatus', event: MouseEvent, weekEvent: WeekEvent): void
  (e: 'removeFromCalendar', weekEvent: WeekEvent): void
  (e: 'startResize', event: MouseEvent, weekEvent: WeekEvent, direction: 'top' | 'bottom'): void
}>()
// Inject helpers from parent CalendarView
const helpers = inject('calendar-helpers') as any
const {
  formatHour,
  getWeekEventStyle,
  isCurrentWeekTimeCell,
  getProjectVisual,
  getProjectName,
  getProjectColor,
  getPriorityClass,
  getPriorityLabel,
  getTaskStatus,
  getStatusIcon
} = helpers

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
        <!-- Time Grid Background -->
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
              @drop="$emit('weekDrop', $event, day.dateString, hour)"
              @dragover.prevent="$emit('weekDragOver', $event)"
              @dragenter.prevent
            />
          </div>
        </div>

        <!-- Events Layer -->
        <div class="week-events-layer">
          <div
            v-for="event in weekEvents"
            :key="event.id"
            class="week-event"
            :style="getWeekEventStyle(event)"
            :class="{
              'multi-slot': event.slotSpan > 1,
              'timer-active-event': currentTaskId === event.taskId
            }"
            draggable="true"
            @dragstart="$emit('eventDragStart', $event, event)"
            @dragend="$emit('eventDragEnd', $event, event)"
            @click="$emit('eventClick', $event, event)"
          >
            <!-- Top Resize Handle -->
            <div
              class="resize-handle resize-top"
              title="Resize start time"
              @mousedown.stop="$emit('startResize', $event, event, 'top')"
            />

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
            <div
              class="event-content"
              @dblclick="$emit('eventDblClick', event)"
              @contextmenu.prevent="$emit('eventContextMenu', $event, event)"
            >
              <div class="event-header">
                <div class="event-title">
                  {{ event.title }}
                </div>
                <div class="event-actions">
                  <div
                    class="status-indicator"
                    :class="`status-${getTaskStatus(event)}`"
                    @click.stop="$emit('cycleStatus', $event, event)"
                  >
                    {{ getStatusIcon(getTaskStatus(event)) }}
                  </div>
                  <button
                    class="remove-from-calendar-btn"
                    @click.stop="$emit('removeFromCalendar', event)"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div class="event-duration">
                {{ event.duration }}min
              </div>
            </div>

            <!-- Bottom Resize Handle -->
            <div
              class="resize-handle resize-bottom"
              title="Resize end time"
              @mousedown.stop="$emit('startResize', $event, event, 'bottom')"
            />
          </div>
        </div>

        <!-- Current Time Indicator Layer -->
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
            />
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
  border-left: 1px solid var(--border-faint);
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
  border-bottom: 1px solid var(--border-faint);
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
  border-left: 1px solid var(--border-faint);
}

.week-time-cell {
  height: 60px;
  border-bottom: 1px solid var(--border-faint);
}

.week-events-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  pointer-events: none;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.week-event {
  position: absolute;
  left: var(--space-1);
  right: var(--space-1);
  background: var(--surface-tertiary);
  border-left: 3px solid var(--accent-primary);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  box-shadow: var(--shadow-sm);
  pointer-events: auto;
  cursor: grab;
  z-index: 10;
  overflow: hidden;
  transition: all var(--duration-fast);
}

.week-event:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
  z-index: 15;
}

.event-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.event-title {
  font-weight: var(--font-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-actions {
  display: flex;
  gap: var(--space-0_5);
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.week-event:hover .event-actions {
  opacity: 1;
}

.event-duration {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.week-current-time-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  pointer-events: none;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.week-day-time-column {
  height: 100%;
}

.week-time-indicator {
  height: 60px;
}

.week-time-indicator.current-time {
  background: rgba(239, 68, 68, 0.05);
  box-shadow: inset 0 -2px 0 var(--color-danger);
}

.project-stripe {
  width: 4px;
  border-radius: var(--radius-xs);
  height: calc(100% - 4px);
  position: absolute;
  left: var(--space-0_5);
  top: var(--space-0_5);
}

.project-emoji-stripe {
  width: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  left: var(--space-1);
}

.priority-stripe {
  width: 2px;
  border-radius: 1px;
  height: calc(100% - 8px);
  position: absolute;
  left: 0;
  top: var(--space-1);
}

.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  background: transparent;
  cursor: ns-resize;
  z-index: 20;
}

.resize-handle.resize-top { top: 0; }
.resize-handle.resize-bottom { bottom: 0; }

.status-indicator {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  cursor: pointer;
}

.remove-from-calendar-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}
</style>
