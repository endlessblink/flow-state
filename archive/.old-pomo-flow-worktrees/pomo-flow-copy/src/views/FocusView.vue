<template>
  <div class="focus-mode-container">
    <div v-if="currentTask" class="focus-content">
      <!-- Exit Button (Top Right) -->
      <button class="exit-focus-btn" @click="exitFocus" title="Exit Focus Mode (Esc)">
        <X :size="20" />
        <span>Exit Focus</span>
      </button>

      <!-- Centered Task Card -->
      <div class="focus-task-card">
        <!-- Task Header -->
        <div class="focus-header">
          <div class="task-priority-badge" :class="`priority-${currentTask.priority || 'medium'}`">
            {{ (currentTask.priority || 'medium').toUpperCase() }}
          </div>
          <h1 class="focus-task-title">{{ currentTask.title }}</h1>
        </div>

        <!-- Task Description -->
        <p v-if="currentTask.description" class="focus-task-description">
          {{ currentTask.description }}
        </p>

        <!-- Subtasks Checklist -->
        <div v-if="currentTask.subtasks && currentTask.subtasks.length > 0" class="subtasks-section">
          <h3 class="subtasks-title">Subtasks</h3>
          <div class="subtasks-list">
            <div
              v-for="(subtask, index) in currentTask.subtasks"
              :key="index"
              class="subtask-item"
              @click="toggleSubtask(index)"
            >
              <div class="subtask-checkbox" :class="{ checked: subtask.isCompleted }">
                <Check v-if="subtask.isCompleted" :size="14" />
              </div>
              <span class="subtask-text" :class="{ completed: subtask.isCompleted }">
                {{ subtask.title }}
              </span>
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="progress-section">
          <div class="progress-label">
            <span>Progress</span>
            <span class="progress-percentage">{{ currentTask.progress || 0 }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${currentTask.progress || 0}%` }"></div>
          </div>
        </div>

        <!-- Pomodoro Timer Section -->
        <div class="timer-section">
          <div class="timer-display-large">
            <div class="timer-icon-large">
              <span v-if="timerStore.isTimerActive && !timerStore.currentSession?.isBreak" class="timer-emoticon">🍅</span>
              <span v-else-if="timerStore.isTimerActive && timerStore.currentSession?.isBreak" class="timer-emoticon">🧎</span>
              <Timer v-else :size="32" :stroke-width="1.5" />
            </div>
            <div class="timer-time-large">{{ timerStore.displayTime }}</div>
          </div>

          <div class="timer-controls-large">
            <button
              v-if="!timerStore.currentSession"
              class="focus-timer-btn start"
              @click="startTimer"
            >
              <Play :size="20" />
              Start Timer
            </button>

            <button
              v-else-if="timerStore.isPaused"
              class="focus-timer-btn resume"
              @click="timerStore.resumeTimer"
            >
              <Play :size="20" />
              Resume
            </button>

            <button
              v-else
              class="focus-timer-btn pause"
              @click="timerStore.pauseTimer"
            >
              <Pause :size="20" />
              Pause
            </button>

            <button
              v-if="timerStore.currentSession"
              class="focus-timer-btn stop"
              @click="timerStore.stopTimer"
            >
              <Square :size="20" />
              Stop
            </button>
          </div>
        </div>

        <!-- Session Count -->
        <div class="session-count">
          🍅 {{ currentTask.completedPomodoros || 0 }} session{{ currentTask.completedPomodoros !== 1 ? 's' : '' }} completed
        </div>
      </div>
    </div>

    <!-- Task Not Found -->
    <div v-else class="task-not-found">
      <p>Task not found</p>
      <button class="exit-focus-btn" @click="exitFocus">
        Return to Board
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useFocusMode } from '@/composables/useFocusMode'
import { X, Timer, Play, Pause, Square, Check } from 'lucide-vue-next'

const route = useRoute()
const taskStore = useTaskStore()
const timerStore = useTimerStore()
const { exitFocusMode } = useFocusMode()

const currentTask = computed(() => {
  const taskId = route.params.taskId as string
  return taskStore.tasks.find(t => t.id === taskId)
})

const startTimer = () => {
  if (currentTask.value) {
    timerStore.startTimer(currentTask.value.id)
  }
}

const exitFocus = () => {
  exitFocusMode()
}

const toggleSubtask = (index: number) => {
  if (currentTask.value) {
    const subtasks = [...currentTask.value.subtasks]
    subtasks[index] = {
      ...subtasks[index],
      isCompleted: !subtasks[index].isCompleted
    }
    taskStore.updateTask(currentTask.value.id, { subtasks })
  }
}

// Keyboard shortcut: Esc to exit
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    exitFocus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.focus-mode-container {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: var(--space-8);
}

.focus-content {
  width: 100%;
  max-width: 700px;
  position: relative;
}

.exit-focus-btn {
  position: absolute;
  top: -60px;
  right: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-5);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.exit-focus-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow);
}

.focus-task-card {
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-2xl);
  padding: var(--space-10);
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.6),
    0 0 0 1px var(--glass-bg-soft),
    inset 0 1px 0 var(--glass-bg-heavy);
}

.focus-header {
  margin-bottom: var(--space-6);
}

.task-priority-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  letter-spacing: 0.05em;
  margin-bottom: var(--space-3);
}

.task-priority-badge.priority-high {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
}

.task-priority-badge.priority-medium {
  background: var(--orange-bg-subtle);
  color: var(--color-break);
  border: 1px solid var(--color-break);
}

.task-priority-badge.priority-low {
  background: var(--success-bg-subtle);
  color: var(--color-work);
  border: 1px solid var(--color-work);
}

.focus-task-title {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.focus-task-description {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0 0 var(--space-8) 0;
}

.subtasks-section {
  margin-bottom: var(--space-8);
  padding: var(--space-6);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
}

.subtasks-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-4) 0;
}

.subtasks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.subtask-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.subtask-item:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
}

.subtask-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--duration-fast) ease;
}

.subtask-checkbox.checked {
  background: var(--color-work);
  border-color: var(--color-work);
  color: white;
}

.subtask-text {
  font-size: var(--text-base);
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.subtask-text.completed {
  text-decoration: line-through;
  color: var(--text-muted);
}

.progress-section {
  margin-bottom: var(--space-8);
}

.progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

.progress-percentage {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.progress-bar {
  width: 100%;
  height: 12px;
  background: var(--surface-secondary);
  border-radius: var(--radius-full);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--color-work) 0%,
    var(--color-navigation) 100%
  );
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
  box-shadow: 0 0 12px var(--color-work);
}

.timer-section {
  margin-bottom: var(--space-8);
  padding: var(--space-8);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
}

.timer-display-large {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.timer-icon-large {
  font-size: 64px;
}

.timer-emoticon {
  animation: emoticonBounce 1.5s ease-in-out infinite;
}

@keyframes emoticonBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  25% { transform: translateY(-8px) scale(1.1); }
  50% { transform: translateY(0) scale(1); }
  75% { transform: translateY(-4px) scale(1.05); }
}

.timer-time-large {
  font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: var(--text-6xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  letter-spacing: 0.05em;
}

.timer-controls-large {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.focus-timer-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  min-height: 48px;
}

.focus-timer-btn.start {
  background: linear-gradient(
    135deg,
    var(--success-gradient-start) 0%,
    var(--success-gradient-end) 100%
  );
  color: white;
  box-shadow: var(--success-shadow);
}

.focus-timer-btn.start:hover {
  transform: scale(1.05);
  box-shadow: var(--success-shadow), 0 0 24px var(--success-bg-subtle);
}

.focus-timer-btn.resume {
  background: var(--color-work);
  color: white;
}

.focus-timer-btn.pause {
  background: var(--color-break);
  color: white;
}

.focus-timer-btn.stop {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
}

.focus-timer-btn.stop:hover {
  background: var(--danger-bg-subtle);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.session-count {
  text-align: center;
  font-size: var(--text-base);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

.task-not-found {
  text-align: center;
  color: var(--text-secondary);
}

.task-not-found p {
  font-size: var(--text-xl);
  margin-bottom: var(--space-6);
}
</style>
