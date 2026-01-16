<template>
  <div class="compact-actions" role="group" aria-label="Task actions">
    <button
      class="action-btn timer-btn"
      title="Start Pomodoro Timer"
      aria-label="Start Pomodoro timer for this task"
      type="button"
      tabindex="-1"
      @click.stop="$emit('startTimer')"
    >
      <Play :size="12" aria-hidden="true" />
    </button>
    <button
      class="action-btn edit-btn"
      title="Edit Task"
      aria-label="Edit this task"
      type="button"
      tabindex="-1"
      @click.stop="$emit('edit')"
    >
      <Edit :size="12" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Play, Edit } from 'lucide-vue-next'

defineEmits<{
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
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.action-btn:hover {
  background: var(--glass-bg-base);
  color: var(--text-primary);
  border-color: var(--glass-border-hover);
  transform: translateY(-1px);
}
</style>
