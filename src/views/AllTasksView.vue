<template>
  <div class="all-tasks-view" @dragover.prevent @dragenter.prevent>
    <!-- Mobile View -->
    <MobileInboxView v-if="isMobile" />

    <!-- Desktop View -->
    <template v-else>
      <!-- View Controls + Mode Toggle -->
      <div class="controls-row">
        <ViewControls
          v-model:sort-by="sortBy"
          v-model:group-by="groupBy"
          v-model:density="density"
          :filter-status="filterStatus"
          :hide-done-tasks="hideDoneTasks"
          :show-tree-controls="groupBy !== 'none'"
          @update:filter-status="handleStatusFilterChange"
          @update:hide-done-tasks="handleToggleDoneTasksFromControl"
          @expand-all="handleExpandAll"
          @collapse-all="handleCollapseAll"
        />

        <!-- Show All Week Days Toggle -->
        <button
          v-if="groupBy === 'dueDate'"
          class="mode-btn"
          :class="{ 'mode-btn--active': showAllWeekDays }"
          :title="showAllWeekDays ? 'Hide empty days' : 'Show all week days'"
          @click="showAllWeekDays = !showAllWeekDays"
        >
          <CalendarDays :size="16" />
        </button>
      </div>

      <!-- Content Area -->
      <div class="tasks-container" @dragover.prevent>
        <!-- List Mode -->
        <TaskList
          ref="taskListRef"
          :tasks="sortedTasks"
          :groups="groupedTasks"
          :group-by="groupBy"
          :empty-message="getEmptyMessage()"
          :sort-by="sortBy"
          :sort-direction="sortDirection"
          :density="density"
          @select="handleSelectTask"
          @toggle-complete="handleToggleComplete"
          @start-timer="handleStartTimer"
          @edit="handleEditTask"
          @context-menu="handleContextMenu"
          @move-task="handleMoveTask"
          @update-task="handleUpdateTask"
          @batch-edit="handleBatchEdit"
          @delete-selected="handleDeleteSelected"
          @add-task-to-group="handleAddTaskToGroup"
          @reorder="sortBy = 'manual'"
          @update:sort-by="sortBy = $event"
          @update:sort-direction="sortDirection = $event"
        />
      </div>
    </template>

    <!-- Task Edit Modal -->
    <TaskEditModal
      :is-open="showEditModal"
      :task="selectedTask"
      @close="closeEditModal"
      @permanent-delete="handleConfirmPermanentDelete"
    />

    <!-- Task Context Menu -->
    <TaskContextMenu
      :is-visible="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :task="contextMenuTask"
      :selected-count="contextMenuSelectedCount"
      :selected-ids="contextMenuSelectedIds"
      @close="closeContextMenu"
      @edit="handleEditTask"
      @confirm-delete="handleConfirmDelete"
      @confirm-permanent-delete="handleConfirmPermanentDelete"
      @delete-selected="handleDeleteSelectedFromContext"
      @clear-selection="handleClearSelectionFromContext"
    />

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :is-open="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-text="confirmText"
      @confirm="executeConfirmAction"
      @cancel="cancelConfirmAction"
    />

    <!-- Batch Edit Modal -->
    <BatchEditModal
      :is-open="showBatchEditModal"
      :task-ids="batchEditTaskIds"
      @close="showBatchEditModal = false; batchEditTaskIds = []"
      @applied="handleBatchEditApplied"
    />

    <QuickTaskCreateModal
      :is-open="showCreateModal"
      :inherited-props="createTaskDefaults"
      @cancel="closeCreateModal"
      @create="handleCreateTaskFromModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { useTaskStore } from '@/stores/tasks'
import { isDoneForNowAlreadyCompletedError } from '@/services/tasks/doneForNow'
import { useLaneStore } from '@/stores/lanes'
import { useTimerStore } from '@/stores/timer'
import { useSettingsStore } from '@/stores/settings'
import { useMobileDetection } from '@/composables/useMobileDetection'
import { CalendarDays } from 'lucide-vue-next'
import ViewControls from '@/components/layout/ViewControls.vue'
import TaskList from '@/components/tasks/TaskList.vue'
import MobileInboxView from '@/mobile/views/MobileInboxView.vue'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import TaskContextMenu from '@/components/tasks/TaskContextMenu.vue'
import QuickTaskCreateModal from '@/components/tasks/QuickTaskCreateModal.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import BatchEditModal from '@/components/tasks/BatchEditModal.vue'
import { getViewportCoordinates } from '@/utils/contextMenuCoordinates'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { useRecurrenceAwareDelete } from '@/composables/useRecurrenceAwareDelete'
import { useToast } from '@/composables/useToast'
import { runTaskMutationWithSettling } from '@/composables/tasks/settleTaskMutation'

