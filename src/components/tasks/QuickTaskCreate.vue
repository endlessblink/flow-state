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
      <!-- Task Title Input with AI Assist -->
      <div class="title-row">
        <input
          ref="titleInput"
          v-model="taskTitle"
          type="text"
          placeholder="Task name"
          aria-label="Task name"
          class="title-input"
          :class="[titleAlignmentClasses]"
          :style="titleAlignmentStyles"
          @keydown.enter="handleCreate"
          @keydown.esc="$emit('close')"
          @paste="handlePaste"
        >
        <button
          ref="aiAssistBtnRef"
          class="ai-assist-btn"
          :disabled="!taskTitle.trim()"
          title="AI Assist"
          @click="openAIAssist"
        >
          <Sparkles :size="14" />
        </button>
      </div>

      <!-- TASK-1325: URL scraping feedback -->
      <div v-if="isScraping" class="url-scraping-feedback">
        <Globe :size="16" class="scraping-icon" />
        <span class="scraping-status">Fetching page info...</span>
        <button class="scraping-cancel" type="button" @click="cancelScraping">
          <X :size="14" />
        </button>
      </div>

      <!-- Description Input -->
      <input
        v-model="taskDescription"
        type="text"
        placeholder="Description"
        aria-label="Task description"
        class="description-input"
        :class="[descAlignmentClasses]"
        :style="descAlignmentStyles"
        @keydown.enter="handleCreate"
        @keydown.esc="$emit('close')"
      >

      <!-- Schedule Section -->
      <span class="section-label">Schedule</span>
      <div class="date-time-row">
        <!-- Date Picker -->
        <div class="date-picker-section">
          <div class="date-display" @click="openDatePicker">
            <Calendar :size="14" />
            <span>{{ formattedDate }}</span>
            <input
              ref="dateInputRef"
              type="date"
              class="date-input-hidden"
              :value="localDate"
              aria-label="Due date"
              @change="updateDate"
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

      <!-- AI Assist Popover -->
      <AITaskAssistPopover
        :is-visible="showAIAssist"
        :task="aiAssistTaskProxy"
        :x="aiAssistPosition.x"
        :y="aiAssistPosition.y"
        context="quick-create"
        @close="showAIAssist = false"
        @accept-priority="handleAIAcceptPriority"
        @accept-date="handleAIAcceptDate"
        @accept-title="handleAIAcceptTitle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Calendar, Flag, Clock, Inbox, Sparkles, Globe, X } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'
import CustomSelect from '@/components/common/CustomSelect.vue'
import AITaskAssistPopover from '@/components/ai/AITaskAssistPopover.vue'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'
import { useUrlScraping } from '@/composables/useUrlScraping'

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

// AI Assist
const showAIAssist = ref(false)
const aiAssistBtnRef = ref<HTMLElement | null>(null)
const aiAssistPosition = ref({ x: 0, y: 0 })

// Date and time state
const localDate = ref('')
const localStartTime = ref('')
const localEndTime = ref('')
const hasTime = ref(true) // Time is enabled by default when coming from calendar

// Hebrew alignment
const { getAlignmentClasses, applyInputAlignment } = useHebrewAlignment()
const titleAlignmentClasses = computed(() => getAlignmentClasses(taskTitle.value))
const titleAlignmentStyles = computed(() => applyInputAlignment(taskTitle.value))
const descAlignmentClasses = computed(() => getAlignmentClasses(taskDescription.value))
const descAlignmentStyles = computed(() => applyInputAlignment(taskDescription.value))

// TASK-1325: URL scraping on paste
const { isScraping, scrapeIfUrl, cancel: cancelScraping } = useUrlScraping()

const handlePaste = async (e: ClipboardEvent) => {
  const text = e.clipboardData?.getData('text') || ''
  if (!text.trim()) return

  const result = await scrapeIfUrl(text)
  if (result) {
    taskTitle.value = result.title
    taskDescription.value = result.description
  }
}

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

// Proxy task for AI Assist (QuickTaskCreate doesn't have a full Task yet)
const aiAssistTaskProxy = computed(() => ({
  id: '',
  title: taskTitle.value,
  description: taskDescription.value,
  status: 'planned' as const,
  priority: priority.value,
  progress: 0,
  completedPomodoros: 0,
  subtasks: [],
  dueDate: localDate.value,
  estimatedDuration: duration.value,
  projectId: projectId.value,
  createdAt: new Date(),
  updatedAt: new Date()
}))

