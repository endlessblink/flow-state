<template>
  <div class="quick-capture-tab">
    <!-- Task Input Form -->
    <div class="capture-form">
      <!-- Title Input -->
      <div class="input-group title-group">
        <div class="title-input-row">
          <input
            ref="titleInputRef"
            v-model="newTask.title"
            type="text"
            class="capture-input title-input"
            :class="{ 'voice-active': isListening }"
            :placeholder="isListening ? 'Listening...' : 'What needs to be done?'"
            maxlength="200"
            @keydown="handleTitleKeydown"
          >
          <!-- Mic button (TASK-1024) - ALWAYS SHOW FOR DEBUG -->
          <button
            class="mic-btn"
            :class="[{ recording: isListening }]"
            :title="isListening ? 'Stop recording' : 'Voice input'"
            @click="toggleVoiceInput"
          >
            <Mic v-if="!isListening" :size="18" />
            <MicOff v-else :size="18" />
          </button>
        </div>
        <!-- Voice feedback (when recording) -->
        <div v-if="isListening" class="voice-feedback">
          <div class="voice-waveform">
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
          </div>
          <span class="voice-status">{{ displayTranscript || 'Speak now...' }}</span>
          <button class="voice-cancel" @click="cancelVoice">
            <X :size="14" />
          </button>
        </div>
        <!-- Voice error message -->
        <div v-if="voiceError && !isListening" class="voice-error">
          {{ voiceError }}
        </div>
      </div>

      <!-- Description Input -->
      <div class="input-group description-group">
        <textarea
          v-model="newTask.description"
          class="capture-input description-input"
          placeholder="Description (optional, supports markdown)..."
          rows="3"
          maxlength="2000"
          @keydown="handleDescriptionKeydown"
        />
      </div>

      <!-- Priority & Due Date Row -->
      <div class="metadata-row">
        <!-- Priority -->
        <div class="metadata-group">
          <label class="metadata-label">Priority:</label>
          <div class="priority-buttons">
            <button
              class="priority-btn"
              :class="{ active: newTask.priority === undefined }"
              @click="newTask.priority = undefined"
            >
              None
            </button>
            <button
              class="priority-btn low"
              :class="{ active: newTask.priority === 'low' }"
              @click="newTask.priority = 'low'"
            >
              Low
            </button>
            <button
              class="priority-btn medium"
              :class="{ active: newTask.priority === 'medium' }"
              @click="newTask.priority = 'medium'"
            >
              Med
            </button>
            <button
              class="priority-btn high"
              :class="{ active: newTask.priority === 'high' }"
              @click="newTask.priority = 'high'"
            >
              High
            </button>
          </div>
        </div>

        <!-- Due Date -->
        <div class="metadata-group">
          <label class="metadata-label">Due:</label>
          <div class="date-shortcuts">
            <button
              class="date-btn"
              :class="{ active: isDueDateToday }"
              @click="setDueDate('today')"
            >
              Today
            </button>
            <button
              class="date-btn"
              :class="{ active: isDueDateTomorrow }"
              @click="setDueDate('tomorrow')"
            >
              Tomorrow
            </button>
            <button
              class="date-btn"
              :class="{ active: isDueDateWeekend }"
              @click="setDueDate('weekend')"
            >
              Weekend
            </button>
            <button
              v-if="newTask.dueDate"
              class="date-btn clear"
              @click="newTask.dueDate = undefined"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- Add Task Button -->
      <div class="action-row">
        <button
          class="add-task-btn"
          :disabled="!canAddTask"
          @click="handleAddTask"
        >
          <Plus :size="18" />
          <span>Add Task</span>
          <kbd>Enter</kbd>
        </button>
      </div>
    </div>

    <!-- Pending Tasks List -->
    <div class="pending-section">
      <div class="pending-header">
        <h3 class="pending-title">
          <Inbox :size="18" />
          Pending Tasks
          <span v-if="quickCapture.pendingTasks.value.length > 0" class="pending-count">
            ({{ quickCapture.pendingTasks.value.length }})
          </span>
        </h3>
        <button
          v-if="quickCapture.pendingTasks.value.length > 0"
          class="sort-all-btn"
          @click="handleSortAll"
        >
          <Zap :size="16" />
          <span>Sort All</span>
          <kbd>Tab</kbd>
        </button>
      </div>

      <!-- Task List -->
      <div v-if="quickCapture.pendingTasks.value.length > 0" class="pending-list">
        <TransitionGroup name="task-list" tag="div" class="task-list-container">
          <div
            v-for="task in quickCapture.pendingTasks.value"
            :key="task.id"
            class="pending-task-card"
          >
            <div class="task-content">
              <span class="task-title">{{ task.title }}</span>
              <div v-if="task.description || task.priority || task.dueDate" class="task-meta">
                <span v-if="task.priority" class="meta-badge" :class="`priority-${task.priority}`">
                  <Flag :size="12" />
                  {{ task.priority }}
                </span>
                <span v-if="task.dueDate" class="meta-badge due-date">
                  <Calendar :size="12" />
                  {{ formatDueDate(task.dueDate) }}
                </span>
              </div>
              <p v-if="task.description" class="task-description-preview">
                {{ truncateDescription(task.description) }}
              </p>
            </div>
            <button
              class="remove-btn"
              title="Remove task"
              @click="quickCapture.removeTask(task.id)"
            >
              <X :size="16" />
            </button>
          </div>
        </TransitionGroup>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <div class="empty-icon">
          <Inbox :size="48" />
        </div>
        <p class="empty-text">
          No tasks captured yet
        </p>
        <p class="empty-hint">
          Type a task title above and press Enter to add
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, reactive } from 'vue'
import { X, Plus, Inbox, Flag, Calendar, Zap, Mic, MicOff } from 'lucide-vue-next'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'
import { useQuickCapture, type PendingTask } from '@/composables/useQuickCapture'

