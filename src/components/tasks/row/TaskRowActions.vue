<template>
  <div class="task-row__actions">
    <button
      class="task-row__action-btn task-row__action-btn--ai"
      :title="$t('task.ai_suggest') + ' (Ctrl+.)'"
      :aria-label="$t('task.ai_suggest')"
      @click.stop="$emit('aiSuggest', $event)"
    >
      <Zap :size="14" />
    </button>
    <button
      class="task-row__action-btn task-row__action-btn--focus"
      :title="$t('task.focus_mode') + ' (F)'"
      :aria-label="$t('task.focus_mode')"
      @click.stop="$emit('focusMode')"
    >
      <Eye :size="14" />
    </button>
    <button
      class="task-row__action-btn"
      :title="$t('task.start_timer')"
      :aria-label="$t('task.start_timer')"
      @click.stop="$emit('startTimer')"
    >
      <Play :size="14" />
    </button>
    <button
      class="task-row__action-btn"
      :title="$t('task.edit_task')"
      :aria-label="$t('task.edit_task')"
      @click.stop="$emit('edit')"
    >
      <Edit :size="14" />
    </button>
    <button
      class="task-row__action-btn"
      :title="$t('task.duplicate_task')"
      :aria-label="$t('task.duplicate_task')"
      @click.stop="$emit('duplicate')"
    >
      <Copy :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Eye, Play, Edit, Copy, Zap } from 'lucide-vue-next'

defineEmits<{
  (e: 'aiSuggest', event: MouseEvent): void
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
  /* opacity managed in HierarchicalTaskRow.css (unscoped) for cross-component hover */
}

.task-row__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-6);
  height: var(--space-6);
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

.task-row__action-btn--ai:hover {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}
</style>
