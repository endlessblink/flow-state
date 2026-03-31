<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="isOpen"
        class="sheet-overlay"
        @touchmove.stop
      >
        <div
          class="task-create-sheet"
          :class="{ 'sheet-active': isOpen }"
          :dir="documentDir"
          @click.stop
          @touchstart.stop
          @touchend.stop
          @touchmove.stop
        >
          <!-- Header: Cancel | New Task | Stop/Processing (no Add btn here) -->
          <div class="sheet-header">
            <button
              class="header-btn cancel-btn"
              :class="{ 'discard-warning': pendingDiscard }"
              @click="handleCancel"
            >
              {{ pendingDiscard ? 'Discard?' : 'Cancel' }}
            </button>
            <h3 class="sheet-title">
              {{ isListening ? 'Recording...' : isProcessing ? 'Processing...' : 'New Task' }}
            </h3>
            <!-- Show Stop when recording, spinner when processing, spacer when idle -->
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
            <div v-else class="header-spacer" />
          </div>

          <!-- Create Form -->
          <div class="create-form">
            <!-- Title input — single line, large -->
            <input
              ref="titleInputRef"
              v-model="taskTitle"
              dir="auto"
              class="title-input"
              placeholder="Task name"
              @paste="handlePaste"
            />

            <!-- Description label + textarea -->
            <span class="field-label">Description <span class="field-optional">optional</span></span>
            <textarea
              ref="descInputRef"
              v-model="taskDescription"
              dir="auto"
              class="desc-textarea"
              placeholder="Add notes..."
              @input="autoResizeDesc"
            />

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

            <!-- BUG-1350: Voice error feedback (shown in sheet, not just quick-add bar) -->
            <div v-if="voiceError && !isListening && !isProcessing" class="voice-error-sheet">
              <span class="voice-error-text">{{ voiceError }}</span>
              <button v-if="canReRecord" class="voice-retry-btn" @click="emit('startRecording')">
                Try Again
              </button>
            </div>

            <!-- TASK-1325: URL scraping feedback -->
            <div v-if="isScraping" class="url-scraping-feedback">
              <Globe :size="16" class="scraping-icon" />
              <span class="scraping-status">Fetching page info...</span>
              <button class="scraping-cancel" @click="cancelScraping">
                <X :size="14" />
              </button>
            </div>

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

            <!-- Bottom actions: Re-record (optional) + Add Task -->
            <div class="bottom-actions">
              <button
                v-if="canReRecord && !isListening && !isProcessing && !voiceError"
                class="action-btn rerecord-action"
                @click="emit('startRecording')"
              >
                <Mic :size="18" />
                <span>{{ taskTitle.trim() ? 'Re-record' : 'Record' }}</span>
              </button>
              <button
                class="action-btn add-action"
                :class="{ 'full-width': !canReRecord || isListening || isProcessing || voiceError }"
                :disabled="!taskTitle.trim()"
                @click="handleCreate"
              >
                <span>Add Task</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import {
  Flag, Calendar, X, Square, Mic, Globe
} from 'lucide-vue-next'
import { useVoiceNLPParser } from '@/composables/useVoiceNLPParser'
import { useUrlScraping } from '@/composables/useUrlScraping'

interface Props {
  isOpen: boolean
  isListening?: boolean
  isProcessing?: boolean
  voiceTranscript?: string
  voiceError?: string | null  // BUG-1350: Show transcription errors in sheet
  canReRecord?: boolean  // TASK-1110: Allow re-recording
  voiceSessionActive?: boolean  // BUG-1350: True during entire voice lifecycle
}

