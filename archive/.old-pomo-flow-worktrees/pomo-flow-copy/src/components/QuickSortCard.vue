<template>
  <div
    class="quick-sort-card"
    :class="{ 'is-swiping': isSwiping }"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
  >
    <div class="card-content">
      <!-- Task Title -->
      <h2 class="task-title">
        {{ task.title }}
      </h2>

      <!-- Task Description -->
      <p v-if="task.description" class="task-description">
        {{ task.description }}
      </p>

      <!-- Task Metadata -->
      <div class="task-metadata">
        <div class="metadata-item">
          <Calendar :size="16" />
          <span>{{ formattedDueDate }}</span>
        </div>

        <div class="metadata-item">
          <Flag :size="16" :class="task.priority ? `priority-${task.priority}` : ''" />
          <span class="capitalize">{{ task.priority || 'No priority' }}</span>
        </div>

        <div v-if="task.subtasks && task.subtasks.length > 0" class="metadata-item">
          <ListTodo :size="16" />
          <span>{{ completedSubtasks }} / {{ task.subtasks.length }} subtasks</span>
        </div>

        <div v-if="task.completedPomodoros > 0" class="metadata-item">
          <Timer :size="16" />
          <span>{{ task.completedPomodoros }} 🍅</span>
        </div>
      </div>

      <!-- Quick Edit Actions -->
      <div class="quick-edit-actions">
        <div class="edit-section">
          <label class="edit-label">Priority:</label>
          <div class="priority-buttons">
            <button
              class="priority-btn"
              :class="{ active: task.priority === 'low' }"
              @click="updatePriority('low')"
            >
              Low
            </button>
            <button
              class="priority-btn"
              :class="{ active: task.priority === 'medium' }"
              @click="updatePriority('medium')"
            >
              Medium
            </button>
            <button
              class="priority-btn"
              :class="{ active: task.priority === 'high' }"
              @click="updatePriority('high')"
            >
              High
            </button>
          </div>
        </div>

        <div class="edit-section">
          <label class="edit-label">Due Date:</label>

          <!-- Clickable Date Display with Hidden Input -->
          <div class="date-input-wrapper" @click="openDatePicker">
            <Calendar :size="16" class="date-icon" />
            <span class="date-display">{{ formattedDueDate }}</span>
            <input
              ref="dateInputRef"
              type="date"
              class="date-input-hidden"
              :value="dueDateValue"
              @change="updateDueDate"
              @click.stop
            />
          </div>

          <!-- Quick Date Shortcuts -->
          <div class="quick-date-shortcuts">
            <button class="quick-date-btn" @click.stop="setToday">Today</button>
            <button class="quick-date-btn" @click.stop="setTomorrow">Tomorrow</button>
            <button class="quick-date-btn" @click.stop="setWeekend">Weekend</button>
            <button class="quick-date-btn" @click.stop="setNextWeek">Next Week</button>
            <button class="quick-date-btn clear-btn" @click.stop="clearDate">Clear</button>
          </div>
        </div>

        <div class="edit-section">
          <label class="edit-label">Actions:</label>
          <div class="action-buttons-group">
            <button
              class="mark-done-btn action-icon-btn"
              @click.stop="handleMarkDone"
              title="Mark Done (D)"
            >
              <CheckCircle :size="20" />
              <kbd class="shortcut-key">D</kbd>
            </button>
            <button
              class="edit-btn action-icon-btn"
              @click.stop="handleEditTask"
              title="Edit Task (E)"
            >
              <Edit :size="20" />
              <kbd class="shortcut-key">E</kbd>
            </button>
            <button
              class="delete-btn action-icon-btn"
              @click.stop="handleMarkDoneAndDelete"
              title="Done + Delete (Del)"
            >
              <Trash2 :size="20" />
              <kbd class="shortcut-key">Del</kbd>
            </button>
          </div>
        </div>
      </div>

      <!-- Swipe Indicator (visible during drag) -->
      <div v-if="isSwiping" class="swipe-indicator" :class="swipeDirection">
        <ArrowRight v-if="swipeDirection === 'right'" :size="32" />
        <ArrowLeft v-if="swipeDirection === 'left'" :size="32" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Calendar, Flag, ListTodo, Timer, ArrowRight, ArrowLeft, CheckCircle, Trash2, Edit } from 'lucide-vue-next'
