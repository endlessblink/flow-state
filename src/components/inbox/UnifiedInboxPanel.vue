<template>
  <div class="unified-inbox-panel" :class="{ collapsed: isCollapsed }">
    
    <!-- 1. Header -->
    <UnifiedInboxHeader
      :is-collapsed="isCollapsed"
      :task-count="inboxTasks.length"
      :active-time-filter="activeTimeFilter"
      :today-count="todayCount"
      :show-group-chips="context === 'calendar' && canvasGroupOptions.length > 1"
      :group-options="canvasGroupOptions"
      :selected-canvas-groups="selectedCanvasGroups"
      :show-advanced-filters="showAdvancedFilters"
      :unscheduled-only="unscheduledOnly"
      :selected-priority="selectedPriority"
      :selected-project="selectedProject"
      :selected-duration="selectedDuration"
      :hide-done-tasks="currentHideDoneTasks"
      :base-tasks="baseInboxTasks"
      :root-tasks="taskStore.rootProjects"
      
      @toggle-collapse="isCollapsed = !isCollapsed"
      @toggle-today="activeTimeFilter = activeTimeFilter === 'today' ? 'all' : 'today'"
      @toggle-advanced-filters="showAdvancedFilters = !showAdvancedFilters"
      @update:selected-canvas-groups="selectedCanvasGroups = $event"
      @update:unscheduled-only="unscheduledOnly = $event"
      @update:selected-priority="selectedPriority = $event"
      @update:selected-project="selectedProject = $event"
      @update:selected-duration="selectedDuration = $event"
      @update:hide-done-tasks="toggleHideDoneTasks"
      @clear-all="clearAllFilters"
    />

    <!-- Collapsed State Badges -->
    <div v-if="isCollapsed" class="collapsed-badges-container">
      <BaseBadge
        v-if="!unscheduledOnly && !selectedPriority && !selectedProject"
        variant="count"
        size="sm"
        rounded
      >
        {{ baseInboxTasks.length }}
      </BaseBadge>
      <div v-else class="dual-badges">
        <BaseBadge variant="count" size="sm" rounded class="total-count">
          {{ baseInboxTasks.length }}
        </BaseBadge>
        <BaseBadge variant="info" size="sm" rounded class="filtered-count">
          {{ inboxTasks.length }}
        </BaseBadge>
      </div>
    </div>

    <!-- 2. Input Area -->
    <UnifiedInboxInput
      v-if="!isCollapsed"
      :show-brain-dump="showBrainDump"
      @add-task="addTask"
    />

    <!-- 3. Task List -->
    <UnifiedInboxList
      v-if="!isCollapsed"
      :tasks="inboxTasks"
      :selected-task-ids="selectedTaskIds"
      :multi-select-mode="multiSelectMode"
      :has-selected-groups="selectedCanvasGroups.size > 0"
      :are-globals-filtered="taskStore.filteredTasks.length > 0"
      @drag-start="onDragStart"
      @drag-end="onDragEnd"
      @task-click="handleTaskClick"
      @task-dblclick="handleTaskDoubleClick"
      @task-contextmenu="handleTaskContextMenu"
      @task-keydown="handleTaskKeydown"
      @start-timer="handleStartTimer"
      @delete-selected="deleteSelectedTasks"
      @clear-selection="clearSelection"
    />
  </div>
</template>

<script setup lang="ts">
import { withDefaults } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import BaseBadge from '@/components/base/BaseBadge.vue'
import type { Task } from '@/types/tasks'

// Composables (Logic extracted)
import { useUnifiedInboxState } from '@/composables/inbox/useUnifiedInboxState'
import { useUnifiedInboxActions } from '@/composables/inbox/useUnifiedInboxActions'

// Components
import UnifiedInboxHeader from './unified/UnifiedInboxHeader.vue'
import UnifiedInboxInput from './unified/UnifiedInboxInput.vue'
import UnifiedInboxList from './unified/UnifiedInboxList.vue'

// Props
interface Props {
  context?: 'calendar' | 'canvas' | 'standalone'
  showBrainDump?: boolean
  startCollapsed?: boolean
  maxCollapsedWidth?: string
  expandedWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  context: 'standalone',
  showBrainDump: false,
  startCollapsed: false,
  maxCollapsedWidth: '48px',
  expandedWidth: '320px'
})

// Stores
const taskStore = useTaskStore()
const timerStore = useTimerStore()

// State Logic
const {
  isCollapsed,
  activeTimeFilter,
  showAdvancedFilters,
  unscheduledOnly,
  selectedPriority,
  selectedProject,
  selectedDuration,
  selectedCanvasGroups,
  currentHideDoneTasks,
  canvasGroupOptions,
  baseInboxTasks,
  inboxTasks,
  todayCount,
  toggleHideDoneTasks,
  clearAllFilters
} = useUnifiedInboxState(props)

// Action Logic
const {
  selectedTaskIds,
  multiSelectMode,
  addTask,
  deleteSelectedTasks,
  clearSelection,
  handleTaskClick,
  handleTaskKeydown,
  handleTaskContextMenu,
  onDragStart,
  onDragEnd
} = useUnifiedInboxActions(inboxTasks, props.context)

// Handlers that require window/store access directly
const handleTaskDoubleClick = (task: Task) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: task.id }
  }))
}

const handleStartTimer = (task: Task) => {
  // Logic from original component
  if (timerStore.currentTaskId === task.id && timerStore.isTimerActive) {
    timerStore.stopTimer()
  } else {
    timerStore.startTimer(task.id)
  }
}
</script>

<style scoped>
.unified-inbox-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-0);
  border-right: 1px solid var(--border-color);
  width: v-bind(expandedWidth);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.unified-inbox-panel.collapsed {
  width: v-bind(maxCollapsedWidth);
}

.collapsed-badges-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: var(--space-4);
  gap: var(--space-2);
}

.dual-badges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
</style>