const props = withDefaults(defineProps<Props>(), {
  isListening: false,
  isProcessing: false,
  voiceTranscript: '',
  voiceError: null,
  canReRecord: false,
  voiceSessionActive: false
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

// BUG-1350: Grace period to prevent accidental immediate close on mobile
const openTimestamp = ref(0)
const OPEN_GRACE_MS = 400

// Form state
const taskTitle = ref('')
const taskDescription = ref('')
const taskPriority = ref<'low' | 'medium' | 'high' | null>(null)
const taskDueDate = ref<Date | null>(null)
const taskDueDateInput = ref('')
const showDatePicker = ref(false)

// Refs
const titleInputRef = ref<HTMLInputElement | null>(null)
const descInputRef = ref<HTMLTextAreaElement | null>(null)
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

// Keyboard detection via visualViewport — buttons pin to bottom without keyboard,
// flow naturally after chips with keyboard open
const isKeyboardOpen = ref(false)

function onViewportResize() {
  if (window.visualViewport) {
    // If viewport height is significantly less than window height, keyboard is open
    isKeyboardOpen.value = window.visualViewport.height < window.innerHeight * 0.75
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    window.visualViewport?.addEventListener('resize', onViewportResize)
    onViewportResize()
  } else {
    window.visualViewport?.removeEventListener('resize', onViewportResize)
    isKeyboardOpen.value = false
  }
}, { immediate: true })

// RTL detection for the whole sheet (detects document-level dir for Hebrew/Arabic)
const documentDir = computed(() => {
  if (typeof document !== 'undefined') {
    return document.documentElement.dir || document.body.dir || 'ltr'
  }
  return 'ltr'
})

const hasCustomDate = computed(() => {
  return taskDueDate.value !== null && !isDueToday.value && !isDueTomorrow.value && !isDueNextWeek.value
})

// NLP Parser for voice transcripts
const { parseTranscription } = useVoiceNLPParser()

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

// Watch for voice transcript and parse it with NLP
watch(() => props.voiceTranscript, (transcript) => {
  if (transcript && transcript.trim()) {
    // Parse the transcript to extract title, date, priority
    const parsed = parseTranscription(transcript.trim())

    // BUG-1350: Fall back to raw transcript if NLP strips everything
    taskTitle.value = parsed.title || transcript.trim()

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

    // BUG-1350: Focus the title input after transcript fills (keyboard wasn't opened during recording)
    nextTick(() => titleInputRef.value?.focus())

    if (import.meta.env.DEV) {
      console.log('[VoiceNLP] Parsed:', parsed)
    }
  }
})

// Focus title input when opened
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    openTimestamp.value = Date.now()
    pendingDiscard.value = false
    await nextTick()
    // BUG-1350: Don't auto-focus during recording (prevents keyboard from covering voice UI)
    if (!props.isListening && !props.isProcessing) {
      titleInputRef.value?.focus()
    }
  } else {
    // Reset form when closed
    pendingDiscard.value = false
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

// BUG-1350: Check if form has unknown user-entered content worth protecting
const hasUnsavedContent = computed(() => {
  return taskTitle.value.trim().length > 0 ||
    taskDescription.value.trim().length > 0 ||
    taskPriority.value !== null ||
    taskDueDate.value !== null
})

// BUG-1350: Track if user already confirmed discard (reset on each open)
const pendingDiscard = ref(false)

function handleCancel() {
  // BUG-1350: Don't close during active recording or processing — transcription would be lost
  if (props.isListening || props.isProcessing) return

  // BUG-1350: Block close during entire voice session (covers gaps between states)
  if (props.voiceSessionActive) return

  // BUG-1350: Grace period prevents accidental immediate close from stale touch events on mobile
  if (Date.now() - openTimestamp.value < OPEN_GRACE_MS) return

  // BUG-1350: If form has content, require double-tap to discard
  if (hasUnsavedContent.value && !pendingDiscard.value) {
    pendingDiscard.value = true
    triggerHaptic(30)
    // Auto-reset after 3 seconds if user doesn't confirm
    setTimeout(() => { pendingDiscard.value = false }, 3000)
    return
  }

  pendingDiscard.value = false
  triggerHaptic(10)
  emit('close')
}

function handleCreate() {
  if (!taskTitle.value.trim()) return

  cancelScraping() // Cancel any in-progress scrape
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

onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', onViewportResize)
})

// Auto-resize description textarea as user types
function autoResizeDesc(event: Event) {
  const textarea = event.target as HTMLTextAreaElement
  textarea.style.height = 'auto'
  textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px'
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
  align-items: flex-start;
  z-index: var(--z-modal);
  overflow-y: auto;
  /* Prevent keyboard from shrinking the overlay */
  min-height: -webkit-fill-available;
}

.task-create-sheet {
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  background: var(--surface-primary);
  /* No border-radius - full screen */
  border-radius: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  /* Prevent mobile keyboard from shrinking the sheet */
  min-height: -webkit-fill-available;
}

/* Header: Cancel | Title | Stop/Processing (spacer when idle) */
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

/* Spacer keeps "New Task" centered when no right-side button */
.header-spacer {
  min-width: var(--space-16);
}

.cancel-btn {
  background: transparent;
  color: var(--text-secondary);
  transition: all var(--duration-normal) ease;
}

.cancel-btn:active {
  background: var(--glass-bg-weak);
}

/* BUG-1350: Discard warning state — red text to signal destructive action */
.cancel-btn.discard-warning {
  color: var(--color-priority-high);
  font-weight: var(--font-bold);
  animation: discard-pulse 0.3s ease-out;
}

@keyframes discard-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
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
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  backdrop-filter: blur(8px);
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
  padding: var(--space-3);
  padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Title input — single line, large, semibold */
.title-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--glass-border-light);
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  font-family: inherit;
  outline: none;
}

.title-input::placeholder {
  color: var(--text-muted);
}

.title-input:focus {
  border-bottom-color: var(--brand-primary);
}

/* Field label for description */
.field-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--space-2) var(--space-4) 0;
}

.field-optional {
  font-weight: var(--font-normal);
  text-transform: none;
  letter-spacing: normal;
  color: var(--text-tertiary);
}

/* Description textarea — shorter, auto-resize */
.desc-textarea {
  width: 100%;
  min-height: 60px;
  max-height: 100px;
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  font-family: inherit;
  resize: none;
  outline: none;
}

.desc-textarea::placeholder {
  color: var(--text-muted);
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
  width: var(--icon-2xl);
  height: var(--icon-2xl);
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

.scraping-cancel:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
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

/* BUG-1350: Voice error feedback in sheet */
.voice-error-sheet {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-border-strong);
  border-radius: var(--radius-lg);
}

.voice-error-text {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--color-priority-high);
  line-height: var(--leading-normal);
}

.voice-retry-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-priority-high);
  border-radius: var(--radius-md);
  color: var(--color-priority-high);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  flex-shrink: 0;
  -webkit-backdrop-filter: blur(var(--blur-xs));
  backdrop-filter: blur(var(--blur-xs));
}

.voice-retry-btn:active {
  transform: scale(0.96);
}

/* Bottom actions row: Re-record + Add Task — always after chips, no margin-top: auto */
.bottom-actions {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) 0;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  border: none;
}

.action-btn:active {
  transform: scale(0.97);
}

.rerecord-action {
  background: var(--state-hover-bg);
  border: 1px solid var(--brand-border-subtle);
  color: var(--brand-primary);
}

.add-action {
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  backdrop-filter: blur(8px);
}

.add-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-action.full-width {
  flex: 1;
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
  direction: rtl;
}

[dir="rtl"] .option-group {
  direction: rtl;
}

[dir="rtl"] .bottom-actions {
  direction: rtl;
}
</style>
