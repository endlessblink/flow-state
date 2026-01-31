<template>
  <div class="quick-add">
    <div class="quick-add-row">
      <input
        v-model="newTaskTitle"
        :dir="quickAddDirection"
        :placeholder="isListening ? 'Listening...' : (isProcessingVoice ? 'Processing...' : 'Quick add task (Enter)...')"
        class="quick-add-input"
        :class="[{ 'voice-active': isListening || isProcessingVoice }]"
        @keydown.enter="handleAddTask"
      >

      <!-- Mic button (TASK-1024) -->
      <button
        v-if="isVoiceSupported"
        class="mic-btn"
        :class="[{ recording: isListening, processing: isProcessingVoice }]"
        :title="isListening ? 'Stop recording' : (isProcessingVoice ? 'Processing...' : 'Voice input')"
        :disabled="isProcessingVoice"
        @click="toggleVoiceInput"
      >
        <Loader2 v-if="isProcessingVoice" :size="18" class="spin" />
        <Mic v-else-if="!isListening" :size="18" />
        <MicOff v-else :size="18" />
      </button>
    </div>

    <!-- Voice mode toggle (TASK-1060: Groq Whisper support) -->
    <div v-if="showVoiceModeToggle" class="voice-mode-toggle">
      <button
        class="mode-btn"
        :class="[{ active: voiceMode === 'whisper' }]"
        :disabled="!hasWhisperApiKey"
        :title="hasWhisperApiKey ? 'Groq Whisper (works everywhere)' : 'No API key configured'"
        @click="voiceMode = 'whisper'"
      >
        🎙️ Whisper
      </button>
      <button
        class="mode-btn"
        :class="[{ active: voiceMode === 'browser' }]"
        :disabled="!isBrowserVoiceSupported"
        :title="isBrowserVoiceSupported ? 'Browser Speech API' : 'Not supported in this browser'"
        @click="voiceMode = 'browser'"
      >
        🌐 Browser
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
      <button class="voice-cancel" @click="cancelVoice">
        <X :size="14" />
      </button>
    </div>

    <!-- Voice error message -->
    <div v-if="voiceError && !isListening && !isProcessingVoice" class="voice-error">
      {{ voiceError }}
      <span v-if="voiceMode === 'browser'" class="error-hint">
        Try switching to Whisper mode above.
      </span>
    </div>

    <!-- Voice Task Confirmation (TASK-1028) with Re-record support (TASK-1110) -->
    <VoiceTaskConfirmation
      :is-open="showVoiceConfirmation"
      :parsed-task="parsedVoiceTask"
      :is-recording="isListening"
      :is-processing="isProcessingVoice"
      :can-re-record="isVoiceSupported"
      @confirm="handleVoiceTaskConfirm"
      @cancel="handleVoiceTaskCancel"
      @re-record="handleVoiceReRecord"
    />
  </div>

  <!-- Brain Dump Mode -->
  <div v-if="showBrainDump" class="brain-dump-section">
    <NButton
      secondary
      block
      size="small"
      class="brain-dump-toggle"
      @click="brainDumpMode = !brainDumpMode"
    >
      {{ brainDumpMode ? 'Quick Add Mode' : 'Brain Dump Mode' }}
    </NButton>

    <div v-if="brainDumpMode" class="brain-dump-container">
      <textarea
        v-model="brainDumpText"
        placeholder="Paste or type tasks (one per line):
Write proposal !!!
Review code 2h
Call client"
        :dir="textDirection"
        class="brain-dump-textarea"
        rows="5"
      />
      <NButton
        type="primary"
        block
        :disabled="parsedTaskCount === 0"
        @click="processBrainDump"
      >
        Add {{ parsedTaskCount }} Tasks
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NButton } from 'naive-ui'
import { Mic, MicOff, X, Loader2 } from 'lucide-vue-next'
import { useBrainDump } from '@/composables/useBrainDump'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'
import { useVoiceTaskParser, type ParsedVoiceTask } from '@/composables/useVoiceTaskParser'
import VoiceTaskConfirmation from '@/mobile/components/VoiceTaskConfirmation.vue'

