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
 * - Provider health status indicators
 * - Contextual error messages with retry
 * - Confirmation UI for destructive actions
 * - Undo support for reversible actions
 * - API key management
 *
 * @see TASK-1120, TASK-1186 in MASTER_PLAN.md
 */

import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { X, Send, Sparkles, Loader2, Trash2, Settings, RotateCcw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { useAIChat } from '@/composables/useAIChat'
import { useAIChatStore } from '@/stores/aiChat'
import { useTimerStore } from '@/stores/timer'
import { createAIRouter } from '@/services/ai/router'
import ChatMessage from './ChatMessage.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'

// ============================================================================
// Composables & Stores
// ============================================================================

const {
  isPanelOpen,
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
  refreshOllamaModels,
  closePanel,
  sendMessage,
  clearMessages,
  clearError,
  initialize,
  handleKeyboardShortcut,
  pendingConfirmation,
  confirmPendingAction,
  cancelPendingAction,
  executeDirectTool,
} = useAIChat()

const store = useAIChatStore()
const timerStore = useTimerStore()

// ============================================================================
// Refs
// ============================================================================

const messagesContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const settingsContainerRef = ref<HTMLElement | null>(null)
const showSettings = ref(false)
const showApiKeys = ref(false)
const lastUserMessage = ref<string>('')

// Close settings dropdown on click outside
onClickOutside(settingsContainerRef, () => {
  showSettings.value = false
})

// API key refs
const groqApiKey = ref('')
const openrouterApiKey = ref('')
const testingGroqKey = ref(false)
const testingOpenrouterKey = ref(false)
const groqKeyStatus = ref<'idle' | 'success' | 'error'>('idle')
const openrouterKeyStatus = ref<'idle' | 'success' | 'error'>('idle')

// Provider health status
const providerHealth = ref<Record<string, 'healthy' | 'degraded' | 'unavailable' | 'unknown'>>({})

// ============================================================================
// Error UX - Contextual Error Messages
// ============================================================================

const friendlyError = computed(() => {
  if (!error.value) return null
  const err = error.value.toLowerCase()

  if (err.includes('econnrefused') || err.includes('localhost:11434')) {
    return {
      message: 'Ollama is not running. Start it with: ollama serve',
      type: 'warning' as const,
    }
  }
  if (err.includes('network') || err.includes('fetch')) {
    return {
      message: 'Network error. Check your internet connection.',
      type: 'error' as const,
    }
  }
  if (err.includes('rate limit') || err.includes('429')) {
    return {
      message: 'Rate limited. Please wait a moment and try again.',
      type: 'warning' as const,
    }
  }
  if (err.includes('401') || err.includes('unauthorized')) {
    return {
      message: 'Authentication failed. Check your API key.',
      type: 'error' as const,
    }
  }
  if (err.includes('all providers failed')) {
    return {
      message: 'AI is currently unavailable. Check provider settings below.',
      type: 'error' as const,
    }
  }
  return {
    message: error.value,
    type: 'error' as const,
  }
})

function retryLastMessage() {
  if (lastUserMessage.value) {
    clearError()
    sendMessage(lastUserMessage.value)
  }
}

/**
 * Handle quick action click — direct tool call if available, else send as message.
 */
function handleQuickAction(action: { label: string; message: string; directTool?: { tool: string; parameters: Record<string, unknown> } | null }) {
  if (action.directTool) {
    executeDirectTool(action.label, action.directTool)
  } else {
    sendMessage(action.message)
  }
}

// ============================================================================
// Context-Aware Quick Actions
// ============================================================================

const quickActions = computed(() => {
  const actions: { label: string; message: string; directTool?: { tool: string; parameters: Record<string, unknown> } | null }[] = []

  // Always available — these have direct tool mappings for Ollama compatibility
  actions.push({ label: 'Plan my day', message: 'Plan my day', directTool: { tool: 'get_daily_summary', parameters: {} } })
  actions.push({ label: "What's overdue?", message: "What tasks are overdue?", directTool: { tool: 'get_overdue_tasks', parameters: {} } })

  // When a task is selected
  if (store.context.selectedTask) {
    // Break down needs AI creativity — no direct tool
    actions.push({ label: 'Break down this task', message: `Break down the task "${store.context.selectedTask.title}" into actionable subtasks.`, directTool: null })
    actions.push({ label: 'Start timer for this', message: `Start a timer for the task "${store.context.selectedTask.title}"`, directTool: { tool: 'start_timer', parameters: { taskId: store.context.selectedTask.id } } })
  }

  // When timer is running
  if (timerStore.isTimerActive) {
    actions.push({ label: 'How much time left?', message: 'How much time is left on my current timer?', directTool: { tool: 'get_timer_status', parameters: {} } })
    actions.push({ label: 'What am I working on?', message: 'What task am I currently working on?', directTool: { tool: 'get_timer_status', parameters: {} } })
  }

  // Return max 4
  return actions.slice(0, 4)
})

// ============================================================================
// Undo
// ============================================================================

const hasUndoEntries = computed(() => store.undoBuffer.length > 0)
const latestUndoDescription = computed(() => {
  if (store.undoBuffer.length === 0) return ''
  return store.undoBuffer[0].description || store.undoBuffer[0].toolName
})

async function handleUndo() {
  await store.undoLastAction()
}

// ============================================================================
// Provider Health Status
// ============================================================================

async function refreshProviderHealth() {
  try {
    const router = createAIRouter({ debug: false })
    await router.initialize()
    providerHealth.value = router.getProviderHealthStatus()
    router.dispose()
  } catch {
    // Health check failed silently
  }
}

function healthDotClass(provider: string): string {
  const status = providerHealth.value[provider]
  if (status === 'healthy') return 'health-dot health-healthy'
  if (status === 'degraded') return 'health-dot health-degraded'
  if (status === 'unavailable') return 'health-dot health-unavailable'
  // 'unknown' or no status yet — don't render a dot
  return ''
}

// ============================================================================
// API Key Management
// ============================================================================

function loadApiKeys() {
  try {
    groqApiKey.value = localStorage.getItem('flowstate-groq-api-key') || ''
    openrouterApiKey.value = localStorage.getItem('flowstate-openrouter-api-key') || ''
  } catch {
    // localStorage not available
  }
}

function saveApiKeys() {
  try {
    localStorage.setItem('flowstate-groq-api-key', groqApiKey.value)
    localStorage.setItem('flowstate-openrouter-api-key', openrouterApiKey.value)
  } catch {
    // localStorage not available
  }
}

async function testGroqKey() {
  testingGroqKey.value = true
  groqKeyStatus.value = 'idle'
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${groqApiKey.value}` },
    })
    groqKeyStatus.value = response.ok ? 'success' : 'error'
  } catch {
    groqKeyStatus.value = 'error'
  } finally {
    testingGroqKey.value = false
  }
}

async function testOpenrouterKey() {
  testingOpenrouterKey.value = true
  openrouterKeyStatus.value = 'idle'
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${openrouterApiKey.value}` },
    })
    openrouterKeyStatus.value = response.ok ? 'success' : 'error'
  } catch {
    openrouterKeyStatus.value = 'error'
  } finally {
    testingOpenrouterKey.value = false
  }
}

