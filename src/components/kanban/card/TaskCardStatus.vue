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
      :size="12"
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
/* Minimal checkbox style - TickTick inspired */
.status-icon-button {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-inline-end: var(--space-3);
  transition: all var(--duration-fast) ease;
  cursor: pointer;
  position: relative;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
}

.status-icon-button:hover {
  border-color: rgba(255, 255, 255, 0.5);
  color: rgba(255, 255, 255, 0.6);
}

.status-icon-button:active {
  transform: scale(0.9);
}

/* All statuses look the same - just circle */
.status-planned-icon,
.status-in_progress-icon,
.status-done-icon,
.status-backlog-icon,
.status-on_hold-icon {
  border-color: rgba(255, 255, 255, 0.3);
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
}

/* Only done status shows filled */
.status-done-icon {
  border-color: rgba(34, 197, 94, 0.6);
  background: rgba(34, 197, 94, 0.2);
  color: rgba(34, 197, 94, 0.8);
}
</style>
