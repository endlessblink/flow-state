<template>
  <div class="task-row__priority">
    <span
      v-if="priority"
      class="task-row__priority-badge task-row__priority-badge--clickable"
      :class="{
        'task-row__priority-badge--high': priority === 'high',
        'task-row__priority-badge--medium': priority === 'medium',
        'task-row__priority-badge--low': priority === 'low'
      }"
      title="Click to change priority"
      @click.stop="$emit('cycle')"
    >
      {{ formattedPriority }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, defineProps, defineEmits } from 'vue'

const props = defineProps<{
  priority?: string | null
}>()

defineEmits<{
  (e: 'cycle'): void
}>()

const formattedPriority = computed(() => {
  const map: Record<string, string> = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'urgent': 'Urgent'
  }
  return map[props.priority || 'medium'] || props.priority
})
</script>

<style scoped>
.task-row__priority {
  grid-area: priority; /* Explicit Area */
  display: flex; /* Ensure it behaves as a container */
  align-items: center; /* Vertical center */
}

/* Priority Badge */
.task-row__priority-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  border: 1px solid transparent;
}

.task-row__priority-badge--clickable {
  cursor: pointer;
  transition: all var(--duration-fast);
}

.task-row__priority-badge--clickable:hover {
  transform: translateY(-1px);
  filter: brightness(1.2);
}

.task-row__priority-badge--high {
  color: var(--priority-high-text);
  background-color: var(--priority-high-bg);
  border-color: var(--priority-high-border);
}

.task-row__priority-badge--medium {
  color: var(--priority-medium-text);
  background-color: var(--priority-medium-bg);
  border-color: var(--priority-medium-border);
}

.task-row__priority-badge--low {
  color: var(--priority-low-text);
  background-color: var(--priority-low-bg);
  border-color: var(--priority-low-border);
}
</style>
