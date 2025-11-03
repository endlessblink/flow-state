<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div
        v-if="modelValue"
        class="quick-capture-overlay"
        @click="handleOverlayClick"
      >
        <div
          class="quick-capture-modal"
          @click.stop
        >
          <!-- Drag handle -->
          <div class="drag-handle" />

          <!-- Header -->
          <div class="modal-header">
            <h2 class="modal-title">New Task</h2>
            <button
              class="close-button"
              @click="close"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit">
            <!-- Task title -->
            <div class="form-group">
              <input
                ref="titleInput"
                v-model="taskTitle"
                type="text"
                class="task-input"
                placeholder="What needs to be done?"
                autofocus
              >
            </div>

            <!-- Quick actions row -->
            <div class="quick-actions">
              <!-- Project selector -->
              <button
                type="button"
                class="quick-action-button"
                :class="{ active: selectedProject }"
                @click="showProjectPicker = !showProjectPicker"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span>{{ selectedProject ? getProjectName(selectedProject) : 'Project' }}</span>
              </button>

              <!-- Priority selector -->
              <button
                type="button"
                class="quick-action-button"
                :class="{ active: priority !== 'medium' }"
                @click="showPriorityPicker = !showPriorityPicker"
              >
                <div class="priority-dot" :class="`priority-${priority}`" />
                <span>{{ priority }}</span>
              </button>

              <!-- Due date selector -->
              <button
                type="button"
                class="quick-action-button"
                :class="{ active: dueDate }"
                @click="showDatePicker = !showDatePicker"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{{ dueDate ? formatDate(dueDate) : 'Due' }}</span>
              </button>
            </div>

            <!-- Project picker -->
            <Transition name="fade">
              <div v-if="showProjectPicker" class="picker-dropdown">
                <button
                  v-for="project in projects"
                  :key="project.id"
                  type="button"
                  class="picker-option"
                  :class="{ selected: selectedProject === project.id }"
                  @click="selectProject(project.id)"
                >
                  <span class="project-color" :style="{ background: project.color }" />
                  {{ project.name }}
                </button>
              </div>
            </Transition>

            <!-- Priority picker -->
            <Transition name="fade">
              <div v-if="showPriorityPicker" class="picker-dropdown">
                <button
                  v-for="p in priorities"
                  :key="p"
                  type="button"
                  class="picker-option"
                  :class="{ selected: priority === p }"
                  @click="selectPriority(p)"
                >
                  <div class="priority-dot" :class="`priority-${p}`" />
                  {{ p }}
                </button>
              </div>
            </Transition>

            <!-- Date picker -->
            <Transition name="fade">
              <div v-if="showDatePicker" class="picker-dropdown">
                <button
                  type="button"
                  class="picker-option"
                  @click="selectDate('today')"
                >
                  Today
                </button>
                <button
                  type="button"
                  class="picker-option"
                  @click="selectDate('tomorrow')"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  class="picker-option"
                  @click="selectDate('next-week')"
                >
                  Next Week
                </button>
                <button
                  type="button"
                  class="picker-option"
                  @click="selectDate('custom')"
                >
                  Custom Date...
                </button>
              </div>
            </Transition>

            <!-- Submit button -->
            <button
              type="submit"
              class="submit-button"
              :disabled="!taskTitle.trim()"
            >
              Add Task
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { format, addDays, addWeeks, startOfDay } from 'date-fns'
import type { Project } from '@/types'

interface Props {
  modelValue: boolean
  projects?: Project[]
}

const props = withDefaults(defineProps<Props>(), {
  projects: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'create': [task: {
    title: string
    projectId?: string
    priority: string
    dueDate?: number
  }]
}>()

// Form state
const taskTitle = ref('')
const selectedProject = ref<string | null>(null)
const priority = ref<'low' | 'medium' | 'high' | 'urgent'>('medium')
const dueDate = ref<number | null>(null)

// UI state
const showProjectPicker = ref(false)
const showPriorityPicker = ref(false)
const showDatePicker = ref(false)
const titleInput = ref<HTMLInputElement>()

const priorities: Array<'low' | 'medium' | 'high' | 'urgent'> = ['low', 'medium', 'high', 'urgent']

// Auto-focus input when modal opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      titleInput.value?.focus()
    })
  } else {
    resetForm()
  }
})

