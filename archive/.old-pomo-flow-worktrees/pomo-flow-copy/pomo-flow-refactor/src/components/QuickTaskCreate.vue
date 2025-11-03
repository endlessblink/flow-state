<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="quick-create-modal">
      <!-- Task Title Input -->
      <input
        ref="titleInput"
        v-model="taskTitle"
        type="text"
        placeholder="Task name"
        class="title-input"
        @keydown.enter="handleCreate"
        @keydown.esc="$emit('close')"
      />

      <!-- Description Input -->
      <input
        v-model="taskDescription"
        type="text"
        placeholder="Description"
        class="description-input"
        @keydown.enter="handleCreate"
        @keydown.esc="$emit('close')"
      />

      <!-- Quick Properties Row -->
      <div class="properties-row">
        <!-- Scheduled Time -->
        <div class="property-chip time-chip">
          <Calendar :size="14" />
          {{ formatTimeRange }}
        </div>

        <!-- Priority -->
        <div class="property-chip priority-chip" @click="cyclePriority">
          <Flag :size="14" />
          {{ priority }}
        </div>

        <!-- Duration (editable) -->
        <div class="property-chip duration-chip">
          <Clock :size="14" />
          <input
            v-model.number="duration"
            type="number"
            min="15"
            step="15"
            class="duration-input"
          />
          <span>mins</span>
        </div>
      </div>

      <!-- Project Selection -->
      <div class="project-row">
        <Inbox :size="14" />
        <select v-model="projectId" class="project-select">
          <option value="">Inbox</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </div>

      <!-- Actions -->
      <div class="actions-row">
        <button class="cancel-btn" @click="$emit('close')">Cancel</button>
        <button class="create-btn" @click="handleCreate" :disabled="!taskTitle.trim()">
          Add task
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Calendar, Flag, Clock, Inbox } from 'lucide-vue-next'
import { useMigrationAdapter } from '@/utils/migration/migration-adapter'
import type { Task } from '@/stores/tasks'

interface Props {
  isOpen: boolean
  startTime: Date
  endTime: Date
  duration: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  created: [task: Task]
}>()

// Migration Adapter
const { getTaskStore } = useMigrationAdapter({
  componentId: 'QuickTaskCreate',
  enablePerformanceMonitoring: true,
  enableErrorTracking: true
})

const taskStoreAdapter = getTaskStore()

const titleInput = ref<HTMLInputElement>()
const taskTitle = ref('')
const taskDescription = ref('')
const priority = ref<'low' | 'medium' | 'high'>('medium')
const duration = ref(props.duration)
const projectId = ref('')

const projects = computed(() => taskStoreAdapter.projects.value)

const formatTimeRange = computed(() => {
  const start = props.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const end = props.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${start}-${end}`
})

const cyclePriority = () => {
  if (priority.value === 'low') priority.value = 'medium'
  else if (priority.value === 'medium') priority.value = 'high'
  else priority.value = 'low'
}

const handleCreate = () => {
  console.group('🔍 QuickTaskCreate.handleCreate() - DEBUG')
  console.log('Task title:', taskTitle.value.trim())
  console.log('Is title valid:', !!taskTitle.value.trim())

  if (!taskTitle.value.trim()) {
    console.log('❌ Task creation blocked: Empty title')
    console.groupEnd()
    return
  }

  // Format date as YYYY-MM-DD for calendar matching
  const schedDate = props.startTime.toISOString().split('T')[0]
  const schedTime = props.startTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

  console.log('Creating task with schedule:', { schedDate, schedTime, duration: duration.value })
  console.log('TaskStore Adapter available:', !!taskStoreAdapter)
  console.log('createTask method available:', typeof taskStoreAdapter.createTask)

  try {
    const taskData = {
      title: taskTitle.value.trim(),
      description: taskDescription.value.trim(),
      priority: priority.value,
      status: 'planned',
      estimatedDuration: duration.value,
      projectId: projectId.value || taskStoreAdapter.projects.value[0]?.id || '1',
      instances: [{
        id: `instance-${Date.now()}`,
        scheduledDate: schedDate,
        scheduledTime: schedTime,
        duration: duration.value
      }]
    }

    console.log('Task data to be created:', taskData)

    const task = taskStoreAdapter.createTask(taskData)

    console.log('✅ Task created successfully:', task)
    console.log('Task ID:', task?.id)
    console.log('Task title:', task?.title)

    emit('created', task)
    emit('close')

    // Reset form
    taskTitle.value = ''
    taskDescription.value = ''
    priority.value = 'medium'
    duration.value = props.duration
    projectId.value = ''

    console.log('✅ Form reset completed')
  } catch (error) {
    console.error('❌ Task creation failed with error:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
  }

  console.groupEnd()
}

// Focus input when modal opens and reset form
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Reset form when opening
    taskTitle.value = ''
    taskDescription.value = ''
    priority.value = 'medium'
    duration.value = props.duration
    projectId.value = ''

    nextTick(() => {
      titleInput.value?.focus()
    })
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.quick-create-modal {
  background: var(--surface-secondary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  padding: var(--space-6);
  width: 480px;
  max-width: 90vw;
  animation: slideUp 0.2s var(--spring-smooth);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.title-input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  padding: var(--space-2) 0;
  margin-bottom: var(--space-2);
  outline: none;
}

.title-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.description-input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  padding: var(--space-2) 0;
  margin-bottom: var(--space-4);
  outline: none;
}

.description-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.properties-row {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.property-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.priority-chip {
  cursor: pointer;
  text-transform: capitalize;
}

.priority-chip:hover {
  background: var(--surface-elevated);
  border-color: var(--border-medium);
}

.duration-chip {
  gap: var(--space-1);
}

.duration-input {
  width: 40px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-align: right;
  outline: none;
}

.duration-input::-webkit-inner-spin-button {
  opacity: 0.5;
}

.project-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  color: var(--text-muted);
}

.project-select {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  outline: none;
  cursor: pointer;
}

.project-select option {
  background: var(--surface-secondary);
  color: var(--text-primary);
}

.actions-row {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.cancel-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-medium);
}

.create-btn {
  background: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.create-btn:hover:not(:disabled) {
  background: var(--brand-hover);
  border-color: var(--brand-hover);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-glow);
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
