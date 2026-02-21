<template>
  <Teleport to="body">
    <div class="quick-add-bar">
      <div class="quick-add-row">
        <input
          type="text"
          dir="ltr"
          placeholder="Add a task..."
          class="quick-add-input"
          readonly
          @click="$emit('openTaskCreateSheet')"
        >

        <!-- Mic button with offline queue badge (TASK-1131) -->
        <button
          v-if="isVoiceSupported"
          class="mic-btn"
          :class="[{ recording: isListening, offline: !isVoiceOnline }]"
          @click="$emit('toggleVoiceInput')"
        >
          <Mic v-if="!isListening" :size="20" />
          <MicOff v-else :size="20" />
          <span v-if="hasVoicePending" class="voice-pending-badge">{{ voicePendingCount }}</span>
        </button>

        <button
          class="add-btn"
          @click="$emit('openTaskCreateSheet')"
        >
          <Plus :size="20" />
        </button>
      </div>

      <!-- Voice feedback (when recording) - Whisper only (TASK-1119) -->
      <div v-if="isListening || isProcessingVoice || isVoiceQueued" class="voice-feedback">
        <span class="voice-mode-badge whisper">🤖 AI</span>
        <div class="voice-waveform" :class="{ paused: isVoiceQueued }">
          <span class="wave-bar" />
          <span class="wave-bar" />
          <span class="wave-bar" />
          <span class="wave-bar" />
          <span class="wave-bar" />
        </div>
        <span class="voice-status">
          <template v-if="isVoiceQueued">📥 Saved offline - will transcribe when online</template>
          <template v-else-if="isProcessingVoice">Processing...</template>
          <template v-else>{{ recordingDuration }}s - Speak freely...</template>
        </span>
        <button v-if="!isVoiceQueued" class="voice-cancel" @click="$emit('cancelVoice')">
          <X :size="16" />
        </button>
      </div>

      <!-- Voice mode indicator when not recording -->
      <div v-if="isVoiceSupported && !isListening && !isProcessingVoice && !isVoiceQueued" class="voice-lang-hint">
        <span v-if="!isVoiceOnline" class="voice-offline-badge">📴 Offline</span>
        <span class="voice-mode-badge whisper">🤖 AI (auto-detect)</span>
        <span v-if="hasVoicePending" class="voice-queue-status">{{ voicePendingCount }} queued</span>
      </div>

      <!-- Voice error message -->
      <div v-if="voiceError && !isListening" class="voice-error">
        {{ voiceError }}
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Mic, MicOff, Plus, X } from 'lucide-vue-next'

defineProps<{
  isVoiceSupported: boolean
  isListening: boolean
  isVoiceOnline: boolean
  hasVoicePending: boolean
  voicePendingCount: number
  isProcessingVoice: boolean
  isVoiceQueued: boolean
  recordingDuration: number
  voiceError: string | null
}>()

defineEmits<{
  (e: 'openTaskCreateSheet'): void
  (e: 'toggleVoiceInput'): void
  (e: 'cancelVoice'): void
}>()
</script>

<style scoped>
/* Quick Add Bar - Now fixed to bottom naturally via teleport */
.quick-add-bar {
  position: fixed;
  bottom: 0px;
  /* Add safe area padding for modern iOS devices with home indicator */
  padding-bottom: env(safe-area-inset-bottom, 0px);
  left: 0;
  right: 0;
  background: var(--surface-primary);
  border-top: 1px solid var(--border-subtle);
  padding-top: var(--space-3);
  padding-left: var(--space-4);
  padding-right: var(--space-4);
  z-index: 50;
  /* Reduced shadow footprint so it doesn't overlap stack content */
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
  transition: all var(--duration-normal) cubic-bezier(0.2, 0, 0, 1);
}

.quick-add-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  /* The row itself already has minimal bottom margin, we rely on padding-bottom of container */
  margin-bottom: var(--space-3);
}

.quick-add-input {
  flex: 1;
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  color: var(--text-primary);
  transition: all var(--duration-fast);
}

.quick-add-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  background: var(--surface-primary);
  box-shadow: 0 0 0 2px var(--brand-primary-subtle);
}

.mic-btn, .add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-xl);
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
  position: relative; /* For pending count badge */
}

/* Offline Queue Badge */
.voice-pending-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--color-warning);
  color: white;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--surface-primary);
  z-index: 2;
  padding: 0 4px;
}

.mic-btn {
  background: var(--surface-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.mic-btn.recording {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
  border-color: var(--color-danger);
  animation: pulse 2s infinite;
}

.mic-btn.offline {
  opacity: 0.8;
  border-style: dashed;
}

.add-btn {
  background: var(--brand-primary);
  color: white;
}

.add-btn:active, .mic-btn:not(.recording):active {
  transform: scale(0.95);
}

/* Base states that are always rendered but hidden */
.mic-btn.recording {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
  border-color: var(--color-danger);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 var(--danger-bg-subtle); }
  70% { box-shadow: 0 0 0 10px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

/* Voice feature UI additions */
.voice-lang-hint {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
  margin-top: -var(--space-1);
  margin-bottom: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.voice-mode-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-weight: var(--font-medium);
  letter-spacing: 0.02em;
}

.voice-mode-badge.whisper {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.2);
}

.voice-offline-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--yellow-bg-subtle);
  color: var(--color-warning);
  border: 1px solid rgba(var(--color-warning-rgb), 0.2);
  font-weight: var(--font-medium);
}

.voice-queue-status {
  color: var(--color-warning);
  font-weight: var(--font-semibold);
  font-size: var(--text-xs);
}

.voice-feedback {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--danger-bg-subtle);
  border-radius: var(--radius-lg);
  margin-top: -var(--space-2);
  margin-bottom: var(--space-3);
  animation: slideUp 0.3s ease-out forwards;
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 20px;
}

.wave-bar {
  width: 3px;
  background: var(--color-danger);
  border-radius: 3px;
  animation: bounce 1s infinite ease-in-out;
}

.voice-waveform.paused .wave-bar {
  animation: none;
  height: 4px !important;
  background: var(--color-warning);
}

.voice-feedback .voice-status {
  font-size: var(--text-sm);
  color: var(--color-danger);
  font-weight: var(--font-medium);
  font-variant-numeric: tabular-nums;
  flex: 1;
}

.voice-waveform.paused + .voice-status {
  color: var(--color-warning);
}

.voice-cancel {
  background: transparent;
  border: none;
  color: var(--color-danger);
  padding: var(--space-1);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
}

.voice-cancel:active {
  background: rgba(0,0,0,0.05);
}

.voice-error {
  margin-top: -var(--space-2);
  margin-bottom: var(--space-3);
  padding: var(--space-2);
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
  font-size: var(--text-xs);
  border-radius: var(--radius-md);
  text-align: center;
}

.wave-bar:nth-child(1) { height: 8px; animation-delay: -0.4s; }
.wave-bar:nth-child(2) { height: 16px; animation-delay: -0.2s; }
.wave-bar:nth-child(3) { height: 20px; animation-delay: 0s; }
.wave-bar:nth-child(4) { height: 16px; animation-delay: -0.2s; }
.wave-bar:nth-child(5) { height: 8px; animation-delay: -0.4s; }

@keyframes bounce {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* RTL Support */
[dir="rtl"] .quick-add-input {
  text-align: right;
}
</style>
