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
      <input
        type="checkbox"
        :checked="task.status === 'done'"
        :aria-label="`Mark ${task.title} as ${task.status === 'done' ? 'incomplete' : 'complete'}`"
        @change="$emit('toggleComplete', task.id)"
      >
    </div>

    <!-- Title (flexible, main focus) -->
    <div class="task-row__title">
      <span class="task-row__title-text" :class="getAlignmentClasses(task.title)">{{ task.title }}</span>
    </div>

    <!-- Project Visual -->
    <div class="task-row__project">
      <span
        class="project-emoji-badge"
        :class="[`project-visual--${projectVisual.type}`, { 'project-visual--colored': projectVisual.type === 'css-circle' }]"
        :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
      >
        <!-- Emoji visual indicator -->
        <ProjectEmojiIcon
          v-if="projectVisual.type === 'emoji'"
          :emoji="projectVisual.content"
          size="xs"
          :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
          class="project-emoji"
        />
        <!-- CSS circle visual indicator -->
        <span
          v-else-if="projectVisual.type === 'css-circle'"
          class="project-emoji project-css-circle"
          :style="{ '--project-color': projectVisual.color }"
          :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
        />
        <!-- Default fallback (folder icon) -->
        <ProjectEmojiIcon
          v-else
          emoji="📁"
          size="xs"
          :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
          class="project-emoji"
        />
      </span>
    </div>

    <!-- Due Date -->
    <div class="task-row__due-date">
      <Calendar v-if="task.dueDate" :size="14" class="task-row__icon" />
      <span v-if="task.dueDate" :class="getDueDateClass()">
        {{ formatDueDate(task.dueDate) }}
      </span>
      <span v-else class="task-row__empty">-</span>
    </div>

    <!-- Status Badge -->
    <div class="task-row__status">
      <span class="task-row__badge task-row__badge--status" :class="`task-row__badge--${task.status}`">
        {{ formatStatus(task.status) }}
      </span>
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
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import type { DensityType } from '@/components/ViewControls.vue'
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
}>()

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

const formatStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'planned': 'To Do',
    'in_progress': 'In Progress',
    'done': 'Done',
    'backlog': 'Backlog',
    'on_hold': 'On Hold'
  }
  return statusMap[status] || status
}
</script>

<style scoped>
/* Base Row - 32px height optimized for scanning */
.task-row {
  display: grid;
  grid-template-columns: 40px 1fr 40px 100px 100px 140px 80px;
  grid-template-areas: "checkbox title project due status tags actions";
  height: 32px;
  position: relative; /* Needed for absolute positioned priority indicator */
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border-bottom: 1px solid var(--glass-border);
  background-color: var(--glass-bg-solid);
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;
  contain: layout style size; /* Performance optimization */
}

.task-row:hover {
  background-color: var(--glass-bg-medium);
}

.task-row--selected {
  background-color: var(--color-primary-alpha-10);
  border-left: 3px solid var(--color-primary);
}

/* ADHD Visual Anchor - Every 5th row */
.task-row--anchor {
  background-color: rgba(255, 255, 255, 0.03);
}

.task-row--anchor:hover {
  background-color: var(--glass-bg-medium);
}

/* Density Variants */
.task-row--compact {
  height: 28px;
  font-size: var(--text-sm);
}

.task-row--comfortable {
  height: 32px;
  font-size: var(--text-base);
}

.task-row--spacious {
  height: 36px;
  font-size: var(--text-base);
  padding: 0 var(--space-4);
}

/* Checkbox Cell */
.task-row__checkbox {
  grid-area: checkbox;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-row__checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* Title Cell - Flexible, main focus */
.task-row__title {
  grid-area: title;
  min-width: 0; /* Critical for text truncation */
  overflow: hidden;
}

.task-row__title-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* Project Emoji Cell - Enhanced to match canvas implementation */
.task-row__project {
  grid-area: project;
  display: grid;
  place-items: center; /* Perfect centering with CSS Grid */
  transform: translateZ(0); /* Hardware acceleration */
  will-change: transform;
}

/* Enhanced project indicator styles matching canvas implementation */
.project-emoji-badge {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--spring-smooth) ease;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 2px 4px var(--shadow-subtle);
}

