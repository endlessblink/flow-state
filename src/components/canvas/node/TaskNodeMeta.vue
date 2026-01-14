<template>
  <div class="task-metadata">
    <!-- Status -->
    <span v-if="showStatus" class="status-badge">{{ statusLabel }}</span>

    <!-- TASK-282: Overdue Badge (takes priority over regular due date display) -->
    <OverdueBadge
      v-if="isOverdue"
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

    <!-- Done Indicator -->
    <span v-if="isDone" class="done-badge" title="Completed">
      <Check :size="12" />
      Done
    </span>
  </div>
</template>

<script setup lang="ts">
import { Calendar, Check } from 'lucide-vue-next'
import OverdueBadge from './OverdueBadge.vue'

defineProps<{
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
}>()

defineEmits<{
  reschedule: [dateType: string]
}>()
</script>

<style scoped>
.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.status-badge, .due-date-badge, .schedule-badge, .duration-badge, .done-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
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

/* Duration Styles */
.duration-quick { color: var(--color-success); border-color: var(--color-success-dim); }
.duration-short { color: var(--color-info); border-color: var(--color-info-dim); }
.duration-medium { color: var(--color-warning); border-color: var(--color-warning-dim); }
.duration-long { color: var(--color-error); border-color: var(--color-error-dim); }
</style>
