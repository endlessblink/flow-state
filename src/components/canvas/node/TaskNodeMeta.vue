<template>
  <div class="task-metadata">
    <!-- Status -->
    <span v-if="showStatus" class="status-badge">{{ statusLabel }}</span>

    <!-- "Done for now" Badge - shows when task was rescheduled via this feature -->
    <span
      v-if="isDoneForNow"
      class="done-for-now-badge clickable"
      title="Click to clear"
      @click.stop="$emit('clearDoneForNow')"
    >
      <Clock :size="12" />
      Done for now
    </span>

    <!-- TASK-282: Overdue Badge (takes priority over regular due date display) -->
    <OverdueBadge
      v-if="isOverdue"
      :current-due-date="dueDate"
      @reschedule="(dateType) => $emit('reschedule', dateType)"
    />

    <!-- Due Date (only show if not overdue) -->
    <span v-else-if="dueDate" class="due-date-badge" title="Due Date">
      <Calendar :size="12" />
      {{ formattedDueDate }}
    </span>

    <!-- Schedule -->
    <span v-if="showSchedule && hasSchedule" class="schedule-badge" title="Scheduled">
      📅
    </span>

    <!-- Work block: duration is the commitment, not a promise to finish -->
    <div
      v-if="showDuration"
      ref="workBlockRef"
      class="work-block"
      @click.stop
      @mousedown.stop
      @pointerdown.stop
      @touchstart.stop
    >
      <button
        v-if="!duration"
        ref="workBlockTriggerRef"
        type="button"
        class="work-block-trigger work-block-trigger--empty"
        title="Set how long to work on this task today"
        aria-label="Set work block length"
        :aria-expanded="isDurationPickerOpen"
        @click.stop.prevent="toggleDurationPicker"
        @mousedown.stop
        @pointerdown.stop
      >
        <Clock :size="12" />
        Set work block
      </button>

      <button
        v-else
        ref="workBlockTriggerRef"
        type="button"
        class="work-block-trigger"
        :class="[durationBadgeClass, { 'work-block-trigger--enough': isEnoughForToday }]"
        :title="workBlockTitle"
        aria-label="Change work block length"
        :aria-expanded="isDurationPickerOpen"
        @click.stop.prevent="toggleDurationPicker"
        @mousedown.stop
        @pointerdown.stop
      >
        <Check v-if="isEnoughForToday" :size="12" />
        <component :is="durationIcon" v-else :size="12" />
        {{ workBlockLabel }}
      </button>
    </div>

    <!-- Subtasks -->
    <span
      v-if="subtaskCount && subtaskCount > 0"
      class="subtask-badge"
      :class="{ 'subtask-complete': completedSubtaskCount === subtaskCount }"
      :title="`Subtasks: ${completedSubtaskCount}/${subtaskCount}`"
    >
      <ListChecks :size="12" />
      {{ completedSubtaskCount }}/{{ subtaskCount }}
    </span>

    <!-- Recurring -->
    <span
      v-if="recurrenceRule"
      class="recurring-badge"
      :title="recurrenceDescription"
    >
      <Repeat :size="12" />
      Recurring
    </span>

    <!-- Done Indicator -->
    <span v-if="isDone" class="done-badge" title="Completed">
      <Check :size="12" />
      Done
    </span>

    <Teleport to="body">
      <div
        v-if="isDurationPickerOpen"
        ref="workBlockPickerRef"
        class="work-block-picker"
        :style="workBlockPickerStyle"
        @click.stop
        @mousedown.stop
        @pointerdown.stop
        @touchstart.stop
      >
        <button
          v-for="option in quickDurationOptions"
          :key="option.value"
          type="button"
          class="work-block-option"
          :class="{ 'is-active': duration === option.value }"
          @click.stop.prevent="setWorkBlock(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Calendar, Check, Clock, ListChecks, Repeat } from 'lucide-vue-next'
import OverdueBadge from './OverdueBadge.vue'
import { describeRecurrenceRule } from '@/utils/recurrenceUtils'
import type { SimpleRecurrenceRule } from '@/types/tasks'

const props = defineProps<{
  showStatus: boolean
  statusLabel: string
  dueDate?: string | null
  formattedDueDate: string
  showSchedule: boolean
  hasSchedule: boolean
  showDuration: boolean
  duration?: number
  isEnoughForToday?: boolean
  workedMinutesToday?: number
  durationBadgeClass: string
  durationIcon: unknown // Component type
  formattedDuration: string
  isDone: boolean
  isOverdue: boolean
  doneForNowUntil?: string | null
  subtaskCount?: number
  completedSubtaskCount?: number
  recurrenceRule?: SimpleRecurrenceRule | null
}>()

