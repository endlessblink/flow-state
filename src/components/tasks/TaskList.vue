<template>
  <div
    class="task-list"
    :class="[`task-list--${density}`]"
    @dragover.prevent
    @dragstart.capture="augmentDragWithSelection"
  >
    <!-- Column Headers / Bulk Actions Bar -->
    <div class="column-headers" :class="{ 'column-headers--selection': selectionMode }">
      <!-- Select-all checkbox always visible -->
      <label class="select-all-checkbox">
        <input
          type="checkbox"
          :checked="allSelected"
          :indeterminate.prop="someSelected && !allSelected"
          @change="toggleSelectAll"
        >
      </label>

      <template v-if="selectionMode">
        <!-- Bulk action bar when tasks selected -->
        <div class="bulk-actions-bar">
          <span class="selection-count">{{ selectedTaskIds.length }} selected</span>
          <button class="bulk-action-btn bulk-action-btn--edit" title="Batch edit selected tasks" @click="emit('batchEdit', [...selectedTaskIds])">
            <Pencil :size="14" />
            Edit
          </button>
          <button class="bulk-action-btn bulk-action-btn--delete" title="Delete selected tasks" @click="emit('deleteSelected', [...selectedTaskIds])">
            <Trash2 :size="14" />
            Delete
          </button>
          <button class="bulk-action-btn bulk-action-btn--clear" title="Clear selection" @click="clearSelection">
            <X :size="14" />
            Clear
          </button>
        </div>
      </template>
      <template v-else>
        <span class="sortable-header" :class="{ 'sortable-header--active': sortBy === 'title' }" @click="handleSort('title')">
          Task <span class="task-total-count">{{ tasks.length }}</span>
          <ChevronUp v-if="sortBy === 'title' && sortDirection === 'asc'" :size="12" class="sort-indicator" />
          <ChevronDown v-else-if="sortBy === 'title'" :size="12" class="sort-indicator" />
        </span>
        <span />
        <span class="sortable-header" :class="{ 'sortable-header--active': sortBy === 'status' }" @click="handleSort('status')">
          Status
          <ChevronUp v-if="sortBy === 'status' && sortDirection === 'asc'" :size="12" class="sort-indicator" />
          <ChevronDown v-else-if="sortBy === 'status'" :size="12" class="sort-indicator" />
        </span>
        <span class="sortable-header" :class="{ 'sortable-header--active': sortBy === 'priority' }" @click="handleSort('priority')">
          Priority
          <ChevronUp v-if="sortBy === 'priority' && sortDirection === 'asc'" :size="12" class="sort-indicator" />
          <ChevronDown v-else-if="sortBy === 'priority'" :size="12" class="sort-indicator" />
        </span>
        <span class="sortable-header" :class="{ 'sortable-header--active': sortBy === 'dueDate' }" @click="handleSort('dueDate')">
          Due
          <ChevronUp v-if="sortBy === 'dueDate' && sortDirection === 'asc'" :size="12" class="sort-indicator" />
          <ChevronDown v-else-if="sortBy === 'dueDate'" :size="12" class="sort-indicator" />
        </span>
        <span class="sortable-header" :class="{ 'sortable-header--active': sortBy === 'progress' }" @click="handleSort('progress')">
          Progress
          <ChevronUp v-if="sortBy === 'progress' && sortDirection === 'asc'" :size="12" class="sort-indicator" />
          <ChevronDown v-else-if="sortBy === 'progress'" :size="12" class="sort-indicator" />
        </span>
        <span class="sortable-header" :class="{ 'sortable-header--active': sortBy === 'estimatedTime' }" @click="handleSort('estimatedTime')">
          Est.
          <ChevronUp v-if="sortBy === 'estimatedTime' && sortDirection === 'asc'" :size="12" class="sort-indicator" />
          <ChevronDown v-else-if="sortBy === 'estimatedTime'" :size="12" class="sort-indicator" />
        </span>
        <span />
      </template>
    </div>

    <!-- TASK-1334: Grouped rendering with sticky headers -->
    <div
      v-for="group in groups"
      :key="group.key"
      class="task-group"
      :class="{ 'task-group--indented': (group.indent || 0) > 0 }"
      :data-group-key="group.key"
    >
      <!-- Sticky Group Header -->
      <div
        v-if="groupBy !== 'none'"
        class="group-header"
        :class="{ 'group-header--drop-target': isDragging && headerDropTarget === group.key }"
        :style="(group.indent || 0) > 0 ? { paddingLeft: `${12 + (group.indent || 0) * 24}px` } : undefined"
        @click="toggleGroupExpand(group.key)"
        @dragover.prevent="onHeaderDragOver($event, group)"
        @dragleave="onHeaderDragLeave($event)"
        @drop.prevent="onHeaderDrop($event, group)"
      >
        <label class="group-select-checkbox" @click.stop>
          <input
            type="checkbox"
            :checked="isGroupAllSelected(group)"
            :indeterminate.prop="isGroupPartiallySelected(group)"
            @change="toggleGroupSelect(group)"
          >
        </label>
        <ChevronRight
          :size="16"
          class="group-expand-icon"
          :class="{ 'group-expand-icon--expanded': expandedGroups.has(group.key) }"
        />
        <ProjectEmojiIcon v-if="group.emoji" :emoji="group.emoji" size="xs" />
        <div v-else-if="group.color" class="group-color-dot" :style="{ backgroundColor: Array.isArray(group.color) ? group.color[0] : (group.color || '#6B7280') }" />
        <span class="group-name">{{ group.title }}</span>
        <span class="group-task-count">{{ group.tasks.length }}</span>
        <button
          class="group-add-btn"
          title="Add task to this group"
          @click.stop="emit('addTaskToGroup', group.key, props.groupBy)"
        >
          <Plus :size="14" />
        </button>
        <button
          class="group-ai-btn"
          title="Smart Suggest all tasks in group (AI)"
          @click.stop="handleGroupAISuggest($event, group)"
        >
          <Zap :size="14" />
        </button>
        <span v-if="isDragging" class="group-drop-hint">
          <ArrowDownToLine :size="14" />
        </span>
      </div>

      <!-- TASK-1455: Group Tasks with native DnD for cross-group transfer -->
      <div
        v-if="groupBy !== 'none' && expandedGroups.has(group.key)"
        class="group-tasks-area"
        :data-group-key="group.key"
        @dragover.prevent.capture="onGroupDragOver($event, group)"
        @dragleave.capture="onGroupDragLeave($event)"
        @drop.prevent.capture="onGroupDrop($event, group)"
      >
        <!-- Drop indicator line -->
        <div
          v-if="dropIndicator.groupKey === group.key"
          class="drop-indicator-line"
          :style="{ top: dropIndicator.y + 'px' }"
        />
        <HierarchicalTaskRow
          v-for="task in group.parentTasks"
          :key="task.id"
          :task="task"
          :indent-level="0"
          :selected="selectedTaskIds.includes(task.id)"
          :selection-mode="selectionMode"
          :checked="selectedTaskIds.includes(task.id)"
          :expanded-tasks="expandedTasks"
          :data-task-id="task.id"
          @select="handleSelect"
          @check="toggleTaskSelect"
          @toggle-complete="$emit('toggleComplete', $event)"
          @ai-suggest="handleAISuggest"
          @start-timer="$emit('startTimer', $event)"
          @edit="$emit('edit', $event)"
          @context-menu="handleContextMenu"
          @toggle-expand="toggleTaskExpand"
          @move-task="handleMoveTask"
          @update-task="(taskId: string, updates: Partial<Task>) => $emit('updateTask', taskId, updates)"
        />
      </div>
      <!-- Ungrouped mode: virtual scroll for large lists, standard for small -->
      <template v-else-if="groupBy === 'none'">
        <!-- Virtual scroll path: 50+ tasks, no expanded subtrees -->
        <div
          v-if="group.key === 'all' && useVirtual"
          v-bind="containerProps"
          class="group-tasks-area group-tasks-area--virtual"
        >
          <div v-bind="wrapperProps">
            <HierarchicalTaskRow
              v-for="{ data: task } in virtualTaskList"
              :key="task.id"
              :task="task"
              :indent-level="0"
              :selected="selectedTaskIds.includes(task.id)"
              :selection-mode="selectionMode"
              :checked="selectedTaskIds.includes(task.id)"
              :expanded-tasks="expandedTasks"
              @select="handleSelect"
              @check="toggleTaskSelect"
              @toggle-complete="$emit('toggleComplete', $event)"
              @ai-suggest="handleAISuggest"
              @start-timer="$emit('startTimer', $event)"
              @edit="$emit('edit', $event)"
              @context-menu="handleContextMenu"
              @toggle-expand="toggleTaskExpand"
              @move-task="handleMoveTask"
              @update-task="(taskId: string, updates: Partial<Task>) => $emit('updateTask', taskId, updates)"
            />
          </div>
        </div>
        <!-- Standard path: < 50 tasks or subtrees expanded -->
        <div v-else class="group-tasks-area">
          <HierarchicalTaskRow
            v-for="task in group.parentTasks"
            :key="task.id"
            :task="task"
            :indent-level="0"
            :selected="selectedTaskIds.includes(task.id)"
            :selection-mode="selectionMode"
            :checked="selectedTaskIds.includes(task.id)"
            :expanded-tasks="expandedTasks"
            @select="handleSelect"
            @check="toggleTaskSelect"
            @toggle-complete="$emit('toggleComplete', $event)"
            @ai-suggest="handleAISuggest"
            @start-timer="$emit('startTimer', $event)"
            @edit="$emit('edit', $event)"
            @context-menu="handleContextMenu"
            @toggle-expand="toggleTaskExpand"
            @move-task="handleMoveTask"
            @update-task="(taskId: string, updates: Partial<Task>) => $emit('updateTask', taskId, updates)"
          />
        </div>
      </template>
    </div>

    <!-- Empty State -->
    <div v-if="groups.length === 0" class="empty-state">
      <Inbox :size="48" class="empty-icon" />
      <p class="empty-title">
        No tasks found
      </p>
      <p class="empty-description">
        {{ emptyMessage || 'Create your first task to get started' }}
      </p>
    </div>

    <!-- AI Smart Suggest Popover -->
    <AITaskAssistPopover
      :is-visible="showAIPopover"
      :task="aiPopoverTask"
      :x="aiPopoverX"
      :y="aiPopoverY"
      context="context-menu"
      :auto-trigger="aiPopoverAutoTrigger"
      :selected-task-ids="aiPopoverGroupTaskIds"
      @close="closeAIPopover"
      @accept-smart-suggest="handleAcceptSmartSuggest"
      @accept-smart-suggest-group="handleAcceptSmartSuggestGroup"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useVirtualList } from '@vueuse/core'
