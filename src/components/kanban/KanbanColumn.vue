<template>
  <div class="kanban-column" :class="wipStatusClass">
    <div class="column-header">
      <div class="header-left">
        <span
          v-if="columnIndicatorColor"
          class="column-priority-dot"
          :style="{ background: columnIndicatorColor as string }"
        />
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
        :group="dragGroup"
        item-key="id"
        class="drag-area"
        :animation="200"
        ghost-class="ghost-card"
        chosen-class="chosen-card"
        drag-class="drag-card"
        force-fallback
        fallback-class="sortable-fallback"
        :fallback-tolerance="3"
        :scroll-sensitivity="100"
        :scroll-speed="20"
        bubble-scroll
        :delay="100"
        delay-on-touch-only
        :touch-start-threshold="5"
        :disabled="false"
        easing="cubic-bezier(0.25, 0.46, 0.45, 0.94)"
        tag="div"
        @start="onDragStart"
        @end="onDragEnd"
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
import { ref, computed, watch, nextTick } from 'vue'
import draggable from 'vuedraggable'
import TaskCard from './TaskCard.vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { Plus } from 'lucide-vue-next'

import './KanbanColumn.css'

interface Props {
  title: string
  status: Task['status']
  tasks: Task[]
  wipLimit?: number
  columnType?: 'status' | 'priority' | 'date' | 'category'
  swimlaneId?: string
}

const props = withDefaults(defineProps<Props>(), {
  wipLimit: 10,
  columnType: 'status',
  swimlaneId: 'default'
})

defineEmits<{
  addTask: [status: Task['status']]
  selectTask: [taskId: string]
  startTimer: [taskId: string]
  editTask: [taskId: string]
  deleteTask: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
}>()

// BUG-1193: Track drag state to prevent reactive overwrites during drag
const isDragActive = ref(false)

const localTasks = ref([...props.tasks])
watch(() => props.tasks, (newTasks) => {
  // BUG-1193: Don't overwrite localTasks during active drag operation
  // vuedraggable manages the array during drag - reactive updates cause desync
  // where the wrong task element gets associated with the drag ghost
  if (!isDragActive.value) {
    localTasks.value = [...newTasks]
  }
})

// BUG-1335: Use a shared drag group across all swimlanes so tasks can be dragged
// between projects. When dropped in a different swimlane, the project is updated.
// (Reverts BUG-1193 per-swimlane scoping which prevented cross-swimlane drag)
const dragGroup = computed(() => ({
  name: 'tasks',
  pull: true,
  put: true
}))

// FEATURE-1336b: Bridge vuedraggable drag to global useDragAndDrop for sidebar drops
const { startDrag, endDrag: endGlobalDrag } = useDragAndDrop()

const onDragStart = (evt: any) => {
  isDragActive.value = true

  // Bridge to global drag state so sidebar can receive drops
  const taskId = evt.item?.dataset?.taskId || evt.item?.querySelector?.('[data-task-id]')?.dataset?.taskId
  const taskTitle = evt.item?.querySelector?.('.task-title')?.textContent?.trim() || ''
  if (taskId) {
    startDrag({
      type: 'task',
      taskId,
      title: taskTitle,
      source: 'kanban'
    })
  }
}

const onDragEnd = () => {
  isDragActive.value = false
  endGlobalDrag()
  // Sync localTasks with store state after drag completes
  nextTick(() => {
    localTasks.value = [...props.tasks]
  })
}

const taskCount = computed(() => props.tasks.length)

// Column color indicator (priority dot or project color)
const columnIndicatorColor = computed(() => {
  if (props.columnType === 'priority') {
    const priorityColors: Record<string, string> = {
      'high': 'var(--color-priority-high, #ef4444)',
      'medium': 'var(--color-priority-medium, #f59e0b)',
      'low': 'var(--color-priority-low, #3b82f6)',
      'no_priority': 'rgba(255, 255, 255, 0.2)'
    }
    return priorityColors[props.status] || null
  }
  if (props.columnType === 'category') {
    // FEATURE-1336: Show project color dot for category columns
    const project = taskStore.projects.find((p: any) => p.id === props.status)
    return project?.color || 'rgba(255, 255, 255, 0.2)'
  }
  return null
})

const wipStatusClass = computed(() => {
  if (!props.wipLimit) return ''
  const count = taskCount.value
  const limit = props.wipLimit
  if (count >= limit) return 'wip-exceeded'
  if (count >= Math.floor(limit * 0.8)) return 'wip-warning'
  return ''
})

const taskStore = useTaskStore()

/**
 * Recalculate order values for all tasks in localTasks based on their current array position.
 * Uses simple integer indexing (0, 1, 2, ...) and persists via updateTask.
 */
const persistOrderForColumn = () => {
  localTasks.value.forEach((task, index) => {
    if (task.order !== index) {
      taskStore.updateTask(task.id, { order: index })
    }
  })
}

const handleDragChange = async (event: any) => {
  if (event.added) {
    try {
      const taskId = event.added.element.id
      const task = event.added.element as Task

      if (props.columnType === 'category') {
        // FEATURE-1336: Category columns: move task to target project
        const targetProjectId = props.status as string
        taskStore.moveTaskToProject(taskId, targetProjectId === 'uncategorized' ? '' : targetProjectId)
      } else if (props.columnType === 'priority') {
        // Priority columns: update task priority
        taskStore.moveTaskToPriority(taskId, props.status as any)
      } else if (props.columnType === 'date') {
        // Date columns: update task due date
        taskStore.moveTaskToDate(taskId, props.status as any)
      } else {
        // Status columns (default): update task status
        await taskStore.moveTaskWithUndo(taskId, props.status)
      }

      // BUG-1335: When task is dropped in a different swimlane (project),
      // also update the task's projectId to match the target swimlane
      if (props.columnType !== 'category' && props.swimlaneId !== 'default') {
        const currentProjectId = task.projectId || ''
        if (currentProjectId !== props.swimlaneId) {
          taskStore.moveTaskToProject(taskId, props.swimlaneId)
        }
      }

      // Persist order for all tasks in this column after cross-column move
      persistOrderForColumn()
    } catch (error) {
      console.error('Failed to move task:', error)
      window.dispatchEvent(new CustomEvent('flowstate:error', {
        detail: { message: 'Failed to move task. Please try again.' }
      }))
    }
  }

  if (event.moved) {
    // Within-column reorder: persist new order values
    persistOrderForColumn()
  }
}
</script>
