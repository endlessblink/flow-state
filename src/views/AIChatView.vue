<script setup lang="ts">
/**
 * AI Chat Full-Screen View
 *
 * Dedicated full-screen route for AI conversations with a two-column layout:
 * - Left sidebar: conversation list + agent chain buttons
 * - Right area: chat messages, input, quick actions
 *
 * Reuses ChatMessage component and useAIChat composable from the sidebar panel.
 *
 * @see TASK-1235 in MASTER_PLAN.md
 */

import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  Sparkles,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Settings,
  X,
  Zap,
  MessageSquare,
  Calendar,
  Sunset,
  Target,
} from 'lucide-vue-next'
import { useAIChat } from '@/composables/useAIChat'
import { useAIChatStore } from '@/stores/aiChat'
import { useTimerStore } from '@/stores/timer'
import { useAgentChains } from '@/composables/useAgentChains'
import { createAIRouter } from '@/services/ai/router'
import { formatRelativeDate } from '@/utils/dateUtils'
import ChatMessage from '@/components/ai/ChatMessage.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import { GROQ_MODELS, OPENROUTER_MODELS, asValueLabel, getDisplayName } from '@/config/aiModels'

// ============================================================================
// Router
// ============================================================================

const { t } = useI18n()
const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'canvas' })
  }
}

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
  sendMessage,
  clearMessages,
  clearError,
  initialize,
  pendingConfirmation,
  confirmPendingAction,
  cancelPendingAction,
  executeDirectTool,
  executeAgentChain,
  aiPersonality,
  setPersonality,
  chatDirection,
  setChatDirection,
} = useAIChat()

const isGridHandler = computed(() => aiPersonality.value === 'grid_handler')

const store = useAIChatStore()
const timerStore = useTimerStore()
const agentChains = useAgentChains()

// ============================================================================
// Refs
// ============================================================================

const messagesContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const lastUserMessage = ref<string>('')
const showSettings = ref(false)

// Conversation rename
const renamingId = ref<string | null>(null)
const renameInput = ref('')

// ============================================================================
// Error UX
// ============================================================================

const friendlyError = computed(() => {
  if (!error.value) return null
  const err = error.value.toLowerCase()

  if (err.includes('econnrefused') || err.includes('localhost:11434')) {
    return { message: 'Ollama is not running. Start it with: ollama serve', type: 'warning' as const }
  }
  if (err.includes('network') || err.includes('fetch')) {
    return { message: 'Network error. Check your internet connection.', type: 'error' as const }
  }
  if (err.includes('rate limit') || err.includes('429')) {
    return { message: 'Rate limited. Please wait a moment and try again.', type: 'warning' as const }
  }
  if (err.includes('401') || err.includes('unauthorized')) {
    return { message: 'Authentication failed. Check your API key.', type: 'error' as const }
  }
  if (err.includes('all providers failed')) {
    return { message: 'AI is currently unavailable. Check provider settings.', type: 'error' as const }
  }
  return { message: error.value, type: 'error' as const }
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

  actions.push({ label: t('ai_chat.suggestion_plan'), message: 'Plan my day', directTool: { tool: 'get_daily_summary', parameters: {} } })
  actions.push({ label: t('ai_chat.suggestion_overdue'), message: 'What tasks are overdue?', directTool: { tool: 'get_overdue_tasks', parameters: {} } })

  if (store.context.selectedTask) {
    actions.push({ label: 'Break down this task', message: `Break down the task "${store.context.selectedTask.title}" into actionable subtasks.`, directTool: null })
  }

  if (timerStore.isTimerActive) {
    actions.push({ label: t('ai_chat.suggestion_time'), message: 'How much time is left on my current timer?', directTool: { tool: 'get_timer_status', parameters: {} } })
  }

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
  // If display name equals model ID, it wasn't found in registry
  // Keep existing behavior for Ollama models (e.g., "llama3.2:latest")
  if (displayName === model && model.includes(':')) return model
  return displayName !== model ? displayName : model
})

