<template>
  <button
    class="priority-dot"
    :class="priorityClass"
    :title="priorityTooltip"
    :aria-label="priorityTooltip"
    type="button"
    tabindex="-1"
    @click.stop="$emit('cycle')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/stores/tasks'

const props = defineProps<{
  priority?: Task['priority']
  status?: Task['status']
}>()

defineEmits<{
  (e: 'cycle'): void
}>()

const priorityClass = computed(() => {
  const p = props.priority || 'none'
  return `priority-${p}`
})

const priorityTooltip = computed(() => {
  const labels: Record<string, string> = {
    'high': 'High priority',
    'medium': 'Medium priority',
    'low': 'Low priority',
    'none': 'No priority'
  }
  return labels[props.priority || 'none'] || 'Click to change'
})
</script>

<style scoped>
/* Simple priority dot - clean, minimal */
.priority-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: none;
  flex-shrink: 0;
  margin-inline-end: var(--space-3);
  transition: all var(--duration-fast) ease;
  cursor: pointer;
  padding: 0;
}

.priority-dot:hover {
  transform: scale(1.2);
  box-shadow: 0 0 8px currentColor;
}

.priority-dot:active {
  transform: scale(0.9);
}

/* Priority colors */
.priority-high {
  background: var(--color-priority-high, #ef4444);
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
}

.priority-medium {
  background: var(--color-priority-medium, #f59e0b);
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.3);
}

.priority-low {
  background: var(--color-priority-low, #3b82f6);
  box-shadow: 0 0 6px rgba(59, 130, 246, 0.3);
}

.priority-none,
.priority-null {
  background: rgba(255, 255, 255, 0.2);
}
</style>
