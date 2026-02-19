<template>
  <div class="task-table" :class="`task-table--${density}`">
    <!-- Table Header with Bulk Actions -->
    <div class="table-header">
      <div class="header-cell checkbox-cell">
        <input
          type="checkbox"
          :checked="allSelected"
          :indeterminate="someSelected"
          @change="toggleSelectAll"
        >
      </div>

      <!-- Bulk Actions Bar -->
      <div v-if="selectedTasks.length > 0" class="bulk-actions-bar" :colspan="7">
        <span class="selection-count">{{ selectedTasks.length }} task{{ selectedTasks.length !== 1 ? 's' : '' }} selected</span>
        <div class="bulk-actions-buttons">
          <button
            class="bulk-action-btn delete-btn"
            title="Delete selected tasks (Ctrl+Delete)"
            @click="handleDeleteSelected"
          >
            <Trash2 :size="14" />
            {{ $t('task.delete_selected') }}
          </button>
          <button
            class="bulk-action-btn clear-btn"
            title="Clear selection"
            @click="clearSelection"
          >
            <X :size="14" />
            {{ $t('common.clear') }}
          </button>
        </div>
      </div>

      <template v-else>
        <div class="header-cell title-cell">
          {{ $t('task.header_task') }}
        </div>
        <div class="header-cell project-cell">
          {{ $t('task.header_project') }}
        </div>
        <div class="header-cell status-cell">
          {{ $t('task.header_status') }}
        </div>
        <div class="header-cell due-date-cell">
          {{ $t('task.header_due_date') }}
        </div>
        <div class="header-cell progress-cell">
          {{ $t('task.header_progress') }}
        </div>
        <div class="header-cell actions-cell">
          {{ $t('task.header_actions') }}
        </div>
      </template>
    </div>

    <!-- Virtual Scrolling for large lists (50+ items) -->
    <template v-if="useVirtual">
      <div ref="virtualContainerRef" class="table-body-virtual">
        <div class="table-body-wrapper" :style="{ height: `${totalHeight}px` }">
          <div
            v-for="{ data: task, index } in virtualList"
            :key="task.id"
            class="table-row"
            :class="{
              'row-selected': selectedTasks.includes(task.id),
              'is-dragging': draggingTaskId === task.id,
              [`priority-${task.priority || 'none'}`]: true
            }"
            :data-status="task.status"
            :style="{
              position: 'absolute',
              top: `${index * rowHeight}px`,
              left: 0,
              right: 0,
              height: `${rowHeight}px`
            }"
            draggable="true"
            @dragstart="handleTableRowDragStart($event, task)"
            @dragend="handleTableRowDragEnd"
            @click="$emit('select', task.id)"
            @contextmenu.prevent="$emit('contextMenu', $event, task)"
          >
            <!-- Priority Indicator -->
            <div v-if="task.priority" class="priority-indicator" />
            <div class="table-cell checkbox-cell" @click.stop>
              <input
                type="checkbox"
                :checked="selectedTasks.includes(task.id)"
                @change="toggleTaskSelect(task.id)"
              >
            </div>

            <div class="table-cell title-cell">
              <input
                v-if="editingTaskId === task.id && editingField === 'title'"
                type="text"
                :value="task.title"
                class="inline-edit"
                autofocus
                @blur="saveEdit(task.id, 'title', $event)"
                @keydown.enter="saveEdit(task.id, 'title', $event)"
                @keydown.esc="cancelEdit"
              >
              <span v-else :class="getTextAlignmentClasses(task.title)" @dblclick="startEdit(task.id, 'title')">
                {{ task.title }}
              </span>
            </div>

            <div class="table-cell project-cell">
              <span
                v-if="task.projectId"
                class="project-emoji-badge"
                :class="`project-visual--${getProjectVisual(task).type}`"
                :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
              >
                <ProjectEmojiIcon
                  v-if="getProjectVisual(task).type === 'emoji'"
                  :emoji="getProjectVisual(task).content"
                  size="xs"
                  :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
                  class="project-emoji"
                />
                <span
                  v-else-if="getProjectVisual(task).type === 'css-circle'"
                  class="project-emoji project-css-circle"
                  :style="{ '--project-color': getProjectVisual(task).color }"
                  :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
                />
              </span>
            </div>

            <div class="table-cell status-cell" @click.stop>
              <CustomSelect
                :model-value="task.status || 'planned'"
                :options="statusOptions"
                placeholder="Select status..."
                @update:model-value="(val) => updateTaskStatus(task.id, String(val) as Task['status'])"
              />
            </div>

            <div class="table-cell due-date-cell">
              <span v-if="task.dueDate" class="due-date">
                <Calendar :size="14" />
                {{ formatDueDate(task.dueDate) }}
              </span>
              <span v-else class="no-date">-</span>
            </div>

            <div class="table-cell progress-cell">
              <div v-if="task.progress > 0" class="progress-bar" :style="{ '--progress': `${task.progress}%` }">
                <div class="progress-bg" />
                <div class="progress-fill" />
                <span class="progress-text">{{ task.progress }}%</span>
              </div>
              <span v-else class="no-progress">-</span>
            </div>

            <div class="table-cell actions-cell">
              <button
                class="action-btn"
                title="Start Timer"
                @click.stop="$emit('startTimer', task.id)"
              >
                <Play :size="14" />
              </button>
              <button
                class="action-btn"
                title="Edit Task"
                @click.stop="$emit('edit', task.id)"
              >
                <Edit :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Standard rendering (with grouping support) -->
    <template v-else>
      <div class="table-body">
        <template v-for="group in groups" :key="group.key">
          <!-- TASK-1334: Group Header Row -->
          <div
            v-if="groupBy !== 'none'"
            class="table-group-header"
            @click="toggleTableGroupExpand(group.key)"
          >
            <ChevronRight
              :size="16"
              class="table-group-expand-icon"
              :class="{ 'table-group-expand-icon--expanded': expandedTableGroups.has(group.key) }"
            />
            <ProjectEmojiIcon v-if="group.emoji" :emoji="group.emoji" size="xs" />
            <span class="table-group-name">{{ group.title }}</span>
            <span class="table-group-count">{{ group.tasks.length }}</span>
          </div>

          <!-- Task Rows (grouped or flat) -->
          <template v-if="groupBy === 'none' || expandedTableGroups.has(group.key)">
            <div
              v-for="task in (groupBy === 'none' ? tasks : group.tasks)"
              :key="task.id"
              class="table-row"
              :class="{
                'row-selected': selectedTasks.includes(task.id),
                'is-dragging': draggingTaskId === task.id,
                [`priority-${task.priority || 'none'}`]: true
              }"
              :data-status="task.status"
              draggable="true"
              @dragstart="handleTableRowDragStart($event, task)"
              @dragend="handleTableRowDragEnd"
              @click="$emit('select', task.id)"
              @contextmenu.prevent="$emit('contextMenu', $event, task)"
            >
              <!-- Priority Indicator -->
              <div v-if="task.priority" class="priority-indicator" />
              <div class="table-cell checkbox-cell" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedTasks.includes(task.id)"
                  @change="toggleTaskSelect(task.id)"
                >
              </div>

              <div class="table-cell title-cell">
                <input
                  v-if="editingTaskId === task.id && editingField === 'title'"
                  type="text"
                  :value="task.title"
                  class="inline-edit"
                  autofocus
                  @blur="saveEdit(task.id, 'title', $event)"
                  @keydown.enter="saveEdit(task.id, 'title', $event)"
                  @keydown.esc="cancelEdit"
                >
                <span v-else :class="getTextAlignmentClasses(task.title)" @dblclick="startEdit(task.id, 'title')">
                  {{ task.title }}
                </span>
              </div>

              <div class="table-cell project-cell">
                <span
                  v-if="task.projectId"
                  class="project-emoji-badge"
                  :class="`project-visual--${getProjectVisual(task).type}`"
                  :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
                >
                  <ProjectEmojiIcon
                    v-if="getProjectVisual(task).type === 'emoji'"
                    :emoji="getProjectVisual(task).content"
                    size="xs"
                    :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
                    class="project-emoji"
                  />
                  <span
                    v-else-if="getProjectVisual(task).type === 'css-circle'"
                    class="project-emoji project-css-circle"
                    :style="{ '--project-color': getProjectVisual(task).color }"
                    :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
                  />
                </span>
              </div>

              <div class="table-cell status-cell" @click.stop>
                <CustomSelect
                  :model-value="task.status || 'planned'"
                  :options="statusOptions"
                  placeholder="Select status..."
                  @update:model-value="(val) => updateTaskStatus(task.id, String(val) as Task['status'])"
                />
              </div>

              <div class="table-cell due-date-cell">
                <span v-if="task.dueDate" class="due-date">
                  <Calendar :size="14" />
                  {{ formatDueDate(task.dueDate) }}
                </span>
                <span v-else class="no-date">-</span>
              </div>

              <div class="table-cell progress-cell">
                <div v-if="task.progress > 0" class="progress-bar" :style="{ '--progress': `${task.progress}%` }">
                  <div class="progress-bg" />
                  <div class="progress-fill" />
                  <span class="progress-text">{{ task.progress }}%</span>
                </div>
                <span v-else class="no-progress">-</span>
              </div>

              <div class="table-cell actions-cell">
                <button
                  class="action-btn"
                  title="Start Timer"
                  @click.stop="$emit('startTimer', task.id)"
                >
                  <Play :size="14" />
                </button>
                <button
                  class="action-btn"
                  title="Edit Task"
                  @click.stop="$emit('edit', task.id)"
                >
                  <Edit :size="14" />
                </button>
              </div>
            </div>
          </template>
        </template>
      </div>
    </template>

    <!-- Empty State -->
    <div v-if="tasks.length === 0" class="empty-state">
      <Inbox :size="48" class="empty-icon" />
      <p class="empty-title">
        {{ $t('task.no_tasks') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVirtualList } from '@vueuse/core'
import type { Task, TaskGroup } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'
import { Play, Edit, Calendar, Inbox, Trash2, X, ChevronRight } from 'lucide-vue-next'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
type DensityType = 'compact' | 'comfortable' | 'spacious'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import CustomSelect from '@/components/common/CustomSelect.vue'
import { useDragAndDrop } from '@/composables/useDragAndDrop'

const { t } = useI18n()

const props = defineProps<Props>() ;const emit = defineEmits<{
  select: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  updateTask: [taskId: string, updates: Partial<Task>]
}>() ;// Virtual scrolling constants
const VIRTUAL_THRESHOLD = 50 // Only virtualize if more than this many items
const OVERSCAN = 5 // Extra items to render above/below viewport

// Row heights by density
const ROW_HEIGHTS: Record<DensityType, number> = {
  compact: 40,
  comfortable: 48,
  spacious: 56
}

interface Props {
  tasks: Task[]
  groups: TaskGroup[]
  groupBy: string
  density: DensityType
}

// Status options for CustomSelect
const statusOptions = computed(() => [
  { label: t('task.status_todo'), value: 'planned' },
  { label: t('task.status_in_progress'), value: 'in_progress' },
  { label: t('task.status_done'), value: 'done' },
  { label: t('task.status_backlog'), value: 'backlog' },
  { label: t('task.status_on_hold'), value: 'on_hold' }
])

const taskStore = useTaskStore()

// Drag-to-sidebar support (matches useTaskRowActions pattern)
const { startDrag, endDrag } = useDragAndDrop()

const draggingTaskId = ref<string | null>(null)

const handleTableRowDragStart = (event: DragEvent, task: Task) => {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/json', JSON.stringify({ type: 'task', taskId: task.id }))
  event.dataTransfer.effectAllowed = 'move'

  // Unified ghost pill — startDrag creates it and calls setDragImage
  startDrag({ type: 'task', taskId: task.id, title: task.title, source: 'kanban' }, event)

  // Track which task is being dragged for visual feedback
  draggingTaskId.value = task.id
}

const handleTableRowDragEnd = () => {
  draggingTaskId.value = null
  endDrag()
}

// Hebrew text alignment support
const { getAlignmentClasses } = useHebrewAlignment()

// Helper function to get alignment classes for any text
const getTextAlignmentClasses = (text: string) => {
  return getAlignmentClasses(text)
}

const selectedTasks = ref<string[]>([])
const editingTaskId = ref<string | null>(null)
const editingField = ref<string | null>(null)

// Virtual scrolling setup
const virtualContainerRef = ref<HTMLElement | null>(null)

// Row height based on density
const rowHeight = computed(() => ROW_HEIGHTS[props.density])

// TASK-1334: Group expand/collapse state
const expandedTableGroups = ref<Set<string>>(new Set(props.groups.map(g => g.key)))

const toggleTableGroupExpand = (groupKey: string) => {
  if (expandedTableGroups.value.has(groupKey)) {
    expandedTableGroups.value.delete(groupKey)
  } else {
    expandedTableGroups.value.add(groupKey)
  }
}

// Determine if we should use virtual scrolling (disable when grouping is active)
const useVirtual = computed(() => props.groupBy === 'none' && props.tasks.length >= VIRTUAL_THRESHOLD)

// Use VueUse's useVirtualList for efficient rendering
const { list: virtualList } = useVirtualList(
  computed(() => props.tasks),
  {
    itemHeight: () => rowHeight.value,
    overscan: OVERSCAN
  }
)

// Total height for the virtual wrapper
const totalHeight = computed(() => props.tasks.length * rowHeight.value)

const allSelected = computed(() =>
  props.tasks.length > 0 && selectedTasks.value.length === props.tasks.length
)

const someSelected = computed(() =>
  selectedTasks.value.length > 0 && selectedTasks.value.length < props.tasks.length
)

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedTasks.value = []
  } else {
    selectedTasks.value = props.tasks.map(t => t.id)
  }
}

