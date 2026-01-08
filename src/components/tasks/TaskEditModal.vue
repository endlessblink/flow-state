<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click="$emit('close')">
      <div class="modal-content" @click.stop @submit.prevent>
        <div class="modal-header">
          <h2 class="modal-title">
            Edit Task
          </h2>
          <button class="close-btn" @click="$emit('close')">
            <X :size="16" />
          </button>
        </div>

        <div class="modal-body">
          <!-- Task Details Section -->
          <section class="form-section">
            <h3 class="section-title">
              Task Details
            </h3>

            <div class="form-group">
              <label class="form-label">Title</label>
              <input
                ref="titleInput"
                v-model="editedTask.title"
                class="form-input"
                :class="[titleAlignmentClasses]"
                :style="titleAlignmentStyles"
                type="text"
                placeholder="Enter task title..."
              >
            </div>

            <div class="form-group">
              <label class="form-label">Description (Markdown)</label>
              <MarkdownEditor
                v-model="editedTask.description"
                placeholder="Describe what needs to be done..."
                :rows="4"
              />
            </div>

            <!-- Compact Metadata Bar (ClickUp-inspired) -->
            <div class="metadata-bar">
              <span class="metadata-label">SCHEDULE</span>
              <div class="metadata-field" title="Due date - When this task must be completed by">
                <Calendar :size="14" />
                <span class="field-label">Due</span>
                <input
                  v-model="editedTask.dueDate"
                  type="date"
                  class="inline-input"
                  placeholder="Due date"
                >
              </div>

              <div class="metadata-field" title="Scheduled for - When you plan to work on this task">
                <CalendarClock :size="14" />
                <span class="field-label">Start</span>
                <input
                  v-model="editedTask.scheduledDate"
                  type="date"
                  class="inline-input"
                  placeholder="Schedule"
                  @change="handleScheduledDateChange"
                >
              </div>

              <div class="metadata-field">
                <Clock :size="14" />
                <span class="field-label">Time</span>
                <input
                  v-model="editedTask.scheduledTime"
                  type="time"
                  class="inline-input"
                  :disabled="!editedTask.scheduledDate"
                >
              </div>

              <div class="metadata-field">
                <TimerReset :size="14" />
                <span class="field-label">Duration</span>
                <input
                  v-model.number="editedTask.estimatedDuration"
                  type="number"
                  min="15"
                  step="15"
                  class="inline-input"
                  placeholder="60m"
                >
              </div>

              <span class="metadata-label">STATUS</span>
              <div class="metadata-field metadata-field--dropdown">
                <component
                  :is="priorityIcon || AlertCircle"
                  :size="14"
                  :class="priorityIconClass"
                />
                <span class="field-label">Priority</span>
                <CustomSelect
                  v-model="editedTask.priority as string | number"
                  :options="priorityOptions"
                  class="inline-custom-select"
                />
              </div>

              <div class="metadata-field metadata-field--dropdown">
                <component
                  :is="statusIcon || Circle"
                  :size="14"
                  :class="statusIconClass"
                />
                <span class="field-label">Status</span>
                <CustomSelect
                  v-model="editedTask.status"
                  :options="statusOptions"
                  class="inline-custom-select"
                />
              </div>

              <div class="metadata-field metadata-field--dropdown">
                <Layout :size="14" class="text-indigo-400" />
                <span class="field-label">Section</span>
                <SectionSelector
                  v-model="currentSectionId"
                  class="inline-custom-select"
                />
              </div>
            </div>
          </section>

          <!-- Dependencies Section (Collapsible) -->
          <section v-if="dependencies.length > 0" class="form-section collapsible">
            <button class="section-toggle" type="button" @click="showDependencies = !showDependencies">
              <ChevronDown :size="14" class="chevron-icon" :class="[{ rotated: showDependencies }]" />
              <h3 class="section-title">
                Dependencies ({{ dependencies.length }})
              </h3>
            </button>
            <div v-show="showDependencies" class="section-content">
              <div class="dependencies-list">
                <div v-for="depTask in dependencies" :key="depTask.id" class="dependency-item">
                  <div class="dependency-icon">
                    🔗
                  </div>
                  <div class="dependency-info">
                    <div class="dependency-title">
                      {{ depTask.title }}
                    </div>
                    <div class="dependency-status" :class="`status-${depTask.status}`">
                      {{ depTask.status === 'done' ? '✓ Complete' : '⏳ Pending' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Subtasks Section (Collapsible) -->
          <section class="form-section collapsible">
            <div class="section-toggle-wrapper">
              <button class="section-toggle" type="button" @click="showSubtasks = !showSubtasks">
                <ChevronDown :size="14" class="chevron-icon" :class="[{ rotated: showSubtasks }]" />
                <h3 class="section-title">
                  Subtasks ({{ editedTask.subtasks?.length || 0 }})
                </h3>
              </button>
              <button
                v-if="showSubtasks"
                class="inline-add-btn"
                type="button"
                @click="addSubtask"
              >
                <Plus :size="12" />
              </button>
            </div>

            <div v-show="showSubtasks" class="section-content">
              <div v-if="!editedTask.subtasks || editedTask.subtasks.length === 0" class="empty-subtasks">
                <span class="empty-message">No subtasks yet</span>
                <button class="add-first-subtask" type="button" @click="addSubtask">
                  <Plus :size="16" />
                  Add your first subtask
                </button>
              </div>

              <div v-else class="subtasks-list">
                <div
                  v-for="subtask in (editedTask.subtasks || [])"
                  :key="subtask.id"
                  class="subtask-item"
                >
                  <div class="subtask-content">
                    <div class="subtask-header">
                      <input
                        v-model="subtask.title"
                        class="subtask-title-input"
                        :class="[getSubtaskAlignmentClasses(subtask)]"
                        :style="getSubtaskAlignmentStyles(subtask)"
                        placeholder="Subtask title..."
                      >
                      <button
                        class="delete-subtask-btn"
                        title="Delete subtask"
                        type="button"
                        @click="deleteSubtask(subtask.id)"
                      >
                        <Trash2 :size="14" />
                      </button>
                    </div>
                    <textarea
                      v-model="subtask.description"
                      class="subtask-description-input"
                      :class="[getSubtaskDescAlignmentClasses(subtask)]"
                      :style="getSubtaskDescAlignmentStyles(subtask)"
                      rows="2"
                      placeholder="Subtask description..."
                    />
                    <div class="subtask-stats">
                      <span class="pomodoro-count">🍅 {{ subtask.completedPomodoros }} sessions</span>
                      <label class="completed-checkbox">
                        <input
                          v-model="subtask.isCompleted"
                          type="checkbox"
                          @change="updateSubtaskCompletion(subtask)"
                        >
                        <span class="checkbox-label">Completed</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Pomodoro Sessions Section (Collapsible) -->
          <section class="form-section collapsible">
            <div class="section-toggle-wrapper">
              <button class="section-toggle" type="button" @click="showPomodoros = !showPomodoros">
                <ChevronDown :size="14" class="chevron-icon" :class="[{ rotated: showPomodoros }]" />
                <h3 class="section-title">
                  Pomodoro Sessions ({{ totalTaskPomodoros }})
                </h3>
              </button>
              <button
                v-if="showPomodoros && totalTaskPomodoros > 0"
                class="reset-pomodoros-btn-inline"
                title="Reset all pomodoro counts"
                type="button"
                @click="resetPomodoros"
              >
                Reset
              </button>
            </div>

            <div v-show="showPomodoros" class="section-content">
              <div class="pomodoro-stats">
                <div class="stat-item">
                  <span class="stat-value">{{ editedTask.completedPomodoros }}</span>
                  <span class="stat-label">Task Sessions</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ totalSubtaskPomodoros }}</span>
                  <span class="stat-label">Subtask Sessions</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ totalTaskPomodoros }}</span>
                  <span class="stat-label">Total Sessions</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="emit('close')">
            Cancel
          </button>
          <button class="save-btn" @click="saveTask">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useTaskStore, getTaskInstances } from '@/stores/tasks'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'