import type { Task, TaskGroup } from '@/types/tasks'
import HierarchicalTaskRow from '@/components/tasks/HierarchicalTaskRow.vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import AITaskAssistPopover from '@/components/ai/AITaskAssistPopover.vue'
import { useDragAndDrop, type DragData } from '@/composables/useDragAndDrop'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { useTaskStore } from '@/stores/tasks'
import { Inbox, ChevronRight, ChevronUp, ChevronDown, Pencil, Trash2, X, Zap, ArrowDownToLine, Plus } from 'lucide-vue-next'

interface Props {
  tasks: Task[]
  groups: TaskGroup[]
  groupBy: string
  emptyMessage?: string
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  density?: 'compact' | 'comfortable' | 'spacious'
}

const props = withDefaults(defineProps<Props>(), {
  emptyMessage: '',
  sortBy: undefined,
  sortDirection: undefined,
  density: 'comfortable'
})

const emit = defineEmits<{
  select: [taskId: string]
  toggleComplete: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  moveTask: [taskId: string, targetProjectId: string | null, targetParentId: string | null]
  updateTask: [taskId: string, updates: Partial<Task>]
  batchEdit: [taskIds: string[]]
  deleteSelected: [taskIds: string[]]
  addTaskToGroup: [groupKey: string, groupBy: string]
  reorder: []
  'update:sortBy': [value: string]
  'update:sortDirection': [value: 'asc' | 'desc']
}>()

