<template>
  <!-- Quick Task Creation - REBUILT with TASK-1324 enhancements -->
  <div class="quick-task-section">
    <div class="quick-task-row">
      <!-- Single-line input (shown when not expanded) -->
      <input
        v-if="!isQuickAddExpanded"
        ref="quickTaskRef"
        v-model="quickTaskText"
        :dir="quickTaskDirection"
        type="text"
        class="quick-task-input"
        :class="{ 'voice-active': isListening, 'success-flash': showSuccessFlash }"
        :placeholder="isListening ? $t('sidebar.quick_task_listening') : (showSuccessFlash ? $t('sidebar.quick_task_added') : $t('sidebar.quick_task_placeholder'))"
        :aria-label="$t('sidebar.quick_task_label')"
        @keydown.enter.prevent="createQuickTask"
        @keydown.escape="collapseQuickAdd"
        @focus="quickTaskFocused = true"
        @blur="quickTaskFocused = false"
      >
      <!-- Multi-line textarea (shown when expanded) -->
      <textarea
        v-else
        ref="quickTaskExpandedRef"
        v-model="quickTaskText"
        :dir="quickTaskDirection"
        class="quick-task-textarea"
        :class="{ 'voice-active': isListening }"
        :placeholder="isListening ? $t('sidebar.quick_task_listening') : $t('sidebar.quick_task_placeholder')"
        :aria-label="$t('sidebar.quick_task_label')"
        rows="3"
        @keydown.enter.exact.prevent="createQuickTask"
        @keydown.escape="collapseQuickAdd"
        @focus="quickTaskFocused = true"
        @blur="quickTaskFocused = false"
      />
      <!-- Mic button (TASK-1024) -->
      <button
        class="mic-btn"
        :class="[{ recording: isListening }]"
        :title="isListening ? $t('sidebar.stop_recording') : $t('sidebar.voice_input')"
        @click="toggleVoiceInput"
      >
        <Mic v-if="!isListening" :size="16" />
        <MicOff v-else :size="16" />
      </button>
      <!-- FEATURE-1200: Expand to fullscreen button -->
      <button
        v-if="isQuickAddExpanded"
        class="expand-btn"
        :title="$t('sidebar.expand_to_fullscreen') || 'Expand to full editor'"
        @click="expandToFullscreen"
      >
        <Maximize2 :size="14" />
      </button>
    </div>

    <!-- Metadata row (date + priority pickers) - TASK-1324 Feature 2 & 3 -->
    <Transition name="fade-slide">
      <div v-if="showMetadataRow" class="metadata-row">
        <!-- Date picker -->
        <div class="metadata-picker">
          <button
            class="metadata-btn"
            :class="{ 'has-value': quickTaskDueDate }"
            :style="quickTaskDueDate ? { color: 'var(--brand-primary)' } : {}"
            @mousedown.prevent
            @click="toggleDatePicker"
          >
            <CalendarDays :size="14" />
            <span v-if="quickTaskDueDate" class="metadata-label">{{ formatDateLabel(quickTaskDueDate) }}</span>
            <span v-else class="metadata-label">{{ $t('sidebar.no_date') }}</span>
          </button>

          <!-- Date dropdown -->
          <Transition name="fade">
            <div v-if="showDatePicker" class="metadata-dropdown date-dropdown" @mousedown.prevent>
              <button class="dropdown-option" @click="selectDate('today')">
                {{ $t('smart_views.today') }}
              </button>
              <button class="dropdown-option" @click="selectDate('tomorrow')">
                {{ $t('sidebar.tomorrow') }}
              </button>
              <button class="dropdown-option" @click="selectDate('weekend')">
                {{ $t('sidebar.this_weekend') }}
              </button>
              <button class="dropdown-option" @click="selectDate(null)">
                {{ $t('sidebar.no_date') }}
              </button>
            </div>
          </Transition>
        </div>

        <span class="metadata-divider">&middot;</span>

        <!-- Priority picker -->
        <div class="metadata-picker">
          <button
            class="metadata-btn"
            :class="{ 'has-value': quickTaskPriority }"
            :style="getPriorityColor(quickTaskPriority)"
            @mousedown.prevent
            @click="togglePriorityPicker"
          >
            <Flag :size="14" />
            <span class="metadata-label">{{ formatPriorityLabel(quickTaskPriority) }}</span>
          </button>

          <!-- Priority dropdown -->
          <Transition name="fade">
            <div v-if="showPriorityPicker" class="metadata-dropdown priority-dropdown" @mousedown.prevent>
              <button class="dropdown-option" @click="selectPriority(null)">
                <Flag :size="12" />
                <span>{{ $t('common.none') }}</span>
              </button>
              <button class="dropdown-option priority-low" @click="selectPriority('low')">
                <Flag :size="12" />
                <span>{{ $t('task.priority_low') }}</span>
              </button>
              <button class="dropdown-option priority-medium" @click="selectPriority('medium')">
                <Flag :size="12" />
                <span>{{ $t('task.priority_medium') }}</span>
              </button>
              <button class="dropdown-option priority-high" @click="selectPriority('high')">
                <Flag :size="12" />
                <span>{{ $t('task.priority_high') }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>

    <!-- Voice feedback (when recording) -->
    <div v-if="isListening || isProcessingVoice" class="voice-feedback">
      <div class="voice-waveform">
        <span class="wave-bar" />
        <span class="wave-bar" />
        <span class="wave-bar" />
      </div>
      <span class="voice-status">{{ displayTranscript || $t('sidebar.speak_now') }}</span>
      <button class="voice-cancel" @click="cancelVoice">
        <X :size="12" />
      </button>
    </div>
    <!-- Voice error message -->
    <div v-if="voiceError && !isListening" class="voice-error">
      {{ voiceError }}
    </div>
  </div>

  <!-- FEATURE-1200: Fullscreen task creator modal -->
  <QuickTaskCreateModal
    :is-open="showFullscreenCreator"
    :initial-title="quickTaskText"
    @cancel="handleFullscreenCancel"
    @create="handleFullscreenCreate"
  />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { Mic, MicOff, CalendarDays, Flag, Maximize2, X } from 'lucide-vue-next'
import QuickTaskCreateModal from '@/components/tasks/QuickTaskCreateModal.vue'
import { useQuickTaskInput } from '@/composables/app/useQuickTaskInput'

const {
  quickTaskRef,
  quickTaskExpandedRef,
  quickTaskText,
  quickTaskFocused,
  quickTaskDirection,
  showFullscreenCreator,
  showSuccessFlash,
  quickTaskDueDate,
  quickTaskPriority,
  showDatePicker,
  showPriorityPicker,
  isQuickAddExpanded,
  showMetadataRow,
  isListening,
  isProcessingVoice,
  displayTranscript,
  voiceError,
  collapseQuickAdd,
  expandToFullscreen,
  handleFullscreenCreate,
  handleFullscreenCancel,
  toggleDatePicker,
  selectDate,
  formatDateLabel,
  togglePriorityPicker,
  selectPriority,
  formatPriorityLabel,
  getPriorityColor,
  handleOutsideClick,
  toggleVoiceInput,
  cancelVoice,
  createQuickTask,
  focusInput
} = useQuickTaskInput()

// Lifecycle - outside click handler for dropdowns
onMounted(() => {
  window.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleOutsideClick)
})

