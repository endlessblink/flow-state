<script setup lang="ts">
import { inject } from 'vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import type { CalendarEvent, DragGhost } from '@/types/tasks'
import type { TimeSlot } from '@/composables/calendar/useCalendarDayView'

defineProps<{
  timeSlots: TimeSlot[]
  hours: number[]
  isViewingToday: boolean
  timeIndicatorPosition: number
  dragGhost: DragGhost
  activeDropSlot: number | null
  currentTaskId?: string | null
  isDragging: boolean
  draggedEventId: string | null
  hoveredEventId: string | null
  resizePreview?: {
    isResizing: boolean
    taskId: string | null
    previewDuration: number
    direction: 'top' | 'bottom'
  } | null
}>()
defineEmits<{
  (e: 'dragover', event: DragEvent, slot: TimeSlot): void
  (e: 'dragenter', event: DragEvent, slot: TimeSlot): void
  (e: 'dragleave'): void
  (e: 'drop', event: DragEvent, slot: TimeSlot): void
  (e: 'slotMouseDown', event: MouseEvent, slot: TimeSlot): void
  (e: 'eventMouseEnter', eventId: string): void
  (e: 'eventMouseLeave'): void
  (e: 'eventDragStart', event: DragEvent, calEvent: CalendarEvent): void
  (e: 'eventDragEnd', event: DragEvent, calEvent: CalendarEvent): void
  (e: 'eventClick', event: MouseEvent, calEvent: CalendarEvent): void
  (e: 'eventDblClick', calEvent: CalendarEvent): void
  (e: 'eventContextMenu', event: MouseEvent, calEvent: CalendarEvent): void
  (e: 'cycleStatus', event: MouseEvent, calEvent: CalendarEvent): void
  (e: 'removeFromCalendar', calEvent: CalendarEvent): void
  (e: 'startResize', event: MouseEvent, calEvent: CalendarEvent, direction: 'top' | 'bottom'): void
}>()
// Inject helpers from parent CalendarView
const helpers = inject('calendar-helpers') as any
const {
  formatHour,
  isCurrentTimeSlot,
  getTasksForSlot,
  isTaskPrimarySlot,
  getSlotTaskStyle,
  getProjectVisual,
  getProjectName,
  getProjectColor,
  getPriorityClass,
  getPriorityLabel,
  getTaskStatus,
  getStatusLabel,
  getStatusIcon
} = helpers

</script>

<template>
  <div class="calendar-grid">
    <!-- Time Labels Column -->
    <div class="time-labels">
      <div
        v-for="hour in hours"
        :key="hour"
        class="time-label"
      >
        {{ formatHour(hour) }}
      </div>
    </div>

    <!-- Slots Container -->
    <div class="slots-container">
      <!-- Current Time Indicator -->
      <div
        v-if="isViewingToday"
        class="current-time-indicator"
        :style="{ top: `${timeIndicatorPosition}px` }"
      >
        <div class="time-indicator-dot" />
        <div class="time-indicator-line" />
      </div>

      <!-- Ghost Preview (during inbox drag) -->
      <div
        v-if="dragGhost.visible"
        class="ghost-preview-inline"
        :style="{
          position: 'absolute',
          top: `${dragGhost.slotIndex * 30}px`,
          height: `${Math.ceil(dragGhost.duration / 30) * 30}px`,
          width: 'calc(100% - 8px)',
          left: '4px',
          zIndex: 40
        }"
      >
        <div class="ghost-content">
          <span class="ghost-title">{{ dragGhost.title }}</span>
          <span class="ghost-duration">{{ dragGhost.duration }}min</span>
        </div>
      </div>

      <!-- Time Slots -->
      <div
        v-for="slot in timeSlots"
        :key="slot.id"
        class="time-slot"
        :data-slot-index="slot.slotIndex"
        :class="{
          'drag-over': activeDropSlot === slot.slotIndex,
          'current-time': isCurrentTimeSlot(slot)
        }"
        @dragover.prevent="$emit('dragover', $event, slot)"
        @dragenter.prevent="$emit('dragenter', $event, slot)"
        @dragleave="$emit('dragleave')"
        @drop.prevent="$emit('drop', $event, slot)"
        @mousedown="$emit('slotMouseDown', $event, slot)"
      >
        <!-- Tasks rendered INSIDE the slot -->
        <template v-for="calEvent in getTasksForSlot(slot)" :key="`${calEvent.id}-${slot.slotIndex}`">
          <div
            v-if="isTaskPrimarySlot(slot, calEvent)"
            class="slot-task is-primary"
            :class="{
              'timer-active-event': currentTaskId === calEvent.taskId,
              'dragging': isDragging && draggedEventId === calEvent.id,
              'is-hovered': hoveredEventId === calEvent.id,
              'has-overlap': calEvent.totalColumns > 1
            }"
            :style="getSlotTaskStyle(calEvent)"
            draggable="true"
            @mouseenter="$emit('eventMouseEnter', calEvent.id)"
            @mouseleave="$emit('eventMouseLeave')"
            @dragstart="$emit('eventDragStart', $event, calEvent)"
            @dragend="$emit('eventDragEnd', $event, calEvent)"
            @click="$emit('eventClick', $event, calEvent)"
            @dblclick="$emit('eventDblClick', calEvent)"
            @contextmenu.prevent="$emit('eventContextMenu', $event, calEvent)"
          >
            <!-- Project Stripe -->
            <div
              v-if="getProjectVisual(calEvent).type === 'emoji'"
              class="project-stripe project-emoji-stripe"
              :title="`Project: ${getProjectName(calEvent)}`"
            >
              <ProjectEmojiIcon
                :emoji="getProjectVisual(calEvent).content"
                size="xs"
                class="project-emoji"
              />
            </div>
            <div
              v-else
              class="project-stripe project-color-stripe"
              :style="{ backgroundColor: getProjectColor(calEvent) }"
              :title="`Project: ${getProjectName(calEvent)}`"
            />

            <!-- Priority Stripe -->
            <div
              class="priority-stripe"
              :class="`priority-${getPriorityClass(calEvent)}`"
              :title="`Priority: ${getPriorityLabel(calEvent)}`"
            />

            <!-- Task Content -->
            <div class="task-content--calendar">
              <div class="task-header">
                <div class="task-title">
                  {{ calEvent.title }}
                </div>
                <div class="task-actions">
                  <div
                    class="status-indicator"
                    :class="`status-${getTaskStatus(calEvent)}`"
                    :title="`Status: ${getStatusLabel(calEvent)} (click to change)`"
                    @click.stop="$emit('cycleStatus', $event, calEvent)"
                  >
                    {{ getStatusIcon(getTaskStatus(calEvent)) }}
                  </div>
                  <button
                    class="remove-from-calendar-btn"
                    title="Remove from calendar (move to inbox)"
                    @click.stop="$emit('removeFromCalendar', calEvent)"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div class="task-duration">
                {{ calEvent.duration }}min
              </div>
            </div>

            <!-- Resize Handles -->
            <div
              class="resize-handle resize-top"
              title="Drag to change start time"
              @mousedown.stop="$emit('startResize', $event, calEvent, 'top')"
            />
            <div
              class="resize-handle resize-bottom"
              title="Drag to change duration"
              @mousedown.stop="$emit('startResize', $event, calEvent, 'bottom')"
            />

            <!-- Resize Preview -->
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
</template>

