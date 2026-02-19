<template>
  <div class="board-view-wrapper">
    <!-- KANBAN BOARD HEADER CONTROLS - TASK-157: Simplified Todoist-style -->
    <div class="kanban-header kanban-header--minimal">
      <div class="header-left">
        <h2 class="board-title">
          {{ $t('views.board') }}
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
        <!-- FEATURE-1336: Category view renders ONE swimlane with project columns -->
        <template v-if="currentViewType === 'category'">
          <KanbanSwimlane
            :project="{ id: '__category__', name: 'All Tasks', color: '#6B7280', colorType: 'hex', viewType: 'status', createdAt: new Date(), updatedAt: new Date() }"
            :tasks="allFilteredTasks"
            :current-filter="taskStore.activeSmartView || 'none'"
            :density="currentDensity"
            :show-done-column="!hideDoneTasks"
            view-type="category"
            @select-task="handleSelectTask"
            @start-timer="handleStartTimer"
            @edit-task="handleEditTask"
            @delete-task="handleDeleteTask"
            @move-task="handleMoveTask"
            @add-task="handleAddTask"
            @context-menu="handleContextMenu"
          />
        </template>

        <!-- Standard views: per-project swimlanes -->
        <template v-else>
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
        </template>
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
      :title="$t('task.delete_confirm_title')"
      :message="$t('task.delete_confirm_message')"
      :confirm-text="$t('common.delete')"
      @confirm="confirmDeleteTask"
      @cancel="cancelDeleteTask"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { usePersistentRef } from '@/composables/usePersistentRef'
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
import { CheckCircle, Circle, SlidersHorizontal, Flag, Calendar, ListTodo, FolderOpen } from 'lucide-vue-next'

import FilterControls from '@/components/base/FilterControls.vue'

const { t } = useI18n()

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
  pendingTaskColumnKey,
  pendingTaskProjectId,
  pendingTaskViewType,
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
  createTaskForColumn,
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

// BUG-1051: Persist UI state across refreshes
// TASK-157: Filter bar collapsed by default for cleaner Todoist-style look
const showFilters = usePersistentRef<boolean>('flowstate:board-show-filters', false, 'board-show-filters')

// View Type Switcher (priority, date, status, category) (TASK-1215: Tauri-aware persistence)
const currentViewType = usePersistentRef<'priority' | 'date' | 'status' | 'category'>('flowstate:board-view-type', 'priority', 'board-view-type')
const viewTypeOptions = computed(() => [
  { value: 'priority' as const, label: t('filters.group_priority'), icon: Flag },
  { value: 'date' as const, label: t('filters.group_due_date'), icon: Calendar },
  { value: 'status' as const, label: t('filters.group_status'), icon: ListTodo },
  { value: 'category' as const, label: t('filters.group_category'), icon: FolderOpen }
])

// FEATURE-1336: All tasks combined (not split by project) for category view
const allFilteredTasks = computed(() => {
  return taskStore.filteredTasks.filter(task => !(taskStore.hideDoneTasks && task.status === 'done'))
})

// Load saved settings on mount
onMounted(() => {
  // Initialize UI store
  uiStore.loadState()

  // Settings store is initialized automatically in its definition
  settingsStore.loadFromStorage()

  // Add Escape key handler for board selection
  document.addEventListener('keydown', handleBoardKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleBoardKeydown)
})

// Escape key to clear board selection
const handleBoardKeydown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

  if (event.key === 'Escape' && taskStore.selectedTaskIds.length > 0) {
    taskStore.clearSelection()
  }
}

// Task management methods (wrappers for composables to match template emitters)
const handleAddTask = (payload: { columnKey: string, projectId: string, viewType: 'status' | 'priority' | 'date' | 'category' }) => {
  openQuickTaskCreate(payload.columnKey, payload.projectId, payload.viewType)
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

const handleQuickTaskCreate = async (data: {
  title: string
  description: string
  status: string
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  projectId?: string
}) => {
  const newTask = await createTaskForColumn(
    data.title,
    data.description,
    pendingTaskColumnKey.value,
    pendingTaskViewType.value,
    data.projectId || pendingTaskProjectId.value
  )
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
