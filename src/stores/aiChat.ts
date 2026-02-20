/**
 * AI Chat Store
 *
 * Manages the state for the AI chat panel including:
 * - Conversation history with multiple conversations
 * - Message history per conversation
 * - Streaming responses
 * - Panel visibility
 * - Chat context (current view, selected task, etc.)
 *
 * @see TASK-1120, TASK-1234 in MASTER_PLAN.md
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
    forceDirection?: 'auto' | 'ltr' | 'rtl'
  }
}

/**
 * A conversation containing a list of chat messages.
 */
export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
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
const CONVERSATIONS_KEY = 'flowstate-ai-conversations'
const AI_SETTINGS_KEY = 'flowstate-ai-settings'
const MAX_PERSISTED_MESSAGES = 50
const MAX_PERSISTED_CONVERSATIONS = 20
const MAX_UNDO_ENTRIES = 10
const SAVE_DEBOUNCE_MS = 300

const WELCOME_MESSAGE = "Hi! I'm your FlowState AI assistant. I can help you organize your tasks, break down complex work, and suggest canvas groupings. Just ask me anything!"

// ============================================================================
// Store
// ============================================================================

export const useAIChatStore = defineStore('aiChat', () => {
  // ============================================================================
  // State
  // ============================================================================

  /** Whether the chat panel is open */
  const isPanelOpen = ref(false)

  /** All conversations */
  const conversations = ref<Conversation[]>([])

  /** Currently active conversation ID */
  const activeConversationId = ref<string | null>(null)

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

  /** Persisted AI settings (provider/model/chatDirection) */
  const persistedSettings = ref<{ provider: string; model: string; chatDirection?: 'auto' | 'ltr' | 'rtl' } | null>(null)

  /** Chat text direction override (auto = browser default) */
  const chatDirection = ref<'auto' | 'ltr' | 'rtl'>('auto')

  // ============================================================================
  // Persistence Helpers
  // ============================================================================

  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Serialize messages for storage (strips non-serializable fields like action handlers).
   */
  function serializeMessages(msgs: ChatMessage[]): Array<Record<string, unknown>> {
    return msgs.slice(-MAX_PERSISTED_MESSAGES).map(m => ({
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
  }

  /**
   * Deserialize messages from storage, restoring Date objects.
   */
  function deserializeMessages(data: Array<Record<string, unknown>>): ChatMessage[] {
    return data.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp as string),
    })) as ChatMessage[]
  }

  /**
   * Serialize all conversations for localStorage.
   */
  function serializeConversations(): string {
    const limited = conversations.value.slice(0, MAX_PERSISTED_CONVERSATIONS)
    const serializable = limited.map(conv => ({
      id: conv.id,
      title: conv.title,
      messages: serializeMessages(conv.messages),
      createdAt: conv.createdAt instanceof Date ? conv.createdAt.toISOString() : conv.createdAt,
      updatedAt: conv.updatedAt instanceof Date ? conv.updatedAt.toISOString() : conv.updatedAt,
    }))
    return JSON.stringify({
      conversations: serializable,
      activeConversationId: activeConversationId.value,
    })
  }

  /**
   * Deserialize conversations from localStorage.
   */
  function deserializeConversations(json: string): { conversations: Conversation[]; activeId: string | null } {
    try {
      const parsed = JSON.parse(json)
      const convs: Conversation[] = (parsed.conversations || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        title: c.title as string,
        messages: deserializeMessages(c.messages as Array<Record<string, unknown>>),
        createdAt: new Date(c.createdAt as string),
        updatedAt: new Date(c.updatedAt as string),
      }))
      return {
        conversations: convs,
        activeId: parsed.activeConversationId || null,
      }
    } catch {
      return { conversations: [], activeId: null }
    }
  }

  /**
   * Save conversations to localStorage (debounced).
   */
  function debouncedSaveConversations() {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem(CONVERSATIONS_KEY, serializeConversations())
      } catch {
        // localStorage full or unavailable - silently ignore
      }
    }, SAVE_DEBOUNCE_MS)
  }

  /**
   * Load conversations from localStorage.
   */
  function loadPersistedConversations(): { conversations: Conversation[]; activeId: string | null } {
    try {
      const raw = localStorage.getItem(CONVERSATIONS_KEY)
      if (!raw) return { conversations: [], activeId: null }
      return deserializeConversations(raw)
    } catch {
      return { conversations: [], activeId: null }
    }
  }

  /**
   * Load old-format messages from localStorage for migration.
   */
  function loadOldPersistedMessages(): ChatMessage[] {
    try {
      const raw = localStorage.getItem(CHAT_HISTORY_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
      return parsed.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp as string),
      })) as ChatMessage[]
    } catch {
      return []
    }
  }

  /**
   * Save AI settings to localStorage.
   */
  function saveSettings(settings: { provider: string; model: string; chatDirection?: 'auto' | 'ltr' | 'rtl' }) {
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
  function loadPersistedSettings(): { provider: string; model: string; chatDirection?: 'auto' | 'ltr' | 'rtl' } | null {
    try {
      const raw = localStorage.getItem(AI_SETTINGS_KEY)
      if (!raw) return null
      return JSON.parse(raw) as { provider: string; model: string; chatDirection?: 'auto' | 'ltr' | 'rtl' }
    } catch {
      return null
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /** The currently active conversation */
  const activeConversation = computed(() =>
    conversations.value.find(c => c.id === activeConversationId.value) || null
  )

  /** All conversations sorted by updatedAt descending (most recent first) */
  const sortedConversations = computed(() =>
    [...conversations.value].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  )

  /**
   * Messages from the active conversation.
   * Backward-compatible: existing code that reads store.messages will get
   * the active conversation's messages array.
   */
  const messages = computed(() =>
    activeConversation.value?.messages || []
  )

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
  // Conversation Helpers
  // ============================================================================

  /**
   * Generate a unique conversation ID.
   */
  function generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  /**
   * Generate a unique message ID.
   */
  function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  /**
   * Get the messages array of the active conversation.
   * Returns null if no active conversation.
   */
  function getActiveMessages(): ChatMessage[] | null {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    return conv ? conv.messages : null
  }

  /**
   * Touch the active conversation's updatedAt timestamp.
   */
  function touchActiveConversation() {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (conv) {
      conv.updatedAt = new Date()
    }
  }

  // ============================================================================
  // Conversation Actions
  // ============================================================================

  /**
   * Create a new conversation with a welcome message and set it as active.
   */
  function createConversation(): Conversation {
    const conv: Conversation = {
      id: generateConversationId(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Add welcome message
    conv.messages.push({
      id: generateMessageId(),
      role: 'assistant',
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    })

    conversations.value.push(conv)
    activeConversationId.value = conv.id

    // Enforce max conversations limit
    if (conversations.value.length > MAX_PERSISTED_CONVERSATIONS) {
      // Remove oldest conversations (by updatedAt) beyond the limit
      const sorted = [...conversations.value].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      const toRemove = sorted.slice(MAX_PERSISTED_CONVERSATIONS)
      const removeIds = new Set(toRemove.map(c => c.id))
      conversations.value = conversations.value.filter(c => !removeIds.has(c.id))
    }

    return conv
  }

  /**
   * Switch to a different conversation.
   */
  function switchConversation(id: string) {
    const conv = conversations.value.find(c => c.id === id)
    if (conv) {
      activeConversationId.value = id
    }
  }

  /**
   * Delete a conversation. If it's the active one, switch to the most recent remaining
   * or create a new one if none remain.
   */
  function deleteConversation(id: string) {
    const index = conversations.value.findIndex(c => c.id === id)
    if (index === -1) return

    conversations.value.splice(index, 1)

    // If we deleted the active conversation, switch to the most recent or create new
    if (activeConversationId.value === id) {
      if (conversations.value.length > 0) {
        const sorted = [...conversations.value].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        activeConversationId.value = sorted[0].id
      } else {
        createConversation()
      }
    }
  }

  /**
   * Rename a conversation.
   */
  function renameConversation(id: string, title: string) {
    const conv = conversations.value.find(c => c.id === id)
    if (conv) {
      conv.title = title
      conv.updatedAt = new Date()
    }
  }

  /**
   * Auto-name a conversation based on the first user message.
   * Truncates to 40 characters with "..." if needed.
   */
  function autoNameConversation(id: string) {
    const conv = conversations.value.find(c => c.id === id)
    if (!conv) return

    const firstUserMsg = conv.messages.find(m => m.role === 'user')
    if (!firstUserMsg) return

    const content = firstUserMsg.content.trim()
    if (content.length <= 40) {
      conv.title = content
    } else {
      conv.title = content.slice(0, 40) + '...'
    }
    conv.updatedAt = new Date()
  }

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
   * Add a user message to the active conversation.
   * Auto-names the conversation after the first user message.
   */
  function addUserMessage(content: string): ChatMessage {
    const msgs = getActiveMessages()
    if (!msgs) {
      // No active conversation - create one first
      createConversation()
    }

    const message: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    const activeMsgs = getActiveMessages()
    if (activeMsgs) {
      activeMsgs.push(message)
    }

    touchActiveConversation()

    // Auto-name conversation after first user message
    if (activeConversationId.value) {
      const conv = conversations.value.find(c => c.id === activeConversationId.value)
      if (conv && conv.title === 'New Chat') {
        // Check if this is the first user message
        const userMessages = conv.messages.filter(m => m.role === 'user')
        if (userMessages.length === 1) {
          autoNameConversation(conv.id)
        }
      }
    }

    return message
  }

  /**
   * Add an assistant message to the active conversation.
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

    const activeMsgs = getActiveMessages()
    if (activeMsgs) {
      activeMsgs.push(message)
    }

    touchActiveConversation()
    return message
  }

  /**
   * Start a streaming assistant message in the active conversation.
   */
  function startStreamingMessage(): ChatMessage {
    const message: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }

    const activeMsgs = getActiveMessages()
    if (activeMsgs) {
      activeMsgs.push(message)
    }

    isGenerating.value = true
    streamingContent.value = ''
    touchActiveConversation()
    return message
  }

  /**
   * Append content to the current streaming message in the active conversation.
   */
  function appendStreamingContent(content: string) {
    const activeMsgs = getActiveMessages()
    if (!activeMsgs) return

    const lastMsg = activeMsgs[activeMsgs.length - 1]
    if (lastMsg && lastMsg.isStreaming) {
      lastMsg.content += content
      streamingContent.value = lastMsg.content
    }
  }

  /**
   * Complete the streaming message in the active conversation.
   */
  function completeStreamingMessage(options?: {
    actions?: ChatAction[]
    metadata?: ChatMessage['metadata']
  }) {
    const activeMsgs = getActiveMessages()
    if (!activeMsgs) return

    const lastMsg = activeMsgs[activeMsgs.length - 1]
    if (lastMsg && lastMsg.isStreaming) {
      lastMsg.isStreaming = false
      if (options?.actions) {
        lastMsg.actions = options.actions
      }
      if (options?.metadata) {
        lastMsg.metadata = { ...lastMsg.metadata, ...options.metadata }
      }
    }
    isGenerating.value = false
    streamingContent.value = ''
    touchActiveConversation()
  }

  /**
   * Mark a streaming message as failed in the active conversation.
   */
  function failStreamingMessage(errorMessage: string) {
    const activeMsgs = getActiveMessages()
    if (activeMsgs) {
      const lastMsg = activeMsgs[activeMsgs.length - 1]
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.isStreaming = false
        lastMsg.error = errorMessage
      }
    }
    isGenerating.value = false
    streamingContent.value = ''
    error.value = errorMessage
  }

  /**
   * Update an action's state (loading/completed).
   */
  function updateAction(messageId: string, actionId: string, updates: Partial<ChatAction>) {
    const activeMsgs = getActiveMessages()
    if (!activeMsgs) return

    const message = activeMsgs.find(m => m.id === messageId)
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
   * Clear the ACTIVE conversation's messages and re-add welcome message.
   */
  function clearMessages() {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (conv) {
      conv.messages = []
      conv.updatedAt = new Date()
    }
    streamingContent.value = ''
    error.value = null
    undoBuffer.value = []

    // Re-add welcome message
    addAssistantMessage(WELCOME_MESSAGE)
  }

  /**
   * Clear error state.
   */
  function clearError() {
    error.value = null
  }

  /**
   * Initialize the chat (called on app startup).
   * Loads conversations from localStorage, migrates old format if needed.
   */
  function initialize() {
    if (isInitialized.value) return

    // Load persisted settings
    persistedSettings.value = loadPersistedSettings()

    // Restore chat direction from persisted settings (backward-compatible: defaults to 'auto')
    if (persistedSettings.value?.chatDirection) {
      chatDirection.value = persistedSettings.value.chatDirection
    }

    // Try to load conversations from new format
    const persisted = loadPersistedConversations()

    if (persisted.conversations.length > 0) {
      // New format found
      conversations.value = persisted.conversations
      activeConversationId.value = persisted.activeId

      // Validate active conversation ID still exists
      if (activeConversationId.value && !conversations.value.find(c => c.id === activeConversationId.value)) {
        activeConversationId.value = conversations.value[0]?.id || null
      }
    } else {
      // Check for old format migration
      const oldMessages = loadOldPersistedMessages()
      if (oldMessages.length > 0) {
        // Migrate: create a "Previous Chat" conversation from old messages
        const migratedConv: Conversation = {
          id: generateConversationId(),
          title: 'Previous Chat',
          messages: oldMessages,
          createdAt: oldMessages[0]?.timestamp || new Date(),
          updatedAt: oldMessages[oldMessages.length - 1]?.timestamp || new Date(),
        }
        conversations.value = [migratedConv]
        activeConversationId.value = migratedConv.id

        // Clean up old format key
        try {
          localStorage.removeItem(CHAT_HISTORY_KEY)
        } catch {
          // silently ignore
        }
      } else {
        // No persisted data at all - create default conversation
        createConversation()
      }
    }

    // Ensure we have an active conversation
    if (!activeConversationId.value && conversations.value.length > 0) {
      activeConversationId.value = conversations.value[0].id
    }

    // Watch conversations for persistence (debounced, deep)
    watch(
      conversations,
      () => debouncedSaveConversations(),
      { deep: true }
    )

    // Also watch activeConversationId changes
    watch(
      activeConversationId,
      () => debouncedSaveConversations(),
    )

    isInitialized.value = true
  }

  /**
   * Reset the store (for logout/testing).
   * Clears all conversations and localStorage.
   */
  function reset() {
    conversations.value = []
    activeConversationId.value = null
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
      localStorage.removeItem(CONVERSATIONS_KEY)
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
    saveSettings({ ...settings, chatDirection: chatDirection.value })
  }

  /**
   * Get the persisted AI settings.
   */
  function getPersistedSettings(): { provider: string; model: string; chatDirection?: 'auto' | 'ltr' | 'rtl' } | null {
    return persistedSettings.value
  }

  /**
   * Set and persist chat text direction.
   */
  function setChatDirection(dir: 'auto' | 'ltr' | 'rtl') {
    chatDirection.value = dir
    if (persistedSettings.value) {
      saveSettings({ ...persistedSettings.value, chatDirection: dir })
    } else {
      saveSettings({ provider: 'auto', model: '', chatDirection: dir })
    }
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    isPanelOpen,
    conversations,
    activeConversationId,
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
    activeConversation,
    sortedConversations,
    messages,
    visibleMessages,
    lastMessage,
    hasMessages,
    canSend,

    // Conversation Actions
    createConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    autoNameConversation,

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

    // Chat Direction
    chatDirection,
    setChatDirection,
  }
})
