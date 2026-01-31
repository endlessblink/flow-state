<script setup lang="ts">
/**
 * Chat Message Component
 *
 * Displays a single message in the AI chat panel.
 * Supports:
 * - User and assistant message styling
 * - Streaming animation
 * - Action buttons
 * - Error states
 *
 * @see TASK-1120 in MASTER_PLAN.md
 */

import { computed, ref } from 'vue'
import { User, Sparkles, Loader2, Check } from 'lucide-vue-next'
import type { ChatMessage, ChatAction } from '@/stores/aiChat'

// ============================================================================
// Props
// ============================================================================

const props = defineProps<{
  message: ChatMessage
}>()

// ============================================================================
// State
// ============================================================================

const loadingActions = ref<Set<string>>(new Set())

// ============================================================================
// Computed
// ============================================================================

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isStreaming = computed(() => props.message.isStreaming)
const hasError = computed(() => !!props.message.error)
const hasActions = computed(() =>
  props.message.actions && props.message.actions.length > 0
)

// ============================================================================
// Actions
// ============================================================================

async function handleAction(action: ChatAction) {
  if (loadingActions.value.has(action.id)) return
  if (action.completed) return

  loadingActions.value.add(action.id)

  try {
    await action.handler()
    action.completed = true
  } catch (err) {
    console.error('[ChatMessage] Action failed:', err)
  } finally {
    loadingActions.value.delete(action.id)
  }
}

function isActionLoading(action: ChatAction): boolean {
  return loadingActions.value.has(action.id)
}
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'message-user': isUser,
      'message-assistant': isAssistant,
      'message-streaming': isStreaming,
      'message-error': hasError
    }"
  >
    <!-- Avatar -->
    <div class="message-avatar">
      <User v-if="isUser" :size="16" />
      <Sparkles v-else :size="16" />
    </div>

    <!-- Content -->
    <div class="message-content">
      <!-- Text -->
      <div class="message-text">
        {{ message.content }}
        <span v-if="isStreaming" class="cursor-blink">|</span>
      </div>

      <!-- Error -->
      <div v-if="hasError" class="message-error-text">
        {{ message.error }}
      </div>

      <!-- Actions -->
      <div v-if="hasActions && !isStreaming" class="message-actions">
        <button
          v-for="action in message.actions"
          :key="action.id"
          class="action-btn"
          :class="{
            'action-primary': action.variant === 'primary',
            'action-secondary': action.variant === 'secondary',
            'action-danger': action.variant === 'danger',
            'action-completed': action.completed
          }"
          :disabled="isActionLoading(action) || action.completed"
          @click="handleAction(action)"
        >
          <Loader2
            v-if="isActionLoading(action)"
            class="action-icon spin"
            :size="14"
          />
          <Check
            v-else-if="action.completed"
            class="action-icon"
            :size="14"
          />
          <span>{{ action.label }}</span>
        </button>
      </div>

      <!-- Metadata -->
      <div v-if="message.metadata && !isStreaming" class="message-meta">
        <span v-if="message.metadata.model">{{ message.metadata.model }}</span>
        <span v-if="message.metadata.latencyMs">{{ message.metadata.latencyMs }}ms</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================================================
   Message Container
   ============================================================================ */

.chat-message {
  display: flex;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-lg, 12px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ============================================================================
   User Message
   ============================================================================ */

.message-user {
  background: var(--accent-bg, rgba(139, 92, 246, 0.1));
  margin-left: var(--space-4, 16px);
}

.message-user .message-avatar {
  background: var(--accent-primary, #8b5cf6);
  color: white;
}

/* ============================================================================
   Assistant Message
   ============================================================================ */

.message-assistant {
  background: var(--bg-elevated, rgba(255, 255, 255, 0.03));
  margin-right: var(--space-4, 16px);
}

.message-assistant .message-avatar {
  background: linear-gradient(135deg, #8b5cf6, #06b6d4);
  color: white;
}

/* ============================================================================
   Avatar
   ============================================================================ */

.message-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md, 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ============================================================================
   Content
   ============================================================================ */

.message-content {
  flex: 1;
  min-width: 0;
}

.message-text {
  color: var(--text-primary, #fff);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ============================================================================
   Streaming Cursor
   ============================================================================ */

.cursor-blink {
  animation: blink 1s step-end infinite;
  color: var(--accent-primary, #8b5cf6);
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.message-streaming {
  border: 1px solid var(--accent-primary, #8b5cf6);
  border-style: dashed;
}

/* ============================================================================
   Error
   ============================================================================ */

.message-error {
  border: 1px solid var(--error, #ef4444);
}

.message-error-text {
  color: var(--error, #ef4444);
  font-size: 12px;
  margin-top: var(--space-2, 8px);
}

/* ============================================================================
   Actions
   ============================================================================ */

.message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2, 8px);
  margin-top: var(--space-3, 12px);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.action-primary {
  background: var(--accent-primary, #8b5cf6);
  color: white;
}

.action-primary:hover:not(:disabled) {
  background: var(--accent-hover, #7c3aed);
}

.action-secondary {
  background: transparent;
  border-color: var(--border-subtle, rgba(255, 255, 255, 0.12));
  color: var(--text-primary, #fff);
}

.action-secondary:hover:not(:disabled) {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
}

.action-danger {
  background: transparent;
  border-color: var(--error, #ef4444);
  color: var(--error, #ef4444);
}

.action-danger:hover:not(:disabled) {
  background: var(--error-bg, rgba(239, 68, 68, 0.1));
}

.action-completed {
  background: var(--success-bg, rgba(16, 185, 129, 0.1));
  border-color: var(--success, #10b981);
  color: var(--success, #10b981);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-icon {
  flex-shrink: 0;
}

/* ============================================================================
   Metadata
   ============================================================================ */

.message-meta {
  display: flex;
  gap: var(--space-2, 8px);
  margin-top: var(--space-2, 8px);
  font-size: 11px;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
}

/* ============================================================================
   Animations
   ============================================================================ */

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
