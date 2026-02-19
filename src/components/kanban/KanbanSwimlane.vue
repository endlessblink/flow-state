<template>
  <div
    class="kanban-swimlane"
    :class="{
      collapsed: isCollapsed,
      'dragging': isDragging,
      'scrolling': isScrolling
    }"
  >
    <!-- Swimlane Header - TASK-157: Simplified Todoist-style -->
    <!-- FEATURE-1336: Hide header in category view (single swimlane, no project grouping) -->
    <div
      v-if="currentViewType !== 'category'"
      class="swimlane-header swimlane-header--minimal"
      @click="toggleCollapse"
      @contextmenu.prevent="handleGroupContextMenu"
    >
      <div class="header-content--swimlane">
        <button class="collapse-btn">
          <ChevronDown v-if="!isCollapsed" :size="14" />
          <ChevronRight v-if="isCollapsed" :size="14" />
        </button>
        <ProjectEmojiIcon v-if="project.emoji" :emoji="project.emoji" size="sm" />
        <div
          v-else-if="project.color"
          class="swimlane-color-dot"
          :style="{ backgroundColor: Array.isArray(project.color) ? project.color[0] : project.color }"
        />
        <h3 class="project-name">
          {{ project.name }}
        </h3>
        <span class="task-count--subtle">{{ totalTasks }}</span>
      </div>
    </div>

    <!-- Scrollable Table Container (only visible when not collapsed) -->
    <div v-if="!isCollapsed" ref="scrollContainer" class="table-scroll-container">
      <div class="swimlane-body">
        <!-- Status View Columns -->
        <template v-if="currentViewType === 'status'">
          <KanbanColumn
            v-for="column in statusColumns"
            :key="column.key"
            :title="column.label"
            :status="column.key as Task['status']"
            :tasks="tasksByStatus[column.key]"
            column-type="status"
            :swimlane-id="project.id"
            class="swimlane-column"
            @add-task="handleAddTask"
            @move-task="handleMoveTask"
            @select-task="$emit('selectTask', $event)"
            @start-timer="$emit('startTimer', $event)"
            @edit-task="$emit('editTask', $event)"
            @delete-task="$emit('deleteTask', $event)"
            @context-menu="(event, task) => $emit('contextMenu', event, task)"
          />
        </template>

        <!-- Date View Columns - Todoist Style -->
        <template v-if="currentViewType === 'date'">
          <KanbanColumn
            v-for="column in dateColumns"
            :key="column.key"
            :title="column.label"
            :status="column.key as any"
            :tasks="tasksByDate[column.key]"
            column-type="date"
            :swimlane-id="project.id"
            class="swimlane-column"
            @add-task="handleAddTask"
            @move-task="handleMoveTask"
            @select-task="$emit('selectTask', $event)"
            @start-timer="$emit('startTimer', $event)"
            @edit-task="$emit('editTask', $event)"
            @delete-task="$emit('deleteTask', $event)"
            @context-menu="(event, task) => $emit('contextMenu', event, task)"
          />
        </template>

        <!-- Priority View Columns -->
        <template v-if="currentViewType === 'priority'">
          <KanbanColumn
            v-for="column in priorityColumns"
            :key="column.key"
            :title="column.label"
            :status="column.key as any"
            :tasks="tasksByPriority[column.key]"
            column-type="priority"
            :swimlane-id="project.id"
            class="swimlane-column"
            @add-task="handleAddTask"
            @move-task="handleMoveTask"
            @select-task="$emit('selectTask', $event)"
            @start-timer="$emit('startTimer', $event)"
            @edit-task="$emit('editTask', $event)"
            @delete-task="$emit('deleteTask', $event)"
            @context-menu="(event, task) => $emit('contextMenu', event, task)"
          />
        </template>

        <!-- FEATURE-1336: Category View Columns (projects as columns) -->
        <template v-if="currentViewType === 'category'">
          <KanbanColumn
            v-for="column in categoryColumns"
            :key="column.key"
            :title="column.label"
            :status="column.key as any"
            :tasks="tasksByCategory[column.key] || []"
            column-type="category"
            swimlane-id="category"
            class="swimlane-column"
            @add-task="handleAddTask"
            @move-task="handleMoveTask"
            @select-task="$emit('selectTask', $event)"
            @start-timer="$emit('startTimer', $event)"
            @edit-task="$emit('editTask', $event)"
            @delete-task="$emit('deleteTask', $event)"
            @context-menu="(event, task) => $emit('contextMenu', event, task)"
          />
        </template>
      </div>

      <!-- Empty State for Filter -->
      <div v-if="totalTasks === 0 && currentFilter" class="empty-filter-state">
        <div class="empty-icon">
          <Calendar :size="24" :stroke-width="1.5" />
        </div>
        <p class="empty-message">
          {{ getEmptyStateMessage() }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import KanbanColumn from './KanbanColumn.vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import type { Task, Project } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { ChevronDown, ChevronRight, Calendar } from 'lucide-vue-next'
import { useHorizontalDragScroll } from '@/composables/useHorizontalDragScroll'
import { shouldUseSmartGroupLogic, getSmartGroupType } from '@/composables/useTaskSmartGroups'
import {
  groupTasksByStatus,
  groupTasksByPriority,
  groupTasksByDate
} from '@/composables/board/useBoardState'
import { UNCATEGORIZED_PROJECT_ID } from '@/stores/tasks/taskOperations'

import './KanbanSwimlane.css'

interface Props {
  project: Project
  tasks: Task[]
  currentFilter?: 'today' | 'week' | null
  density?: 'ultrathin' | 'compact' | 'comfortable' | 'spacious'
  showDoneColumn?: boolean
  viewType?: 'priority' | 'date' | 'status' | 'category'
}

const props = withDefaults(defineProps<Props>(), {
  currentFilter: null,
  density: 'comfortable',
  showDoneColumn: false,
  viewType: 'priority'
})

const emit = defineEmits<{
  selectTask: [taskId: string]
  startTimer: [taskId: string]
  editTask: [taskId: string]
  deleteTask: [taskId: string]
  moveTask: [taskId: string, newStatus: Task['status']]
  addTask: [payload: { columnKey: string, projectId: string, viewType: 'status' | 'priority' | 'date' | 'category' }]
  contextMenu: [event: MouseEvent, task: Task]
  groupContextMenu: [event: MouseEvent, project: Project]
}>()

const { t } = useI18n()
const taskStore = useTaskStore()
const isCollapsed = ref(false)

// Horizontal drag scroll functionality
const scrollContainer = ref<HTMLElement | null>(null)
const { isDragging, isScrolling } = useHorizontalDragScroll(scrollContainer, {
  sensitivity: 1.2,
  friction: 0.92,
  touchEnabled: true
})

// Current view type - now controlled from parent BoardView
const currentViewType = computed(() => props.viewType || 'priority')

// Column definitions
const statusColumns = computed(() => {
  const columns = [
    { key: 'planned', label: t('kanban.planned') },
    { key: 'in_progress', label: t('kanban.in_progress') },
    { key: 'backlog', label: t('kanban.backlog') },
    { key: 'on_hold', label: t('kanban.on_hold') }
  ]
  if (props.showDoneColumn) columns.push({ key: 'done', label: t('kanban.done') })
  return columns
})

// TASK-1348: No Date first (most visible), removed dead Inbox column
const dateColumns = computed(() => [
  { key: 'noDate', label: t('kanban.no_date') },
  { key: 'overdue', label: t('kanban.overdue') },
  { key: 'today', label: t('kanban.today') },
  { key: 'tomorrow', label: t('kanban.tomorrow') },
  { key: 'thisWeek', label: t('kanban.this_week') },
  { key: 'later', label: t('kanban.later') }
])

const priorityColumns = computed(() => [
  { key: 'high', label: t('kanban.priority_high') },
  { key: 'medium', label: t('kanban.priority_medium') },
  { key: 'low', label: t('kanban.priority_low') },
  { key: 'no_priority', label: t('kanban.no_priority') }
])

// Computed groupings using external helpers
const tasksByStatus = computed(() => groupTasksByStatus(props.tasks))
const tasksByPriority = computed(() => groupTasksByPriority(props.tasks))
const tasksByDate = computed(() => groupTasksByDate(props.tasks, taskStore.hideDoneTasks))

// FEATURE-1336: Category view - columns are projects
const categoryColumns = computed(() => {
  // Build columns from all projects (root first, then nested with indent)
  const columns: { key: string; label: string; parentId?: string }[] = []

  // Get root projects sorted by name
  const rootProjects = taskStore.projects
    .filter((p: any) => !p.parentId)
    .sort((a: any, b: any) => a.name.localeCompare(b.name))

  for (const project of rootProjects) {
    columns.push({ key: project.id, label: project.name })
    // Add child projects indented
    const children = taskStore.projects
      .filter((p: any) => p.parentId === project.id)
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
    for (const child of children) {
      columns.push({ key: child.id, label: `  ${child.name}`, parentId: project.id })
    }
  }

  // Always add Uncategorized at the end
  columns.push({ key: UNCATEGORIZED_PROJECT_ID, label: t('kanban.uncategorized') })
  return columns
})

const tasksByCategory = computed(() => {
  const result: Record<string, Task[]> = {}
  // Initialize all category columns
  for (const col of categoryColumns.value) {
    result[col.key] = []
  }
  // Group tasks by projectId
  props.tasks.forEach(task => {
    const projectId = task.projectId || UNCATEGORIZED_PROJECT_ID
    if (result[projectId]) {
      result[projectId].push(task)
    } else {
      // Task belongs to project not in columns (shouldn't happen, but safety)
      result[UNCATEGORIZED_PROJECT_ID]?.push(task)
    }
  })
  return result
})

const toggleCollapse = () => { isCollapsed.value = !isCollapsed.value }
const handleAddTask = (columnKey: string) => {
  emit('addTask', {
    columnKey,
    projectId: props.project.id,
    viewType: currentViewType.value
  })
}

const handleGroupContextMenu = (event: MouseEvent) => {
  try {
    emit('groupContextMenu', event, props.project)
  } catch (error) {
    console.error('Failed to open context menu:', error)
  }
}

const totalTasks = computed(() => props.tasks.length)

const handleMoveTask = (taskId: string, targetKey: string) => {
  if (currentViewType.value === 'category') {
    // FEATURE-1336: Category view - move task to target project
    taskStore.moveTaskToProject(taskId, targetKey === UNCATEGORIZED_PROJECT_ID ? '' : targetKey)
  } else if (currentViewType.value === 'status') {
    emit('moveTask', taskId, targetKey as Task['status'])
  } else if (currentViewType.value === 'date') {
    if (shouldUseSmartGroupLogic(targetKey)) {
      const smartGroupType = getSmartGroupType(targetKey)
      if (smartGroupType) {
        taskStore.moveTaskToSmartGroup(taskId, smartGroupType)
      } else {
        taskStore.moveTaskToDate(taskId, targetKey)
      }
    } else {
      taskStore.moveTaskToDate(taskId, targetKey)
    }
  } else if (currentViewType.value === 'priority') {
    taskStore.moveTaskToPriority(taskId, targetKey as Task['priority'] | 'no_priority')
  }
}

const getEmptyStateMessage = () => {
  if (props.currentFilter === 'today') return t('kanban.no_tasks_today')
  if (props.currentFilter === 'week') return t('kanban.no_tasks_week')
  return t('kanban.no_tasks_project')
}
</script>

```