<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div v-if="isOpen" class="modal-overlay" @mousedown.self="$emit('close')">
        <div class="modal-content" @click.stop>
          <!-- Header -->
          <div class="modal-header">
            <h2 class="modal-title">
              Edit Task
            </h2>
            <button class="close-btn" @click="$emit('close')">
              <X :size="16" />
            </button>
          </div>

          <div class="modal-body">
            <!-- Main Task Details -->
            <section class="form-section">
              <h3 class="section-title">
                Task Details
              </h3>
            
              <TaskEditHeader
                ref="headerRef"
                v-model="editedTask"
              />

              <TaskEditMetadata
                v-model="editedTask"
                :current-section-id="currentSectionId"
                :priority-options="priorityOptions"
                :status-options="statusOptions"
                @section-change="handleSectionChange"
                @schedule-change="handleScheduledDateChange"
              />

              <RecurrenceSelector
                v-model="editedTask.recurrence"
                :start-date="editedTask.scheduledDate || editedTask.dueDate"
                :task-id="editedTask.id"
              />
            </section>

            <!-- FEATURE-1363: Task Reminders -->
            <section class="form-section">
              <h3 class="section-title">
                Reminders
              </h3>
              <ReminderPicker
                :reminders="editedTask.reminders || []"
                :due-date="editedTask.dueDate"
                :due-time="editedTask.dueTime"
                @add-reminder="handleAddReminder"
                @remove-reminder="handleRemoveReminder"
                @dismiss-reminder="handleDismissReminder"
              />
            </section>

            <!-- Subtasks -->
            <TaskEditSubtasks
              :subtasks="editedTask.subtasks"
              @add="addSubtask"
              @delete="deleteSubtask"
              @update="updateSubtaskCompletion"
            />

            <!-- Child Tasks (from canvas connections) -->
            <TaskEditChildTasks :child-tasks="childTasks" />

            <!-- Left Actions (Pomodoro reset, etc.) -->
            <div v-if="showPomodoros" class="left-actions-section">
              <button
                class="reset-pomodoros-btn-inline"
                @click="resetPomodoros"
              >
                Reset Pomodoros
              </button>
            </div>
          </div>

          <!-- AI Assist Popover -->
          <AITaskAssistPopover
            :is-visible="showAIAssist"
            :task="editedTask"
            :x="aiAssistPosition.x"
            :y="aiAssistPosition.y"
            context="edit-modal"
            @close="showAIAssist = false"
            @accept-subtasks="handleAIAcceptSubtasks"
            @accept-priority="handleAIAcceptPriority"
            @accept-date="handleAIAcceptDate"
            @accept-title="handleAIAcceptTitle"
          />

          <!-- Sticky Action Buttons -->
          <div class="modal-actions-sticky">
            <button
              ref="aiAssistBtnRef"
              class="btn btn-ai btn-action"
              @click="openAIAssist"
            >
              <Sparkles :size="16" />
              AI Assist
            </button>
            <div class="spacer" />
            <button class="btn btn-secondary btn-action" @click="$emit('close')">
              Cancel
            </button>
            <button
              class="btn btn-primary btn-action"
              :class="{ 'btn-loading': isSaving }"
              :disabled="isSaveDisabled"
              @click="saveTask"
            >
              <span v-if="isSaving" class="btn-spinner" aria-hidden="true" />
              <span :class="{ 'btn-text-hidden': isSaving }">
                {{ isFormPristine ? 'No Changes' : 'Save Changes' }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { X, Sparkles } from 'lucide-vue-next'
import { type Task, useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

// Composables
import { useTaskEditState } from '@/composables/tasks/useTaskEditState'
import { useTaskEditActions } from '@/composables/tasks/useTaskEditActions'

// Components
import TaskEditHeader from './edit/TaskEditHeader.vue'
import TaskEditMetadata from './edit/TaskEditMetadata.vue'
import TaskEditSubtasks from './edit/TaskEditSubtasks.vue'
import TaskEditChildTasks from './edit/TaskEditChildTasks.vue'
import RecurrenceSelector from './edit/RecurrenceSelector.vue'
import AITaskAssistPopover from '@/components/ai/AITaskAssistPopover.vue'
import ReminderPicker from '@/components/notifications/ReminderPicker.vue'
import type { TaskReminder } from '@/types/notifications'

// Props & Emitters
const props = defineProps<{
  isOpen: boolean
  task: Task | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()

// Template Refs
const headerRef = ref<InstanceType<typeof TaskEditHeader> | null>(null)
const titleInputRef = computed(() => headerRef.value?.titleInput || undefined)

// AI Assist
const showAIAssist = ref(false)
const aiAssistBtnRef = ref<HTMLElement | null>(null)
const aiAssistPosition = ref({ x: 0, y: 0 })

// State Composable
const {
  editedTask,
  isSaving,
  showPomodoros,
  priorityOptions,
  statusOptions,
  // Form validation & dirty tracking
  isFormValid,
  isFormDirty,
  isFormPristine,
  isSaveDisabled
} = useTaskEditState(props, titleInputRef)

// Actions Composable
const {
  addSubtask,
  deleteSubtask,
  updateSubtaskCompletion,
  resetPomodoros,
  handleScheduledDateChange,
  handleSectionChange,
  saveTask
} = useTaskEditActions(props, () => emit('close'), editedTask, isSaving, {
  isFormValid,
  isFormDirty
})

// --- Computed Props ---

// Child tasks (tasks where parentTaskId = this task's id)
const childTasks = computed(() => {
  if (!editedTask.value.id) return []
  return taskStore.tasks.filter(t => t.parentTaskId === editedTask.value.id)
})

const currentSectionId = computed(() => {
  if (!editedTask.value.canvasPosition) return null
  
  const pos = editedTask.value.canvasPosition
  const sections = canvasStore.sections
  
  const containingSection = sections.find(s => 
    pos.x >= s.position.x && 
    pos.x <= s.position.x + s.position.width &&
    pos.y >= s.position.y && 
    pos.y <= s.position.y + s.position.height
  )
  
  return containingSection?.id || null
})

// --- Keyboard Shortcuts ---

const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.isOpen || isSaving.value) return

  if (event.key === 'Escape') {
    emit('close')
  } else if (event.key === 'Enter') {
    const target = event.target as HTMLElement
    const isTextarea = target.tagName === 'TEXTAREA'
    const isContentEditable = target.isContentEditable || target.closest('.ProseMirror') !== null

    if (isTextarea || isContentEditable) {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        saveTask()
      }
      return
    }

    event.preventDefault()
    saveTask()
  }
}

