<script setup lang="ts">
import { ref, computed, provide, onMounted, onUnmounted } from 'vue'
import { ChevronLeft } from 'lucide-vue-next'
import CalendarDayView from '@/components/calendar/CalendarDayView.vue'
import { useCalendarDayView } from '@/composables/calendar/useCalendarDayView'
import { useCalendarCore } from '@/composables/useCalendarCore'
import { useGoogleCalendar } from '@/composables/calendar/useGoogleCalendar'
import { useExternalCalendar } from '@/composables/calendar/useExternalCalendar'
import type { CalendarEvent } from '@/types/tasks'
import type { TimeSlot } from '@/composables/calendar/useCalendarDayView'
import type { Big3Slot, TimeBlock } from '@/composables/useMorningDashboard'

const props = defineProps<{
  big3Slots: Big3Slot[]
  timeBlocks: TimeBlock[]
}>()

const emit = defineEmits<{
  (e: 'update:timeBlock', index: number, block: TimeBlock): void
  (e: 'back'): void
  (e: 'start'): void
}>()

// --- Core state ---
const currentDate = ref(new Date())
const statusFilter = ref<string | null>(null)
const currentTime = ref(new Date())

// --- Composables ---
const dayView = useCalendarDayView(currentDate, statusFilter)
const {
  formatHour,
  formatEventTime,
  isCurrentTimeSlot: checkCurrentTimeSlot,
  getProjectVisual,
  getProjectName,
  getProjectColor,
  getPriorityClass,
  getPriorityLabel,
  getTaskStatus,
  getStatusLabel,
  getStatusIcon,
  getDateString,
} = useCalendarCore()

const googleCalendar = useGoogleCalendar()
const externalCalendar = useExternalCalendar()

// --- Big 3 accent colors ---
const BIG3_COLORS = ['#4ECDC4', '#FFC300', '#9382DC'] as const

// --- Duration cycling ---
const durationOptions = [25, 30, 45, 60, 90, 120] as const

function cycleDuration(index: number) {
  const current = props.timeBlocks[index].duration
  const currentIdx = durationOptions.indexOf(current as typeof durationOptions[number])
  const nextIdx = (currentIdx + 1) % durationOptions.length
  emit('update:timeBlock', index, { ...props.timeBlocks[index], duration: durationOptions[nextIdx] })
}

// --- Click-to-place mode ---
const selectedBig3Index = ref<number | null>(null)

function selectBig3ForPlacement(index: number) {
  selectedBig3Index.value = selectedBig3Index.value === index ? null : index
}

// --- Convert Big3 tasks to CalendarEvents ---
const big3CalendarEvents = computed<CalendarEvent[]>(() => {
  const events: CalendarEvent[] = []

  props.big3Slots.forEach((slot, i) => {
    if (!slot.title.trim() || !props.timeBlocks[i].startTime) return

    const block = props.timeBlocks[i]
    const [h, m] = block.startTime.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return

    const startTime = new Date(currentDate.value)
    startTime.setHours(h, m, 0, 0)
    const endTime = new Date(startTime.getTime() + block.duration * 60000)

    const startSlot = h * 2 + (m >= 30 ? 1 : 0)
    const slotSpan = Math.max(1, Math.ceil(block.duration / 30))

    events.push({
      id: `big3-${i}`,
      taskId: slot.taskId ?? `big3-${i}`,
      instanceId: `big3-instance-${i}`,
      title: slot.title,
      startTime,
      endTime,
      duration: block.duration,
      startSlot,
      slotSpan,
      color: BIG3_COLORS[i],
      column: 0,
      totalColumns: 1,
      isDueDate: false,
      projectId: undefined,
      instanceStatus: 'scheduled',
      taskStatus: 'todo',
    })
  })
  return events
})

// --- Override slot helpers to include Big 3 events ---
function getTasksForSlotWithBig3(slot: TimeSlot): CalendarEvent[] {
  const regularTasks = dayView.getTasksForSlot(slot)
  const big3InSlot = big3CalendarEvents.value.filter(ev => {
    const evEndSlot = ev.startSlot + ev.slotSpan
    return slot.slotIndex >= ev.startSlot && slot.slotIndex < evEndSlot
  })
  return [...regularTasks, ...big3InSlot]
}

function isTaskPrimarySlotWithBig3(slot: TimeSlot, event: CalendarEvent): boolean {
  if (event.id.startsWith('big3-')) {
    return event.startSlot === slot.slotIndex
  }
  return dayView.isTaskPrimarySlot(slot, event)
}

function getSlotTaskStyleWithBig3(task: CalendarEvent): Record<string, string> {
  if (task.id.startsWith('big3-')) {
    const baseHeight = (task.slotSpan * 30) - 4
    return {
      height: `${baseHeight}px`,
      minHeight: `${baseHeight}px`,
      zIndex: '10',
      '--is-compact': task.duration <= 30 ? '1' : '0',
    }
  }
  // dayView.getSlotTaskStyle returns a style object — cast as needed
  const style = dayView.getSlotTaskStyle(task)
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(style)) {
    result[key] = String(val)
  }
  return result
}

