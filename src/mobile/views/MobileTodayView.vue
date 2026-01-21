<template>
  <div class="mobile-today">
    <div class="today-header">
      <div class="date-display">
        <h2>{{ dayOfWeek }}</h2>
        <span class="full-date">{{ formattedDate }}</span>
      </div>
      <div class="task-count">
        {{ todayTasks.length }} tasks
      </div>
    </div>

    <!-- Time-based sections -->
    <div class="time-sections">
      <!-- Overdue -->
      <div v-if="overdueTasks.length > 0" class="time-section overdue">
        <div class="section-header">
          <AlertCircle :size="16" />
          <span>Overdue</span>
          <span class="count">{{ overdueTasks.length }}</span>
        </div>
        <div class="task-list">
          <div
            v-for="task in overdueTasks"
            :key="task.id"
            class="task-item"
            @click="handleTaskClick(task)"
          >
            <div class="task-checkbox" @click.stop="toggleTask(task)">
              <div :class="['checkbox-circle', { checked: task.status === 'done' }]">
                <Check v-if="task.status === 'done'" :size="14" />
              </div>
            </div>
            <div class="task-content">
              <span :class="['task-title', { done: task.status === 'done' }]">{{ task.title }}</span>
              <span v-if="task.dueDate" class="task-due overdue">{{ formatDueTime(task.dueDate) }}</span>
            </div>
            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Morning -->
      <div v-if="morningTasks.length > 0" class="time-section">
        <div class="section-header">
          <Sunrise :size="16" />
          <span>Morning</span>
          <span class="count">{{ morningTasks.length }}</span>
        </div>
        <div class="task-list">
          <div
            v-for="task in morningTasks"
            :key="task.id"
            class="task-item"
            @click="handleTaskClick(task)"
          >
            <div class="task-checkbox" @click.stop="toggleTask(task)">
              <div :class="['checkbox-circle', { checked: task.status === 'done' }]">
                <Check v-if="task.status === 'done'" :size="14" />
              </div>
            </div>
            <div class="task-content">
              <span :class="['task-title', { done: task.status === 'done' }]">{{ task.title }}</span>
              <span v-if="task.dueDate" class="task-due">{{ formatDueTime(task.dueDate) }}</span>
            </div>
            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Afternoon -->
      <div v-if="afternoonTasks.length > 0" class="time-section">
        <div class="section-header">
          <Sun :size="16" />
          <span>Afternoon</span>
          <span class="count">{{ afternoonTasks.length }}</span>
        </div>
        <div class="task-list">
          <div
            v-for="task in afternoonTasks"
            :key="task.id"
            class="task-item"
            @click="handleTaskClick(task)"
          >
            <div class="task-checkbox" @click.stop="toggleTask(task)">
              <div :class="['checkbox-circle', { checked: task.status === 'done' }]">
                <Check v-if="task.status === 'done'" :size="14" />
              </div>
            </div>
            <div class="task-content">
              <span :class="['task-title', { done: task.status === 'done' }]">{{ task.title }}</span>
              <span v-if="task.dueDate" class="task-due">{{ formatDueTime(task.dueDate) }}</span>
            </div>
            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Evening -->
      <div v-if="eveningTasks.length > 0" class="time-section">
        <div class="section-header">
          <Moon :size="16" />
          <span>Evening</span>
          <span class="count">{{ eveningTasks.length }}</span>
        </div>
        <div class="task-list">
          <div
            v-for="task in eveningTasks"
            :key="task.id"
            class="task-item"
            @click="handleTaskClick(task)"
          >
            <div class="task-checkbox" @click.stop="toggleTask(task)">
              <div :class="['checkbox-circle', { checked: task.status === 'done' }]">
                <Check v-if="task.status === 'done'" :size="14" />
              </div>
            </div>
            <div class="task-content">
              <span :class="['task-title', { done: task.status === 'done' }]">{{ task.title }}</span>
              <span v-if="task.dueDate" class="task-due">{{ formatDueTime(task.dueDate) }}</span>
            </div>
            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- No specific time -->
      <div v-if="untimedTasks.length > 0" class="time-section">
        <div class="section-header">
          <Calendar :size="16" />
          <span>Anytime Today</span>
          <span class="count">{{ untimedTasks.length }}</span>
        </div>
        <div class="task-list">
          <div
            v-for="task in untimedTasks"
            :key="task.id"
            class="task-item"
            @click="handleTaskClick(task)"
          >
            <div class="task-checkbox" @click.stop="toggleTask(task)">
              <div :class="['checkbox-circle', { checked: task.status === 'done' }]">
                <Check v-if="task.status === 'done'" :size="14" />
              </div>
            </div>
            <div class="task-content">
              <span :class="['task-title', { done: task.status === 'done' }]">{{ task.title }}</span>
            </div>
            <button class="timer-btn" @click.stop="startTimer(task)">
              <Play :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="todayTasks.length === 0" class="empty-state">
        <CheckCircle :size="48" />
        <h3>All clear for today!</h3>
        <p>No tasks scheduled. Add one from Inbox.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
