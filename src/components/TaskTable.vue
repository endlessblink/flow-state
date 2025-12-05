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
        />
      </div>

      <!-- Bulk Actions Bar -->
      <div v-if="selectedTasks.length > 0" class="bulk-actions-bar" :colspan="7">
        <span class="selection-count">{{ selectedTasks.length }} task{{ selectedTasks.length !== 1 ? 's' : '' }} selected</span>
        <div class="bulk-actions-buttons">
          <button
            @click="handleDeleteSelected"
            class="bulk-action-btn delete-btn"
            title="Delete selected tasks (Ctrl+Delete)"
          >
            <Trash2 :size="14" />
            Delete Selected
          </button>
          <button
            @click="clearSelection"
            class="bulk-action-btn clear-btn"
            title="Clear selection"
          >
            <X :size="14" />
            Clear
          </button>
        </div>
      </div>

      <template v-else>
        <div class="header-cell title-cell">Task</div>
        <div class="header-cell project-cell">Project</div>
        <div class="header-cell status-cell">Status</div>
        <div class="header-cell due-date-cell">Due Date</div>
        <div class="header-cell progress-cell">Progress</div>
        <div class="header-cell actions-cell">Actions</div>
      </template>
    </div>

    <!-- Table Rows -->
    <div
      v-for="task in tasks"
      :key="task.id"
      class="table-row"
      :class="{
        'row-selected': selectedTasks.includes(task.id),
        [`priority-${task.priority || 'none'}`]: true
      }"
      @click="$emit('select', task.id)"
      @contextmenu.prevent="$emit('contextMenu', $event, task)"
    >
    <!-- Priority Indicator -->
    <div v-if="task.priority" class="priority-indicator"></div>
      <div class="table-cell checkbox-cell" @click.stop>
        <input
          type="checkbox"
          :checked="selectedTasks.includes(task.id)"
          @change="toggleTaskSelect(task.id)"
        />
      </div>

      <div class="table-cell title-cell">
        <input
          v-if="editingTaskId === task.id && editingField === 'title'"
          type="text"
          :value="task.title"
          @blur="saveEdit(task.id, 'title', $event)"
          @keydown.enter="saveEdit(task.id, 'title', $event)"
          @keydown.esc="cancelEdit"
          class="inline-edit"
          autofocus
        />
        <span v-else @dblclick="startEdit(task.id, 'title')" :class="getTextAlignmentClasses(task.title)">
          {{ task.title }}
        </span>
      </div>

      <div class="table-cell project-cell">
        <span
          class="project-emoji-badge"
          :class="[`project-visual--${getProjectVisual(task).type}`, { 'project-visual--colored': getProjectVisual(task).type === 'css-circle' }]"
          :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
        >
          <!-- Emoji visual indicator -->
          <ProjectEmojiIcon
            v-if="getProjectVisual(task).type === 'emoji'"
            :emoji="getProjectVisual(task).content"
            size="xs"
            :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
            class="project-emoji"
          />
          <!-- CSS circle visual indicator -->
          <span
            v-else-if="getProjectVisual(task).type === 'css-circle'"
            class="project-emoji project-css-circle"
            :style="{ '--project-color': getProjectVisual(task).color }"
            :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
          ></span>
          <!-- Default fallback (folder icon) -->
          <ProjectEmojiIcon
            v-else
            emoji="📁"
            size="xs"
            :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
            class="project-emoji"
          />
        </span>
      </div>

      <div class="table-cell status-cell">
        <select
          :value="task.status"
          @change="updateTaskStatus(task.id, ($event.target as HTMLSelectElement).value as Task['status'])"
          class="status-select"
        >
          <option value="planned">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">✓</option>
          <option value="backlog">Backlog</option>
          <option value="on_hold">On Hold</option>
        </select>
      </div>

      <div class="table-cell due-date-cell">
        <span v-if="task.dueDate" class="due-date">
          <Calendar :size="14" />
          {{ task.dueDate }}
        </span>
        <span v-else class="no-date">-</span>
      </div>

      <div class="table-cell progress-cell">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${task.progress}%` }"></div>
          <span class="progress-text">{{ task.progress }}%</span>
        </div>
      </div>

      <div class="table-cell actions-cell">
        <button
          @click.stop="$emit('startTimer', task.id)"
          class="action-btn"
          title="Start Timer"
        >
          <Play :size="14" />
        </button>
        <button
          @click.stop="$emit('edit', task.id)"
          class="action-btn"
          title="Edit Task"
        >
          <Edit :size="14" />
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="tasks.length === 0" class="empty-state">
      <Inbox :size="48" class="empty-icon" />
      <p class="empty-title">No tasks found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { Play, Edit, Calendar, Inbox, Trash2, X } from 'lucide-vue-next'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import type { DensityType } from '@/components/ViewControls.vue'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

interface Props {
  tasks: Task[]
  density: DensityType
}

const props = defineProps<Props>()
const taskStore = useTaskStore()

// Hebrew text alignment support
const { getAlignmentClasses } = useHebrewAlignment()

// Helper function to get alignment classes for any text
const getTextAlignmentClasses = (text: string) => {
  return getAlignmentClasses(text)
}

const emit = defineEmits<{
  select: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  updateTask: [taskId: string, updates: Partial<Task>]
}>()

const selectedTasks = ref<string[]>([])
const editingTaskId = ref<string | null>(null)
const editingField = ref<string | null>(null)

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
  background-color: var(--surface-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 40px 1fr 80px 120px 120px 100px 100px;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background-color: var(--surface-tertiary);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
}

/* Bulk Actions Bar */
.bulk-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  background-color: var(--color-primary-alpha-10);
  border: 1px solid var(--color-primary-alpha-30);
  border-radius: var(--radius-md);
  grid-column: 2 / -1;
  margin: var(--space-2) 0;
  backdrop-filter: var(--glass-backdrop);
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
  background-color: var(--surface-tertiary);
  color: var(--text-secondary);
  border-color: var(--border-subtle);
}

.bulk-action-btn.clear-btn:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--border-medium);
}

.table-row {
  display: grid;
  grid-template-columns: 40px 1fr 80px 120px 120px 100px 100px;
  gap: var(--space-2);
  position: relative; /* Needed for absolute positioned priority indicator */
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  transition: background-color var(--duration-fast) ease;
  cursor: pointer;
}

.table-row:hover {
  background-color: var(--surface-hover);
}

.table-row.row-selected {
  background-color: var(--color-primary-alpha-10);
}

/* Density Variants */
.task-table--compact .table-header,
.task-table--compact .table-row {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
}

.task-table--comfortable .table-header,
.task-table--comfortable .table-row {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
}

.task-table--spacious .table-header,
.task-table--spacious .table-row {
  padding: var(--space-4) var(--space-5);
  font-size: var(--text-base);
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
}

.project-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Enhanced project indicator styles matching canvas implementation */
.project-emoji-badge {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--spring-smooth) ease;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 2px 4px var(--shadow-subtle);
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
  font-size: var(--project-indicator-size-md); /* 24px to match canvas */
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateZ(0); /* Hardware acceleration */
  transition: all var(--spring-smooth) ease;
}

.project-emoji.project-css-circle {
  width: var(--project-indicator-size-md); /* 24px to match canvas */
  height: var(--project-indicator-size-md); /* 24px to match canvas */
  border-radius: 50%;
  background: var(--project-color);
  box-shadow: var(--project-indicator-shadow-inset);
  position: relative;
  font-size: var(--project-indicator-font-size-md); /* Proper font scaling */
  color: white;
  font-weight: var(--font-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--spring-smooth) ease;
  backdrop-filter: var(--project-indicator-backdrop);
  /* Enhanced glow to match canvas */
  box-shadow:
    var(--project-indicator-shadow-inset),
    var(--project-indicator-glow-strong);
}

.project-emoji-badge:hover .project-emoji.project-css-circle {
  transform: translateZ(0) scale(1.15); /* Match canvas scaling */
  box-shadow:
    var(--project-indicator-shadow-inset),
    0 0 16px var(--project-color),
    0 0 32px var(--project-color);
}

/* Add radial gradient glow effect like canvas */
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

.project-emoji-badge.project-visual--colored {
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
}

.project-emoji:hover {
  background: var(--brand-bg-light);
  border-color: var(--brand-border);
  color: var(--text-primary);
}

.inline-edit {
  width: 100%;
  padding: var(--space-1) var(--space-2);
  background-color: var(--surface-tertiary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: inherit;
  outline: none;
}

.status-select {
  padding: var(--space-1) var(--space-2);
  background-color: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}

/* Priority Indicator - 5px stripe matching canvas */
.priority-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: 0 4px 8px var(--shadow-md);
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.priority-high .priority-indicator {
  background: var(--color-priority-high);
  box-shadow: var(--priority-high-glow);
}

.priority-medium .priority-indicator {
  background: var(--color-priority-medium);
  box-shadow: var(--priority-medium-glow);
}

.priority-low .priority-indicator {
  background: var(--color-priority-low);
  box-shadow: var(--priority-low-glow);
}

.timer-active .priority-indicator {
  background: var(--brand-primary) !important;
  box-shadow: 0 0 12px var(--brand-primary) !important;
  animation: priorityPulse 2s ease-in-out infinite;
}

@keyframes priorityPulse {
  0%, 100% {
    box-shadow: 0 2px 8px var(--brand-primary);
  }
  50% {
    box-shadow: 0 2px 12px var(--brand-primary), 0 0 16px rgba(59, 130, 246, 0.4);
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

.progress-bar {
  position: relative;
  width: 100%;
  height: 20px;
  background-color: var(--surface-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover));
  transition: width var(--duration-normal) ease;
}

.progress-text {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-primary);
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
  background-color: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.action-btn:hover {
  background-color: var(--surface-hover);
  border-color: var(--border-medium);
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
</style>
