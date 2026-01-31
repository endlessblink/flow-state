<script setup lang="ts">
/**
 * AI Chat Panel
 *
 * Collapsible right sidebar for AI conversations.
 * Features:
 * - Smooth slide-in/out animation
 * - Message history with streaming display
 * - Action buttons in AI responses
 * - Context-aware suggestions
 *
 * @see TASK-1120 in MASTER_PLAN.md
 */

import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { X, Send, Sparkles, Loader2, Trash2 } from 'lucide-vue-next'
import { useAIChat } from '@/composables/useAIChat'
import ChatMessage from './ChatMessage.vue'

// ============================================================================
// Composables
// ============================================================================

const {
  isPanelOpen,
  visibleMessages,
  inputText,
  isGenerating,
  canSend,
  error,
  togglePanel,
  closePanel,
  sendMessage,
  clearMessages,
  clearError,
  initialize,
  handleKeyboardShortcut
} = useAIChat()

// ============================================================================
// Refs
// ============================================================================

const messagesContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

// ============================================================================
// Auto-scroll
// ============================================================================

watch(visibleMessages, () => {
  scrollToBottom()
}, { deep: true })

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// ============================================================================
// Input Handling
// ============================================================================

function handleSubmit() {
  if (!canSend.value) return
  const message = inputText.value.trim()
  if (message) {
    sendMessage(message)
  }
}

function handleKeydown(event: KeyboardEvent) {
  // Submit on Enter (without Shift)
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSubmit()
  }
}

// Auto-resize textarea
function autoResize(event: Event) {
  const target = event.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 120) + 'px'
}

// ============================================================================
// Focus Management
// ============================================================================

watch(isPanelOpen, (open) => {
  if (open) {
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

// ============================================================================
// Keyboard Shortcut
// ============================================================================

onMounted(() => {
  initialize()
  document.addEventListener('keydown', handleKeyboardShortcut)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyboardShortcut)
})
</script>

<template>
  <!-- Backdrop (mobile) -->
  <Transition name="fade">
    <div
      v-if="isPanelOpen"
      class="ai-chat-backdrop"
      @click="closePanel"
    />
  </Transition>

  <!-- Panel -->
  <Transition name="slide">
    <aside
      v-if="isPanelOpen"
      class="ai-chat-panel"
    >
      <!-- Header -->
      <header class="ai-chat-header">
        <div class="header-title">
          <Sparkles class="header-icon" :size="18" />
          <span>AI Assistant</span>
        </div>
        <div class="header-actions">
          <button
            v-if="visibleMessages.length > 1"
            class="header-btn"
            title="Clear chat"
            @click="clearMessages"
          >
            <Trash2 :size="16" />
          </button>
          <button
            class="header-btn close-btn"
            title="Close (Ctrl+/)"
            @click="closePanel"
          >
            <X :size="18" />
          </button>
        </div>
      </header>

      <!-- Messages -->
      <div
        ref="messagesContainer"
        class="ai-chat-messages"
      >
        <ChatMessage
          v-for="message in visibleMessages"
          :key="message.id"
          :message="message"
        />

        <!-- Error -->
        <div v-if="error" class="error-message">
          <p>{{ error }}</p>
          <button class="error-dismiss" @click="clearError">Dismiss</button>
        </div>

        <!-- Empty state -->
        <div v-if="visibleMessages.length === 0" class="empty-state">
          <Sparkles class="empty-icon" :size="32" />
          <p>Ask me anything about your tasks!</p>
          <p class="empty-hint">Try: "Organize my canvas" or "Break down this task"</p>
        </div>
      </div>

      <!-- Input -->
      <div class="ai-chat-input-container">
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="ai-chat-input"
          placeholder="Ask AI..."
          rows="1"
          :disabled="isGenerating"
          @keydown="handleKeydown"
          @input="autoResize"
        />
        <button
          class="send-btn"
          :disabled="!canSend"
          @click="handleSubmit"
        >
          <Loader2 v-if="isGenerating" class="spin" :size="18" />
          <Send v-else :size="18" />
        </button>
      </div>

      <!-- Quick Actions -->
      <div class="ai-chat-quick-actions">
        <button class="quick-action" @click="sendMessage('Organize my canvas')">
          Organize canvas
        </button>
        <button class="quick-action" @click="sendMessage('Plan my week')">
          Plan week
        </button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
/* ============================================================================
   Panel Container
   ============================================================================ */

.ai-chat-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  max-width: 100vw;
  height: 100vh;
  background: var(--overlay-component-bg, rgba(18, 18, 22, 0.98));
  border-left: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  z-index: 1000;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
}

/* Mobile full-width */
@media (max-width: 640px) {
  .ai-chat-panel {
    width: 100vw;
  }
}

/* ============================================================================
   Backdrop
   ============================================================================ */

.ai-chat-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  display: none;
}

@media (max-width: 640px) {
  .ai-chat-backdrop {
    display: block;
  }
}

/* ============================================================================
   Header
   ============================================================================ */

.ai-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary, #fff);
}

.header-icon {
  color: var(--accent-primary, #8b5cf6);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.header-btn:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--text-primary, #fff);
}

.close-btn:hover {
  background: var(--error-bg, rgba(239, 68, 68, 0.1));
  color: var(--error, #ef4444);
}

/* ============================================================================
   Messages
   ============================================================================ */

.ai-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

/* ============================================================================
   Empty State
   ============================================================================ */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-8, 32px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  flex: 1;
}

.empty-icon {
  color: var(--accent-primary, #8b5cf6);
  opacity: 0.5;
  margin-bottom: var(--space-3, 12px);
}

.empty-hint {
  font-size: 12px;
  opacity: 0.7;
  margin-top: var(--space-2, 8px);
}

/* ============================================================================
   Error
   ============================================================================ */

.error-message {
  background: var(--error-bg, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--error, #ef4444);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-3, 12px);
  color: var(--error, #ef4444);
  font-size: 13px;
}

.error-dismiss {
  margin-top: var(--space-2, 8px);
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border: none;
  background: var(--error, #ef4444);
  color: white;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: 12px;
}

/* ============================================================================
   Input
   ============================================================================ */

.ai-chat-input-container {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: var(--bg-elevated, rgba(30, 30, 35, 0.8));
}

.ai-chat-input {
  flex: 1;
  resize: none;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  background: var(--bg-input, rgba(0, 0, 0, 0.3));
  color: var(--text-primary, #fff);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  font-size: 14px;
  line-height: 1.5;
  min-height: 40px;
  max-height: 120px;
  font-family: inherit;
}

.ai-chat-input:focus {
  outline: none;
  border-color: var(--accent-primary, #8b5cf6);
}

.ai-chat-input::placeholder {
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
}

.ai-chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--accent-primary, #8b5cf6);
  color: white;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-hover, #7c3aed);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ============================================================================
   Quick Actions
   ============================================================================ */

.ai-chat-quick-actions {
  display: flex;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-4, 16px) var(--space-3, 12px);
  flex-wrap: wrap;
}

.quick-action {
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  border-radius: var(--radius-full, 9999px);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.quick-action:hover {
  border-color: var(--accent-primary, #8b5cf6);
  color: var(--accent-primary, #8b5cf6);
  background: var(--accent-bg, rgba(139, 92, 246, 0.1));
}

/* ============================================================================
   Animations
   ============================================================================ */

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
