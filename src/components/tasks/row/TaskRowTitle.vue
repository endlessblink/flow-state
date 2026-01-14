<template>
  <div class="task-row__title">
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
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-full);
  padding: 1px 6px;
  min-width: 20px;
  text-align: center;
  transition: all var(--duration-fast);
}

.subtask-count--progress {
  color: var(--brand-primary);
  background-color: rgba(78, 205, 196, 0.1);
}

.subtask-count--completed {
  color: var(--success-text);
  background-color: rgba(34, 197, 94, 0.1);
  text-decoration: none;
}
</style>
