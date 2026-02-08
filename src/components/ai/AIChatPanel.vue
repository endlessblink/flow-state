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
import { X, Send, Sparkles, Loader2, Trash2, Settings, RotateCcw, AlertTriangle, ChevronDown, ChevronUp, Maximize2, Minimize2, Zap } from 'lucide-vue-next'
import { useAIChat } from '@/composables/useAIChat'
import { useAIChatStore } from '@/stores/aiChat'
import { useTimerStore } from '@/stores/timer'
import { createAIRouter } from '@/services/ai/router'
import { useAIProactiveNudges } from '@/composables/useAIProactiveNudges'
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
  aiPersonality,
  setPersonality,
} = useAIChat()

// Personality helpers
const isGridHandler = computed(() => aiPersonality.value === 'grid_handler')

const store = useAIChatStore()
const timerStore = useTimerStore()
const nudges = useAIProactiveNudges()

// ============================================================================
// Refs
// ============================================================================

const messagesContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const settingsContainerRef = ref<HTMLElement | null>(null)
const showSettings = ref(false)
const showApiKeys = ref(false)
const lastUserMessage = ref<string>('')

// Panel sizing mode: compact (380px) | expanded (600px) | fullscreen
const panelMode = ref<'compact' | 'expanded' | 'fullscreen'>('compact')

function cyclePanelMode() {
  if (panelMode.value === 'compact') panelMode.value = 'expanded'
  else if (panelMode.value === 'expanded') panelMode.value = 'fullscreen'
  else panelMode.value = 'compact'
}

const panelStyle = computed(() => {
  if (panelMode.value === 'fullscreen') return {}
  if (panelMode.value === 'expanded') return { width: '600px' }
  return { width: '380px' }
})

// Close settings dropdown on click outside
onClickOutside(settingsContainerRef, () => {
  showSettings.value = false
})

// Provider status refs (for health checks only)
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
// Provider Health Checks (TASK-1250: API keys are server-side only)
// ============================================================================
// Note: Groq and OpenRouter API keys are managed server-side via Doppler.
// The test functions below verify proxy availability, NOT localStorage keys.

async function testGroqKey() {
  testingGroqKey.value = true
  groqKeyStatus.value = 'idle'
  try {
    // TASK-1251: Use proxy to test server-side key configuration
    // Note: This tests the server-side API key (from Doppler/env vars),
    // not the key entered in the UI. The UI inputs are legacy - the proxy
    // handles keys server-side. TASK-1250 will remove these UI inputs.
    const router = createAIRouter({ debug: false })
    await router.initialize()
    const available = await router.isProviderAvailable('groq')
    groqKeyStatus.value = available ? 'success' : 'error'
    router.dispose()
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
    // TASK-1251: Use proxy to test server-side key configuration
    // Note: This tests the server-side API key (from Doppler/env vars),
    // not the key entered in the UI. The UI inputs are legacy - the proxy
    // handles keys server-side. TASK-1250 will remove these UI inputs.
    const router = createAIRouter({ debug: false })
    await router.initialize()
    const available = await router.isProviderAvailable('openrouter')
    openrouterKeyStatus.value = available ? 'success' : 'error'
    router.dispose()
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
    // In fullscreen, Escape returns to compact instead of closing
    if (panelMode.value !== 'compact') {
      panelMode.value = 'compact'
      return
    }
    closePanel()
  }
}

