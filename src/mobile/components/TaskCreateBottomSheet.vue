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
              @click="emit('stop-recording')"
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
                >Today</button>
                <button
                  class="chip"
                  :class="{ active: isDueTomorrow }"
                  @click="setDueDate('tomorrow')"
                >Tomorrow</button>
                <button
                  class="chip"
                  :class="{ active: isDueNextWeek }"
                  @click="setDueDate('nextWeek')"
                >+1wk</button>
                <button
                  class="chip"
                  :class="{ active: hasCustomDate }"
                  @click="showDatePicker = true"
                >{{ hasCustomDate ? formatDate(taskDueDate!) : 'Pick' }}</button>
                <button
                  v-if="taskDueDate"
                  class="chip clear"
                  @click="clearDueDate"
                ><X :size="12" /></button>
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
                >{{ option.label }}</button>
                <button
                  class="chip"
                  :class="{ active: taskPriority === null }"
                  @click="taskPriority = null"
                >None</button>
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
              <button v-if="isListening" class="stop-recording-btn" @click="emit('stop-recording')">
                <Square :size="16" />
                <span>Stop Recording</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  Flag, Calendar, CalendarPlus, CalendarDays, X, Square
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  isListening?: boolean
  isProcessing?: boolean
  voiceTranscript?: string
}

const props = withDefaults(defineProps<Props>(), {
  isListening: false,
  isProcessing: false,
  voiceTranscript: ''
})

const emit = defineEmits<{
  close: []
  created: [data: TaskCreationData]
  'stop-recording': []
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

const hasCustomDate = computed(() => {
  return taskDueDate.value !== null && !isDueToday.value && !isDueTomorrow.value && !isDueNextWeek.value
})

// Watch for voice transcript
watch(() => props.voiceTranscript, (transcript) => {
  if (transcript && transcript.trim()) {
    taskTitle.value = transcript.trim()
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start; /* Start from TOP */
  z-index: 1000;
}

.task-create-sheet {
  width: 100%;
  height: 100dvh;
  max-height: none;
  background: var(--surface-primary, rgb(35, 32, 52));
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
  padding: 16px 16px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.sheet-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
  flex: 1;
  text-align: center;
}

.header-btn {
  min-width: 70px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.cancel-btn:active {
  background: rgba(255, 255, 255, 0.05);
}

.add-btn {
  background: transparent;
  color: var(--brand-primary, #4ECDC4);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-btn:not(:disabled):active {
  transform: scale(0.96);
}

.stop-btn {
  background: #ef4444;
  color: white;
}

.stop-btn:active {
  transform: scale(0.96);
  background: #dc2626;
}

.processing-btn {
  background: var(--brand-primary, #4ECDC4);
  color: hsl(230, 20%, 10%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: hsl(230, 20%, 10%);
  border-radius: 50%;
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
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Single text block - main writing area */
.task-text-block {
  flex: 1;
  min-height: 200px;
  padding: 16px;
  background: transparent;
  border: none;
  color: var(--text-primary, #fff);
  font-size: 18px;
  line-height: 1.5;
  font-family: inherit;
  resize: none;
  outline: none;
}

.task-text-block::placeholder {
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

/* Compact options at bottom */
.compact-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.option-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.option-icon {
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  flex-shrink: 0;
}

/* Compact chips */
.chip {
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chip:active {
  transform: scale(0.95);
}

.chip.active {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.4);
  color: var(--brand-primary, #4ECDC4);
}

.chip.clear {
  padding: 6px 8px;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

/* Priority colors */
.chip.priority-high.active {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.chip.priority-medium.active {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.4);
  color: #f59e0b;
}

.chip.priority-low.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
  color: #3b82f6;
}

.native-date-picker {
  margin-top: 6px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--text-primary, #fff);
  font-size: 14px;
  color-scheme: dark;
}

/* Voice Feedback */
.voice-feedback {
  padding: 16px;
  background: rgba(78, 205, 196, 0.1);
  border: 1px solid rgba(78, 205, 196, 0.3);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.voice-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--brand-primary, #4ECDC4);
  font-weight: 600;
}

.voice-pulse {
  width: 12px;
  height: 12px;
  background: var(--brand-primary, #4ECDC4);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

.processing-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(78, 205, 196, 0.3);
  border-top-color: var(--brand-primary, #4ECDC4);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.voice-feedback.processing {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.voice-feedback.processing .voice-indicator {
  color: #f59e0b;
}

.voice-feedback.processing .processing-spinner {
  border-color: rgba(245, 158, 11, 0.3);
  border-top-color: #f59e0b;
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
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-size: 14px;
  line-height: 1.5;
}

.stop-recording-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px 24px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 24px;
  color: #ef4444;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stop-recording-btn:active {
  transform: scale(0.96);
  background: rgba(239, 68, 68, 0.25);
}

/* ================================
   SHEET TRANSITIONS
   ================================ */

.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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
    transition: opacity 0.15s ease;
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