import type { Task, Subtask } from '@/stores/tasks'
// TASK-089: Use unified canvas state lock system (not old canvasPositionLock)
import { lockTaskPosition } from '@/utils/canvasStateLock'
import {
  X, Plus, Trash2, Flag, Circle, Zap, AlertCircle, PlayCircle, CheckCircle, Archive,
  Calendar, CalendarClock, Clock, TimerReset, ChevronDown, Layout
} from 'lucide-vue-next'
import CustomSelect from '@/components/common/CustomSelect.vue'
import SectionSelector from '@/components/canvas/SectionSelector.vue'
import MarkdownEditor from '@/components/common/MarkdownEditor.vue'
import { useCanvasStore } from '@/stores/canvas'

interface Props {
  isOpen: boolean
  task: Task | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

// Options for Priority and Status dropdowns
const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' }
]

const statusOptions = [
  { label: 'Planned', value: 'planned' },
  { label: 'Active', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Backlog', value: 'backlog' }
]

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()

// Template refs
const titleInput = ref<HTMLInputElement>()

// Keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  // Guard: Don't process keyboard shortcuts while saving
  if (!props.isOpen || isSaving.value) return

  if (event.key === 'Escape') {
    emit('close')
  } else if (event.key === 'Enter') {
    const target = event.target as HTMLElement
    const isTextarea = target.tagName === 'TEXTAREA'
    const isContentEditable = target.isContentEditable || target.closest('.ProseMirror') !== null

    // In textareas and contenteditable elements (like Milkdown/ProseMirror):
    // - Regular Enter creates newlines (don't intercept)
    // - Ctrl/Cmd+Enter saves the task
    if (isTextarea || isContentEditable) {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        saveTask()
      }
      // Otherwise let Enter create a newline naturally
      return
    }

    // Outside text editors: Enter saves the task
    event.preventDefault()
    saveTask()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

// Editing state
const editedTask = ref<Task>({
  id: '',
  title: '',
  description: '',
  status: 'planned',
  priority: 'medium',
  progress: 0,
  completedPomodoros: 0,
  subtasks: [],
  dueDate: '',
  scheduledDate: '',
  scheduledTime: '09:00',
  estimatedDuration: 60,
  projectId: '' as string,
  createdAt: new Date(),
  updatedAt: new Date()
})

// Progressive disclosure state
const showDependencies = ref(false)
const showSubtasks = ref(true) // Expanded by default if has subtasks
const showPomodoros = ref(false)

// Save-in-progress guard to prevent race conditions from double-saves
const isSaving = ref(false)

// Hebrew alignment support
const { getAlignmentClasses, applyInputAlignment } = useHebrewAlignment()

// Hebrew alignment for task title
const titleAlignmentClasses = computed(() => getAlignmentClasses(editedTask.value.title))
const titleAlignmentStyles = computed(() => applyInputAlignment(editedTask.value.title))

// Hebrew alignment for task description
const descriptionAlignmentClasses = computed(() => getAlignmentClasses(editedTask.value.description))
const descriptionAlignmentStyles = computed(() => applyInputAlignment(editedTask.value.description))

// Helper function for subtask Hebrew alignment
const getSubtaskAlignmentClasses = (subtask: Subtask) => getAlignmentClasses(subtask.title)
const getSubtaskAlignmentStyles = (subtask: Subtask) => applyInputAlignment(subtask.title)
const getSubtaskDescAlignmentClasses = (subtask: Subtask) => getAlignmentClasses(subtask.description)
const getSubtaskDescAlignmentStyles = (subtask: Subtask) => applyInputAlignment(subtask.description)

// Watch for task changes
watch(() => props.task, (newTask) => {
  if (newTask) {
    editedTask.value = {
      ...newTask,
      subtasks: [...(newTask.subtasks || [])] // Ensure subtasks is always an array
    }
    // Auto-expand sections based on content
    showSubtasks.value = (newTask.subtasks || []).length > 0
    showDependencies.value = (newTask.dependsOn && newTask.dependsOn.length > 0) || false
    showPomodoros.value = (newTask.completedPomodoros || 0) > 0

    // Focus title input when modal opens with a new task
    nextTick(() => {
      if (titleInput.value && newTask.title === 'New Task') {
        titleInput.value.focus()
        titleInput.value.select() // Select the default text so user can type over it
      }
    })
  }
}, { immediate: true })

// Dependencies computed
const dependencies = computed(() => {
  if (!editedTask.value.dependsOn || editedTask.value.dependsOn.length === 0) {
    return []
  }
  return editedTask.value.dependsOn
    .map(taskId => taskStore.tasks.find(t => t.id === taskId))
    .filter(t => t !== undefined) as Task[]
})

// Computed
const totalSubtaskPomodoros = computed(() =>
  editedTask.value.subtasks.reduce((sum, st) => sum + st.completedPomodoros, 0)
)

const totalTaskPomodoros = computed(() =>
  editedTask.value.completedPomodoros + totalSubtaskPomodoros.value
)

// Canvas Section Support
const currentSectionId = computed({
  get: () => {
    if (!editedTask.value.canvasPosition) return null
    
    // Find section that contains this task's position
    const pos = editedTask.value.canvasPosition
    const sections = canvasStore.sections
    
    const containingSection = sections.find(s => 
      pos.x >= s.position.x && 
      pos.x <= s.position.x + s.position.width &&
      pos.y >= s.position.y && 
      pos.y <= s.position.y + s.position.height
    )
    
    return containingSection?.id || null
  },
  set: (sectionId) => {
    handleSectionChange(sectionId)
  }
})

const handleSectionChange = (sectionId: string | null) => {
  if (!sectionId) {
    // Move to Inbox
    editedTask.value.isInInbox = true
    editedTask.value.canvasPosition = undefined
    return
  }

  const section = canvasStore.sections.find(s => s.id === sectionId)
  if (!section) return

  // Update position if not already in this section
  const currentPos = editedTask.value.canvasPosition
  const isCurrentlyInSection = currentPos && 
    currentPos.x >= section.position.x && 
    currentPos.x <= section.position.x + section.position.width &&
    currentPos.y >= section.position.y && 
    currentPos.y <= section.position.y + section.position.height

  if (!isCurrentlyInSection) {
    // Place in center of section with small offset
    editedTask.value.canvasPosition = {
      x: section.position.x + (section.position.width / 2) - 100, // Approx half task width
      y: section.position.y + (section.position.height / 2) - 40   // Approx half task height
    }
  }

  editedTask.value.isInInbox = false

  // Apply "Assign on Drop" settings if they exist
  if (section.assignOnDrop) {
    const settings = section.assignOnDrop
    if (settings.priority) editedTask.value.priority = settings.priority
    if (settings.status) editedTask.value.status = settings.status
    if (settings.projectId) editedTask.value.projectId = settings.projectId
    
    // Handle due date relative keywords
    if (settings.dueDate) {
      import('@/composables/useGroupSettings').then(({ resolveDueDate }) => {
        const dateStr = resolveDueDate(settings.dueDate!)
        if (dateStr) editedTask.value.dueDate = dateStr
      })
    }
  }
}

// Dynamic icon and class for priority
const priorityIcon = computed(() => {
  switch (editedTask.value.priority) {
    case 'low': return Flag
    case 'high': return Zap
    default: return Circle
  }
})

const priorityIconClass = computed(() => {
  switch (editedTask.value.priority) {
    case 'low': return 'priority-low'
    case 'high': return 'priority-high'
    default: return 'priority-medium'
  }
})

// Dynamic icon and class for status
const statusIcon = computed(() => {
  switch (editedTask.value.status) {
    case 'planned': return Circle
    case 'in_progress': return PlayCircle
    case 'done': return CheckCircle
    case 'backlog': return Archive
    default: return AlertCircle
  }
})

const statusIconClass = computed(() => {
  switch (editedTask.value.status) {
    case 'planned': return 'status-planned'
    case 'in_progress': return 'status-progress'
    case 'done': return 'status-done'
    case 'backlog': return 'status-backlog'
    default: return 'status-planned'
  }
})

// Methods
const handleScheduledDateChange = () => {
  if (editedTask.value.scheduledDate && !editedTask.value.scheduledTime) {
    editedTask.value.scheduledTime = '09:00'
  }
}

const addSubtask = () => {
  const newSubtask: Subtask = {
    id: Date.now().toString(),
    parentTaskId: editedTask.value.id,
    title: '',
    description: '',
    completedPomodoros: 0,
    isCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  editedTask.value.subtasks.push(newSubtask)
}

const deleteSubtask = (subtaskId: string) => {
  const index = editedTask.value.subtasks.findIndex(st => st.id === subtaskId)
  if (index !== -1) {
    editedTask.value.subtasks.splice(index, 1)
  }
}

const updateSubtaskCompletion = (subtask: Subtask) => {
  if (!props.task) return

  // TASK-089 FIX: Lock position BEFORE any store updates to prevent canvas watcher from resetting
  const canvasPosition = editedTask.value.canvasPosition ?? props.task?.canvasPosition
  if (canvasPosition) {
    lockTaskPosition(editedTask.value.id, canvasPosition, 'manual')
  }

  // Immediately update the subtask in the store
  taskStore.updateSubtaskWithUndo(editedTask.value.id, subtask.id, {
    isCompleted: subtask.isCompleted,
    updatedAt: new Date()
  })

  // Recalculate parent task progress based on completed subtasks
  const completedCount = editedTask.value.subtasks.filter(st => st.isCompleted).length
  const totalSubtasks = editedTask.value.subtasks.length
  const newProgress = totalSubtasks > 0 ? Math.round((completedCount / totalSubtasks) * 100) : 0

  // Update parent task progress
  taskStore.updateTaskWithUndo(editedTask.value.id, {
    progress: newProgress,
    updatedAt: new Date()
  })
}

const resetPomodoros = () => {
  editedTask.value.completedPomodoros = 0
  editedTask.value.subtasks.forEach(subtask => {
    subtask.completedPomodoros = 0
  })
}

const saveTask = () => {
  // Guard: Prevent double-save race conditions
  if (isSaving.value || !props.task) return
  isSaving.value = true

  try {
  // DEBUG: Track task state before update
  const originalTask = taskStore.tasks.find(t => t.id === editedTask.value.id)
  const originalInstances = originalTask ? getTaskInstances(originalTask) : []
  console.log('🔍 DEBUG: BEFORE UPDATE - Task:', originalTask?.title)
  console.log('🔍 DEBUG: BEFORE UPDATE - Task instances count:', originalInstances.length)
  console.log('🔍 DEBUG: BEFORE UPDATE - Task instances:', originalInstances)
  console.log('🔍 DEBUG: BEFORE UPDATE - editedTask.instances:', editedTask.value.instances)
  console.log('🔍 DEBUG: BEFORE UPDATE - scheduledDate:', editedTask.value.scheduledDate)
  console.log('🔍 DEBUG: BEFORE UPDATE - scheduledTime:', editedTask.value.scheduledTime)

  // Check if task had original scheduling that was explicitly removed
  const hadOriginalSchedule = originalInstances.length > 0 ||
                            (originalTask?.scheduledDate && originalTask?.scheduledTime) ||
                            (originalTask?.instances && originalTask.instances.length > 0)
  const hasNewSchedule = editedTask.value.scheduledDate && editedTask.value.scheduledTime
  const scheduleExplicitlyRemoved = hadOriginalSchedule && !hasNewSchedule

  console.log('🔍 DEBUG: hadOriginalSchedule:', hadOriginalSchedule)
  console.log('🔍 DEBUG: hasNewSchedule:', hasNewSchedule)
  console.log('🔍 DEBUG: scheduleExplicitlyRemoved:', scheduleExplicitlyRemoved)

  // CRITICAL FIX: Include instances in the update to preserve them
  // BUG-FIX: Preserve canvasPosition and isInInbox to prevent position reset
  // IMPORTANT: Use fallback to props.task to prevent undefined from triggering inbox logic
  const originalCanvasPosition = editedTask.value.canvasPosition ?? props.task?.canvasPosition
  const originalIsInInbox = editedTask.value.isInInbox ?? props.task?.isInInbox

  console.log('🔍 DEBUG: originalCanvasPosition:', originalCanvasPosition)
  console.log('🔍 DEBUG: originalIsInInbox:', originalIsInInbox)

  const updates: Record<string, unknown> = {
    title: editedTask.value.title,
    description: editedTask.value.description,
    status: editedTask.value.status,
    priority: editedTask.value.priority,
    dueDate: editedTask.value.dueDate,
    scheduledDate: editedTask.value.scheduledDate,
    scheduledTime: editedTask.value.scheduledTime,
    estimatedDuration: editedTask.value.estimatedDuration
  }

  // BUG-FIX: Only include canvasPosition if it exists (don't pass undefined which triggers inbox logic)
  if (originalCanvasPosition !== undefined) {
    updates.canvasPosition = originalCanvasPosition
    updates.isInInbox = false  // Task with canvas position is NOT in inbox
  } else if (originalIsInInbox !== undefined) {
    updates.isInInbox = originalIsInInbox
  }

  // CRITICAL: Preserve existing instances if we're not updating them separately
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (editedTask.value.instances && (editedTask.value.instances as unknown as any[]).length > 0) {
    updates.instances = editedTask.value.instances
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log('🔍 DEBUG: Including instances in update:', (updates.instances as unknown as any[]).length)
  }

  console.log('🔍 DEBUG: Updates being applied:', updates)

  // TASK-089 FIX: Lock position BEFORE update to prevent canvas watcher from resetting
  // The canvas watcher fires during updateTaskWithUndo, so lock must be set first
  if (originalCanvasPosition) {
    lockTaskPosition(editedTask.value.id, originalCanvasPosition, 'manual')
    console.log('🔒 DEBUG: Locked position BEFORE save:', originalCanvasPosition)
  }

  // Update main task (this triggers canvas watcher, but position is now locked)
  taskStore.updateTaskWithUndo(editedTask.value.id, updates)

  // DEBUG: Check state after main task update (no async needed - undo system handles this)
  const taskAfterUpdate = taskStore.tasks.find(t => t.id === editedTask.value.id)
  const instancesAfterUpdate = taskAfterUpdate ? getTaskInstances(taskAfterUpdate) : []
  console.log('🔍 DEBUG: AFTER MAIN UPDATE - Task instances count:', instancesAfterUpdate.length)
  console.log('🔍 DEBUG: AFTER MAIN UPDATE - Task.isInInbox:', taskAfterUpdate?.isInInbox)
  console.log('🔍 DEBUG: AFTER MAIN UPDATE - Task.instances:', taskAfterUpdate?.instances)

  // Handle task instances for calendar
  if (editedTask.value.scheduledDate && editedTask.value.scheduledTime) {
    console.log('🔍 DEBUG: Handling instance creation/update')
    // Check if task already has instances
    const existingInstances = props.task ? getTaskInstances(props.task) : []
    const sameDayInstance = existingInstances.find(
      (inst: any) => inst.scheduledDate === editedTask.value.scheduledDate
    )

    if (sameDayInstance) {
      // Update existing instance
      taskStore.updateTaskInstanceWithUndo(editedTask.value.id, sameDayInstance.id, {
        scheduledTime: editedTask.value.scheduledTime,
        duration: editedTask.value.estimatedDuration || 60
      })
      console.log('🔍 DEBUG: Updated existing instance:', sameDayInstance.id)
    } else {
      // Create new instance
      taskStore.createTaskInstanceWithUndo(editedTask.value.id, {
        scheduledDate: editedTask.value.scheduledDate,
        scheduledTime: editedTask.value.scheduledTime,
        duration: editedTask.value.estimatedDuration || 60
      })
      console.log('🔍 DEBUG: Created new instance')
    }
  } else if (scheduleExplicitlyRemoved) {
    console.log('🔍 DEBUG: Schedule explicitly removed - handling instance deletion')
    // Remove all instances only when schedule was explicitly removed by user
    const existingInstances = props.task ? getTaskInstances(props.task) : []

    // CRITICAL FIX: Track instance deletions and update task state properly
    if (existingInstances.length > 0) {
      console.log(`🗑️ User removed schedule - removing ${existingInstances.length} instances from task "${editedTask.value.title}"`)

      existingInstances.forEach((instance: any) => {
        taskStore.deleteTaskInstanceWithUndo(editedTask.value.id, instance.id)
      })

      // CRITICAL FIX: Update the task to ensure instances array is properly cleared
      // and task is returned to inbox when all instances are removed
      // No async needed - handle immediately after instance deletions
      const currentTask = taskStore.tasks.find(t => t.id === editedTask.value.id)
      if (currentTask) {
        const hasRemainingInstances = currentTask ? getTaskInstances(currentTask).length > 0 : false
        if (!hasRemainingInstances && currentTask.isInInbox === false) {
          taskStore.updateTask(currentTask.id, {
            instances: [],  // Ensure instances array is explicitly cleared
            isInInbox: true // Return task to inbox visibility
          })
          console.log(`✅ Task "${currentTask.title}" returned to inbox after schedule removal`)
        }
      }
    } else {
      console.log('🔍 DEBUG: No existing instances to remove')
    }
  } else {
    console.log('🔍 DEBUG: No schedule changes - preserving existing instances')
  }

  // Update subtasks
  const originalSubtasks = props.task.subtasks || []

  // Delete removed subtasks
  originalSubtasks.forEach(originalSt => {
    const exists = editedTask.value.subtasks.find(st => st.id === originalSt.id)
    if (!exists) {
      taskStore.deleteSubtaskWithUndo(editedTask.value.id, originalSt.id)
    }
  })

  // Update/create subtasks
  editedTask.value.subtasks.forEach(subtask => {
    if (originalSubtasks.find(st => st.id === subtask.id)) {
      // Update existing
      taskStore.updateSubtaskWithUndo(editedTask.value.id, subtask.id, subtask)
    } else {
      // Create new
      taskStore.createSubtaskWithUndo(editedTask.value.id, subtask)
    }
  })

  // DEBUG: Final state check (no async needed)
  const finalTask = taskStore.tasks.find(t => t.id === editedTask.value.id)
  const finalInstances = finalTask ? getTaskInstances(finalTask) : []
  console.log('🔍 DEBUG: FINAL STATE - Task:', finalTask?.title)
  console.log('🔍 DEBUG: FINAL STATE - Task instances count:', finalInstances.length)
  console.log('🔍 DEBUG: FINAL STATE - Task.isInInbox:', finalTask?.isInInbox)
  console.log('🔍 DEBUG: FINAL STATE - Task.instances:', finalTask?.instances)
  console.log('🔍 DEBUG: FINAL STATE - Should be visible in calendar:', finalInstances.length > 0 || (finalTask?.scheduledDate && finalTask?.scheduledTime))

  emit('close')
  } finally {
    // Always reset saving state, even if an error occurred
    isSaving.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0; /* RTL: direction-agnostic positioning */
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: linear-gradient(
    135deg,
    var(--border-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-2xl);
  box-shadow:
    var(--shadow-2xl),
    var(--shadow-2xl),
    inset 0 2px 0 var(--glass-border-hover);
  width: 90%;
  max-width: 650px;
  max-height: 85vh;
  overflow-y: auto;
  animation: slideUp var(--duration-normal) var(--spring-gentle);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5);
  border-bottom: 1px solid var(--glass-bg-heavy);
  background: linear-gradient(
    180deg,
    var(--glass-bg-tint) 0%,
    transparent 100%
  );
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
}

/* Collapsible Section Styles */
.collapsible {
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  background: transparent;
  border: none;
  padding: var(--space-2) 0;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  color: var(--text-muted);
}

.section-toggle:hover {
  color: var(--text-secondary);
  background: var(--glass-bg-weak);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  margin: calc(var(--space-2) * -1);
}

.section-toggle-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.chevron-icon {
  transition: transform var(--duration-normal) var(--spring-smooth);
  color: var(--text-muted);
  flex-shrink: 0;
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

.section-content {
  animation: slideDown var(--duration-normal) var(--spring-smooth);
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 1000px;
  }
}

.inline-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--purple-bg-subtle);
  border: 1px solid var(--purple-border-subtle);
  color: var(--brand-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.inline-add-btn:hover {
  background: var(--purple-bg-start);
  border-color: var(--purple-border-medium);
  transform: scale(1.1);
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

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.form-group {
  margin-bottom: var(--space-3);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-2);
}

.form-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-input,
.form-textarea,
.form-select {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  width: 100%;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: inset var(--shadow-sm);
  /* RTL support: text aligns to the start (left in LTR, right in RTL) */
  text-align: start;
  direction: inherit; /* Inherit direction from parent */
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--calendar-creating-border);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  box-shadow:
    0 0 0 3px var(--calendar-creating-bg),
    inset var(--shadow-sm);
}

/* ===== COMPACT METADATA BAR (ClickUp-inspired) ===== */
.metadata-bar {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;
  padding: var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-bg-heavy);
  border-radius: var(--radius-lg);
  margin-top: var(--space-3);
}

.metadata-label {
  width: 100%;
  font-size: 9px;
  font-weight: var(--font-semibold);
  color: var(--text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: var(--space-2);
  margin-bottom: calc(var(--space-1) * -1);
}

.metadata-label:first-child {
  margin-top: 0;
}

.field-label {
  font-size: 10px;
  font-weight: var(--font-medium);
  color: var(--text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.metadata-field {
  display: flex;
  align-items: center;
  gap: 4px; /* Minimum spacing per UX research */
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--spring-smooth);
  color: var(--text-muted);
}

.metadata-field:hover {
  border-color: var(--purple-border-light);
  background: var(--glass-bg-soft);
}

.metadata-field:focus-within {
  border-color: var(--purple-border-medium);
  background: var(--glass-bg-soft);
  box-shadow: var(--purple-glow-subtle);
}

.inline-input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 0;
  min-width: 70px;
  transition: all var(--duration-fast);
  /* RTL support: text aligns to the start (left in LTR, right in RTL) */
  text-align: start;
  direction: inherit; /* Inherit direction from parent */
}

.inline-input:focus {
  outline: none;
  color: var(--text-primary);
}

.inline-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.inline-input[type="date"],
.inline-input[type="time"],
.inline-input[type="number"] {
  cursor: pointer;
}

/* Dark glass morphism select styling */
.inline-select {
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: rgba(20, 20, 20, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: var(--space-1) var(--space-6) var(--space-1) var(--space-2);
  min-width: 80px;
  transition: all var(--duration-fast);
  /* Custom dropdown arrow */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
}

.inline-select:hover {
  border-color: rgba(255, 255, 255, 0.25);
  background-color: rgba(30, 30, 30, 0.9);
}

.inline-select:focus {
  outline: none;
  border-color: rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.15);
}

.inline-select option {
  background: rgb(20, 20, 20);
  color: var(--text-primary);
  padding: var(--space-2);
}

.inline-select::-ms-expand {
  display: none;
}

/* CustomSelect inline styling */
.metadata-field--dropdown {
  flex: 1;
  min-width: 120px;
}

.inline-custom-select {
  flex: 1;
}

.inline-custom-select :deep(.select-trigger) {
  min-height: 32px;
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  background: rgba(0, 0, 0, 0.4);
  border-radius: var(--radius-md);
}

.inline-custom-select :deep(.select-value) {
  font-size: var(--text-xs);
}

.inline-custom-select :deep(.select-icon) {
  width: 12px;
  height: 12px;
}

/* Icon Button Groups for Priority and Status */
.icon-button-group {
  display: flex;
  gap: var(--space-2);
}

.icon-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
  padding: var(--space-3) var(--space-2);
  background: linear-gradient(
    135deg,
    var(--glass-bg-tint) 0%,
    var(--glass-bg-weak) 100%
  );
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-bg-heavy);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  color: var(--text-muted);
}