import { UNCATEGORIZED_PROJECT_ID } from '@/stores/tasks/taskOperations'
import { shouldHideDoneTasksForStatus } from '@/stores/tasks/filterInvariants'
import { getCanonicalTodayTasks } from '@/utils/todayTaskProjection'
import type { Task, GroupByType, TaskGroup } from '@/types/tasks'

type CreateTaskDefaults = {
  dueDate?: string
  priority?: 'low' | 'medium' | 'high'
  status?: string
  projectId?: string
  estimatedDuration?: number
  laneId?: string | null
}

// Mobile Detection
const { isMobile } = useMobileDetection()

// Stores
const taskStore = useTaskStore()
const laneStore = useLaneStore()
const timerStore = useTimerStore()
const settingsStore = useSettingsStore()
const { bulkDeleteTasksWithUndo, createTaskWithUndo, updateTaskWithUndo } = useUnifiedUndoRedo()
const { recurrenceAwareDelete } = useRecurrenceAwareDelete()
const { showToast } = useToast()

const reportCompletionFailure = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : undefined
  console.error('[Tasks] Catalog completion failed:', error)
  try {
    const key = 'flowstate-task-mutation-errors'
    const previous = JSON.parse(localStorage.getItem(key) || '[]')
    const entries = Array.isArray(previous) ? previous : []
    entries.push({ action: 'completed', message, ...(code ? { code } : {}), timestamp: new Date().toISOString(), path: window.location.pathname })
    localStorage.setItem(key, JSON.stringify(entries.slice(-20)))
  } catch {
    // Diagnostics must never change completion behavior.
  }
  showToast('Task could not be completed. Refresh and try again.', 'error')
}

// Extract only reactive state refs, not computed properties
// Computed properties stay on the store to maintain full reactivity chain
const { hideDoneTasks } = storeToRefs(taskStore)

// View State (TASK-1215: Persist across restarts via Tauri store + localStorage)
const sortBy = usePersistentRef<string>('flowstate:all-tasks-sort-by', 'dueDate')
const sortDirection = usePersistentRef<'asc' | 'desc'>('flowstate:all-tasks-sort-direction', 'asc')
const groupBy = usePersistentRef<GroupByType>('flowstate:all-tasks-group-by', 'project')
const showAllWeekDays = usePersistentRef<boolean>('flowstate-show-all-week-days', false)
// Density control for task list rows
const density = usePersistentRef<'compact' | 'comfortable' | 'spacious'>('flowstate:task-list-density', 'comfortable')
// Use global status filter directly from store (maintains reactivity)
const filterStatus = computed(() => taskStore.activeStatusFilter || 'all')
const handleStatusFilterChange = (status: string) => {
  taskStore.setSmartView(null)
  taskStore.setActiveStatusFilter(status)
}

// Component Refs
const taskListRef = ref<InstanceType<typeof TaskList> | null>(null)

// Modal State
const showEditModal = ref(false)
const selectedTask = ref<Task | null>(null)
const showCreateModal = ref(false)
const createTaskDefaults = ref<CreateTaskDefaults | null>(null)
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref<Task | null>(null)
const contextMenuSelectedCount = computed(() => taskListRef.value?.selectedTaskIds?.length ?? 0)
const contextMenuSelectedIds = computed(() => taskListRef.value?.selectedTaskIds ? [...taskListRef.value.selectedTaskIds] : [])
const showConfirmModal = ref(false)
const taskToDelete = ref<string | null>(null)
const confirmTitle = ref('Delete Task')
const confirmMessage = ref('Are you sure you want to delete this task? You can press Ctrl+Z to undo.')
const confirmText = ref('Delete')
const confirmActionFn = ref<(() => void | Promise<void>) | null>(null)
const showBatchEditModal = ref(false)
const batchEditTaskIds = ref<string[]>([])


