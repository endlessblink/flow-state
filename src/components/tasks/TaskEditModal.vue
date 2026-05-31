<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div v-if="isOpen" class="modal-overlay" @mousedown.self="handleCloseRequest">
        <div class="modal-content" @click.stop>
          <!-- Header -->
          <div class="modal-header">
            <h2 class="modal-title">
              Edit Task
            </h2>
            <button
            class="close-btn"
            :aria-label="$t('common.close')"
            @click="handleCloseRequest">
              <X :size="16" />
            </button>
          </div>

          <!-- Workspace Context Strip (workspace tasks only) -->
          <div v-if="isWorkspaceTask" class="workspace-strip">
            <span class="ws-dot" :style="{ background: activeWorkspace?.color || '#2DD4BF' }" />
            <span class="ws-name">{{ activeWorkspace?.name || 'Workspace' }}</span>
            <span class="ws-sep">&middot;</span>
            <span class="ws-meta">{{ wsRelativeTime(editedTask.createdAt) }}</span>
          </div>

          <div class="modal-body">
            <!-- Main Task Details -->
            <section class="form-section">
              <h3 v-if="!isWorkspaceTask" class="section-title">
                Task Details
              </h3>

              <TaskEditHeader
                ref="headerRef"
                v-model="editedTask"
                :hide-labels="isWorkspaceTask"
              />

              <!-- Workspace: Collaboration Bar (replaces TaskEditMetadata) -->
              <div v-if="isWorkspaceTask" class="collab-bar" :class="{ 'is-readonly': isReadOnly }">
                <div class="collab-field">
                  <span class="collab-label">Assigned</span>
                  <CustomSelect
                    :model-value="editedTask.assignedTo || ''"
                    :options="assigneeOptions"
                    placeholder="Unassigned"
                    :compact="true"
                    @update:model-value="handleAssigneeChange"
                  />
                </div>
                <div class="collab-field">
                  <span class="collab-label">Status</span>
                  <CustomSelect
                    v-model="editedTask.status"
                    :options="statusOptions"
                    :compact="true"
                  />
                </div>
                <div class="collab-field">
                  <span class="collab-label">Due</span>
                  <div class="collab-due-pills">
                    <button
                      v-for="pill in quickDatePills"
                      :key="pill.label"
                      class="due-pill"
                      :class="{ active: isDateActive(pill) }"
                      type="button"
                      @click="setQuickDate(pill)"
                    >{{ pill.label }}</button>
                    <button v-if="editedTask.dueDate" class="due-pill due-clear" type="button" @click="editedTask.dueDate = ''">×</button>
                  </div>
                </div>
              </div>

              <!-- Personal: AI hint + Metadata + Recurrence (unchanged) -->
              <template v-if="!isWorkspaceTask">
                <!-- TASK-1470: Inline AI suggestion prompt — visible when task has a title and AI hasn't been used yet this session -->
                <Transition name="ai-hint-fade">
                  <button
                    v-if="showAIHint"
                    class="ai-inline-hint"
                    type="button"
                    @click="triggerInlineAIAssist"
                  >
                    <Sparkles :size="13" class="ai-hint-icon" />
                    <span>Get AI suggestions for this task</span>
                  </button>
                </Transition>

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
              </template>
            </section>

            <!-- TASK-1553: Task Comments (workspace tasks only, default expanded) -->
            <TaskComments
              v-if="isWorkspaceTask"
              :task-id="editedTask.id"
              :workspace-id="editedTask.workspaceId!"
              :default-expanded="true"
            />

            <!-- Workspace: "More options" disclosure wraps secondary sections -->
            <template v-if="isWorkspaceTask">
              <div class="more-options-section">
                <button class="more-options-toggle" type="button" @click="moreOptionsExpanded = !moreOptionsExpanded">
                  <ChevronDown :size="14" class="chevron-icon" :class="{ rotated: !moreOptionsExpanded }" />
                  <span>More options</span>
                </button>
                <div v-show="moreOptionsExpanded" class="more-options-content">
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

                  <!-- FEATURE-1414: Task Attachments -->
                  <TaskAttachments
                    :attachments="editedTask.attachments || []"
                    @add="handleAddAttachment"
                    @remove="handleRemoveAttachment"
                  />

                  <!-- Subtasks -->
                  <TaskEditSubtasks
                    :subtasks="editedTask.subtasks"
                    @add="addSubtask"
                    @delete="deleteSubtask"
                    @update="updateSubtaskCompletion"
                  />

                  <!-- Child Tasks (from canvas connections) -->
                  <TaskEditChildTasks :child-tasks="childTasks" />

                  <!-- Recurrence (inside more options for workspace) -->
                  <RecurrenceSelector
                    v-model="editedTask.recurrence"
                    :start-date="editedTask.scheduledDate || editedTask.dueDate"
                    :task-id="editedTask.id"
                  />
                </div>
              </div>
            </template>

            <!-- Personal: render all sections normally (unchanged) -->
            <template v-else>
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

              <!-- FEATURE-1414: Task Attachments -->
              <TaskAttachments
                :attachments="editedTask.attachments || []"
                @add="handleAddAttachment"
                @remove="handleRemoveAttachment"
              />

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
            </template>
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
            <div class="modal-action-group modal-action-group-start">
              <button
                v-if="!isWorkspaceTask"
                ref="aiAssistBtnRef"
                class="btn btn-ai btn-action"
                @click="openAIAssist"
              >
                <Sparkles :size="14" />
                AI Assist
                <kbd class="ai-shortcut-hint">Ctrl+.</kbd>
              </button>
              <button
                v-if="editedTask.id"
                class="btn btn-secondary btn-action btn-thinking-flow"
                @click="handleOpenThinkingFlow"
              >
                <LayoutDashboard :size="14" />
                Thinking Flow
              </button>
              <button
                v-if="!isReadOnly"
                class="btn btn-danger btn-action"
                @click="handlePermanentDelete"
              >
                <Trash2 :size="14" />
                Delete
              </button>
            </div>
            <div class="modal-action-group modal-action-group-end">
              <button class="btn btn-secondary btn-action" @click="handleCloseRequest">
                Cancel
              </button>
              <button
                v-if="!isReadOnly"
                class="btn btn-primary btn-action"
                :class="{ 'btn-loading': isSaving }"
                :disabled="isSaveDisabled"
                @click="handleManualSave"
              >
                <span v-if="isSaving" class="btn-spinner" aria-hidden="true" />
                <span :class="{ 'btn-text-hidden': isSaving }">
                  {{ isFormPristine ? 'No Changes' : 'Save Changes' }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { X, Sparkles, Trash2, ChevronDown, LayoutDashboard } from 'lucide-vue-next'
import { type Task, useTaskStore } from '@/stores/tasks'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { getTaskCompleteness } from '@/composables/useTaskCompleteness'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasModalsStore } from '@/stores/canvas/modals'
import { useNotificationStore } from '@/stores/notifications'
import { useWorkspaceStore } from '@/stores/workspace'
import { getAssignableMembers } from '@/composables/workspace/useTaskAssignment'

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
import TaskAttachments from './TaskAttachments.vue'
import TaskComments from './edit/TaskComments.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import type { TaskReminder } from '@/types/notifications'
import type { TaskAttachment } from '@/types/tasks'

