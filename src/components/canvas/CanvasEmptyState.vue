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
  gap: 1.5rem;
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
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  text-align: center;
}

.empty-description {
  font-size: 1rem;
  color: var(--color-text-secondary);
  margin: 0;
  text-align: center;
  max-width: 400px;
  line-height: 1.5;
}

.empty-actions {
  display: flex;
  gap: 1rem;
}

.empty-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.empty-btn.primary {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: var(--color-primary);
}

.empty-btn.primary:hover {
  background: rgba(99, 102, 241, 0.2);
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