// Computed Tasks - Access store's computed directly (maintains full reactivity)
const filteredTasks = computed(() => {
  let tasks = taskStore.filteredTasks

  // BUG-1673 DIAGNOSTIC: Log from same render tick to detect Realtime-induced desync
  const raw = taskStore._rawTasks?.length ?? 0
  if (raw > 0 && tasks.length === 0) {
    console.warn(`🔴 [BUG-1673] DATA DESYNC: rawTasks=${raw} but filteredTasks=${tasks.length}`, {
      smartView: taskStore.activeSmartView,
      statusFilter: taskStore.activeStatusFilter,
      durationFilter: taskStore.activeDurationFilter,
    })
  }

  // TASK-076: Apply view-specific 'Hide Done' filter locally
  if (shouldHideDoneTasksForStatus(hideDoneTasks.value, taskStore.activeStatusFilter)) {
    tasks = tasks.filter(t => t.status !== 'done')
  }

  return tasks
})

const sortedTasks = computed(() => {
  const tasks = [...filteredTasks.value]
  const dir = sortDirection.value === 'asc' ? 1 : -1

  switch (sortBy.value) {
    case 'dueDate':
      return tasks.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return dir * (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      })
    case 'priority': {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
      return tasks.sort((a, b) => {
        const aPriority = a.priority ? priorityOrder[a.priority] : 3
        const bPriority = b.priority ? priorityOrder[b.priority] : 3
        return dir * (aPriority - bPriority)
      })
    }
    case 'title':
      return tasks.sort((a, b) => dir * (a.title || '').localeCompare(b.title || ''))
    case 'created':
      return tasks.sort((a, b) => {
        return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      })
    case 'manual':
      return tasks.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    case 'status': {
      const statusOrder: Record<string, number> = { in_progress: 0, planned: 1, backlog: 2, on_hold: 3, done: 4 }
      return tasks.sort((a, b) => {
        const aStatus = statusOrder[a.status] ?? 5
        const bStatus = statusOrder[b.status] ?? 5
        return dir * (aStatus - bStatus)
      })
    }
    case 'progress': {
      return tasks.sort((a, b) => {
        const aSubtasks = a.subtasks as Array<{ done?: boolean }> | undefined
        const bSubtasks = b.subtasks as Array<{ done?: boolean }> | undefined
        const aTotal = aSubtasks?.length ?? 0
        const bTotal = bSubtasks?.length ?? 0
        const aProgress = aTotal > 0 ? (aSubtasks!.filter(s => s.done).length / aTotal) : -1
        const bProgress = bTotal > 0 ? (bSubtasks!.filter(s => s.done).length / bTotal) : -1
        if (aProgress === -1 && bProgress === -1) return 0
        if (aProgress === -1) return 1
        if (bProgress === -1) return -1
        return dir * (aProgress - bProgress)
      })
    }
    case 'estimatedTime':
      return tasks.sort((a, b) => {
        const aTime = (a as any).estimatedTime ?? null
        const bTime = (b as any).estimatedTime ?? null
        if (aTime === null && bTime === null) return 0
        if (aTime === null) return 1
        if (bTime === null) return -1
        return dir * (aTime - bTime)
      })
    default:
      return tasks
  }
})

// TASK-1334: Group tasks by selected criteria
// Helper: get "root" tasks for a group — tasks with no parent, or whose parent is NOT in this group
const getRootTasks = (groupTasks: Task[]) => {
  const groupIds = new Set(groupTasks.map(t => t.id))
  return groupTasks.filter(t => !t.parentTaskId || !groupIds.has(t.parentTaskId))
}

