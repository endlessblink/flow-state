<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="isOpen"
        class="sheet-overlay"
        @click="handleCancel"
        @touchmove.prevent
      >
        <div
          class="task-edit-sheet"
          :class="{ 'sheet-active': isOpen }"
          @click.stop
          @touchmove.stop
        >
          <!-- Sheet Handle -->
          <div class="sheet-handle" />

          <!-- Header with Cancel/Save -->
          <div class="sheet-header">
            <button class="header-btn cancel-btn" @click="handleCancel">
              Cancel
            </button>
            <h3 class="sheet-title">
              Edit Task
            </h3>
            <button
              class="header-btn save-btn"
              :disabled="!hasChanges || !editedTitle.trim()"
              @click="handleSave"
            >
              Save
            </button>
          </div>

          <!-- Edit Form -->
          <div class="edit-form">
            <!-- Title -->
            <div class="form-field">
              <label class="field-label">Title</label>
              <input
                ref="titleInputRef"
                v-model="editedTitle"
                type="text"
                class="field-input"
                placeholder="Task title"
                @keydown.enter="handleSave"
              >
            </div>

            <!-- Description -->
            <div class="form-field">
              <label class="field-label">Description</label>
              <textarea
                v-model="editedDescription"
                class="field-textarea"
                placeholder="Add details..."
                rows="3"
              />
            </div>

            <!-- Priority -->
            <div class="form-field">
              <label class="field-label">Priority</label>
              <div class="priority-options">
                <button
                  v-for="option in priorityOptions"
                  :key="option.value"
                  class="priority-pill"
                  :class="[`priority-${option.value}`, { active: editedPriority === option.value }]"
                  @click="editedPriority = option.value"
                >
                  <Flag :size="14" />
                  {{ option.label }}
                </button>
                <button
                  class="priority-pill priority-none"
                  :class="[{ active: editedPriority === null }]"
                  @click="editedPriority = null"
                >
                  None
                </button>
              </div>
            </div>

            <!-- Due Date -->
            <div class="form-field">
              <label class="field-label">Due Date</label>
              <div class="date-options">
                <button
                  class="date-pill"
                  :class="[{ active: isDueToday }]"
                  @click="setDueDate('today')"
                >
                  <Calendar :size="14" />
                  Today
                </button>
                <button
                  class="date-pill"
                  :class="[{ active: isDueTomorrow }]"
                  @click="setDueDate('tomorrow')"
                >
                  <CalendarPlus :size="14" />
                  Tomorrow
                </button>
                <button
                  class="date-pill"
                  :class="[{ active: hasDueDate && !isDueToday && !isDueTomorrow }]"
                  @click="showDatePicker = true"
                >
                  <CalendarDays :size="14" />
                  {{ hasDueDate && !isDueToday && !isDueTomorrow ? formatDate(editedDueDate!) : 'Pick' }}
                </button>
                <button
                  v-if="hasDueDate"
                  class="date-pill clear-date"
                  @click="clearDueDate"
                >
                  <X :size="14" />
                </button>
              </div>
              <!-- Native date picker (hidden but functional) -->
              <input
                v-show="showDatePicker"
                ref="datePickerRef"
                v-model="editedDueDateInput"
                type="date"
                class="native-date-picker"
                @change="handleDatePickerChange"
                @blur="showDatePicker = false"
              >
            </div>

            <!-- Status -->
            <div class="form-field">
              <label class="field-label">Status</label>
              <div class="status-options">
                <button
                  v-for="option in statusOptions"
                  :key="option.value"
                  class="status-pill"
                  :class="[{ active: editedStatus === option.value }]"
                  @click="editedStatus = option.value"
                >
                  <component :is="option.icon" :size="14" />
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  Flag, Calendar, CalendarPlus, CalendarDays, X,
  Circle, Clock, CheckCircle2, Pause, Archive
} from 'lucide-vue-next'
import type { Task } from '@/types/tasks'

interface Props {
  isOpen: boolean
  task: Task | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  save: [taskId: string, updates: Partial<Task>]
}>()

// Form state
const editedTitle = ref('')
const editedDescription = ref('')
const editedPriority = ref<'low' | 'medium' | 'high' | null>(null)
const editedDueDate = ref<string | undefined>(undefined)
const editedDueDateInput = ref('')
const editedStatus = ref<Task['status']>('planned')
const showDatePicker = ref(false)

// Refs
const titleInputRef = ref<HTMLInputElement | null>(null)
const datePickerRef = ref<HTMLInputElement | null>(null)

// Options
const priorityOptions = [
  { value: 'high' as const, label: 'High' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'low' as const, label: 'Low' }
]

const statusOptions = [
  { value: 'planned' as const, label: 'To Do', icon: Circle },
  { value: 'in_progress' as const, label: 'In Progress', icon: Clock },
  { value: 'done' as const, label: 'Done', icon: CheckCircle2 },
  { value: 'on_hold' as const, label: 'On Hold', icon: Pause },
  { value: 'backlog' as const, label: 'Backlog', icon: Archive }
]

// Computed
const hasChanges = computed(() => {
  if (!props.task) return false

  return (
    editedTitle.value !== props.task.title ||
    editedDescription.value !== props.task.description ||
    editedPriority.value !== props.task.priority ||
    editedDueDate.value !== props.task.dueDate ||
    editedStatus.value !== props.task.status
  )
})

const hasDueDate = computed(() => !!editedDueDate.value)

