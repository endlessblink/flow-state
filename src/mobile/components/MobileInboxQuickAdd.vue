<template>
  <Teleport to="body">
    <!-- Voice feedback pill — floats above FAB when recording -->
    <div
      v-if="isListening || isProcessingVoice || isVoiceQueued"
      class="voice-feedback-pill"
    >
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

    <!-- Floating Action Button -->
    <button
      class="fab"
      aria-label="Add task"
      @click="$emit('openTaskCreateSheet')"
    >
      <Plus :size="24" />
      <!-- Offline queue badge on FAB when voice is available and has pending -->
      <span v-if="isVoiceSupported && hasVoicePending" class="voice-pending-badge">
        {{ voicePendingCount }}
      </span>
    </button>
  </Teleport>
</template>

<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next'

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
/* Floating Action Button */
.fab {
  position: fixed;
  bottom: calc(var(--space-16) + var(--space-4));
  right: var(--space-4);
  z-index: 50;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18), 0 1px 4px rgba(0, 0, 0, 0.12);
  transition: transform var(--duration-fast), box-shadow var(--duration-fast);
  /* fixed elements are containing blocks for absolute children */
}

.fab:active {
  transform: scale(0.95);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

/* Offline queue badge on FAB */
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
  padding: 0 4px;
}

/* Voice feedback pill — floats above the FAB */
.voice-feedback-pill {
  position: fixed;
  bottom: calc(var(--space-16) + var(--space-4) + 56px + var(--space-3));
  right: var(--space-4);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--danger-bg-subtle);
  border-radius: var(--radius-full);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(var(--color-danger-rgb, 220, 38, 38), 0.2);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.3s ease-out forwards;
  max-width: calc(100vw - var(--space-8));
}

.voice-mode-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-weight: var(--font-medium);
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.voice-mode-badge.whisper {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.2);
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  flex-shrink: 0;
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

.voice-status {
  font-size: var(--text-sm);
  color: var(--color-danger);
  font-weight: var(--font-medium);
  font-variant-numeric: tabular-nums;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  flex-shrink: 0;
  cursor: pointer;
}

.voice-cancel:active {
  background: rgba(0, 0, 0, 0.05);
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
</style>