const groupedTasks = computed((): TaskGroup[] => {
  const tasks = sortedTasks.value
  const groups: TaskGroup[] = []

  if (groupBy.value === 'none') {
    // Single flat group
    const parentTasks = tasks.filter(t => !t.parentTaskId)
    if (tasks.length > 0) {
      groups.push({ key: 'all', title: 'All Tasks', tasks, parentTasks })
    }
  } else if (groupBy.value === 'project') {
    // Group by project with nested hierarchy
    const projectMap = new Map<string, Task[]>()
    tasks.forEach(task => {
      // TASK-1455: Normalize all uncategorized projectId variants to '' bucket
      const key = (!task.projectId || task.projectId === UNCATEGORIZED_PROJECT_ID || task.projectId === '1') ? '' : task.projectId
      if (!projectMap.has(key)) projectMap.set(key, [])
      projectMap.get(key)!.push(task)
    })

    // Build project hierarchy: top-level projects first, then children indented
    const topLevelProjects = taskStore.rootProjects
    const processedIds = new Set<string>()

    const addProjectGroup = (project: { id: string; name: string; emoji?: string; color?: string | string[] }, indent: number) => {
      if (processedIds.has(project.id)) return
      processedIds.add(project.id)
      const projectTasks = projectMap.get(project.id) || []
      if (projectTasks.length > 0) {
        groups.push({
          key: project.id,
          title: project.name,
          emoji: project.emoji,
          color: project.color,
          tasks: projectTasks,
          parentTasks: getRootTasks(projectTasks),
          indent
        })
      }
      // Add child projects
      const children = taskStore.getChildProjects(project.id)
      children.forEach(child => addProjectGroup(child, indent + 1))
    }

    topLevelProjects.forEach(p => addProjectGroup(p, 0))

    // Add projects that aren't top-level but have tasks (orphaned projects)
    taskStore.projects.forEach(p => {
      if (!processedIds.has(p.id) && projectMap.has(p.id)) {
        addProjectGroup(p, 0)
      }
    })

    // Collect tasks whose projectId wasn't found in any loaded project (e.g. projects failed to load)
    // These go into uncategorized so they don't silently disappear from the view
    const uncategorized = projectMap.get('') || []
    projectMap.forEach((tasks, key) => {
      if (key !== '' && !processedIds.has(key)) {
        uncategorized.push(...tasks)
      }
    })

    // TASK-1455: Uncategorized tasks at the top so user can categorize them
    if (uncategorized.length > 0) {
      groups.unshift({
        key: 'uncategorized',
        title: 'Uncategorized',
        tasks: uncategorized,
        parentTasks: getRootTasks(uncategorized)
      })
    }
  } else if (groupBy.value === 'status') {
    const statusOrder = ['todo', 'done']
    const statusLabels: Record<string, string> = {
      todo: 'To Do',
      done: 'Done'
    }
    const statusMap = new Map<string, Task[]>()
    tasks.forEach(task => {
      const key = task.status === 'done' ? 'done' : 'todo'
      if (!statusMap.has(key)) statusMap.set(key, [])
      statusMap.get(key)!.push(task)
    })
    statusOrder.forEach(key => {
      const statusTasks = statusMap.get(key)
      if (statusTasks && statusTasks.length > 0) {
        groups.push({
          key,
          title: statusLabels[key] || key,
          tasks: statusTasks,
          parentTasks: getRootTasks(statusTasks)
        })
      }
    })
  } else if (groupBy.value === 'priority') {
    const priorityOrder = ['high', 'medium', 'low', 'none']
    const priorityLabels: Record<string, string> = {
      high: 'High Priority',
      medium: 'Medium Priority',
      low: 'Low Priority',
      none: 'No Priority'
    }
    const priorityMap = new Map<string, Task[]>()
    tasks.forEach(task => {
      const key = task.priority || 'none'
      if (!priorityMap.has(key)) priorityMap.set(key, [])
      priorityMap.get(key)!.push(task)
    })
    priorityOrder.forEach(key => {
      const priorityTasks = priorityMap.get(key)
      if (priorityTasks && priorityTasks.length > 0) {
        groups.push({
          key,
          title: priorityLabels[key],
          tasks: priorityTasks,
          parentTasks: getRootTasks(priorityTasks)
        })
      }
    })
  } else if (groupBy.value === 'lane') {
    // TASK-1812: Group by lane (sprint-style cross-project goal). Flat, no hierarchy.
    const laneMap = new Map<string, Task[]>()
    tasks.forEach(task => {
      const key = task.laneId || ''
      if (!laneMap.has(key)) laneMap.set(key, [])
      laneMap.get(key)!.push(task)
    })
    // Lanes in store order; only those with tasks
    laneStore.lanes.forEach(lane => {
      const laneTasks = laneMap.get(lane.id)
      if (laneTasks && laneTasks.length > 0) {
        groups.push({
          key: lane.id,
          title: lane.name,
          color: lane.color,
          tasks: laneTasks,
          parentTasks: getRootTasks(laneTasks)
        })
      }
    })
    // Tasks with no lane (or pointing at a missing lane) bucket to the top
    const noLane = laneMap.get('') || []
    laneMap.forEach((laneTasks, key) => {
      if (key !== '' && !laneStore.getLaneById(key)) noLane.push(...laneTasks)
    })
    if (noLane.length > 0) {
      groups.unshift({
        key: 'no-lane',
        title: 'No Lane',
        tasks: noLane,
        parentTasks: getRootTasks(noLane)
      })
    }
  } else if (groupBy.value === 'dueDate') {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const weekStartsOn = settingsStore.weekStartsOn ?? 0
    const todayDow = today.getDay()
    const endOfWeek = new Date(today)
    if (weekStartsOn === 0) {
      // Sunday start: week ends Saturday (day 6)
      const daysUntilEnd = (6 - todayDow + 7) % 7
      endOfWeek.setDate(today.getDate() + daysUntilEnd)
    } else {
      // Monday start: week ends Sunday (day 0)
      const daysUntilEnd = (7 - todayDow) % 7
      endOfWeek.setDate(today.getDate() + daysUntilEnd)
    }
    // Extend on Fri/Sat so upcoming tasks aren't hidden
    if (!showAllWeekDays.value && (todayDow === 5 || todayDow === 6)) {
      const nextWed = new Date(endOfWeek)
      nextWed.setDate(endOfWeek.getDate() + 4)
      endOfWeek.setTime(nextWed.getTime())
    }

    // Generate per-day buckets for remaining weekdays (after tomorrow, up to end of week)
    const dayAfterTomorrow = new Date(tomorrow)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1)

    const locale = settingsStore.language || 'en'
    const perDayBuckets: { key: string; title: string; date: Date }[] = []

    const cursor = new Date(dayAfterTomorrow)
    while (cursor <= endOfWeek) {
      const isoKey = `day-${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      const dayName = cursor.toLocaleDateString(locale === 'he' ? 'he-IL' : locale, { weekday: 'long' })
      const dateStr = `${cursor.getDate()}.${cursor.getMonth() + 1}`
      const title = `${dayName} ${dateStr}`
      perDayBuckets.push({ key: isoKey, title: title.charAt(0).toUpperCase() + title.slice(1), date: new Date(cursor) })
      cursor.setDate(cursor.getDate() + 1)
    }

    const buckets: Record<string, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      later: [],
      noDate: []
    }
    // Add per-day buckets
    perDayBuckets.forEach(({ key }) => { buckets[key] = [] })

    tasks.forEach(task => {
      if (!task.dueDate) {
        buckets.noDate.push(task)
        return
      }
      const [y, m, d] = task.dueDate.split('T')[0].split('-').map(Number)
      const dueDate = new Date(y, m - 1, d)
      if (dueDate < today) buckets.overdue.push(task)
      else if (dueDate.getTime() === today.getTime()) buckets.today.push(task)
      else if (dueDate.getTime() === tomorrow.getTime()) buckets.tomorrow.push(task)
      else if (dueDate <= endOfWeek) {
        // Find matching per-day bucket
        const dayKey = `day-${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        if (buckets[dayKey]) buckets[dayKey].push(task)
        else buckets.later.push(task) // fallback
      }
      else buckets.later.push(task)
    })

    // Today is canonical across Board, Canvas, and Catalogue. Keep the other
    // Catalogue buckets local, but never derive a second Today membership/order.
    buckets.today = getCanonicalTodayTasks(tasks, hideDoneTasks.value)

    const bucketConfig: { key: string; title: string }[] = [
      { key: 'overdue', title: 'Overdue' },
      { key: 'today', title: 'Today' },
      { key: 'tomorrow', title: 'Tomorrow' },
      ...perDayBuckets.map(({ key, title }) => ({ key, title })),
      { key: 'later', title: 'Later' },
      { key: 'noDate', title: 'No Date' }
    ]

    bucketConfig.forEach(({ key, title }) => {
      const bucketTasks = buckets[key]
      const isDayBucket = key.startsWith('day-')
      const isTomorrow = key === 'tomorrow'
      // Tomorrow is always visible; empty day buckets shown when showAllWeekDays is on
      if (bucketTasks.length > 0 || isTomorrow || (showAllWeekDays.value && isDayBucket)) {
        groups.push({
          key,
          title,
          tasks: bucketTasks,
          parentTasks: getRootTasks(bucketTasks)
        })
      }
    })
  }

  return groups
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
  const task = taskStore.getTask(taskId)
  if (task) {
    selectedTask.value = task
    showEditModal.value = true
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  selectedTask.value = null
}