// Expose focus method for parent chain
defineExpose({
  focusInput
})
</script>

<style scoped>
/* Quick Task Section */
.quick-task-section {
  padding: var(--space-2);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  margin: var(--space-4) var(--space-6);
}

.quick-task-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.quick-task-input {
  flex: 1;
  padding: var(--space-2_5);
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: all var(--duration-normal);
}

.quick-task-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  background: var(--glass-bg-light);
}

.quick-task-input.voice-active {
  border-color: var(--danger-text);
  box-shadow: 0 0 0 2px var(--danger-bg-medium);
}

.quick-task-input.success-flash {
  border-color: var(--brand-primary);
  box-shadow: var(--brand-focus-ring);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.quick-task-input.success-flash::placeholder {
  color: var(--brand-primary);
}

/* Mic Button (TASK-1024) */
.mic-btn {
  width: 32px;
  height: 32px;
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
  background: var(--glass-bg);
  color: var(--text-primary);
}

.mic-btn:active {
  transform: scale(0.95);
}

.mic-btn.recording {
  background: var(--danger-text);
  color: white;
  animation: pulse-recording 1.5s ease-in-out infinite;
}

/* FEATURE-1200: Expand to fullscreen button */
.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-7);
  height: var(--space-7);
  border: none;
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  color: var(--text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--duration-fast) var(--ease-out);
}

