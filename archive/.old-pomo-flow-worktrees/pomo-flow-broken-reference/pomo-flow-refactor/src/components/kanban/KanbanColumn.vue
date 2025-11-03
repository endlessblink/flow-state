<template>
  <div class="kanban-column" :class="wipStatusClass">
    <div class="column-header">
      <div class="header-left">
        <span class="column-title">{{ title }}</span>
        <span class="task-count" :class="wipStatusClass">
          {{ taskCount }}{{ wipLimit ? `/${wipLimit}` : '' }}
        </span>
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
        @change="handleDragChange"
        class="drag-area"
        :animation="60"
        :ghost-class="'ghost-card'"
        :chosen-class="'chosen-card'"
        :drag-class="'drag-card'"
        :force-fallback="false"
        :fallback-tolerance="0"
        :scroll-sensitivity="100"
        :scroll-speed="20"
        :bubble-scroll="true"
        :delay="0"
        :delay-on-touch-start="false"
        :delay-on-touch-only="false"
        :touch-start-threshold="0"
        :disabled="false"
        :easing="'cubic-bezier(0.25, 0.46, 0.45, 0.94)'"
        tag="div"
        style="min-height: 200px; padding: var(--space-2);"
      >
        <template #item="{ element: task }">
          <TaskCard
            :key="task.id"
            :task="task"
            @select="$emit('selectTask', $event)"
            @startTimer="$emit('startTimer', $event)"
            @edit="$emit('editTask', $event)"
            @contextMenu="(event, task) => $emit('contextMenu', event, task)"
            class="task-item"
          />
        </template>
      </draggable>

      <div v-if="tasks.length === 0" class="empty-column">
        <span class="empty-message">No {{ title.toLowerCase() }} tasks</span>
        <button class="add-first-task" @click="$emit('addTask', status)">
          <Plus :size="16" />
          Add {{ title.toLowerCase() }} task
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, TransitionGroup } from 'vue'
import draggable from 'vuedraggable'
import TaskCard from './TaskCard.vue'
import type { Task } from '@/stores/tasks'
import { Plus } from 'lucide-vue-next'

interface Props {
  title: string
  status: Task['status']
  tasks: Task[]
  wipLimit?: number // Optional WIP limit (default: 10)
}

const props = withDefaults(defineProps<Props>(), {
  wipLimit: 10
})

const emit = defineEmits<{
  addTask: [status: Task['status']]
  selectTask: [taskId: string]
  startTimer: [taskId: string]
  editTask: [taskId: string]
  moveTask: [taskId: string, newStatus: Task['status']]
  contextMenu: [event: MouseEvent, task: Task]
}>()

// Local reactive copy for drag-drop
const localTasks = ref([...props.tasks])

// Watch for external task changes and update local copy
watch(() => props.tasks, (newTasks) => {
  localTasks.value = [...newTasks]
}, { deep: true })

// WIP Limit calculations
const taskCount = computed(() => props.tasks.length)

const wipStatusClass = computed(() => {
  if (!props.wipLimit) return ''

  const count = taskCount.value
  const limit = props.wipLimit
  const warningThreshold = Math.floor(limit * 0.8) // 80% of limit

  if (count >= limit) return 'wip-exceeded'
  if (count >= warningThreshold) return 'wip-warning'
  return ''
})

// Handle drag-drop changes
const handleDragChange = (event: any) => {
  if (event.added) {
    // Task was dropped into this column
    const task = event.added.element
    emit('moveTask', task.id, props.status)
  }
}
</script>