// --- AI Assist Handlers ---

function openAIAssist() {
  const btn = aiAssistBtnRef.value
  if (btn) {
    const rect = btn.getBoundingClientRect()
    aiAssistPosition.value = { x: rect.left, y: rect.top - 8 }
  }
  showAIAssist.value = true
}

function handleAIAcceptSubtasks(subtasks: string[]) {
  for (const title of subtasks) {
    addSubtask()
    const subs = editedTask.value.subtasks
    if (subs.length > 0) {
      subs[subs.length - 1].title = title
    }
  }
  showAIAssist.value = false
}

function handleAIAcceptPriority(priority: string, duration: number) {
  const validPriority = ['low', 'medium', 'high'].includes(priority) ? priority as 'low' | 'medium' | 'high' : undefined
  if (validPriority) {
    editedTask.value.priority = validPriority
  }
  if (duration && duration > 0) {
    editedTask.value.estimatedDuration = duration
  }
  showAIAssist.value = false
}

function handleAIAcceptDate(date: string) {
  editedTask.value.dueDate = date
  showAIAssist.value = false
}

function handleAIAcceptTitle(title: string) {
  editedTask.value.title = title
  showAIAssist.value = false
}

// --- Reminder Handlers (FEATURE-1363) ---

function handleAddReminder(reminder: TaskReminder) {
  if (!editedTask.value.reminders) {
    editedTask.value.reminders = []
  }
  editedTask.value.reminders.push(reminder)
}

function handleRemoveReminder(reminderId: string) {
  if (!editedTask.value.reminders) return
  editedTask.value.reminders = editedTask.value.reminders.filter(r => r.id !== reminderId)
}