<style scoped>
.calendar-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 80px 1fr;
  overflow: visible;
  min-height: 0;
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
  border-inline-end: 1px solid var(--glass-border-light);
  overflow-y: auto;
  box-shadow: var(--shadow-xs);
  scrollbar-width: none;
}

.time-labels::-webkit-scrollbar {
  display: none;
}

.time-label {
  height: 60px;
  display: flex;
  align-items: flex-start;
  justify-content: end;
  padding-top: var(--space-1);
  padding-inline-end: var(--space-3);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-bottom: 1px solid var(--glass-bg-tint);
}

.slots-container {
  position: relative;
  background: linear-gradient(180deg, var(--glass-bg-subtle) 0%, transparent 100%);
  overflow-y: auto;
  z-index: 2;
}

.slots-container::-webkit-scrollbar {
  width: 6px;
}

.slots-container::-webkit-scrollbar-track {
  background: transparent;
}

.slots-container::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
}

.time-slot {
  height: 30px;
  border-bottom: 1px solid var(--glass-border-light);
  position: relative;
  transition: background var(--duration-fast);
}

.time-slot:nth-child(even) {
  border-bottom-style: dashed;
  border-bottom-color: var(--glass-border-faint);
}

.time-slot:hover {
  background: var(--glass-bg-tint);
}

.time-slot.drag-over {
  background: var(--glass-bg-soft);
  border-color: var(--accent-primary);
}

.time-slot.current-time {
  background: rgba(239, 68, 68, 0.02);
}

.slot-task {
  position: relative;
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
  z-index: 5;
}

.slot-task:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.slot-task.is-primary {
  border-left: 4px solid var(--accent-primary);
  padding-left: calc(var(--space-3) - 2px);
}

.task-content--calendar {
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

.project-stripe {
  width: 4px;
  border-radius: 2px;
  height: calc(100% - 8px);
  position: absolute;
  left: 4px;
  top: 4px;
}

.project-emoji-stripe {
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  left: 6px;
}

.project-color-stripe {
  /* Inherits height and top from .project-stripe */
}

.priority-stripe {
  width: 2px;
  border-radius: 1px;
  height: calc(100% - 12px);
  position: absolute;
  left: 0;
  top: 6px;
}

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

.slot-task.is-primary:hover .resize-handle,
.slot-task.is-primary.is-hovered .resize-handle {
  opacity: 1 !important;
  pointer-events: auto !important;
  background: rgba(99, 102, 241, 0.4) !important;
  transition: none !important;
}

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

.current-time-indicator {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 100;
  pointer-events: none;
  display: flex;
  align-items: center;
}

.time-indicator-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-danger);
  box-shadow: 0 0 8px var(--color-danger), 0 0 16px rgba(239, 68, 68, 0.4);
  flex-shrink: 0;
  margin-left: -6px;
}

.time-indicator-line {
  flex: 1;
  height: 2px;
  background: var(--color-danger);
  box-shadow: 0 0 4px var(--color-danger), 0 1px 2px rgba(0, 0, 0, 0.2);
}

.ghost-preview-inline {
  background: linear-gradient(135deg, var(--calendar-ghost-bg-start) 0%, var(--calendar-ghost-bg-end) 100%);
  backdrop-filter: blur(8px);
  border: 3px solid var(--calendar-ghost-border);
  border-radius: var(--radius-lg);
  pointer-events: none;
}

.ghost-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  gap: 4px;
}

.ghost-title {
  font-weight: 700;
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.ghost-duration {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.9;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 12px;
}

.status-indicator {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.status-indicator:hover {
  background: rgba(255, 255, 255, 0.1);
}

.remove-from-calendar-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  transition: all var(--duration-fast);
  line-height: 1;
}

.remove-from-calendar-btn:hover {
  color: var(--color-danger);
  background: rgba(239, 68, 68, 0.1);
}
</style>
