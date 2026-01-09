<template>
  <div class="canvas-toolbar absolute flex items-center gap-3 top-4 right-4 z-[100]">
    <!-- Primary Actions Group -->
    <div class="toolbar-group flex items-center gap-1 p-1 rounded-lg glass-panel">
      <!-- Add Task -->
      <button
        class="toolbar-btn primary"
        title="Add Task to Inbox"
        @click="$emit('addTask')"
      >
        <Plus :size="16" />
        <span class="text-xs font-semibold ml-1">New Task</span>
      </button>

      <!-- Add Group -->
      <button
        class="toolbar-btn"
        title="Create New Group"
        @click="$emit('createGroup', $event)"
      >
        <FolderPlus :size="16" />
      </button>
    </div>

    <!-- Filter Controls Group -->
    <div class="toolbar-group flex items-center gap-1 p-1 rounded-lg glass-panel">
      <!-- Hide Overdue Tasks Toggle (TASK-082) -->
      <button
        class="toolbar-toggle"
        :class="{ 'active overdue': taskStore.hideCanvasOverdueTasks }"
        :title="taskStore.hideCanvasOverdueTasks ? 'Show overdue tasks' : 'Hide overdue tasks'"
        @click="taskStore.hideCanvasOverdueTasks = !taskStore.hideCanvasOverdueTasks"
      >
        <CalendarX v-if="taskStore.hideCanvasOverdueTasks" :size="16" />
        <Calendar v-else :size="16" />
      </button>

      <!-- Hide Done Tasks Toggle (TASK-080) -->
      <button
        class="toolbar-toggle"
        :class="{ 'active done': taskStore.hideCanvasDoneTasks }"
        :title="taskStore.hideCanvasDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'"
        @click="taskStore.toggleCanvasDoneTasks()"
      >
        <EyeOff v-if="taskStore.hideCanvasDoneTasks" :size="16" />
        <Eye v-else :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, FolderPlus, Calendar, CalendarX, Eye, EyeOff } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'

defineEmits<{
  (e: 'addTask'): void
  (e: 'createGroup', event: MouseEvent): void
}>()

const taskStore = useTaskStore()
</script>

<style scoped>
.glass-panel {
  background: rgba(30, 30, 40, 0.85); /* Dark glass */
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  cursor: pointer;
  border: 1px solid transparent;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.toolbar-btn.primary {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  border-color: rgba(99, 102, 241, 0.3);
}

.toolbar-btn.primary:hover {
  background: rgba(99, 102, 241, 0.3);
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.2);
}

.toolbar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--text-muted);
  transition: all 0.2s ease;
  cursor: pointer;
}

.toolbar-toggle:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.toolbar-toggle.active {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.toolbar-toggle.active.overdue {
  color: #fb923c; /* Orange-400 */
  background: rgba(251, 146, 60, 0.15);
  border: 1px solid rgba(251, 146, 60, 0.2);
}

.toolbar-toggle.active.done {
  color: #a78bfa; /* Purple-400 */
  background: rgba(167, 139, 250, 0.15);
  border: 1px solid rgba(167, 139, 250, 0.2);
}
</style>
