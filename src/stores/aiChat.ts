/**
 * AI Chat Store
 *
 * Manages the state for the AI chat panel including:
 * - Message history
 * - Streaming responses
 * - Panel visibility
 * - Chat context (current view, selected task, etc.)
 *
 * @see TASK-1120 in MASTER_PLAN.md
 */

import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { Task } from '@/types/tasks'

// ============================================================================
// Types
// ============================================================================

/**
 * Message role in the chat.
 */
export type ChatRole = 'user' | 'assistant' | 'system'

/**
 * Action button that can appear in AI messages.
 */
export interface ChatAction {
  id: string
  label: string
  icon?: string
  variant?: 'primary' | 'secondary' | 'danger'
  /** Called when user clicks the action */
  handler: () => Promise<void> | void
  /** Whether this action is currently loading */
  loading?: boolean
  /** Whether this action has been completed */
  completed?: boolean
}

/**
 * A single chat message.
 */
export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: Date
  /** Optional actions the user can take */
  actions?: ChatAction[]
  /** Whether this message is still streaming */
  isStreaming?: boolean
  /** Error message if generation failed */
  error?: string
  /** Associated task ID if context-specific */
  taskId?: string
  /** Metadata for analytics */
  metadata?: {
    model?: string
    provider?: string
    tokens?: number
    latencyMs?: number
  }
}

/**
 * Current view context for the chat.
 */
export type ViewContext = 'canvas' | 'board' | 'calendar' | 'inbox' | 'settings' | 'all-tasks'

/**
 * Context passed to the AI for awareness.
 */
export interface ChatContext {
  currentView: ViewContext
  selectedTaskId?: string
  selectedTask?: Task
  visibleTaskIds?: string[]
  /** Additional context string (e.g., user's recent activity) */
  additionalContext?: string
}

// ============================================================================
// Store
// ============================================================================

