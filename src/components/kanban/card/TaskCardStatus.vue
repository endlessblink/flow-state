<template>
  <button
    class="status-icon-button"
    :class="statusColorClass"
    :title="statusTooltip"
    :aria-label="statusTooltip"
    type="button"
    tabindex="-1"
    @click.stop="$emit('cycle')"
  >
    <component
      :is="statusIcon"
      :size="14"
      :stroke-width="1.5"
      aria-hidden="true"
    />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDays, Loader, CheckCircle, Inbox, PauseCircle } from 'lucide-vue-next'
import type { Task } from '@/stores/tasks'

const props = defineProps<{
  status?: Task['status']
}>()

defineEmits<{
  (e: 'cycle'): void
}>()

const statusIcon = computed(() => {
  switch (props.status) {
    case 'planned': return CalendarDays
    case 'in_progress': return Loader
    case 'done': return CheckCircle
    case 'backlog': return Inbox
    case 'on_hold': return PauseCircle
    default: return Inbox
  }
})

const statusColorClass = computed(() => {
  const status = props.status || 'backlog'
  return `status-${status}-icon`
})

const statusTooltip = computed(() => {
  const status = props.status || 'backlog'
  const labels: Record<string, string> = {
    'planned': 'Mark as in-progress',
    'in_progress': 'Mark as done',
    'done': 'Mark as backlog',
    'backlog': 'Mark as planned',
    'on_hold': 'Mark as planned'
  }
  return labels[status] || 'Change status'
})
</script>

<style scoped>
.status-icon-button {
  width: var(--task-card-icon-size, 24px);
  height: var(--task-card-icon-size, 24px);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-inline-end: var(--space-2);
  transition: all var(--duration-fast) ease;
  cursor: pointer;
  position: relative;
  background: rgba(255, 255, 255, 0.05);
}

.status-icon-button:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.status-icon-button:active {
  transform: scale(0.95);
}

/* Status Colors */
.status-planned-icon {
  border-color: var(--status-planned-border);
  background: var(--status-planned-bg);
  color: var(--status-planned-text);
}

.status-in_progress-icon {
  border-color: var(--status-in-progress-border);
  background: var(--status-in-progress-bg);
  color: var(--status-in-progress-text);
}

.status-done-icon {
  border-color: var(--status-done-border);
  background: var(--status-done-bg);
  color: var(--status-done-text);
}

.status-backlog-icon {
  border-color: var(--status-backlog-border);
  background: var(--status-backlog-bg);
  color: var(--status-backlog-text);
}

.status-on_hold-icon {
  border-color: var(--status-on-hold-border);
  background: var(--status-on-hold-bg);
  color: var(--status-on-hold-text);
}
</style>
