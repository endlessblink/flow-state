<template>
  <div class="task-list">
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
        <span>Task <span class="task-total-count">{{ tasks.length }}</span></span>
        <span />
        <span>Status</span>
        <span>Priority</span>
        <span>Due</span>
        <span>Progress</span>
        <span>Est.</span>
        <span />
      </template>
    </div>

    <!-- TASK-1334: Grouped rendering with sticky headers -->
    <div
      v-for="group in groups"
      :key="group.key"
      class="task-group"
      :class="{ 'task-group--indented': (group.indent || 0) > 0 }"
    >
      <!-- Sticky Group Header -->
      <div
        v-if="groupBy !== 'none'"
        class="group-header"
        :class="{ 'group-header--drop-target': dropTargetGroup === group.key }"
        :style="(group.indent || 0) > 0 ? { paddingLeft: `${12 + (group.indent || 0) * 24}px` } : undefined"
        @click="toggleGroupExpand(group.key)"
        @dragover.prevent="handleGroupDragOver($event, group)"
        @dragleave="handleGroupDragLeave"
        @drop.prevent="handleGroupDrop($event, group)"
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
          class="group-ai-btn"
          title="Smart Suggest all tasks in group (AI)"
          @click.stop="handleGroupAISuggest($event, group)"
        >
          <Zap :size="14" />
        </button>
        <span class="group-drop-hint">
          <ArrowDownToLine :size="14" />
        </span>
      </div>

      <!-- Group Tasks (only parent tasks, subtasks rendered recursively) -->
      <template v-if="groupBy === 'none' || expandedGroups.has(group.key)">
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { Task, TaskGroup } from '@/types/tasks'
import HierarchicalTaskRow from '@/components/tasks/HierarchicalTaskRow.vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import AITaskAssistPopover from '@/components/ai/AITaskAssistPopover.vue'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { Inbox, ChevronRight, Pencil, Trash2, X, Zap, ArrowDownToLine } from 'lucide-vue-next'

interface Props {
  tasks: Task[]
  groups: TaskGroup[]
  groupBy: string
  emptyMessage?: string
}

const props = defineProps<Props>()

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
}>()

// Expand/collapse state
const expandedTasks = ref<Set<string>>(new Set())
const expandedGroups = ref<Set<string>>(new Set())
const selectedTaskIds = ref<string[]>([])

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
}

// Expand/collapse all functionality
const expandAll = () => {
  // Expand all groups
  props.groups.forEach(group => {
    expandedGroups.value.add(group.key)
  })

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
}

// Context menu handler
const handleContextMenu = (event: MouseEvent, task: Task) => {
  emit('contextMenu', event, task)
}

// Drag and drop handler
const handleMoveTask = (taskId: string, targetProjectId: string | null, targetParentId: string | null) => {
  emit('moveTask', taskId, targetProjectId, targetParentId)
}

// --- Drag to Group Header ---
const { endDrag } = useDragAndDrop()
const dropTargetGroup = ref<string | null>(null)

const handleGroupDragOver = (event: DragEvent, group: TaskGroup) => {
  event.dataTransfer!.dropEffect = 'move'
  dropTargetGroup.value = group.key
}

const handleGroupDragLeave = () => {
  dropTargetGroup.value = null
}

const handleGroupDrop = (event: DragEvent, group: TaskGroup) => {
  dropTargetGroup.value = null
  const raw = event.dataTransfer?.getData('application/json')
  if (!raw) return
  let taskId: string
  try {
    const data = JSON.parse(raw)
    taskId = data.taskId
  } catch { return }
  if (!taskId) return

  // Determine what property to update based on groupBy
  if (props.groupBy === 'project' && group.key) {
    const projectId = (group.key === 'uncategorized' || group.key === '__no_project__') ? null : group.key
    emit('moveTask', taskId, projectId, null)
  } else if (props.groupBy === 'status' && group.key) {
    emit('updateTask', taskId, { status: group.key as any })
  } else if (props.groupBy === 'priority' && group.key) {
    emit('updateTask', taskId, { priority: group.key as any })
  } else if (props.groupBy === 'dueDate' && group.key) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    const dateMap: Record<string, string | null> = {
      today: formatDate(today),
      tomorrow: formatDate(tomorrow),
      thisWeek: formatDate(endOfWeek),
      later: formatDate(new Date(today.getTime() + 14 * 86400000)),
      noDate: null
    }
    // 'overdue' intentionally excluded — can't set a past due date

    if (group.key in dateMap) {
      const newDate = dateMap[group.key]
      emit('updateTask', taskId, { dueDate: newDate ?? undefined })
    }
  }

  // Clean up drag ghost — the original task row may be destroyed by Vue re-render
  // before dragend fires, so we must clean up here
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

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

// Initialize with all groups expanded by default
expandedGroups.value = new Set(props.groups.map(g => g.key))

// Auto-expand new groups when they appear
watch(() => props.groups, (newGroups, oldGroups) => {
  const oldKeys = new Set(oldGroups?.map(g => g.key) || [])
  newGroups.forEach(group => {
    if (!oldKeys.has(group.key)) {
      expandedGroups.value.add(group.key)
    }
  })
}, { deep: true })

// Expose methods for parent component
defineExpose({
  expandAll,
  collapseAll,
  clearSelection
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

/* TASK-1334: Group containers */
.task-group {
  margin-bottom: var(--space-4);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  /* No overflow:hidden — TaskRowDueDate dropdown uses position:absolute */
}

.task-group--indented {
  margin-left: var(--space-6);
  margin-bottom: var(--space-2);
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
  background-color: var(--glass-bg-heavy);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;
  position: sticky;
  top: 0;
  z-index: 2;
}

.group-header:hover {
  background-color: var(--surface-hover);
}

.group-header--drop-target {
  background-color: rgba(78, 205, 196, 0.1);
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
  width: 14px;
  height: 14px;
  accent-color: var(--brand-primary);
  cursor: pointer;
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
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
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
  width: 16px;
  height: 16px;
  accent-color: var(--brand-primary);
  cursor: pointer;
}

.task-total-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  margin-left: var(--space-1);
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

/* Drop hint icon — visible only during active drag */
.group-drop-hint {
  display: none;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

:global(body.dragging-active) .group-drop-hint {
  display: flex;
  align-items: center;
  animation: pulse-hint 1.5s ease-in-out infinite;
}

@keyframes pulse-hint {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}
</style>