const emit = defineEmits<{
  switchToSort: []
}>()

const quickCapture = useQuickCapture()

// Template refs
const titleInputRef = ref<HTMLInputElement>()

// Voice input (TASK-1024)
const {
  isListening,
  isSupported: isVoiceSupported,
  displayTranscript,
  error: voiceError,
  start: startVoice,
  stop: stopVoice,
  cancel: cancelVoice
} = useSpeechRecognition({
  language: 'auto',
  interimResults: true,
  silenceTimeout: 2500,
  onResult: (result) => {
    if (result.isFinal && result.transcript.trim()) {
      newTask.title = result.transcript.trim()
    }
  },
  onError: (err) => {
    console.warn('[Voice QuickCapture] Error:', err)
  }
})

// Toggle voice recording
const toggleVoiceInput = async () => {
  if (isListening.value) {
    stopVoice()
  } else {
    newTask.title = ''
    await startVoice()
  }
}

// Form state
const newTask = reactive<Omit<PendingTask, 'id'>>({
  title: '',
  description: undefined,
  priority: undefined,
  dueDate: undefined
})

// Computed
const canAddTask = computed(() => newTask.title.trim().length > 0)

const isDueDateToday = computed(() => {
  if (!newTask.dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(newTask.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  return today.getTime() === dueDate.getTime()
})

const isDueDateTomorrow = computed(() => {
  if (!newTask.dueDate) return false
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const dueDate = new Date(newTask.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  return tomorrow.getTime() === dueDate.getTime()
})

const isDueDateWeekend = computed(() => {
  if (!newTask.dueDate) return false
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7
  const saturday = new Date()
  saturday.setDate(today.getDate() + daysUntilSaturday)
  saturday.setHours(0, 0, 0, 0)
  const dueDate = new Date(newTask.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  return saturday.getTime() === dueDate.getTime()
})

// Actions
function handleAddTask() {
  if (!canAddTask.value) return

  quickCapture.addTask({
    title: newTask.title,
    description: newTask.description?.trim() || undefined,
    priority: newTask.priority,
    dueDate: newTask.dueDate
  })

  // Reset form but keep priority/dueDate for convenience
  newTask.title = ''
  newTask.description = undefined

  // Re-focus title input
  nextTick(() => {
    titleInputRef.value?.focus()
  })
}

function handleSortAll() {
  if (quickCapture.pendingTasks.value.length > 0) {
    quickCapture.startSorting()
    emit('switchToSort')
  }
}

function handleTitleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (canAddTask.value) {
      handleAddTask()
    }
  } else if (event.key === 'Tab' && quickCapture.pendingTasks.value.length > 0) {
    event.preventDefault()
    handleSortAll()
  }
}

function handleDescriptionKeydown(event: KeyboardEvent) {
  // Shift+Enter to add task from description
  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault()
    if (canAddTask.value) {
      handleAddTask()
    }
  } else if (event.key === 'Tab' && quickCapture.pendingTasks.value.length > 0 && !event.shiftKey) {
    event.preventDefault()
    handleSortAll()
  }
}

function setDueDate(preset: 'today' | 'tomorrow' | 'weekend') {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'today':
      // Already set to today
      break
    case 'tomorrow':
      date.setDate(date.getDate() + 1)
      break
    case 'weekend': {
      const dayOfWeek = date.getDay()
      const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7
      date.setDate(date.getDate() + daysUntilSaturday)
      break
    }
  }

  newTask.dueDate = date.toISOString()
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncateDescription(desc: string): string {
  const maxLength = 80
  if (desc.length <= maxLength) return desc
  return desc.substring(0, maxLength).trim() + '...'
}

// Focus title input on mount
onMounted(() => {
  nextTick(() => {
    titleInputRef.value?.focus()
  })
})

// Expose focus method for parent
defineExpose({
  focus: () => titleInputRef.value?.focus()
})
</script>

<style scoped>
.quick-capture-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  height: 100%;
}

