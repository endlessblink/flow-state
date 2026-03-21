<template>
  <div class="mini-canvas-empty">
    <div class="empty-icon">
      <Lightbulb :size="40" :stroke-width="1.2" />
    </div>
    <h3 class="empty-title">Start Planning</h3>
    <p class="empty-description">
      Add subtasks or notes to visually plan this task.
      Use the toolbar buttons or right-click the canvas.
    </p>
    <div class="empty-actions">
      <button class="empty-btn primary" @click="$emit('add-subtask')">
        <CheckSquare :size="16" />
        Add Subtask
      </button>
      <button class="empty-btn secondary" @click="$emit('add-note')">
        <StickyNote :size="16" />
        Add Note
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Lightbulb, CheckSquare, StickyNote } from 'lucide-vue-next'

defineEmits<{
  'add-subtask': []
  'add-note': []
}>()
</script>

<style scoped>
.mini-canvas-empty {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: auto;
  z-index: 5;
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.4;
  margin-bottom: var(--space-4);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.empty-description {
  font-size: var(--text-sm);
  color: var(--text-muted);
  max-width: 320px;
  line-height: 1.5;
  margin: 0 0 var(--space-5);
}

.empty-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.empty-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.empty-btn.primary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  backdrop-filter: blur(8px);
}

.empty-btn.primary:hover {
  background: var(--brand-primary-alpha-10);
}

.empty-btn.secondary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  backdrop-filter: blur(8px);
}

.empty-btn.secondary:hover {
  background: var(--surface-hover);
  border-color: var(--glass-border-hover);
}
</style>
