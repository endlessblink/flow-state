<template>
  <div class="mobile-task-list">
    <!-- Pull to refresh indicator -->
    <div
      v-if="isRefreshing"
      class="refresh-indicator"
    >
      <div class="refresh-spinner" />
    </div>

    <!-- Task cards with swipe actions -->
    <div
      v-for="task in tasks"
      :key="task.id"
      class="task-card-wrapper"
    >
      <div
        ref="taskCards"
        class="task-card"
        :class="{ 'swiping': swipingTaskId === task.id }"
        :style="getSwipeStyle(task.id)"
        @touchstart="handleTouchStart($event, task.id)"
        @touchmove="handleTouchMove($event, task.id)"
        @touchend="handleTouchEnd($event, task.id)"
        @click="$emit('task-click', task)"
      >
        <!-- Swipe action backgrounds -->
        <div class="swipe-action swipe-action-left">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Delete</span>
        </div>
        <div class="swipe-action swipe-action-right">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>Complete</span>
        </div>

        <!-- Task content -->
        <div class="task-content">
          <div class="task-header">
            <div class="task-priority" :class="`priority-${task.priority}`" />
            <h3 class="task-title">{{ task.title }}</h3>
          </div>

          <div v-if="task.description" class="task-description">
            {{ task.description }}
          </div>

          <div class="task-meta">
            <span v-if="task.projectId" class="task-project">
              {{ getProjectName(task.projectId) }}
            </span>
            <span v-if="task.dueDate" class="task-due-date" :class="{ overdue: isOverdue(task.dueDate) }">
              {{ formatDueDate(task.dueDate) }}
            </span>
            <span v-if="task.pomodorosEstimated" class="task-pomodoros">
              🍅 {{ task.pomodorosCompleted }}/{{ task.pomodorosEstimated }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="tasks.length === 0" class="empty-state">
      <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p class="empty-text">No tasks yet</p>
      <p class="empty-hint">Tap the + button to create your first task</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import type { Task, Project } from '@/types'

interface Props {
  tasks: Task[]
  projects?: Project[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'task-click': [task: Task]
  'task-complete': [taskId: string]
  'task-delete': [taskId: string]
  'refresh': []
}>()

// Swipe gesture state
const swipingTaskId = ref<string | null>(null)
const swipeOffset = ref<Record<string, number>>({})
const swipeStartX = ref<number>(0)
const swipeStartY = ref<number>(0)
const isRefreshing = ref(false)

const SWIPE_THRESHOLD = 100
const DELETE_THRESHOLD = -100
const COMPLETE_THRESHOLD = 100

// Touch handlers
function handleTouchStart(event: TouchEvent, taskId: string) {
  const touch = event.touches[0]
  swipeStartX.value = touch.clientX
  swipeStartY.value = touch.clientY
  swipingTaskId.value = taskId
}

function handleTouchMove(event: TouchEvent, taskId: string) {
  if (swipingTaskId.value !== taskId) return

  const touch = event.touches[0]
  const deltaX = touch.clientX - swipeStartX.value
  const deltaY = touch.clientY - swipeStartY.value

  // Only allow horizontal swipe (ignore vertical scrolling)
  if (Math.abs(deltaY) > Math.abs(deltaX)) return

  // Prevent default to stop scrolling while swiping
  event.preventDefault()

  // Limit swipe distance
  const maxSwipe = 150
  const limitedDelta = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX))

  swipeOffset.value[taskId] = limitedDelta
}

function handleTouchEnd(event: TouchEvent, taskId: string) {
  if (swipingTaskId.value !== taskId) return

  const offset = swipeOffset.value[taskId] || 0

  // Check if swipe exceeded threshold
  if (offset <= DELETE_THRESHOLD) {
    // Swipe left - delete
    emit('task-delete', taskId)
  } else if (offset >= COMPLETE_THRESHOLD) {
    // Swipe right - complete
    emit('task-complete', taskId)
  }

  // Reset swipe
  swipeOffset.value[taskId] = 0
  swipingTaskId.value = null
}

function getSwipeStyle(taskId: string) {
  const offset = swipeOffset.value[taskId] || 0
  return {
    transform: `translateX(${offset}px)`,
    transition: swipingTaskId.value === taskId ? 'none' : 'transform 0.3s ease-out'
  }
}

// Helper functions
function getProjectName(projectId: string): string {
  return props.projects?.find(p => p.id === projectId)?.name || 'Unknown'
}

function formatDueDate(timestamp: number): string {
  const date = new Date(timestamp)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'MMM d')
}

function isOverdue(timestamp: number): boolean {
  return isPast(new Date(timestamp)) && !isToday(new Date(timestamp))
}
</script>

<style scoped>
.mobile-task-list {
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  height: 100%;
  padding: var(--space-2) var(--space-3);
}

.refresh-indicator {
  position: absolute;
  top: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.refresh-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--neutral-600);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.task-card-wrapper {
  position: relative;
  margin-bottom: var(--space-3);
}

.task-card {
  position: relative;
  background: var(--neutral-800);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  user-select: none;
  touch-action: pan-y;
}

.task-card.swiping {
  cursor: grabbing;
}

/* Swipe action backgrounds */
.swipe-action {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  font-size: var(--text-sm);
  font-weight: 500;
  color: white;
  opacity: 0;
  transition: opacity 0.2s;
}

.swipe-action-left {
  left: 0;
  right: auto;
  background: linear-gradient(to right, var(--status-error), transparent);
  justify-content: flex-start;
}

.swipe-action-right {
  right: 0;
  left: auto;
  background: linear-gradient(to left, var(--status-success), transparent);
  justify-content: flex-end;
}

.task-card[style*="translateX(-"] ~ .swipe-action-left,
.task-card[style*="translateX("] ~ .swipe-action-right {
  opacity: 1;
}

/* Task content */
.task-content {
  position: relative;
  z-index: 1;
}

.task-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.task-priority {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  margin-top: 8px;
  flex-shrink: 0;
}

.priority-low { background: var(--neutral-500); }
.priority-medium { background: var(--accent-blue); }
.priority-high { background: var(--accent-orange); }
.priority-urgent { background: var(--status-error); }

.task-title {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--neutral-100);
  line-height: 1.5;
}

.task-description {
  font-size: var(--text-sm);
  color: var(--neutral-400);
  margin-bottom: var(--space-3);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--neutral-500);
}

.task-project {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  background: var(--neutral-700);
  border-radius: var(--radius-sm);
}

.task-due-date {
  display: inline-flex;
  align-items: center;
}

.task-due-date.overdue {
  color: var(--status-error);
  font-weight: 500;
}

.task-pomodoros {
  display: inline-flex;
  align-items: center;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--neutral-500);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-text {
  font-size: var(--text-lg);
  font-weight: 500;
  margin-bottom: var(--space-2);
}

.empty-hint {
  font-size: var(--text-sm);
  opacity: 0.7;
}
</style>