// Expand/collapse state
const expandedTasks = ref<Set<string>>(new Set())
const expandedGroups = ref<Set<string>>(new Set())
const selectedTaskIds = ref<string[]>([])

// --- Virtual Scrolling ---
const VIRTUAL_THRESHOLD = 50
const ROW_HEIGHTS: Record<string, number> = { compact: 36, comfortable: 44, spacious: 56 }
const rowHeight = computed(() => ROW_HEIGHTS[props.density ?? 'comfortable'])

const useVirtual = computed(() =>
  props.groupBy === 'none' &&
  props.tasks.length >= VIRTUAL_THRESHOLD &&
  expandedTasks.value.size === 0
)

const flatTasksForVirtual = computed(() => {
  if (!useVirtual.value) return []
  return props.groups[0]?.parentTasks ?? []
})

const { list: virtualTaskList, containerProps, wrapperProps } = useVirtualList(
  flatTasksForVirtual,
  {
    itemHeight: () => rowHeight.value,
    overscan: 5
  }
)

function handleSort(field: string) {
  if (props.sortBy === field) {
    emit('update:sortDirection', props.sortDirection === 'asc' ? 'desc' : 'asc')
  } else {
    emit('update:sortBy', field)
    emit('update:sortDirection', 'asc')
  }
}

// BUG-1493: Persist collapsed group keys so state survives navigation.
// We store the COLLAPSED keys (smaller set since groups are expanded by default).
const collapsedGroupKeys = usePersistentRef<string[]>('flowstate:catalog-collapsed-groups', [])

// Sync current expanded state → persisted collapsed list
const persistCollapsedState = () => {
  const allKeys = props.groups.map(g => g.key)
  collapsedGroupKeys.value = allKeys.filter(k => !expandedGroups.value.has(k))
}

