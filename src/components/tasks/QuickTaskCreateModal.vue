<template>
  <BaseModal
    :is-open="isOpen"
    title="Create New Task"
    description="Enter task details"
    size="md"
    :show-footer="false"
    close-on-overlay-click
    close-on-escape
    @close="$emit('cancel')"
    @after-open="handleAfterOpen"
  >
    <!-- Task Form -->
    <div class="task-form">
      <!-- Title Input -->
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
          maxlength="200"
          @keydown.enter="handleCreateTask"
          @keydown.esc="$emit('cancel')"
        >

        <!-- Mic button for voice input -->
        <button
          v-if="isVoiceSupported"
          class="mic-btn"
          :class="[{ recording: isListening, processing: isProcessingVoice }]"
          :title="isListening ? 'Stop recording' : (isProcessingVoice ? 'Processing...' : 'Voice input')"
          :disabled="isProcessingVoice"
          type="button"
          @click="toggleVoiceInput"
        >
          <Loader2 v-if="isProcessingVoice" :size="18" class="spin" />
          <Mic v-else-if="!isListening" :size="18" />
          <MicOff v-else :size="18" />
        </button>
      </div>

      <!-- Voice feedback (when recording) -->
      <div v-if="isListening || isProcessingVoice" class="voice-feedback">
        <div class="voice-waveform">
          <span class="wave-bar" />
          <span class="wave-bar" />
          <span class="wave-bar" />
          <span class="wave-bar" />
          <span class="wave-bar" />
        </div>
        <span class="voice-status">
          {{ isProcessingVoice ? 'Processing audio...' : (displayTranscript || 'Speak now...') }}
        </span>
        <button class="voice-cancel" type="button" @click="cancelVoice">
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
        @keydown.enter="handleCreateTask"
        @keydown.esc="$emit('cancel')"
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
      </div>

      <!-- Details Section -->
      <span class="section-label">Details</span>
      <div class="properties-row">
        <!-- Status Dropdown -->
        <div class="property-select">
          <CheckCircle :size="14" class="property-icon" />
          <CustomSelect
            v-model="status"
            :options="statusOptions"
            class="compact-select"
          />
        </div>

        <!-- Priority Dropdown -->
        <div class="property-select">
          <Flag :size="14" class="property-icon" />
          <CustomSelect
            v-model="priority"
            :options="priorityOptions"
            class="compact-select"
          />
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
        <button class="cancel-btn" type="button" @click="$emit('cancel')">
          Cancel
        </button>
        <button
          class="create-btn"
          type="button"
          :disabled="!taskTitle.trim()"
          @click="handleCreateTask"
        >
          Add task
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Calendar, Flag, Inbox, CheckCircle, Mic, MicOff, X, Loader2 } from 'lucide-vue-next'
import BaseModal from '@/components/base/BaseModal.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import { useTaskStore } from '@/stores/tasks'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'
import { statusOptions } from '@/components/tasks/context-menu/constants'

interface Props {
  isOpen: boolean
  loading?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  cancel: []
  create: [data: {
    title: string
    description: string
    status: string
    priority: 'low' | 'medium' | 'high'
    dueDate?: string
    projectId?: string
  }]
}>()

const taskStore = useTaskStore()

// Template refs
const titleInput = ref<HTMLInputElement>()
const dateInputRef = ref<HTMLInputElement>()

// Form state
const taskTitle = ref('')
const taskDescription = ref('')
const status = ref<string>('planned')
const priority = ref<'low' | 'medium' | 'high'>('medium')
const projectId = ref<string>('')
const localDate = ref('')

// Hebrew alignment
const { getAlignmentClasses, applyInputAlignment } = useHebrewAlignment()

// Computed properties for Hebrew text alignment
const titleAlignmentClasses = computed(() => getAlignmentClasses(taskTitle.value))
const titleAlignmentStyles = computed(() => applyInputAlignment(taskTitle.value))

