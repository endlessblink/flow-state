<template>
  <div class="all-tasks-view">
    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <h1 class="view-title">All Tasks</h1>
        <span class="task-count">{{ sortedTasks.length }} tasks</span>
      </div>
      <div class="header-controls">
        <!-- Multi-Select Toggle (List View Only) -->
        <button
          v-if="viewType === 'list'"
          class="multi-select-toggle icon-only"
          :class="{ active: multiSelectEnabled }"
          @click="toggleMultiSelect"
          :title="multiSelectEnabled ? 'Disable multi-select' : 'Enable multi-select'"
        >
          <CheckSquare :size="16" />
        </button>

        <!-- Hide Done Tasks Toggle -->
        <button
          class="hide-done-toggle icon-only"
          :class="{ active: hideDoneTasks }"
          @click="handleToggleDoneTasks"
          :title="hideDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'"
        >
          <EyeOff v-if="hideDoneTasks" :size="16" />
          <Eye v-else :size="16" />
        </button>
      </div>
    </div>

    <!-- View Controls -->
    <ViewControls
      v-model:view-type="viewType"
      v-model:density="density"
      v-model:sort-by="sortBy"
      :filter-status="filterStatus"
      @update:filter-status="taskStore.setActiveStatusFilter"
      @expandAll="handleExpandAll"
      @collapseAll="handleCollapseAll"
    />

    <!-- Content Area -->
    <div class="tasks-container">
      <!-- Table Mode -->
      <TaskTable
        v-if="viewType === 'table'"
        ref="taskTableRef"
        :tasks="sortedTasks"
        :density="density"
        @select="handleSelectTask"
        @startTimer="handleStartTimer"
        @edit="handleEditTask"
        @contextMenu="handleContextMenu"
        @updateTask="handleUpdateTask"
        @selectionChange="handleSelectionChange"
      />

      <!-- List Mode -->
      <TaskList
        v-else
        ref="taskListRef"
        :tasks="sortedTasks"
        :empty-message="getEmptyMessage()"
        :multi-select-mode="multiSelectEnabled"
        @select="handleSelectTask"
        @toggleComplete="handleToggleComplete"
        @startTimer="handleStartTimer"
        @edit="handleEditTask"
        @contextMenu="handleContextMenu"
        @moveTask="handleMoveTask"
        @selectionChange="handleSelectionChange"
      />
    </div>

    <!-- Floating Toolbar for Bulk Actions -->
    <transition name="toolbar-slide">
      <div v-if="selectedTaskIds.length > 0" class="floating-toolbar">
        <div class="toolbar-content">
          <div class="toolbar-info">
            <span class="selected-count">{{ selectedTaskIds.length }}</span>
            <span class="selected-label">selected</span>
          </div>

          <div class="toolbar-actions">
            <button
              @click="showBatchEditModal = true"
              class="toolbar-btn toolbar-btn--primary"
              title="Batch Edit"
            >
              <Edit2 :size="16" />
              <span>Edit</span>
            </button>

            <button
              @click="handleBulkDelete"
              class="toolbar-btn toolbar-btn--danger"
              title="Delete Selected"
            >
              <Trash2 :size="16" />
              <span>Delete</span>
            </button>

            <button
              @click="clearSelection"
              class="toolbar-btn"
              title="Clear Selection"
            >
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Task Edit Modal -->
    <TaskEditModal
      :isOpen="showEditModal"
      :task="selectedTask"
      @close="closeEditModal"
    />

    <!-- Task Context Menu -->
    <TaskContextMenu
      :isVisible="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="contextMenuTask"
      @close="closeContextMenu"
      @edit="handleEditTask"
      @confirmDelete="handleConfirmDelete"
    />

    <!-- Batch Edit Modal -->
    <BatchEditModal
      :isOpen="showBatchEditModal"
      :taskIds="selectedTaskIds"
      @close="showBatchEditModal = false"
      @applied="handleBatchEditApplied"
    />

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :isOpen="showConfirmModal"
      title="Delete Task"
      message="Are you sure you want to delete this task? This action cannot be undone."
      confirmText="Delete"
      @confirm="confirmDeleteTask"
      @cancel="cancelDeleteTask"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import ViewControls, { type ViewType, type DensityType } from '@/components/ViewControls.vue'
import TaskTable from '@/components/TaskTable.vue'
import TaskList from '@/components/TaskList.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import TaskContextMenu from '@/components/TaskContextMenu.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import BatchEditModal from '@/components/BatchEditModal.vue'
import { Eye, EyeOff, Edit2, Trash2, Copy, CheckSquare } from 'lucide-vue-next'
import type { Task } from '@/stores/tasks'

// Stores
const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Extract only reactive state refs, not computed properties
// Computed properties stay on the store to maintain full reactivity chain
const { hideDoneTasks } = storeToRefs(taskStore)

// View State (local component state, no Pinia store needed)
const viewType = ref<ViewType>('list')
const density = ref<DensityType>('comfortable')
const sortBy = ref('dueDate')
// Use global status filter directly from store (maintains reactivity)
const filterStatus = computed(() => taskStore.activeStatusFilter || 'all')

// Component Refs
const taskListRef = ref<InstanceType<typeof TaskList> | null>(null)
const taskTableRef = ref<InstanceType<typeof TaskTable> | null>(null)

// Modal State
const showEditModal = ref(false)
const selectedTask = ref<Task | null>(null)
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)
const showConfirmModal = ref(false)
const taskToDelete = ref<string | null>(null)

// Multi-select state
const selectedTaskIds = ref<string[]>([])
const showBatchEditModal = ref(false)
const multiSelectEnabled = ref(false)