const toggleTaskExpand = (taskId: string) => {
  if (expandedTasks.value.has(taskId)) {
    expandedTasks.value.delete(taskId)
  } else {
    expandedTasks.value.add(taskId)
  }
}

const toggleGroupExpand = (groupKey: string) => {
  if (expandedGroups.value.has(groupKey)) {
    expandedGroups.value.delete(groupKey)
  } else {
    expandedGroups.value.add(groupKey)
  }
  persistCollapsedState()
}

// Expand/collapse all functionality
const expandAll = () => {
  // Expand all groups
  props.groups.forEach(group => {
    expandedGroups.value.add(group.key)
  })
  // Persist: no groups are collapsed
  collapsedGroupKeys.value = []

  // Expand all tasks with subtasks
  props.tasks.forEach(task => {
    if (task.subtasks && task.subtasks.length > 0) {
      expandedTasks.value.add(task.id)
    }
  })
}

const collapseAll = () => {
  expandedTasks.value.clear()
  expandedGroups.value.clear()
  // Persist: all current groups are collapsed
  collapsedGroupKeys.value = props.groups.map(g => g.key)
}

// Context menu handler
const handleContextMenu = (event: MouseEvent, task: Task) => {
  // BUG-1529: Clear stale multi-selection when right-clicking a task
  // that isn't part of the current selection
  if (!selectedTaskIds.value.includes(task.id)) {
    clearSelection()
  }
  emit('contextMenu', event, task)
}

// TASK-1455: Drop indicator state for native DnD cross-group transfer
const dropIndicator = ref<{ groupKey: string | null; y: number; insertIndex: number }>({
  groupKey: null, y: 0, insertIndex: 0
})

// --- Drag to Group Header ---
const { isDragging, dragData, endDrag } = useDragAndDrop()
const taskStore = useTaskStore()

// TASK-1476: Allow dropping on collapsed group headers
const headerDropTarget = ref<string | null>(null)

// Multi-drag: when dragging a selected task, augment shared dragData with all selected IDs
const augmentDragWithSelection = () => {
  if (selectedTaskIds.value.length < 2) return
  // The child's handleDragStart runs first (capture phase, but child fires synchronously).
  // After it sets dragData, we augment it with the full selection.
  requestAnimationFrame(() => {
    if (dragData.value?.taskId && selectedTaskIds.value.includes(dragData.value.taskId)) {
      dragData.value.taskIds = [...selectedTaskIds.value]
      dragData.value.title = `${selectedTaskIds.value.length} tasks`
    }
  })
}