// ============================================================================
// Ollama Model Options (for CustomSelect)
// ============================================================================

const ollamaModelOptions = computed(() => {
  const options = [{ label: 'Default (llama3.2)', value: '' }]
  for (const model of availableOllamaModels.value) {
    options.push({ label: model, value: model })
  }
  return options
})

function handleOllamaModelChange(value: string | number) {
  setModel(value ? String(value) : null)
}

// ============================================================================
// Cloud Model Options (for Groq / OpenRouter)
// ============================================================================

const groqModels = [
  { label: 'Llama 3.3 70B', value: 'llama-3.3-70b-versatile' },
  { label: 'Llama 3.1 8B', value: 'llama-3.1-8b-instant' },
  { label: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' },
]

const openrouterModels = [
  { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
  { label: 'Gemini Pro', value: 'google/gemini-pro' },
  { label: 'Llama 3.1 70B', value: 'meta-llama/llama-3.1-70b' },
]

// Cast to string for comparisons since 'openrouter' is not in the TS union
// but works at runtime (setProvider casts it)
const currentProvider = computed(() => String(selectedProvider.value))

const showCloudModelSelector = computed(() =>
  currentProvider.value === 'groq' || currentProvider.value === 'openrouter'
)

const cloudModelOptions = computed(() => {
  if (currentProvider.value === 'groq') return groqModels
  if (currentProvider.value === 'openrouter') return openrouterModels
  return []
})

function handleCloudModelChange(value: string | number) {
  setModel(value ? String(value) : null)
}

// ============================================================================
// Header Badge — Provider + Model Display
// ============================================================================

const modelDisplayNames: Record<string, string> = {
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B',
  'mixtral-8x7b-32768': 'Mixtral 8x7B',
  'anthropic/claude-3.5-sonnet': 'Claude 3.5',
  'google/gemini-pro': 'Gemini Pro',
  'meta-llama/llama-3.1-70b': 'Llama 3.1 70B',
}

const displayModelName = computed(() => {
  const model = selectedModel.value
  if (!model) return null
  // Check explicit mapping first
  if (modelDisplayNames[model]) return modelDisplayNames[model]
  // Ollama models (contain ':') are already readable
  if (model.includes(':')) return model
  return model
})

const providerLabel = computed(() => {
  const p = activeProvider.value
  if (p === 'ollama') return 'Local'
  if (p === 'groq') return 'Groq'
  if (p === 'openrouter') return 'OpenRouter'
  return p || ''
})

const headerBadgeText = computed(() => {
  const label = providerLabel.value
  if (!label) return ''
  // Auto mode — just show the detected provider
  if (selectedProvider.value === 'auto') return label
  // Specific provider selected with a model
  if (displayModelName.value) return `${label} \u00B7 ${displayModelName.value}`
  // Specific provider but no model selected — show provider only
  return label
})

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

// Auto-resize textarea
function autoResize(event: Event) {
  const target = event.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 120) + 'px'
}

// ============================================================================
// Escape Key Handler
// ============================================================================

function handleSelectTask(taskId: string) {
  // Dispatch global event to open task edit modal
  window.dispatchEvent(new CustomEvent('open-task-edit', { detail: { taskId } }))
}

function handleEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && isPanelOpen.value) {
    closePanel()
  }
}

