<template>
  <div class="focus-view" @keydown="handleKeydown">
    <template v-if="currentTask">
      <!-- Timer Display -->
      <div class="focus-timer" :class="{ 'focus-timer--break': timerStore.currentSession?.isBreak }">
        {{ timerStore.displayTime }}
      </div>

      <!-- Task Title -->
      <h1 class="focus-title">
        {{ currentTask.title }}
      </h1>

      <!-- Task Description -->
      <p v-if="currentTask.description" class="focus-description">
        {{ currentTask.description }}
      </p>

      <!-- Subtasks -->
      <div v-if="subtasks.length > 0" class="focus-subtasks">
        <div
          v-for="subtask in subtasks"
          :key="subtask.id"
          class="focus-subtask"
          @click="toggleSubtask(subtask)"
        >
          <div
            class="focus-subtask-check"
            :class="{ 'focus-subtask-check--done': subtask.isCompleted }"
          />
          <span :class="{ 'focus-subtask-text--done': subtask.isCompleted }">
            {{ subtask.title }}
          </span>
        </div>
      </div>

      <!-- Controls -->
      <div class="focus-controls">
        <button
          v-if="!timerStore.isTimerActive"
          class="focus-btn focus-btn--start"
          @click="startFocusSession"
        >
          Start <kbd>Space</kbd>
        </button>
        <button
          v-else-if="timerStore.isPaused"
          class="focus-btn focus-btn--start"
          @click="timerStore.resumeTimer()"
        >
          Resume <kbd>Space</kbd>
        </button>
        <button
          v-else
          class="focus-btn focus-btn--pause"
          @click="timerStore.pauseTimer()"
        >
          Pause <kbd>Space</kbd>
        </button>

        <button class="focus-btn focus-btn--complete" @click="handleComplete">
          Complete <kbd>C</kbd>
        </button>
        <button
          v-if="timerStore.isTimerActive && !timerStore.isPaused"
          class="focus-btn focus-btn--pause-leave"
          @click="handlePauseAndLeave"
        >
          Pause & Leave <kbd>P</kbd>
        </button>
        <button class="focus-btn focus-btn--skip" @click="handleStop">
          Stop <kbd>Esc</kbd>
        </button>
      </div>
    </template>

    <!-- No task found -->
    <template v-else>
      <div class="focus-empty">
        <p class="focus-empty-text">
          Task not found
        </p>
        <button class="focus-btn focus-btn--skip" @click="handleStop">
          Go Back <kbd>Esc</kbd>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'

interface Props {
  taskId?: string
}

const props = withDefaults(defineProps<Props>(), {
  taskId: ''
})

const router = useRouter()
const timerStore = useTimerStore()
const tasksStore = useTaskStore()

const currentTask = computed(() => {
  return props.taskId ? tasksStore.tasks.find(task => task.id === props.taskId) : null
})

const subtasks = computed(() => {
  if (!currentTask.value?.subtasks) return []
  return currentTask.value.subtasks
})

const toggleSubtask = (subtask: { id: string; isCompleted: boolean }) => {
  if (!currentTask.value) return
  const updatedSubtasks = currentTask.value.subtasks?.map(s =>
    s.id === subtask.id ? { ...s, isCompleted: !subtask.isCompleted } : s
  )
  tasksStore.updateTaskWithUndo(currentTask.value.id, { subtasks: updatedSubtasks })
}

const startFocusSession = async () => {
  if (currentTask.value) {
    await timerStore.startTimer(currentTask.value.id)
  }
}

const handleComplete = () => {
  if (currentTask.value) {
    tasksStore.updateTaskWithUndo(currentTask.value.id, { status: 'done' })
  }
  timerStore.stopTimer()
  router.back()
}

const handlePauseAndLeave = () => {
  timerStore.pauseTimer()
  router.back()
}

const handleStop = () => {
  timerStore.stopTimer()
  router.back()
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === 'Escape') {
    handleStop()
  } else if (e.key === 'c' || e.key === 'C') {
    handleComplete()
  } else if (e.key === 'p' || e.key === 'P') {
    if (timerStore.isTimerActive && !timerStore.isPaused) {
      handlePauseAndLeave()
    }
  } else if (e.key === ' ') {
    e.preventDefault()
    if (!timerStore.isTimerActive) {
      startFocusSession()
    } else if (timerStore.isPaused) {
      timerStore.resumeTimer()
    } else {
      timerStore.pauseTimer()
    }
  }
}

onMounted(() => {
  if (props.taskId && !timerStore.isTimerActive) {
    startFocusSession()
  }
})

onUnmounted(() => {
  // Don't stop the timer when leaving - user might want it running
})
</script>

<style scoped>
.focus-view {
  height: 100vh;
  background: radial-gradient(circle at center, rgba(var(--color-slate-900), 1) 0%, rgba(var(--color-slate-950), 1) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  text-align: center;
  outline: none;
}

/* Timer */
.focus-timer {
  font-size: 5rem;
  font-weight: 700;
  color: var(--color-accent);
  margin-bottom: var(--space-8);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.focus-timer--break {
  color: var(--color-success);
}

/* Title */
.focus-title {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-4);
  max-width: 800px;
  line-height: 1.3;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Description */
.focus-description {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  margin-bottom: var(--space-8);
  max-width: 600px;
  line-height: 1.6;
}

/* Subtasks */
.focus-subtasks {
  margin-bottom: var(--space-8);
  text-align: left;
}

.focus-subtask {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  font-size: var(--text-base);
  color: var(--text-primary);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast);
}

.focus-subtask:hover {
  background: var(--glass-bg-subtle);
}

.focus-subtask-check {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--glass-border-hover);
  flex-shrink: 0;
  transition: all var(--duration-fast);
}

.focus-subtask-check--done {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.focus-subtask-text--done {
  text-decoration: line-through;
  color: var(--text-muted);
}

/* Controls */
.focus-controls {
  display: flex;
  gap: var(--space-3);
}

.focus-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-5);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
  backdrop-filter: var(--blur-md);
  color: var(--text-primary);
}

.focus-btn:hover {
  background: var(--glass-bg-medium);
  transform: translateY(-2px);
}

.focus-btn kbd {
  padding: var(--space-0_5) var(--space-1_5);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-muted);
  line-height: 1;
}

.focus-btn--start {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.focus-btn--start:hover {
  background: var(--brand-primary-bg-subtle);
  border-color: var(--color-accent);
}

.focus-btn--pause {
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

.focus-btn--pause:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.focus-btn--complete {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.focus-btn--complete:hover {
  background: var(--brand-primary-bg-subtle);
  border-color: var(--brand-primary-hover);
  color: var(--brand-primary-hover);
}

.focus-btn--pause-leave {
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.focus-btn--pause-leave:hover {
  background: var(--warning-bg-subtle);
  border-color: var(--color-warning);
}

.focus-btn--skip {
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

.focus-btn--skip:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

/* Empty state */
.focus-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.focus-empty-text {
  font-size: var(--text-xl);
  color: var(--text-secondary);
}

/* Responsive */
@media (max-width: 768px) {
  .focus-timer {
    font-size: 3.5rem;
  }

  .focus-title {
    font-size: var(--text-2xl);
  }

  .focus-controls {
    flex-direction: column;
    width: 100%;
    max-width: 300px;
  }
}
</style>
