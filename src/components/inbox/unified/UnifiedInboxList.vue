<template>
  <div class="inbox-tasks scroll-container">
    <!-- Empty State -->
    <div v-if="tasks.length === 0" class="empty-inbox">
      <div class="empty-icon">
        {{ hasSelectedGroups ? '🎯' : '📋' }}
      </div>
      <p class="empty-text">
        {{ emptyText }}
      </p>
      <p class="empty-subtext">
        {{ emptySubtext }}
      </p>
    </div>

    <!-- Selection Bar -->
    <div v-if="multiSelectMode" class="selection-bar">
      <span class="selection-count">{{ selectedCount }} selected</span>
      <button class="selection-action delete-action" title="Delete selected tasks" @click="$emit('deleteSelected')">
        <Trash2 :size="14" />
        Delete
      </button>
      <button class="selection-action clear-action" title="Clear selection (Esc)" @click="$emit('clearSelection')">
        <X :size="14" />
        Clear
      </button>
    </div>

    <!-- Task Cards -->
    <UnifiedInboxTaskCard
      v-for="task in tasks"
      :key="task.id"
      :task="task"
      :is-selected="selectedTaskIds.has(task.id)"
      @drag-start="$emit('dragStart', $event, task)"
      @drag-end="$emit('dragEnd')"
      @task-click="$emit('taskClick', $event, task)"
      @task-dblclick="$emit('taskDblclick', task)"
      @task-contextmenu="$emit('taskContextmenu', $event, task)"
      @task-keydown="$emit('taskKeydown', $event, task)"
      @start-timer="$emit('startTimer', task)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Trash2, X } from 'lucide-vue-next'
import type { Task } from '@/types/tasks'
import UnifiedInboxTaskCard from './UnifiedInboxTaskCard.vue'

const props = defineProps<{
  tasks: Task[]
  selectedTaskIds: Set<string>
  multiSelectMode: boolean
  hasSelectedGroups: boolean
  areGlobalsFiltered: boolean // If global sidebar filters are active
}>()

defineEmits<{
  (e: 'dragStart', event: DragEvent, task: Task): void
  (e: 'dragEnd'): void
  (e: 'taskClick', event: MouseEvent, task: Task): void
  (e: 'taskDblclick', task: Task): void
  (e: 'taskContextmenu', event: MouseEvent, task: Task): void
  (e: 'taskKeydown', event: KeyboardEvent, task: Task): void
  (e: 'startTimer', task: Task): void
  (e: 'deleteSelected'): void
  (e: 'clearSelection'): void
}>()

const selectedCount = computed(() => props.selectedTaskIds.size)

// Empty State Logic
const emptyText = computed(() => {
  if (props.hasSelectedGroups) {
    // We can't know the exact count in group here without passing prop, 
    // but generalizing is fine for AI readability
    return 'No tasks in selected groups'
  }
  return 'No tasks found'
})

const emptySubtext = computed(() => {
  if (props.hasSelectedGroups) {
    return 'Drag tasks to these groups on the Canvas.'
  }
  if (!props.areGlobalsFiltered) { // If filtering returns 0 but filteredTasks was 0
    return 'All filtered tasks are already on the board/calendar' // Default assumption
  }
  return 'No tasks match your current view filters'
})
</script>

<style scoped>
.inbox-tasks {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  /* Firefox thin scrollbar (webkit styles in global styles.css - scoped doesn't work with pseudo-elements) */
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

.empty-inbox {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 32px;
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.empty-text {
  font-weight: var(--font-medium);
  margin-bottom: var(--space-1);
}

.empty-subtext {
  font-size: var(--text-xs);
  max-width: 200px;
}

/* Selection Bar */
.selection-bar {
  position: sticky;
  top: -8px; /* Stick near top */
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--brand-primary);
  color: white;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
  box-shadow: var(--shadow-md);
  animation: slide-in 0.2s ease-out;
}

@keyframes slide-in {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.selection-count {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.selection-action {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s;
}

.selection-action:hover {
  background: rgba(255, 255, 255, 0.3);
}

.delete-action:hover {
  background: var(--color-error);
}
</style>
