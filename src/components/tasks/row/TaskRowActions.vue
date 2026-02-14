<template>
  <div class="task-row__actions">
    <button
      class="task-row__action-btn task-row__action-btn--focus"
      title="Focus Mode (F)"
      aria-label="Enter focus mode"
      @click.stop="$emit('focusMode')"
    >
      <Eye :size="14" />
    </button>
    <button
      class="task-row__action-btn"
      title="Start Timer"
      aria-label="Start timer"
      @click.stop="$emit('startTimer')"
    >
      <Play :size="14" />
    </button>
    <button
      class="task-row__action-btn"
      title="Edit Task"
      aria-label="Edit task"
      @click.stop="$emit('edit')"
    >
      <Edit :size="14" />
    </button>
    <button
      class="task-row__action-btn"
      title="Duplicate Task"
      aria-label="Duplicate task"
      @click.stop="$emit('duplicate')"
    >
      <Copy :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Eye, Play, Edit, Copy } from 'lucide-vue-next'

defineEmits<{
  (e: 'focusMode'): void
  (e: 'startTimer'): void
  (e: 'edit'): void
  (e: 'duplicate'): void
}>()
</script>

<style scoped>
.task-row__actions {
  grid-area: actions; /* Explicit Area */
  display: flex;
  align-items: center;
  gap: var(--space-1);
  justify-content: flex-end;
  opacity: 0; /* Hidden by default */
  transition: opacity var(--duration-fast);
}

/* Show actions on row hover */
:deep(.task-row:hover) .task-row__actions,
.task-row__actions:focus-within {
  opacity: 1;
}

.task-row__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.task-row__action-btn:hover {
  background-color: var(--glass-bg-medium);
  color: var(--text-primary);
  border-color: var(--glass-border);
}

.task-row__action-btn--focus:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
</style>
