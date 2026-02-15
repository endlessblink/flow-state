<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="isOpen"
        class="sheet-overlay"
        @click="handleCancel"
        @touchmove.prevent
      >
        <div
          class="task-create-sheet"
          :class="{ 'sheet-active': isOpen }"
          @click.stop
          @touchmove.stop
        >
          <!-- Header: Cancel | New Task | Add/Stop -->
          <div class="sheet-header">
            <button class="header-btn cancel-btn" @click="handleCancel">
              Cancel
            </button>
            <h3 class="sheet-title">
              {{ isListening ? 'Recording...' : isProcessing ? 'Processing...' : 'New Task' }}
            </h3>
            <!-- Show Stop when recording, spinner when processing, Add when idle -->
            <button
              v-if="isListening"
              class="header-btn stop-btn"
              @click="emit('stopRecording')"
            >
              Stop
            </button>
            <button
              v-else-if="isProcessing"
              class="header-btn processing-btn"
              disabled
            >
              <div class="btn-spinner" />
            </button>
            <button
              v-else
              class="header-btn add-btn"
              :disabled="!taskTitle.trim()"
              @click="handleCreate"
            >
              Add
            </button>
          </div>

          <!-- Create Form -->
          <div class="create-form">
            <!-- Single text block for task content -->
            <textarea
              ref="titleInputRef"
              v-model="taskTitle"
              :dir="titleDirection"
              class="task-text-block"
              placeholder="What needs to be done?&#10;&#10;Add notes here..."
              @input="autoResize"
            />

            <!-- Compact options -->
            <div class="compact-options">
              <!-- Due Date chips -->
              <div class="option-group">
                <Calendar :size="14" class="option-icon" />
                <button
                  class="chip"
                  :class="{ active: isDueToday }"
                  @click="setDueDate('today')"
                >
                  Today
                </button>
                <button
                  class="chip"
                  :class="{ active: isDueTomorrow }"
                  @click="setDueDate('tomorrow')"
                >
                  Tomorrow
                </button>
                <button
                  class="chip"
                  :class="{ active: isDueNextWeek }"
                  @click="setDueDate('nextWeek')"
                >
                  +1wk
                </button>
                <button
                  class="chip"
                  :class="{ active: hasCustomDate }"
                  @click="showDatePicker = true"
                >
                  {{ hasCustomDate ? formatDate(taskDueDate!) : 'Pick' }}
                </button>
                <button
                  v-if="taskDueDate"
                  class="chip clear"
                  @click="clearDueDate"
                >
                  <X :size="12" />
                </button>
              </div>
              <input
                v-show="showDatePicker"
                ref="datePickerRef"
                v-model="taskDueDateInput"
                type="date"
                class="native-date-picker"
                @change="handleDatePickerChange"
                @blur="showDatePicker = false"
              >

              <!-- Priority chips -->
              <div class="option-group">
                <Flag :size="14" class="option-icon" />
                <button
                  v-for="option in priorityOptions"
                  :key="option.value"
                  class="chip"
                  :class="[`priority-${option.value}`, { active: taskPriority === option.value }]"
                  @click="taskPriority = option.value"
                >
                  {{ option.label }}
                </button>
                <button
                  class="chip"
                  :class="{ active: taskPriority === null }"
                  @click="taskPriority = null"
                >
                  None
                </button>
              </div>
            </div>

            <!-- Voice Feedback (Recording or Processing) -->
            <div v-if="isListening || isProcessing" class="voice-feedback" :class="{ processing: isProcessing }">
              <div class="voice-indicator">
                <div v-if="isProcessing" class="processing-spinner" />
                <div v-else class="voice-pulse" />
                <span>{{ isProcessing ? 'Transcribing audio...' : 'Listening...' }}</span>
              </div>
              <p v-if="voiceTranscript" class="voice-transcript">
                {{ voiceTranscript }}
              </p>
              <button v-if="isListening" class="stop-recording-btn" @click="emit('stopRecording')">
                <Square :size="16" />
                <span>Stop Recording</span>
              </button>
            </div>

            <!-- Re-record button (TASK-1110) - Shows when voice is supported and not actively recording -->
            <button
              v-if="canReRecord && !isListening && !isProcessing"
              class="rerecord-btn"
              @click="emit('startRecording')"
            >
              <Mic :size="16" />
              <span>{{ taskTitle.trim() ? 'Re-record' : 'Record' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  Flag, Calendar, CalendarPlus, CalendarDays, X, Square, Mic
} from 'lucide-vue-next'
import { useVoiceNLPParser } from '@/composables/useVoiceNLPParser'

interface Props {
  isOpen: boolean
  isListening?: boolean
  isProcessing?: boolean
  voiceTranscript?: string
  canReRecord?: boolean  // TASK-1110: Allow re-recording
}

const props = withDefaults(defineProps<Props>(), {
  isListening: false,
  isProcessing: false,
  voiceTranscript: '',
  canReRecord: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', data: TaskCreationData): void
  (e: 'stopRecording'): void
  (e: 'startRecording'): void  // TASK-1110: Request re-recording
}>()

interface TaskCreationData {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low' | null
  dueDate: Date | null
}

// Form state
const taskTitle = ref('')
const taskDescription = ref('')
const taskPriority = ref<'low' | 'medium' | 'high' | null>(null)
const taskDueDate = ref<Date | null>(null)
const taskDueDateInput = ref('')
const showDatePicker = ref(false)

// Refs
const titleInputRef = ref<HTMLTextAreaElement | null>(null)
const datePickerRef = ref<HTMLInputElement | null>(null)

// Options
const priorityOptions = [
  { value: 'high' as const, label: 'High' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'low' as const, label: 'Low' }
]

// Computed
const isDueToday = computed(() => {
  if (!taskDueDate.value) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(taskDueDate.value)
  dueDate.setHours(0, 0, 0, 0)
  return dueDate.getTime() === today.getTime()
})

const isDueTomorrow = computed(() => {
  if (!taskDueDate.value) return false
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const dueDate = new Date(taskDueDate.value)
  dueDate.setHours(0, 0, 0, 0)
  return dueDate.getTime() === tomorrow.getTime()
})

const isDueNextWeek = computed(() => {
  if (!taskDueDate.value) return false
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  nextWeek.setHours(0, 0, 0, 0)
  const dueDate = new Date(taskDueDate.value)
  dueDate.setHours(0, 0, 0, 0)
  return dueDate.getTime() === nextWeek.getTime()
})

// BUG-1108: RTL detection for title text (Hebrew, Arabic, Persian, Urdu)
const titleDirection = computed(() => {
  if (!taskTitle.value.trim()) return 'auto'
  const firstChar = taskTitle.value.trim()[0]
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
})

const hasCustomDate = computed(() => {
  return taskDueDate.value !== null && !isDueToday.value && !isDueTomorrow.value && !isDueNextWeek.value
})

// NLP Parser for voice transcripts
const { parseTranscription } = useVoiceNLPParser()

// Watch for voice transcript and parse it with NLP
watch(() => props.voiceTranscript, (transcript) => {
  if (transcript && transcript.trim()) {
    // Parse the transcript to extract title, date, priority
    const parsed = parseTranscription(transcript.trim())

    // Set the cleaned title (with date/priority keywords removed)
    taskTitle.value = parsed.title

    // Set priority if detected
    if (parsed.priority) {
      taskPriority.value = parsed.priority
    }

    // Set due date if detected
    if (parsed.dueDate) {
      const date = new Date(parsed.dueDate + 'T00:00:00')
      if (!isNaN(date.getTime())) {
        taskDueDate.value = date
        taskDueDateInput.value = parsed.dueDate
      }
    }

    if (import.meta.env.DEV) {
      console.log('[VoiceNLP] Parsed:', parsed)
    }
  }
})

// Focus title input when opened
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    titleInputRef.value?.focus()
  } else {
    // Reset form when closed
    resetForm()
  }
})

