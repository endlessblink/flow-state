<template>
  <div class="canvas-empty-state">
    <Inbox :size="64" class="empty-icon" />
    <h2 class="empty-title">
      Your canvas is empty
    </h2>
    <p class="empty-description">
      Add your first task to get started with visual organization
    </p>
    <div class="empty-actions">
      <button class="empty-btn primary" @click="$emit('addTask')">
        <Plus :size="16" />
        Add Task
      </button>
      <button class="empty-btn secondary" @click="$emit('createGroup')">
        <FolderPlus :size="16" />
        Create Group
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Inbox, Plus, FolderPlus } from 'lucide-vue-next'

defineEmits<{
  (e: 'addTask'): void
  (e: 'createGroup'): void
}>()
</script>

<style scoped>
.canvas-empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  z-index: 10;
  pointer-events: none; /* Allow clicking through to canvas if needed, but button needs pointer-events auto */
}

/* Re-enable pointer events for interactive children */
.canvas-empty-state > * {
  pointer-events: auto;
}

.empty-icon {
  color: var(--text-tertiary);
  opacity: 0.5;
}

.empty-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  text-align: center;
}

.empty-description {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
  max-width: 400px;
  line-height: 1.5;
}

.empty-actions {
  display: flex;
  gap: var(--space-4);
}

.empty-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
}

.empty-btn.primary {
  background: var(--color-indigo-bg-subtle);
  border: 1px solid var(--color-indigo-bg-heavy);
  color: var(--color-primary);
}

.empty-btn.primary:hover {
  background: var(--color-indigo-bg-heavy);
  border-color: var(--color-indigo-border);
  transform: translateY(-1px);
  box-shadow: var(--glow-indigo-sm);
}

.empty-btn.secondary {
  background: var(--purple-bg-soft);
  border: 1px solid var(--purple-border);
  color: var(--color-purple-light);
}

.empty-btn.secondary:hover {
  background: var(--purple-bg-medium);
  border-color: var(--purple-border-hover);
  transform: translateY(-1px);
  box-shadow: var(--glow-purple-sm);
}

.empty-btn:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}
</style>