/* Capture Form */
.capture-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.title-input-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.capture-input {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  transition: all var(--duration-normal);
}

.capture-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-primary-alpha-20);
}

.capture-input::placeholder {
  color: var(--text-muted);
}

.title-input {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  font-weight: var(--font-medium);
}

.title-input.voice-active {
  border-color: var(--danger-text, #ef4444);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
}

/* Mic Button (TASK-1024) */
.mic-btn {
  width: 40px;
  height: 40px;
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

.mic-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.mic-btn:active {
  transform: scale(0.95);
}

.mic-btn.recording {
  background: var(--danger-text, #ef4444);
  color: white;
  animation: pulse-recording 1.5s ease-in-out infinite;
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
  margin-top: var(--space-2);
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
.wave-bar:nth-child(3) { animation-delay: 0.2s; }
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

/* Voice error message */
.voice-error {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--danger-text, #ef4444);
}

.description-input {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  resize: vertical;
  min-height: 80px;
  max-height: 200px;
  line-height: var(--leading-relaxed);
}

/* Metadata Row */
.metadata-row {
  display: flex;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.metadata-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.metadata-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.priority-buttons,
.date-shortcuts {
  display: flex;
  gap: var(--space-1);
}

.priority-btn,
.date-btn {
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.priority-btn:hover,
.date-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.priority-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.priority-btn.low.active {
  background: transparent;
  border-color: var(--success);
  color: var(--success);
}

.priority-btn.medium.active {
  background: transparent;
  border-color: var(--warning);
  color: var(--warning);
}

.priority-btn.high.active {
  background: transparent;
  border-color: var(--danger);
  color: var(--danger);
}

.date-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.date-btn.clear {
  padding: var(--space-1_5);
  color: var(--danger);
  border-color: var(--danger-muted);
}

.date-btn.clear:hover {
  background: var(--danger-bg);
  border-color: var(--danger);
}

/* Action Row */
.action-row {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2);
}

.add-task-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-5);
  background: transparent;
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.add-task-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--brand-primary-alpha-20);
}

.add-task-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-task-btn kbd {
  padding: var(--space-0_5) var(--space-1_5);
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
}

/* Pending Section */
.pending-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.pending-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: var(--space-4);
}

.pending-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin: 0;
}

.pending-count {
  color: var(--brand-primary);
}

.sort-all-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-medium);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  color: var(--brand-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.sort-all-btn:hover {
  background: rgba(78, 205, 196, 0.08);
  color: var(--brand-hover);
  border-color: var(--brand-hover);
  transform: translateY(-1px);
}

.sort-all-btn kbd {
  padding: var(--space-0_5) var(--space-1);
  background: var(--overlay-light);
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-family: var(--font-mono);
}

/* Pending List */
.pending-list {
  flex: 1;
  overflow-y: auto;
}

.task-list-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.pending-task-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal);
}

.pending-task-card:hover {
  background: var(--glass-bg-light);
  border-color: var(--glass-border-hover);
}

.task-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  word-wrap: break-word;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-0_5) var(--space-2);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-transform: capitalize;
}

.meta-badge.priority-low {
  color: var(--success);
  background: rgba(16, 185, 129, 0.1);
}

.meta-badge.priority-medium {
  color: var(--warning);
  background: rgba(245, 158, 11, 0.1);
}

.meta-badge.priority-high {
  color: var(--danger);
  background: rgba(239, 68, 68, 0.1);
}

.meta-badge.due-date {
  color: var(--info);
  background: rgba(59, 130, 246, 0.1);
}

.task-description-preview {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  line-height: var(--leading-relaxed);
}

.remove-btn {
  flex-shrink: 0;
  padding: var(--space-1_5);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.remove-btn:hover {
  background: var(--danger-bg);
  border-color: var(--danger);
  color: var(--danger);
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12);
  text-align: center;
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.5;
}

.empty-text {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin: 0;
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
}

/* Task List Transitions */
.task-list-enter-active,
.task-list-leave-active {
  transition: all var(--duration-normal) var(--spring-smooth);
}

.task-list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.task-list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Responsive */
@media (max-width: 640px) {
  .metadata-row {
    flex-direction: column;
    gap: var(--space-4);
  }

  .priority-buttons,
  .date-shortcuts {
    flex-wrap: wrap;
  }

  .action-row {
    justify-content: stretch;
  }

  .add-task-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
