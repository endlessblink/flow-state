<template>
  <div class="task-row__title">
    <button
      v-if="hasSubtasks"
      class="task-row__expand-btn"
      :class="{ 'task-row__expand-btn--expanded': isExpanded }"
      :title="isExpanded ? 'Collapse subtasks' : 'Expand subtasks'"
      @click.stop="$emit('toggleExpand')"
    >
      <ChevronRight :size="14" />
    </button>
    <span
      class="task-row__title-text"
      :class="[
        titleAlignmentClasses,
        {
          'task-row__title-text--completed': isCompleted,
          'task-row__title-text--hover': isHovered,
          'task-row__title-text--selected': isSelected
        }
      ]"
      :title="title"
    >
      {{ title }}
    </span>
    <span
      v-if="hasSubtasks"
      class="subtask-count"
      :class="{
        'subtask-count--completed': isAllSubtasksCompleted,
        'subtask-count--progress': !isAllSubtasksCompleted && completedSubtaskCount > 0
      }"
    >
      {{ completedSubtaskCount }}/{{ totalSubtasks }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'

defineProps<{
  title: string
  isCompleted: boolean
  isHovered: boolean
  isSelected: boolean
  titleAlignmentClasses: object | string
  hasSubtasks: boolean
  completedSubtaskCount: number
  totalSubtasks: number
  isAllSubtasksCompleted: boolean
  isExpanded?: boolean
}>()

defineEmits<{
  toggleExpand: []
}>()
</script>

<style scoped>
.task-row__title {
  /* Match parent grid area name */
  grid-area: title;
  display: flex;
  align-items: center;
  font-weight: var(--font-medium);
  color: var(--text-primary);
  gap: var(--space-2);
  min-width: 0;
}

.task-row__title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1; /* Ensure text takes available space */
}

.task-row__title-text--completed {
  text-decoration: line-through;
  color: var(--text-tertiary);
}

/* Subtask count */
.subtask-count {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  background-color: var(--glass-bg-soft);
  border-radius: var(--radius-full);
  padding: 1px var(--space-1_5);
  min-width: 20px;
  text-align: center;
  transition: all var(--duration-fast);
}

.subtask-count--progress {
  color: var(--brand-primary);
  background-color: var(--brand-primary-bg-subtle);
}

.subtask-count--completed {
  color: var(--success-text);
  background-color: rgba(34, 197, 94, 0.1);
  text-decoration: none;
}

/* Expand/collapse button for subtasks */
.task-row__expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) ease;
  flex-shrink: 0;
}

.task-row__expand-btn:hover {
  color: var(--text-primary);
  background: var(--glass-bg-soft);
}

.task-row__expand-btn svg {
  transition: transform var(--duration-fast) ease;
}

.task-row__expand-btn--expanded svg {
  transform: rotate(90deg);
}
</style>