const onHeaderDragOver = (event: DragEvent, group: TaskGroup) => {
  if (!isDragging.value) return
  headerDropTarget.value = group.key
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const onHeaderDragLeave = (event: DragEvent) => {
  const related = event.relatedTarget as HTMLElement | null
  const container = event.currentTarget as HTMLElement
  if (!related || !container.contains(related)) {
    headerDropTarget.value = null
  }
}

// BUG-1493: Resolve drag data from composable state, falling back to dataTransfer
// payload in case the singleton was cleared before the drop event fired.
const resolveDragTaskIds = (event: DragEvent): string[] => {
  let data: DragData | null = dragData.value
  if (!data && event.dataTransfer) {
    try {
      const raw = event.dataTransfer.getData('application/json')
      if (raw) data = JSON.parse(raw) as DragData
    } catch { /* ignore */ }
  }
  return data?.taskIds ?? (data?.taskId ? [data.taskId] : [])
}

const onHeaderDrop = (event: DragEvent, group: TaskGroup) => {
  event.stopPropagation()
  headerDropTarget.value = null

  const taskIds = resolveDragTaskIds(event)
  if (taskIds.length === 0) return

  for (const id of taskIds) {
    applyGroupTransfer(id, group)
  }
  endDrag()
}

// BUG-1415: When grouped, dropping a task on another task should transfer it
// to the target's group (updating dueDate/status/priority/project) instead of
// making it a subtask. Only make subtasks when ungrouped (groupBy === 'none').
const handleMoveTask = (taskId: string, targetProjectId: string | null, targetParentId: string | null) => {
  // Multi-drag: move all selected tasks if the dragged task is part of a selection
  const taskIds = dragData.value?.taskIds?.includes(taskId) ? dragData.value.taskIds : [taskId]
  console.log('[DND-GROUP] handleMoveTask', { taskIds, targetProjectId, targetParentId, groupBy: props.groupBy })

  if (props.groupBy !== 'none' && targetParentId) {
    // Find which group the drop-target task belongs to
    const targetGroup = props.groups.find(g =>
      g.tasks.some(t => t.id === targetParentId)
    )
    if (targetGroup) {
      console.log('[DND-GROUP] Transferring to group:', { groupKey: targetGroup.key, groupTitle: targetGroup.title })
      for (const id of taskIds) {
        if (id !== targetParentId) applyGroupTransfer(id, targetGroup)
      }
      endDrag()
      return
    }
    console.warn('[DND-GROUP] Could not find target group for parentId:', targetParentId)
  }
  for (const id of taskIds) {
    emit('moveTask', id, targetProjectId, targetParentId)
  }
}

// Format a local Date to YYYY-MM-DD string using LOCAL timezone (not UTC)
const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// BUG-1415: Transfer a task into a group by updating the relevant property
const applyGroupTransfer = (taskId: string, group: TaskGroup) => {
  console.log('[DND-GROUP] applyGroupTransfer', { taskId, groupKey: group.key, groupBy: props.groupBy })
  if (props.groupBy === 'project') {
    const projectId = (group.key === 'uncategorized' || group.key === '__no_project__') ? null : group.key
    emit('moveTask', taskId, projectId, null)
  } else if (props.groupBy === 'status') {
    emit('updateTask', taskId, { status: group.key as Task['status'] })
  } else if (props.groupBy === 'priority') {
    emit('updateTask', taskId, { priority: group.key as Task['priority'] })
  } else if (props.groupBy === 'dueDate') {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))

    const dateMap: Record<string, string | null> = {
      overdue: formatLocalDate(today), // Move overdue → today
      today: formatLocalDate(today),
      tomorrow: formatLocalDate(tomorrow),
      thisWeek: formatLocalDate(endOfWeek),
      later: formatLocalDate(new Date(today.getTime() + 14 * 86400000)),
      noDate: null
    }
    console.log('[DND-GROUP] dueDate mapping', { groupKey: group.key, resolvedDate: dateMap[group.key], today: formatLocalDate(today) })
    if (group.key in dateMap) {
      const newDate = dateMap[group.key]
      emit('updateTask', taskId, { dueDate: newDate ?? undefined })
    } else if (group.key.startsWith('day-')) {
      // Per-day bucket keys: "day-YYYY-MM-DD"
      const dateStr = group.key.slice(4) // Remove "day-" prefix
      emit('updateTask', taskId, { dueDate: dateStr })
    } else {
      console.warn('[DND-GROUP] Unknown dueDate group key:', group.key)
    }
  }
}
// TASK-1455: Native DnD handlers for cross-group transfer with drop indicator

const onGroupDragOver = (event: DragEvent, group: TaskGroup) => {
  if (!isDragging.value) return

  const container = event.currentTarget as HTMLElement
  const containerRect = container.getBoundingClientRect()
  const mouseY = event.clientY

  // Find the insert position by checking each task row
  const rows = Array.from(container.querySelectorAll('[data-task-id]')) as HTMLElement[]
  let insertIndex = rows.length // default: end
  let indicatorY = containerRect.height // relative to container

  for (let i = 0; i < rows.length; i++) {
    const rowRect = rows[i].getBoundingClientRect()
    const rowMidY = rowRect.top + rowRect.height / 2
    if (mouseY < rowMidY) {
      insertIndex = i
      indicatorY = rowRect.top - containerRect.top
      break
    }
  }

  // If past all rows, place indicator at the bottom of last row
  if (insertIndex === rows.length && rows.length > 0) {
    const lastRect = rows[rows.length - 1].getBoundingClientRect()
    indicatorY = lastRect.bottom - containerRect.top
  }

  dropIndicator.value = { groupKey: group.key, y: indicatorY, insertIndex }
}

const onGroupDragLeave = (event: DragEvent) => {
  // Only clear if actually leaving the container (not entering a child)
  const related = event.relatedTarget as HTMLElement | null
  const container = event.currentTarget as HTMLElement
  if (!related || !container.contains(related)) {
    dropIndicator.value = { groupKey: null, y: 0, insertIndex: 0 }
  }
}

const onGroupDrop = async (event: DragEvent, group: TaskGroup) => {
  const taskIds = resolveDragTaskIds(event)
  const insertIdx = dropIndicator.value.insertIndex

  // Clear indicator immediately
  dropIndicator.value = { groupKey: null, y: 0, insertIndex: 0 }

  if (taskIds.length === 0) return

  // Prevent the row-level drop handler from also firing (it would make a subtask)
  event.stopPropagation()

  // Apply group transfer for all dragged tasks
  const draggedSet = new Set(taskIds)
  for (const id of taskIds) {
    applyGroupTransfer(id, group)
  }

  // Persist order: place the dropped tasks at the insert position
  const groupTasks = [...group.parentTasks.filter(t => !draggedSet.has(t.id))]
  const draggedTasks = taskIds.map(id => ({ id } as Task))
  groupTasks.splice(insertIdx, 0, ...draggedTasks)
  const allTasks = props.tasks
  const orderUpdates = groupTasks
    .map((t, i) => ({ task: allTasks.find(at => at.id === t.id), id: t.id, order: i }))
    .filter(({ task, order }) => !task || task.order !== order)
    .map(({ id, order }) => ({ id, updates: { order } }))

  if (orderUpdates.length > 0) {
    await taskStore.bulkUpdateTasksWithUndo(orderUpdates, 'Reorder task group')
  }

  emit('reorder')
  endDrag()
}

