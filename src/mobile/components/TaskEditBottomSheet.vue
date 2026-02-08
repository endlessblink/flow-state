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
                :dir="titleDirection"
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
                :dir="descriptionDirection"
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

// BUG-1108: RTL detection for title and description (Hebrew, Arabic, Persian, Urdu)
const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

const titleDirection = computed(() => {
  if (!editedTitle.value.trim()) return 'auto'
  const firstChar = editedTitle.value.trim()[0]
  return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
})

const descriptionDirection = computed(() => {
  if (!editedDescription.value.trim()) return 'auto'
  const firstChar = editedDescription.value.trim()[0]
  return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
})

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
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  display: flex;
  align-items: flex-end;
  z-index: var(--z-modal);
}

.task-edit-sheet {
  width: 100%;
  max-height: 85vh;
  background: var(--surface-primary);
  border-top-left-radius: var(--radius-xl);
  border-top-right-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-dark-xl);
}

/* Sheet Handle */
.sheet-handle {
  width: var(--space-10);
  height: var(--space-1);
  background: var(--border-hover);
  border-radius: var(--radius-xs);
  margin: var(--space-3) auto 0;
  flex-shrink: 0;
}

/* Header */
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--glass-border-light);
  flex-shrink: 0;
}

.sheet-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.header-btn {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.cancel-btn {
  background: transparent;
  color: var(--text-secondary);
}

.cancel-btn:active {
  background: var(--glass-bg-weak);
}

.save-btn {
  background: var(--brand-primary);
  color: var(--text-primary);
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
  padding: var(--space-5) var(--space-4);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.field-input {
  padding: var(--space-3_5) var(--space-4);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  outline: none;
  transition: all var(--duration-normal) ease;
}

.field-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--state-active-bg);
}

.field-input::placeholder {
  color: var(--text-muted);
}

.field-textarea {
  padding: var(--space-3_5) var(--space-4);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  outline: none;
  resize: none;
  font-family: inherit;
  transition: all var(--duration-normal) ease;
}

.field-textarea:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--state-active-bg);
}

.field-textarea::placeholder {
  color: var(--text-muted);
}

/* Priority Options */
.priority-options {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.priority-pill {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2_5) var(--space-3_5);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.priority-pill:active {
  transform: scale(0.95);
}

.priority-pill.priority-high.active {
  background: var(--priority-high-bg);
  border-color: var(--priority-high-border);
  color: var(--color-priority-high);
}

.priority-pill.priority-medium.active {
  background: var(--priority-medium-bg);
  border-color: var(--priority-medium-border);
  color: var(--color-priority-medium);
}

.priority-pill.priority-low.active {
  background: var(--priority-low-bg);
  border-color: var(--priority-low-border);
  color: var(--color-priority-low);
}

.priority-pill.priority-none.active {
  background: var(--glass-bg-tint);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

/* Date Options */
.date-options {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.date-pill {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2_5) var(--space-3_5);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.date-pill:active {
  transform: scale(0.95);
}

.date-pill.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--brand-primary);
}

.date-pill.clear-date {
  padding: var(--space-2_5);
  color: var(--text-muted);
}

.native-date-picker {
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-base);
  color-scheme: dark;
}

/* Status Options */
.status-options {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2_5) var(--space-3_5);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.status-pill:active {
  transform: scale(0.95);
}

.status-pill.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--brand-primary);
}

/* ================================
   SHEET TRANSITIONS
   ================================ */

.sheet-enter-active,
.sheet-leave-active {
  transition: all var(--duration-slow) var(--spring-gentle);
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
    transition: opacity var(--duration-fast) ease;
  }

  .sheet-enter-from .task-edit-sheet,
  .sheet-leave-to .task-edit-sheet {
    transform: none;
  }
}

/* RTL Support */
[dir="rtl"] .sheet-header {
  flex-direction: row-reverse;
}

[dir="rtl"] .form-field {
  text-align: right;
}

/* RTL support - attribute on the element itself */
.field-input[dir="rtl"],
.field-textarea[dir="rtl"] {
  text-align: right;
}

.field-input[dir="rtl"]::placeholder,
.field-textarea[dir="rtl"]::placeholder {
  text-align: right;
}

[dir="rtl"] .priority-options,
[dir="rtl"] .date-options {
  flex-direction: row-reverse;
}

[dir="rtl"] .priority-pill,
[dir="rtl"] .date-pill {
  flex-direction: row-reverse;
}
</style>
