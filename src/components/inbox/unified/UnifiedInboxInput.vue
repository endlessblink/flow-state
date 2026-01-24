<template>
  <div class="quick-add">
    <div class="quick-add-row">
      <input
        v-model="newTaskTitle"
        :dir="quickAddDirection"
        :placeholder="isListening ? 'Listening...' : 'Quick add task (Enter)...'"
        :class="['quick-add-input', { 'voice-active': isListening }]"
        @keydown.enter="handleAddTask"
      >

      <!-- Mic button (TASK-1024) -->
      <button
        v-if="isVoiceSupported"
        :class="['mic-btn', { recording: isListening }]"
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
        <span class="wave-bar"></span>
        <span class="wave-bar"></span>
        <span class="wave-bar"></span>
        <span class="wave-bar"></span>
        <span class="wave-bar"></span>
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

    <!-- Voice Task Confirmation (TASK-1028) -->
    <VoiceTaskConfirmation
      :is-open="showVoiceConfirmation"
      :parsed-task="parsedVoiceTask"
      @confirm="handleVoiceTaskConfirm"
      @cancel="handleVoiceTaskCancel"
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
import { ref, computed } from 'vue'
import { NButton } from 'naive-ui'
import { Mic, MicOff, X } from 'lucide-vue-next'
import { useBrainDump } from '@/composables/useBrainDump'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'
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
      const parsed = parseTranscript(result.transcript.trim(), result.language)
      parsedVoiceTask.value = parsed
      showVoiceConfirmation.value = true
    }
  },
  onError: (err) => {
    console.warn('[Voice] Error:', err)
  }
})

// Toggle voice recording
const toggleVoiceInput = async () => {
  if (isListening.value) {
    stopVoice()
  } else {
    parsedVoiceTask.value = null
    showVoiceConfirmation.value = false
    await startVoice()
  }
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

const resetVoiceState = () => {
  parsedVoiceTask.value = null
  showVoiceConfirmation.value = false
  cancelVoice()
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

.mic-btn:hover {
  background: var(--glass-bg);
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