// Watch for date picker visibility
watch(showDatePicker, async (show) => {
  if (show) {
    await nextTick()
    datePickerRef.value?.focus()
    datePickerRef.value?.showPicker?.()
  }
})

// Actions
function setDueDate(preset: 'today' | 'tomorrow' | 'nextWeek') {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  if (preset === 'tomorrow') {
    date.setDate(date.getDate() + 1)
  } else if (preset === 'nextWeek') {
    date.setDate(date.getDate() + 7)
  }

  taskDueDate.value = date
  taskDueDateInput.value = date.toISOString().split('T')[0]
  triggerHaptic(10)
}

function clearDueDate() {
  taskDueDate.value = null
  taskDueDateInput.value = ''
  triggerHaptic(10)
}

function handleDatePickerChange() {
  if (taskDueDateInput.value) {
    const date = new Date(taskDueDateInput.value + 'T00:00:00')
    taskDueDate.value = date
  }
  showDatePicker.value = false
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function handleCancel() {
  triggerHaptic(10)
  emit('close')
}

function handleCreate() {
  if (!taskTitle.value.trim()) return

  triggerHaptic(30)

  const data: TaskCreationData = {
    title: taskTitle.value.trim(),
    description: taskDescription.value.trim(),
    priority: taskPriority.value,
    dueDate: taskDueDate.value
  }

  emit('created', data)
  emit('close')
}

function resetForm() {
  taskTitle.value = ''
  taskDescription.value = ''
  taskPriority.value = null
  taskDueDate.value = null
  taskDueDateInput.value = ''
  showDatePicker.value = false
}

function triggerHaptic(duration: number = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration)
    } catch {
      // Vibration API not supported
    }
  }
}

