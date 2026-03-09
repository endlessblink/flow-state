<template>
  <div class="pinned-section">
    <!-- Collapsible Header -->
    <button class="pinned-header" @click="$emit('toggleCollapse')">
      <ChevronRight
        :size="14"
        class="collapse-chevron"
        :class="{ expanded: !isCollapsed }"
      />
      <Pin :size="14" class="pin-icon" />
      <span class="pinned-label">Pinned</span>
      <span class="pinned-count">{{ tasks.length }}</span>
    </button>

    <!-- Task List -->
    <div v-if="!isCollapsed" class="pinned-tasks">
      <UnifiedInboxTaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :is-selected="selectedTaskIds.has(task.id)"
        :show-canvas-badge="showCanvasBadge"
        :compact="true"
        @drag-start="$emit('dragStart', $event, task)"
        @drag-end="$emit('dragEnd')"
        @task-click="$emit('taskClick', $event, task)"
        @task-dblclick="$emit('taskDblclick', task)"
        @task-contextmenu="$emit('taskContextmenu', $event, task)"
        @task-keydown="$emit('taskKeydown', $event, task)"
        @start-timer="$emit('startTimer', task)"
        @send-to-canvas="$emit('sendToCanvas', task)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, Pin } from 'lucide-vue-next'
import type { Task } from '@/types/tasks'
import UnifiedInboxTaskCard from './UnifiedInboxTaskCard.vue'

defineProps<{
  tasks: Task[]
  isCollapsed: boolean
  selectedTaskIds: Set<string>
  showCanvasBadge?: boolean
}>()

defineEmits<{
  (e: 'toggleCollapse'): void
  (e: 'dragStart', event: DragEvent, task: Task): void
  (e: 'dragEnd'): void
  (e: 'taskClick', event: MouseEvent, task: Task): void
  (e: 'taskDblclick', task: Task): void
  (e: 'taskContextmenu', event: MouseEvent, task: Task): void
  (e: 'taskKeydown', event: KeyboardEvent, task: Task): void
  (e: 'startTimer', task: Task): void
  (e: 'sendToCanvas', task: Task): void
}>()
</script>

<style scoped>
.pinned-section {
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: var(--space-2);
}

.pinned-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-1);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast) var(--ease-out);
  font-size: var(--text-sm);
}

.pinned-header:hover {
  background: var(--glass-bg-soft);
}

.collapse-chevron {
  transition: transform var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
}

.collapse-chevron.expanded {
  transform: rotate(90deg);
}

.pin-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.pinned-label {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.pinned-count {
  margin-inline-start: auto;
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
}

.pinned-tasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 240px;
  overflow-y: auto;
  padding: var(--space-1) 0;
}

/* Subtle scrollbar */
.pinned-tasks::-webkit-scrollbar {
  width: 4px;
}

.pinned-tasks::-webkit-scrollbar-track {
  background: transparent;
}

.pinned-tasks::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-full);
}
</style>