export const useAIChatStore = defineStore('aiChat', () => {
  // ============================================================================
  // State
  // ============================================================================

  /** Whether the chat panel is open */
  const isPanelOpen = ref(false)

  /** Chat messages */
  const messages = ref<ChatMessage[]>([])

  /** Current input text */
  const inputText = ref('')

  /** Whether a response is currently being generated */
  const isGenerating = ref(false)

  /** Current streaming content (for progressive display) */
  const streamingContent = ref('')

  /** Current chat context */
  const context = shallowRef<ChatContext>({
    currentView: 'canvas'
  })

  /** Number of pending suggestions (for indicator badge) */
  const pendingSuggestionCount = ref(0)

  /** Error state */
  const error = ref<string | null>(null)

  /** Whether the chat has been initialized */
  const isInitialized = ref(false)

  // ============================================================================
  // Getters
  // ============================================================================

  /** All messages except system messages */
  const visibleMessages = computed(() =>
    messages.value.filter(m => m.role !== 'system')
  )

  /** Most recent message */
  const lastMessage = computed(() =>
    messages.value[messages.value.length - 1]
  )

  /** Whether there are any messages */
  const hasMessages = computed(() => messages.value.length > 0)

  /** Whether the input is valid for sending */
  const canSend = computed(() =>
    inputText.value.trim().length > 0 && !isGenerating.value
  )

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Toggle the chat panel open/closed.
   */
  function togglePanel() {
    isPanelOpen.value = !isPanelOpen.value
  }

  /**
   * Open the chat panel.
   */
  function openPanel() {
    isPanelOpen.value = true
  }

  /**
   * Close the chat panel.
   */
  function closePanel() {
    isPanelOpen.value = false
  }

  /**
   * Add a user message.
   */
  function addUserMessage(content: string): ChatMessage {
    const message: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date()
    }
    messages.value.push(message)
    return message
  }

  /**
   * Add an assistant message.
   */
  function addAssistantMessage(
    content: string,
    options?: {
      actions?: ChatAction[]
      taskId?: string
      metadata?: ChatMessage['metadata']
    }
  ): ChatMessage {
    const message: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      actions: options?.actions,
      taskId: options?.taskId,
      metadata: options?.metadata
    }
    messages.value.push(message)
    return message
  }

  /**
   * Start a streaming assistant message.
   */
  function startStreamingMessage(): ChatMessage {
    const message: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }
    messages.value.push(message)
    isGenerating.value = true
    streamingContent.value = ''
    return message
  }

  /**
   * Append content to the current streaming message.
   */
  function appendStreamingContent(content: string) {
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.isStreaming) {
      lastMsg.content += content
      streamingContent.value = lastMsg.content
    }
  }

  /**
   * Complete the streaming message.
   */
  function completeStreamingMessage(options?: {
    actions?: ChatAction[]
    metadata?: ChatMessage['metadata']
  }) {
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.isStreaming) {
      lastMsg.isStreaming = false
      if (options?.actions) {
        lastMsg.actions = options.actions
      }
      if (options?.metadata) {
        lastMsg.metadata = options.metadata
      }
    }
    isGenerating.value = false
    streamingContent.value = ''
  }

  /**
   * Mark a streaming message as failed.
   */
  function failStreamingMessage(errorMessage: string) {
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.isStreaming) {
      lastMsg.isStreaming = false
      lastMsg.error = errorMessage
    }
    isGenerating.value = false
    streamingContent.value = ''
    error.value = errorMessage
  }

  /**
   * Update an action's state (loading/completed).
   */
  function updateAction(messageId: string, actionId: string, updates: Partial<ChatAction>) {
    const message = messages.value.find(m => m.id === messageId)
    if (message?.actions) {
      const action = message.actions.find(a => a.id === actionId)
      if (action) {
        Object.assign(action, updates)
      }
    }
  }

  /**
   * Update the chat context.
   */
  function updateContext(newContext: Partial<ChatContext>) {
    context.value = { ...context.value, ...newContext }
  }

  /**
   * Set the current view context.
   */
  function setCurrentView(view: ViewContext) {
    context.value = { ...context.value, currentView: view }
  }

  /**
   * Set the selected task.
   */
  function setSelectedTask(task: Task | undefined) {
    context.value = {
      ...context.value,
      selectedTaskId: task?.id,
      selectedTask: task
    }
  }

  /**
   * Clear all messages.
   */
  function clearMessages() {
    messages.value = []
    streamingContent.value = ''
    error.value = null
  }

  /**
   * Clear error state.
   */
  function clearError() {
    error.value = null
  }

  /**
   * Initialize the chat (called on app startup).
   */
  function initialize() {
    if (isInitialized.value) return

    // Add welcome message
    addAssistantMessage(
      "Hi! I'm your FlowState AI assistant. I can help you organize your tasks, break down complex work, and suggest canvas groupings. Just ask me anything!"
    )

    isInitialized.value = true
  }

  /**
   * Reset the store (for logout/testing).
   */
  function reset() {
    messages.value = []
    inputText.value = ''
    isGenerating.value = false
    streamingContent.value = ''
    context.value = { currentView: 'canvas' }
    pendingSuggestionCount.value = 0
    error.value = null
    isInitialized.value = false
    isPanelOpen.value = false
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    isPanelOpen,
    messages,
    inputText,
    isGenerating,
    streamingContent,
    context,
    pendingSuggestionCount,
    error,
    isInitialized,

    // Getters
    visibleMessages,
    lastMessage,
    hasMessages,
    canSend,

    // Actions
    togglePanel,
    openPanel,
    closePanel,
    addUserMessage,
    addAssistantMessage,
    startStreamingMessage,
    appendStreamingContent,
    completeStreamingMessage,
    failStreamingMessage,
    updateAction,
    updateContext,
    setCurrentView,
    setSelectedTask,
    clearMessages,
    clearError,
    initialize,
    reset
  }
})