// Props & Emitters
const props = defineProps<{
  isOpen: boolean
  task: Task | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'permanent-delete', taskId: string): void
}>()

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const canvasModalsStore = useCanvasModalsStore()
const notificationStore = useNotificationStore()
const workspaceStore = useWorkspaceStore()

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
  isSaveDisabled,
  markCurrentTaskSaved
} = useTaskEditState(props, titleInputRef)

// Actions Composable
const {
  addSubtask,
  deleteSubtask,
  updateSubtaskCompletion,
  resetPomodoros,
  handleScheduledDateChange,
  handleSectionChange,
  saveTask: persistTask
} = useTaskEditActions(props, () => emit('close'), editedTask, isSaving, {
  isFormValid,
  isFormDirty,
  markCurrentTaskSaved
})

let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let isFlushingBeforeClose = false

const clearAutosaveTimer = () => {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
}

const flushEditorContent = async () => {
  headerRef.value?.flushPendingEdits?.()
  await nextTick()
}

const autosaveTask = async () => {
  clearAutosaveTimer()
  if (!props.isOpen || isSaving.value || isReadOnly.value || isFlushingBeforeClose) return
  await flushEditorContent()
  if (!isFormValid.value || !isFormDirty.value) return
  await persistTask({ close: false, showSuccessToast: false })
}

