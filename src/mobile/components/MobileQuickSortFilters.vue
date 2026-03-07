<template>
  <div class="action-bar">
    <button class="action-btn done" @click="$emit('mark-done')">
      <CheckCircle :size="20" />
      <span>Done</span>
    </button>
    <button class="action-btn save" @click="$emit('save')">
      <Save :size="20" />
      <span>Save</span>
      <span v-if="isTaskDirty" class="dirty-dot" />
    </button>
    <button class="action-btn assign" @click="$emit('assign')">
      <FolderOpen :size="20" />
      <span>Assign</span>
    </button>
    <button class="action-btn delete" @click="$emit('delete')">
      <Trash2 :size="20" />
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  CheckCircle, Save, FolderOpen, Trash2
} from 'lucide-vue-next'
import type { Task } from '@/types/tasks'

defineProps<{
  currentTask: Task | null
  isToday: boolean
  isTomorrow: boolean
  isWeekend: boolean
  isTaskDirty: boolean
}>()

defineEmits<{
  (e: 'mark-done'): void
  (e: 'save'): void
  (e: 'assign'): void
  (e: 'delete'): void
}>()
</script>

<style scoped>
/* Action buttons — sits right under the card */
.action-bar {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5) var(--space-2);
  flex-shrink: 0;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5);
  min-height: 48px;
  padding: var(--space-2_5) var(--space-2);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  -webkit-tap-highlight-color: transparent;
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn.done {
  color: var(--color-success);
  border-color: var(--success-border);
}

.action-btn.done:active {
  background: var(--success-bg-subtle);
}

.action-btn.save {
  color: var(--brand-primary);
  border-color: var(--state-hover-border);
  position: relative;
}

.action-btn.save:active {
  background: var(--state-hover-bg);
}

.action-btn.assign {
  color: var(--brand-primary);
  border-color: var(--state-hover-border);
}

.action-btn.assign:active {
  background: var(--state-hover-bg);
}

.action-btn.delete {
  flex: 0 0 auto;
  padding: var(--space-2_5);
  color: var(--color-danger);
  border-color: var(--danger-border-subtle);
}

.action-btn.delete:active {
  background: var(--danger-bg-subtle);
}

.dirty-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  animation: dirty-pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes dirty-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

@media (prefers-reduced-motion: reduce) {
  .dirty-dot {
    animation: none !important;
  }
}

[dir="rtl"] .action-bar {
  flex-direction: row-reverse;
}

[dir="rtl"] .action-btn {
  flex-direction: row-reverse;
}
</style>
