<template>
  <div
    class="task-card"
    draggable="true"
    tabindex="0"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend')"
    @click="$emit('click', $event)"
    @dblclick="$emit('dblclick')"
    @contextmenu.prevent="$emit('contextmenu', $event)"
    @keydown="$emit('keydown', $event)"
  >
    <!-- Priority Stripe (top) -->
    <div class="priority-stripe" :class="`priority-${task.priority}`" />

    <!-- Timer Active Badge -->
    <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
      <Timer :size="12" />
    </div>

    <!-- Task Content -->
    <div class="task-content--calendar-inbox">
      <div class="task-title" dir="auto">
        {{ task.title }}
      </div>

      <!-- Metadata Badges -->
      <div class="task-metadata">
        <!-- Project Badge -->
        <span v-if="task.projectId" class="metadata-badge project-badge">
          <ProjectEmojiIcon
            :emoji="projectVisual.content"
            size="xs"
          />
        </span>

        <!-- Priority Tag -->
        <NTag
          :type="task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'"
          size="small"
          round
          class="priority-badge"
        >
          {{ task.priority }}
        </NTag>

        <!-- Due Date Badge -->
        <span
          v-if="task.dueDate"
          class="metadata-badge due-date-badge"
          :class="getDueBadgeClass(task.dueDate)"
        >
          <Calendar :size="12" />
          {{ formatDueDateLabel(task.dueDate) }}
        </span>

        <!-- Duration Badge -->
        <span v-if="task.estimatedDuration" class="metadata-badge duration-badge">
          <Clock :size="12" />
          {{ task.estimatedDuration }}m
        </span>

        <!-- Status Indicator -->
        <span class="metadata-badge status-badge" :class="`status-${task.status}`">
          {{ statusEmoji(task.status) }}
        </span>
      </div>
    </div>

    <!-- Quick Actions (hover) -->
    <div class="task-actions">
      <button
        class="action-btn"
        :title="`Start timer for ${task.title}`"
        @click.stop="$emit('startTimer')"
      >
        <Play :size="12" />
      </button>
      <button
        class="action-btn"
        :title="`Edit ${task.title}`"
        @click.stop="$emit('edit')"
      >
        <Edit2 :size="12" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { type Task } from '@/stores/tasks'
import { Play, Edit2, Timer, Calendar, Clock } from 'lucide-vue-next'
import { NTag } from 'naive-ui'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import { useTaskStore } from '@/stores/tasks'

const props = defineProps<{
  task: Task
  isTimerActive: boolean
}>()

defineEmits<{
  (e: 'dragstart', event: DragEvent): void
  (e: 'dragend'): void
  (e: 'click', event: MouseEvent): void
  (e: 'dblclick'): void
  (e: 'contextmenu', event: MouseEvent): void
  (e: 'keydown', event: KeyboardEvent): void
  (e: 'startTimer'): void
  (e: 'edit'): void
}>()

const taskStore = useTaskStore()

const projectVisual = computed(() => 
  taskStore.getProjectVisual(props.task.projectId)
)

const statusEmoji = (status: string) => {
  const emojis: Record<string, string> = {
    planned: '📝',
    in_progress: '🎬',
    done: '✅',
    backlog: '📦',
    on_hold: '⏸️'
  }
  return emojis[status] || '❓'
}

const getDueBadgeClass = (dueDate: string) => {
  const today = new Date().toISOString().split('T')[0]
  if (dueDate < today) return 'due-badge-overdue'
  if (dueDate === today) return 'due-badge-today'
  return 'due-badge-future'
}

const formatDueDateLabel = (dueDate: string) => {
  if (!dueDate) return ''
  const dateStr = dueDate.split('T')[0]
  const today = new Date().toISOString().split('T')[0]
  
  const dateObj = new Date(dueDate)
  const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(dateObj)

  if (dateStr < today) return 'Overdue ' + formattedDate
  if (dateStr === today) return 'Today'
  return formattedDate
}
</script>

<style scoped>
.task-card {
  position: relative;
  padding: var(--space-3);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  cursor: grab;
  transition: all var(--duration-fast) ease;
}

.task-card:hover {
  background: var(--state-hover-bg);
  transform: translateY(-1px);
}

.priority-stripe {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
}

.priority-high { background: var(--color-priority-high); }
.priority-medium { background: var(--color-priority-medium); }
.priority-low { background: var(--color-priority-low); }

.task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.metadata-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.priority-badge {
  font-weight: var(--font-bold);
  text-transform: uppercase;
}

.due-badge-overdue { color: var(--status-error); }
.due-badge-today { color: var(--status-warning); }

.status-badge { opacity: 0.8; }

.task-actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.task-card:hover .task-actions {
  opacity: 1;
}

.action-btn {
  background: var(--glass-bg-heavy);
  border: none;
  color: var(--text-secondary);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.action-btn:hover {
  background: var(--brand-primary);
  color: white;
}

.timer-indicator {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  color: var(--brand-primary);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
</style>