// --- AI Smart Suggest Popover ---
const showAIPopover = ref(false)
const aiPopoverX = ref(0)
const aiPopoverY = ref(0)
const aiPopoverTask = ref<Task | null>(null)
const aiPopoverAutoTrigger = ref<string | null>(null)
const aiPopoverGroupTaskIds = ref<string[]>([])

const handleAISuggest = (event: MouseEvent, task: Task) => {
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  aiPopoverX.value = rect.right + 4
  aiPopoverY.value = rect.top
  aiPopoverTask.value = task
  aiPopoverAutoTrigger.value = 'smartSuggest'
  aiPopoverGroupTaskIds.value = []
  showAIPopover.value = true
}

const handleGroupAISuggest = (event: MouseEvent, group: TaskGroup) => {
  event.stopPropagation()
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  aiPopoverX.value = rect.right + 4
  aiPopoverY.value = rect.top
  const taskIds = (group.tasks || []).map(t => t.id)
  if (taskIds.length === 0) return
  // For group mode, set the first task as context and pass all IDs
  aiPopoverTask.value = group.tasks[0] || null
  aiPopoverAutoTrigger.value = 'smartSuggestGroup'
  aiPopoverGroupTaskIds.value = taskIds
  showAIPopover.value = true
}

const closeAIPopover = () => {
  showAIPopover.value = false
  aiPopoverTask.value = null
  aiPopoverAutoTrigger.value = null
  aiPopoverGroupTaskIds.value = []
}

const handleAcceptSmartSuggest = async (updates: Array<{ field: string; value: string | number }>) => {
  if (!aiPopoverTask.value) return
  const taskId = aiPopoverTask.value.id
  const updateObj: Partial<Task> = {}
  for (const u of updates) {
    if (u.field === 'priority') updateObj.priority = u.value as Task['priority']
    else if (u.field === 'dueDate') updateObj.dueDate = String(u.value)
    else if (u.field === 'status') updateObj.status = u.value as Task['status']
    else if (u.field === 'estimatedDuration') updateObj.estimatedDuration = Number(u.value)
  }
  emit('updateTask', taskId, updateObj)
}

const handleAcceptSmartSuggestGroup = async (updates: Array<{ taskId: string; fields: Array<{ field: string; value: string | number }> }>) => {
  for (const item of updates) {
    const updateObj: Partial<Task> = {}
    for (const u of item.fields) {
      if (u.field === 'priority') updateObj.priority = u.value as Task['priority']
      else if (u.field === 'dueDate') updateObj.dueDate = String(u.value)
      else if (u.field === 'status') updateObj.status = u.value as Task['status']
      else if (u.field === 'estimatedDuration') updateObj.estimatedDuration = Number(u.value)
    }
    emit('updateTask', item.taskId, updateObj)
  }
}

// --- Bulk Selection ---
const selectionMode = computed(() => selectedTaskIds.value.length > 0)

const allTasks = computed(() => {
  return props.groups.flatMap(g => g.parentTasks || [])
})

const allSelected = computed(() => {
  return allTasks.value.length > 0 && selectedTaskIds.value.length === allTasks.value.length
})

const someSelected = computed(() => {
  return selectedTaskIds.value.length > 0 && selectedTaskIds.value.length < allTasks.value.length
})

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedTaskIds.value = []
  } else {
    selectedTaskIds.value = allTasks.value.map(t => t.id)
  }
}

const toggleTaskSelect = (taskId: string) => {
  const index = selectedTaskIds.value.indexOf(taskId)
  if (index > -1) {
    selectedTaskIds.value.splice(index, 1)
  } else {
    selectedTaskIds.value.push(taskId)
  }
}

const clearSelection = () => {
  selectedTaskIds.value = []
}

// Group-level selection
const isGroupAllSelected = (group: TaskGroup) => {
  const ids = (group.parentTasks || []).map(t => t.id)
  return ids.length > 0 && ids.every(id => selectedTaskIds.value.includes(id))
}

