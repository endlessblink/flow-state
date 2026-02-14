<template>
  <div class="compact-actions" role="group" aria-label="Task actions">
    <button
      class="action-btn focus-btn"
      title="Focus Mode (F)"
      aria-label="Enter focus mode for this task"
      type="button"
      tabindex="-1"
      @click.stop="$emit('focusMode')"
    >
      <Eye :size="14" aria-hidden="true" />
    </button>
    <button
      class="action-btn timer-btn"
      title="Start Pomodoro Timer"
      aria-label="Start Pomodoro timer for this task"
      type="button"
      tabindex="-1"
      @click.stop="$emit('startTimer')"
    >
      <Play :size="14" aria-hidden="true" />
    </button>
    <button
      class="action-btn edit-btn"
      title="Edit Task"
      aria-label="Edit this task"
      type="button"
      tabindex="-1"
      @click.stop="$emit('edit')"
    >
      <Edit :size="14" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Eye, Play, Edit } from 'lucide-vue-next'

defineEmits<{
  (e: 'focusMode'): void
  (e: 'startTimer'): void
  (e: 'edit'): void
}>()
</script>

<style scoped>
.compact-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
  /* Hidden by default - parent handles hover visibility */
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.action-btn :deep(svg) {
  shape-rendering: crispEdges;
  stroke-width: 2.5;
}

.action-btn:hover {
  background: var(--glass-bg-base);
  color: var(--text-primary);
  border-color: var(--glass-border-hover);
}

.focus-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
</style>
