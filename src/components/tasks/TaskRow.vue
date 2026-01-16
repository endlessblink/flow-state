<template>
  <div
    class="task-row"
    :class="[
      `task-row--${density}`,
      { 'task-row--selected': selected, 'task-row--anchor': isAnchorRow },
      `priority-${task.priority || 'none'}`
    ]"
    @click="$emit('select', task.id)"
    @contextmenu.prevent="$emit('contextMenu', $event, task)"
  >
    <!-- Priority Indicator -->
    <div v-if="task.priority" class="priority-indicator" />
    <!-- Checkbox -->
    <div class="task-row__checkbox" @click.stop>
      <DoneToggle
        :completed="task.status === 'done'"
        size="sm"
        variant="simple"
        :title="`Mark ${task.title} as ${task.status === 'done' ? 'incomplete' : 'complete'}`"
        :aria-label="`Toggle completion for ${task.title}`"
        @toggle="$emit('toggleComplete', task.id)"
      />
    </div>

    <!-- Title (flexible, main focus) -->
    <div class="task-row__title">
      <span class="task-row__title-text" :class="getAlignmentClasses(task.title)">{{ task.title }}</span>
    </div>

    <!-- Project Visual -->
    <TaskRowProject
      :visual="projectVisual"
      :project-display-name="taskStore.getProjectDisplayName(task.projectId)"
      :current-project-id="task.projectId"
      @update:project-id="(projectId) => $emit('updateProject', task.id, projectId)"
    />

    <!-- Due Date -->
    <div class="task-row__due-date">
      <Calendar v-if="task.dueDate" :size="14" class="task-row__icon" />
      <span v-if="task.dueDate" :class="getDueDateClass()">
        {{ formatDueDate(task.dueDate) }}
      </span>
      <span v-else class="task-row__empty">-</span>
    </div>

    <!-- Status Dropdown -->
    <div class="task-row__status" @click.stop>
      <CustomSelect
        :model-value="task.status || 'planned'"
        :options="statusOptions"
        placeholder="Select status..."
        @update:model-value="(val) => $emit('updateStatus', task.id, String(val))"
      />
    </div>

    <!-- Tags (progressive disclosure - visible on hover) -->
    <div class="task-row__tags">
      <span
        v-for="tag in visibleTags"
        :key="tag"
        class="task-row__tag"
      >
        {{ tag }}
      </span>
      <span v-if="hasMoreTags" class="task-row__tag-more">
        +{{ (task.tags?.length || 0) - maxVisibleTags }}
      </span>
    </div>

    <!-- Quick Actions (hover only) -->
    <div class="task-row__actions">
      <button
        class="task-row__action-btn"
        title="Start Timer"
        @click.stop="$emit('startTimer', task.id)"
      >
        <Play :size="14" />
      </button>
      <button
        class="task-row__action-btn"
        title="Edit Task"
        @click.stop="$emit('edit', task.id)"
      >
        <Edit :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { Calendar, Play, Edit } from 'lucide-vue-next'
import DoneToggle from '@/components/tasks/DoneToggle.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import TaskRowProject from '@/components/tasks/row/TaskRowProject.vue'
import type { DensityType } from '@/components/layout/ViewControls.vue'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

interface Props {
  task: Task
  density: DensityType
  selected?: boolean
  rowIndex: number // For ADHD anchor highlighting
}

const props = defineProps<Props>()
defineEmits<{
  select: [taskId: string]
  toggleComplete: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  updateStatus: [taskId: string, status: string]
  updateProject: [taskId: string, projectId: string | null]
}>()