.project-emoji-badge:hover {
  background: var(--brand-bg-subtle-hover);
  border-color: var(--brand-border);
  transform: translateY(-1px) translateZ(0);
  box-shadow: 0 4px 8px var(--shadow-subtle);
}

.project-emoji {
  font-size: var(--project-indicator-size-md); /* 24px to match canvas */
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateZ(0); /* Hardware acceleration */
  transition: all var(--spring-smooth) ease;
}

.project-emoji.project-css-circle {
  width: var(--project-indicator-size-md); /* 24px to match canvas */
  height: var(--project-indicator-size-md); /* 24px to match canvas */
  border-radius: 50%;
  background: var(--project-color);
  box-shadow: var(--project-indicator-shadow-inset);
  position: relative;
  font-size: var(--project-indicator-font-size-md); /* Proper font scaling */
  color: white;
  font-weight: var(--font-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--spring-smooth) ease;
  backdrop-filter: var(--project-indicator-backdrop);
  /* Enhanced glow to match canvas */
  box-shadow:
    var(--project-indicator-shadow-inset),
    var(--project-indicator-glow-strong);
}

.project-emoji-badge:hover .project-emoji.project-css-circle {
  transform: translateZ(0) scale(1.15); /* Match canvas scaling */
  box-shadow:
    var(--project-indicator-shadow-inset),
    0 0 16px var(--project-color),
    0 0 32px var(--project-color);
}

/* Add radial gradient glow effect like canvas */
.project-emoji-badge:hover .project-emoji.project-css-circle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle,
    var(--project-color) 0%,
    transparent 70%
  );
  opacity: 0.3;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: -1;
}

.project-emoji-badge.project-visual--colored {
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
}


/* Due Date Cell */
.task-row__due-date {
  grid-area: due;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 12px;
  color: var(--text-secondary);
}

.task-row__icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.task-row__date--overdue {
  color: var(--color-error);
  font-weight: 600;
}

.task-row__date--today {
  color: var(--color-warning);
  font-weight: 500;
}

.task-row__date--soon {
  color: var(--color-info);
}

/* Priority Indicator - Subtle left border */
.priority-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.priority-high .priority-indicator {
  background: var(--color-priority-high);
}

.priority-medium .priority-indicator {
  background: var(--color-priority-medium);
}

.priority-low .priority-indicator {
  background: var(--color-priority-low);
}

.timer-active .priority-indicator {
  background: var(--brand-primary) !important;
  animation: priorityPulse 2s ease-in-out infinite;
}

@keyframes priorityPulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* Status Badge */
.task-row__status {
  grid-area: status;
}

.task-row__badge--planned {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
}

.task-row__badge--in_progress {
  background-color: var(--blue-bg-light);
  color: var(--color-info);
}

.task-row__badge--done {
  background-color: var(--success-bg-light);
  color: var(--color-success);
}

.task-row__badge--backlog {
  background-color: var(--purple-bg-subtle);
  color: var(--color-primary);
}

.task-row__badge--on_hold {
  background-color: var(--orange-bg-light);
  color: var(--color-warning);
}

/* Tags Cell - Progressive disclosure */
.task-row__tags {
  grid-area: tags;
  display: flex;
  gap: var(--space-1);
  overflow: hidden;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}

.task-row:hover .task-row__tags {
  opacity: 1;
}

.task-row__tag {
  padding: 2px var(--space-1_5);
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.task-row__tag-more {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
}

/* Actions Cell - Hover only */
.task-row__actions {
  grid-area: actions;
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}

.task-row:hover .task-row__actions {
  opacity: 1;
}

.task-row__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.task-row__action-btn:hover {
  background-color: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
  transform: scale(1.05);
}

/* Empty state indicator */
.task-row__empty {
  color: var(--text-tertiary);
  font-size: 12px;
}

/* Focus state for accessibility */
.task-row:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  z-index: 1;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .task-row,
  .task-row__tags,
  .task-row__actions,
  .task-row__action-btn {
    transition: none;
  }
}
</style>