// ============================================================================
// Focus Management
// ============================================================================

watch(isPanelOpen, (open) => {
  if (open) {
    nextTick(() => {
      inputRef.value?.focus()
    })
    refreshProviderHealth()
  }
})

// ============================================================================
// Provider Selection Helpers
// ============================================================================

function selectProviderOption(provider: 'auto' | 'groq' | 'openrouter' | 'ollama') {
  setProvider(provider)
  // Keep settings open for providers that show model selectors
  if (provider === 'auto') {
    showSettings.value = false
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  initialize()
  loadApiKeys()
  document.addEventListener('keydown', handleKeyboardShortcut)
  document.addEventListener('keydown', handleEscapeKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyboardShortcut)
  document.removeEventListener('keydown', handleEscapeKey)
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
          <span v-if="headerBadgeText" class="provider-badge" :class="'provider-' + activeProvider">
            {{ headerBadgeText }}
          </span>
        </div>
        <div class="header-actions">
          <!-- Settings dropdown -->
          <div ref="settingsContainerRef" class="settings-container">
            <button
              class="header-btn settings-btn"
              :class="{ active: showSettings }"
              title="AI Settings"
              @click="showSettings = !showSettings"
            >
              <Settings :size="16" />
            </button>

            <Transition name="dropdown">
              <div v-if="showSettings" class="settings-dropdown">
                <!-- Provider Selection -->
                <div class="settings-section">
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
                      <span v-if="healthDotClass('groq')" :class="healthDotClass('groq')"></span>
                      Groq
                    </button>
                    <button
                      class="provider-option"
                      :class="{ active: currentProvider === 'openrouter' }"
                      @click="selectProviderOption('openrouter')"
                    >
                      <span v-if="healthDotClass('openrouter')" :class="healthDotClass('openrouter')"></span>
                      OpenRouter
                    </button>
                    <button
                      class="provider-option"
                      :class="{ active: selectedProvider === 'ollama' }"
                      @click="setProvider('ollama')"
                    >
                      <span v-if="healthDotClass('ollama')" :class="healthDotClass('ollama')"></span>
                      Local
                    </button>
                  </div>
                </div>

                <!-- Cloud Model Selector (Groq / OpenRouter) -->
                <div v-if="showCloudModelSelector" class="settings-section">
                  <label class="settings-label">Model</label>
                  <CustomSelect
                    :model-value="selectedModel || cloudModelOptions[0]?.value || ''"
                    :options="cloudModelOptions"
                    placeholder="Select model..."
                    @update:model-value="handleCloudModelChange"
                  />
                </div>

                <!-- Local Model Selector (Ollama) -->
                <div v-if="selectedProvider === 'ollama' || (selectedProvider === 'auto' && activeProvider === 'ollama')" class="settings-section">
                  <div class="settings-label-row">
                    <label class="settings-label">Local Model</label>
                    <button
                      class="refresh-btn"
                      title="Refresh models"
                      :disabled="isLoadingModels"
                      @click="refreshOllamaModels"
                    >
                      <Loader2 v-if="isLoadingModels" class="spin" :size="12" />
                      <span v-else>&#x21bb;</span>
                    </button>
                  </div>
                  <CustomSelect
                    :model-value="selectedModel || ''"
                    :options="ollamaModelOptions"
                    placeholder="Select model..."
                    @update:model-value="handleOllamaModelChange"
                  />
                </div>

                <!-- API Keys Collapsible Section -->
                <div class="settings-section api-keys-section">
                  <button class="api-keys-toggle" @click="showApiKeys = !showApiKeys">
                    <label class="settings-label">API Keys</label>
                    <ChevronDown v-if="!showApiKeys" :size="14" class="api-keys-chevron" />
                    <ChevronUp v-else :size="14" class="api-keys-chevron" />
                  </button>

                  <Transition name="dropdown">
                    <div v-if="showApiKeys" class="api-keys-content">
                      <!-- Groq API Key -->
                      <div class="api-key-row">
                        <label class="api-key-label">Groq</label>
                        <div class="api-key-input-row">
                          <input
                            v-model="groqApiKey"
                            type="password"
                            class="api-key-input"
                            placeholder="sk-..."
                          />
                          <button
                            class="api-key-test-btn"
                            :class="{ success: groqKeyStatus === 'success', error: groqKeyStatus === 'error' }"
                            :disabled="!groqApiKey || testingGroqKey"
                            @click="testGroqKey"
                          >
                            <Loader2 v-if="testingGroqKey" class="spin" :size="10" />
                            <span v-else>Test</span>
                          </button>
                        </div>
                      </div>

                      <!-- OpenRouter API Key -->
                      <div class="api-key-row">
                        <label class="api-key-label">OpenRouter</label>
                        <div class="api-key-input-row">
                          <input
                            v-model="openrouterApiKey"
                            type="password"
                            class="api-key-input"
                            placeholder="sk-or-..."
                          />
                          <button
                            class="api-key-test-btn"
                            :class="{ success: openrouterKeyStatus === 'success', error: openrouterKeyStatus === 'error' }"
                            :disabled="!openrouterApiKey || testingOpenrouterKey"
                            @click="testOpenrouterKey"
                          >
                            <Loader2 v-if="testingOpenrouterKey" class="spin" :size="10" />
                            <span v-else>Test</span>
                          </button>
                        </div>
                      </div>

                      <button class="api-key-save-btn" @click="saveApiKeys">Save Keys</button>
                    </div>
                  </Transition>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Undo button -->
          <button
            v-if="hasUndoEntries"
            class="header-btn undo-btn"
            :title="'Undo: ' + latestUndoDescription"
            @click="handleUndo"
          >
            <RotateCcw :size="16" />
          </button>

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
            title="Close (Ctrl+/ or Esc)"
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
          @select-task="handleSelectTask"
        />

        <!-- Contextual Error -->
        <div v-if="friendlyError" class="error-message" :class="'error-' + friendlyError.type">
          <div class="error-content">
            <AlertTriangle :size="14" class="error-icon" />
            <p>{{ friendlyError.message }}</p>
          </div>
          <div class="error-actions">
            <button v-if="lastUserMessage" class="error-retry" @click="retryLastMessage">Retry</button>
            <button class="error-dismiss" @click="clearError">Dismiss</button>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="visibleMessages.length === 0" class="empty-state">
          <Sparkles class="empty-icon" :size="32" />
          <p>Ask me anything about your tasks!</p>
          <p class="empty-hint">Try: "Plan my day" or "Break down this task"</p>
          <p v-if="selectedProvider === 'ollama' || (selectedProvider === 'auto' && activeProvider === 'ollama')" class="provider-note">
            Using local AI — quick actions call tools directly
          </p>
        </div>
      </div>

      <!-- Confirmation Banner -->
      <div v-if="pendingConfirmation" class="confirmation-banner">
        <div class="confirmation-content">
          <AlertTriangle :size="16" class="confirmation-icon" />
          <span>Confirm: {{ pendingConfirmation.tool.replace(/_/g, ' ') }}?</span>
        </div>
        <div class="confirmation-actions">
          <button class="confirm-btn confirm-danger" @click="confirmPendingAction()">Confirm</button>
          <button class="confirm-btn confirm-cancel" @click="cancelPendingAction()">Cancel</button>
        </div>
      </div>

      <!-- Input -->
      <div class="ai-chat-input-container">
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="ai-chat-input"
          dir="auto"
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
        <button
          v-for="action in quickActions"
          :key="action.label"
          class="quick-action"
          @click="handleQuickAction(action)"
        >
          {{ action.label }}
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
  inset-inline-end: 0;
  width: 380px;
  max-width: 100vw;
  height: 100vh;
  background: var(--overlay-component-bg, rgba(18, 18, 22, 0.98));
  border-inline-start: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  z-index: 10001;
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
  z-index: 10000;
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

.provider-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: var(--radius-full, 9999px);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-ollama {
  background: rgba(34, 197, 94, 0.15);
  color: rgb(74, 222, 128);
}

.provider-groq {
  background: rgba(249, 115, 22, 0.15);
  color: rgb(251, 146, 60);
}

.provider-openrouter {
  background: rgba(59, 130, 246, 0.15);
  color: rgb(96, 165, 250);
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

.undo-btn {
  color: var(--accent-primary, #8b5cf6);
}

.undo-btn:hover {
  background: rgba(139, 92, 246, 0.15);
  color: var(--accent-primary, #8b5cf6);
}

/* ============================================================================
   Settings Dropdown
   ============================================================================ */

.settings-container {
  position: relative;
}

.settings-btn.active {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--accent-primary, #8b5cf6);
}

.settings-dropdown {
  position: absolute;
  top: 100%;
  inset-inline-end: 0;
  margin-top: var(--space-2, 8px);
  min-width: 240px;
  background: var(--overlay-component-bg, rgba(24, 24, 28, 0.98));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-3, 12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 100;
}

.settings-section {
  margin-bottom: var(--space-3, 12px);
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  margin-bottom: var(--space-2, 8px);
}

.settings-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2, 8px);
}

.settings-label-row .settings-label {
  margin-bottom: 0;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: 12px;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--text-primary, #fff);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.provider-options {
  display: flex;
  gap: var(--space-1, 4px);
  background: var(--bg-input, rgba(0, 0, 0, 0.2));
  border-radius: var(--radius-md, 8px);
  padding: 2px;
}

.provider-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: var(--space-1, 4px) var(--space-1, 4px);
  border: none;
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.provider-option:hover {
  color: var(--text-primary, #fff);
}

.provider-option.active {
  background: var(--accent-primary, #8b5cf6);
  color: white;
}

/* ============================================================================
   Health Status Dots
   ============================================================================ */

.health-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full, 9999px);
  flex-shrink: 0;
}

.health-healthy {
  background: rgb(34, 197, 94);
  box-shadow: 0 0 4px rgba(34, 197, 94, 0.4);
}

.health-degraded {
  background: rgb(234, 179, 8);
  box-shadow: 0 0 4px rgba(234, 179, 8, 0.4);
}

.health-unavailable {
  background: rgb(239, 68, 68);
  box-shadow: 0 0 4px rgba(239, 68, 68, 0.4);
}

/* ============================================================================
   API Keys Section
   ============================================================================ */

.api-keys-section {
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  padding-top: var(--space-3, 12px);
}

.api-keys-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.api-keys-toggle .settings-label {
  margin-bottom: 0;
  cursor: pointer;
}

.api-keys-chevron {
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
}

.api-keys-content {
  margin-top: var(--space-2, 8px);
}

.api-key-row {
  margin-bottom: var(--space-2, 8px);
}

.api-key-label {
  display: block;
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  margin-bottom: var(--space-1, 4px);
}

.api-key-input-row {
  display: flex;
  gap: var(--space-1, 4px);
}

.api-key-input {
  flex: 1;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  background: var(--bg-input, rgba(0, 0, 0, 0.2));
  color: var(--text-primary, #fff);
  border-radius: var(--radius-sm, 4px);
  font-size: 12px;
  font-family: inherit;
}

.api-key-input:focus {
  outline: none;
  border-color: var(--accent-primary, #8b5cf6);
}

.api-key-input::placeholder {
  color: var(--text-tertiary, rgba(255, 255, 255, 0.3));
}

.api-key-test-btn {
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  border-radius: var(--radius-sm, 4px);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.api-key-test-btn:hover:not(:disabled) {
  border-color: var(--accent-primary, #8b5cf6);
  color: var(--accent-primary, #8b5cf6);
}

.api-key-test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.api-key-test-btn.success {
  border-color: rgb(34, 197, 94);
  color: rgb(34, 197, 94);
}

.api-key-test-btn.error {
  border-color: var(--error, #ef4444);
  color: var(--error, #ef4444);
}

.api-key-save-btn {
  width: 100%;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border: none;
  background: var(--accent-primary, #8b5cf6);
  color: white;
  border-radius: var(--radius-sm, 4px);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-top: var(--space-2, 8px);
}

.api-key-save-btn:hover {
  background: var(--accent-hover, #7c3aed);
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

.provider-note {
  font-size: 11px;
  opacity: 0.5;
  margin-top: var(--space-2, 8px);
  color: rgb(74, 222, 128);
}

/* ============================================================================
   Error
   ============================================================================ */

.error-message {
  background: var(--error-bg, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--error, #ef4444);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-3, 12px);
  font-size: 13px;
}

.error-warning {
  border-color: rgb(234, 179, 8);
  background: rgba(234, 179, 8, 0.1);
}

.error-warning .error-icon {
  color: rgb(234, 179, 8);
}

.error-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2, 8px);
  color: var(--text-primary, #fff);
}

.error-icon {
  color: var(--error, #ef4444);
  flex-shrink: 0;
  margin-top: 1px;
}

.error-actions {
  display: flex;
  gap: var(--space-2, 8px);
  margin-top: var(--space-2, 8px);
}

.error-retry {
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border: 1px solid var(--accent-primary, #8b5cf6);
  background: transparent;
  color: var(--accent-primary, #8b5cf6);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.error-retry:hover {
  background: rgba(139, 92, 246, 0.15);
}

.error-dismiss {
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border: none;
  background: var(--error, #ef4444);
  color: white;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: 12px;
}

/* ============================================================================
   Confirmation Banner
   ============================================================================ */

.confirmation-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-4, 16px);
  background: rgba(234, 179, 8, 0.1);
  border-top: 1px solid rgba(234, 179, 8, 0.3);
  flex-shrink: 0;
}

.confirmation-content {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  font-size: 13px;
  color: rgb(234, 179, 8);
}

.confirmation-icon {
  flex-shrink: 0;
}

.confirmation-actions {
  display: flex;
  gap: var(--space-1, 4px);
  flex-shrink: 0;
}

.confirm-btn {
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border: none;
  border-radius: var(--radius-sm, 4px);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.confirm-danger {
  background: var(--error, #ef4444);
  color: white;
}

.confirm-danger:hover {
  background: #dc2626;
}

.confirm-cancel {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
}

.confirm-cancel:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-primary, #fff);
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

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ============================================================================
   RTL Overrides
   ============================================================================ */

[dir="rtl"] .ai-chat-panel,
:root[dir="rtl"] .ai-chat-panel {
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
}

[dir="rtl"] .slide-enter-from,
[dir="rtl"] .slide-leave-to,
:root[dir="rtl"] .slide-enter-from,
:root[dir="rtl"] .slide-leave-to {
  transform: translateX(-100%);
}
</style>
