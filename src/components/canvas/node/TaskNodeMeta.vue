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

    <!-- Duration -->
    <span
      v-if="showDuration && duration"
      class="duration-badge"
      :class="durationBadgeClass"
      :title="`Duration: ${formattedDuration}`"
    >
      <component :is="durationIcon" :size="12" />
      {{ formattedDuration }}
    </span>

    <!-- Subtasks -->
    <span v-if="subtaskCount && subtaskCount > 0" class="subtask-badge" :class="{ 'subtask-complete': completedSubtaskCount === subtaskCount }" :title="`Subtasks: ${completedSubtaskCount}/${subtaskCount}`">
      <ListChecks :size="12" />
      {{ completedSubtaskCount }}/{{ subtaskCount }}
    </span>

    <!-- Done Indicator -->
    <span v-if="isDone" class="done-badge" title="Completed">
      <Check :size="12" />
      Done
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, Check, Clock, ListChecks } from 'lucide-vue-next'
import OverdueBadge from './OverdueBadge.vue'

const props = defineProps<{
  showStatus: boolean
  statusLabel: string
  dueDate?: string | null
  formattedDueDate: string
  showSchedule: boolean
  hasSchedule: boolean
  showDuration: boolean
  duration?: number
  durationBadgeClass: string
  durationIcon: any // Component type
  formattedDuration: string
  isDone: boolean
  isOverdue: boolean
  doneForNowUntil?: string | null
  subtaskCount?: number
  completedSubtaskCount?: number
}>()

// BUG-1187: Show "Done for now" badge when doneForNowUntil has a value
// Badge only clears when user explicitly clicks it (clearDoneForNow event)
const isDoneForNow = computed(() => {
  return !!props.doneForNowUntil
})

defineEmits<{
  reschedule: [dateType: string]
  clearDoneForNow: []
}>()
</script>

<style scoped>
.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.status-badge, .due-date-badge, .schedule-badge, .duration-badge, .done-badge, .done-for-now-badge, .subtask-badge {
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

.due-date-badge {
  color: var(--text-primary);
}

.done-badge {
  color: #10b981;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

/* "Done for now" badge - amber text to indicate rescheduled */
.done-for-now-badge {
  color: var(--amber-text, #f59e0b);
}

/* Clickable badges */
.clickable {
  cursor: pointer;
  transition: opacity var(--duration-fast) ease;
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
  color: #10b981;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
}
</style>
