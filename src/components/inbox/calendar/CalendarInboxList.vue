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
      @dragstart="$emit('taskDragstart', $event, task)"
      @dragend="$emit('taskDragend')"
      @click="$emit('taskClick', $event, task)"
      @dblclick="$emit('taskDblclick', task)"
      @contextmenu="$emit('taskContextmenu', $event, task)"
      @keydown="$emit('taskKeydown', $event, task)"
      @startTimer="$emit('taskStartTimer', task)"
      @edit="$emit('taskEdit', task)"
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
  (e: 'taskDragstart', event: DragEvent, task: Task): void
  (e: 'taskDragend'): void
  (e: 'taskClick', event: MouseEvent, task: Task): void
  (e: 'taskDblclick', task: Task): void
  (e: 'taskContextmenu', event: MouseEvent, task: Task): void
  (e: 'taskKeydown', event: KeyboardEvent, task: Task): void
  (e: 'taskStartTimer', task: Task): void
  (e: 'taskEdit', task: Task): void
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
  font-size: var(--space-8);
  margin-bottom: var(--space-2);
  opacity: 0.5;
}

.empty-text {
  font-size: var(--text-sm);
  max-width: 200px;
  line-height: 1.5;
}
</style>
