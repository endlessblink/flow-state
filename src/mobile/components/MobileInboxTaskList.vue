<template>
  <div class="mobile-task-list">
    <div v-if="filteredTasks.length === 0" class="empty-state">
      <Inbox :size="48" />
      <p v-if="viewMode === 'today'">
        All clear for today!
      </p>
      <p v-else-if="activeTimeFilter === 'all'">
        No tasks yet
      </p>
      <p v-else>
        No {{ timeFilterLabel }} tasks
      </p>
    </div>

    <!-- Grouped Task Display -->
    <template v-if="groupBy !== 'none' && filteredTasks.length > 0">
      <div v-for="group in groupedTasks" :key="group.key" class="task-group">
        <div class="group-header">
          <span v-if="group.color" class="group-color-dot" :style="{ backgroundColor: group.color }" />
          <span class="group-title">{{ group.title }}</span>
          <span class="group-count">{{ group.tasks.length }}</span>
        </div>
        <SwipeableTaskItem
          v-for="task in group.tasks"
          :key="task.id"
          :task-id="task.id"
          @edit="$emit('editTask', task)"
          @delete="$emit('deleteTask', task)"
        >
          <div
            class="mobile-task-item"
            :class="[{ 'timer-active': isTimerActive(task.id) }]"
            @click="$emit('clickTask', task)"
          >
            <div class="task-checkbox" @click.stop="$emit('toggleTask', task)">
              <div class="checkbox-circle" :class="[{ checked: task.status === 'done' }]">
                <Check v-if="task.status === 'done'" :size="14" />
              </div>
            </div>

            <div class="task-content">
              <div class="task-title-row">
                <span class="task-title" dir="auto" :class="[{ done: task.status === 'done' }]">{{ task.title }}</span>
                <span v-if="task.priority && groupBy !== 'priority'" class="priority-badge-inline" :class="[task.priority]">
                  {{ priorityLabel(task.priority || 'none') }}
                </span>
              </div>
              <div class="task-meta">
                <span v-if="task.dueDate && groupBy !== 'date'" class="due-date" :class="[{ overdue: isOverdue(task.dueDate) }]">
                  <Calendar :size="12" />
                  {{ formatDueDate(task.dueDate) }}
                </span>
                <span v-if="getProjectName(task.projectId) && groupBy !== 'project'" class="project-badge">
                  {{ getProjectName(task.projectId) }}
                </span>
              </div>
            </div>

            <button class="timer-btn" @click.stop="$emit('startTimer', task)">
              <Play :size="16" />
            </button>
          </div>
        </SwipeableTaskItem>
      </div>
    </template>

    <!-- Flat List (no grouping) -->
    <template v-else>
      <SwipeableTaskItem
        v-for="task in filteredTasks"
        :key="task.id"
        :task-id="task.id"
        @edit="$emit('editTask', task)"
        @delete="$emit('deleteTask', task)"
      >
        <div
          class="mobile-task-item"
          :class="[{ 'timer-active': isTimerActive(task.id) }]"
          @click="$emit('clickTask', task)"
        >
          <div class="task-checkbox" @click.stop="$emit('toggleTask', task)">
            <div class="checkbox-circle" :class="[{ checked: task.status === 'done' }]">
              <Check v-if="task.status === 'done'" :size="14" />
            </div>
          </div>

          <div class="task-content">
            <div class="task-title-row">
              <span class="task-title" dir="auto" :class="[{ done: task.status === 'done' }]">{{ task.title }}</span>
              <span v-if="task.priority" class="priority-badge-inline" :class="[task.priority]">
                {{ priorityLabel(task.priority || 'none') }}
              </span>
            </div>
            <div class="task-meta">
              <span v-if="task.dueDate" class="due-date" :class="[{ overdue: isOverdue(task.dueDate) }]">
                <Calendar :size="12" />
                {{ formatDueDate(task.dueDate) }}
              </span>
              <span v-if="getProjectName(task.projectId)" class="project-badge">
                {{ getProjectName(task.projectId) }}
              </span>
            </div>
          </div>

          <button class="timer-btn" @click.stop="$emit('startTimer', task)">
            <Play :size="16" />
          </button>
        </div>
      </SwipeableTaskItem>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Inbox, Check, Play, Calendar } from 'lucide-vue-next'