// Computed Tasks - Access store's computed directly (maintains full reactivity)
const filteredTasks = computed(() => {
  return taskStore.filteredTasks
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
    case 'priority':
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return tasks.sort((a, b) => {
        const aPriority = a.priority ? priorityOrder[a.priority] : 3
        const bPriority = b.priority ? priorityOrder[b.priority] : 3
        return aPriority - bPriority
      })
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

const handleStartTimer = (taskId: string) => {
  timerStore.startTimer(taskId, timerStore.settings.workDuration, false)
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
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuTask.value = task
  showContextMenu.value = true
}

const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuTask.value = null
}

const handleToggleComplete = (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    taskStore.updateTask(taskId, { status: newStatus })
  }
}

const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
  taskStore.updateTask(taskId, updates)
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

const handleMoveTask = (taskId: string, targetProjectId: string | null, targetParentId: string | null) => {
  // Move task to be a subtask of another task
  taskStore.updateTask(taskId, {
    projectId: targetProjectId,
    parentTaskId: targetParentId
  })
}

// Multi-select handlers
const handleSelectionChange = (ids: string[]) => {
  selectedTaskIds.value = ids
}

const handleBatchEditApplied = () => {
  clearSelection()
  showBatchEditModal.value = false
}

const handleBulkDelete = () => {
  if (selectedTaskIds.value.length === 0) return

  if (confirm(`Delete ${selectedTaskIds.value.length} tasks? This cannot be undone.`)) {
    selectedTaskIds.value.forEach(taskId => {
      taskStore.deleteTask(taskId)
    })
    clearSelection()
  }
}

const clearSelection = () => {
  selectedTaskIds.value = []
  // Clear selection in child components
  if (taskTableRef.value) {
    taskTableRef.value.clearSelection()
  }
  if (taskListRef.value) {
    taskListRef.value.clearSelection()
  }
  // Auto-disable multi-select mode when clearing in list view
  if (viewType.value === 'list') {
    multiSelectEnabled.value = false
  }
}

const toggleMultiSelect = () => {
  multiSelectEnabled.value = !multiSelectEnabled.value
  // Clear any existing selection when disabling
  if (!multiSelectEnabled.value) {
    clearSelection()
  }
}

// Debug function to test toggle functionality
const handleToggleDoneTasks = (event: MouseEvent) => {
  // Prevent event bubbling that might interfere with other click handlers
  event.stopPropagation()
  console.log('🔧 AllTasksView: Toggle button clicked!')
  console.log('🔧 AllTasksView: Current hideDoneTasks value:', taskStore.hideDoneTasks)

  try {
    taskStore.toggleHideDoneTasks()
    console.log('🔧 AllTasksView: After toggle - hideDoneTasks value:', taskStore.hideDoneTasks)
    console.log('🔧 AllTasksView: Method call successful')
  } catch (error) {
    console.error('🔧 AllTasksView: Error calling toggleHideDoneTasks:', error)
  }
}
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

/* Shared toggle button styles */
.hide-done-toggle,
.multi-select-toggle {
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
  z-index: 1000;
  pointer-events: auto;
  user-select: none;
}

.hide-done-toggle.icon-only,
.multi-select-toggle.icon-only {
  padding: var(--space-2);
  min-width: 40px;
  min-height: 40px;
  justify-content: center;
}

.hide-done-toggle:hover,
.multi-select-toggle:hover {
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

.hide-done-toggle.active,
.multi-select-toggle.active {
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

/* Floating Toolbar for Bulk Actions */
.floating-toolbar {
  position: fixed;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;

  background: linear-gradient(
    135deg,
    var(--glass-bg-strong) 0%,
    var(--glass-bg-medium) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);

  box-shadow:
    0 20px 40px var(--shadow-xl),
    0 10px 20px var(--shadow-strong),
    inset 0 2px 0 var(--glass-border-soft);

  padding: var(--space-4) var(--space-6);
  min-width: 400px;
}

.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
}

.toolbar-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
}

.selected-count {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  line-height: 1;
}

.selected-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: var(--space-1);
}

.toolbar-actions {
  display: flex;
  gap: var(--space-3);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);

  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);

  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);

  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);

  box-shadow: 0 4px 8px var(--shadow-md);
}

.toolbar-btn:hover {
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-medium) 100%
  );
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px var(--shadow-lg);
}

.toolbar-btn--primary {
  background: linear-gradient(
    135deg,
    var(--purple-gradient-start) 0%,
    var(--purple-gradient-end) 100%
  );
  border-color: var(--purple-border-medium);
  color: white;
  box-shadow:
    0 8px 16px var(--purple-shadow-strong),
    0 0 20px var(--purple-glow-subtle);
}

.toolbar-btn--primary:hover {
  background: linear-gradient(
    135deg,
    var(--purple-gradient-hover-start) 0%,
    var(--purple-gradient-hover-end) 100%
  );
  transform: translateY(-2px);
  box-shadow:
    0 12px 24px var(--purple-shadow-strong),
    0 0 30px var(--purple-border-medium);
}

.toolbar-btn--danger {
  background: linear-gradient(
    135deg,
    var(--red-gradient-start) 0%,
    var(--red-gradient-end) 100%
  );
  border-color: var(--red-border-medium);
  color: white;
}

.toolbar-btn--danger:hover {
  background: linear-gradient(
    135deg,
    var(--red-gradient-hover-start) 0%,
    var(--red-gradient-hover-end) 100%
  );
  transform: translateY(-2px);
}

/* Toolbar Animations */
.toolbar-slide-enter-active,
.toolbar-slide-leave-active {
  transition: all var(--duration-normal) var(--spring-bounce);
}

.toolbar-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(20px) scale(0.95);
}

.toolbar-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px) scale(0.95);
}
</style>
