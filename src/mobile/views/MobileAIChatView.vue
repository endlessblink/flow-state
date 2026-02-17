<template>
  <div class="mobile-ai-chat">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-left">
        <Sparkles :size="20" class="header-icon" />
        <h2>AI Chat</h2>
        <span v-if="headerBadgeText" class="provider-badge">{{ headerBadgeText }}</span>
      </div>
      <div class="header-actions">
        <button v-if="visibleMessages.length > 1" class="header-btn" title="Clear chat" @click="clearMessages">
          <Trash2 :size="18" />
        </button>
        <button class="header-btn" :class="{ active: showSettings }" title="Settings" @click="showSettings = !showSettings">
          <Settings :size="18" />
        </button>
      </div>
    </div>

    <!-- Settings Panel (collapsible) -->
    <Transition name="settings-slide">
      <div v-if="showSettings" class="settings-panel">
        <!-- Provider Selection -->
        <div class="settings-group">
          <label class="settings-label">Provider</label>
          <div class="provider-options">
            <button
              class="provider-option"
              :class="{ active: selectedProvider === 'auto' }"
              @click="selectProviderOption('auto')"
            >
              Auto
            </button>
            <button
              class="provider-option"
              :class="{ active: selectedProvider === 'groq' }"
              @click="selectProviderOption('groq')"
            >
              Groq
            </button>
            <button
              class="provider-option"
              :class="{ active: selectedProvider === 'openrouter' }"
              @click="selectProviderOption('openrouter')"
            >
              OpenRouter
            </button>
            <button
              class="provider-option"
              :class="{ active: selectedProvider === 'ollama' }"
              @click="selectProviderOption('ollama')"
            >
              Local
            </button>
          </div>
        </div>

        <!-- Cloud Model Selector -->
        <div v-if="showCloudModelSelector" class="settings-group">
          <label class="settings-label">Model</label>
          <CustomSelect
            :model-value="selectedModel || cloudModelOptions[0]?.value || ''"
            :options="cloudModelOptions"
            placeholder="Select model..."
            @update:model-value="handleCloudModelChange"
          />
        </div>

        <!-- Text Direction -->
        <div class="settings-group">
          <label class="settings-label">Text Direction</label>
          <div class="provider-options">
            <button class="provider-option" :class="{ active: chatDirection === 'auto' }" @click="setChatDirection('auto')">Auto</button>
            <button class="provider-option" :class="{ active: chatDirection === 'ltr' }" @click="setChatDirection('ltr')">LTR</button>
            <button class="provider-option" :class="{ active: chatDirection === 'rtl' }" @click="setChatDirection('rtl')">RTL</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Messages Area -->
    <div ref="messagesContainer" class="chat-messages" :dir="chatDirection !== 'auto' ? chatDirection : undefined">
      <!-- Empty State -->
      <div v-if="visibleMessages.length === 0" class="empty-state">
        <Sparkles class="empty-icon" :size="40" />
        <p class="empty-title">Ask me anything about your tasks!</p>
        <p class="empty-hint">Try: "Plan my day" or "What's overdue?"</p>

        <!-- Quick Actions (shown in empty state) -->
        <div class="quick-actions-grid">
          <button
            v-for="action in quickActions"
            :key="action.label"
            class="quick-action-btn"
            @click="handleQuickAction(action)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>

      <ChatMessage
        v-for="message in visibleMessages"
        :key="message.id"
        :message="message"
        :direction="chatDirection"
        @select-task="handleSelectTask"
      />

      <!-- Error -->
      <div v-if="friendlyError" class="error-message">
        <div class="error-content">
          <AlertTriangle :size="14" />
          <p>{{ friendlyError.message }}</p>
        </div>
        <div class="error-actions">
          <button v-if="lastUserMessage" class="error-retry" @click="retryLastMessage">Retry</button>
          <button class="error-dismiss" @click="clearError">Dismiss</button>
        </div>
      </div>
    </div>

    <!-- Confirmation Banner -->
    <div v-if="pendingConfirmation" class="confirmation-banner">
      <span>Confirm: {{ pendingConfirmation.tool.replace(/_/g, ' ') }}?</span>
      <div class="confirmation-actions">
        <button class="confirm-yes" @click="confirmPendingAction()">Confirm</button>
        <button class="confirm-no" @click="cancelPendingAction()">Cancel</button>
      </div>
    </div>

    <!-- Input Area (teleported to body to escape scroll container — same pattern as MobileInboxView BUG-1312) -->
    <Teleport to="body">
      <div class="chat-input-bar">
        <div class="input-row">
          <textarea
            ref="inputRef"
            v-model="inputText"
            class="chat-input"
            :dir="chatDirection"
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
            <Loader2 v-if="isGenerating" class="spin" :size="20" />
            <Send v-else :size="20" />
          </button>
        </div>

        <!-- Inline Quick Actions (shown when messages exist) -->
        <div v-if="visibleMessages.length > 0" class="quick-actions-row">
          <button
            v-for="action in quickActions"
            :key="action.label"
            class="quick-action-chip"
            @click="handleQuickAction(action)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Sparkles, Send, Loader2, Trash2, Settings, AlertTriangle } from 'lucide-vue-next'