.expand-btn:hover {
  background: var(--purple-bg-subtle);
  color: var(--brand-primary);
}

@keyframes pulse-recording {
  0%, 100% {
    box-shadow: 0 0 0 0 var(--danger-shadow-strong);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
}

/* Voice feedback panel */
.voice-feedback {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  margin-top: var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 16px;
}

.wave-bar {
  width: 2px;
  height: 4px;
  background: var(--danger-text);
  border-radius: 1px;
  animation: wave 0.8s ease-in-out infinite;
}

.wave-bar:nth-child(1) { animation-delay: 0s; }
.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.2s; }

@keyframes wave {
  0%, 100% { height: 4px; }
  50% { height: 12px; }
}

.voice-status {
  flex: 1;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-cancel {
  width: 20px;
  height: 20px;
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
  color: var(--danger-text);
}

/* Voice error message */
.voice-error {
  margin-top: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--danger-bg-subtle);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--danger-text);
}

/* TASK-1324: Textarea for expanded quick add (Feature 1) */
.quick-task-textarea {
  flex: 1;
  padding: var(--space-2_5);
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
  resize: none;
  transition: all var(--duration-normal);
  line-height: 1.4;
}

.quick-task-textarea:focus {
  outline: none;
  border-color: var(--brand-primary);
  background: var(--glass-bg-light);
}

.quick-task-textarea.voice-active {
  border-color: var(--danger-text);
  box-shadow: 0 0 0 2px var(--danger-bg-medium);
}

/* TASK-1324: Metadata row for date + priority pickers (Features 2 & 3) */
.metadata-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
}

.metadata-divider {
  color: var(--text-muted);
  font-size: var(--text-xs);
  user-select: none;
}

.metadata-picker {
  position: relative;
  display: flex;
  align-items: center;
}

.metadata-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.metadata-btn:hover {
  background: var(--glass-bg);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.metadata-btn.has-value {
  border-color: var(--brand-primary);
}

.metadata-label {
  font-size: var(--text-xs);
  white-space: nowrap;
}

/* Metadata dropdowns */
.metadata-dropdown {
  position: absolute;
  top: calc(100% + var(--space-1));
  inset-inline-start: 0;
  z-index: var(--z-tooltip);
  min-width: 140px;
  background: var(--surface-secondary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  box-shadow: var(--shadow-lg);
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: start;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.dropdown-option:hover {
  background: var(--glass-bg-soft);
  color: var(--text-primary);
}

/* Priority color variants */
.dropdown-option.priority-low {
  color: var(--color-priority-low);
}

.dropdown-option.priority-low:hover {
  background: var(--blue-bg-light);
}

.dropdown-option.priority-medium {
  color: var(--color-priority-medium);
}

.dropdown-option.priority-medium:hover {
  background: var(--color-warning-alpha-10);
}

.dropdown-option.priority-high {
  color: var(--color-priority-high);
}

.dropdown-option.priority-high:hover {
  background: var(--danger-bg-subtle);
}

/* Fade-slide transition for metadata row */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.fade-slide-enter-to,
.fade-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