// --- Provide calendar-helpers injection for CalendarDayView ---
const isCurrentTimeSlot = (slot: TimeSlot) => checkCurrentTimeSlot(slot, currentTime.value)

provide('calendar-helpers', {
  formatHour,
  formatEventTime,
  isCurrentTimeSlot,
  getTasksForSlot: getTasksForSlotWithBig3,
  isTaskPrimarySlot: isTaskPrimarySlotWithBig3,
  getSlotTaskStyle: getSlotTaskStyleWithBig3,
  getProjectVisual,
  getProjectName,
  getProjectColor,
  getPriorityClass,
  getPriorityLabel,
  getTaskStatus,
  getStatusLabel,
  getStatusIcon,
})

// --- External events (merged Google + iCal) for today ---
const mergedExternalEvents = computed(() => [
  ...(googleCalendar.showGoogleEvents.value ? googleCalendar.googleEvents.value : []),
  ...externalCalendar.allEvents.value,
])

const todayExternalEvents = computed(() => {
  const dateStr = getDateString(currentDate.value)
  return mergedExternalEvents.value.filter(event => {
    const d = event.startTime
    const eventDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return eventDate === dateStr
  })
})

// --- Time indicator ---
const timeIndicatorPosition = computed(() => {
  const hours = currentTime.value.getHours()
  const minutes = currentTime.value.getMinutes()
  return (hours * 60) + minutes
})

// --- Drag handlers for placing Big 3 tasks ---
function onBig3DragStart(event: DragEvent, index: number) {
  event.dataTransfer?.setData('text/plain', JSON.stringify({ type: 'big3', index }))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function handleDragOver(event: DragEvent, _slot: TimeSlot) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleDragEnter(event: DragEvent, _slot: TimeSlot) {
  event.preventDefault()
}

function handleDragLeave() {
  // no-op
}

function handleCalendarDrop(event: DragEvent, slot: TimeSlot) {
  event.preventDefault()
  const data = event.dataTransfer?.getData('text/plain')
  if (!data) return
  try {
    const parsed = JSON.parse(data)
    if (parsed.type === 'big3' && typeof parsed.index === 'number') {
      const startTime = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
      emit('update:timeBlock', parsed.index, { ...props.timeBlocks[parsed.index], startTime })
    }
  } catch {
    // not our data
  }
}

function handleSlotClick(_event: MouseEvent, slot: TimeSlot) {
  if (selectedBig3Index.value !== null) {
    const startTime = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
    emit('update:timeBlock', selectedBig3Index.value, { ...props.timeBlocks[selectedBig3Index.value], startTime })
    selectedBig3Index.value = null
  }
}

// --- Unplace a Big 3 task from the calendar ---
function unplaceTask(index: number) {
  emit('update:timeBlock', index, { ...props.timeBlocks[index], startTime: '' })
}

// --- Helper: format time for display ---
function formatTime12h(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return time
  const ampm = h < 12 ? 'AM' : 'PM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

// --- Timer for currentTime updates ---
let timeUpdateInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  currentTime.value = new Date()
  timeUpdateInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 30000)
})

onUnmounted(() => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval)
    timeUpdateInterval = null
  }
})
</script>