import { useAIChat } from '@/composables/useAIChat'
import { useAIChatStore } from '@/stores/aiChat'
import { useTimerStore } from '@/stores/timer'
import ChatMessage from '@/components/ai/ChatMessage.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import { GROQ_MODELS, OPENROUTER_MODELS, asValueLabel, getDisplayName } from '@/config/aiModels'

// ============================================================================
// Composables & Stores
// ============================================================================

const {
  visibleMessages,
  inputText,
  isGenerating,
  canSend,
  error,
  activeProvider,
  selectedProvider,
  selectedModel,
  availableOllamaModels,
  isLoadingModels,
  setProvider,
  setModel,
  sendMessage,
  clearMessages,
  clearError,
  initialize,
  pendingConfirmation,
  confirmPendingAction,
  cancelPendingAction,
  executeDirectTool,
  chatDirection,
  setChatDirection,
} = useAIChat()

const store = useAIChatStore()
const timerStore = useTimerStore()

// ============================================================================
// Refs
// ============================================================================

const messagesContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const lastUserMessage = ref<string>('')
const showSettings = ref(false)

// ============================================================================
// Error UX
// ============================================================================

const friendlyError = computed(() => {
  if (!error.value) return null
  const err = error.value.toLowerCase()

  if (err.includes('econnrefused') || err.includes('localhost:11434')) {
    return { message: 'Ollama is not running. Start it with: ollama serve' }
  }
  if (err.includes('network') || err.includes('fetch')) {
    return { message: 'Network error. Check your internet connection.' }
  }
  if (err.includes('rate limit') || err.includes('429')) {
    return { message: 'Rate limited. Please wait a moment and try again.' }
  }
  if (err.includes('401') || err.includes('unauthorized')) {
    return { message: 'Authentication failed. Check your API key.' }
  }
  if (err.includes('all providers failed')) {
    return { message: 'AI is currently unavailable. Check provider settings.' }
  }
  return { message: error.value }
})

function retryLastMessage() {
  if (lastUserMessage.value) {
    clearError()
    sendMessage(lastUserMessage.value)
  }
}

// ============================================================================
// Quick Actions
// ============================================================================

function handleQuickAction(action: { label: string; message: string; directTool?: { tool: string; parameters: Record<string, unknown> } | null }) {
  if (action.directTool) {
    executeDirectTool(action.label, action.directTool)
  } else {
    sendMessage(action.message)
  }
}

const quickActions = computed(() => {
  const actions: { label: string; message: string; directTool?: { tool: string; parameters: Record<string, unknown> } | null }[] = []

  actions.push({ label: 'Plan my day', message: 'Plan my day', directTool: { tool: 'get_daily_summary', parameters: {} } })
  actions.push({ label: "What's overdue?", message: 'What tasks are overdue?', directTool: { tool: 'get_overdue_tasks', parameters: {} } })

  if (store.context.selectedTask) {
    actions.push({ label: 'Break down task', message: `Break down the task "${store.context.selectedTask.title}" into subtasks.`, directTool: null })
  }

  if (timerStore.isTimerActive) {
    actions.push({ label: 'Timer status', message: 'How much time is left on my timer?', directTool: { tool: 'get_timer_status', parameters: {} } })
  }

  return actions.slice(0, 4)
})

// ============================================================================
// Provider Display
// ============================================================================

const providerLabel = computed(() => {
  const p = activeProvider.value
  if (p === 'ollama') return 'Local'
  if (p === 'groq') return 'Groq'
  if (p === 'openrouter') return 'OpenRouter'
  return p || ''
})

const displayModelName = computed(() => {
  const model = selectedModel.value
  if (!model) return null
  const displayName = getDisplayName(model)
  if (displayName === model && model.includes(':')) return model
  return displayName !== model ? displayName : model
})

const headerBadgeText = computed(() => {
  const label = providerLabel.value
  if (!label) return ''
  if (selectedProvider.value === 'auto') return label
  if (displayModelName.value) return `${label} · ${displayModelName.value}`
  return label
})

// ============================================================================
// Provider Settings
// ============================================================================

const groqModels = asValueLabel(GROQ_MODELS)
const openrouterModels = asValueLabel(OPENROUTER_MODELS)
const currentProvider = computed(() => String(selectedProvider.value))
const showCloudModelSelector = computed(() => currentProvider.value === 'groq' || currentProvider.value === 'openrouter')

const cloudModelOptions = computed(() => {
  if (currentProvider.value === 'groq') return groqModels
  if (currentProvider.value === 'openrouter') return openrouterModels
  return []
})

function handleCloudModelChange(value: string | number) {
  setModel(value ? String(value) : null)
}

function selectProviderOption(provider: 'auto' | 'groq' | 'openrouter' | 'ollama') {
  setProvider(provider)
  if (provider === 'auto') {
    showSettings.value = false
  }
}

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
    lastUserMessage.value = message
    sendMessage(message)
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSubmit()
  }
}

