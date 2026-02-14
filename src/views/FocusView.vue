<template>
  <div class="focus-view" @keydown="handleKeydown">
    <template v-if="currentTask">
      <!-- Timer Display -->
      <div class="focus-timer" :class="{ 'focus-timer--break': timerStore.currentSession?.isBreak }">
        {{ timerStore.displayTime }}
      </div>

      <!-- Task Title -->
      <h1 class="focus-title">{{ currentTask.title }}</h1>

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
            :class="{ 'focus-subtask-check--done': subtask.status === 'done' }"
          />
          <span :class="{ 'focus-subtask-text--done': subtask.status === 'done' }">
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
          Start (Space)
        </button>
        <button
          v-else-if="timerStore.isPaused"
          class="focus-btn focus-btn--start"
          @click="timerStore.resumeTimer()"
        >
          Resume (Space)
        </button>
        <button
          v-else
          class="focus-btn focus-btn--pause"
          @click="timerStore.pauseTimer()"
        >
          Pause (Space)
        </button>

        <button class="focus-btn focus-btn--complete" @click="handleComplete">
          Complete (C)
        </button>
        <button class="focus-btn focus-btn--skip" @click="handleSkip">
          Skip (Esc)
        </button>
      </div>
    </template>

    <!-- No task found -->
    <template v-else>
      <div class="focus-empty">
        <p class="focus-empty-text">Task not found</p>
        <button class="focus-btn focus-btn--skip" @click="handleSkip">
          Go Back (Esc)
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

const toggleSubtask = (subtask: { id: string; status: string }) => {
  if (!currentTask.value) return
  const newStatus = subtask.status === 'done' ? 'planned' : 'done'
  const updatedSubtasks = currentTask.value.subtasks?.map(s =>
    s.id === subtask.id ? { ...s, status: newStatus } : s
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

const handleSkip = () => {
  timerStore.stopTimer()
  router.back()
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    handleSkip()
  } else if (e.key === 'c' || e.key === 'C') {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    handleComplete()
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
  padding: var(--space-3) var(--space-6);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.focus-btn--start {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-slate-950);
}

.focus-btn--start:hover {
  filter: brightness(1.1);
}

.focus-btn--pause {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.focus-btn--pause:hover {
  background: var(--glass-bg-base);
}

.focus-btn--complete {
  background: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.focus-btn--complete:hover {
  filter: brightness(1.1);
}

.focus-btn--skip {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border);
  color: var(--text-secondary);
}

.focus-btn--skip:hover {
  background: var(--glass-bg-base);
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
