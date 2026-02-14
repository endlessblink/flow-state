<template>
  <div class="all-tasks-view">
    <!-- Mobile View -->
    <MobileInboxView v-if="isMobile" />

    <!-- Desktop View -->
    <template v-else>
      <!-- View Controls -->
      <ViewControls
        v-model:view-type="viewType"
        v-model:density="density"
        v-model:sort-by="sortBy"
        :filter-status="filterStatus"
        :hide-done-tasks="hideDoneTasks"
        @update:filter-status="taskStore.setActiveStatusFilter"
        @update:hide-done-tasks="handleToggleDoneTasksFromControl"
        @expand-all="handleExpandAll"
        @collapse-all="handleCollapseAll"
      />

      <!-- Content Area -->
      <div class="tasks-container">
        <!-- Table Mode -->
        <TaskTable
          v-if="viewType === 'table'"
          :tasks="sortedTasks"
          :density="density"
          @select="handleSelectTask"
          @start-timer="handleStartTimer"
          @edit="handleEditTask"
          @context-menu="handleContextMenu"
          @update-task="handleUpdateTask"
        />

        <!-- List Mode -->
        <TaskList
          v-else
          ref="taskListRef"
          :tasks="sortedTasks"
          :empty-message="getEmptyMessage()"
          @select="handleSelectTask"
          @toggle-complete="handleToggleComplete"
          @start-timer="handleStartTimer"
          @edit="handleEditTask"
          @context-menu="handleContextMenu"
          @move-task="handleMoveTask"
          @update-task="handleUpdateTask"
        />
      </div>
    </template>

    <!-- Task Edit Modal -->
    <TaskEditModal
      :is-open="showEditModal"
      :task="selectedTask"
      @close="closeEditModal"
    />

    <!-- Task Context Menu -->
    <TaskContextMenu
      :is-visible="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="contextMenuTask"
      @close="closeContextMenu"
      @edit="handleEditTask"
      @confirm-delete="handleConfirmDelete"
    />

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :is-open="showConfirmModal"
      title="Delete Task"
      message="Are you sure you want to delete this task? You can press Ctrl+Z to undo."
      confirm-text="Delete"
      @confirm="confirmDeleteTask"
      @cancel="cancelDeleteTask"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useMobileDetection } from '@/composables/useMobileDetection'
import ViewControls, { type ViewType, type DensityType } from '@/components/layout/ViewControls.vue'
import TaskTable from '@/components/tasks/TaskTable.vue'
import TaskList from '@/components/tasks/TaskList.vue'
import MobileInboxView from '@/mobile/views/MobileInboxView.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import { getViewportCoordinates } from '@/utils/contextMenuCoordinates'

import type { Task } from '@/stores/tasks'

// Mobile Detection
const { isMobile } = useMobileDetection()

// Stores
const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Extract only reactive state refs, not computed properties
// Computed properties stay on the store to maintain full reactivity chain
const { hideDoneTasks } = storeToRefs(taskStore)

// View State (TASK-1215: Persist across restarts via Tauri store + localStorage)
const viewType = usePersistentRef<ViewType>('flowstate:all-tasks-view-type', 'list')
const density = usePersistentRef<DensityType>('flowstate:all-tasks-density', 'comfortable')
const sortBy = usePersistentRef<string>('flowstate:all-tasks-sort-by', 'dueDate')
// Use global status filter directly from store (maintains reactivity)
const filterStatus = computed(() => taskStore.activeStatusFilter || 'all')

// Component Refs
const taskListRef = ref<InstanceType<typeof TaskList> | null>(null)

// Modal State
const showEditModal = ref(false)
const selectedTask = ref<Task | null>(null)
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)
const showConfirmModal = ref(false)
const taskToDelete = ref<string | null>(null)

// Computed Tasks - Access store's computed directly (maintains full reactivity)
const filteredTasks = computed(() => {
  let tasks = taskStore.filteredTasks
  
  // TASK-076: Apply view-specific 'Hide Done' filter locally
  if (hideDoneTasks.value) {
    tasks = tasks.filter(t => t.status !== 'done')
  }

  return tasks
})

const sortedTasks = computed(() => {
  const tasks = [...filteredTasks.value]

  switch (sortBy.value) {
    case 'dueDate':
      return tasks.sort((a, b) => {
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
    case 'priority': {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return tasks.sort((a, b) => {
        const aPriority = a.priority ? priorityOrder[a.priority] : 3
        const bPriority = b.priority ? priorityOrder[b.priority] : 3
        return aPriority - bPriority
      })
    }
    case 'title':
      return tasks.sort((a, b) => a.title.localeCompare(b.title))
    case 'created':
      return tasks.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    default:
      return tasks
  }
})

// Event Handlers
const handleSelectTask = (taskId: string) => {
  taskStore.selectTask(taskId)
}

const handleStartTimer = async (taskId: string) => {
  // BUG-1051: AWAIT for timer sync
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

const handleContextMenu = (event: MouseEvent, task: Task) => {
  // BUG-1096: Use normalized coordinates for Tauri compatibility
  const { x, y } = getViewportCoordinates(event)
  contextMenuX.value = x
  contextMenuY.value = y
  contextMenuTask.value = task
  showContextMenu.value = true
}

const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuTask.value = null
}

const handleToggleComplete = async (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (task) {
    const newStatus = task.status === 'done' ? 'planned' : 'done'
    // BUG-1051: AWAIT to ensure persistence
    await taskStore.updateTask(taskId, { status: newStatus })
  }
}

const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
  // BUG-1051: AWAIT to ensure persistence
  await taskStore.updateTask(taskId, updates)
}

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

const getEmptyMessage = () => {
  if (taskStore.activeStatusFilter && taskStore.activeStatusFilter !== null) {
    return `No tasks with status "${taskStore.activeStatusFilter}"`
  }
  return 'Create your first task to get started'
}

const handleExpandAll = () => {
  taskListRef.value?.expandAll()
}

const handleCollapseAll = () => {
  taskListRef.value?.collapseAll()
}

const handleMoveTask = async (taskId: string, targetProjectId: string | null, targetParentId: string | null) => {
  // Move task to be a subtask of another task
  // BUG-1051: AWAIT to ensure persistence
  await taskStore.updateTask(taskId, {
    projectId: targetProjectId || undefined,
    parentTaskId: targetParentId || undefined
  })
}

// Debug function to test toggle functionality
const handleToggleDoneTasksFromControl = (_newValue?: boolean) => {
  taskStore.toggleHideDoneTasks()
}

// Debug lifecycle hook
onMounted(() => {
  console.log('🚀 [AllTasksView] Component mounted', {
    totalTasks: taskStore.tasks.length,
    filteredTasks: taskStore.filteredTasks.length,
    viewType: viewType.value,
    sortBy: sortBy.value
  })
})
</script>

<style scoped>
.all-tasks-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.view-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.task-count {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  background-color: var(--surface-tertiary);
  border-radius: var(--radius-full);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.hide-done-toggle {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
  position: relative;
  z-index: var(--z-dropdown);
  pointer-events: auto;
  user-select: none;
}

.hide-done-toggle.icon-only {
  padding: var(--space-2);
  min-width: 40px;
  min-height: 40px;
  justify-content: center;
}

.hide-done-toggle:hover {
  background: linear-gradient(
    135deg,
    var(--state-hover-bg) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.hide-done-toggle.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.tasks-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