// @ts-ignore - Avoid strict type check on imported Task type if causing issues
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import {
  Check, Play, AlertCircle, Sunrise, Sun, Moon, Calendar, CheckCircle
} from 'lucide-vue-next'

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Date formatting
const now = new Date()
const dayOfWeek = computed(() => {
  return now.toLocaleDateString('en-US', { weekday: 'long' })
})
const formattedDate = computed(() => {
  return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
})

// Get today's date boundaries
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

// Filter tasks for today
const todayTasks = computed(() => {
  return taskStore.tasks.filter(t => {
    if (!t.dueDate) return false
    const dueDate = new Date(t.dueDate)
    return dueDate >= todayStart && dueDate <= todayEnd
  })
})

// Overdue tasks (before today)
const overdueTasks = computed(() => {
  return taskStore.tasks.filter(t => {
    if (!t.dueDate || t.status === 'done') return false
    const dueDate = new Date(t.dueDate)
    return dueDate < todayStart
  })
})

// Time-based categorization
const getTaskHour = (task: Task): number | null => {
  if (!task.dueDate) return null
  return new Date(task.dueDate).getHours()
}

const morningTasks = computed(() => {
  return todayTasks.value.filter(t => {
    const hour = getTaskHour(t)
    return hour !== null && hour >= 6 && hour < 12
  })
})

const afternoonTasks = computed(() => {
  return todayTasks.value.filter(t => {
    const hour = getTaskHour(t)
    return hour !== null && hour >= 12 && hour < 18
  })
})

const eveningTasks = computed(() => {
  return todayTasks.value.filter(t => {
    const hour = getTaskHour(t)
    return hour !== null && (hour >= 18 || hour < 6)
  })
})

const untimedTasks = computed(() => {
  return todayTasks.value.filter(t => {
    if (!t.dueDate) return true
    const dueDate = new Date(t.dueDate)
    // Check if it's just a date without specific time (midnight)
    return dueDate.getHours() === 0 && dueDate.getMinutes() === 0
  })
})

const formatDueTime = (dueDate: string | Date | undefined): string => {
  if (!dueDate) return ''
  const date = new Date(dueDate)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const toggleTask = (task: Task) => {
  const newStatus = task.status === 'done' ? 'planned' : 'done'
  taskStore.updateTask(task.id, { status: newStatus })
}

const handleTaskClick = (task: Task) => {
  console.log('Task clicked', task.id)
  // Could open task detail modal
}

const startTimer = (task: Task) => {
  timerStore.startTimer(task.id)
}
</script>

<style scoped>
.mobile-today {
  padding: 16px;
  padding-bottom: 100px;
  min-height: 100vh;
  background: var(--app-background-gradient);
}

.today-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.date-display h2 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.full-date {
  font-size: 14px;
  color: var(--text-tertiary);
}

.task-count {
  background: var(--surface-secondary);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.time-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.time-section {
  background: var(--surface-primary);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.time-section.overdue {
  border-left: 3px solid var(--danger-text);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.section-header .count {
  margin-left: auto;
  background: var(--surface-secondary);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface-secondary);
  border-radius: 12px;
  cursor: pointer;
}

.task-checkbox {
  padding: 4px;
}

.checkbox-circle {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-subtle);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.checkbox-circle.checked {
  background: var(--primary-brand);
  border-color: var(--primary-brand);
  color: white;
}

.task-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.task-title {
  font-size: 15px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-title.done {
  text-decoration: line-through;
  color: var(--text-muted);
}

.task-due {
  font-size: 12px;
  color: var(--text-tertiary);
}

.task-due.overdue {
  color: var(--danger-text);
}

.timer-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--primary-brand-bg-subtle);
  color: var(--primary-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.timer-btn:active {
  transform: scale(0.95);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.empty-state h3 {
  margin: 16px 0 8px;
  font-size: 20px;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>
