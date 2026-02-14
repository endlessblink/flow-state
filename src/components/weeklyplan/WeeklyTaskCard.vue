<template>
  <div
    class="weekly-task-card"
    :class="{
      'is-overdue': isOverdue,
      'is-expanded': isExpanded,
      'is-rtl': isRtl,
    }"
    @click="toggleExpand"
  >
    <!-- Hover quick actions — top-right corner -->
    <div class="card-actions" @click.stop>
      <button
        class="action-dot"
        aria-label="Remove from plan"
        title="Remove"
        type="button"
        @click.stop="$emit('remove', task.id)"
      >
        <X :size="12" />
      </button>
      <button
        class="action-dot"
        aria-label="Cycle priority"
        title="Priority"
        type="button"
        @click.stop="$emit('change-priority', task.id)"
      >
        <Flag :size="12" />
      </button>
      <button
        class="action-dot"
        aria-label="Snooze to next week"
        title="Snooze"
        type="button"
        @click.stop="$emit('snooze', task.id)"
      >
        <Clock :size="12" />
      </button>
    </div>

    <div class="card-content">
      <span class="task-title" :dir="isRtl ? 'rtl' : 'ltr'" :title="task.title">{{ task.title }}</span>
      <div class="card-meta">
        <span class="priority-indicator" :style="{ backgroundColor: priorityColor }" />
        <span v-if="projectName" class="project-badge">
          {{ projectName }}
        </span>
        <span v-if="task.estimatedDuration" class="duration-badge">
          {{ formattedDuration }}
        </span>
        <span v-if="isOverdue" class="overdue-badge">
          Overdue
        </span>
      </div>
    </div>

    <!-- Expanded details -->
    <Transition name="expand">
      <div v-if="isExpanded" class="card-expanded" @click.stop>
        <p v-if="task.description" class="expanded-description" :dir="isRtl ? 'rtl' : 'ltr'">
          {{ truncatedDescription }}
        </p>
        <div class="expanded-meta">
          <span v-if="task.subtaskCount" class="meta-chip">
            {{ task.completedSubtaskCount || 0 }}/{{ task.subtaskCount }} subtasks
          </span>
          <span v-if="task.dueDate" class="meta-chip">
            Due {{ task.dueDate }}
          </span>
          <span class="meta-chip" :class="`status-${task.status}`">
            {{ statusLabel }}
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { X, Flag, Clock } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/projects'
import type { TaskSummary } from '@/composables/useWeeklyPlanAI'

interface Props {
  task: TaskSummary
  isOverdue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isOverdue: false,
})

defineEmits<{
  remove: [taskId: string]
  'change-priority': [taskId: string]
  snooze: [taskId: string]
}>()

const isExpanded = ref(false)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

const projectStore = useProjectStore()

// RTL detection (Hebrew)
const HEBREW_RANGE = /[\u0590-\u05FF]/
const isRtl = computed(() => HEBREW_RANGE.test(props.task.title || ''))

const projectName = computed(() => {
  if (!props.task.projectId) return ''
  return projectStore.getProjectDisplayName(props.task.projectId)
})

const priorityColor = computed(() => {
  switch (props.task.priority) {
    case 'high': return 'var(--color-danger)'
    case 'medium': return 'var(--color-warning)'
    case 'low': return 'var(--color-info)'
    default: return 'var(--text-muted)'
  }
})

const formattedDuration = computed(() => {
  const mins = props.task.estimatedDuration
  if (!mins) return ''
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins}m`
})

const truncatedDescription = computed(() => {
  const desc = props.task.description || ''
  if (desc.length <= 120) return desc
  return desc.slice(0, 120) + '...'
})

const statusLabel = computed(() => {
  switch (props.task.status) {
    case 'in_progress': return 'In Progress'
    case 'planned': return 'Planned'
    case 'backlog': return 'Backlog'
    case 'on_hold': return 'On Hold'
    default: return props.task.status
  }
})
</script>

<style scoped>
/* Match kanban TaskCard sizing: space-3 padding, 15px title, radius-md */
.weekly-task-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  background: rgba(35, 37, 50, 0.95);
  backdrop-filter: blur(var(--blur-sm));
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md);
  cursor: grab;
  transition: background var(--duration-fast) ease, border-color var(--duration-fast) ease;
  user-select: none;
  width: 100%;
  box-sizing: border-box;
}

.weekly-task-card:hover {
  border-color: var(--glass-border-hover);
}

.weekly-task-card:active {
  cursor: grabbing;
}

.weekly-task-card.is-overdue {
  border-color: var(--danger-border-subtle);
}

.weekly-task-card.is-expanded {
  cursor: default;
}

/* RTL: flip action buttons to the left to avoid text overlap */
.weekly-task-card.is-rtl .card-actions {
  right: auto;
  left: 6px;
}

.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.priority-indicator {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.task-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  flex-wrap: wrap;
}

.project-badge,
.duration-badge {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: var(--leading-none);
}

.duration-badge {
  color: var(--text-muted);
}

.overdue-badge {
  font-size: var(--text-xs);
  color: var(--color-danger);
  font-weight: var(--font-semibold);
  line-height: var(--leading-none);
}

/* Expanded details */
.card-expanded {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-subtle);
  margin-top: var(--space-1);
}

.expanded-description {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0;
}

.expanded-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.meta-chip {
  font-size: 11px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-medium);
  color: var(--text-muted);
  white-space: nowrap;
}

.meta-chip.status-in_progress {
  color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.1);
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all var(--duration-normal) var(--spring-smooth);
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  margin-top: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 150px;
}

/* Hover quick actions — top-right corner */
.card-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--duration-fast);
  z-index: 2;
}

.weekly-task-card:hover .card-actions {
  opacity: 1;
}

.action-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: rgba(35, 37, 50, 0.9);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.action-dot:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}
</style>