const closeCreateModal = () => {
  showCreateModal.value = false
  createTaskDefaults.value = null
}

const handleAddTaskToGroup = async (groupKey: string, groupByMode: string) => {
  // Build partial task with pre-filled group property
  const taskDefaults: CreateTaskDefaults = {}

  if (groupByMode === 'project') {
    taskDefaults.projectId = (groupKey === 'uncategorized' || groupKey === '__no_project__') ? undefined : groupKey
  } else if (groupByMode === 'lane') {
    // TASK-1812: new task inherits the lane group it was added under
    taskDefaults.laneId = groupKey === 'no-lane' ? null : groupKey
  } else if (groupByMode === 'status') {
    taskDefaults.status = groupKey as Task['status']
  } else if (groupByMode === 'priority') {
    taskDefaults.priority = (groupKey === 'no_priority' ? undefined : groupKey) as CreateTaskDefaults['priority']
  } else if (groupByMode === 'dueDate') {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
    const formatLocalDate = (d: Date): string => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const dateMap: Record<string, string | undefined> = {
      overdue: undefined,
      today: formatLocalDate(today),
      tomorrow: formatLocalDate(tomorrow),
      thisWeek: formatLocalDate(endOfWeek),
      later: formatLocalDate(new Date(today.getTime() + 14 * 86400000)),
      noDate: undefined
    }
    if (groupKey in dateMap && dateMap[groupKey]) {
      taskDefaults.dueDate = dateMap[groupKey]
    }
  }

  createTaskDefaults.value = taskDefaults
  showCreateModal.value = true
}

