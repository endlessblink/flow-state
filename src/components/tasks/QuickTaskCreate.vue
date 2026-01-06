<template>
  <div
    v-if="isOpen"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Quick create task"
    @click.self="$emit('close')"
  >
    <div class="quick-create-modal">
      <!-- Task Title Input -->
      <input
        ref="titleInput"
        v-model="taskTitle"
        type="text"
        placeholder="Task name"
        aria-label="Task name"
        class="title-input"
        @keydown.enter="handleCreate"
        @keydown.esc="$emit('close')"
      >

      <!-- Description Input -->
      <input
        v-model="taskDescription"
        type="text"
        placeholder="Description"
        aria-label="Task description"
        class="description-input"
        @keydown.enter="handleCreate"
        @keydown.esc="$emit('close')"
      >

      <!-- Schedule Section -->
      <span class="section-label">Schedule</span>
      <div class="date-time-row">
        <!-- Date Picker -->
        <div class="date-picker-section">
          <div
            class="date-display"
            @click="openDatePicker"
            role="button"
            tabindex="0"
            aria-label="Open date picker"
            @keydown.enter="openDatePicker"
            @keydown.space.prevent="openDatePicker"
          >
            <Calendar :size="14" />
            <span>{{ formattedDate }}</span>
            <input
              ref="dateInputRef"
              type="date"
              class="date-input-hidden"
              :value="localDate"
              aria-label="Due date"
              @change="updateDate"
              tabindex="-1"
            >
          </div>
          <!-- Quick Date Shortcuts -->
          <div class="quick-date-shortcuts">
            <button
              type="button"
              class="quick-date-btn"
              :class="{ active: isToday }"
              @click="setToday"
            >
              Today
            </button>
            <button
              type="button"
              class="quick-date-btn"
              :class="{ active: isTomorrow }"
              @click="setTomorrow"
            >
              Tomorrow
            </button>
            <button
              type="button"
              class="quick-date-btn"
              :class="{ active: isWeekend }"
              @click="setWeekend"
            >
              Weekend
            </button>
          </div>
        </div>

        <!-- Optional Time Input -->
        <div class="time-section">
          <div class="time-toggle">
            <Clock :size="14" />
            <label class="toggle-label">
              <input
                v-model="hasTime"
                type="checkbox"
                class="toggle-checkbox"
              >
              <span class="toggle-text">Set time</span>
            </label>
          </div>
          <div v-if="hasTime" class="time-inputs">
            <input
              v-model="localStartTime"
              type="time"
              class="time-input"
              aria-label="Start time"
            >
            <span class="time-separator">-</span>
            <input
              v-model="localEndTime"
              type="time"
              class="time-input"
              aria-label="End time"
            >
          </div>
        </div>
      </div>

      <!-- Details Section -->
      <span class="section-label">Details</span>
      <div class="properties-row">
        <!-- Priority Dropdown -->
        <div class="property-select">
          <Flag :size="14" class="property-icon" />
          <CustomSelect
            v-model="priority"
            :options="priorityOptions"
            class="compact-select"
          />
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
            aria-label="Duration in minutes"
          >
          <span>mins</span>
        </div>

        <!-- Project Dropdown -->
        <div class="property-select">
          <Inbox :size="14" class="property-icon" />
          <CustomSelect
            v-model="projectId"
            :options="projectOptions"
            class="compact-select"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="actions-row">
        <button class="cancel-btn" @click="$emit('close')">
          Cancel
        </button>
        <button class="create-btn" :disabled="!taskTitle.trim()" @click="handleCreate">
          Add task
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Calendar, Flag, Clock, Inbox } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'
import CustomSelect from '@/components/common/CustomSelect.vue'

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

const taskStore = useTaskStore()

const titleInput = ref<HTMLInputElement>()
const dateInputRef = ref<HTMLInputElement>()
const taskTitle = ref('')
const taskDescription = ref('')
const priority = ref<'low' | 'medium' | 'high'>('medium')
const duration = ref(props.duration)
const projectId = ref('')

// Date and time state
const localDate = ref('')
const localStartTime = ref('')
const localEndTime = ref('')
const hasTime = ref(true) // Time is enabled by default when coming from calendar

const projects = computed(() => taskStore.projects)

// Options for CustomSelect dropdowns
const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' }
]

const projectOptions = computed(() => [
  { label: 'Inbox', value: '' },
  ...projects.value.map(p => ({ label: p.name, value: p.id }))
])