function handleDismissReminder(reminderId: string) {
  if (!editedTask.value.reminders) return
  const reminder = editedTask.value.reminders.find(r => r.id === reminderId)
  if (reminder) {
    reminder.dismissed = true
  }
}

onMounted(() => document.addEventListener('keydown', handleKeyDown))
onUnmounted(() => document.removeEventListener('keydown', handleKeyDown))
</script>

<style scoped>
/* Vue Transition: Smooth enter, INSTANT leave for responsive feel */
.modal-enter-active {
  transition: opacity var(--duration-normal) var(--spring-smooth);
}
.modal-enter-active .modal-content {
  transition: opacity var(--duration-normal) var(--spring-smooth),
              transform var(--duration-normal) var(--spring-gentle);
}

/* INSTANT leave - no animation on close for responsive feel (BUG-291) */
.modal-leave-active {
  transition: opacity 0ms;
}
.modal-leave-active .modal-content {
  transition: opacity 0ms, transform 0ms;
}

.modal-enter-from {
  opacity: 0;
}
.modal-enter-from .modal-content {
  opacity: 0;
  transform: translateY(20px) scale(0.96);
}

.modal-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-backdrop-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.modal-content {
  /* Standardized overlay styling */
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-2xl);
  box-shadow: var(--overlay-component-shadow);
  width: 90%;
  max-width: 650px;
  max-height: 85vh;
  overflow-y: auto;
  /* Reserve space for scrollbar to prevent content/button cutoff */
  scrollbar-gutter: stable;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--glass-border);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

.modal-body {
  padding: var(--space-4) var(--space-5);
}

.form-section {
  margin-bottom: var(--space-4);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-3);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.btn-secondary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--glass-bg-base);
  border-color: var(--glass-border-hover);
}

.btn-primary {
  background: transparent;
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
}

.btn-primary:hover {
  background: var(--brand-primary-bg-subtle);
  border-color: var(--brand-primary-hover);
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.reset-pomodoros-btn-inline {
  background: transparent;
  border: 1px solid var(--danger-border-medium);
  color: var(--color-priority-high);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  transition: all var(--duration-fast);
}

.reset-pomodoros-btn-inline:hover {
  background: var(--danger-bg-subtle);
  border-color: var(--danger-border-hover);
}

.left-actions-section {
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
}

/* Sticky Action Buttons - Fixed at bottom of modal */
.modal-actions-sticky {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--overlay-component-bg);
  border-top: 1px solid var(--border-subtle);
  z-index: 10;
  /* Ensure buttons don't overflow - account for scrollbar */
  box-sizing: border-box;
  width: 100%;
}

/* Larger, more prominent action buttons */
.btn-action {
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-base);
  min-width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  position: relative;
}

/* Loading spinner for Save button */
.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-right-color: currentColor;
  border-radius: 50%;
  animation: btn-spin 0.6s linear infinite;
}

@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-loading {
  pointer-events: none;
  cursor: wait;
}

.btn-text-hidden {
  opacity: 0;
  position: absolute;
}

/* Enhanced primary button states */
.btn-primary.btn-action:not(:disabled):hover {
  background: var(--brand-primary);
  color: white;
  border-color: var(--brand-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(var(--brand-primary-rgb, 78, 205, 196), 0.3);
}

.btn-primary.btn-action:not(:disabled):active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(var(--brand-primary-rgb, 78, 205, 196), 0.2);
}

/* Secondary button hover enhancement */
.btn-secondary.btn-action:hover {
  transform: translateY(-1px);
}

/* AI Assist Button */
.btn-ai {
  background: transparent;
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.btn-ai:hover {
  background: var(--brand-bg-subtle);
}

.spacer {
  flex: 1;
}

/* Mobile responsiveness for sticky buttons */
@media (max-width: 640px) {
  .modal-actions-sticky {
    padding: var(--space-3) var(--space-4);
    gap: var(--space-2);
  }

  .btn-action {
    flex: 1;
    min-width: unset;
    padding: var(--space-3) var(--space-3);
  }
}
</style>