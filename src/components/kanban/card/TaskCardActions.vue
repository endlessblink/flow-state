<template>
  <div class="compact-actions" role="group" aria-label="Task actions">
    <NTooltip trigger="hover" :delay="400">
      <template #trigger>
        <button
          class="action-btn focus-btn"
          aria-label="Enter focus mode for this task"
          type="button"

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

          @click.stop="$emit('startTimer')"
        >
          <Play :size="14" aria-hidden="true" />
        </button>
      </template>
      Start Timer
    </NTooltip>
  </div>
</template>

<script setup lang="ts">
import { Eye, Play } from 'lucide-vue-next'
import { NTooltip } from 'naive-ui'

defineEmits<{
  (e: 'focusMode'): void
  (e: 'startTimer'): void
}>()
</script>

<style scoped>
.compact-actions {
  display: flex;
  flex-direction: row;
  gap: 0;
  flex-shrink: 0;
  /* Hidden by default - parent handles hover visibility */
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  opacity: 0.45;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.action-btn :deep(svg) {
  shape-rendering: crispEdges;
  stroke-width: 2;
}

.action-btn:hover {
  opacity: 1;
  background: var(--glass-bg-soft);
  color: var(--text-primary);
}

.focus-btn:hover {
  color: var(--color-accent);
}
</style>
