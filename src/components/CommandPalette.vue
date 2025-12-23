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
    projectId: selectedProject.value || taskStore.activeProjectId || null
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

  const newTask: Partial<Task> = {
    title: taskTitle.value.trim(),
    description: '',
    status: 'planned',
    priority: priority.value as Task['priority'], // Cast to Task priority type
    projectId: selectedProject.value || taskStore.activeProjectId || null
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
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(12px) saturate(100%);
  -webkit-backdrop-filter: blur(12px) saturate(100%);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20vh;
  z-index: 2000;
  animation: fadeIn var(--duration-normal) var(--spring-smooth);
}

/* Modal */
.command-palette-modal {
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px) saturate(100%);
  -webkit-backdrop-filter: blur(20px) saturate(100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-2xl);
  width: 600px;
  max-width: 90vw;
  box-shadow:
    0 32px 64px rgba(0, 0, 0, 0.5),
    0 16px 32px rgba(0, 0, 0, 0.3);
  overflow: visible;
  animation: slideUp var(--duration-normal) var(--spring-bounce);
}

/* Quick Add Section */
.quick-add-section {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
}

.add-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color var(--duration-fast) ease;
}

.quick-add-section:focus-within .add-icon {
  color: rgba(78, 205, 196, 0.8);
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
}

.field-select,
.field-input {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
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
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.03);
}

.field-select:focus,
.field-input:focus {
  border-color: rgba(78, 205, 196, 0.5);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15), 0 0 8px rgba(78, 205, 196, 0.1);
}

.field-select option {
  background: rgba(0, 0, 0, 0.95);
  color: var(--text-primary);
  padding: var(--space-2);
}

.field-select option:hover,
.field-select option:checked {
  background: rgba(78, 205, 196, 0.2);
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
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.toggle-options-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
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
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.25);
  color: var(--text-primary);
  transform: scale(1.02);
}

.toggle-options-btn:focus-visible {
  outline: none;
  border-color: rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15), 0 0 8px rgba(78, 205, 196, 0.1);
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
  border: 1px solid rgba(255, 255, 255, 0.08);
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
    transition: opacity 0.2s ease;
  }
}
</style>
