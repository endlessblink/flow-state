<template>
  <!-- SWIMLANE-BASED KANBAN BOARD -->
  <div class="kanban-board" @click="closeContextMenu">
    <KanbanSwimlane
      v-for="project in projectsWithTasks"
      :key="project.id"
      :project="project"
      :tasks="tasksByProject[project.id] || []"
      :currentFilter="taskStore.activeSmartView"
      @selectTask="handleSelectTask"
      @startTimer="handleStartTimer"
      @editTask="handleEditTask"
      @moveTask="handleMoveTask"
      @contextMenu="handleContextMenu"
    />
  </div>

  <!-- TASK EDIT MODAL -->
  <TaskEditModal
    :isOpen="showEditModal"
    :task="selectedTask"
    @close="closeEditModal"
  />

  <!-- TASK CONTEXT MENU -->
  <TaskContextMenu
    :isVisible="showContextMenu"
    :x="contextMenuX"
    :y="contextMenuY"
    :task="contextMenuTask"
    @close="closeContextMenu"
    @edit="handleEditTask"
    @confirmDelete="handleConfirmDelete"
  />

  <!-- CONFIRMATION MODAL -->
  <ConfirmationModal
    :isOpen="showConfirmModal"
    title="Delete Task"
    message="Are you sure you want to delete this task? This action cannot be undone."
    confirmText="Delete"
    @confirm="confirmDeleteTask"
    @cancel="cancelDeleteTask"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import KanbanSwimlane from '@/components/kanban/KanbanSwimlane.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import TaskContextMenu from '@/components/TaskContextMenu.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import type { Task } from '@/stores/tasks'

// Stores
const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Group tasks by project (using filtered tasks from store)
const tasksByProject = computed(() => {
  const grouped: Record<string, Task[]> = {}

  taskStore.filteredTasks.forEach(task => {
    const projectId = task.projectId || '1'
    if (!grouped[projectId]) {
      grouped[projectId] = []
    }
    grouped[projectId].push(task)
  })

  return grouped
})

// Get projects to display - respect active project filter but always show projects for smart views
const projectsWithTasks = computed(() => {
  // If a specific project is selected, only show that project
  if (taskStore.activeProjectId) {
    return taskStore.projects.filter(project => project.id === taskStore.activeProjectId)
  }
  
  // For smart views (today, week) or no filter, show all projects
  return taskStore.projects
})

// Edit modal state
const showEditModal = ref(false)
const selectedTask = ref<Task | null>(null)

// Context menu state
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)

// Confirmation modal state
const showConfirmModal = ref(false)
const taskToDelete = ref<string | null>(null)

// Task management methods
const handleAddTask = (status: string) => {
  const newTask = taskStore.createTask({
    title: 'New Task',
    description: 'Task description...',
    status: status as any
  })
  console.log('Created task:', newTask.title)
}

const handleSelectTask = (taskId: string) => {
  taskStore.selectTask(taskId)
}

const handleStartTimer = (taskId: string) => {
  // Start a 25-minute work timer for the specific task
  timerStore.startTimer(taskId, timerStore.settings.workDuration, false)
  console.log('Started timer for task:', taskId)
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

// Context menu handlers
const handleContextMenu = (event: MouseEvent, task: Task) => {
  console.log('Context menu triggered for task:', task.title, 'at position:', event.clientX, event.clientY)
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuTask.value = task
  showContextMenu.value = true
  console.log('Context menu should be visible:', showContextMenu.value)
}

const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuTask.value = null
}

const handleAddSubtaskFromMenu = (taskId: string) => {
  taskStore.createSubtask(taskId, { title: 'New Subtask' })
}

// Confirmation modal handlers
const handleConfirmDelete = (taskId: string) => {
  taskToDelete.value = taskId
  showConfirmModal.value = true
}

const confirmDeleteTask = () => {
  if (taskToDelete.value) {
    taskStore.deleteTask(taskToDelete.value)
    taskToDelete.value = null
  }
  showConfirmModal.value = false
}

const cancelDeleteTask = () => {
  taskToDelete.value = null
  showConfirmModal.value = false
}

const handleMoveTask = (taskId: string, newStatus: string) => {
  taskStore.moveTask(taskId, newStatus as any)
  console.log('Moved task:', taskId, 'to', newStatus)
}
</script>

<style scoped>
/* KANBAN BOARD */
.kanban-board {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
</style>