function autoResize(event: Event) {
  const target = event.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 120) + 'px'
}

function handleSelectTask(taskId: string) {
  window.dispatchEvent(new CustomEvent('open-task-edit', { detail: { taskId } }))
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  initialize()
  nextTick(() => {
    scrollToBottom()
  })
})
</script>

<style scoped>
.mobile-ai-chat {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  /* Space for teleported input bar (~120px) — nav spacing handled by MobileLayout */
  padding-bottom: 120px;
}

/* Header */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  position: sticky;
  top: 0;
  background: var(--app-background-gradient);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  color: var(--brand-primary);
}

.chat-header h2 {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin: 0;
}

.provider-badge {
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--surface-secondary);
  color: var(--text-tertiary);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.header-btn {
  width: var(--space-9);
  height: var(--space-9);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--duration-normal);
}

.header-btn.active {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.header-btn:active {
  transform: scale(0.95);
}

/* Settings Panel */
.settings-panel {
  padding: var(--space-3) var(--space-4);
  background: var(--surface-secondary);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}

.settings-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.provider-options {
  display: flex;
  gap: var(--space-1_5);
  flex-wrap: wrap;
}

.provider-option {
  padding: var(--space-1_5) var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: var(--surface-primary);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.provider-option.active {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: var(--brand-primary-subtle);
}

.provider-option:active {
  transform: scale(0.97);
}

.settings-slide-enter-active,
.settings-slide-leave-active {
  transition: all var(--duration-normal) ease;
  overflow: hidden;
}

.settings-slide-enter-from,
.settings-slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.settings-slide-enter-to,
.settings-slide-leave-from {
  max-height: 300px;
  opacity: 1;
}

/* Messages Area */
.chat-messages {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-12) var(--space-4);
  flex: 1;
}

.empty-icon {
  color: var(--brand-primary);
  opacity: 0.6;
  margin-bottom: var(--space-4);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0 0 var(--space-6);
}

.quick-actions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
}

.quick-action-btn {
  padding: var(--space-2_5) var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-subtle);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all var(--duration-fast);
}

.quick-action-btn:active {
  transform: scale(0.97);
  border-color: var(--brand-primary);
}

/* Error */
.error-message {
  background: var(--danger-bg-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}

.error-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  color: var(--danger-text);
}

.error-content p {
  margin: 0;
  font-size: var(--text-sm);
}

.error-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.error-retry,
.error-dismiss {
  padding: var(--space-1_5) var(--space-3);
  border-radius: var(--radius-md);
  border: none;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
}

.error-retry {
  background: var(--danger-text);
  color: white;
}

.error-dismiss {
  background: var(--surface-secondary);
  color: var(--text-secondary);
}

/* Confirmation Banner */
.confirmation-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-priority-medium-bg-subtle);
  border-top: 1px solid var(--color-warning);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-warning);
}

.confirmation-actions {
  display: flex;
  gap: var(--space-2);
}

.confirm-yes,
.confirm-no {
  padding: var(--space-1_5) var(--space-3);
  border-radius: var(--radius-md);
  border: none;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
}

.confirm-yes {
  background: var(--color-warning);
  color: white;
}

.confirm-no {
  background: var(--surface-secondary);
  color: var(--text-secondary);
}

/* Input Bar — Teleported to body (same pattern as MobileInboxView BUG-1312) */
.chat-input-bar {
  position: fixed;
  bottom: var(--space-16); /* Above nav */
  left: 0;
  right: 0;
  padding: var(--space-3) var(--space-4);
  padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  background: var(--surface-primary);
  border-top: 1px solid var(--border-subtle);
  z-index: var(--z-sticky);
  box-shadow: var(--shadow-md);
}

.input-row {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  min-width: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-family: inherit;
  outline: none;
  resize: none;
  line-height: 1.4;
  max-height: 120px;
}

.chat-input:focus {
  border-color: var(--brand-primary);
  box-shadow: var(--brand-primary-glow);
}

.chat-input:disabled {
  opacity: 0.6;
}

.send-btn {
  width: var(--space-12);
  height: var(--space-12);
  border-radius: var(--radius-full);
  border: none;
  background: var(--brand-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: var(--brand-primary-glow);
  transition: all var(--duration-fast);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn:active:not(:disabled) {
  transform: scale(0.95);
}

/* Quick Action Chips (inline below input) */
.quick-actions-row {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.quick-actions-row::-webkit-scrollbar {
  display: none;
}

.quick-action-chip {
  padding: var(--space-1_5) var(--space-3);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.quick-action-chip:active {
  transform: scale(0.97);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

/* Spinner */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* RTL Support */
[dir="rtl"] .header-left {
  flex-direction: row-reverse;
}

[dir="rtl"] .header-actions {
  flex-direction: row-reverse;
}

[dir="rtl"] .input-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .quick-actions-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .error-content {
  flex-direction: row-reverse;
}

[dir="rtl"] .confirmation-banner {
  flex-direction: row-reverse;
}
</style>