const emit = defineEmits<{
  reschedule: [dateType: string]
  clearDoneForNow: []
  setWorkBlock: [duration: number]
}>()

const isDurationPickerOpen = ref(false)
const workBlockRef = ref<HTMLElement>()
const workBlockTriggerRef = ref<HTMLElement>()
const workBlockPickerRef = ref<HTMLElement>()
const workBlockPickerStyle = ref<Record<string, string>>({})

const quickDurationOptions = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 }
] as const

const workBlockLabel = computed(() => {
  if (props.isEnoughForToday) return 'Enough today'
  return `Work ${props.formattedDuration}`
})

const workBlockTitle = computed(() => {
  if (!props.duration) return 'Set how long to work on this task today'
  if (props.isEnoughForToday) return `Enough for today: worked ${props.workedMinutesToday || 0}m of ${props.duration}m`
  return `Change work block length. Worked ${props.workedMinutesToday || 0}m of ${props.duration}m today.`
})

const positionWorkBlockPicker = () => {
  const trigger = workBlockTriggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  workBlockPickerStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`
  }
}

const toggleDurationPicker = async () => {
  isDurationPickerOpen.value = !isDurationPickerOpen.value
  if (isDurationPickerOpen.value) {
    await nextTick()
    positionWorkBlockPicker()
  }
}

const setWorkBlock = async (duration: number) => {
  isDurationPickerOpen.value = false
  emit('setWorkBlock', duration)
}

const closeDurationPickerOnOutsideClick = (event: MouseEvent) => {
  if (!isDurationPickerOpen.value) return
  if (workBlockRef.value?.contains(event.target as Node)) return
  if (workBlockPickerRef.value?.contains(event.target as Node)) return
  isDurationPickerOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeDurationPickerOnOutsideClick)
  window.addEventListener('scroll', positionWorkBlockPicker, true)
  window.addEventListener('resize', positionWorkBlockPicker)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDurationPickerOnOutsideClick)
  window.removeEventListener('scroll', positionWorkBlockPicker, true)
  window.removeEventListener('resize', positionWorkBlockPicker)
})

// BUG-1187: Show "Done for now" badge when doneForNowUntil has a value
// Badge only clears when user explicitly clicks it (clearDoneForNow event)
const isDoneForNow = computed(() => {
  return !!props.doneForNowUntil
})

const recurrenceDescription = computed(() => {
  if (!props.recurrenceRule) return ''
  return describeRecurrenceRule(props.recurrenceRule)
})

</script>

<style scoped>
.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.status-badge, .due-date-badge, .schedule-badge, .done-badge, .done-for-now-badge, .subtask-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.work-block {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.work-block-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.2;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}

.work-block-trigger:hover,
.work-block-trigger[aria-expanded="true"] {
  color: var(--text-primary);
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
}

.work-block-trigger--empty {
  color: var(--color-warning);
  border-color: var(--color-warning-dim);
  border-style: dashed;
}

.work-block-trigger--enough {
  color: var(--color-success);
  background: var(--green-bg-soft);
  border-color: var(--green-border);
}

.work-block-picker {
  position: fixed;
  z-index: var(--z-submenu-popover, 10003);
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-md);
  box-shadow: var(--overlay-component-shadow);
}

.work-block-option {
  min-width: 34px;
  padding: var(--space-1) var(--space-1_5);
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}

.work-block-option:hover,
.work-block-option.is-active {
  color: var(--text-primary);
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
}

.due-date-badge {
  color: var(--text-primary);
}

.done-badge {
  color: var(--color-success);
  background: var(--green-bg-soft);
  border: 1px solid var(--green-border);
}

/* "Done for now" badge - amber text to indicate rescheduled */
.done-for-now-badge {
  color: var(--color-amber);
}

/* Clickable badges */
.clickable {
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.clickable:hover {
  opacity: 0.7;
}

/* Duration Styles */
.duration-quick { color: var(--color-success); border-color: var(--color-success-dim); }
.duration-short { color: var(--color-info); border-color: var(--color-info-dim); }
.duration-medium { color: var(--color-warning); border-color: var(--color-warning-dim); }
.duration-long { color: var(--color-error); border-color: var(--color-error-dim); }

/* Subtask Badge Styles */
.subtask-badge {
  color: var(--text-secondary);
}

.subtask-complete {
  color: var(--color-success);
  background: var(--green-bg-soft);
  border: 1px solid var(--green-border);
}

/* Recurring Badge */
.recurring-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--brand-primary);
}
</style>