const toggleTaskSelect = (taskId: string) => {
  const index = selectedTasks.value.indexOf(taskId)
  if (index > -1) {
    selectedTasks.value.splice(index, 1)
  } else {
    selectedTasks.value.push(taskId)
  }
}

// Helper function to get project visual for a task
const getProjectVisual = (task: Task) => {
  return taskStore.getProjectVisual(task.projectId)
}

// ADHD-friendly: Human-readable date formatting
const formatDueDate = (dueDate: string | undefined) => {
  if (!dueDate) return '-'
  const date = new Date(dueDate)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return t('task.date_today')
  if (date.toDateString() === tomorrow.toDateString()) return t('task.date_tomorrow')

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const startEdit = (taskId: string, field: string) => {
  editingTaskId.value = taskId
  editingField.value = field
}

const saveEdit = (taskId: string, field: string, event: Event) => {
  const input = event.target as HTMLInputElement
  emit('updateTask', taskId, { [field]: input.value })
  cancelEdit()
}

const cancelEdit = () => {
  editingTaskId.value = null
  editingField.value = null
}

const updateTaskStatus = (taskId: string, status: Task['status']) => {
  emit('updateTask', taskId, { status })
}

// Bulk delete functionality
const { deleteTaskWithUndo } = useUnifiedUndoRedo()

const handleDeleteSelected = () => {
  if (selectedTasks.value.length === 0) return

  const count = selectedTasks.value.length
  const confirmMessage = `Delete ${count} selected task${count !== 1 ? 's' : ''}? This action can be undone.`

  if (confirm(confirmMessage)) {
    // Delete tasks one by one to maintain undo functionality
    selectedTasks.value.forEach(taskId => {
      deleteTaskWithUndo(taskId)
    })
    clearSelection()
  }
}

const clearSelection = () => {
  selectedTasks.value = []
}

// Keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  // Don't handle if typing in an input field
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return
  }

  // Delete or Backspace: Delete selected tasks (with or without Ctrl)
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedTasks.value.length > 0) {
    event.preventDefault()
    handleDeleteSelected()
  }
  // Escape to clear selection
  else if (event.key === 'Escape') {
    clearSelection()
  }
}

