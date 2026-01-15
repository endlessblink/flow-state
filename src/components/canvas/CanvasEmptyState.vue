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
  color: var(--color-text-tertiary);
  opacity: 0.5;
}

.empty-title {
  font-size: var(--space-6);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  text-align: center;
}

.empty-description {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
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
  border-radius: 0.5rem;
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.empty-btn.primary {
  background: var(--color-indigo-bg-subtle);
  border: 1px solid var(--color-indigo-bg-heavy);
  color: var(--color-primary);
}

.empty-btn.primary:hover {
  background: var(--color-indigo-bg-heavy);
  border-color: rgba(99, 102, 241, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.empty-btn.secondary {
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}

.empty-btn.secondary:hover {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
}

.empty-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