.icon-btn:hover {
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  border-color: var(--border-secondary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.icon-btn.active {
  background: linear-gradient(
    135deg,
    var(--purple-bg-start) 0%,
    var(--purple-bg-end) 100%
  );
  border-color: var(--purple-border-medium);
  color: var(--text-primary);
  box-shadow: var(--purple-shadow-subtle);
}

.btn-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

/* Priority Icon Colors */
.priority-low {
  color: var(--text-subtle);
}

.priority-medium {
  color: var(--color-priority-medium);
}

.priority-high {
  color: var(--color-priority-high);
}

.icon-btn.active .priority-low {
  color: var(--text-muted);
}

.icon-btn.active .priority-medium {
  color: var(--color-break);
}

.icon-btn.active .priority-high {
  color: var(--color-priority-high);
}

/* Status Icon Colors */
.status-planned {
  color: var(--brand-primary);
}

.status-progress {
  color: var(--color-priority-medium);
}

.status-done {
  color: var(--color-work);
}

.status-backlog {
  color: var(--text-subtle);
}

.icon-btn.active .status-planned {
  color: var(--brand-primary);
}

.icon-btn.active .status-progress {
  color: var(--color-break);
}

.icon-btn.active .status-done {
  color: var(--color-work);
}

.icon-btn.active .status-backlog {
  color: var(--text-muted);
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
  min-height: 80px;
}

.reset-pomodoros-btn {
  background: transparent;
  border: 1px solid var(--danger-border-medium);
  color: var(--color-priority-high);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  transition: all var(--duration-fast);
}

.reset-pomodoros-btn:hover {
  background: var(--danger-bg-subtle);
  border-color: var(--danger-border-hover);
}

.add-subtask-btn {
  background: linear-gradient(
    135deg,
    var(--calendar-today-badge-start) 0%,
    var(--calendar-today-badge-end) 100%
  );
  border: 1px solid var(--purple-border-medium);
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: 0 4px 12px var(--purple-border-light);
}

.add-subtask-btn:hover {
  background: linear-gradient(
    135deg,
    var(--calendar-today-badge-start) 0%,
    var(--calendar-today-badge-end) 100%
  );
  transform: translateY(-2px);
  box-shadow:
    var(--purple-shadow-strong);
}

.empty-subtasks {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  background: linear-gradient(
    135deg,
    var(--glass-bg-weak) 0%,
    var(--glass-bg-subtle) 100%
  );
  border-radius: var(--radius-lg);
  border: 1px dashed var(--glass-bg-heavy);
}

.empty-message {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
  display: block;
  opacity: 0.8;
}

.add-first-subtask {
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 auto;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.add-first-subtask:hover {
  background: linear-gradient(
    135deg,
    var(--border-medium) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--border-strong);
  color: var(--text-primary);
  transform: translateY(-2px);
}

.dependencies-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.dependency-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--purple-bg-subtle);
  border: 1px solid var(--purple-border-subtle);
  border-radius: var(--radius-lg);
}

.dependency-icon {
  font-size: var(--text-xl);
  flex-shrink: 0;
}

.dependency-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.dependency-title {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.dependency-status {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.dependency-status.status-done {
  color: var(--color-work);
}

.dependency-status:not(.status-done) {
  color: var(--color-priority-medium);
}

.subtasks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.subtask-item {
  background: linear-gradient(
    135deg,
    var(--glass-bg-tint) 0%,
    var(--glass-bg-weak) 100%
  );
  border: 1px solid var(--glass-bg-heavy);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.subtask-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.subtask-title-input {
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-bg-heavy);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  flex: 1;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.subtask-title-input:focus {
  outline: none;
  border-color: var(--purple-border-medium);
  background: var(--glass-bg-soft);
  box-shadow: var(--purple-glow-medium);
}

.delete-subtask-btn {
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-bg-medium);
  color: var(--color-danger);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-subtask-btn:hover {
  background: var(--danger-bg-medium);
  border-color: var(--danger-border-strong);
  transform: scale(1.05);
}

.subtask-description-input {
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-bg-soft);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  width: 100%;
  margin-bottom: var(--space-2);
  resize: vertical;
  font-family: inherit;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.subtask-description-input:focus {
  outline: none;
  border-color: var(--purple-border-light);
  background: var(--glass-bg-tint);
  box-shadow: var(--purple-glow-subtle);
}

.subtask-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pomodoro-count {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.completed-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.completed-checkbox input {
  margin: 0;
}

.pomodoro-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-item {
  text-align: center;
  padding: var(--space-4);
  background: linear-gradient(
    135deg,
    var(--glass-bg-tint) 0%,
    var(--glass-bg-weak) 100%
  );
  border: 1px solid var(--glass-bg-heavy);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.stat-item:hover {
  border-color: var(--border-medium);
  transform: translateY(-2px);
}

.stat-value {
  display: block;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--brand-primary);
  margin-bottom: var(--space-1);
}

.stat-label {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--glass-bg-heavy);
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--glass-bg-weak) 100%
  );
}

.cancel-btn {
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.cancel-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--border-secondary);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.save-btn {
  background: linear-gradient(
    135deg,
    var(--calendar-today-badge-start) 0%,
    var(--calendar-today-badge-end) 100%
  );
  border: 1px solid var(--purple-border-medium);
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: 0 4px 12px var(--purple-border-light);
}

.save-btn:hover {
  background: linear-gradient(
    135deg,
    var(--calendar-today-badge-start) 0%,
    var(--calendar-today-badge-end) 100%
  );
  transform: translateY(-2px);
  box-shadow:
    var(--purple-shadow-strong);
}

/* Dark theme */
:root.dark-theme .modal-content {
  background: var(--glass-bg-solid);
}

:root.dark-theme .modal-header {
  border-bottom-color: var(--border-subtle);
}

:root.dark-theme .modal-title {
  color: var(--text-primary);
}

:root.dark-theme .close-btn {
  color: var(--text-muted);
}

:root.dark-theme .close-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
}

:root.dark-theme .section-title {
  color: var(--text-secondary);
}

:root.dark-theme .form-label {
  color: var(--text-muted);
}

:root.dark-theme .form-input,
:root.dark-theme .form-textarea,
:root.dark-theme .form-select {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

:root.dark-theme .form-input:focus,
:root.dark-theme .form-textarea:focus,
:root.dark-theme .form-select:focus {
  border-color: var(--brand-primary);
  box-shadow: var(--purple-glow-focus);
}

:root.dark-theme .subtask-item {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--glass-border);
}

:root.dark-theme .subtask-title-input,
:root.dark-theme .subtask-description-input {
  background: var(--glass-bg-solid);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

:root.dark-theme .stat-item {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--glass-border);
}

:root.dark-theme .stat-label,
:root.dark-theme .pomodoro-count,
:root.dark-theme .checkbox-label {
  color: var(--text-muted);
}

:root.dark-theme .cancel-btn {
  border-color: var(--border-medium);
  color: var(--text-muted);
}

:root.dark-theme .cancel-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
}

:root.dark-theme .modal-footer {
  border-top-color: var(--border-subtle);
}
</style>