function close() {
  emit('update:modelValue', false)
}

function handleOverlayClick() {
  close()
}

function handleSubmit() {
  if (!taskTitle.value.trim()) return

  emit('create', {
    title: taskTitle.value.trim(),
    projectId: selectedProject.value || undefined,
    priority: priority.value,
    dueDate: dueDate.value || undefined
  })

  close()
}

function selectProject(projectId: string) {
  selectedProject.value = projectId
  showProjectPicker.value = false
}

function selectPriority(p: typeof priority.value) {
  priority.value = p
  showPriorityPicker.value = false
}

function selectDate(option: string) {
  const now = new Date()

  switch (option) {
    case 'today':
      dueDate.value = startOfDay(now).getTime()
      break
    case 'tomorrow':
      dueDate.value = startOfDay(addDays(now, 1)).getTime()
      break
    case 'next-week':
      dueDate.value = startOfDay(addWeeks(now, 1)).getTime()
      break
    case 'custom':
      // TODO: Open native date picker
      break
  }

  showDatePicker.value = false
}

function formatDate(timestamp: number): string {
  return format(new Date(timestamp), 'MMM d')
}

function getProjectName(projectId: string): string {
  return props.projects.find(p => p.id === projectId)?.name || 'Unknown'
}

function resetForm() {
  taskTitle.value = ''
  selectedProject.value = null
  priority.value = 'medium'
  dueDate.value = null
  showProjectPicker.value = false
  showPriorityPicker.value = false
  showDatePicker.value = false
}
</script>

<style scoped>
.quick-capture-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.quick-capture-modal {
  width: 100%;
  background: var(--neutral-900);
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
  padding: var(--space-6) var(--space-4) var(--space-4);
  max-height: 90vh;
  overflow-y: auto;
}

.drag-handle {
  width: 40px;
  height: 4px;
  background: var(--neutral-600);
  border-radius: var(--radius-full);
  margin: 0 auto var(--space-4);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--neutral-100);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--neutral-400);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.close-button:hover {
  background: var(--neutral-800);
  color: var(--neutral-100);
}

.form-group {
  margin-bottom: var(--space-4);
}

.task-input {
  width: 100%;
  background: var(--neutral-800);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  font-size: var(--text-base);
  color: var(--neutral-100);
  transition: all 0.2s;
}

.task-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  background: var(--neutral-750);
}

.task-input::placeholder {
  color: var(--neutral-500);
}

.quick-actions {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  overflow-x: auto;
}

.quick-action-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--neutral-800);
  border: 1px solid var(--neutral-700);
  border-radius: var(--radius-md);
  color: var(--neutral-400);
  font-size: var(--text-sm);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-action-button.active {
  background: var(--neutral-750);
  border-color: var(--accent-blue);
  color: var(--neutral-100);
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.priority-low { background: var(--neutral-500); }
.priority-medium { background: var(--accent-blue); }
.priority-high { background: var(--accent-orange); }
.priority-urgent { background: var(--status-error); }

.picker-dropdown {
  background: var(--neutral-800);
  border: 1px solid var(--neutral-700);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  margin-bottom: var(--space-4);
  max-height: 200px;
  overflow-y: auto;
}

.picker-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--neutral-300);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.picker-option:hover {
  background: var(--neutral-750);
  color: var(--neutral-100);
}

.picker-option.selected {
  background: var(--accent-blue);
  color: white;
}

.project-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.submit-button {
  width: 100%;
  padding: var(--space-4);
  background: var(--accent-blue);
  border: none;
  border-radius: var(--radius-lg);
  color: white;
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-button:not(:disabled):active {
  transform: scale(0.98);
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.slide-up-enter-from .quick-capture-overlay,
.slide-up-leave-to .quick-capture-overlay {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