const headerBadgeText = computed(() => {
  const label = providerLabel.value
  if (!label) return ''
  if (selectedProvider.value === 'auto') return label
  if (displayModelName.value) return `${label} \u00B7 ${displayModelName.value}`
  return label
})

// ============================================================================
// Provider Settings (simplified for full-screen header)
// ============================================================================

const groqModels = asValueLabel(GROQ_MODELS)
const openrouterModels = asValueLabel(OPENROUTER_MODELS)

const currentProvider = computed(() => String(selectedProvider.value))

const showCloudModelSelector = computed(() =>
  currentProvider.value === 'groq' || currentProvider.value === 'openrouter'
)

const cloudModelOptions = computed(() => {
  if (currentProvider.value === 'groq') return groqModels
  if (currentProvider.value === 'openrouter') return openrouterModels
  return []
})

const ollamaModelOptions = computed(() => {
  const options = [{ label: 'Default (llama3.2)', value: '' }]
  for (const model of availableOllamaModels.value) {
    options.push({ label: model, value: model })
  }
  return options
})

function handleCloudModelChange(value: string | number) {
  setModel(value ? String(value) : null)
}

function handleOllamaModelChange(value: string | number) {
  setModel(value ? String(value) : null)
}

function selectProviderOption(provider: 'auto' | 'groq' | 'openrouter' | 'ollama') {
  setProvider(provider)
  if (provider === 'auto') {
    showSettings.value = false
  }
}

// Provider health
const providerHealth = ref<Record<string, 'healthy' | 'degraded' | 'unavailable' | 'unknown'>>({})

async function refreshProviderHealth() {
  try {
    const r = createAIRouter({ debug: false })
    await r.initialize()
    providerHealth.value = r.getProviderHealthStatus()
    r.dispose()
  } catch {
    // silently ignore
  }
}

function healthDotClass(provider: string): string {
  const status = providerHealth.value[provider]
  if (status === 'healthy') return 'health-dot health-healthy'
  if (status === 'degraded') return 'health-dot health-degraded'
  if (status === 'unavailable') return 'health-dot health-unavailable'
  return ''
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
// Conversation Management
// ============================================================================

function handleNewChat() {
  store.createConversation()
}

function handleSwitchConversation(id: string) {
  store.switchConversation(id)
}

function handleDeleteConversation(id: string, event: MouseEvent) {
  event.stopPropagation()
  store.deleteConversation(id)
}

function startRename(id: string, currentTitle: string, event: MouseEvent) {
  event.stopPropagation()
  renamingId.value = id
  renameInput.value = currentTitle
  nextTick(() => {
    const el = document.querySelector('.rename-input') as HTMLInputElement
    if (el) {
      el.focus()
      el.select()
    }
  })
}

function confirmRename() {
  if (renamingId.value && renameInput.value.trim()) {
    store.renameConversation(renamingId.value, renameInput.value.trim())
  }
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

function handleRenameKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    confirmRename()
  } else if (event.key === 'Escape') {
    cancelRename()
  }
}

// ============================================================================
// Agent Chain Helpers
// ============================================================================

const chainIconMap: Record<string, typeof Calendar> = {
  'Calendar': Calendar,
  'Sunset': Sunset,
  'Target': Target,
}

function getChainIcon(iconName: string) {
  return chainIconMap[iconName] || Zap
}

const chainNameI18nMap: Record<string, string> = {
  'plan_my_day': 'ai_chat.plan_my_day',
  'end_of_day_review': 'ai_chat.end_of_day_review',
  'focus_mode_setup': 'ai_chat.focus_mode_setup',
  'plan_my_week': 'ai_chat.plan_my_week',
}

function getChainName(chain: { id: string; name: string }): string {
  const key = chainNameI18nMap[chain.id]
  return key ? t(key) : chain.name
}

// ============================================================================
// Active Conversation Title
// ============================================================================

const activeConversationTitle = computed(() => {
  return store.activeConversation?.title || 'New Chat'
})

// ============================================================================
// Lifecycle
// ============================================================================

// Escape to exit full-screen view
function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    goBack()
  }
}