<style scoped>
.kanban-column {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  box-shadow:
    0 20px 40px var(--shadow-xl),
    0 10px 20px var(--shadow-lg),
    inset 0 1px 0 var(--glass-bg-heavy);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.kanban-column:hover {
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  border-color: var(--glass-border-soft);
  box-shadow:
    0 24px 48px var(--shadow-xl),
    0 12px 24px var(--shadow-md),
    inset 0 1px 0 var(--glass-border);
}

/* WIP Limit Warning States */
.kanban-column.wip-warning {
  border-inline-start: 3px solid var(--color-break); /* RTL: WIP warning indicator */
}

.kanban-column.wip-exceeded {
  border-inline-start: 3px solid var(--color-danger); /* RTL: WIP exceeded indicator */
  box-shadow:
    0 20px 40px var(--shadow-xl),
    0 0 0 1px var(--color-danger),
    inset 0 1px 0 var(--glass-bg-heavy);
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-2);
  background: linear-gradient(
    90deg,
    var(--glass-bg-tint) 0%,
    var(--surface-hover) 100%
  );
  border-radius: var(--radius-md);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.column-title {
  color: var(--text-secondary);
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.task-count {
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: var(--text-muted);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
}

.task-count.wip-warning {
  background: var(--orange-bg-subtle);
  color: var(--color-break);
  border-color: var(--color-break);
}

.task-count.wip-exceeded {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
  border-color: var(--color-danger);
  animation: wipPulse 2s ease-in-out infinite;
}

@keyframes wipPulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.add-task-btn {
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  border: 1px solid var(--glass-bg-medium);
  color: var(--text-muted);
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: 0 4px 8px var(--shadow-md);
}

.add-task-btn:hover {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--glass-border-strong);
  color: var(--text-primary);
  transform: translateY(-2px) scale(1.05);
  box-shadow:
    0 8px 16px var(--shadow-strong),
    0 0 16px var(--purple-bg-subtle);
}

.tasks-container {
  min-height: 200px;
}

.empty-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-6);
  text-align: center;
  background: linear-gradient(
    135deg,
    var(--surface-hover) 0%,
    var(--glass-bg-light) 100%
  );
  border-radius: var(--radius-lg);
  border: 1px dashed var(--glass-bg-heavy);
}

.empty-message {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
  opacity: 0.8;
}

.add-first-task {
  background: linear-gradient(
    135deg,
    var(--purple-bg-subtle) 0%,
    var(--purple-bg-end) 100%
  );
  border: 1px solid var(--purple-border-medium);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: 0 4px 12px var(--purple-bg-subtle);
}

.add-first-task:hover {
  background: linear-gradient(
    135deg,
    var(--purple-border-subtle) 0%,
    var(--purple-bg-subtle) 100%
  );
  border-color: var(--purple-border-strong);
  color: var(--text-primary);
  transform: translateY(-2px) scale(1.02);
  box-shadow:
    0 8px 20px var(--purple-shadow-medium),
    0 0 20px var(--purple-glow-subtle);
}

/* Light theme overrides */
:root:not(.dark-theme) .column-title {
  color: var(--text-muted);
}

:root:not(.dark-theme) .add-task-btn {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
  color: var(--text-muted);
}

:root:not(.dark-theme) .add-task-btn:hover {
  background: var(--surface-tertiary);
  border-color: var(--border-strong);
  color: var(--text-muted);
}

:root:not(.dark-theme) .empty-message {
  color: var(--text-muted);
}

:root:not(.dark-theme) .add-first-task {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
  color: var(--text-muted);
}

:root:not(.dark-theme) .add-first-task:hover {
  background: var(--surface-tertiary);
  border-color: var(--border-strong);
  color: var(--text-secondary);
}

/* Task item ultra-fast transitions */
.task-item {
  transition: all 80ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  will-change: transform, opacity;
}

/* Drag feedback states with instant response */
.ghost-card {
  opacity: 0.4;
  background: var(--blue-bg-medium) !important;
  border: 2px dashed var(--brand-primary) !important;
  transform: rotate(1deg);
  transition: all 80ms ease-out;
}

.chosen-card {
  transform: scale(1.01);
  box-shadow: 0 4px 12px -2px var(--shadow-subtle);
  z-index: 1000;
  transition: transform 0ms, box-shadow 20ms ease-out !important;
}

.drag-card {
  transform: rotate(2deg) scale(1.03);
  box-shadow: 0 8px 20px -3px var(--shadow-md);
  transition: transform 0ms, box-shadow 20ms ease-out !important;
}
</style>