// Voice input with Whisper
const {
  isRecording: isListening,
  isProcessing: isProcessingVoice,
  isSupported: isWhisperSupported,
  hasApiKey: hasWhisperApiKey,
  transcript: displayTranscript,
  start: startWhisper,
  stop: stopWhisper,
  cancel: cancelWhisper
} = useWhisperSpeech({
  onResult: (result) => {
    if (result.transcript.trim()) {
      taskTitle.value = result.transcript.trim()
    }
  },
  onError: (err) => {
    console.warn('[QuickTaskCreateModal] Whisper error:', err)
  }
})

const isVoiceSupported = computed(() => isWhisperSupported.value && hasWhisperApiKey.value)

// Toggle voice recording
const toggleVoiceInput = async () => {
  if (isListening.value) {
    stopWhisper()
  } else {
    await startWhisper()
  }
}

// Cancel voice recording
const cancelVoice = () => {
  cancelWhisper()
}

// Options for CustomSelect dropdowns
const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' }
]

const projects = computed(() => taskStore.projects)

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

// Handle after open to focus the title input
const handleAfterOpen = () => {
  nextTick(() => {
    // Focus the title input for immediate typing
    titleInput.value?.focus()
    // Select all text so user can immediately type
    titleInput.value?.select()
  })
}

// Handle task creation
const handleCreateTask = () => {
  const trimmedTitle = taskTitle.value.trim()
  if (!trimmedTitle) return

  emit('create', {
    title: trimmedTitle,
    description: taskDescription.value.trim(),
    status: status.value,
    priority: priority.value,
    dueDate: localDate.value || undefined,
    projectId: projectId.value || undefined
  })

  // Reset form
  taskTitle.value = ''
  taskDescription.value = ''
  status.value = 'planned'
  priority.value = 'medium'
  projectId.value = ''
  localDate.value = ''
}

// Reset form when modal opens
watch(() => _props.isOpen, (isOpen) => {
  if (isOpen) {
    taskTitle.value = ''
    taskDescription.value = ''
    status.value = 'planned'
    priority.value = 'medium'
    projectId.value = ''
    localDate.value = ''
  }
})
</script>

<style scoped>
.task-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Title Row with Voice Button */
.title-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.title-input {
  flex: 1;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  padding: var(--space-2) 0;
  outline: none;
}

.title-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

/* Mic Button */
.mic-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.mic-btn:hover:not(:disabled) {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.mic-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.mic-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mic-btn.recording {
  background: var(--danger-text, #ef4444);
  color: white;
  animation: pulse-recording 1.5s ease-in-out infinite;
}

.mic-btn.processing {
  background: var(--brand-primary, #3b82f6);
  color: white;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse-recording {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
}

/* Voice feedback panel */
.voice-feedback {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 20px;
}

.wave-bar {
  width: 3px;
  height: 6px;
  background: var(--danger-text, #ef4444);
  border-radius: 2px;
  animation: wave 0.8s ease-in-out infinite;
}

.wave-bar:nth-child(1) { animation-delay: 0s; }
.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.3s; }
.wave-bar:nth-child(4) { animation-delay: 0.3s; }
.wave-bar:nth-child(5) { animation-delay: 0.4s; }

@keyframes wave {
  0%, 100% { height: 6px; }
  50% { height: 16px; }
}

.voice-status {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-cancel {
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

.voice-cancel:hover {
  background: var(--glass-bg);
  color: var(--danger-text, #ef4444);
}

.description-input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  padding: var(--space-2) 0;
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
  margin-top: var(--space-2);
  opacity: 0.7;
}

/* Date & Time Section */
.date-time-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
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

/* Properties Row */
.properties-row {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
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
  min-width: 120px;
}

.compact-select :deep(.select-trigger) {
  padding: var(--space-2) var(--space-3);
  padding-left: calc(var(--space-3) + 14px + var(--space-2));
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
  border-color: rgba(255, 255, 255, 0.3);
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive Design */
@media (max-width: 768px) {
  .date-time-row {
    flex-direction: column;
  }

  .properties-row {
    flex-direction: column;
  }

  .property-select {
    width: 100%;
  }

  .compact-select {
    width: 100%;
  }
}
</style>