import SwipeableTaskItem from '@/mobile/components/SwipeableTaskItem.vue'
import { formatDueDate as formatDueDateUtil } from '@/utils/dateUtils'
import type { Task } from '@/stores/tasks'
import type { ViewMode, TimeFilterType } from '@/mobile/composables/useMobileInboxLogic'
import type { GroupByType } from '@/composables/mobile/useMobileFilters'

defineProps<{
  filteredTasks: Task[]
  groupedTasks: any[]
  viewMode: ViewMode
  activeTimeFilter: TimeFilterType
  groupBy: GroupByType
  timeFilterLabel: string
  
  // Helpers
  isTimerActive: (taskId: string) => boolean
  priorityLabel: (priority: string) => string
  isOverdue: (dueDate: string | Date | undefined) => boolean
  getProjectName: (projectId: string | null | undefined) => string | null
}>()

defineEmits<{
  (e: 'editTask', task: Task): void
  (e: 'deleteTask', task: Task): void
  (e: 'clickTask', task: Task): void
  (e: 'toggleTask', task: Task): void
  (e: 'startTimer', task: Task): void
}>()

const formatDueDate = (date: string | Date) => {
    return formatDueDateUtil(new Date(date))
}
</script>

<style scoped>
/* Task List */
.mobile-task-list {
  flex: 1;
  padding: 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-4);
  color: var(--text-tertiary);
  text-align: center;
  gap: var(--space-4);
  opacity: 0.8;
}

.empty-state p {
  font-size: var(--text-base);
  margin: 0;
}

/* Task Groups */
.task-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.task-group:not(:first-child) {
  margin-top: var(--space-4);
}

.group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-1);
  border-bottom: 1px solid var(--border-subtle);
}

.group-color-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.group-title {
  font-size: var(--text-meta);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  flex: 1;
}

.group-count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background: var(--surface-secondary);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-sm);
}

/* Base Task Item inside swipe container */
.mobile-task-item {
  display: flex;
  align-items: center;
  background: var(--surface-primary);
  padding: var(--space-3_5);
  border-radius: var(--radius-lg);
  gap: var(--space-3);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  /* Prevent text selection during swipe */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.mobile-task-item:active {
  background: var(--surface-tertiary);
}

.mobile-task-item.timer-active {
  border: var(--space-0_5) solid var(--timer-active-border, var(--brand-primary));
  box-shadow: var(--timer-active-glow-strong);
}

.task-checkbox {
  padding: var(--space-1);
  flex-shrink: 0;
}

.checkbox-circle {
  width: var(--space-5);
  height: var(--space-5);
  border: var(--space-0_5) solid var(--border-subtle);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal);
}

.checkbox-circle.checked {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: white;
}

.task-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.task-title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.task-title {
  font-size: var(--text-base);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  transition: all var(--duration-normal);
}

.task-title.done {
  text-decoration: line-through;
  color: var(--text-tertiary);
}

/* Inline Priority Badge within title block */
.priority-badge-inline {
  font-size: 10px;
  font-weight: var(--font-bold);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  margin-top: 2px;
}

.priority-badge-inline.high, .priority-badge-inline.critical {
  background: var(--priority-high-bg);
  color: var(--color-priority-high);
}

.priority-badge-inline.medium {
  background: var(--priority-medium-bg);
  color: var(--color-priority-medium);
}

.priority-badge-inline.low {
  background: var(--priority-low-bg);
  color: var(--color-priority-low);
}

.task-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-xs);
}

.due-date {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-secondary);
}

.due-date.overdue {
  color: var(--color-danger);
  font-weight: var(--font-medium);
}

/* Project badge in task meta */
.project-badge {
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-xs);
  background: var(--surface-tertiary);
  color: var(--text-tertiary);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timer-btn {
  width: var(--space-8);
  height: var(--space-8);
  border-radius: var(--radius-full);
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--duration-fast);
}

.mobile-task-item.timer-active .timer-btn {
  background: var(--brand-primary);
  color: white;
  border-color: var(--brand-primary);
  animation: pulse 2s infinite;
}

[dir="rtl"] .task-meta {
  flex-direction: row-reverse;
  justify-content: flex-end;
}

[dir="rtl"] .task-title-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .group-header {
  flex-direction: row-reverse;
}
</style>