const scheduleAutosave = () => {
  if (!props.isOpen || isSaving.value || isReadOnly.value || isFlushingBeforeClose) return
  clearAutosaveTimer()
  autosaveTimer = setTimeout(() => {
    autosaveTask()
  }, 500)
}

const handleManualSave = async () => {
  clearAutosaveTimer()
  await flushEditorContent()
  await persistTask()
}

const handleOpenThinkingFlow = async () => {
  const taskId = editedTask.value.id
  if (!taskId || isSaving.value) return

  clearAutosaveTimer()
  await flushEditorContent()

  if (!isReadOnly.value && isFormDirty.value) {
    const saved = await persistTask({ close: false, showSuccessToast: false })
    if (!saved) return
  }

  emit('close')
  canvasModalsStore.openMiniCanvas(taskId)
}

const handleCloseRequest = async () => {
  if (isSaving.value) return
  isFlushingBeforeClose = true
  clearAutosaveTimer()
  await flushEditorContent()
  if (!isReadOnly.value && isFormValid.value && isFormDirty.value) {
    const saved = await persistTask({ close: false, showSuccessToast: false })
    if (!saved) {
      isFlushingBeforeClose = false
      return
    }
  }
  isFlushingBeforeClose = false
  emit('close')
}

// --- Workspace task detection & layout ---
const isWorkspaceTask = computed(() => !!editedTask.value.workspaceId)
const activeWorkspace = computed(() => workspaceStore.activeWorkspace)
const isReadOnly = computed(() =>
  isWorkspaceTask.value && workspaceStore.userRole === 'viewer'
)
const moreOptionsExpanded = ref(false)

// --- Workspace: Assignee options ---
const assigneeOptions = computed(() => {
  if (!editedTask.value.workspaceId) return []
  const members = getAssignableMembers(editedTask.value.workspaceId)
  return [
    { label: 'Unassigned', value: '' },
    ...members.map(m => ({
      label: m.displayName || m.email || m.userId.substring(0, 8),
      value: m.userId,
    }))
  ]
})

function handleAssigneeChange(value: string | number) {
  editedTask.value.assignedTo = value === '' ? null : String(value)
}

// --- Workspace: Quick date pills ---
const quickDatePills = [
  { label: 'Today', offset: 0 as number | string },
  { label: 'Tmrw', offset: 1 as number | string },
  { label: 'Wknd', offset: 'weekend' as number | string },
  { label: '+1wk', offset: 7 as number | string },
]

function setQuickDate(pill: { offset: number | string }) {
  const now = new Date()
  let target: Date
  if (pill.offset === 'weekend') {
    const day = now.getDay()
    const daysUntilSat = (6 - day + 7) % 7 || 7
    target = new Date(now.getTime() + daysUntilSat * 86400000)
  } else {
    target = new Date(now.getTime() + (pill.offset as number) * 86400000)
  }
  editedTask.value.dueDate = target.toISOString().split('T')[0]
}

function isDateActive(pill: { offset: number | string }): boolean {
  if (!editedTask.value.dueDate) return false
  const tempDate = new Date()
  if (pill.offset === 'weekend') {
    const day = tempDate.getDay()
    const daysUntilSat = (6 - day + 7) % 7 || 7
    const target = new Date(tempDate.getTime() + daysUntilSat * 86400000).toISOString().split('T')[0]
    return editedTask.value.dueDate === target
  }
  const target = new Date(tempDate.getTime() + (pill.offset as number) * 86400000).toISOString().split('T')[0]
  return editedTask.value.dueDate === target
}

