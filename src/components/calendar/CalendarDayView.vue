<script setup lang="ts">
import { inject, ref, computed } from 'vue'
import { Play, Timer } from 'lucide-vue-next'
import { useTimerStore } from '@/stores/timer'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import type { CalendarEvent, DragGhost } from '@/types/tasks'
import type { TimeSlot, PositionedExternalEvent } from '@/composables/calendar/useCalendarDayView'
import type { ComputedRef } from 'vue'

const _props = defineProps<{
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
  selectedEventIds?: Set<string>
  resizePreview?: {
    isResizing: boolean
    taskId: string | null
    previewDuration: number
    direction: 'top' | 'bottom'
  } | null
  isSlotInCreateRange?: (slot: TimeSlot) => boolean
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
  (e: 'startTimer', calEvent: CalendarEvent): void
  (e: 'startResize', event: MouseEvent, calEvent: CalendarEvent, direction: 'top' | 'bottom'): void
}>()
// Inject helpers from parent CalendarView
interface CalendarHelpers {
  formatHour: (hour: number) => string
  formatEventTime: (event: CalendarEvent) => string
  isCurrentTimeSlot: (slot: TimeSlot) => boolean
  getTasksForSlot: (slot: TimeSlot) => CalendarEvent[]
  isTaskPrimarySlot: (task: CalendarEvent, slot: TimeSlot) => boolean
  getSlotTaskStyle: (task: CalendarEvent, slot: TimeSlot) => Record<string, string>
  getProjectVisual: (event: { projectId?: string }) => { type: 'color' | 'emoji'; content: string }
  getProjectName: (event: CalendarEvent) => string
  getProjectColor: (event: CalendarEvent) => string
  getPriorityClass: (event: CalendarEvent) => string
  getPriorityLabel: (event: CalendarEvent) => string
  getTaskStatus: (event: CalendarEvent) => string
  getStatusLabel: (event: CalendarEvent) => string
  getStatusIcon: (status: string) => string
  positionedExternalEvents: ComputedRef<PositionedExternalEvent[]>
}
const {
  formatHour,
  formatEventTime,
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
  getStatusLabel: _getStatusLabel,
  getStatusIcon: _getStatusIcon,
  positionedExternalEvents
} = inject('calendar-helpers') as CalendarHelpers

const timerStore = useTimerStore()

const timerRemainingFormatted = computed(() => {
  const session = timerStore.currentSession
  if (!session || !timerStore.isTimerActive) return null
  const remaining = session.remainingTime
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
})

const timeLabelsRef = ref<HTMLElement | null>(null)

const onSlotsScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (timeLabelsRef.value) {
    timeLabelsRef.value.scrollTop = target.scrollTop
  }
}
</script>

