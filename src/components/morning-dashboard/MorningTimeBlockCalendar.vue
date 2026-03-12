<script setup lang="ts">
import { ref, computed, provide, onMounted, onUnmounted } from 'vue'
import { useWindowSize } from '@vueuse/core'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import { ChevronLeft } from 'lucide-vue-next'
import CalendarDayView from '@/components/calendar/CalendarDayView.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import { useCalendarDayView } from '@/composables/calendar/useCalendarDayView'
import { useCalendarCore } from '@/composables/useCalendarCore'
import { useGoogleCalendar } from '@/composables/calendar/useGoogleCalendar'
import { useExternalCalendar } from '@/composables/calendar/useExternalCalendar'
import { useTaskStore } from '@/stores/tasks'
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
const taskStore = useTaskStore()
const sessionInstanceIds = ref<Set<string>>(new Set())

// --- Composables ---
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

// --- Composable must come after todayExternalEvents ---
const dayView = useCalendarDayView(currentDate, statusFilter, undefined, todayExternalEvents)

// --- Mobile detection ---
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 768)

// --- Mobile time-picker options ---
const timeOptions = computed(() => {
  const options: { label: string; value: string }[] = []
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hh = h.toString().padStart(2, '0')
      const mm = m.toString().padStart(2, '0')
      const ampm = h < 12 ? 'AM' : 'PM'
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
      options.push({ label: `${displayH}:${mm} ${ampm}`, value: `${hh}:${mm}` })
    }
  }
  return options
})

const durationSelectOptions = [
  { label: '25 min', value: 25 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
]

function updateStartTime(index: number, value: string | number | null) {
  if (typeof value === 'string') {
    emit('update:timeBlock', index, { ...props.timeBlocks[index], startTime: value })
  }
}

function updateDuration(index: number, value: string | number | null) {
  if (value != null) {
    emit('update:timeBlock', index, { ...props.timeBlocks[index], duration: Number(value) })
  }
}

function mobileEndTime(block: TimeBlock): string {
  if (!block.startTime) return ''
  const [h, m] = block.startTime.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return ''
  const totalMin = h * 60 + m + block.duration
  const endH = Math.floor(totalMin / 60) % 24
  const endM = totalMin % 60
  const ampm = endH < 12 ? 'AM' : 'PM'
  const displayH = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH
  return `${displayH}:${endM.toString().padStart(2, '0')} ${ampm}`
}

const hasOverlap = computed(() => {
  const placed = props.timeBlocks.filter(b => b.startTime)
  if (placed.length < 2) return false
  const ranges = placed.map(b => {
    const [h, m] = b.startTime.split(':').map(Number)
    const start = h * 60 + m
    return { start, end: start + b.duration }
  })
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (ranges[i].start < ranges[j].end && ranges[j].start < ranges[i].end) return true
    }
  }
  return false
})

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

// --- Provide calendar-helpers injection for CalendarDayView ---
const isCurrentTimeSlot = (slot: TimeSlot) => checkCurrentTimeSlot(slot, currentTime.value)