// TASK-1334: Auto-expand new groups
watch(() => props.groups, (newGroups, oldGroups) => {
  const oldKeys = new Set(oldGroups?.map(g => g.key) || [])
  newGroups.forEach(group => {
    if (!oldKeys.has(group.key)) {
      expandedTableGroups.value.add(group.key)
    }
  })
}, { deep: true })

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.task-table {
  display: flex;
  flex-direction: column;
  background: var(--glass-bg-light);
  backdrop-filter: var(--blur-regular);
  -webkit-backdrop-filter: var(--blur-regular);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: visible;
  box-shadow: var(--shadow-2xl);
}

.table-header {
  display: grid;
  grid-template-columns: 40px 1fr 80px 120px 120px 100px 100px;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background-color: var(--glass-bg-medium);
  border-bottom: 1px solid var(--glass-border);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* Virtual scroll body container */
.table-body-virtual {
  flex: 1;
  overflow-y: auto;
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

.table-body-wrapper {
  position: relative;
  width: 100%;
}

/* Non-virtual scroll body container */
.table-body {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

/* Bulk Actions Bar */
.bulk-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-medium);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  grid-column: 2 / -1;
  margin: var(--space-2) 0;
  backdrop-filter: var(--blur-medium);
}

.selection-count {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-primary);
}

