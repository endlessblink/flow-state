<template>
  <div class="inbox-tasks">
    <!-- Empty State -->
    <div v-if="tasks.length === 0" class="empty-inbox">
      <div class="empty-icon">
        {{ hasGroupFilter ? '🎯' : '📋' }}
      </div>
      <p class="empty-text">
        {{ hasGroupFilter
          ? 'No tasks in this group. Drag tasks to these groups on the Canvas.'
          : 'No tasks in inbox'
        }}
      </p>
    </div>

    <!-- Task Cards -->
    <CalendarTaskCard
      v-for="task in tasks"
      :key="task.id"
      :task="task"
      :is-timer-active="isTimerActive(task.id)"
      @dragstart="$emit('task-dragstart', $event, task)"
      @dragend="$emit('task-dragend')"
      @click="$emit('task-click', $event, task)"
      @dblclick="$emit('task-dblclick', task)"
      @contextmenu="$emit('task-contextmenu', $event, task)"
      @keydown="$emit('task-keydown', $event, task)"
      @start-timer="$emit('task-start-timer', task)"
      @edit="$emit('task-edit', task)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import CalendarTaskCard from './CalendarTaskCard.vue'

defineProps<{
  tasks: Task[]
  hasGroupFilter: boolean
}>()

defineEmits<{
  (e: 'task-dragstart', event: DragEvent, task: Task): void
  (e: 'task-dragend'): void
  (e: 'task-click', event: MouseEvent, task: Task): void
  (e: 'task-dblclick', task: Task): void
  (e: 'task-contextmenu', event: MouseEvent, task: Task): void
  (e: 'task-keydown', event: KeyboardEvent, task: Task): void
  (e: 'task-start-timer', task: Task): void
  (e: 'task-edit', task: Task): void
}>()

const timerStore = useTimerStore()

const isTimerActive = computed(() => (taskId: string) => {
  return timerStore.isTimerActive && timerStore.currentTaskId === taskId
})
</script>

<style scoped>
.inbox-tasks {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-bottom: var(--space-8); /* BUG-203: prevent last task cropping */
}

.empty-inbox {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-muted);
  text-align: center;
  padding: var(--space-4);
}

.empty-icon {
  font-size: 32px;
  margin-bottom: var(--space-2);
  opacity: 0.5;
}

.empty-text {
  font-size: var(--text-sm);
  max-width: 200px;
  line-height: 1.5;
}
</style>
