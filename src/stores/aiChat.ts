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
import { ref, computed, shallowRef, watch } from 'vue'
import type { Task } from '@/types/tasks'
import { executeTool } from '@/services/ai/tools'
import type { ToolCall } from '@/services/ai/tools'

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

/**
 * An entry in the undo buffer for reversible tool actions.
 */
export interface UndoEntry {
  toolName: string
  timestamp: number
  params: Record<string, unknown>
  undoAction: { toolName: string; params: Record<string, unknown> }
  description: string
}

// ============================================================================
// Constants
// ============================================================================

const CHAT_HISTORY_KEY = 'flowstate-ai-chat-history'
const AI_SETTINGS_KEY = 'flowstate-ai-settings'
const MAX_PERSISTED_MESSAGES = 50
const MAX_UNDO_ENTRIES = 10
const SAVE_DEBOUNCE_MS = 300

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

  /** Undo buffer for reversible tool actions (session only, not persisted) */
  const undoBuffer = ref<UndoEntry[]>([])

  /** Persisted AI settings (provider/model) */
  const persistedSettings = ref<{ provider: string; model: string } | null>(null)

  // ============================================================================
  // Persistence Helpers
  // ============================================================================

  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Serialize messages for localStorage (strips non-serializable fields like action handlers).
   */
  function serializeMessages(msgs: ChatMessage[]): string {
    const serializable = msgs.slice(-MAX_PERSISTED_MESSAGES).map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      isStreaming: false, // never persist streaming state
      error: m.error,
      taskId: m.taskId,
      metadata: m.metadata,
      // actions are NOT persisted (handlers are functions)
    }))
    return JSON.stringify(serializable)
  }

  /**
   * Deserialize messages from localStorage, restoring Date objects.
   */
  function deserializeMessages(json: string): ChatMessage[] {
    try {
      const parsed = JSON.parse(json) as Array<Record<string, unknown>>
      return parsed.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp as string),
      })) as ChatMessage[]
    } catch {
      return []
    }
  }

  /**
   * Save messages to localStorage (debounced).
   */
  function debouncedSaveMessages() {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem(CHAT_HISTORY_KEY, serializeMessages(messages.value))
      } catch {
        // localStorage full or unavailable - silently ignore
      }
    }, SAVE_DEBOUNCE_MS)
  }

  /**
   * Load messages from localStorage.
   */
  function loadPersistedMessages(): ChatMessage[] {
    try {
      const raw = localStorage.getItem(CHAT_HISTORY_KEY)
      if (!raw) return []
      return deserializeMessages(raw)
    } catch {
      return []
    }
  }

  /**
   * Save AI settings to localStorage.
   */
  function saveSettings(settings: { provider: string; model: string }) {
    try {
      persistedSettings.value = settings
      localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // silently ignore
    }
  }

  /**
   * Load AI settings from localStorage.
   */
  function loadPersistedSettings(): { provider: string; model: string } | null {
    try {
      const raw = localStorage.getItem(AI_SETTINGS_KEY)
      if (!raw) return null
      return JSON.parse(raw) as { provider: string; model: string }
    } catch {
      return null
    }
  }

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
   * Clear all messages, localStorage history, and re-add welcome message.
   */
  function clearMessages() {
    messages.value = []
    streamingContent.value = ''
    error.value = null
    undoBuffer.value = []
    try {
      localStorage.removeItem(CHAT_HISTORY_KEY)
    } catch {
      // silently ignore
    }
    // Re-add welcome message
    addAssistantMessage(
      "Hi! I'm your FlowState AI assistant. I can help you organize your tasks, break down complex work, and suggest canvas groupings. Just ask me anything!"
    )
  }

  /**
   * Clear error state.
   */
  function clearError() {
    error.value = null
  }

  /**
   * Initialize the chat (called on app startup).
   * Loads persisted messages and settings from localStorage.
   */
  function initialize() {
    if (isInitialized.value) return

    // Load persisted settings
    persistedSettings.value = loadPersistedSettings()

    // Load persisted messages
    const persisted = loadPersistedMessages()
    if (persisted.length > 0) {
      messages.value = persisted
    } else {
      // Only show welcome message if no persisted messages
      addAssistantMessage(
        "Hi! I'm your FlowState AI assistant. I can help you organize your tasks, break down complex work, and suggest canvas groupings. Just ask me anything!"
      )
    }

    // Watch messages for persistence (debounced)
    watch(
      () => messages.value.length,
      () => debouncedSaveMessages(),
    )
    // Also watch for content changes (streaming appends don't change length)
    watch(
      messages,
      () => debouncedSaveMessages(),
      { deep: true }
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
    undoBuffer.value = []
    persistedSettings.value = null
    try {
      localStorage.removeItem(CHAT_HISTORY_KEY)
      localStorage.removeItem(AI_SETTINGS_KEY)
    } catch {
      // silently ignore
    }
  }

  // ============================================================================
  // Undo Buffer
  // ============================================================================

  /**
   * Push an entry to the undo buffer.
   * Most recent entries are at the front. Capped at MAX_UNDO_ENTRIES.
   */
  function pushUndoEntry(entry: UndoEntry) {
    undoBuffer.value.unshift(entry)
    if (undoBuffer.value.length > MAX_UNDO_ENTRIES) {
      undoBuffer.value = undoBuffer.value.slice(0, MAX_UNDO_ENTRIES)
    }
  }

  /**
   * Pop the most recent undo entry and execute its reverse action.
   * Returns the entry that was undone, or null if buffer is empty.
   */
  async function undoLastAction(): Promise<UndoEntry | null> {
    if (undoBuffer.value.length === 0) return null

    const entry = undoBuffer.value.shift()!

    // Execute the reverse tool call
    const toolCall: ToolCall = {
      tool: entry.undoAction.toolName,
      parameters: entry.undoAction.params,
    }

    try {
      await executeTool(toolCall)
    } catch {
      // If undo fails, we still remove the entry (it's been consumed)
    }

    return entry
  }

  /**
   * Get the current undo buffer contents.
   */
  function getUndoHistory(): UndoEntry[] {
    return undoBuffer.value
  }

  // ============================================================================
  // Settings Persistence
  // ============================================================================

  /**
   * Update and persist AI provider/model settings.
   */
  function updatePersistedSettings(settings: { provider: string; model: string }) {
    saveSettings(settings)
  }

  /**
   * Get the persisted AI settings.
   */
  function getPersistedSettings(): { provider: string; model: string } | null {
    return persistedSettings.value
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
    undoBuffer,
    persistedSettings,

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
    reset,

    // Undo
    pushUndoEntry,
    undoLastAction,
    getUndoHistory,

    // Settings Persistence
    updatePersistedSettings,
    getPersistedSettings,
  }
})