// Format date for display
const formattedDate = computed(() => {
  if (!localDate.value) return 'Select date'
  const date = new Date(localDate.value)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

// Date detection computed properties
const isToday = computed(() => {
  if (!localDate.value) return false
  const today = new Date()
  const selected = new Date(localDate.value)
  return today.toDateString() === selected.toDateString()
})

const isTomorrow = computed(() => {
  if (!localDate.value) return false
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const selected = new Date(localDate.value)
  return tomorrow.toDateString() === selected.toDateString()
})

const isWeekend = computed(() => {
  if (!localDate.value) return false
  const selected = new Date(localDate.value)
  const day = selected.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
})

// Date quick shortcuts
const setToday = () => {
  const today = new Date()
  localDate.value = today.toISOString().split('T')[0]
}

const setTomorrow = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  localDate.value = tomorrow.toISOString().split('T')[0]
}

const setWeekend = () => {
  const today = new Date()
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
  const saturday = new Date()
  saturday.setDate(today.getDate() + daysUntilSaturday)
  localDate.value = saturday.toISOString().split('T')[0]
}

const openDatePicker = () => {
  dateInputRef.value?.showPicker()
}

const updateDate = (event: Event) => {
  const input = event.target as HTMLInputElement
  localDate.value = input.value
}

// Format time from Date to HH:MM string
const formatTimeForInput = (date: Date) => {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

const handleCreate = async () => {
  if (!taskTitle.value.trim()) return

  // Use local date or fall back to prop date
  const schedDate = localDate.value || props.startTime.toISOString().split('T')[0]
  const schedTime = hasTime.value && localStartTime.value ? localStartTime.value : undefined

  console.log('Creating task with schedule:', { schedDate, schedTime, duration: duration.value })

  const instanceData: { id: string; scheduledDate: string; duration: number; scheduledTime?: string } = {
    id: `instance-${Date.now()}`,
    scheduledDate: schedDate,
    duration: duration.value
  }

  // Only add scheduledTime if time is set
  if (schedTime) {
    instanceData.scheduledTime = schedTime
  }

  const task = await taskStore.createTask({
    title: taskTitle.value.trim(),
    description: taskDescription.value.trim(),
    priority: priority.value,
    status: 'planned',
    estimatedDuration: duration.value,
    projectId: projectId.value || undefined,
    instances: [instanceData]
  })

  emit('created', task)
  emit('close')

  // Reset form
  taskTitle.value = ''
  taskDescription.value = ''
  priority.value = 'medium'
  duration.value = props.duration
  projectId.value = ''
  localDate.value = ''
  localStartTime.value = ''
  localEndTime.value = ''
  hasTime.value = true
}

// Focus input when modal opens and initialize from props
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Reset form when opening
    taskTitle.value = ''
    taskDescription.value = ''
    priority.value = 'medium'
    duration.value = props.duration
    projectId.value = ''

    // Initialize date/time from props
    localDate.value = props.startTime.toISOString().split('T')[0]
    localStartTime.value = formatTimeForInput(props.startTime)
    localEndTime.value = formatTimeForInput(props.endTime)
    hasTime.value = true

    nextTick(() => {
      titleInput.value?.focus()
    })
  }
}, { immediate: true })
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px) saturate(120%);
  -webkit-backdrop-filter: blur(8px) saturate(120%);
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
  background: rgba(20, 20, 40, 0.85);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-xl);
  box-shadow:
    0 32px 64px rgba(0, 0, 0, 0.5),
    0 16px 32px rgba(0, 0, 0, 0.3);
  padding: var(--space-6);
  width: 520px;
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

/* Section Labels */
.section-label {
  display: block;
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: var(--space-2);
  opacity: 0.7;
}

/* Date & Time Section */
.date-time-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  padding: var(--space-4);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
}

.date-picker-section {
  flex: 1;
}

.date-display {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  position: relative;
}

.date-display:hover,
.date-display:focus-within {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

.date-display:focus-within {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
}

.date-input-hidden {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  cursor: pointer;
}

.date-input-hidden::-webkit-calendar-picker-indicator {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  cursor: pointer;
  opacity: 0;
}

.quick-date-shortcuts {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.quick-date-btn {
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.quick-date-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--text-secondary);
}

.quick-date-btn.active {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text-primary);
}

/* Time Section */
.time-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.time-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-muted);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.toggle-checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--text-secondary);
  cursor: pointer;
}

.toggle-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.time-inputs {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.time-input {
  padding: var(--space-1) var(--space-2);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  color-scheme: dark;
}

.time-input:focus {
  border-color: rgba(255, 255, 255, 0.2);
}

.time-separator {
  color: var(--text-muted);
}

/* Properties Row */
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  transition: all var(--duration-fast);
}

.property-chip:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

/* Property select wrapper with icon */
.property-select {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  position: relative;
}

.property-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  position: absolute;
  left: var(--space-3);
  z-index: 1;
  pointer-events: none;
}

/* Compact CustomSelect styling */
.compact-select {
  min-width: 100px;
}

.compact-select :deep(.select-trigger) {
  padding: var(--space-2) var(--space-3);
  padding-left: calc(var(--space-3) + 14px + var(--space-2));
  min-height: auto;
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.compact-select :deep(.select-trigger:hover) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: none;
}

.compact-select :deep(.select-trigger:focus),
.compact-select :deep(.select-trigger.is-open) {
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: none;
}

.compact-select :deep(.select-icon.is-open) {
  color: var(--text-primary);
}

.duration-chip {
  gap: var(--space-2);
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

/* Actions Row */
.actions-row {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding-top: var(--space-4);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.cancel-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.create-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.create-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