function wsRelativeTime(date: Date | string | undefined): string {
  if (!date) return ''
  const diff = Date.now() - (date instanceof Date ? date.getTime() : new Date(date).getTime())
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Created today'
  if (days === 1) return 'Created yesterday'
  if (days < 7) return `Created ${days}d ago`
  const d = date instanceof Date ? date : new Date(date)
  return `Created ${d.toLocaleDateString()}`
}

// TASK-1470: Smart AI hint — persistent for new users, re-triggers for incomplete tasks
const aiUsedThisSession = ref(false)
const hasDiscoveredAI = ref(localStorage.getItem(STORAGE_KEYS.AI_ASSIST_DISCOVERED) === 'true')

const showAIHint = computed(() => {
  if (aiUsedThisSession.value || showAIAssist.value || !editedTask.value.title?.trim()) return false
  // Always show for users who haven't discovered AI yet
  if (!hasDiscoveredAI.value) return true
  // Show for experienced users only when task is incomplete
  const { score } = getTaskCompleteness(editedTask.value as Task)
  return score < 0.5
})

// Reset session flag when the modal opens with a new task
watch(() => props.task?.id, () => {
  aiUsedThisSession.value = false
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
    handleCloseRequest()
  } else if (event.key === 'Enter') {
    const target = event.target as HTMLElement
    const isTextarea = target.tagName === 'TEXTAREA'
    const isContentEditable = target.isContentEditable || target.closest('.ProseMirror') !== null

    if (isTextarea || isContentEditable) {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        handleManualSave()
      }
      return
    }

    event.preventDefault()
    handleManualSave()
  }
}

// --- AI Assist Handlers ---

function openAIAssist() {
  const btn = aiAssistBtnRef.value
  if (btn) {
    const rect = btn.getBoundingClientRect()
    aiAssistPosition.value = { x: rect.left, y: rect.top - 8 }
  }
  aiUsedThisSession.value = true
  if (!hasDiscoveredAI.value) {
    hasDiscoveredAI.value = true
    localStorage.setItem(STORAGE_KEYS.AI_ASSIST_DISCOVERED, 'true')
  }
  showAIAssist.value = true
}

// TASK-1470: Triggered from inline hint button — positions near the hint element itself
function triggerInlineAIAssist() {
  aiUsedThisSession.value = true
  // Position the popover at the footer AI Assist button for consistency
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
  // FEATURE-1363: Trigger immediate reminder check (don't wait for 60s polling)
  notificationStore.checkCustomReminders()
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

// --- Attachment Handlers (FEATURE-1414) ---

function handleAddAttachment(attachment: TaskAttachment) {
  if (!editedTask.value.attachments) {
    editedTask.value.attachments = []
  }
  editedTask.value.attachments.push(attachment)
}

function handleRemoveAttachment(attachmentId: string) {
  if (!editedTask.value.attachments) return
  editedTask.value.attachments = editedTask.value.attachments.filter(a => a.id !== attachmentId)
}

// --- Permanent Delete ---

function handlePermanentDelete() {
  const taskId = editedTask.value.id
  if (!taskId) return
  emit('close')
  emit('permanent-delete', taskId)
}

watch(editedTask, () => {
  scheduleAutosave()
}, { deep: true })

watch(() => props.isOpen, (open) => {
  if (!open) clearAutosaveTimer()
})

onMounted(() => document.addEventListener('keydown', handleKeyDown))
onUnmounted(() => {
  clearAutosaveTimer()
  document.removeEventListener('keydown', handleKeyDown)
})
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
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--overlay-component-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--border-subtle);
  z-index: 10;
  /* Ensure buttons don't overflow - account for scrollbar */
  box-sizing: border-box;
  width: 100%;
}

.modal-action-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
}

.modal-action-group-start {
  flex: 1 1 auto;
  justify-content: flex-start;
}

.modal-action-group-end {
  flex: 0 0 auto;
  justify-content: flex-end;
  margin-inline-start: auto;
}

/* Compact action buttons that fit in modal width */
.btn-action {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5);
  position: relative;
  white-space: nowrap;
}