<template>
  <div class="morning-calendar-layout">
    <!-- Big 3 Sidebar -->
    <div class="big3-sidebar">
      <h4 class="sidebar-title">Your Big 3</h4>
      <div
        v-for="(slot, i) in big3Slots"
        :key="i"
        class="big3-task-card"
        :class="{
          'big3-task-card--placed': timeBlocks[i].startTime,
          'big3-task-card--selected': selectedBig3Index === i,
          [`big3-task-card--${i}`]: true,
        }"
        draggable="true"
        @dragstart="onBig3DragStart($event, i)"
        @click="selectBig3ForPlacement(i)"
      >
        <span class="big3-number">{{ i + 1 }}</span>
        <div class="big3-info">
          <span class="big3-title">{{ slot.title || 'Empty slot' }}</span>
          <span v-if="timeBlocks[i].startTime" class="big3-time">
            {{ formatTime12h(timeBlocks[i].startTime) }}
            <button
              class="big3-duration-btn"
              title="Click to cycle duration"
              @click.stop="cycleDuration(i)"
            >
              {{ timeBlocks[i].duration }}min
            </button>
            <button
              class="big3-unplace-btn"
              title="Remove from calendar"
              @click.stop="unplaceTask(i)"
            >
              &times;
            </button>
          </span>
          <span v-else class="big3-hint">Drag or tap, then tap a slot</span>
        </div>
      </div>
      <p class="sidebar-hint">Tap a task, then tap a time slot to place it</p>
    </div>

    <!-- Calendar -->
    <div class="calendar-wrapper">
      <CalendarDayView
        :time-slots="dayView.timeSlots.value"
        :hours="dayView.hours"
        :is-viewing-today="true"
        :time-indicator-position="timeIndicatorPosition"
        :drag-ghost="dayView.dragGhost.value"
        :active-drop-slot="dayView.activeDropSlot.value"
        :is-dragging="dayView.isDragging.value"
        :dragged-event-id="dayView.draggedEventId.value"
        :hovered-event-id="null"
        :external-events="todayExternalEvents"
        @drop="handleCalendarDrop"
        @dragover="handleDragOver"
        @dragenter="handleDragEnter"
        @dragleave="handleDragLeave"
        @slot-mouse-down="handleSlotClick"
        @event-mouse-enter="() => {}"
        @event-mouse-leave="() => {}"
        @event-drag-start="() => {}"
        @event-drag-end="() => {}"
        @event-click="() => {}"
        @event-dbl-click="() => {}"
        @event-context-menu="() => {}"
        @cycle-status="() => {}"
        @remove-from-calendar="() => {}"
        @start-timer="() => {}"
        @start-resize="() => {}"
      />
    </div>

    <!-- Footer -->
    <div class="morning-footer">
      <button class="footer-btn footer-btn--back" @click="emit('back')">
        <ChevronLeft :size="16" />
        Back
      </button>
      <button class="footer-btn footer-btn--start" @click="emit('start')">
        Start My Day
      </button>
    </div>
  </div>
</template>

<style scoped>
.morning-calendar-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 1fr auto;
  gap: var(--space-3);
  height: 100%;
  min-height: 0;
}

/* --- Big 3 Sidebar --- */
.big3-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
  overflow-y: auto;
}

.sidebar-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-1) 0;
}

.sidebar-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-1) 0 0 0;
  line-height: 1.4;
}

/* --- Big 3 Task Card --- */
.big3-task-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-md);
  cursor: grab;
  transition: all var(--duration-fast);
  user-select: none;
}

.big3-task-card:hover {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border);
}

.big3-task-card:active {
  cursor: grabbing;
}

.big3-task-card--selected {
  border-color: var(--brand-primary);
  background: var(--brand-primary-subtle, rgba(78, 205, 196, 0.08));
  box-shadow: 0 0 0 1px var(--brand-primary);
}

.big3-task-card--placed {
  opacity: 0.75;
}

/* Color accents via left border */
.big3-task-card--0 { border-left: 3px solid #4ECDC4; }
.big3-task-card--1 { border-left: 3px solid #FFC300; }
.big3-task-card--2 { border-left: 3px solid #9382DC; }

.big3-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--glass-bg-heavy);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  flex-shrink: 0;
  margin-top: 1px;
}

.big3-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  min-width: 0;
  flex: 1;
}

.big3-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.big3-time {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.big3-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-style: italic;
}

.big3-duration-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  padding: 0 var(--space-1);
  cursor: pointer;
  transition: all var(--duration-fast);
  backdrop-filter: blur(4px);
}

.big3-duration-btn:hover {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

.big3-unplace-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: var(--text-sm);
  cursor: pointer;
  padding: 0 var(--space-0_5);
  line-height: 1;
  transition: color var(--duration-fast);
}

.big3-unplace-btn:hover {
  color: var(--color-danger);
}

/* --- Calendar Wrapper --- */
.calendar-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

.calendar-wrapper::-webkit-scrollbar {
  width: 6px;
}

.calendar-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.calendar-wrapper::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
}

/* --- Footer --- */
.morning-footer {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}

.footer-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
  backdrop-filter: blur(8px);
}

.footer-btn--back {
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.footer-btn--back:hover {
  color: var(--text-primary);
  border-color: var(--glass-border);
  background: var(--glass-bg-medium);
}

.footer-btn--start {
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
}

.footer-btn--start:hover {
  background: var(--brand-primary-subtle, rgba(78, 205, 196, 0.12));
  border-color: var(--brand-primary-hover);
  color: var(--brand-primary-hover);
}

/* --- Mobile --- */
@media (max-width: 768px) {
  .morning-calendar-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }

  .big3-sidebar {
    flex-direction: row;
    overflow-x: auto;
    gap: var(--space-2);
    padding: var(--space-2);
    scrollbar-width: none;
  }

  .big3-sidebar::-webkit-scrollbar {
    display: none;
  }

  .big3-sidebar .sidebar-title,
  .big3-sidebar .sidebar-hint {
    display: none;
  }

  .big3-task-card {
    min-width: 140px;
    flex-shrink: 0;
  }

  .morning-footer {
    padding: var(--space-2) 0;
  }
}
</style>