const statusOptions = [
  { label: 'To Do', value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Backlog', value: 'backlog' },
  { label: 'On Hold', value: 'on_hold' }
]

const taskStore = useTaskStore()

// Hebrew text alignment support
const { getAlignmentClasses } = useHebrewAlignment()

// ADHD-friendly: Every 5th row gets visual anchor
const isAnchorRow = computed(() => (props.rowIndex + 1) % 5 === 0)

// Tag truncation for space efficiency
const maxVisibleTags = 2
const visibleTags = computed(() =>
  props.task.tags?.slice(0, maxVisibleTags) || []
)
const hasMoreTags = computed(() =>
  (props.task.tags?.length || 0) > maxVisibleTags
)

// Project visual indicator (emoji or colored dot)
const projectVisual = computed(() =>
  taskStore.getProjectVisual(props.task.projectId)
)

// Due date formatting and coloring
const formatDueDate = (dateString: string): string => {
  const date = new Date(dateString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getDueDateClass = (): string => {
  if (!props.task.dueDate) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(props.task.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'task-row__date--overdue'
  if (diffDays === 0) return 'task-row__date--today'
  if (diffDays <= 3) return 'task-row__date--soon'
  return ''
}

</script>

<style scoped>
/* Base Row - 32px height optimized for scanning */
/* Base Row - 32px height optimized for scanning */
.task-row {
  display: grid;
  grid-template-columns: 40px 1fr 40px 100px 100px 140px 80px;
  grid-template-areas: "checkbox title project due status tags actions";
  height: 32px;
  position: relative;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  
  /* Glass Morphism Base - More visible */
  background: transparent; /* Remove gray background to let gradient show */
  border: 1px solid var(--border-subtle); /* All-around border like cards */
  border-bottom-color: var(--glass-border); /* Slightly stronger bottom */
  border-radius: var(--radius-sm); /* Rounded corners like cards */
  margin-bottom: var(--space-1); /* Separation */
  backdrop-filter: blur(8px);
  
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  contain: layout style size;
}

.task-row:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: var(--border-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.task-row--selected {
  background: rgba(78, 205, 196, 0.08) !important; /* Brand tint */
  border-left: 3px solid var(--brand-primary);
  border-bottom-color: var(--brand-primary-bg-heavy);
}

/* ADHD Visual Anchor - Every 5th row */
.task-row--anchor {
  background: rgba(255, 255, 255, 0.035);
}

.task-row--anchor:hover {
  background: var(--glass-bg-heavy);
}

/* Density Variants */
.task-row--compact {
  height: 28px;
  font-size: var(--text-sm);
}

.task-row--comfortable {
  height: 36px;
  font-size: var(--text-sm);
}

.task-row--spacious {
  height: 44px;
  font-size: var(--text-sm);
  padding: 0 var(--space-4);
}

/* Checkbox Cell */
.task-row__checkbox {
  grid-area: checkbox;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity var(--duration-normal);
}

.task-row:hover .task-row__checkbox {
  opacity: 1;
}

/* Title Cell */
.task-row__title {
  grid-area: title;
  min-width: 0;
  overflow: hidden;
}

.task-row__title-text {
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  transition: color var(--duration-normal);
  letter-spacing: 0.01em;
}

.task-row:hover .task-row__title-text {
  color: #fff;
}

.task-row--selected .task-row__title-text {
  color: var(--brand-primary-light, #7fffd4);
  text-shadow: 0 0 10px rgba(78, 205, 196, 0.3);
}

/* Project Emoji Cell - handled by TaskRowProject component */

/* Due Date Cell */
.task-row__due-date {
  grid-area: due;
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.5);
}

.task-row__icon {
  flex-shrink: 0;
  opacity: 0.6;
}

.task-row__date--overdue {
  color: #ff6b6b;
  text-shadow: 0 0 8px rgba(255, 107, 107, 0.2);
}

.task-row__date--today {
  color: #feca57;
  font-weight: 500;
}

.task-row__date--soon {
  color: #54a0ff;
}

/* Status Cell */
.task-row__status {
  grid-area: status;
  display: flex;
  align-items: center;
}

/* Tags Cell - Glass Chips */
.task-row__tags {
  grid-area: tags;
  display: flex;
  gap: var(--space-1);
  overflow: hidden;
  opacity: 0.6;
  transition: opacity var(--duration-normal);
}

.task-row:hover .task-row__tags {
  opacity: 1;
}

.task-row__tag {
  padding: 1px var(--space-1_5);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.task-row__tag-more {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.4);
}

/* Actions Cell */
.task-row__actions {
  grid-area: actions;
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
  opacity: 0;
  transform: translateX(10px);
  transition: all var(--duration-normal) cubic-bezier(0.2, 0.8, 0.2, 1);
}

.task-row:hover .task-row__actions {
  opacity: 1;
  transform: translateX(0);
}

.task-row__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.task-row__action-btn:hover {
  background: var(--glass-border-hover);
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
  transform: scale(1.1);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
}

/* Priority Indicator */
.priority-indicator {
  position: absolute;
  top: var(--space-1);
  bottom: var(--space-1);
  left: 3px;
  width: 3px;
  border-radius: var(--radius-sm);
  opacity: 0.8;
}

/* Empty state */
.task-row__empty {
  color: var(--glass-border);
  font-size: var(--text-xs);
}

/* Focus */
.task-row:focus-visible {
  outline: none;
  background: var(--glass-bg-soft);
  border-color: var(--brand-primary-alpha-50);
  box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2);
}
</style>