.bulk-actions-buttons {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.bulk-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  border: 1px solid transparent;
}

.bulk-action-btn.delete-btn {
  background-color: var(--error-bg-light);
  color: var(--color-error);
  border-color: var(--error-border-subtle);
}

.bulk-action-btn.delete-btn:hover {
  background-color: var(--error-bg);
  color: white;
  border-color: var(--color-error);
  transform: translateY(-1px);
}

.bulk-action-btn.clear-btn {
  background-color: var(--glass-bg-soft);
  color: var(--text-secondary);
  border-color: var(--glass-border);
}

.bulk-action-btn.clear-btn:hover {
  background-color: var(--glass-bg-medium);
  color: var(--text-primary);
  border-color: var(--glass-border-hover);
}

/* ADHD-friendly: Taller rows with more breathing room for easier scanning */
.table-row {
  display: grid;
  grid-template-columns: 40px 1fr 80px 120px 120px 100px 100px;
  gap: var(--space-2);
  position: relative;
  padding: var(--space-3) var(--space-4);
  min-height: 52px; /* Match research recommendation for comfortable row height */
  border-bottom: 1px solid var(--glass-border);
  transition: background-color var(--duration-fast) ease;
  cursor: pointer;
  box-sizing: border-box;
}

.table-row:hover {
  background-color: var(--glass-bg-medium);
}

