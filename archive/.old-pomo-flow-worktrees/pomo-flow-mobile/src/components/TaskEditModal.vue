<template>
  <div v-if="isOpen" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Edit Task</h2>
        <button class="close-btn" @click="$emit('close')">
          <X :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Task Details Section -->
        <section class="form-section">
          <h3 class="section-title">Task Details</h3>

          <div class="form-group">
            <label class="form-label">Title</label>
            <input
              v-model="editedTask.title"
              class="form-input"
              type="text"
              placeholder="Enter task title..."
            />
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea
              v-model="editedTask.description"
              class="form-textarea"
              rows="3"
              placeholder="Describe what needs to be done..."
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Due Date</label>
              <input
                v-model="editedTask.dueDate"
                class="form-input"
                type="date"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Scheduled Date</label>
              <input
                v-model="editedTask.scheduledDate"
                class="form-input"
                type="date"
                @change="handleScheduledDateChange"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Scheduled Time</label>
              <input
                v-model="editedTask.scheduledTime"
                class="form-input"
                type="time"
                :disabled="!editedTask.scheduledDate"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Estimated Duration (min)</label>
              <input
                v-model.number="editedTask.estimatedDuration"
                class="form-input"
                type="number"
                min="15"
                step="15"
                placeholder="60"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Priority</label>
              <div class="icon-button-group">
                <button
                  type="button"
                  class="icon-btn"
                  :class="{ active: editedTask.priority === 'low' }"
                  @click="editedTask.priority = 'low'"
                  title="Low Priority"
                >
                  <Flag :size="16" class="priority-low" />
                  <span class="btn-label">Low</span>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  :class="{ active: editedTask.priority === 'medium' }"
                  @click="editedTask.priority = 'medium'"
                  title="Medium Priority"
                >
                  <AlertCircle :size="16" class="priority-medium" />
                  <span class="btn-label">Medium</span>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  :class="{ active: editedTask.priority === 'high' }"
                  @click="editedTask.priority = 'high'"
                  title="High Priority"
                >
                  <Zap :size="16" class="priority-high" />
                  <span class="btn-label">High</span>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Status</label>
              <div class="icon-button-group">
                <button
                  type="button"
                  class="icon-btn"
                  :class="{ active: editedTask.status === 'planned' }"
                  @click="editedTask.status = 'planned'"
                  title="Planned"
                >
                  <Circle :size="16" class="status-planned" />
                  <span class="btn-label">Plan</span>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  :class="{ active: editedTask.status === 'in_progress' }"
                  @click="editedTask.status = 'in_progress'"
                  title="In Progress"
                >
                  <PlayCircle :size="16" class="status-progress" />
                  <span class="btn-label">Active</span>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  :class="{ active: editedTask.status === 'done' }"
                  @click="editedTask.status = 'done'"
                  title="Done"
                >
                  <CheckCircle :size="16" class="status-done" />
                  <span class="btn-label">Done</span>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  :class="{ active: editedTask.status === 'backlog' }"
                  @click="editedTask.status = 'backlog'"
                  title="Backlog"
                >
                  <Archive :size="16" class="status-backlog" />
                  <span class="btn-label">Later</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Dependencies Section -->
        <section v-if="dependencies.length > 0" class="form-section">
          <h3 class="section-title">Dependencies</h3>
          <div class="dependencies-list">
            <div v-for="depTask in dependencies" :key="depTask.id" class="dependency-item">
              <div class="dependency-icon">🔗</div>
              <div class="dependency-info">
                <div class="dependency-title">{{ depTask.title }}</div>
                <div class="dependency-status" :class="`status-${depTask.status}`">
                  {{ depTask.status === 'done' ? '✓ Complete' : '⏳ Pending' }}
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Subtasks Section -->
        <section class="form-section">
          <div class="section-header">
            <h3 class="section-title">Subtasks</h3>
            <button class="add-subtask-btn" @click="addSubtask">
              <Plus :size="14" />
              Add Subtask
            </button>
          </div>

          <div v-if="editedTask.subtasks.length === 0" class="empty-subtasks">
            <span class="empty-message">No subtasks yet</span>
            <button class="add-first-subtask" @click="addSubtask">
              <Plus :size="16" />
              Add your first subtask
            </button>
          </div>

          <div v-else class="subtasks-list">
            <div
              v-for="subtask in editedTask.subtasks"
              :key="subtask.id"
              class="subtask-item"
            >
              <div class="subtask-content">
                <div class="subtask-header">
                  <input
                    v-model="subtask.title"
                    class="subtask-title-input"
                    placeholder="Subtask title..."
                  />
                  <button
                    class="delete-subtask-btn"
                    @click="deleteSubtask(subtask.id)"
                    title="Delete subtask"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
                <textarea
                  v-model="subtask.description"
                  class="subtask-description-input"
                  rows="2"
                  placeholder="Subtask description..."
                ></textarea>
                <div class="subtask-stats">
                  <span class="pomodoro-count">🍅 {{ subtask.completedPomodoros }} sessions</span>
                  <label class="completed-checkbox">
                    <input
                      type="checkbox"
                      v-model="subtask.isCompleted"
                      @change="updateSubtaskCompletion(subtask)"
                    />
                    <span class="checkbox-label">Completed</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Pomodoro History Section -->
        <section class="form-section">
          <div class="section-header">
            <h3 class="section-title">Pomodoro Sessions</h3>
            <button
              v-if="totalTaskPomodoros > 0"
              @click="resetPomodoros"
              class="reset-pomodoros-btn"
              title="Reset all pomodoro counts"
            >
              Reset
            </button>
          </div>
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTaskStore, getTaskInstances } from '@/stores/tasks'
import type { Task, Subtask } from '@/stores/tasks'
import { X, Plus, Trash2, Flag, Circle, Zap, AlertCircle, PlayCircle, CheckCircle, Archive, Inbox } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  task: Task | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const taskStore = useTaskStore()

// Keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.isOpen) return

  if (event.key === 'Escape') {
    emit('close')
  } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
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
  projectId: '1',
  createdAt: new Date(),
  updatedAt: new Date()
})

// Watch for task changes
watch(() => props.task, (newTask) => {
  if (newTask) {
    editedTask.value = { ...newTask, subtasks: [...newTask.subtasks] }
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

const updateSubtaskCompletion = (subtask: any) => {
  if (!props.task) return

  // Immediately update the subtask in the store
  taskStore.updateSubtask(editedTask.value.id, subtask.id, {
    isCompleted: subtask.isCompleted,
    updatedAt: new Date()
  })

  // Recalculate parent task progress based on completed subtasks
  const completedCount = editedTask.value.subtasks.filter(st => st.isCompleted).length
  const totalSubtasks = editedTask.value.subtasks.length
  const newProgress = totalSubtasks > 0 ? Math.round((completedCount / totalSubtasks) * 100) : 0

  // Update parent task progress
  taskStore.updateTask(editedTask.value.id, {
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
  if (!props.task) return

  // Update main task
  taskStore.updateTask(editedTask.value.id, {
    title: editedTask.value.title,
    description: editedTask.value.description,
    status: editedTask.value.status,
    priority: editedTask.value.priority,
    dueDate: editedTask.value.dueDate,
    scheduledDate: editedTask.value.scheduledDate,
    scheduledTime: editedTask.value.scheduledTime,
    estimatedDuration: editedTask.value.estimatedDuration
  })

  // Handle task instances for calendar
  if (editedTask.value.scheduledDate && editedTask.value.scheduledTime) {
    // Check if task already has instances
    const existingInstances = taskStore.getTaskInstances(props.task)
    const sameDayInstance = existingInstances.find(
      inst => inst.scheduledDate === editedTask.value.scheduledDate
    )
    
    if (sameDayInstance) {
      // Update existing instance
      taskStore.updateTaskInstance(editedTask.value.id, sameDayInstance.id, {
        scheduledTime: editedTask.value.scheduledTime,
        duration: editedTask.value.estimatedDuration || 60
      })
    } else {
      // Create new instance
      taskStore.createTaskInstance(editedTask.value.id, {
        scheduledDate: editedTask.value.scheduledDate,
        scheduledTime: editedTask.value.scheduledTime,
        duration: editedTask.value.estimatedDuration || 60
      })
    }
  } else {
    // Remove all instances if no scheduled date
    const existingInstances = taskStore.getTaskInstances(props.task)
    existingInstances.forEach(instance => {
      taskStore.deleteTaskInstance(editedTask.value.id, instance.id)
    })
  }

  // Update subtasks
  const originalSubtasks = props.task.subtasks || []

  // Delete removed subtasks
  originalSubtasks.forEach(originalSt => {
    const exists = editedTask.value.subtasks.find(st => st.id === originalSt.id)
    if (!exists) {
      taskStore.deleteSubtask(editedTask.value.id, originalSt.id)
    }
  })

  // Update/create subtasks
  editedTask.value.subtasks.forEach(subtask => {
    if (originalSubtasks.find(st => st.id === subtask.id)) {
      // Update existing
      taskStore.updateSubtask(editedTask.value.id, subtask.id, subtask)
    } else {
      // Create new
      taskStore.createSubtask(editedTask.value.id, subtask)
    }
  })

  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  padding: var(--space-5) var(--space-6);
}

.form-section {
  margin-bottom: var(--space-6);
}

.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin: 0 0 var(--space-4) 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.form-group {
  margin-bottom: var(--space-4);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-3);
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
  background: var(--surface-secondary);
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
  background: var(--surface-tertiary);
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
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
  color: var(--text-primary);
}

:root.dark-theme .form-input:focus,
:root.dark-theme .form-textarea:focus,
:root.dark-theme .form-select:focus {
  border-color: var(--brand-primary);
  box-shadow: var(--purple-glow-focus);
}

:root.dark-theme .subtask-item {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
}

:root.dark-theme .subtask-title-input,
:root.dark-theme .subtask-description-input {
  background: var(--surface-secondary);
  border-color: var(--border-medium);
  color: var(--text-primary);
}

:root.dark-theme .stat-item {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
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
  background: var(--surface-tertiary);
  color: var(--text-secondary);
}

:root.dark-theme .modal-footer {
  border-top-color: var(--border-subtle);
}
</style>