<template>
  <div class="task-table" :class="`task-table--${density}`">
    <!-- Table Header -->
    <div class="table-header">
      <div class="header-cell checkbox-cell">
        <input
          type="checkbox"
          :checked="allSelected"
          :indeterminate="someSelected"
          @change="toggleSelectAll"
        />
      </div>
      <div class="header-cell title-cell">Task</div>
      <div class="header-cell status-cell">Status</div>
      <div class="header-cell priority-cell">Priority</div>
      <div class="header-cell due-date-cell">Due Date</div>
      <div class="header-cell progress-cell">Progress</div>
      <div class="header-cell actions-cell">Actions</div>
    </div>

    <!-- Table Rows -->
    <div
      v-for="task in tasks"
      :key="task.id"
      class="table-row"
      :class="{ 'row-selected': selectedTasks.includes(task.id) }"
      @click="$emit('select', task.id)"
      @contextmenu.prevent="$emit('contextMenu', $event, task)"
    >
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
        <span v-else @dblclick="startEdit(task.id, 'title')">
          {{ task.title }}
        </span>
      </div>

      <div class="table-cell status-cell">
        <select
          :value="task.status"
          @change="updateTaskStatus(task.id, ($event.target as HTMLSelectElement).value)"
          class="status-select"
        >
          <option value="planned">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">✓</option>
          <option value="backlog">Backlog</option>
          <option value="on_hold">On Hold</option>
        </select>
      </div>

      <div class="table-cell priority-cell">
        <span
          class="priority-badge"
          :class="`priority-${task.priority || 'medium'}`"
          @click.stop="cyclePriority(task.id, task.priority)"
        >
          {{ task.priority || 'medium' }}
        </span>
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
import { ref, computed } from 'vue'
import type { Task } from '@/stores/tasks'
import { Play, Edit, Calendar, Inbox } from 'lucide-vue-next'
import type { DensityType } from '@/components/ViewControls.vue'

interface Props {
  tasks: Task[]
  density: DensityType
}

const props = defineProps<Props>()

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

const updateTaskStatus = (taskId: string, status: string) => {
  emit('updateTask', taskId, { status })
}

const cyclePriority = (taskId: string, currentPriority?: string) => {
  const priorities = ['low', 'medium', 'high']
  const currentIndex = priorities.indexOf(currentPriority || 'medium')
  const nextIndex = (currentIndex + 1) % priorities.length
  emit('updateTask', taskId, { priority: priorities[nextIndex] })
}
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
  grid-template-columns: 40px 1fr 120px 100px 120px 100px 100px;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background-color: var(--surface-tertiary);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
}

.table-row {
  display: grid;
  grid-template-columns: 40px 1fr 120px 100px 120px 100px 100px;
  gap: var(--space-2);
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

.priority-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: transform var(--duration-fast) ease;
}

.priority-badge:hover {
  transform: scale(1.05);
}

.priority-low {
  background-color: var(--blue-bg-light);
  color: var(--color-info);
}

.priority-medium {
  background-color: var(--color-warning-alpha-10);
  color: var(--color-warning);
}

.priority-high {
  background-color: var(--color-error-alpha-10);
  color: var(--color-error);
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