const isGroupPartiallySelected = (group: TaskGroup) => {
  const ids = (group.parentTasks || []).map(t => t.id)
  const selectedCount = ids.filter(id => selectedTaskIds.value.includes(id)).length
  return selectedCount > 0 && selectedCount < ids.length
}

const toggleGroupSelect = (group: TaskGroup) => {
  const ids = (group.parentTasks || []).map(t => t.id)
  if (isGroupAllSelected(group)) {
    // Deselect all in this group
    selectedTaskIds.value = selectedTaskIds.value.filter(id => !ids.includes(id))
  } else {
    // Select all in this group
    const newIds = ids.filter(id => !selectedTaskIds.value.includes(id))
    selectedTaskIds.value.push(...newIds)
  }
}

// Handle row click: if in selection mode, toggle selection; otherwise normal select
const handleSelect = (taskId: string) => {
  if (selectionMode.value) {
    toggleTaskSelect(taskId)
  } else {
    emit('select', taskId)
  }
}

// Keyboard shortcuts for bulk selection
const handleKeyDown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedTaskIds.value.length > 0) {
    event.preventDefault()
    emit('deleteSelected', [...selectedTaskIds.value])
  } else if (event.key === 'Escape' && selectionMode.value) {
    clearSelection()
  }
}

// TASK-1470: Global Ctrl+/ shortcut → open AI Assist popover for the targeted task
const handleOpenAIAssist = (event: Event) => {
  const taskId = (event as CustomEvent<{ taskId: string | null }>).detail?.taskId
  if (!taskId) return
  // Find the task across all groups
  const task = props.tasks.find(t => t.id === taskId)
  if (!task) return
  // Try to find the row element for positioning
  nextTick(() => {
    const rowEl = document.querySelector<HTMLElement>(`[data-task-id="${taskId}"] .task-row__action-btn--ai`)
    if (rowEl) {
      const rect = rowEl.getBoundingClientRect()
      aiPopoverX.value = rect.right + 4
      aiPopoverY.value = rect.top
    } else {
      // Fallback: center of viewport
      aiPopoverX.value = window.innerWidth / 2 - 160
      aiPopoverY.value = window.innerHeight / 2 - 200
    }
    aiPopoverTask.value = task
    aiPopoverAutoTrigger.value = 'smartSuggest'
    aiPopoverGroupTaskIds.value = []
    showAIPopover.value = true
  })
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  window.addEventListener('open-ai-assist', handleOpenAIAssist)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('open-ai-assist', handleOpenAIAssist)
})

// BUG-1493: Initialize respecting persisted collapsed state.
// Groups not in the collapsed set are expanded (default: all expanded).
const initialCollapsedSet = new Set(collapsedGroupKeys.value)
expandedGroups.value = new Set(props.groups.filter(g => !initialCollapsedSet.has(g.key)).map(g => g.key))

// Auto-expand new groups when they appear, unless they were explicitly collapsed
watch(() => props.groups, (newGroups, oldGroups) => {
  const oldKeys = new Set(oldGroups?.map(g => g.key) || [])
  const persistedCollapsed = new Set(collapsedGroupKeys.value)
  newGroups.forEach(group => {
    if (!oldKeys.has(group.key) && !persistedCollapsed.has(group.key)) {
      expandedGroups.value.add(group.key)
    }
  })
}, { deep: true })

// Expose methods for parent component
defineExpose({
  expandAll,
  collapseAll,
  clearSelection,
  selectedTaskIds
})
</script>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: transparent;
  border: none;
  border-radius: 0;
  padding: var(--space-2);
  overflow-y: visible;
  min-height: 0;
  flex: 1;
}

/* Density variants — set CSS custom properties inherited by .task-row in HierarchicalTaskRow.css */
.task-list--compact {
  --row-min-height: 36px;
  --row-padding-v: var(--space-0_5);
  --row-padding-h: var(--space-2);
  font-size: var(--text-sm);
}

.task-list--comfortable {
  --row-min-height: 44px;
  --row-padding-v: var(--space-1);
  --row-padding-h: var(--space-2);
}

.task-list--spacious {
  --row-min-height: 56px;
  --row-padding-v: var(--space-2);
  --row-padding-h: var(--space-3);
}

/* Density-aware column headers */
.task-list--compact .column-headers {
  padding: var(--space-0_5) var(--space-2);
}

.task-list--spacious .column-headers {
  padding: var(--space-2) var(--space-3);
}

