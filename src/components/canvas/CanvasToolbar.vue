<template>
  <!-- Teleport to body to render OUTSIDE canvas containment -->
  <Teleport to="body">
    <div class="canvas-toolbar-edge">
      <!-- Primary Actions Group -->
      <div class="toolbar-group">
        <!-- Add Task -->
        <button
          class="toolbar-btn primary"
          title="Add Task to Inbox"
          aria-label="Add new task"
          @click="$emit('addTask')"
        >
          <Plus :size="14" />
        </button>

        <!-- Add Group -->
        <button
          class="toolbar-btn"
          title="Create New Group"
          aria-label="Create new group"
          @click="$emit('createGroup', $event)"
        >
          <FolderPlus :size="14" />
        </button>
      </div>

      <!-- Separator -->
      <div class="toolbar-separator" />

      <!-- Filter Controls Group -->
      <div class="toolbar-group">
        <!-- Hide Overdue Tasks Toggle (TASK-082) -->
        <button
          class="toolbar-btn toggle"
          :class="{ 'active overdue': taskStore.hideCanvasOverdueTasks }"
          :title="taskStore.hideCanvasOverdueTasks ? 'Show overdue tasks' : 'Hide overdue tasks'"
          :aria-label="taskStore.hideCanvasOverdueTasks ? 'Show overdue tasks' : 'Hide overdue tasks'"
          :aria-pressed="taskStore.hideCanvasOverdueTasks"
          @click="taskStore.toggleCanvasOverdueTasks()"
        >
          <CalendarX v-if="taskStore.hideCanvasOverdueTasks" :size="14" />
          <Calendar v-else :size="14" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Plus, FolderPlus, Calendar, CalendarX } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'

defineEmits<{
  (e: 'addTask'): void
  (e: 'createGroup', event: MouseEvent): void
}>()

const taskStore = useTaskStore()
</script>

<style scoped>
/* Edge-mounted vertical toolbar - positioned at viewport right edge, aligned with canvas top */
.canvas-toolbar-edge {
  position: fixed;
  right: 0px;

  /* ADJUST THIS VALUE to align with canvas top */
  top: 239px;

  z-index: 1000;

  /* Vertical flex layout */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1_5);

  /* Rounded corners */
  border-radius: var(--radius-md);

  /* Glass morphism */
  background: rgba(30, 30, 40, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

.toolbar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
}

.toolbar-separator {
  width: 16px;
  height: 1px;
  background: var(--glass-border);
  margin: var(--space-0_5) 0;
}

/* Icon buttons - compact size */
.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.toolbar-btn:hover {
  background: var(--glass-border);
  color: var(--text-primary, #fff);
}

.toolbar-btn:focus-visible {
  outline: 2px solid var(--brand-primary, #6366f1);
  outline-offset: 2px;
}

/* Primary action button (Add Task) */
.toolbar-btn.primary {
  background: var(--color-indigo-bg-heavy);
  color: #818cf8;
  border-color: rgba(99, 102, 241, 0.3);
}

.toolbar-btn.primary:hover {
  background: rgba(99, 102, 241, 0.35);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
}

/* Toggle buttons */
.toolbar-btn.toggle {
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
}

.toolbar-btn.toggle:hover {
  color: var(--text-primary, #fff);
  background: var(--glass-bg-heavy);
}

.toolbar-btn.toggle.active {
  background: var(--glass-border);
  color: var(--text-primary, #fff);
}

.toolbar-btn.toggle.active.overdue {
  color: #fb923c; /* Orange-400 */
  background: rgba(251, 146, 60, 0.15);
  border-color: rgba(251, 146, 60, 0.25);
}
</style>