import type { Task } from '@/types/tasks'

interface Props {
  task: Task
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updateTask: [updates: Partial<Task>]
  markDone: []
  markDoneAndDelete: []
  editTask: []
}>()

// Date picker ref
const dateInputRef = ref<HTMLInputElement | null>(null)

// Swipe handling
const isSwiping = ref(false)
const swipeStartX = ref(0)
const swipeCurrentX = ref(0)

const SWIPE_THRESHOLD = 120 // pixels

const swipeDirection = computed(() => {
  const delta = swipeCurrentX.value - swipeStartX.value
  if (Math.abs(delta) < 30) return null
  return delta > 0 ? 'right' : 'left'
})

// Task metadata
const formattedDueDate = computed(() => {
  if (!props.task.dueDate) return 'No date set'
  const date = new Date(props.task.dueDate)
  if (isNaN(date.getTime())) return 'No date set'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

const completedSubtasks = computed(() => {
  if (!props.task.subtasks) return 0
  return props.task.subtasks.filter((s) => s.completed).length
})

// Due date value for input (in YYYY-MM-DD format)
const dueDateValue = computed(() => {
  if (!props.task.dueDate) return ''
  const date = new Date(props.task.dueDate)
  if (isNaN(date.getTime())) return ''
  // Format as YYYY-MM-DD for date input
  return date.toISOString().split('T')[0]
})

// Task editing functions
function updatePriority(priority: 'low' | 'medium' | 'high') {
  emit('updateTask', { priority })
}

function updateDueDate(event: Event) {
  const input = event.target as HTMLInputElement
  const dateValue = input.value
  if (dateValue) {
    // Convert YYYY-MM-DD to ISO date string
    const date = new Date(dateValue)
    emit('updateTask', { dueDate: date.toISOString() })
  } else {
    emit('updateTask', { dueDate: '' })
  }
}

// Open date picker programmatically
function openDatePicker() {
  if (dateInputRef.value) {
    dateInputRef.value.showPicker()
  }
}

// Quick date shortcuts
function setToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  emit('updateTask', { dueDate: today.toISOString() })
}

function setTomorrow() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  emit('updateTask', { dueDate: tomorrow.toISOString() })
}

function setWeekend() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7
  const saturday = new Date()
  saturday.setDate(today.getDate() + daysUntilSaturday)
  saturday.setHours(0, 0, 0, 0)
  emit('updateTask', { dueDate: saturday.toISOString() })
}

function setNextWeek() {
  const nextMonday = new Date()
  const dayOfWeek = nextMonday.getDay()
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  nextMonday.setDate(nextMonday.getDate() + daysUntilNextMonday)
  nextMonday.setHours(0, 0, 0, 0)
  emit('updateTask', { dueDate: nextMonday.toISOString() })
}

function clearDate() {
  emit('updateTask', { dueDate: '' })
}

// Mark Done handler
function handleMarkDone() {
  emit('markDone')
}

// Edit Task handler
function handleEditTask() {
  emit('editTask')
}

// Mark Done and Delete handler
function handleMarkDoneAndDelete() {
  emit('markDoneAndDelete')
}

// Mouse/Touch handling
function handleMouseDown(event: MouseEvent) {
  isSwiping.value = true
  swipeStartX.value = event.clientX

  const handleMouseMove = (e: MouseEvent) => {
    swipeCurrentX.value = e.clientX
  }

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    handleSwipeEnd()
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleTouchStart(event: TouchEvent) {
  isSwiping.value = true
  swipeStartX.value = event.touches[0].clientX

  const handleTouchMove = (e: TouchEvent) => {
    swipeCurrentX.value = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
    handleSwipeEnd()
  }

  document.addEventListener('touchmove', handleTouchMove)
  document.addEventListener('touchend', handleTouchEnd)
}

function handleSwipeEnd() {
  const delta = swipeCurrentX.value - swipeStartX.value

  // For now, just reset - actual categorization will be handled by parent
  // This is just the visual component

  isSwiping.value = false
  swipeStartX.value = 0
  swipeCurrentX.value = 0
}
</script>

<style scoped>
.quick-sort-card {
  position: relative;
  width: 100%;
  max-width: 600px;
  min-height: 300px;
  background: var(--glass-bg-medium);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: var(--shadow-2xl);
  transition: transform var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal);
  cursor: grab;
  user-select: none;
}