function handlePanelModeShortcut(event: KeyboardEvent) {
  if (event.ctrlKey && event.shiftKey && event.key === 'F') {
    event.preventDefault()
    if (isPanelOpen.value) {
      cyclePanelMode()
    }
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

// Handle nudge send events
function handleNudgeSend(event: Event) {
  const detail = (event as CustomEvent).detail
  if (detail?.content) {
    sendMessage(detail.content)
  }
}

onMounted(() => {
  initialize()
  nudges.start()
  document.addEventListener('keydown', handleKeyboardShortcut)
  document.addEventListener('keydown', handleEscapeKey)
  document.addEventListener('keydown', handlePanelModeShortcut)
  window.addEventListener('ai-nudge-send', handleNudgeSend)
})

onUnmounted(() => {
  nudges.stop()
  document.removeEventListener('keydown', handleKeyboardShortcut)
  document.removeEventListener('keydown', handleEscapeKey)
  document.removeEventListener('keydown', handlePanelModeShortcut)
  window.removeEventListener('ai-nudge-send', handleNudgeSend)
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
      :class="{ 'panel-fullscreen': panelMode === 'fullscreen' }"
      :style="panelStyle"
    >
      <!-- Header -->
      <header class="ai-chat-header">
        <div class="header-title">
          <Zap v-if="isGridHandler" class="header-icon grid-handler-icon" :size="18" />
          <Sparkles v-else class="header-icon" :size="18" />
          <span>{{ isGridHandler ? 'Grid Handler' : 'AI Assistant' }}</span>
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

                <!-- AI Personality Toggle -->
                <div class="settings-section">
                  <label class="settings-label">Personality</label>
                  <div class="personality-toggle">
                    <button
                      class="personality-option"
                      :class="{ active: !isGridHandler }"
                      @click="setPersonality('professional')"
                    >
                      <Sparkles :size="12" />
                      Professional
                    </button>
                    <button
                      class="personality-option grid-handler-option"
                      :class="{ active: isGridHandler }"
                      @click="setPersonality('grid_handler')"
                    >
                      <Zap :size="12" />
                      Grid Handler
                    </button>
                  </div>
                </div>

                <!-- Provider Status Section (TASK-1250: Keys are server-side) -->
                <div class="settings-section api-keys-section">
                  <button class="api-keys-toggle" @click="showApiKeys = !showApiKeys">
                    <label class="settings-label">Provider Status</label>
                    <ChevronDown v-if="!showApiKeys" :size="14" class="api-keys-chevron" />
                    <ChevronUp v-else :size="14" class="api-keys-chevron" />
                  </button>

                  <Transition name="dropdown">
                    <div v-if="showApiKeys" class="api-keys-content">
                      <div class="provider-info-box">
                        <p class="provider-info-text">
                          API keys are managed securely via server-side configuration.
                          Test buttons verify proxy availability.
                        </p>
                      </div>

                      <!-- Groq Status -->
                      <div class="provider-status-row">
                        <div class="provider-status-label">
                          <span v-if="healthDotClass('groq')" :class="healthDotClass('groq')"></span>
                          <span>Groq</span>
                        </div>
                        <button
                          class="api-key-test-btn"
                          :class="{ success: groqKeyStatus === 'success', error: groqKeyStatus === 'error' }"
                          :disabled="testingGroqKey"
                          @click="testGroqKey"
                        >
                          <Loader2 v-if="testingGroqKey" class="spin" :size="10" />
                          <span v-else>Test</span>
                        </button>
                      </div>

                      <!-- OpenRouter Status -->
                      <div class="provider-status-row">
                        <div class="provider-status-label">
                          <span v-if="healthDotClass('openrouter')" :class="healthDotClass('openrouter')"></span>
                          <span>OpenRouter</span>
                        </div>
                        <button
                          class="api-key-test-btn"
                          :class="{ success: openrouterKeyStatus === 'success', error: openrouterKeyStatus === 'error' }"
                          :disabled="testingOpenrouterKey"
                          @click="testOpenrouterKey"
                        >
                          <Loader2 v-if="testingOpenrouterKey" class="spin" :size="10" />
                          <span v-else>Test</span>
                        </button>
                      </div>
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
            class="header-btn expand-btn"
            :title="panelMode === 'fullscreen' ? 'Minimize (Ctrl+Shift+F)' : 'Expand (Ctrl+Shift+F)'"
            @click="cyclePanelMode"
          >
            <Minimize2 v-if="panelMode === 'fullscreen'" :size="16" />
            <Maximize2 v-else :size="16" />
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
  background: var(--overlay-component-bg);
  border-inline-start: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  z-index: var(--z-tooltip);
  box-shadow: var(--shadow-xl);
  transition: width var(--duration-normal) ease;
}

.panel-fullscreen {
  inset: 0;
  width: 100vw !important;
  max-width: 100vw;
  height: 100vh;
  border-radius: 0;
  border-inline-start: none;
  z-index: var(--z-tooltip);
  box-shadow: none;
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
  background: var(--overlay-component-bg-lighter);
  z-index: var(--z-tooltip);
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
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.header-icon {
  color: var(--accent-primary, #8b5cf6);
}

.grid-handler-icon {
  color: #00ff88;
  filter: drop-shadow(0 0 var(--space-1) rgba(0, 255, 136, 0.5));
}

.provider-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 1px var(--space-1_5);
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--surface-hover);
  color: var(--text-tertiary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-ollama {
  background: var(--success-bg-light);
  color: var(--color-success);
}

.provider-groq {
  background: var(--orange-bg-light);
  color: var(--status-on-hold-text);
}

.provider-openrouter {
  background: var(--blue-bg-light);
  color: var(--status-planned-text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-8);
  height: var(--space-8);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.header-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.expand-btn:hover {
  background: var(--purple-bg-subtle);
  color: var(--accent-primary, #8b5cf6);
}

.close-btn:hover {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
}

.undo-btn {
  color: var(--accent-primary, #8b5cf6);
}

.undo-btn:hover {
  background: var(--purple-bg-subtle);
  color: var(--accent-primary, #8b5cf6);
}

/* ============================================================================
   Settings Dropdown
   ============================================================================ */

.settings-container {
  position: relative;
}

.settings-btn.active {
  background: var(--surface-hover);
  color: var(--accent-primary, #8b5cf6);
}

.settings-dropdown {
  position: absolute;
  top: 100%;
  inset-inline-end: 0;
  margin-top: var(--space-2);
  min-width: 240px;
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  box-shadow: var(--overlay-component-shadow);
  z-index: 100;
}

.settings-section {
  margin-bottom: var(--space-3);
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
}

.settings-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.settings-label-row .settings-label {
  margin-bottom: 0;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-5);
  height: var(--space-5);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-xs);
}

.refresh-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.provider-options {
  display: flex;
  gap: var(--space-1);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
  padding: var(--space-0_5);
}

.provider-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-1);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
}

.provider-option:hover {
  color: var(--text-primary);
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
  width: var(--space-1_5);
  height: var(--space-1_5);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.health-healthy {
  background: var(--color-success);
  box-shadow: 0 0 var(--space-1) var(--success-shadow);
}

.health-degraded {
  background: var(--color-warning);
  box-shadow: 0 0 var(--space-1) rgba(234, 179, 8, 0.4);
}

.health-unavailable {
  background: var(--color-danger);
  box-shadow: 0 0 var(--space-1) var(--danger-shadow-strong);
}

/* ============================================================================
   Personality Toggle
   ============================================================================ */

.personality-toggle {
  display: flex;
  gap: var(--space-1);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
  padding: var(--space-0_5);
}

.personality-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
}

.personality-option:hover {
  color: var(--text-primary);
}

.personality-option.active {
  background: var(--accent-primary, #8b5cf6);
  color: white;
}

.grid-handler-option.active {
  background: linear-gradient(135deg, #00ff88, #06b6d4);
  color: #0a0a0f;
  text-shadow: none;
}

/* ============================================================================
   API Keys Section
   ============================================================================ */

.api-keys-section {
  border-top: 1px solid var(--border-subtle);
  padding-top: var(--space-3);
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
  color: var(--text-tertiary);
}

.api-keys-content {
  margin-top: var(--space-2);
}

.provider-info-box {
  padding: var(--space-2);
  background: var(--glass-bg-medium);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-3);
}

.provider-info-text {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: var(--leading-snug);
  margin: 0;
}

.provider-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.provider-status-row:last-child {
  margin-bottom: 0;
}

.provider-status-label {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-weight: var(--font-medium);
}

.api-key-test-btn {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--glass-border);
  background: transparent;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--duration-fast) ease;
  display: flex;
  align-items: center;
  gap: var(--space-1);
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
  border-color: var(--success-border-medium);
  color: var(--color-success);
}

.api-key-test-btn.error {
  border-color: var(--danger-border-medium);
  color: var(--color-danger);
}

/* ============================================================================
   Messages
   ============================================================================ */

.ai-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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
  padding: var(--space-8);
  color: var(--text-tertiary);
  flex: 1;
}

.empty-icon {
  color: var(--accent-primary, #8b5cf6);
  opacity: 0.5;
  margin-bottom: var(--space-3);
}

.empty-hint {
  font-size: var(--text-xs);
  opacity: 0.7;
  margin-top: var(--space-2);
}

.provider-note {
  font-size: var(--text-xs);
  opacity: 0.5;
  margin-top: var(--space-2);
  color: var(--color-success);
}

/* ============================================================================
   Error
   ============================================================================ */

.error-message {
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-border-medium);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  font-size: var(--text-meta);
}

.error-warning {
  border-color: var(--color-warning);
  background: var(--color-warning-alpha-10);
}

.error-warning .error-icon {
  color: var(--color-warning);
}

.error-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  color: var(--text-primary);
}

.error-icon {
  color: var(--color-danger);
  flex-shrink: 0;
  margin-top: 1px;
}

.error-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.error-retry {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--accent-primary, #8b5cf6);
  background: transparent;
  color: var(--accent-primary, #8b5cf6);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-xs);
  transition: all var(--duration-fast) ease;
}

.error-retry:hover {
  background: var(--purple-bg-subtle);
}

.error-dismiss {
  padding: var(--space-1) var(--space-2);
  border: none;
  background: var(--color-danger);
  color: white;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-xs);
}

/* ============================================================================
   Confirmation Banner
   ============================================================================ */

.confirmation-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-warning-alpha-10);
  border-top: 1px solid var(--color-priority-medium-border-medium);
  flex-shrink: 0;
}

.confirmation-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-meta);
  color: var(--color-warning);
}

