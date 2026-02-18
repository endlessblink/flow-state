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
            >
          </div>

          <!-- Progressive Disclosure: More Options -->
          <Transition name="slide-down">
            <div v-if="showMoreOptions" class="additional-fields">
              <CustomSelect
                v-model="selectedProject"
                :options="projectOptions"
                placeholder="Project"
              />

              <input v-model="dueDate" type="date" class="field-input">

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
import { ref, nextTick, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'
import { Plus } from 'lucide-vue-next'
import CustomSelect from '@/components/common/CustomSelect.vue'

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
    label: taskStore.getProjectDisplayName(project.id),
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

  const newTask: Partial<Task> = {
    title: taskTitle.value.trim(),
    description: '',
    status: 'planned',
    priority: priority.value as Task['priority'], // Cast to Task priority type
    projectId: selectedProject.value || taskStore.activeProjectId || undefined
  }

  if (dueDate.value) {
    newTask.dueDate = dueDate.value
  }

  // BUG-1325: If "Today" smart view is active, set dueDate (deadline), NOT scheduledDate.
  // scheduledDate would cause the task to auto-appear on the calendar.
  if (taskStore.activeSmartView === 'today' && !dueDate.value) {
    const todayStr = new Date().toISOString().split('T')[0]
    newTask.dueDate = todayStr
  }

  await taskStore.createTask(newTask)
  close()
}

// Create task and continue
const createAndContinue = async () => {
  if (!taskTitle.value.trim()) return

  const newTask: Partial<Task> = {
    title: taskTitle.value.trim(),
    description: '',
    status: 'planned',
    priority: priority.value as Task['priority'], // Cast to Task priority type
    projectId: selectedProject.value || taskStore.activeProjectId || undefined
  }

  if (dueDate.value) {
    newTask.dueDate = dueDate.value
  }

  // BUG-1325: Set dueDate (deadline), NOT scheduledDate, for "Today" smart view.
  if (taskStore.activeSmartView === 'today' && !dueDate.value) {
    const todayStr = new Date().toISOString().split('T')[0]
    newTask.dueDate = todayStr
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
  background: var(--overlay-darker);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20vh;
  z-index: var(--z-popover);
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
}

/* Modal */
.command-palette-modal {
  background: var(--glass-panel-bg);
  backdrop-filter: var(--blur-xl);
  -webkit-backdrop-filter: var(--blur-xl);
  border: 1px solid var(--glass-border-medium);
  border-radius: var(--radius-2xl);
  width: 600px;
  max-width: 90vw;
  box-shadow:
    var(--shadow-2xl),
    var(--shadow-strong),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  overflow: visible;
  animation: slideUp var(--duration-normal) var(--spring-bounce);
}

/* Quick Add Section */
.quick-add-section {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
}

.add-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color var(--duration-fast) ease;
}

.quick-add-section:focus-within .add-icon {
  color: var(--brand-primary);
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
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
}

.field-select,
.field-input {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  min-height: 44px;
  outline: none;
  transition: all var(--duration-normal) var(--spring-smooth);
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

.field-select:hover,
.field-input:hover {
  border-color: var(--border-interactive);
  background: var(--glass-bg-tint);
}

.field-select:focus,
.field-input:focus {
  border-color: var(--brand-primary-alpha-50);
  background: var(--glass-bg-tint);
  box-shadow: 0 0 0 3px var(--state-hover-bg), 0 0 8px var(--glass-glow);
}

.field-select option {
  background: var(--glass-bg-solid);
  color: var(--text-primary);
  padding: var(--space-2);
}

.field-select option:hover,
.field-select option:checked {
  background: var(--brand-primary-bg-heavy);
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
  background: transparent;
  border-top: 1px solid var(--border-subtle);
}

.toggle-options-btn {
  background: transparent;
  border: 1px solid var(--glass-border-hover);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  min-height: 36px;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.toggle-options-btn:hover {
  background: var(--glass-bg-tint);
  border-color: var(--border-interactive);
  color: var(--text-primary);
  transform: scale(1.02);
}

.toggle-options-btn:focus-visible {
  outline: none;
  border-color: var(--brand-primary-alpha-50);
  box-shadow: 0 0 0 3px var(--state-hover-bg), 0 0 8px var(--glass-glow);
}

.keyboard-hints {
  display: flex;
  gap: var(--space-4);
}

.hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-normal) var(--ease-out);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .command-palette-modal,
.modal-leave-active .command-palette-modal {
  transition: transform var(--duration-normal) var(--var(--ease-out)-out), opacity var(--duration-normal) ease;
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
  transition: all var(--duration-normal) var(--ease-out);
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

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
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

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .command-palette-overlay,
  .command-palette-modal {
    animation: none;
    transition: opacity var(--duration-normal) var(--ease-out);
  }
}
</style>