<template>
  <div class="calendar-grid">
    <!-- Time Labels Column -->
    <div ref="timeLabelsRef" class="time-labels">
      <div
        v-for="hour in hours"
        :key="hour"
        class="time-label"
      >
        {{ formatHour(hour) }}
      </div>
    </div>

    <!-- Slots Container -->
    <div class="slots-container" @scroll="onSlotsScroll">
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
          zIndex: 40,
          pointerEvents: 'none'
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
        :data-slot-date="slot.date"
        :data-hour="slot.hour"
        :data-minute="slot.minute"
        :class="{
          'drag-over': activeDropSlot === slot.slotIndex,
          'current-time': isCurrentTimeSlot(slot),
          'creating': isSlotInCreateRange?.(slot)
        }"
        @dragover.prevent="$emit('dragover', $event, slot)"
        @dragenter.prevent="$emit('dragenter', $event, slot)"
        @dragleave="$emit('dragleave')"
        @drop.prevent="$emit('drop', $event, slot)"
        @mousedown="$emit('slotMouseDown', $event, slot)"
      >
        <!-- BUG-1354: Removed TransitionGroup — it caused visual "duplicate" artifacts.
             When calendarEvents recomputed (e.g., timer start), TransitionGroup played
             simultaneous enter+leave animations (200ms overlap = brief double-block). -->
        <div class="slot-tasks-container">
          <div
            v-for="calEvent in getTasksForSlot(slot)"
            v-show="isTaskPrimarySlot(calEvent, slot)"
            :key="`${calEvent.id}-${slot.slotIndex}`"
            class="slot-task is-primary"
            :class="{
              'timer-active-event': currentTaskId === calEvent.taskId,
              'dragging': isDragging && draggedEventId === calEvent.id,
              'is-hovered': hoveredEventId === calEvent.id,
              'selected': selectedEventIds?.has(calEvent.id),
              'has-overlap': calEvent.totalColumns > 1,
              'is-compact': calEvent.duration <= 30,
              'status-done': getTaskStatus(calEvent) === 'done',
              'status-active': getTaskStatus(calEvent) === 'todo',
              'slot-task--virtual': calEvent.isVirtual
            }"
            :style="getSlotTaskStyle(calEvent, slot)"
            :title="calEvent.isVirtual ? `Recurring — will be created on ${calEvent.startTime?.toISOString?.()?.slice(0, 10) || ''}` : undefined"
            :draggable="!calEvent.isVirtual"
            @mouseenter="!calEvent.isVirtual && $emit('eventMouseEnter', calEvent.id)"
            @mouseleave="!calEvent.isVirtual && $emit('eventMouseLeave')"
            @dragstart="!calEvent.isVirtual && $emit('eventDragStart', $event, calEvent)"
            @dragend="!calEvent.isVirtual && $emit('eventDragEnd', $event, calEvent)"
            @click="!calEvent.isVirtual && $emit('eventClick', $event, calEvent)"
            @dblclick="!calEvent.isVirtual && $emit('eventDblClick', calEvent)"
            @contextmenu.prevent="!calEvent.isVirtual && $emit('eventContextMenu', $event, calEvent)"
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

            <!-- Task Content - dir="auto" detects RTL/LTR from content -->
            <div class="task-content--calendar" dir="auto">
              <div class="task-header">
                <div class="task-title" dir="auto" :title="calEvent.title">
                  {{ calEvent.title }}
                </div>
                <div class="task-actions">
                  <button
                    class="play-timer-btn"
                    title="Start timer for this task"
                    aria-label="Start timer for this task"
                    @click.stop="$emit('startTimer', calEvent)"
                  >
                    <Play :size="12" />
                  </button>
                  <button
                    class="remove-from-calendar-btn"
                    title="Remove from calendar (move to inbox)"
                    aria-label="Remove from calendar (move to inbox)"
                    @click.stop="$emit('removeFromCalendar', calEvent)"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div class="task-meta">
                <span v-if="formatEventTime(calEvent)" class="task-time">{{ formatEventTime(calEvent) }}</span>
                <span class="task-duration">{{ calEvent.duration }}min</span>
                <span
                  v-if="currentTaskId === calEvent.taskId && timerRemainingFormatted"
                  class="timer-remaining"
                >
                  <Timer :size="10" />
                  {{ timerRemainingFormatted }}
                </span>
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
        </div>
      </div>

      <!-- TASK-1317 + TASK-1496: External calendar events — side-by-side with local events via unified overlap calc -->
      <div
        v-for="ext in positionedExternalEvents"
        :key="`ext-${ext.id}`"
        class="external-event"
        :class="{
          'external-event--tiny': ext.height < 25,
          'external-event--small': ext.height >= 25 && ext.height < 40
        }"
        :style="{
          top: `${ext.top}px`,
          height: `${ext.height}px`,
          left: `${ext.leftPercent}%`,
          width: `calc(${ext.widthPercent}% - 4px)`,
          backgroundColor: ext.color + '20',
          borderColor: ext.color,
          zIndex: 10 + ext.column
        }"
        :title="`${ext.formattedTime} — ${ext.title}${ext.location ? '\n📍 ' + ext.location : ''}`"
      >
        <!-- Tiny events (< 25min): single line with time + title inline -->
        <template v-if="ext.height < 25">
          <span class="external-event-inline" dir="auto">
            <span class="external-event-time">{{ ext.formattedTime }}</span>
            {{ ext.title }}
          </span>
        </template>
        <!-- Normal events: time on top, title below -->
        <template v-else>
          <span class="external-event-time">{{ ext.formattedTime }}</span>
          <span class="external-event-title" dir="auto">{{ ext.title }}</span>
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
  overflow: hidden;
  position: relative;
  z-index: 1;
  /* overflow:hidden (not visible) — WebKitGTK collapses flex:1 + overflow:visible
     to 0px height. Week/Month views use overflow-y:auto and work fine.
     No children need to overflow the grid boundary. */
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
  background: var(--color-danger-bg-subtle);
}

.time-slot.creating {
  background: var(--brand-primary-subtle, rgba(78, 205, 196, 0.1));
  border-color: var(--brand-primary);
}

