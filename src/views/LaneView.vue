<template>
  <div class="lane-view">
    <!-- Lane header -->
    <div class="lane-header">
      <button class="back-btn" title="All tasks" @click="goBack">
        <ArrowLeft :size="18" />
      </button>
      <span class="lane-color-dot" :style="{ background: laneColor }" />
      <h1 class="lane-title">{{ lane?.name || 'Lane' }}</h1>
      <span class="lane-count">{{ laneTasks.length }} {{ laneTasks.length === 1 ? 'task' : 'tasks' }}</span>
    </div>

    <!-- Missing lane -->
    <div v-if="!lane" class="lane-missing">
      <Route :size="40" />
      <p>This lane no longer exists.</p>
      <button class="btn-secondary" @click="goBack">Back to all tasks</button>
    </div>

    <!-- Task list (cross-project, flat) -->
    <div v-else class="tasks-container" @dragover.prevent>
      <TaskList
        :tasks="laneTasks"
        :groups="laneGroups"
        group-by="none"
        :empty-message="`No tasks in “${lane.name}” yet. Assign a lane to tasks from the task editor.`"
        @select="handleSelectTask"
        @toggle-complete="handleToggleComplete"
        @start-timer="handleStartTimer"
        @edit="handleEditTask"
        @update-task="handleUpdateTask"
      />
    </div>

    <!-- Task Edit Modal -->
    <TaskEditModal
      :is-open="showEditModal"
      :task="selectedTask"
      @close="closeEditModal"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Route } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'
import { useLaneStore } from '@/stores/lanes'
import { useTimerStore } from '@/stores/timer'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import TaskList from '@/components/tasks/TaskList.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import type { Task, TaskGroup } from '@/types/tasks'

const props = defineProps<{ laneId: string }>()

const router = useRouter()
const taskStore = useTaskStore()
const laneStore = useLaneStore()
const timerStore = useTimerStore()
const { updateTaskWithUndo } = useUnifiedUndoRedo()

const lane = computed(() => laneStore.getLaneById(props.laneId))
const laneColor = computed(() => {
  const c = lane.value?.color
  return Array.isArray(c) ? c[0] : (c || '#4ECDC4')
})

// Cross-project: every task assigned to this lane, regardless of project
const laneTasks = computed<Task[]>(() =>
  taskStore.tasks.filter(t => t.laneId === props.laneId)
)

const getRootTasks = (tasks: Task[]) => tasks.filter(t => !t.parentTaskId)

const laneGroups = computed<TaskGroup[]>(() => {
  if (laneTasks.value.length === 0) return []
  return [{
    key: props.laneId,
    title: lane.value?.name || 'Lane',
    tasks: laneTasks.value,
    parentTasks: getRootTasks(laneTasks.value)
  }]
})

// --- Handlers (minimal subset mirroring AllTasksView) ---
const showEditModal = ref(false)
const selectedTask = ref<Task | null>(null)

const handleSelectTask = (taskId: string) => {
  taskStore.selectTask(taskId)
}

const handleStartTimer = async (taskId: string) => {
  await timerStore.startTimer(taskId, timerStore.settings.workDuration, false)
}

const handleEditTask = (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (task) {
    selectedTask.value = task
    showEditModal.value = true
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  selectedTask.value = null
}

const handleToggleComplete = async (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (!task) return
  if (task.status !== 'done' && task.recurrenceRule) {
    await taskStore.doneForNow(taskId)
    return
  }
  const newStatus = task.status === 'done' ? 'todo' : 'done'
  await updateTaskWithUndo(taskId, { status: newStatus })
}

const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
  if ('title' in updates && (!updates.title || !String(updates.title).trim())) return
  await updateTaskWithUndo(taskId, updates)
}

const goBack = () => {
  router.push({ name: 'all-tasks' })
}
</script>

<style scoped>
.lane-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-6);
  gap: var(--space-4);
  overflow: hidden;
}

.lane-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-base);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.back-btn:hover {
  background: var(--glass-bg-soft);
  color: var(--text-primary);
}

.lane-color-dot {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.lane-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.lane-count {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.tasks-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.lane-missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  flex: 1;
  color: var(--text-muted);
}
</style>
