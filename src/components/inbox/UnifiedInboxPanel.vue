<template>
  <div 
    class="unified-inbox-panel" 
    :class="{ 
      collapsed: isCollapsed,
      'is-right-side': context === 'canvas'
    }"
  >
    <!-- 1. Header -->
    <UnifiedInboxHeader
      :is-collapsed="isCollapsed"
      :task-count="inboxTasks.length"
      :active-time-filter="activeTimeFilter"
      :today-count="todayCount"
      :next3-days-count="next3DaysCount"
      :week-count="weekCount"
      :month-count="monthCount"
      :show-group-chips="context === 'calendar' && canvasGroupOptions.length > 1"
      :group-options="canvasGroupOptions"
      :selected-canvas-groups="selectedCanvasGroups"
      :show-advanced-filters="showAdvancedFilters"
      :unscheduled-only="unscheduledOnly"
      :selected-priorities="selectedPriorities"
      :selected-projects="selectedProjects"
      :selected-durations="selectedDurations"
      :hide-done-tasks="currentHideDoneTasks"
      :done-task-count="doneTaskCount"
      :base-tasks="baseInboxTasks"
      :root-projects="taskStore.rootProjects"
      :context="context"
      :sort-by="sortBy"
      :search-query="searchQuery"

      @toggle-collapse="isCollapsed = !isCollapsed"
      @update:active-time-filter="activeTimeFilter = $event"
      @toggle-advanced-filters="showAdvancedFilters = !showAdvancedFilters"
      @update:selected-canvas-groups="selectedCanvasGroups = $event"
      @update:unscheduled-only="unscheduledOnly = $event"
      @update:selected-priorities="selectedPriorities = $event"
      @update:selected-projects="selectedProjects = $event"
      @update:selected-durations="selectedDurations = $event"
      @update:hide-done-tasks="toggleHideDoneTasks"
      @update:sort-by="sortBy = $event"
      @update:search-query="searchQuery = $event"
      @clear-all="clearAllFilters"
    />

    <!-- Collapsed State Badges -->
    <div v-if="isCollapsed" class="collapsed-badges-container">
      <BaseBadge
        v-if="!unscheduledOnly && selectedPriorities.size === 0 && selectedProjects.size === 0"
        variant="count"
        size="sm"
        rounded
      >
        {{ baseInboxTasks.length }}
      </BaseBadge>
      <div v-else class="dual-badges">
        <BaseBadge
          variant="count"
          size="sm"
          rounded
          class="total-count"
        >
          {{ baseInboxTasks.length }}
        </BaseBadge>
        <BaseBadge
          variant="info"
          size="sm"
          rounded
          class="filtered-count"
        >
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
      @send-to-canvas="handleSendToCanvas"
      @send-selected-to-canvas="sendSelectedToCanvas"
      @delete-selected="deleteSelectedTasks"
      @clear-selection="clearSelection"
    />
  </div>
</template>

<script setup lang="ts">
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
  maxCollapsedWidth: '40px', /* BUG-1079: Slimmer collapsed state */
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
  selectedPriorities,
  selectedProjects,
  selectedDurations,
  selectedCanvasGroups,
  currentHideDoneTasks,
  sortBy, // TASK-1073
  searchQuery, // TASK-1075
  canvasGroupOptions,
  baseInboxTasks,
  inboxTasks,
  todayCount,
  next3DaysCount,
  weekCount,
  monthCount,
  doneTaskCount,
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
  onDragEnd,
  sendTaskToCanvas,
  sendSelectedToCanvas
} = useUnifiedInboxActions(inboxTasks, props.context)

// Handlers that require window/store access directly
const handleTaskDoubleClick = (task: Task) => {
  window.dispatchEvent(new CustomEvent('open-task-edit', {
    detail: { taskId: task.id }
  }))
}

// Send to Canvas handler - respects multi-select
const handleSendToCanvas = (task: Task) => {
  // If task is part of a multi-selection, send all selected tasks
  if (selectedTaskIds.value.has(task.id) && selectedTaskIds.value.size > 1) {
    sendSelectedToCanvas()
  } else {
    // Single task send
    sendTaskToCanvas(task)
  }
}

const handleStartTimer = async (task: Task) => {
  // BUG-1051: AWAIT for timer sync
  // Logic from original component
  if (timerStore.currentTaskId === task.id && timerStore.isTimerActive) {
    await timerStore.stopTimer()
  } else {
    await timerStore.startTimer(task.id)
  }
}
</script>

<style scoped>
.unified-inbox-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  padding: var(--space-4);
  gap: var(--space-3);
  background: var(--inbox-panel-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  /* BUG-1078: Auto-size to fit content, with minimum width */
  width: fit-content;
  min-width: v-bind(expandedWidth);
  max-width: 420px; /* Prevent excessive growth */
  transition: width var(--duration-normal) var(--spring-smooth), padding var(--duration-normal);
  overflow: hidden;
  position: relative;
  z-index: 100;
}

/* FEATURE-254: Right-side positioning for Canvas Inbox */
.unified-inbox-panel.is-right-side {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  bottom: 0.5rem;
  height: auto;
}

.unified-inbox-panel.collapsed {
  /* BUG-1079: Override auto-size for collapsed state - make it slim */
  width: v-bind(maxCollapsedWidth);
  min-width: unset; /* Reset min-width so collapsed width takes effect */
  max-width: unset;
  padding: var(--space-2);
  /* Center all content in collapsed state */
  align-items: center;
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
  gap: var(--space-0_5);
}
</style>