// AI Assist handlers
function openAIAssist() {
  const btn = aiAssistBtnRef.value
  if (btn) {
    const rect = btn.getBoundingClientRect()
    aiAssistPosition.value = { x: rect.right + 4, y: rect.top }
  }
  showAIAssist.value = true
}

function handleAIAcceptPriority(p: string, dur: number) {
  const validPriority = ['low', 'medium', 'high'].includes(p) ? p as 'low' | 'medium' | 'high' : undefined
  if (validPriority) priority.value = validPriority
  if (dur && dur > 0) duration.value = dur
  showAIAssist.value = false
}

function handleAIAcceptDate(date: string) {
  localDate.value = date
  showAIAssist.value = false
}

function handleAIAcceptTitle(title: string) {
  taskTitle.value = title
  showAIAssist.value = false
}

const handleCreate = async () => {
  if (!taskTitle.value.trim()) return

  cancelScraping() // Cancel any in-progress scrape
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
// BUG-1335: Auto-select the active project so tasks inherit the current sidebar selection
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Reset form when opening
    taskTitle.value = ''
    taskDescription.value = ''
    priority.value = 'medium'
    duration.value = props.duration
    projectId.value = taskStore.activeProjectId || ''

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
  inset: 0;
  background: var(--overlay-heavy);
  backdrop-filter: var(--blur-medium) saturate(120%);
  -webkit-backdrop-filter: var(--blur-medium) saturate(120%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  animation: fadeIn var(--duration-faster) var(--ease-in);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.quick-create-modal {
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop) saturate(150%);
  -webkit-backdrop-filter: var(--overlay-component-backdrop) saturate(150%);
  border: var(--overlay-component-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  padding: var(--space-6);
  width: var(--modal-width-md);
  max-width: 90vw;
  animation: slideUp var(--duration-fast) var(--spring-smooth);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(var(--space-5));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Title Row with AI Assist */
.title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.title-row .title-input {
  flex: 1;
  margin-bottom: 0;
}

.ai-assist-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--brand-primary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.ai-assist-btn:hover:not(:disabled) {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-primary);
}

.ai-assist-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  color: var(--text-muted);
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

/* TASK-1325: URL Scraping Feedback */
.url-scraping-feedback {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--brand-primary);
  margin-bottom: var(--space-2);
}

.scraping-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
  animation: scrapeSpin 1.5s linear infinite;
}

@keyframes scrapeSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.scraping-status {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--brand-primary);
}

.scraping-cancel {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.scraping-cancel:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
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
  font-size: var(--text-xs);
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
  background: var(--glass-bg-light);
  border: 1px solid var(--border-subtle);
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
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  position: relative;
}

.date-display:hover,
.date-display:focus-within {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border-hover);
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
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.quick-date-btn:hover {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

.quick-date-btn.active {
  background: var(--glass-border);
  border-color: var(--border-hover);
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
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  color-scheme: dark;
}

.time-input:focus {
  border-color: var(--border-hover);
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
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  transition: all var(--duration-fast);
}

.property-chip:hover {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border-hover);
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
  inset-inline-start: var(--space-3);
  z-index: 1;
  pointer-events: none;
}

/* Compact CustomSelect styling */
.compact-select {
  min-width: 100px;
}

.compact-select :deep(.select-trigger) {
  padding: var(--space-2) var(--space-3);
  padding-inline-start: calc(var(--space-3) + 14px + var(--space-2));
  min-height: auto;
  background: var(--glass-bg-tint);
  border-color: var(--glass-border);
}

.compact-select :deep(.select-trigger:hover) {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border-hover);
  box-shadow: none;
}

.compact-select :deep(.select-trigger:focus),
.compact-select :deep(.select-trigger.is-open) {
  border-color: var(--border-hover);
  box-shadow: none;
}

.compact-select :deep(.select-icon.is-open) {
  color: var(--text-primary);
}

.duration-chip {
  gap: var(--space-2);
}

.duration-input {
  width: var(--space-10);
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
  border-top: 1px solid var(--border-subtle);
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--glass-border-hover);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.cancel-btn:hover {
  background: var(--glass-bg-soft);
  border-color: var(--border-hover);
}

.create-btn {
  background: var(--glass-border);
  border: 1px solid var(--border-hover);
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.create-btn:hover:not(:disabled) {
  background: var(--glass-border-hover);
  border-color: var(--glass-border-strong);
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
