<template>
  <div class="compact-actions" role="group" aria-label="Task actions">
    <NTooltip trigger="hover" :delay="400">
      <template #trigger>
        <button
          class="action-btn focus-btn"
          aria-label="Enter focus mode for this task"
          type="button"
          tabindex="-1"
          @click.stop="$emit('focusMode')"
        >
          <Eye :size="14" aria-hidden="true" />
        </button>
      </template>
      Focus Mode
    </NTooltip>
    <NTooltip trigger="hover" :delay="400">
      <template #trigger>
        <button
          class="action-btn timer-btn"
          aria-label="Start Pomodoro timer for this task"
          type="button"
          tabindex="-1"
          @click.stop="$emit('startTimer')"
        >
          <Play :size="14" aria-hidden="true" />
        </button>
      </template>
      Start Timer
    </NTooltip>
    <NTooltip trigger="hover" :delay="400">
      <template #trigger>
        <button
          class="action-btn edit-btn"
          aria-label="Edit this task"
          type="button"
          tabindex="-1"
          @click.stop="$emit('edit')"
        >
          <Edit :size="14" aria-hidden="true" />
        </button>
      </template>
      Edit Task
    </NTooltip>
    <NTooltip trigger="hover" :delay="400">
      <template #trigger>
        <button
          class="action-btn bell-action-btn"
          :class="{ 'has-reminders': props.reminders && props.reminders.filter(r => !r.dismissed).length > 0 }"
          aria-label="Task reminders"
          type="button"
          tabindex="-1"
          @click.stop="$emit('toggleReminders')"
        >
          <Bell :size="14" aria-hidden="true" />
        </button>
      </template>
      Reminders
    </NTooltip>
  </div>
</template>

<script setup lang="ts">
import { Eye, Play, Edit, Bell } from 'lucide-vue-next'
import { NTooltip } from 'naive-ui'

const props = defineProps<{
  reminders?: import('@/types/notifications').TaskReminder[]
}>()

defineEmits<{
  (e: 'focusMode'): void
  (e: 'startTimer'): void
  (e: 'edit'): void
  (e: 'toggleReminders'): void
}>()
</script>

<style scoped>
.compact-actions {
  display: flex;
  flex-direction: column;
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

.bell-action-btn.has-reminders {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}
</style>
