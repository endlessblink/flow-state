<template>
  <div class="task-metadata">
    <!-- Status -->
    <span
      v-if="showStatus"
      class="status-badge"
      :class="statusClass"
    >{{ statusLabel }}</span>

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

    <!-- Done Indicator -->
    <span v-if="isDone" class="done-badge" title="Completed">
      <Check :size="12" />
      Done
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, Check } from 'lucide-vue-next'
import OverdueBadge from './OverdueBadge.vue'

const props = defineProps<{
  showStatus: boolean
  statusLabel: string
  status?: string // 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
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

// Compute status class for badge styling
const statusClass = computed(() => {
  if (!props.status) return ''
  // Convert status to CSS class format (e.g., 'in_progress' -> 'status-badge--in-progress')
  const normalizedStatus = props.status.replace(/_/g, '-')
  return `status-badge--${normalizedStatus}`
})

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
  gap: var(--space-1);
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

/* Status-specific badge colors using design tokens */
.status-badge {
  font-weight: var(--font-medium);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.status-badge--planned {
  background: var(--status-planned-bg);
  border-color: var(--status-planned-border);
  color: var(--status-planned-text);
  box-shadow: 0 0 8px var(--status-planned-bg);
}

.status-badge--in-progress {
  background: var(--status-in-progress-bg);
  border-color: var(--status-in-progress-border);
  color: var(--status-in-progress-text);
  box-shadow: 0 0 8px var(--status-in-progress-bg);
}

.status-badge--done {
  background: var(--status-done-bg);
  border-color: var(--status-done-border);
  color: var(--status-done-text);
  box-shadow: 0 0 8px var(--status-done-bg);
}

.status-badge--backlog {
  background: var(--status-backlog-bg);
  border-color: var(--status-backlog-border);
  color: var(--status-backlog-text);
  /* No glow for backlog - more subtle appearance */
}

.status-badge--on-hold {
  background: var(--status-on-hold-bg);
  border-color: var(--status-on-hold-border);
  color: var(--status-on-hold-text);
  box-shadow: 0 0 8px var(--status-on-hold-bg);
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