const isDueToday = computed(() => {
  if (!editedDueDate.value) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(editedDueDate.value)
  dueDate.setHours(0, 0, 0, 0)
  return dueDate.getTime() === today.getTime()
})

const isDueTomorrow = computed(() => {
  if (!editedDueDate.value) return false
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const dueDate = new Date(editedDueDate.value)
  dueDate.setHours(0, 0, 0, 0)
  return dueDate.getTime() === tomorrow.getTime()
})

// Watch for task changes to populate form
watch(() => props.task, (task) => {
  if (task) {
    editedTitle.value = task.title
    editedDescription.value = task.description || ''
    editedPriority.value = task.priority
    editedDueDate.value = task.dueDate || undefined
    editedStatus.value = task.status

    // Set date input for native picker
    if (task.dueDate) {
      editedDueDateInput.value = new Date(task.dueDate).toISOString().split('T')[0]
    } else {
      editedDueDateInput.value = ''
    }
  }
}, { immediate: true })

// Focus title input when opened
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  }
})

// Actions
function setDueDate(preset: 'today' | 'tomorrow') {
  const date = new Date()
  if (preset === 'tomorrow') {
    date.setDate(date.getDate() + 1)
  }
  date.setHours(0, 0, 0, 0)
  editedDueDate.value = date.toISOString()
  editedDueDateInput.value = date.toISOString().split('T')[0]
  triggerHaptic(10)
}

function clearDueDate() {
  editedDueDate.value = undefined
  editedDueDateInput.value = ''
  triggerHaptic(10)
}

function handleDatePickerChange() {
  if (editedDueDateInput.value) {
    const date = new Date(editedDueDateInput.value + 'T00:00:00')
    editedDueDate.value = date.toISOString()
  }
  showDatePicker.value = false
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function handleCancel() {
  triggerHaptic(10)
  emit('close')
}

function handleSave() {
  if (!props.task || !editedTitle.value.trim()) return

  const updates: Partial<Task> = {}

  if (editedTitle.value !== props.task.title) {
    updates.title = editedTitle.value.trim()
  }
  if (editedDescription.value !== props.task.description) {
    updates.description = editedDescription.value
  }
  if (editedPriority.value !== props.task.priority) {
    updates.priority = editedPriority.value
  }
  if (editedDueDate.value !== props.task.dueDate) {
    updates.dueDate = editedDueDate.value || ''
  }
  if (editedStatus.value !== props.task.status) {
    updates.status = editedStatus.value
  }

  if (Object.keys(updates).length > 0) {
    triggerHaptic(30)
    emit('save', props.task.id, updates)
  }

  emit('close')
}

function triggerHaptic(duration: number = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration)
    } catch {
      // Vibration API not supported
    }
  }
}
</script>

<style scoped>
/* ================================
   TASK EDIT BOTTOM SHEET
   Mobile-optimized with explicit Save/Cancel
   ================================ */

.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.task-edit-sheet {
  width: 100%;
  max-height: 85vh;
  background: var(--surface-primary, rgb(35, 32, 52));
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
}

/* Sheet Handle */
.sheet-handle {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  margin: 12px auto 0;
  flex-shrink: 0;
}

/* Header */
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.sheet-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.header-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.cancel-btn:active {
  background: rgba(255, 255, 255, 0.05);
}

.save-btn {
  background: var(--brand-primary, #4ECDC4);
  color: hsl(230, 20%, 10%);
}

.save-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.save-btn:not(:disabled):active {
  transform: scale(0.96);
}

/* Edit Form */
.edit-form {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.field-input {
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: var(--text-primary, #fff);
  font-size: 16px;
  outline: none;
  transition: all 0.2s ease;
}

.field-input:focus {
  border-color: var(--brand-primary, #4ECDC4);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15);
}

.field-input::placeholder {
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

.field-textarea {
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: var(--text-primary, #fff);
  font-size: 16px;
  outline: none;
  resize: none;
  font-family: inherit;
  transition: all 0.2s ease;
}

.field-textarea:focus {
  border-color: var(--brand-primary, #4ECDC4);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15);
}

.field-textarea::placeholder {
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

/* Priority Options */
.priority-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.priority-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.priority-pill:active {
  transform: scale(0.95);
}

.priority-pill.priority-high.active {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.priority-pill.priority-medium.active {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.4);
  color: #f59e0b;
}

.priority-pill.priority-low.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
  color: #3b82f6;
}

.priority-pill.priority-none.active {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text-primary, #fff);
}

/* Date Options */
.date-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.date-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.date-pill:active {
  transform: scale(0.95);
}

.date-pill.active {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.4);
  color: var(--brand-primary, #4ECDC4);
}

.date-pill.clear-date {
  padding: 10px;
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
}

.native-date-picker {
  margin-top: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--text-primary, #fff);
  font-size: 16px;
  color-scheme: dark;
}

/* Status Options */
.status-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.status-pill:active {
  transform: scale(0.95);
}

.status-pill.active {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.4);
  color: var(--brand-primary, #4ECDC4);
}

/* ================================
   SHEET TRANSITIONS
   ================================ */

.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .task-edit-sheet,
.sheet-leave-to .task-edit-sheet {
  transform: translateY(100%);
}

/* ================================
   ACCESSIBILITY - REDUCED MOTION
   ================================ */

@media (prefers-reduced-motion: reduce) {
  .sheet-enter-active,
  .sheet-leave-active {
    transition: opacity 0.15s ease;
  }

  .sheet-enter-from .task-edit-sheet,
  .sheet-leave-to .task-edit-sheet {
    transform: none;
  }
}
</style>
