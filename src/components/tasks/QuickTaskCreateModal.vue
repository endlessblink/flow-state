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
          @paste="handlePaste"
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
        @keydown.enter="handleCreateTask"
        @keydown.esc="$emit('cancel')"
      >

      <!-- Schedule Section -->
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
      <div class="properties-row">
        <!-- Status Dropdown -->
        <div class="property-select">
          <CheckCircle :size="14" class="property-icon" />
          <CustomSelect
            v-model="status"
            :options="(statusOptions as any)"
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
import { Calendar, Flag, Inbox, CheckCircle, Mic, MicOff, X, Loader2, Globe } from 'lucide-vue-next'
import BaseModal from '@/components/base/BaseModal.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import { useTaskStore } from '@/stores/tasks'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'
import { useUrlScraping } from '@/composables/useUrlScraping'
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

  cancelScraping() // Cancel any in-progress scrape
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
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  transition: all var(--duration-fast) var(--ease-out);
}

.title-row:hover {
  border-color: var(--border-medium);
}

.title-row:focus-within {
  border-color: var(--purple-border-medium);
  box-shadow: var(--purple-glow-subtle);
}

.title-input {
  flex: 1;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  padding: 0;
  outline: none;
}

.title-input::placeholder {
  color: var(--text-tertiary);
  opacity: 0.8;
}

/* Mic Button - Progressive Disclosure */
.mic-btn {
  width: var(--space-9);
  height: var(--space-9);
  border-radius: var(--radius-full);
  border: none;
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity var(--duration-fast) var(--ease-out),
              background var(--duration-fast) var(--ease-out),
              transform var(--duration-fast) var(--ease-out);
}

.title-row:hover .mic-btn,
.title-row:focus-within .mic-btn {
  opacity: 1;
}

.mic-btn:hover:not(:disabled) {
  background: var(--purple-bg-subtle);
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
  background: var(--danger-gradient-start);
  color: white;
  opacity: 1;
  animation: pulse-recording 1.5s ease-in-out infinite;
}

.mic-btn.processing {
  background: var(--purple-gradient-start);
  color: white;
  opacity: 1;
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
    box-shadow: 0 0 0 0 var(--danger-glow-medium);
  }
  50% {
    box-shadow: 0 0 0 var(--space-2) transparent;
  }
}

/* Voice feedback panel */
.voice-feedback {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
  border: 1px solid var(--purple-border-subtle);
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: var(--space-0_5);
  height: var(--space-5);
}

.wave-bar {
  width: var(--space-0_75);
  height: var(--space-1_5);
  background: var(--danger-text);
  border-radius: var(--radius-xs);
  animation: wave var(--duration-normal) ease-in-out infinite;
}

.wave-bar:nth-child(1) { animation-delay: 0s; }
.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.3s; }
.wave-bar:nth-child(4) { animation-delay: 0.3s; }
.wave-bar:nth-child(5) { animation-delay: 0.4s; }

@keyframes wave {
  0%, 100% { height: var(--space-1_5); }
  50% { height: var(--space-4); }
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
  width: var(--space-6);
  height: var(--space-6);
  border-radius: var(--radius-full);
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
  color: var(--danger-text);
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
}

.scraping-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
  animation: spin 1.5s linear infinite;
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

/* Description Input - Glass Container */
.description-input {
  width: 100%;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  padding: var(--space-3);
  outline: none;
  transition: all var(--duration-fast) var(--ease-out);
}

.description-input:hover {
  border-color: var(--border-medium);
}

.description-input:focus {
  border-color: var(--purple-border-medium);
  box-shadow: var(--purple-glow-subtle);
}

.description-input::placeholder {
  color: var(--text-tertiary);
  opacity: 0.8;
}

/* Date & Time Section - NO Container Background */
.date-time-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-block-start: var(--space-2);
}

.date-picker-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.date-display {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  position: relative;
}

.date-display:hover {
  border-color: var(--border-medium);
}

.date-display:focus-within {
  border-color: var(--purple-border-medium);
  box-shadow: var(--purple-glow-subtle);
}

.date-input-hidden {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  inset-block-start: 0;
  inset-inline-start: 0;
  cursor: pointer;
}

.date-input-hidden::-webkit-calendar-picker-indicator {
  position: absolute;
  width: 100%;
  height: 100%;
  inset-block-start: 0;
  inset-inline-start: 0;
  cursor: pointer;
  opacity: 0;
}

.quick-date-shortcuts {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.quick-date-btn {
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.quick-date-btn:hover {
  background: var(--glass-bg-light);
  border-color: var(--border-medium);
  color: var(--text-secondary);
}

.quick-date-btn.active {
  background: var(--purple-bg-subtle);
  border-color: var(--purple-border-medium);
  color: var(--text-primary);
}

/* Properties Row */
.properties-row {
  display: flex;
  gap: var(--space-2);
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
  inset-inline-start: var(--space-3);
  z-index: 1;
  pointer-events: none;
}

/* Compact CustomSelect styling */
.compact-select {
  min-width: 120px;
}

.compact-select :deep(.select-trigger) {
  padding: var(--space-3);
  padding-inline-start: calc(var(--space-3) + 14px + var(--space-2));
  min-height: auto;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-out);
}

.compact-select :deep(.select-trigger:hover) {
  background: var(--glass-bg-light);
  border-color: var(--border-medium);
  box-shadow: none;
}

.compact-select :deep(.select-trigger:focus),
.compact-select :deep(.select-trigger.is-open) {
  border-color: var(--purple-border-medium);
  box-shadow: var(--purple-glow-subtle);
}

.compact-select :deep(.select-icon.is-open) {
  color: var(--text-primary);
}

/* Actions Row */
.actions-row {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding-block-start: var(--space-4);
  border-block-start: 1px solid var(--border-subtle);
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.cancel-btn:hover {
  background: var(--glass-bg-light);
  border-color: var(--border-strong);
}

.create-btn {
  background: var(--purple-gradient-start);
  border: 1px solid var(--purple-border-medium);
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.create-btn:hover:not(:disabled) {
  background: var(--purple-gradient-hover-start);
  border-color: var(--purple-border-strong);
  box-shadow: var(--purple-shadow-medium);
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive Design */
@media (max-width: 768px) {
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