defineProps<{
  showBrainDump: boolean
}>()

const emit = defineEmits<{
  (e: 'addTask', title: string, options?: { priority?: string; dueDate?: Date }): void
}>()

const newTaskTitle = ref('')
const { parseTranscript } = useVoiceTaskParser()

// Voice confirmation state (TASK-1028)
const parsedVoiceTask = ref<ParsedVoiceTask | null>(null)
const showVoiceConfirmation = ref(false)

// Voice mode: 'whisper' (Groq API) or 'browser' (Web Speech API)
// TASK-1060: Default to Whisper since it works in all browsers
const voiceMode = ref<'whisper' | 'browser'>('whisper')

// Groq Whisper voice input (works everywhere, requires API key)
const {
  isRecording: isWhisperRecording,
  isProcessing: isWhisperProcessing,
  isSupported: isWhisperSupported,
  hasApiKey: hasWhisperApiKey,
  transcript: whisperTranscript,
  error: whisperError,
  start: startWhisper,
  stop: stopWhisper,
  cancel: cancelWhisper
} = useWhisperSpeech({
  onResult: (result) => {
    console.log('[Whisper] Result:', result)
    if (result.transcript.trim()) {
      // Auto-detect language from Whisper response
      const lang = result.language === 'he' ? 'he-IL' : 'en-US'
      const parsed = parseTranscript(result.transcript.trim(), lang)
      parsedVoiceTask.value = parsed
      showVoiceConfirmation.value = true
    }
  },
  onError: (err) => {
    console.warn('[Whisper] Error:', err)
  }
})

// Browser-based voice input (Web Speech API - doesn't work in Brave)
const {
  isListening: isBrowserListening,
  isSupported: isBrowserVoiceSupported,
  displayTranscript: browserDisplayTranscript,
  error: browserVoiceError,
  start: startBrowserVoice,
  stop: stopBrowserVoice,
  cancel: cancelBrowserVoice
} = useSpeechRecognition({
  language: 'auto',
  interimResults: true,
  silenceTimeout: 2500,
  onResult: (result) => {
    if (result.isFinal && result.transcript.trim()) {
      const parsed = parseTranscript(result.transcript.trim(), result.language)
      parsedVoiceTask.value = parsed
      showVoiceConfirmation.value = true
    }
  },
  onError: (err) => {
    console.warn('[BrowserVoice] Error:', err)
  }
})

// Unified voice state (combines both modes)
const isListening = computed(() =>
  voiceMode.value === 'whisper'
    ? isWhisperRecording.value
    : isBrowserListening.value
)
const isProcessingVoice = computed(() => isWhisperProcessing.value)
const isVoiceSupported = computed(() =>
  voiceMode.value === 'whisper'
    ? isWhisperSupported.value && hasWhisperApiKey.value
    : isBrowserVoiceSupported.value
)
const displayTranscript = computed(() =>
  voiceMode.value === 'whisper'
    ? whisperTranscript.value
    : browserDisplayTranscript.value
)
const voiceError = computed(() =>
  voiceMode.value === 'whisper'
    ? whisperError.value
    : browserVoiceError.value
)

// Show toggle if either mode is available
const showVoiceModeToggle = computed(() =>
  (hasWhisperApiKey.value && isWhisperSupported.value) ||
  isBrowserVoiceSupported.value
)

// Debug logging to diagnose PWA voice support issues (BUG-1070)
console.log('[UnifiedInboxInput] Voice support state:', {
  voiceMode: voiceMode.value,
  isWhisperSupported: isWhisperSupported.value,
  hasWhisperApiKey: hasWhisperApiKey.value,
  isBrowserVoiceSupported: isBrowserVoiceSupported.value,
  isVoiceSupported: isVoiceSupported.value,
  showVoiceModeToggle: showVoiceModeToggle.value
})

