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
          <!-- Sheet Handle -->
          <div class="sheet-handle"></div>

          <!-- Header: Cancel | New Task | Add -->
          <div class="sheet-header">
            <button class="header-btn cancel-btn" @click="handleCancel">
              Cancel
            </button>
            <h3 class="sheet-title">New Task</h3>
            <button
              class="header-btn add-btn"
              :disabled="!taskTitle.trim()"
              @click="handleCreate"
            >
              Add
            </button>
          </div>

          <!-- Create Form -->
          <div class="create-form">
            <!-- Title -->
            <div class="form-field">
              <label class="field-label">Title</label>
              <input
                ref="titleInputRef"
                v-model="taskTitle"
                type="text"
                class="field-input"
                placeholder="What needs to be done?"
                @keydown.enter="handleCreate"
              />
            </div>

            <!-- Description -->
            <div class="form-field">
              <label class="field-label">Description (Optional)</label>
              <textarea
                v-model="taskDescription"
                class="field-textarea"
                placeholder="Add details..."
                rows="3"
              ></textarea>
            </div>

            <!-- Due Date -->
            <div class="form-field">
              <label class="field-label">Due Date</label>
              <div class="date-options">
                <button
                  :class="['date-pill', { active: isDueToday }]"
                  @click="setDueDate('today')"
                >
                  <Calendar :size="16" />
                  Today
                </button>
                <button
                  :class="['date-pill', { active: isDueTomorrow }]"
                  @click="setDueDate('tomorrow')"
                >
                  <CalendarPlus :size="16" />
                  Tomorrow
                </button>
                <button
                  :class="['date-pill', { active: isDueNextWeek }]"
                  @click="setDueDate('nextWeek')"
                >
                  <CalendarDays :size="16" />
                  Next Week
                </button>
                <button
                  :class="['date-pill', { active: hasCustomDate }]"
                  @click="showDatePicker = true"
                >
                  <CalendarDays :size="16" />
                  {{ hasCustomDate ? formatDate(taskDueDate!) : 'Pick' }}
                </button>
                <button
                  v-if="taskDueDate"
                  class="date-pill clear-date"
                  @click="clearDueDate"
                >
                  <X :size="16" />
                </button>
              </div>
              <!-- Native date picker (hidden but functional) -->
              <input
                v-show="showDatePicker"
                ref="datePickerRef"
                v-model="taskDueDateInput"
                type="date"
                class="native-date-picker"
                @change="handleDatePickerChange"
                @blur="showDatePicker = false"
              />
            </div>

            <!-- Priority -->
            <div class="form-field">
              <label class="field-label">Priority</label>
              <div class="priority-options">
                <button
                  v-for="option in priorityOptions"
                  :key="option.value"
                  :class="['priority-pill', `priority-${option.value}`, { active: taskPriority === option.value }]"
                  @click="taskPriority = option.value"
                >
                  <Flag :size="16" />
                  {{ option.label }}
                </button>
                <button
                  :class="['priority-pill', 'priority-none', { active: taskPriority === null }]"
                  @click="taskPriority = null"
                >
                  None
                </button>
              </div>
            </div>

            <!-- Voice Feedback (Optional) -->
            <div v-if="isListening" class="voice-feedback">
              <div class="voice-indicator">
                <div class="voice-pulse"></div>
                <span>Listening...</span>
              </div>
              <p v-if="voiceTranscript" class="voice-transcript">
                {{ voiceTranscript }}
              </p>
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
  Flag, Calendar, CalendarPlus, CalendarDays, X
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  isListening?: boolean
  voiceTranscript?: string
}

const props = withDefaults(defineProps<Props>(), {
  isListening: false,
  voiceTranscript: ''
})

interface TaskCreationData {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low' | null
  dueDate: Date | null
}

const emit = defineEmits<{
  close: []
  created: [data: TaskCreationData]
}>()

// Form state
const taskTitle = ref('')
const taskDescription = ref('')
const taskPriority = ref<'low' | 'medium' | 'high' | null>(null)
const taskDueDate = ref<Date | null>(null)
const taskDueDateInput = ref('')
const showDatePicker = ref(false)

// Refs
const titleInputRef = ref<HTMLInputElement | null>(null)
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
  align-items: flex-end;
  z-index: 1000;
}

.task-create-sheet {
  width: 100%;
  height: 100dvh;
  max-height: none;
  background: var(--surface-primary, hsl(240, 18%, 12%));
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
}

/* Sheet Handle */
.sheet-handle {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  margin: 12px auto 0;
  flex-shrink: 0;
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
  background: var(--brand-primary, #4ECDC4);
  color: hsl(230, 20%, 10%);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-btn:not(:disabled):active {
  transform: scale(0.96);
}

/* Create Form */
.create-form {
  flex: 1;
  overflow-y: auto;
  padding: 24px 16px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.field-input {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: var(--text-primary, #fff);
  font-size: 17px;
  outline: none;
  transition: all 0.2s ease;
  min-height: 44px;
}

.field-input:focus {
  border-color: var(--brand-primary, #4ECDC4);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15);
}

.field-input::placeholder {
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

.field-textarea {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: var(--text-primary, #fff);
  font-size: 16px;
  outline: none;
  resize: none;
  font-family: inherit;
  transition: all 0.2s ease;
  min-height: 100px;
}

.field-textarea:focus {
  border-color: var(--brand-primary, #4ECDC4);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15);
}

.field-textarea::placeholder {
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

/* Date Options */
.date-options {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.date-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
}

.date-pill:active {
  transform: scale(0.95);
}

.date-pill.active {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.4);
  color: var(--brand-primary, #4ECDC4);
}

.date-pill.clear-date {
  padding: 12px;
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
}

.native-date-picker {
  margin-top: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--text-primary, #fff);
  font-size: 16px;
  color-scheme: dark;
}

/* Priority Options */
.priority-options {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.priority-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
}

.priority-pill:active {
  transform: scale(0.95);
}

.priority-pill.priority-high.active {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.priority-pill.priority-medium.active {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.4);
  color: #f59e0b;
}

.priority-pill.priority-low.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
  color: #3b82f6;
}

.priority-pill.priority-none.active {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text-primary, #fff);
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
  transform: translateY(100%);
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
</style>