/* Loading spinner for Save button */
.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-inline-end-color: currentColor;
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
  background: rgba(45, 212, 191, 0.12);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  transform: translateY(-2px);
  box-shadow: 0 0 12px rgba(45, 212, 191, 0.25);
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

.ai-shortcut-hint {
  font-size: var(--text-xs);
  font-family: inherit;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 1px var(--space-1);
  margin-inline-start: var(--space-1);
  color: var(--text-muted);
  pointer-events: none;
}

.btn-danger {
  background: transparent;
  border: 1px solid var(--danger-border-medium);
  color: var(--color-priority-high);
}

.btn-danger:hover {
  background: var(--danger-bg-subtle);
  border-color: var(--danger-border-hover);
}

/* TASK-1470: Inline AI suggestion hint */
.ai-inline-hint {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent);
  border-radius: var(--radius-md);
  color: var(--brand-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  transition: background var(--duration-fast), border-color var(--duration-fast), opacity var(--duration-fast);
  text-align: start;
}

.ai-inline-hint:hover {
  background: color-mix(in srgb, var(--brand-primary) 10%, var(--glass-bg-soft));
  border-color: color-mix(in srgb, var(--brand-primary) 55%, transparent);
}

.ai-hint-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

/* Fade transition for the inline hint */
.ai-hint-fade-enter-active {
  transition: opacity var(--duration-normal), transform var(--duration-normal) var(--spring-smooth);
}

.ai-hint-fade-leave-active {
  transition: opacity var(--duration-fast), transform var(--duration-fast);
}

.ai-hint-fade-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.ai-hint-fade-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

/* ─── Workspace Context Strip ────────────────────────────────────────────────── */

.workspace-strip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  background: var(--glass-bg-soft);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.ws-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.ws-name {
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
}

.ws-sep {
  color: var(--text-subtle);
}

.ws-meta {
  color: var(--text-muted);
}

/* ─── Collaboration Bar ─────────────────────────────────────────────────────── */

.collab-bar {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  margin-bottom: var(--space-4);
}

.collab-bar.is-readonly {
  opacity: 0.6;
  pointer-events: none;
}

.collab-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.collab-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: var(--font-semibold);
}

.collab-due-pills {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.due-pill {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
  white-space: nowrap;
}

.due-pill:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
}

.due-pill.active {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: var(--font-medium);
}

.due-pill.due-clear {
  color: var(--text-muted);
  padding: var(--space-1) var(--space-1_5);
  font-size: var(--text-sm);
  line-height: 1;
}

.due-pill.due-clear:hover {
  color: var(--color-priority-high);
  border-color: var(--danger-border-medium);
}

/* ─── More Options Disclosure ────────────────────────────────────────────────── */

.more-options-section {
  margin-top: var(--space-3);
  margin-bottom: var(--space-4);
}

.more-options-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  background: transparent;
  border: none;
  padding: var(--space-2) 0;
  cursor: pointer;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color var(--duration-fast);
}

.more-options-toggle:hover {
  color: var(--text-secondary);
}

.more-options-toggle .chevron-icon {
  transition: transform var(--duration-fast);
  color: var(--text-muted);
  flex-shrink: 0;
}

.more-options-toggle .chevron-icon.rotated {
  transform: rotate(-90deg);
}

.more-options-content {
  padding-top: var(--space-3);
}

/* Mobile responsiveness for sticky buttons */
@media (max-width: 640px) {
  .modal-actions-sticky {
    padding: var(--space-3) var(--space-4);
    gap: var(--space-2);
    align-items: stretch;
  }

  .modal-action-group,
  .modal-action-group-start,
  .modal-action-group-end {
    flex: 1 1 100%;
    justify-content: stretch;
    gap: var(--space-2);
    margin-inline-start: 0;
  }

  .btn-action {
    flex: 1 1 calc(50% - var(--space-2));
    min-width: unset;
    padding: var(--space-3) var(--space-3);
    font-size: var(--text-sm);
  }

  .collab-bar {
    flex-direction: column;
    gap: var(--space-3);
  }
}
</style>