const handleCreateTaskFromModal = async (data: {
  title: string
  description: string
  status: string
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  projectId?: string
  onSettled?: (saved: boolean) => void
}) => {
  try {
    const { onSettled: _onSettled, ...taskData } = data
    await createTaskWithUndo({
      ...createTaskDefaults.value,
      ...taskData,
      status: data.status as Task['status']
    })
    closeCreateModal()
    data.onSettled?.(true)
  } catch (error) {
    console.error('Failed to create task:', error)
    data.onSettled?.(false)
  }
}

const handleContextMenu = (event: MouseEvent, task: Task) => {
  // BUG-1096: Use normalized coordinates for Tauri compatibility
  const { x, y } = getViewportCoordinates(event)
  contextMenuX.value = x
  contextMenuY.value = y
  contextMenuTask.value = task

  // BUG-1529: Clear stale multi-selection when right-clicking a task
  // that isn't part of the current selection
  const currentSelection = taskListRef.value?.selectedTaskIds ?? []
  if (!currentSelection.includes(task.id)) {
    taskListRef.value?.clearSelection()
  }

  showContextMenu.value = true
}

const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuTask.value = null
}

const handleToggleComplete = async (taskId: string) => {
  try {
    await runTaskMutationWithSettling(
    taskId,
    () => taskStore.getTask(taskId),
    () => taskStore.initializeFromDatabase(),
    async () => {
      const task = taskStore.getTask(taskId)
      if (!task) throw new Error(`Task update target no longer exists: ${taskId}`)

      // TASK-1532: Recurring tasks use "done for now" on toggle click
      if (task.status !== 'done' && task.recurrenceRule) {
        try {
          await taskStore.doneForNow(taskId)
        } catch (error) {
          if (isDoneForNowAlreadyCompletedError(error)) {
            await taskStore.initializeFromDatabase()
            return
          }

          // A realtime refresh can change the occurrence between the
          // preview and apply calls. Refresh the canonical row and retry one
          // fresh transaction before showing a failure toast.
          const code = error && typeof error === 'object' && 'code' in error
            ? String((error as { code?: unknown }).code ?? '')
            : ''
          if (code !== 'state_conflict' && code !== 'request_hash_mismatch') throw error
          await taskStore.initializeFromDatabase()
          await taskStore.doneForNow(taskId)
        }
        return
      }
      const newStatus = task.status === 'done' ? 'todo' : 'done'
      // BUG-1051: AWAIT to ensure persistence
      await updateTaskWithUndo(taskId, { status: newStatus })
    },
    )
  } catch (error) {
    reportCompletionFailure(error)
  }
}