onMounted(() => {
  initialize()
  // Close the sidebar panel when full-screen view opens
  if (isPanelOpen.value) {
    store.closePanel()
  }
  refreshProviderHealth()
  window.addEventListener('keydown', handleGlobalKeydown)
  nextTick(() => {
    inputRef.value?.focus()
    scrollToBottom()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="ai-chat-view">
    <!-- Left Sidebar: Conversation List -->
    <aside class="conversation-sidebar">
      <!-- New Chat Button -->
      <div class="sidebar-header">
        <button class="new-chat-btn" @click="handleNewChat">
          <Plus :size="16" />
          <span>{{ $t('ai_chat.new_chat') }}</span>
        </button>
      </div>

      <!-- Conversation List -->
      <div class="conversation-list">
        <button
          v-for="conv in store.sortedConversations"
          :key="conv.id"
          class="conversation-item"
          :class="{ active: store.activeConversationId === conv.id }"
          @click="handleSwitchConversation(conv.id)"
          @dblclick="startRename(conv.id, conv.title, $event)"
        >
          <MessageSquare :size="14" class="conv-icon" />
          <div class="conv-info">
            <template v-if="renamingId === conv.id">
              <input
                v-model="renameInput"
                class="rename-input"
                @keydown="handleRenameKeydown"
                @blur="confirmRename"
                @click.stop
              >
            </template>
            <template v-else>
              <span class="conv-title" dir="auto">{{ conv.title }}</span>
              <span class="conv-date">{{ formatRelativeDate(conv.updatedAt) }}</span>
            </template>
          </div>
          <button
            v-if="renamingId !== conv.id"
            class="conv-delete-btn"
            title="Delete conversation"
            @click="handleDeleteConversation(conv.id, $event)"
          >
            <Trash2 :size="12" />
          </button>
        </button>

        <div v-if="store.sortedConversations.length === 0" class="conv-empty">
          No conversations yet
        </div>
      </div>

      <!-- Agent Chains Section -->
      <div class="chains-section">
        <div class="chains-label">
          {{ $t('ai_chat.agent_chains') }}
        </div>
        <button
          v-for="chain in agentChains.chains"
          :key="chain.id"
          class="chain-btn"
          :title="chain.description"
          @click="executeAgentChain(chain.id)"
        >
          <component :is="getChainIcon(chain.icon)" :size="14" class="chain-icon" />
          <span>{{ getChainName(chain) }}</span>
        </button>
      </div>
    </aside>

    <!-- Right Area: Chat -->
    <main class="chat-main">
      <!-- Header -->
      <header class="chat-header">
        <div class="chat-header-left">
          <button class="back-btn" :title="$t('common.back')" @click="goBack">
            <ArrowLeft :size="16" />
            <span>{{ $t('common.back') }}</span>
          </button>
          <div class="header-title-area">
            <Zap v-if="isGridHandler" class="header-icon grid-handler-icon" :size="18" />
            <Sparkles v-else class="header-icon" :size="18" />
            <span class="header-title" dir="auto">{{ activeConversationTitle }}</span>
            <span v-if="headerBadgeText" class="provider-badge" :class="'provider-' + activeProvider">
              {{ headerBadgeText }}
            </span>
          </div>
        </div>

        <div class="chat-header-right">
          <!-- Settings toggle -->
          <button
            class="header-btn"
            :class="{ active: showSettings }"
            title="AI Settings"
            @click="showSettings = !showSettings"
          >
            <Settings :size="16" />
          </button>

          <!-- Undo -->
          <button
            v-if="hasUndoEntries"
            class="header-btn undo-btn"
            :title="'Undo: ' + latestUndoDescription"
            @click="handleUndo"
          >
            <RotateCcw :size="16" />
          </button>

          <!-- Clear chat -->
          <button
            v-if="visibleMessages.length > 1"
            class="header-btn"
            title="Clear chat"
            @click="clearMessages"
          >
            <Trash2 :size="16" />
          </button>

          <!-- Close / Exit full-screen -->
          <button
            class="header-btn close-btn"
            title="Close (Esc)"
            @click="goBack"
          >
            <X :size="18" />
          </button>
        </div>
      </header>

      <!-- Settings Bar (collapsible) -->
      <Transition name="settings-slide">
        <div v-if="showSettings" class="settings-bar">
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
                <span v-if="healthDotClass('groq')" :class="healthDotClass('groq')" />
                Groq
              </button>
              <button
                class="provider-option"
                :class="{ active: currentProvider === 'openrouter' }"
                @click="selectProviderOption('openrouter')"
              >
                <span v-if="healthDotClass('openrouter')" :class="healthDotClass('openrouter')" />
                OpenRouter
              </button>
              <button
                class="provider-option"
                :class="{ active: selectedProvider === 'ollama' }"
                @click="setProvider('ollama')"
              >
                <span v-if="healthDotClass('ollama')" :class="healthDotClass('ollama')" />
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

          <!-- Ollama Model Selector -->
          <div v-if="selectedProvider === 'ollama' || (selectedProvider === 'auto' && activeProvider === 'ollama')" class="settings-group">
            <div class="settings-label-row">
              <label class="settings-label">Local Model</label>
              <button class="refresh-btn" :disabled="isLoadingModels" @click="refreshOllamaModels">
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

          <!-- Personality -->
          <div class="settings-group">
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

          <!-- Chat Text Direction -->
          <div class="settings-group">
            <label class="settings-label">Text Direction</label>
            <div class="personality-toggle">
              <button class="personality-option" :class="{ active: chatDirection === 'auto' }" @click="setChatDirection('auto')">
                Auto
              </button>
              <button class="personality-option" :class="{ active: chatDirection === 'ltr' }" @click="setChatDirection('ltr')">
                LTR
              </button>
              <button class="personality-option" :class="{ active: chatDirection === 'rtl' }" @click="setChatDirection('rtl')">
                RTL
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Messages Area -->
      <div ref="messagesContainer" class="chat-messages" :dir="chatDirection !== 'auto' ? chatDirection : undefined">
        <ChatMessage
          v-for="message in visibleMessages"
          :key="message.id"
          :message="message"
          :direction="chatDirection"
          @select-task="handleSelectTask"
        />

        <!-- Contextual Error -->
        <div v-if="friendlyError" class="error-message" :class="'error-' + friendlyError.type">
          <div class="error-content">
            <AlertTriangle :size="14" class="error-icon" />
            <p>{{ friendlyError.message }}</p>
          </div>
          <div class="error-actions">
            <button v-if="lastUserMessage" class="error-retry" @click="retryLastMessage">
              Retry
            </button>
            <button class="error-dismiss" @click="clearError">
              Dismiss
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="visibleMessages.length === 0" class="empty-state">
          <Sparkles class="empty-icon" :size="40" />
          <p class="empty-title">
            Ask me anything about your tasks!
          </p>
          <p class="empty-hint">
            Try: "Plan my day" or "Break down this task"
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
          <button class="confirm-btn confirm-danger" @click="confirmPendingAction()">
            Confirm
          </button>
          <button class="confirm-btn confirm-cancel" @click="cancelPendingAction()">
            Cancel
          </button>
        </div>
      </div>

      <!-- Input Area -->
      <div class="chat-input-area">
        <div class="chat-input-container">
          <textarea
            ref="inputRef"
            v-model="inputText"
            class="chat-input"
            :dir="chatDirection"
            :placeholder="$t('ai_chat.ask_placeholder')"
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
        <div class="chat-quick-actions">
          <button
            v-for="action in quickActions"
            :key="action.label"
            class="quick-action"
            @click="handleQuickAction(action)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ============================================================================
   Layout
   ============================================================================ */

.ai-chat-view {
  display: flex;
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  background: rgba(28, 25, 45, 0.92);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  color: var(--text-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ============================================================================
   Left Sidebar
   ============================================================================ */

.conversation-sidebar {
  width: 280px;
  min-width: 280px;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  background: var(--overlay-component-bg);
  border-inline-end: 1px solid var(--border-subtle);
}

.sidebar-header {
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: var(--accent-primary);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--duration-fast) ease;
}

.new-chat-btn:hover {
  background: var(--accent-hover, #7c3aed);
}

/* ============================================================================
   Conversation List
   ============================================================================ */

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-2_5);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--duration-fast) ease;
  text-align: start;
  position: relative;
}

.conversation-item:hover {
  background: var(--glass-bg-light);
}

.conversation-item.active {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.conv-icon {
  flex-shrink: 0;
  opacity: 0.6;
}

.conversation-item.active .conv-icon {
  opacity: 1;
  color: var(--accent-primary);
}

.conv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.conv-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-date {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.conv-delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: 0;
  transition: all var(--duration-fast) ease;
  flex-shrink: 0;
}

.conversation-item:hover .conv-delete-btn {
  opacity: 1;
}

.conv-delete-btn:hover {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
}

.conv-empty {
  padding: var(--space-4);
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* Rename input */
.rename-input {
  width: 100%;
  padding: 2px var(--space-1);
  border: 1px solid var(--accent-primary);
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-family: inherit;
  outline: none;
}

/* ============================================================================
   Agent Chains Section
   ============================================================================ */

.chains-section {
  padding: var(--space-3);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.chains-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: var(--space-2);
}

.chain-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-2_5);
  border: 1px solid var(--border-medium);
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  margin-bottom: var(--space-1);
  text-align: start;
}

.chain-btn:last-child {
  margin-bottom: 0;
}

.chain-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: var(--purple-bg-subtle);
}

.chain-icon {
  flex-shrink: 0;
}

/* ============================================================================
   Chat Main Area
   ============================================================================ */

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ============================================================================
   Chat Header
   ============================================================================ */

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
}

.chat-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.header-title-area {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.header-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-icon {
  color: var(--accent-primary, #8b5cf6);
  flex-shrink: 0;
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
  flex-shrink: 0;
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

.header-btn.active {
  background: var(--surface-hover);
  color: var(--accent-primary, #8b5cf6);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-3);
  border: 1px solid var(--border-medium);
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--surface-hover);
  border-color: var(--accent-primary, #8b5cf6);
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
   Settings Bar
   ============================================================================ */

.settings-bar {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-tertiary);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.settings-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
}

.settings-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.provider-option:hover {
  color: var(--text-primary);
}

.provider-option.active {
  background: var(--accent-primary, #8b5cf6);
  color: white;
}

.personality-toggle {
  display: flex;
  gap: var(--space-1);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
  padding: var(--space-0_5);
}

.personality-option {
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

/* Settings slide transition */
.settings-slide-enter-active,
.settings-slide-leave-active {
  transition: all var(--duration-fast) ease;
  overflow: hidden;
}

.settings-slide-enter-from,
.settings-slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.settings-slide-enter-to,
.settings-slide-leave-from {
  max-height: 200px;
}

/* ============================================================================
   Messages Area
   ============================================================================ */

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
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
  padding: var(--space-12);
  color: var(--text-tertiary);
  flex: 1;
}

.empty-icon {
  color: var(--accent-primary, #8b5cf6);
  opacity: 0.4;
  margin-bottom: var(--space-4);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.empty-hint {
  font-size: var(--text-sm);
  opacity: 0.7;
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
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
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
   Input Area
   ============================================================================ */

.chat-input-area {
  border-top: 1px solid var(--border-subtle);
  background: transparent;
  flex-shrink: 0;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
  padding: 0 var(--space-6);
}

.chat-input-container {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) 0;
}

.chat-input {
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

.chat-input:focus {
  outline: none;
  border-color: var(--accent-primary, #8b5cf6);
}

.chat-input::placeholder {
  color: var(--text-muted);
}

.chat-input:disabled {
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

.chat-quick-actions {
  display: flex;
  gap: var(--space-2);
  padding: 0 0 var(--space-3);
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

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ============================================================================
   Mobile Responsive
   ============================================================================ */

@media (max-width: 768px) {
  .conversation-sidebar {
    display: none;
  }

  .chat-messages {
    padding: var(--space-3);
  }

  .chat-input-area {
    padding: 0 var(--space-3);
  }
}
</style>
