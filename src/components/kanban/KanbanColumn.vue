<template>
  <div class="kanban-column" :class="wipStatusClass">
    <div class="column-header">
      <div class="header-left">
        <span class="column-title">{{ title }}</span>
        <span class="task-count">{{ taskCount }}</span>
      </div>
      <button class="add-task-btn" @click="$emit('addTask', status)">
        <Plus :size="12" />
      </button>
    </div>

    <div class="tasks-container">
      <draggable
        v-model="localTasks"
        group="tasks"
        item-key="id"
        class="drag-area"
        :animation="200"
        ghost-class="ghost-card"
        chosen-class="chosen-card"
        drag-class="drag-card"
        :force-fallback="true"
        fallback-class="sortable-fallback"
        :fallback-tolerance="3"
        :scroll-sensitivity="100"
        :scroll-speed="20"
        bubble-scroll
        :delay="100"
        :delay-on-touch-only="true"
        :touch-start-threshold="5"
        :disabled="false"
        easing="cubic-bezier(0.25, 0.46, 0.45, 0.94)"
        tag="div"
        @change="handleDragChange"
      >
        <template #item="{ element: task }">
          <TaskCard
            :key="task.id"
            :task="task"
            class="task-item"
            @select="$emit('selectTask', $event)"
            @start-timer="$emit('startTimer', $event)"
            @edit="$emit('editTask', $event)"
            @delete="$emit('deleteTask', $event)"
            @context-menu="(event, task) => $emit('contextMenu', event, task)"
          />
        </template>

        <template #footer>
          <div v-if="tasks.length === 0" class="empty-column">
            <span class="empty-message">No {{ title.toLowerCase() }} tasks</span>
            <button class="add-first-task" @click="$emit('addTask', status)">
              <Plus :size="16" />
              Add {{ title.toLowerCase() }} task
            </button>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import TaskCard from './TaskCard.vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { Plus } from 'lucide-vue-next'

import './KanbanColumn.css'

interface Props {
  title: string
  status: Task['status']
  tasks: Task[]
  wipLimit?: number
}

const props = withDefaults(defineProps<Props>(), {
  wipLimit: 10
})

defineEmits<{
  addTask: [status: Task['status']]
  selectTask: [taskId: string]
  startTimer: [taskId: string]
  editTask: [taskId: string]
  deleteTask: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
}>()

const localTasks = ref([...props.tasks])
watch(() => props.tasks, (newTasks) => { localTasks.value = [...newTasks] })

const taskCount = computed(() => props.tasks.length)

const wipStatusClass = computed(() => {
  if (!props.wipLimit) return ''
  const count = taskCount.value
  const limit = props.wipLimit
  if (count >= limit) return 'wip-exceeded'
  if (count >= Math.floor(limit * 0.8)) return 'wip-warning'
  return ''
})

const taskStore = useTaskStore()

const handleDragChange = async (event: any) => {
  if (event.added) {
    try {
      await taskStore.moveTaskWithUndo(event.added.element.id, props.status)
    } catch (_error) {
      // Error moving task
    }
  }
}
</script>