const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
  if ('title' in updates && (!updates.title || !String(updates.title).trim())) {
    return
  }
  // BUG-1051: AWAIT to ensure persistence
  await updateTaskWithUndo(taskId, updates)
}

// TASK-1520: recurrence-aware delete via global composable
const handleConfirmDelete = (taskId: string) => {
  const allTasks = taskStore.rawTasks || taskStore.tasks
  const task = allTasks.find(t => t.id === taskId)
  if (task?.recurrenceRule) {
    recurrenceAwareDelete(taskId)
    return
  }

  taskToDelete.value = taskId
  confirmTitle.value = 'Delete Task'
  confirmMessage.value = 'Are you sure you want to delete this task? You can press Ctrl+Z to undo.'
  confirmText.value = 'Delete'
  confirmActionFn.value = () => recurrenceAwareDelete(taskId)
  showConfirmModal.value = true
}

const handleConfirmPermanentDelete = (taskId: string) => {
  const allTasks = taskStore.rawTasks || taskStore.tasks
  const task = allTasks.find(t => t.id === taskId)
  if (!task) return

  if (task.recurrenceRule) {
    recurrenceAwareDelete(taskId, { permanent: true })
    return
  }

  confirmTitle.value = 'Permanently Delete Task'
  confirmMessage.value = `Permanently delete "${task.title}"? This performs a hard delete from storage.`
  confirmText.value = 'Permanently Delete'
  confirmActionFn.value = () => recurrenceAwareDelete(taskId, { permanent: true })
  showConfirmModal.value = true
}

const executeConfirmAction = async () => {
  const action = confirmActionFn.value
  showConfirmModal.value = false
  confirmActionFn.value = null
  taskToDelete.value = null
  if (action) {
    await action()
  }
}

const cancelConfirmAction = () => {
  showConfirmModal.value = false
  confirmActionFn.value = null
  taskToDelete.value = null
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
  await updateTaskWithUndo(taskId, {
    projectId: targetProjectId || undefined,
    parentTaskId: targetParentId || undefined
  })
}

// --- Bulk Selection Handlers ---
const handleBatchEdit = (taskIds: string[]) => {
  batchEditTaskIds.value = taskIds
  showBatchEditModal.value = true
}

const handleBatchEditApplied = () => {
  showBatchEditModal.value = false
  batchEditTaskIds.value = []
  taskListRef.value?.clearSelection()
}

const handleDeleteSelected = (taskIds: string[]) => {
  const count = taskIds.length
  confirmTitle.value = 'Delete Selected Tasks'
  confirmMessage.value = `Delete ${count} selected task${count !== 1 ? 's' : ''}? You can press Ctrl+Z to undo.`
  confirmText.value = 'Delete'
  confirmActionFn.value = async () => {
    await bulkDeleteTasksWithUndo(taskIds)
    taskListRef.value?.clearSelection()
  }
  showConfirmModal.value = true
}

// Context menu batch handlers (when right-clicking with selection active)
const handleDeleteSelectedFromContext = () => {
  const ids = contextMenuSelectedIds.value
  if (ids.length > 0) {
    handleDeleteSelected(ids)
  }
}

const handleClearSelectionFromContext = () => {
  taskListRef.value?.clearSelection()
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
    sortBy: sortBy.value
  })
  // Migrate legacy table view mode
  const legacy = localStorage.getItem('flowstate-catalog-view-mode')
  if (legacy) localStorage.removeItem('flowstate-catalog-view-mode')
})
</script>

<style scoped>
.all-tasks-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  flex: 1;
}

/* FEATURE-1293: Controls row — ViewControls + mode toggle side-by-side */
.controls-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}


.mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.mode-btn:hover {
  color: var(--text-primary);
  background: var(--glass-bg-medium);
  border-color: var(--glass-border);
}

.mode-btn--active {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: var(--glass-bg-medium);
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