.table-row.is-dragging {
  opacity: 0.4;
  background: var(--glass-bg-soft);
}

.table-row.row-selected {
  background-color: rgba(78, 205, 196, 0.05);
  border-left: 2px solid var(--brand-primary);
}

/* ADHD-friendly Density Variants - Research-backed row heights */
.task-table--compact .table-header,
.task-table--compact .table-row {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  min-height: 44px; /* Compact but still scannable */
}

.task-table--comfortable .table-header,
.task-table--comfortable .table-row {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  min-height: 52px; /* Optimal for scanning */
}

.task-table--spacious .table-header,
.task-table--spacious .table-row {
  padding: var(--space-4) var(--space-5);
  font-size: var(--text-base);
  min-height: 64px; /* Maximum breathing room */
}

/* Table Cells */
.table-cell,
.header-cell {
  display: flex;
  align-items: center;
}

.checkbox-cell {
  justify-content: center;
}

.title-cell {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Enhanced project indicator styles matching canvas implementation */
.project-emoji-badge {
  background: var(--glass-bg-subtle);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--spring-smooth) ease;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.project-emoji-badge:hover {
  background: var(--brand-bg-subtle-hover);
  border-color: var(--brand-border);
  transform: translateY(-1px) translateZ(0);
  box-shadow: 0 4px 8px var(--shadow-subtle);
}

.project-emoji {
  font-size: var(--project-indicator-size-md);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateZ(0);
  transition: all var(--spring-smooth) ease;
}

.project-emoji.project-css-circle {
  width: var(--project-indicator-size-md);
  height: var(--project-indicator-size-md);
  border-radius: 50%;
  background: var(--project-color);
  box-shadow: var(--project-indicator-shadow-inset);
  position: relative;
  font-size: var(--project-indicator-font-size-md);
  color: white;
  font-weight: var(--font-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--spring-smooth) ease;
  backdrop-filter: var(--project-indicator-backdrop);
  box-shadow:
    var(--project-indicator-shadow-inset),
    var(--project-indicator-glow-strong);
}

.project-emoji-badge:hover .project-emoji.project-css-circle {
  transform: translateZ(0) scale(1.15);
  box-shadow:
    var(--project-indicator-shadow-inset),
    0 0 16px var(--project-color),
    0 0 32px var(--project-color);
}

.project-emoji-badge:hover .project-emoji.project-css-circle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle,
    var(--project-color) 0%,
    transparent 70%
  );
  opacity: 0.3;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: -1;
}