.confirmation-icon {
  flex-shrink: 0;
}

.confirmation-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.confirm-btn {
  padding: var(--space-1) var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.confirm-danger {
  background: var(--color-danger);
  color: white;
}

.confirm-danger:hover {
  background: var(--danger-gradient-hover-start);
}

.confirm-cancel {
  background: var(--surface-hover);
  color: var(--text-tertiary);
}

.confirm-cancel:hover {
  background: var(--border-medium);
  color: var(--text-primary);
}

/* ============================================================================
   Input
   ============================================================================ */

.ai-chat-input-container {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-tertiary);
}

.ai-chat-input {
  flex: 1;
  resize: none;
  border: 1px solid var(--border-subtle);
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  min-height: var(--space-10);
  max-height: 120px;
  font-family: inherit;
  text-align: start;
  unicode-bidi: plaintext;
}

.ai-chat-input:focus {
  outline: none;
  border-color: var(--accent-primary, #8b5cf6);
}

.ai-chat-input::placeholder {
  color: var(--text-muted);
}

.ai-chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-10);
  height: var(--space-10);
  border: none;
  background: var(--accent-primary, #8b5cf6);
  color: white;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
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
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4) var(--space-3);
  flex-wrap: wrap;
}

.quick-action {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--border-medium);
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
}

.quick-action:hover {
  border-color: var(--accent-primary, #8b5cf6);
  color: var(--accent-primary, #8b5cf6);
  background: var(--purple-bg-subtle);
}

/* ============================================================================
   Animations
   ============================================================================ */

.slide-enter-active,
.slide-leave-active {
  transition: transform var(--duration-slow) ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--duration-fast) ease, transform var(--duration-fast) ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(var(--space-2));
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
  box-shadow: var(--shadow-xl);
}

[dir="rtl"] .slide-enter-from,
[dir="rtl"] .slide-leave-to,
:root[dir="rtl"] .slide-enter-from,
:root[dir="rtl"] .slide-leave-to {
  transform: translateX(-100%);
}
</style>