.quick-sort-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-3xl);
}

.quick-sort-card.is-swiping {
  cursor: grabbing;
  transition: none;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.task-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  line-height: var(--leading-tight);
}

.task-description {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0;
  max-height: 120px;
  overflow-y: auto;
}

.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-top: auto;
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
}

.metadata-item .priority-high {
  color: var(--danger);
}

.metadata-item .priority-medium {
  color: var(--warning);
}

.metadata-item .priority-low {
  color: var(--success);
}

.capitalize {
  text-transform: capitalize;
}

.swipe-indicator {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.3;
  transition: opacity var(--duration-normal);
}

.swipe-indicator.right {
  right: var(--space-5);
  color: var(--success);
}

.swipe-indicator.left {
  left: var(--space-5);
  color: var(--info);
}

/* Quick Edit Actions */
.quick-edit-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-5);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-subtle);
}

.edit-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.edit-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.priority-buttons {
  display: flex;
  gap: var(--space-2);
}

.priority-btn {
  flex: 1;
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.priority-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
}

.priority-btn.active {
  background: var(--brand-gradient);
  border-color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

/* Date Input Wrapper - Clickable with Calendar Icon */
.date-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  padding: var(--space-2_5) var(--space-3_5);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal);
  position: relative;
}

.date-input-wrapper:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
}

.date-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.date-display {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.date-input-hidden {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  cursor: pointer;
}

.date-input-hidden::-webkit-calendar-picker-indicator {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  opacity: 0;
  cursor: pointer;
}

/* Quick Date Shortcuts */
.quick-date-shortcuts {
  display: flex;
  gap: var(--space-1_5);
  flex-wrap: wrap;
}

.quick-date-btn {
  flex: 1;
  min-width: fit-content;
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
  white-space: nowrap;
}

.quick-date-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  transform: translateY(-1px);
}

.quick-date-btn.clear-btn {
  border-color: var(--danger-muted);
  color: var(--danger);
}

.quick-date-btn.clear-btn:hover {
  background: var(--danger-bg);
  border-color: var(--danger);
  color: var(--danger);
}

/* Action Buttons Group */
.action-buttons-group {
  display: flex;
  gap: var(--space-2);
  justify-content: center;
}

/* Base Icon Button Styles */
.action-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 56px;
  height: 56px;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.action-icon-btn .shortcut-key {
  position: absolute;
  bottom: var(--space-1);
  right: var(--space-1);
  padding: var(--space-0_5) var(--space-1);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  font-size: 9px;
  font-weight: var(--font-medium);
  font-family: var(--font-mono);
  line-height: 1;
}

/* Mark as Done Button */
.mark-done-btn {
  background: var(--success-bg);
  border: 1px solid var(--success-muted);
  color: var(--success);
}

.mark-done-btn:hover {
  background: var(--success);
  color: var(--bg-primary);
  border-color: var(--success);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Edit Button */
.edit-btn {
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.edit-btn:hover {
  background: var(--brand-primary);
  color: var(--bg-primary);
  border-color: var(--brand-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Delete Button */
.delete-btn {
  background: var(--danger-bg);
  border: 1px solid var(--danger-muted);
  color: var(--danger);
}

.delete-btn:hover {
  background: var(--danger);
  color: var(--bg-primary);
  border-color: var(--danger);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  .quick-sort-card {
    transition: none !important;
  }

  .swipe-indicator {
    transition: none !important;
  }
}
</style>
