<template>
  <div class="focus-view">
    <!-- Focus View Content -->
    <p>Focus View Component</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'

const props = withDefaults(defineProps<Props>(), {
  taskId: ''
})
const timerStore = useTimerStore()
const tasksStore = useTaskStore()

interface Props {
  taskId?: string
}

// Focus view logic
const isFocused = ref(false)
const currentTask = computed(() => {
  return props.taskId ? tasksStore.tasks.find(task => task.id === props.taskId) : null
})

const startFocusSession = () => {
  if (currentTask.value) {
    isFocused.value = true
    timerStore.startTimer(currentTask.value.id)
  }
}

const stopFocusSession = () => {
  isFocused.value = false
  timerStore.stopTimer()
}

const _handleComplete = () => {
  if (currentTask.value) {
    tasksStore.updateTaskWithUndo(currentTask.value.id, { status: 'done' })
  }
  stopFocusSession()
}

onMounted(() => {
  if (props.taskId) {
    startFocusSession()
  }
})

onUnmounted(() => {
  stopFocusSession()
})
</script>

<style scoped>
.focus-view {
  /* Focus view styles */
  height: 100vh;
  background: var(--surface-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}
</style>