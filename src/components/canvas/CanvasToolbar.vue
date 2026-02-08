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

  /* Glass morphism - purple-tinted */
  background: var(--overlay-component-bg-strong);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-md);
}

.toolbar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
}

.toolbar-separator {
  width: var(--space-4);
  height: 1px;
  background: var(--glass-border);
  margin: var(--space-0_5) 0;
}

/* Icon buttons - compact size */
.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-6);
  height: var(--space-6);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.toolbar-btn:hover {
  background: var(--glass-border);
  color: var(--text-primary);
}

.toolbar-btn:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: var(--space-0_5);
}

/* Primary action button (Add Task) */
.toolbar-btn.primary {
  background: var(--color-indigo-bg-heavy);
  color: var(--color-indigo-light);
  border-color: var(--color-indigo-border);
}

.toolbar-btn.primary:hover {
  background: var(--color-indigo-bg-medium);
  box-shadow: var(--glow-indigo-md);
}

/* Toggle buttons */
.toolbar-btn.toggle {
  color: var(--text-muted);
}

.toolbar-btn.toggle:hover {
  color: var(--text-primary);
  background: var(--glass-bg-heavy);
}

.toolbar-btn.toggle.active {
  background: var(--glass-border);
  color: var(--text-primary);
}

.toolbar-btn.toggle.active.overdue {
  color: var(--color-orange);
  background: var(--orange-bg-soft);
  border-color: var(--orange-border);
}
</style>