provide('calendar-helpers', {
  formatHour,
  formatEventTime,
  isCurrentTimeSlot,
  getTasksForSlot: dayView.getTasksForSlot,
  isTaskPrimarySlot: dayView.isTaskPrimarySlot,
  getSlotTaskStyle: dayView.getSlotTaskStyle,
  getProjectVisual,
  getProjectName,
  getProjectColor,
  getPriorityClass,
  getPriorityLabel,
  getTaskStatus,
  getStatusLabel,
  getStatusIcon,
  positionedExternalEvents: dayView.positionedExternalEvents,
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

// --- Instance cleanup helper ---
async function cleanupSlotInstance(index: number) {
  const slotObj = props.big3Slots[index]
  const taskId = slotObj?.taskId
  if (!taskId) return
  const task = taskStore._rawTasks.find(t => t.id === taskId)
  if (!task?.instances) return
  for (const inst of task.instances) {
    if (inst.id && sessionInstanceIds.value.has(inst.id)) {
      await taskStore.deleteTaskInstance(taskId, inst.id)
      sessionInstanceIds.value.delete(inst.id)
    }
  }
}

// --- Big3 sidebar drop handler (creates real TaskInstance) ---
async function handleCalendarDrop(event: DragEvent, slot: TimeSlot) {
  event.preventDefault()
  const data = event.dataTransfer?.getData('text/plain')
  if (!data) return
  try {
    const parsed = JSON.parse(data)
    if (parsed.type === 'big3' && typeof parsed.index === 'number') {
      const slotObj = props.big3Slots[parsed.index]
      const taskId = slotObj?.taskId
      if (!taskId) return
      const startTime = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
      const todayStr = getDateString(currentDate.value)

      // Delete existing session instance for this slot if re-placing
      await cleanupSlotInstance(parsed.index)

      const instance = await taskStore.createTaskInstance(taskId, {
        scheduledDate: todayStr,
        scheduledTime: startTime,
        duration: props.timeBlocks[parsed.index].duration,
        status: 'scheduled',
        isRecurring: false,
      })
      if (instance?.id) {
        sessionInstanceIds.value.add(instance.id)
      }
      emit('update:timeBlock', parsed.index, { ...props.timeBlocks[parsed.index], startTime })
    }
  } catch {
    // not our data
  }
}

// --- Click-to-place handler (creates real TaskInstance) ---
async function handleSlotClick(_event: MouseEvent, slot: TimeSlot) {
  if (selectedBig3Index.value !== null) {
    const idx = selectedBig3Index.value
    const slotObj = props.big3Slots[idx]
    const taskId = slotObj?.taskId
    if (!taskId) {
      selectedBig3Index.value = null
      return
    }
    const startTime = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
    const todayStr = getDateString(currentDate.value)

    await cleanupSlotInstance(idx)

    const instance = await taskStore.createTaskInstance(taskId, {
      scheduledDate: todayStr,
      scheduledTime: startTime,
      duration: props.timeBlocks[idx].duration,
      status: 'scheduled',
      isRecurring: false,
    })
    if (instance?.id) {
      sessionInstanceIds.value.add(instance.id)
    }
    emit('update:timeBlock', idx, { ...props.timeBlocks[idx], startTime })
    selectedBig3Index.value = null
  }
}

// --- Unplace a Big 3 task from the calendar (deletes real instance) ---
async function unplaceTask(index: number) {
  await cleanupSlotInstance(index)
  emit('update:timeBlock', index, { ...props.timeBlocks[index], startTime: '' })
}

// --- Combined handlers for calendar events (Big3 sidebar drags + native event repositioning) ---
function handleCombinedDrop(event: DragEvent, slot: TimeSlot) {
  // Check if this is a Big3 sidebar drag
  const textData = event.dataTransfer?.getData('text/plain')
  if (textData) {
    try {
      const parsed = JSON.parse(textData)
      if (parsed.type === 'big3') {
        handleCalendarDrop(event, slot)
        return
      }
    } catch { /* not JSON */ }
  }
  // Otherwise delegate to native calendar drop handler (event repositioning)
  dayView.handleDrop(event, slot)
}

function handleCombinedDragOver(event: DragEvent, slot: TimeSlot) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dayView.handleDragOver(event, slot)
}

function handleCombinedDragEnter(event: DragEvent, slot: TimeSlot) {
  event.preventDefault()
  dayView.handleDragEnter(event, slot)
}

function handleCombinedDragLeave() {
  dayView.handleDragLeave()
}

function handleRemoveFromCalendar(calEvent: CalendarEvent) {
  // If this was a session instance, clean up tracking
  if (calEvent.instanceId && sessionInstanceIds.value.has(calEvent.instanceId)) {
    sessionInstanceIds.value.delete(calEvent.instanceId)
  }
  // Find which Big3 slot this belongs to, if any, and clear its time
  const big3Index = props.big3Slots.findIndex(s => s.taskId === calEvent.taskId)
  if (big3Index !== -1) {
    emit('update:timeBlock', big3Index, { ...props.timeBlocks[big3Index], startTime: '' })
  }
  // Delete the instance
  if (calEvent.taskId && calEvent.instanceId) {
    taskStore.deleteTaskInstance(calEvent.taskId, calEvent.instanceId)
  }
}

// --- Back handler (cleans up session instances) ---
async function handleBack() {
  for (let i = 0; i < props.big3Slots.length; i++) {
    await cleanupSlotInstance(i)
  }
  sessionInstanceIds.value.clear()
  emit('back')
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
  <div :class="isMobile ? 'mobile-timeblock' : 'morning-calendar-layout'">
    <!-- ==================== MOBILE VIEW ==================== -->
    <template v-if="isMobile">
      <div class="mobile-tb-header">
        <button class="footer-btn footer-btn--back" type="button" @click="handleBack">
          <ChevronLeft :size="16" /> Back
        </button>
        <h3 class="mobile-tb-title">Time Block Your Big 3</h3>
        <span class="mobile-tb-subtitle">When will you work on each task?</span>
      </div>

      <div class="mobile-tb-cards">
        <div
          v-for="(slot, i) in big3Slots"
          :key="i"
          class="mobile-tb-card"
          :class="`mobile-tb-card--${i}`"
        >
          <div class="mobile-tb-task-info">
            <span class="mobile-tb-number">{{ i + 1 }}</span>
            <span class="mobile-tb-task-title">{{ slot.title || 'Empty slot' }}</span>
          </div>
          <div class="mobile-tb-controls">
            <CustomSelect
              :model-value="timeBlocks[i].startTime"
              :options="timeOptions"
              placeholder="Start time"
              :compact="true"
              @update:model-value="updateStartTime(i, $event)"
            />
            <CustomSelect
              :model-value="timeBlocks[i].duration"
              :options="durationSelectOptions"
              placeholder="Duration"
              :compact="true"
              @update:model-value="updateDuration(i, $event)"
            />
            <span v-if="timeBlocks[i].startTime" class="mobile-tb-end">
              until {{ mobileEndTime(timeBlocks[i]) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="hasOverlap" class="mobile-tb-warning">
        Time blocks overlap — consider adjusting
      </div>

      <!-- Mini timeline preview -->
      <div class="mobile-tb-timeline">
        <div class="mobile-tb-timeline-track">
          <div
            v-for="(block, i) in timeBlocks"
            :key="i"
            class="mobile-tb-timeline-block"
            :class="`mobile-tb-timeline-block--${i}`"
            :style="block.startTime ? {
              left: `${((parseInt(block.startTime.split(':')[0]) * 60 + parseInt(block.startTime.split(':')[1])) - 360) / 600 * 100}%`,
              width: `${block.duration / 600 * 100}%`,
            } : { display: 'none' }"
          >
            <span class="mobile-tb-timeline-label">{{ i + 1 }}</span>
          </div>
        </div>
        <div class="mobile-tb-timeline-hours">
          <span v-for="h in [6, 8, 10, 12, 14, 16, 18, 20, 22]" :key="h">
            {{ h > 12 ? h - 12 : h }}{{ h < 12 ? 'a' : 'p' }}
          </span>
        </div>
      </div>

      <button class="footer-btn footer-btn--start mobile-tb-start" type="button" @click="emit('start')">
        Start My Day
      </button>
    </template>

    <!-- ==================== DESKTOP VIEW ==================== -->
    <template v-else>
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
            <OverflowTooltip class="big3-title" :text="slot.title || 'Empty slot'" style="flex: 1; min-width: 0">{{ slot.title || 'Empty slot' }}</OverflowTooltip>
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
          :resize-preview="dayView.resizePreview.value"
          @drop="handleCombinedDrop"
          @dragover="handleCombinedDragOver"
          @dragenter="handleCombinedDragEnter"
          @dragleave="handleCombinedDragLeave"
          @slot-mouse-down="handleSlotClick"
          @event-mouse-enter="() => {}"
          @event-mouse-leave="() => {}"
          @event-drag-start="dayView.handleEventDragStart"
          @event-drag-end="dayView.handleEventDragEnd"
          @event-click="() => {}"
          @event-dbl-click="() => {}"
          @event-context-menu="() => {}"
          @cycle-status="() => {}"
          @remove-from-calendar="handleRemoveFromCalendar"
          @start-timer="() => {}"
          @start-resize="dayView.startResize"
        />
      </div>

      <!-- Footer -->
      <div class="morning-footer">
        <button class="footer-btn footer-btn--back" @click="handleBack">
          <ChevronLeft :size="16" />
          Back
        </button>
        <button class="footer-btn footer-btn--start" @click="emit('start')">
          Start My Day
        </button>
      </div>
    </template>
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
  position: sticky;
  top: 0;
  align-self: start;
  max-height: 100vh;
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

/* ==================== MOBILE TIME-BLOCK VIEW ==================== */
.mobile-timeblock {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2);
  height: 100%;
}

.mobile-tb-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.mobile-tb-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.mobile-tb-subtitle {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.mobile-tb-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.mobile-tb-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-md);
}

.mobile-tb-card--0 { border-left: 3px solid #4ECDC4; }
.mobile-tb-card--1 { border-left: 3px solid #FFC300; }
.mobile-tb-card--2 { border-left: 3px solid #9382DC; }

.mobile-tb-task-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.mobile-tb-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--glass-bg-heavy);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  flex-shrink: 0;
}

.mobile-tb-task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.mobile-tb-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.mobile-tb-end {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
}

.mobile-tb-warning {
  font-size: var(--text-xs);
  color: var(--color-warning);
  padding: var(--space-1) var(--space-2);
  background: rgba(255, 195, 0, 0.06);
  border-radius: var(--radius-sm);
}

/* Mini timeline */
.mobile-tb-timeline {
  padding: var(--space-2) 0;
}

.mobile-tb-timeline-track {
  position: relative;
  height: 24px;
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  overflow: hidden;
}

.mobile-tb-timeline-block {
  position: absolute;
  top: 2px;
  height: 20px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
}

.mobile-tb-timeline-block--0 {
  background: rgba(78, 205, 196, 0.3);
  border: 1px solid var(--brand-primary);
}

.mobile-tb-timeline-block--1 {
  background: rgba(255, 195, 0, 0.25);
  border: 1px solid var(--color-warning);
}

.mobile-tb-timeline-block--2 {
  background: rgba(147, 130, 220, 0.25);
  border: 1px solid #9382dc;
}

.mobile-tb-timeline-label {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--text-primary);
}

.mobile-tb-timeline-hours {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0 0;
  font-size: 0.55rem;
  color: var(--text-muted);
}

.mobile-tb-start {
  width: 100%;
  justify-content: center;
  animation: pulse-teal 2s ease-in-out infinite;
}

@keyframes pulse-teal {
  0%, 100% { box-shadow: 0 0 0 0 rgba(78, 205, 196, 0.4); }
  50% { box-shadow: 0 0 20px 4px rgba(78, 205, 196, 0.2); }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-tb-start { animation: none; }
}
</style>
