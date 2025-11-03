<template>
  <div
    class="task-card"
    draggable="true"
    @dragstart="handleDragStart"
    @dragend="endDrag"
    @click="$emit('select', task.id)"
    @contextmenu.prevent="handleRightClick"
  >
    <h3 class="task-title">{{ task.title }}</h3>
    <p class="task-description">{{ task.description }}</p>

    <!-- Subtask count if any -->
    <div v-if="task.subtasks.length > 0" class="subtask-count">
      <span class="subtask-indicator">
        {{ completedSubtasks }}/{{ task.subtasks.length }} subtasks
      </span>
    </div>

    <!-- Dependency indicator -->
    <div v-if="hasDependencies" class="dependency-indicator">
      <span class="dependency-badge" :title="`Depends on ${task.dependsOn.length} task(s)`">
        🔗 {{ task.dependsOn.length }} {{ task.dependsOn.length === 1 ? 'dependency' : 'dependencies' }}
      </span>
    </div>

    <div class="task-meta-row">
      <span class="due-date" style="display: flex; align-items: center; gap: 0.25rem;">
        <Calendar :size="14" />
        {{ task.dueDate }}
      </span>
      <div class="progress-indicator">
        <svg class="progress-circle" width="20" height="20">
          <circle cx="10" cy="10" r="8" fill="none" :stroke="'var(--border-medium)'" stroke-width="2"/>
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            :stroke="progressColor"
            stroke-width="2"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
            transform="rotate(-90 10 10)"
          />
        </svg>
        <span class="progress-text" :class="progressClass">{{ task.progress }}%</span>
      </div>
    </div>

    <div class="task-footer">
      <span class="pomodoro-count">🍅 {{ task.completedPomodoros }} session{{ task.completedPomodoros !== 1 ? 's' : '' }}</span>

      <div class="task-actions">
        <button
          @click.stop="$emit('startTimer', task.id)"
          class="start-timer-btn"
          title="Start Pomodoro Timer"
        >
          <Play :size="14" />
        </button>

        <button
          @click.stop="$emit('edit', task.id)"
          class="edit-task-btn"
          title="Edit Task"
        >
          <Edit :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/stores/tasks'
import { Play, Edit, Calendar } from 'lucide-vue-next'
import { useDragAndDrop, type DragData } from '@/composables/useDragAndDrop'

interface Props {
  task: Task
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
}>()

const { startDrag, endDrag } = useDragAndDrop()

// Right-click handler
const handleRightClick = (event: MouseEvent) => {
  console.log('Right-click detected on task:', props.task.title)
  emit('contextMenu', event, props.task)
}

// Drag handler using new composable
const handleDragStart = (event: DragEvent) => {
  if (event.dataTransfer) {
    const dragData: DragData = {
      type: 'task',
      taskId: props.task.id,
      title: props.task.title,
      source: 'kanban'
    }

    // Use new composable for global drag state
    startDrag(dragData)

    // Still set dataTransfer for HTML5 drag-and-drop compatibility
    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    event.dataTransfer.effectAllowed = 'move'
  }
}

// Dependency check
const hasDependencies = computed(() =>
  props.task.dependsOn && props.task.dependsOn.length > 0
)

// Subtask calculations
const completedSubtasks = computed(() =>
  props.task.subtasks?.filter(st => st.isCompleted).length || 0
)

// Progress circle calculations
const circumference = 2 * Math.PI * 8 // radius is 8
const dashOffset = computed(() => {
  return circumference - (props.task.progress / 100) * circumference
})

const progressColor = computed(() => {
  if (props.task.progress === 0) return 'var(--text-muted)'
  if (props.task.progress <= 50) return 'var(--color-break)'
  if (props.task.progress < 100) return 'var(--color-navigation)'
  return 'var(--color-work)'
})

const progressClass = computed(() => {
  if (props.task.progress === 0) return ''
  if (props.task.progress <= 50) return 'yellow'
  if (props.task.progress < 100) return 'blue'
  return 'green'
})
</script>

<style scoped>
.task-card {
  /* Solid background like screenshot 12 */
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
  position: relative;
}

.task-card:hover {
  /* OUTLINED + GLASS on hover (not filled!) */
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.task-title {
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-2) 0;
  line-height: var(--leading-tight);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: background-color var(--duration-fast) ease;
}

.task-description {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-4) 0;
  line-height: var(--leading-relaxed);
}

.subtask-count {
  margin-bottom: var(--space-3);
}

.subtask-indicator {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  background: var(--blue-bg-light);
  border: 1px solid var(--blue-bg-medium);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-lg);
  display: inline-block;
}

.dependency-indicator {
  margin-bottom: var(--space-3);
}

.dependency-badge {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  background: var(--purple-bg-subtle);
  border: 1px solid var(--purple-border-light);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-lg);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.task-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.due-date {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.progress-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.progress-text {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
}

.progress-text.yellow {
  color: var(--color-break);
}

.progress-text.blue {
  color: var(--color-navigation);
}

.progress-text.green {
  color: var(--color-work);
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pomodoro-count {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.task-actions {
  display: flex;
  gap: var(--space-2);
  opacity: 0;
  transition: opacity var(--duration-normal) var(--spring-smooth);
}

.task-card:hover .task-actions {
  opacity: 1;
}

.start-timer-btn,
.edit-task-btn {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  border: 1px solid var(--glass-border-medium);
  color: var(--text-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: 0 4px 8px var(--shadow-md);
}

.start-timer-btn:hover {
  background: linear-gradient(
    135deg,
    var(--success-gradient-start) 0%,
    var(--success-gradient-end) 100%
  );
  border-color: var(--success-border-medium);
  color: white;
  transform: translateY(-2px) scale(1.05);
  box-shadow:
    0 8px 16px var(--success-shadow),
    0 0 20px var(--success-bg-subtle);
}

.edit-task-btn:hover {
  background: linear-gradient(
    135deg,
    var(--blue-gradient-start) 0%,
    var(--blue-gradient-end) 100%
  );
  border-color: var(--blue-border-medium);
  color: white;
  transform: translateY(-2px) scale(1.05);
  box-shadow:
    0 8px 16px var(--blue-shadow),
    0 0 20px var(--blue-bg-medium);
}

/* Light theme overrides */
:root:not(.dark-theme) .task-card {
  background: var(--surface-secondary);
  border-color: var(--border-subtle);
  box-shadow: 0 1px 2px 0 var(--shadow-subtle);
}

:root:not(.dark-theme) .task-card:hover {
  border-color: var(--border-medium);
  box-shadow: 0 4px 6px -1px var(--shadow-subtle);
}

:root:not(.dark-theme) .task-title {
  color: var(--text-primary);
}

:root:not(.dark-theme) .task-description {
  color: var(--text-muted);
}

:root:not(.dark-theme) .due-date {
  color: var(--text-muted);
}

:root:not(.dark-theme) .progress-text {
  color: var(--text-muted);
}

:root:not(.dark-theme) .pomodoro-count {
  color: var(--text-muted);
}

:root:not(.dark-theme) .start-timer-btn,
:root:not(.dark-theme) .edit-task-btn {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
  color: var(--text-muted);
}
</style>