.project-emoji-badge.project-visual--css-circle {
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.project-emoji:hover {
  background: var(--brand-bg-light);
  border-color: var(--brand-border);
  color: var(--text-primary);
}

.inline-edit {
  width: 100%;
  padding: var(--space-1) var(--space-2);
  background-color: var(--glass-bg-soft);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: inherit;
  outline: none;
}

.status-select {
  padding: var(--space-1) var(--space-2);
  background-color: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}

/* Priority Indicator - Subtle left border */
.priority-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.priority-high .priority-indicator {
  background: var(--color-priority-high);
}

.priority-medium .priority-indicator {
  background: var(--color-priority-medium);
}

.priority-low .priority-indicator {
  background: var(--color-priority-low);
}

.timer-active .priority-indicator {
  background: var(--brand-primary) !important;
  animation: priorityPulse 2s ease-in-out infinite;
}

@keyframes priorityPulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.due-date {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.no-date {
  color: var(--text-tertiary);
}

/* Progress bar - Stroke-only design (no fills) */
.progress-bar {
  position: relative;
  width: 100%;
  height: 20px;
  border-radius: var(--radius-full);
  --progress: 0%;
}

.progress-bg {
  position: absolute;
  inset: 0;
  border: 2px solid var(--glass-border-hover);
  border-radius: inherit;
  box-sizing: border-box;
}

.progress-fill {
  position: absolute;
  inset: 0;
  border: 2px solid var(--color-primary);
  border-radius: inherit;
  box-sizing: border-box;
  clip-path: inset(0 calc(100% - var(--progress)) 0 0);
  transition: clip-path var(--duration-normal) ease;
}

.progress-text {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  z-index: 1;
}

.actions-cell {
  gap: var(--space-2);
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}

.table-row:hover .actions-cell {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1);
  background-color: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.action-btn:hover {
  background-color: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
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
  margin: 0;
}


/* ADHD-friendly: Compact density for 40px rows */
.task-table--compact .table-row {
  min-height: 40px;
  padding: var(--space-1_5) var(--space-3);
}

.task-table--compact .table-header {
  min-height: 36px;
  padding: var(--space-1_5) var(--space-3);
}

/* ADHD-friendly: Subtle row striping for scanability */
.table-row:nth-child(even) {
  background: var(--glass-bg-light);
}

.table-row:nth-child(even):hover {
  background-color: var(--glass-bg-medium);
}

/* No progress indicator styling */
.no-progress {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

/* TASK-1334: Table Group Header */
.table-group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
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

.table-group-header:hover {
  background-color: var(--surface-hover);
}

.table-group-expand-icon {
  color: var(--text-tertiary);
  transition: transform var(--duration-fast) ease;
  flex-shrink: 0;
}

.table-group-expand-icon--expanded {
  transform: rotate(90deg);
}

.table-group-name {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  flex: 1;
}

.table-group-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  padding: 0 var(--space-1_5);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
}
</style>