.slot-task {
  position: relative;
  margin: var(--space-0_5) var(--space-1);
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

/* TASK-1362: Selected state — teal highlight ring */
.slot-task.selected {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-primary), 0 0 8px var(--brand-primary-dim);
  background: var(--brand-primary-subtle);
}

.slot-task.selected:hover {
  box-shadow: 0 0 0 2px var(--brand-primary), 0 0 12px var(--brand-primary-dim);
}

.slot-task.is-primary {
  border-inline-start: 4px solid var(--accent-primary);
  padding-inline-start: calc(var(--space-3) - 2px);
}

.task-content--calendar {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  flex: 1;
  min-width: 0;
  overflow: hidden;
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
  align-items: center;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.slot-task:hover .task-actions {
  opacity: 1;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  white-space: nowrap;
}

.task-time {
  opacity: 0.8;
}

.task-time::after {
  content: " · ";
  opacity: 0.5;
}

.task-duration {
  font-weight: var(--font-medium);
}

.timer-remaining {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-inline-start: var(--space-2);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--timer-active-border, #f59e0b);
  color: var(--color-base-900, #1a1a1a);
  font-size: 10px;
  font-weight: var(--font-semibold);
  font-variant-numeric: tabular-nums;
  animation: timer-badge-pulse 2s ease-in-out infinite;
}

@keyframes timer-badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* ========================================
   COMPACT TASK LAYOUT (short duration tasks)
   Single horizontal line: Title ... Time · Duration
   RTL text (Hebrew/Arabic) auto-detected and layout flipped
   ======================================== */

.slot-task.is-compact {
  padding: var(--space-1) var(--space-2);
}

.slot-task.is-compact .task-content--calendar {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

/* RTL: Reverse flex direction so title appears on right, meta on left */
/* Use :dir(rtl) pseudo-class which detects computed direction from dir="auto" */
.slot-task.is-compact .task-content--calendar:dir(rtl) {
  flex-direction: row-reverse;
}

.slot-task.is-compact .task-header {
  flex: 1;
  min-width: 0;
}

.slot-task.is-compact .task-title {
  font-size: var(--text-xs);
}

.slot-task.is-compact .task-meta {
  flex-shrink: 0;
  font-size: var(--text-xs);
}

/* Hide actions in compact mode to save space */
.slot-task.is-compact .task-actions {
  display: none;
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
  /* Hide emoji stripe - causes layout issues */
  display: none;
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
  top: var(--space-1_5);
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
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.resize-handle.resize-bottom {
  bottom: 0;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.slot-task.is-primary:hover .resize-handle,
.slot-task.is-primary.is-hovered .resize-handle {
  opacity: 1 !important;
  pointer-events: auto !important;
  background: var(--calendar-creating-border) !important;
  transition: none !important;
}

.resize-preview-overlay {
  position: absolute;
  left: 0;
  right: 0;
  background: var(--color-indigo-bg-medium);
  border: 2px dashed var(--purple-border-active);
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
  color: var(--calendar-today-badge-start);
  background: var(--text-primary);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
}

.current-time-indicator {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 2; /* Behind tasks (z-index: 5) so events stay visible */
  pointer-events: none;
  display: flex;
  align-items: center;
}

.time-indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
  box-shadow: 0 0 4px var(--color-danger);
  flex-shrink: 0;
  margin-inline-start: calc(-1 * var(--space-1));
}

.time-indicator-line {
  flex: 1;
  height: 2px;
  background: var(--color-danger);
  opacity: 0.7; /* Semi-transparent so tasks show through */
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
  gap: var(--space-1);
}

.ghost-title {
  font-weight: 700;
  font-size: var(--text-sm);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.ghost-duration {
  font-size: var(--text-xs);
  font-weight: 500;
  opacity: 0.9;
  background: var(--border-hover);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-lg);
}


.play-timer-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: var(--space-1);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-timer-btn:hover {
  color: var(--color-success);
  background: var(--color-success-bg-light, rgba(34, 197, 94, 0.1));
}

.remove-from-calendar-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: var(--space-1);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
  line-height: 1;
}

.remove-from-calendar-btn:hover {
  color: var(--color-danger);
  background: var(--color-danger-bg-light);
}

/* ========================================
   TASK ENTRANCE ANIMATION
   ======================================== */

/* Keyframes for task appearing on calendar */
@keyframes task-appear {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* TransitionGroup animation classes */
.task-appear-enter-active {
  animation: task-appear var(--duration-normal) var(--spring-smooth);
}

.task-appear-leave-active {
  animation: task-appear var(--duration-fast) var(--spring-smooth) reverse;
}

.task-appear-move {
  transition: transform var(--duration-normal) var(--spring-smooth);
}

/* ========================================
   RTL (Right-to-Left) SUPPORT
   ======================================== */

/* Task title and meta inherit document direction */
.task-title,
.task-meta {
  direction: inherit;
  text-align: start;
}

/* RTL-specific styles - use element:dir(rtl) since dir="auto" is on the element itself */
.task-title:dir(rtl) {
  direction: rtl;
  unicode-bidi: plaintext;
  text-align: end;
}

.task-meta:dir(rtl) {
  direction: rtl;
  unicode-bidi: plaintext;
  text-align: end;
}

.task-content--calendar:dir(rtl) {
  text-align: end;
}

/* Flip project stripe from left to right in RTL */
:dir(rtl) .slot-task.is-primary {
  border-inline-start: 1px solid var(--border-subtle);
  border-inline-end: 4px solid var(--accent-primary);
  padding-inline-start: var(--space-3);
  padding-inline-end: calc(var(--space-3) - 2px);
}

:dir(rtl) .project-stripe {
  left: auto;
  right: 2px;
}

:dir(rtl) .priority-stripe {
  left: auto;
  right: 0;
}

/* ========================================
   TIMER-ACTIVE HIGHLIGHT
   Amber glow when task has active timer
   ======================================== */

.slot-task.timer-active-event {
  border-color: var(--timer-active-border);
  box-shadow: var(--timer-active-glow), var(--timer-active-shadow);
  animation: timer-pulse 2s ease-in-out infinite;
}

.slot-task.timer-active-event:hover {
  box-shadow: var(--timer-active-glow-strong), var(--timer-active-shadow-hover);
}

@keyframes timer-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

/* TASK-1409: Visual indicator for in-progress tasks */
.slot-task.status-active {
  border-inline-start: 3px solid var(--brand-primary);
  box-shadow: inset 3px 0 8px -3px var(--brand-primary-dim), 0 0 6px var(--brand-primary-subtle);
}

/* BUG-1304 + BUG-1343: Visual indicator for done tasks */
.slot-task.status-done {
  filter: grayscale(0.6) brightness(0.85);
  opacity: 0.55;
}

.slot-task.status-done .task-title {
  text-decoration: line-through;
}

/* TASK-1418: Virtual recurring event ghost styling */
.slot-task--virtual {
  opacity: 0.5;
  border-style: dashed !important;
  border-width: 1px;
  border-color: var(--brand-primary);
  background: var(--glass-bg-subtle) !important;
  pointer-events: none;
  cursor: default;
  position: relative;
}

.slot-task--virtual::after {
  content: '\1F501';
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 10px;
  opacity: 0.7;
}

/* TASK-1317 + TASK-1283 + TASK-1496: External calendar events (read-only overlays, side-by-side positioning) */
/* left/width/z-index are set via inline style from positionedExternalEvents */
.external-event {
  position: absolute;
  min-height: 18px;
  border-radius: var(--radius-sm);
  padding: 2px var(--space-1_5);
  color: var(--text-primary);
  pointer-events: none; /* Allow clicks/drags to pass through to time slots underneath */
  overflow: hidden;
  border-style: solid;
  border-width: 1px 1px 1px 3px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  cursor: default;
  backdrop-filter: blur(4px);
}

/* Tiny events (< 25min): single inline row */
.external-event--tiny {
  flex-direction: row;
  align-items: center;
  padding: 0 var(--space-1);
  gap: var(--space-1);
}

/* Small events (25-40min): tighter padding */
.external-event--small {
  padding: 1px var(--space-1);
}

.external-event-time {
  font-weight: var(--font-semibold);
  font-size: var(--text-xs);
  opacity: 0.8;
  line-height: 1.1;
  flex-shrink: 0;
}

.external-event-title {
  font-size: var(--text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

/* Inline layout for tiny events: "14:00 Event Title" on one line */
.external-event-inline {
  font-size: var(--text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.external-event-inline .external-event-time {
  margin-inline-end: var(--space-1);
  font-size: inherit;
}

/* Ensure readable text in both light and dark mode */
:root[data-theme="light"] .external-event,
.light .external-event {
  color: var(--text-primary);
}

:root[data-theme="dark"] .external-event,
.dark .external-event {
  color: var(--text-primary);
}
</style>