// Auto-select mode based on API key availability
// Prefer Whisper if available (works in Brave), fallback to browser
watch([hasWhisperApiKey, isBrowserVoiceSupported], ([hasKey, browserSupported]) => {
  if (hasKey) {
    voiceMode.value = 'whisper'
  } else if (browserSupported) {
    voiceMode.value = 'browser'
  }
}, { immediate: true })

// Toggle voice recording
const toggleVoiceInput = async () => {
  if (isListening.value) {
    if (voiceMode.value === 'whisper') {
      stopWhisper()
    } else {
      stopBrowserVoice()
    }
  } else {
    parsedVoiceTask.value = null
    showVoiceConfirmation.value = false
    if (voiceMode.value === 'whisper') {
      await startWhisper()
    } else {
      await startBrowserVoice()
    }
  }
}

// Cancel voice recording
const cancelVoice = () => {
  if (voiceMode.value === 'whisper') {
    cancelWhisper()
  } else {
    cancelBrowserVoice()
  }
  resetVoiceState()
}

// Voice task confirmation handlers (TASK-1028)
const handleVoiceTaskConfirm = (task: { title: string; priority: 'high' | 'medium' | 'low' | null; dueDate: Date | null }) => {
  emit('addTask', task.title, {
    ...(task.priority && { priority: task.priority }),
    ...(task.dueDate && { dueDate: task.dueDate })
  })
  resetVoiceState()
}

const handleVoiceTaskCancel = () => {
  resetVoiceState()
}

// TASK-1110: Handle re-record request from confirmation modal
const handleVoiceReRecord = async () => {
  // If already recording, stop it
  if (isListening.value) {
    if (voiceMode.value === 'whisper') {
      stopWhisper()
    } else {
      stopBrowserVoice()
    }
    return
  }

  // Start new recording (keep modal open, will update parsedVoiceTask on result)
  if (voiceMode.value === 'whisper') {
    await startWhisper()
  } else {
    await startBrowserVoice()
  }
}

const resetVoiceState = () => {
  parsedVoiceTask.value = null
  showVoiceConfirmation.value = false
}

const {
  brainDumpMode,
  brainDumpText,
  textDirection,
  parsedTaskCount,
  processBrainDump
} = useBrainDump()

const quickAddDirection = computed(() => {
  if (!newTaskTitle.value.trim()) return 'ltr'
  const firstChar = newTaskTitle.value.trim()[0]
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
})

const handleAddTask = () => {
  if (!newTaskTitle.value.trim()) return
  emit('addTask', newTaskTitle.value)
  newTaskTitle.value = ''
}
</script>

<style scoped>
.quick-add {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--glass-border);
  background: transparent;
}

.quick-add-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.quick-add-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-soft);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: all var(--duration-normal);
}

.quick-add-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-primary-subtle);
}

.quick-add-input.voice-active {
  border-color: var(--danger-text, #ef4444);
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}

/* Mic Button (TASK-1024) */
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

/* Voice mode toggle (TASK-1060) */
.voice-mode-toggle {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.mode-btn {
  flex: 1;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn:hover:not(:disabled) {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.mode-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mode-btn.active {
  background: var(--brand-primary-subtle, rgba(59, 130, 246, 0.1));
  border-color: var(--brand-primary, #3b82f6);
  color: var(--brand-primary, #3b82f6);
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

/* Voice error message */
.voice-error {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--danger-text, #ef4444);
}

.error-hint {
  display: block;
  margin-top: var(--space-1);
  color: var(--text-tertiary);
}

.brain-dump-section {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--glass-border);
  background: transparent;
}

.brain-dump-container {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.brain-dump-textarea {
  width: 100%;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-soft);
  color: var(--text-primary);
  font-size: var(--text-sm);
  resize: vertical;
  min-height: 100px;
}

.brain-dump-textarea:focus {
  outline: none;
  border-color: var(--brand-primary);
}
</style>
