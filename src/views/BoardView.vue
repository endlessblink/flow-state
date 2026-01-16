<template>
  <div class="board-view-wrapper">
    <!-- KANBAN BOARD HEADER CONTROLS - TASK-157: Simplified Todoist-style -->
    <div class="kanban-header kanban-header--minimal">
      <div class="header-left">
        <h2 class="board-title">
          Board
        </h2>
        <span class="task-count--subtle">{{ totalDisplayedTasks }}</span>
      </div>
      <div class="header-controls header-controls--minimal">
        <!-- View Type Switcher -->
        <div class="view-type-switcher">
          <button
            v-for="option in viewTypeOptions"
            :key="option.value"
            class="view-type-btn"
            :class="{ active: currentViewType === option.value }"
            :title="option.label"
            @click="currentViewType = option.value"
          >
            <component :is="option.icon" :size="16" :stroke-width="1.5" />
            <span class="view-type-label">{{ option.label }}</span>
          </button>
        </div>

        <!-- Filter Toggle (collapsed by default) -->
        <button
          class="filter-toggle icon-only"
          :class="{ active: showFilters }"
          title="Toggle filters"
          @click="showFilters = !showFilters"
        >
          <SlidersHorizontal :size="20" :stroke-width="1.5" />
        </button>

        <!-- Hide Done Tasks Toggle (TASK-243: Single control for hiding done) -->
        <button
          class="done-column-toggle icon-only"
          :class="{ active: hideDoneTasks }"
          :title="hideDoneTasks ? 'Show done tasks' : 'Hide done tasks'"
          @click="handleToggleDoneColumn"
        >
          <CheckCircle v-if="hideDoneTasks" :size="20" :stroke-width="1.5" />
          <Circle v-else :size="20" :stroke-width="1.5" />
        </button>
      </div>
    </div>

    <!-- Collapsible Filter Bar -->
    <Transition name="slide-down">
      <div v-if="showFilters" class="filter-bar">
        <FilterControls />
      </div>
    </Transition>

    <!-- SCROLL CONTAINER FOR KANBAN BOARD -->
    <div class="kanban-scroll-container scroll-container">
      <div class="kanban-board" @click="closeContextMenu">
        <KanbanSwimlane
          v-for="project in projectsWithTasks"
          :key="project.id"
          :project="project"
          :tasks="tasksByProject[project.id] || []"
          :current-filter="taskStore.activeSmartView || 'none'"
          :density="currentDensity"
          :show-done-column="!hideDoneTasks"
          :view-type="currentViewType"
          @select-task="handleSelectTask"
          @start-timer="handleStartTimer"
          @edit-task="handleEditTask"
          @delete-task="handleDeleteTask"
          @move-task="handleMoveTask"
          @add-task="handleAddTask"
          @context-menu="handleContextMenu"
        />
      </div>
    </div>

    <!-- TASK EDIT MODAL -->
    <TaskEditModal
      :is-open="showEditModal"
      :task="selectedTask"
      @close="closeEditModal"
    />

    <!-- QUICK TASK CREATE MODAL -->
    <QuickTaskCreateModal
      :is-open="showQuickTaskCreate"
      :loading="false"
      @cancel="closeQuickTaskCreate"
      @create="handleQuickTaskCreate"
    />

    <!-- TASK CONTEXT MENU -->
    <TaskContextMenu
      :is-visible="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="contextMenuTask"
      :compact-mode="currentDensity === 'ultrathin'"
      @close="closeContextMenu"
      @edit="handleEditTask"
      @confirm-delete="handleConfirmDelete"
    />

    <!-- CONFIRMATION MODAL -->
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
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useUIStore } from '@/stores/ui'
import { provideProgressiveDisclosure } from '@/composables/useProgressiveDisclosure'
import { useSettingsStore } from '@/stores/settings'

// Composables
import { useBoardModals } from '@/composables/board/useBoardModals'
import { useBoardContextMenu } from '@/composables/board/useBoardContextMenu'
import { useBoardActions } from '@/composables/board/useBoardActions'
import { useBoardState } from '@/composables/board/useBoardState'

import './BoardView.css'

import KanbanSwimlane from '@/components/kanban/KanbanSwimlane.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import QuickTaskCreateModal from '@/components/tasks/QuickTaskCreateModal.vue'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import { CheckCircle, Circle, SlidersHorizontal, Flag, Calendar, ListTodo } from 'lucide-vue-next'

import FilterControls from '@/components/base/FilterControls.vue'

// Stores
const taskStore = useTaskStore()
const timerStore = useTimerStore()
const uiStore = useUIStore()
const settingsStore = useSettingsStore()


// Provide progressive disclosure state for TaskCard components
provideProgressiveDisclosure()

// Composables
const {
  showEditModal,
  selectedTask,
  showQuickTaskCreate,
  pendingTaskStatus,
  showConfirmModal,
  taskToDelete,
  openEditModal,
  closeEditModal,
  openQuickTaskCreate,
  closeQuickTaskCreate,
  openConfirmModal,
  closeConfirmModal
} = useBoardModals()

const {
  showContextMenu,
  contextMenuX,
  contextMenuY,
  contextMenuTask,
  openContextMenu: handleContextMenu,
  closeContextMenu
} = useBoardContextMenu()

const {
  selectTask: handleSelectTask,
  startTimer: handleStartTimer,
  quickTaskCreate,
  deleteTask: doDeleteTask,
  moveTask: handleMoveTask,
  addSubtask: _handleAddSubtaskFromMenu
} = useBoardActions({ taskStore, timerStore })

// TASK-243: Use hideDoneTasks from store instead of separate showDoneColumn
const { hideDoneTasks } = storeToRefs(taskStore)
const handleToggleDoneColumn = () => taskStore.toggleHideDoneTasks()

const {
  tasksByProject,
  projectsWithTasks,
  totalDisplayedTasks
} = useBoardState({ taskStore })

// Density state from global settings store
const currentDensity = computed(() => settingsStore.boardDensity)

// TASK-157: Filter bar collapsed by default for cleaner Todoist-style look
const showFilters = ref(false)

// View Type Switcher (priority, date, status)
const currentViewType = ref<'priority' | 'date' | 'status'>('priority')
const viewTypeOptions = [
  { value: 'priority' as const, label: 'Priority', icon: Flag },
  { value: 'date' as const, label: 'Due Date', icon: Calendar },
  { value: 'status' as const, label: 'Status', icon: ListTodo }
]

// Load saved settings on mount
onMounted(() => {
  // Initialize UI store
  uiStore.loadState()
  
  // Settings store is initialized automatically in its definition
  settingsStore.loadFromStorage()
})

// Task management methods (wrappers for composables to match template emitters)
const handleAddTask = (status: string) => {
  openQuickTaskCreate(status)
}

const handleEditTask = (taskId: string) => {
  const task = taskStore.tasks.find(t => t.id === taskId)
  if (task) {
    openEditModal(task)
  }
}

const handleDeleteTask = (taskId: string) => {
  openConfirmModal(taskId)
}

const handleQuickTaskCreate = async (title: string, description: string) => {
  const newTask = await quickTaskCreate(title, description, pendingTaskStatus.value, taskStore.activeProjectId || undefined)
  if (newTask) {
    closeQuickTaskCreate()
  }
}

const handleConfirmDelete = (taskId: string) => {
  openConfirmModal(taskId)
}

const confirmDeleteTask = async () => {
  if (taskToDelete.value) {
    await doDeleteTask(taskToDelete.value)
    closeConfirmModal()
  }
}

const cancelDeleteTask = () => {
  closeConfirmModal()
}


</script>