// Auto-resize title textarea as user types
function autoResize(event: Event) {
  const textarea = event.target as HTMLTextAreaElement
  textarea.style.height = 'auto'
  textarea.style.height = textarea.scrollHeight + 'px'
}
</script>

<style scoped>
/* ================================
   TASK CREATE BOTTOM SHEET
   Full-screen with clean layout
   ================================ */

.sheet-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  display: flex;
  align-items: flex-start; /* Start from TOP */
  z-index: var(--z-modal);
}

.task-create-sheet {
  width: 100%;
  height: 100dvh;
  max-height: none;
  background: var(--surface-primary);
  /* No border-radius - full screen */
  border-radius: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header: Cancel | Title | Add */
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--glass-border-light);
  flex-shrink: 0;
}

.sheet-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  flex: 1;
  text-align: center;
}

.header-btn {
  min-width: var(--space-16);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.cancel-btn {
  background: transparent;
  color: var(--text-secondary);
}

.cancel-btn:active {
  background: var(--glass-bg-weak);
}

.add-btn {
  background: transparent;
  color: var(--brand-primary);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-btn:not(:disabled):active {
  transform: scale(0.96);
}

.stop-btn {
  background: var(--color-priority-high);
  color: var(--text-primary);
}

.stop-btn:active {
  transform: scale(0.96);
  background: var(--color-priority-high);
}

.processing-btn {
  background: var(--brand-primary);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-spinner {
  width: var(--icon-xl);
  height: var(--icon-xl);
  border: 2px solid var(--overlay-component-bg-lighter);
  border-top-color: var(--surface-secondary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Create Form */
.create-form {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Single text block - main writing area */
.task-text-block {
  flex: 1;
  min-height: 12.5rem;
  padding: var(--space-4);
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-lg);
  line-height: var(--leading-normal);
  font-family: inherit;
  resize: none;
  outline: none;
}

.task-text-block::placeholder {
  color: var(--text-muted);
}

/* RTL support for Hebrew/Arabic text */
.task-text-block[dir="rtl"] {
  text-align: right;
}

.task-text-block[dir="rtl"]::placeholder {
  text-align: right;
}

/* Compact options at bottom */
.compact-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
  padding-top: var(--space-3);
  border-top: 1px solid var(--glass-border-light);
}

.option-group {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  flex-wrap: wrap;
}

.option-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

/* Compact chips */
.chip {
  padding: var(--space-1_5) var(--space-2_5);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.chip:active {
  transform: scale(0.95);
}

.chip.active {
  background: var(--state-active-bg);
  border-color: var(--state-hover-border);
  color: var(--brand-primary, #4ECDC4);
}

.chip.clear {
  padding: var(--space-1_5) var(--space-2);
  color: var(--text-muted);
}

/* Priority colors */
.chip.priority-high.active {
  background: var(--danger-bg-subtle);
  border-color: var(--danger-border-strong);
  color: var(--color-priority-high);
}

.chip.priority-medium.active {
  background: var(--orange-bg-light);
  border-color: var(--color-priority-medium-border-medium);
  color: var(--color-priority-medium);
}

.chip.priority-low.active {
  background: var(--blue-bg-subtle);
  border-color: var(--blue-border-medium);
  color: var(--color-priority-low);
}

.native-date-picker {
  margin-top: var(--space-1_5);
  padding: var(--space-2);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  color-scheme: dark;
}

/* Voice Feedback */
.voice-feedback {
  padding: var(--space-4);
  background: var(--state-hover-bg);
  border: 1px solid var(--brand-border-subtle);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.voice-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.voice-pulse {
  width: var(--space-3);
  height: var(--space-3);
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  animation: pulse 1.5s ease-in-out infinite;
}

.processing-spinner {
  width: var(--icon-md);
  height: var(--icon-md);
  border: 2px solid var(--brand-border-subtle);
  border-top-color: var(--brand-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

.voice-feedback.processing {
  background: var(--orange-bg-light);
  border-color: var(--color-priority-medium-border-medium);
}

.voice-feedback.processing .voice-indicator {
  color: var(--color-priority-medium);
}

.voice-feedback.processing .processing-spinner {
  border-color: var(--color-priority-medium-border-medium);
  border-top-color: var(--color-priority-medium);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.voice-transcript {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

.stop-recording-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-6);
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-border-strong);
  border-radius: var(--radius-2xl);
  color: var(--color-priority-high);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.stop-recording-btn:active {
  transform: scale(0.96);
  background: var(--danger-bg-medium);
}

/* Re-record button (TASK-1110) */
.rerecord-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-2_5) var(--space-5);
  background: var(--state-hover-bg);
  border: 1px solid var(--brand-border-subtle);
  border-radius: var(--radius-xl);
  color: var(--brand-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.rerecord-btn:hover {
  background: var(--brand-bg-subtle);
  border-color: var(--state-hover-border);
}

.rerecord-btn:active {
  transform: scale(0.96);
  background: var(--state-active-bg);
}

/* ================================
   SHEET TRANSITIONS
   ================================ */

.sheet-enter-active,
.sheet-leave-active {
  transition: all var(--duration-slow) cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .task-create-sheet,
.sheet-leave-to .task-create-sheet {
  transform: translateY(-20px);
  opacity: 0;
}

/* ================================
   ACCESSIBILITY - REDUCED MOTION
   ================================ */

@media (prefers-reduced-motion: reduce) {
  .sheet-enter-active,
  .sheet-leave-active {
    transition: opacity var(--duration-fast) ease;
  }

  .sheet-enter-from .task-create-sheet,
  .sheet-leave-to .task-create-sheet {
    transform: none;
  }

  .voice-pulse {
    animation: none;
  }
}

/* RTL Support */
[dir="rtl"] .sheet-header {
  flex-direction: row-reverse;
}

[dir="rtl"] .form-field {
  text-align: right;
}

[dir="rtl"] .field-input,
[dir="rtl"] .field-textarea {
  text-align: right;
  direction: rtl;
}

[dir="rtl"] .priority-options,
[dir="rtl"] .date-options {
  flex-direction: row-reverse;
}

[dir="rtl"] .priority-pill,
[dir="rtl"] .date-pill {
  flex-direction: row-reverse;
}
</style>
