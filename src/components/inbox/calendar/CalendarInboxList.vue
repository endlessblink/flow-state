<template>
  <div class="inbox-tasks">
    <!-- Empty State -->
    <div v-if="tasks.length === 0" class="empty-inbox">
      <div class="empty-icon">
        <component :is="hasGroupFilter ? Layers : ClipboardList" :size="28" stroke-width="1.6" />
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
      :show-canvas-badge="showCanvasBadge"
      @dragstart="$emit('taskDragstart', $event, task)"
      @dragend="$emit('taskDragend')"
      @click="$emit('taskClick', $event, task)"
      @dblclick="$emit('taskDblclick', task)"
      @contextmenu="$emit('taskContextmenu', $event, task)"
      @keydown="$emit('taskKeydown', $event, task)"
      @start-timer="$emit('taskStartTimer', task)"
      @edit="$emit('taskEdit', task)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import CalendarTaskCard from './CalendarTaskCard.vue'
import { ClipboardList, Layers } from 'lucide-vue-next'

defineProps<{
  tasks: Task[]
  hasGroupFilter: boolean
  showCanvasBadge?: boolean
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
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
  margin-top: var(--space-2);
  padding: 0 var(--space-1_5) var(--space-10) 0;
  scrollbar-gutter: stable;
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
  align-items: center;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  display: flex;
  height: 44px;
  justify-content: center;
  margin-bottom: var(--space-2);
  opacity: 0.5;
  width: 44px;
}

.empty-text {
  font-size: var(--text-sm);
  max-width: 200px;
  line-height: 1.5;
}
</style>
