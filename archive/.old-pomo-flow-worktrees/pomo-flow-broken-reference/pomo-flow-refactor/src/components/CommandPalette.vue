<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="command-palette-overlay" @click="handleBackdropClick">
        <div class="command-palette-modal" @click.stop>
          <!-- Quick Add Input (Primary Focus) -->
          <div class="quick-add-section">
            <Plus :size="20" class="add-icon" />
            <input
              ref="taskInputRef"
              v-model="taskTitle"
              type="text"
              placeholder="Add a task..."
              class="task-input"
              @keydown.enter.exact="createTask"
              @keydown.enter.shift="createAndContinue"
              @keydown.esc="close"
            />
          </div>

          <!-- Progressive Disclosure: More Options -->
          <Transition name="slide-down">
            <div v-if="showMoreOptions" class="additional-fields">
              <CustomSelect
                v-model="selectedProject"
                :options="projectOptions"
                placeholder="Project"
              />

              <input v-model="dueDate" type="date" class="field-input" />

              <CustomSelect
                v-model="priority"
                :options="priorityOptions"
              />
            </div>
          </Transition>

          <!-- Footer Actions -->
          <div class="palette-footer">
            <button class="toggle-options-btn" @click="showMoreOptions = !showMoreOptions">
              {{ showMoreOptions ? 'Less options' : 'More options' }}
            </button>

            <div class="keyboard-hints">
              <span class="hint">Enter to add</span>
              <span class="hint">Shift+Enter to add + continue</span>
              <span class="hint">Esc to cancel</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { Plus } from 'lucide-vue-next'
import CustomSelect from './CustomSelect.vue'

const taskStore = useTaskStore()

// Component state
const isOpen = ref(false)
const taskTitle = ref('')
const showMoreOptions = ref(false)
const selectedProject = ref('')
const dueDate = ref('')
const priority = ref('medium')
const taskInputRef = ref<HTMLInputElement | null>(null)

// Options for custom selects
const projectOptions = computed(() => [
  { label: 'Project', value: '' },
  ...taskStore.projects.map(project => ({
    label: project.emoji ? `${project.emoji} ${project.name}` : project.name,
    value: project.id
  }))
])

const priorityOptions = [
  { label: 'Low Priority', value: 'low' },
  { label: 'Medium Priority', value: 'medium' },
  { label: 'High Priority', value: 'high' }
]

// Open palette
const open = () => {
  isOpen.value = true
  nextTick(() => {
    taskInputRef.value?.focus()
  })
}

// Close palette
const close = () => {
  isOpen.value = false
  resetForm()
}

// Reset form
const resetForm = () => {
  taskTitle.value = ''
  showMoreOptions.value = false
  selectedProject.value = ''
  dueDate.value = ''
  priority.value = 'medium'
}

// Create task
const createTask = async () => {
  if (!taskTitle.value.trim()) return

  const newTask: any = {
    title: taskTitle.value.trim(),
    description: '',
    status: 'planned',
    priority: priority.value,
    projectId: selectedProject.value || taskStore.activeProjectId || '1'
  }

  if (dueDate.value) {
    newTask.dueDate = dueDate.value
  }

  // If "Today" smart view is active, schedule for today
  if (taskStore.activeSmartView === 'today' && !dueDate.value) {
    const todayStr = new Date().toISOString().split('T')[0]
    newTask.scheduledDate = todayStr
  }

  await taskStore.createTask(newTask)
  close()
}

// Create task and continue
const createAndContinue = async () => {
  if (!taskTitle.value.trim()) return

  const newTask: any = {
    title: taskTitle.value.trim(),
    description: '',
    status: 'planned',
    priority: priority.value,
    projectId: selectedProject.value || taskStore.activeProjectId || '1'
  }

  if (dueDate.value) {
    newTask.dueDate = dueDate.value
  }

  if (taskStore.activeSmartView === 'today' && !dueDate.value) {
    const todayStr = new Date().toISOString().split('T')[0]
    newTask.scheduledDate = todayStr
  }

  await taskStore.createTask(newTask)

  // Reset only task title, keep other options
  taskTitle.value = ''
  nextTick(() => {
    taskInputRef.value?.focus()
  })
}

// Handle backdrop click
const handleBackdropClick = () => {
  if (taskTitle.value.trim()) {
    // Optional: Show confirmation
    const shouldClose = confirm('Discard task?')
    if (shouldClose) close()
  } else {
    close()
  }
}

// Expose open/close for external control
defineExpose({ open, close })
</script>

<style scoped>
/* Overlay */
.command-palette-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20vh;
  z-index: 2000;
}

/* Modal */
.command-palette-modal {
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-xl);
  width: 600px;
  max-width: 90vw;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.4),
    0 0 0 1px var(--glass-bg-soft),
    inset 0 1px 0 var(--glass-bg-heavy);
  overflow: visible;
}

/* Quick Add Section */
.quick-add-section {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6);
  border-bottom: 1px solid var(--glass-border);
}

.add-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.task-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  outline: none;
}

.task-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

/* Additional Fields */
.additional-fields {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--glass-border);
}

.field-select,
.field-input {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  min-height: 44px;
  outline: none;
  transition: all var(--duration-fast) ease;
  color-scheme: dark;
}

.field-select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238b949e' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--space-3) center;
  padding-right: var(--space-8);
}

.field-select:focus,
.field-input:focus {
  border-color: var(--state-active-border);
  background: var(--glass-bg-soft);
  box-shadow: 0 0 0 2px var(--state-active-bg);
}

.field-select option {
  background: var(--surface-tertiary);
  color: var(--text-primary);
  padding: var(--space-2);
}

.field-select option:hover,
.field-select option:checked {
  background: var(--surface-elevated);
}

.field-input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}

/* Footer */
.palette-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-6);
  background: var(--glass-bg-weak);
}

.toggle-options-btn {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  min-height: 36px;
  transition: all var(--duration-fast) ease;
}

.toggle-options-btn:hover {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border-hover);
}

.keyboard-hints {
  display: flex;
  gap: var(--space-4);
}

.hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .command-palette-modal,
.modal-leave-active .command-palette-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from .command-palette-modal {
  transform: scale(0.95) translateY(-20px);
  opacity: 0;
}

.modal-leave-to .command-palette-modal {
  transform: scale(0.95) translateY(-20px);
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>