/* Virtual scroll container */
.group-tasks-area--virtual {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

/* TASK-1334: Group containers */
.task-group {
  margin-bottom: var(--space-4);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  /* No overflow:hidden — TaskRowDueDate dropdown uses position:absolute */
}

.task-group--indented {
  margin-inline-start: var(--space-6);
  margin-bottom: var(--space-2);
}

.task-group--drop-active {
  box-shadow: inset 0 0 0 1px var(--brand-primary);
  background: rgba(45, 212, 191, 0.05);
}

.task-group:last-child {
  margin-bottom: 0;
}

/* TASK-1334: Sticky group header */
.group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  /* OPAQUE — sticky header; blur removed (flat mode) so it must be solid
     or rows scroll through it and overlap the labels (TASK-1791b). */
  background-color: var(--surface-secondary);
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;
  position: sticky;
  top: 0;
  z-index: 2;
}

.group-header:hover {
  background-color: var(--surface-tertiary);
}

.group-header--drop-target {
  background-color: var(--brand-primary-subtle);
  border-bottom-color: var(--brand-primary);
  box-shadow: inset 0 0 0 1px var(--brand-primary);
}

.group-expand-icon {
  color: var(--text-tertiary);
  transition: transform var(--duration-fast) ease;
  flex-shrink: 0;
}

.group-expand-icon--expanded {
  transform: rotate(90deg);
}

.group-name {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  flex: 1;
}

.group-task-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  padding: 0 var(--space-1_5);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
}

.group-select-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.group-select-checkbox input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1.5px solid var(--glass-border, rgba(255, 255, 255, 0.12));
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
}

.group-select-checkbox input[type="checkbox"]:checked {
  border-color: var(--brand-primary);
  background: rgba(45, 212, 191, 0.13);
}

.group-select-checkbox input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  color: var(--brand-primary);
}

.group-select-checkbox input[type="checkbox"]:indeterminate {
  border-color: var(--brand-primary);
  background: rgba(45, 212, 191, 0.13);
}

.group-select-checkbox input[type="checkbox"]:indeterminate::after {
  content: '—';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  color: var(--brand-primary);
}

.group-ai-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  opacity: 0;
  flex-shrink: 0;
}

.group-header:hover .group-ai-btn {
  opacity: 1;
}

.group-ai-btn:hover {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  background: var(--glass-bg-medium);
}

.group-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
}

.group-add-btn:hover {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  background: var(--glass-bg-medium);
}

.group-color-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-icon {
  color: var(--text-tertiary);
  margin-bottom: var(--space-4);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.empty-description {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
}

/* Column Headers */
.column-headers {
  display: grid;
  grid-template-columns: 52px 1fr 40px 120px 72px 96px 72px 72px 112px;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-1) var(--space-2);
  position: sticky;
  top: 0;
  z-index: 3;
  /* OPAQUE — see .group-header note (TASK-1791b) */
  background: var(--surface-primary);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Selection mode header layout */
.column-headers--selection {
  grid-template-columns: 28px 1fr;
}

.select-all-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.select-all-checkbox input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1.5px solid var(--glass-border, rgba(255, 255, 255, 0.12));
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
}

.select-all-checkbox input[type="checkbox"]:checked {
  border-color: var(--brand-primary);
  background: rgba(45, 212, 191, 0.13);
}

.select-all-checkbox input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  color: var(--brand-primary);
}

.select-all-checkbox input[type="checkbox"]:indeterminate {
  border-color: var(--brand-primary);
  background: rgba(45, 212, 191, 0.13);
}

.select-all-checkbox input[type="checkbox"]:indeterminate::after {
  content: '—';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  color: var(--brand-primary);
}

.task-total-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  margin-inline-start: var(--space-1);
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
}

.bulk-actions-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.selection-count {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--brand-primary);
  white-space: nowrap;
  text-transform: none;
  letter-spacing: normal;
}

.sortable-header {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  user-select: none;
  transition: color 0.15s ease;
  border-radius: var(--radius-sm);
  padding: 2px 4px;
  margin: -2px -4px;
}

.sortable-header:hover {
  color: var(--text-primary);
}

.sortable-header--active {
  color: var(--brand-primary);
}

.sort-indicator {
  opacity: 0.7;
  flex-shrink: 0;
}

.bulk-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-0_5) var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
  text-transform: none;
  letter-spacing: normal;
}

.bulk-action-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--border-emphasis);
}

.bulk-action-btn--edit:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.bulk-action-btn--delete:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.bulk-action-btn--clear:hover {
  border-color: var(--text-muted);
}

/* Drop hint icon — visible only during active drag (controlled by v-if) */
.group-drop-hint {
  display: flex;
  align-items: center;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* TASK-1455: Native DnD drop indicator */
.group-tasks-area {
  position: relative;
}

.drop-indicator-line {
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--brand-primary);
  border-radius: 1px;
  pointer-events: none;
  z-index: 10;
  transition: top 0.1s ease;
}
</style>
