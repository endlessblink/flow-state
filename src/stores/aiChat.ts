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
import type { WeeklyPlanOutput } from '@/services/ai/pipeline/weeklyPlan'
import type { AIClarificationArtifact } from '@/types/aiMemory'
import { executeTool } from '@/services/ai/tools'
import type { ToolCall } from '@/services/ai/tools'
import {
  loadConversationsFromSupabase,
  saveConversationToSupabase,
  deleteConversationFromSupabase,
  subscribeToAIConversationChanges,
} from '@/services/ai/chatPersistence'
import { startUsageSync } from '@/services/ai/usageSync'

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

export type AIActivityStatus = 'running' | 'success' | 'failed' | 'waiting_confirmation' | 'cancelled'
export type AIActivityType = 'thinking' | 'read' | 'write' | 'destructive'
export type AIActivityVisualKind = 'spotlight' | 'changed' | 'pending' | 'removed'

export interface AIActivityEvent {
  id: string
  tool?: string
  type: AIActivityType
  status: AIActivityStatus
  label: string
  message?: string
  taskIds?: string[]
  visualKind?: AIActivityVisualKind
  shouldReveal?: boolean
  undoAvailable?: boolean
  timestamp: number
  metadata?: {
    phase?: string
    pathType?: string
    source?: string
    reason?: string
    startedAt?: number
    elapsedMs?: number
    timedOut?: boolean
    qualityFailures?: string[]
    fallbackQualityFailures?: string[]
    qualityFloorFailures?: string[]
    repairStage?: 'audit_failed' | 'formatter_fallback' | 'quality_floor'
    entityKeyCount?: number
    feedbackCount?: number
    lifecycle?: {
      staleEntityKeys: string[]
      refreshEntityKeys: string[]
      staleParameterBeliefKeys?: string[]
      refreshParameterBeliefKeys?: string[]
      staleSnapshotKeys?: string[]
      refreshSnapshotKeys?: string[]
      summarizeEntityKeys: string[]
      archiveEventCount: number
      lowConfidenceEntityCount: number
      lowConfidenceBeliefCount?: number
      lowConfidenceSnapshotCount?: number
    }
  }
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
    /** Tool results for rendering task cards */
    toolResults?: unknown[]
    /** Schedule onboarding question card */
    scheduleQuestion?: {
      type: 'unavailable-days'
      answered: boolean
      selectedDays?: string[]
    }
    /** Structured weekly planner artifact. Rendered directly, not parsed from markdown. */
    weeklyPlan?: WeeklyPlanOutput
    /** One-question clarification artifact. Rendered directly before broad planning. */
    clarification?: AIClarificationArtifact
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
const AI_SYNC_META_KEY = 'flowstate-ai-sync-meta'
const MAX_PERSISTED_MESSAGES = 50
const MAX_PERSISTED_CONVERSATIONS = 20
const MAX_UNDO_ENTRIES = 10
const SAVE_DEBOUNCE_MS = 300

const WELCOME_MESSAGE = "Hi! I'm your FlowState AI assistant. I can help you organize your tasks, break down complex work, and suggest canvas groupings. Just ask me anything!"

type ConversationSyncMeta = {
  lastRemoteSyncAt?: string
  knownRemoteIds?: string[]
  deletedIds?: string[]
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

  type ChatDirection = 'auto' | 'ltr' | 'rtl'
  type ChatLanguage = 'auto' | 'en' | 'he'
  type PersistedAISettings = {
    provider: string
    model: string
    chatDirection?: ChatDirection
    chatLanguage?: ChatLanguage
  }

  /** Persisted AI settings (provider/model/chatDirection/chatLanguage) */
  const persistedSettings = ref<PersistedAISettings | null>(null)

  /** Chat text direction override (auto = browser default) */
  const chatDirection = ref<ChatDirection>('auto')

  /** Assistant reply language override (auto = match user input) */
  const chatLanguage = ref<ChatLanguage>('auto')

  /** Supabase sync status indicator */
  const syncStatus = ref<'idle' | 'syncing' | 'synced' | 'error' | 'offline'>('idle')

  /** Live, session-only visibility into AI tool/action execution. */
  const activityEvents = ref<AIActivityEvent[]>([])

  // ============================================================================
  // Persistence Helpers
  // ============================================================================

  let saveTimeout: ReturnType<typeof setTimeout> | null = null
  let supabaseSaveTimeout: ReturnType<typeof setTimeout> | null = null
  let conversationSyncSubscription: { unsubscribe: () => Promise<void> } | null = null
  let isApplyingRemoteConversation = false

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

  function cloneMessage(message: ChatMessage): ChatMessage {
    return {
      ...message,
      timestamp: message.timestamp instanceof Date ? new Date(message.timestamp) : new Date(message.timestamp),
      actions: message.actions,
      metadata: message.metadata ? { ...message.metadata } : undefined,
    }
  }

  function cloneConversation(conversation: Conversation): Conversation {
    return {
      ...conversation,
      messages: conversation.messages.map(cloneMessage),
      createdAt: conversation.createdAt instanceof Date ? new Date(conversation.createdAt) : new Date(conversation.createdAt),
      updatedAt: conversation.updatedAt instanceof Date ? new Date(conversation.updatedAt) : new Date(conversation.updatedAt),
    }
  }

  function compareDates(a: Date, b: Date): number {
    return new Date(a).getTime() - new Date(b).getTime()
  }

  function mergeMessages(localMessages: ChatMessage[], remoteMessages: ChatMessage[]): ChatMessage[] {
    const byId = new Map<string, ChatMessage>()

    for (const message of remoteMessages) {
      byId.set(message.id, cloneMessage(message))
    }

    for (const localMessage of localMessages) {
      const remoteMessage = byId.get(localMessage.id)
      if (!remoteMessage) {
        byId.set(localMessage.id, cloneMessage(localMessage))
        continue
      }

      if (localMessage.isStreaming) {
        byId.set(localMessage.id, cloneMessage(localMessage))
        continue
      }

      byId.set(localMessage.id, {
        ...remoteMessage,
        actions: localMessage.actions || remoteMessage.actions,
        metadata: localMessage.metadata || remoteMessage.metadata,
      })
    }

    return [...byId.values()].sort((a, b) => compareDates(a.timestamp, b.timestamp))
  }

  function mergeConversation(localConversation: Conversation | undefined, remoteConversation: Conversation): Conversation {
    if (!localConversation) return cloneConversation(remoteConversation)

    const localUpdatedAt = new Date(localConversation.updatedAt)
    const remoteUpdatedAt = new Date(remoteConversation.updatedAt)
    const titleSource = localUpdatedAt > remoteUpdatedAt ? localConversation : remoteConversation

    return {
      id: remoteConversation.id,
      title: titleSource.title,
      messages: mergeMessages(localConversation.messages, remoteConversation.messages),
      createdAt: compareDates(localConversation.createdAt, remoteConversation.createdAt) <= 0
        ? new Date(localConversation.createdAt)
        : new Date(remoteConversation.createdAt),
      updatedAt: localUpdatedAt > remoteUpdatedAt ? localUpdatedAt : remoteUpdatedAt,
    }
  }

  function mergeConversationSets(
    localConversations: Conversation[],
    remoteConversations: Conversation[]
  ): { merged: Conversation[]; uploadIds: Set<string> } {
    const syncMeta = loadConversationSyncMeta()
    const localById = new Map(localConversations.map(conversation => [conversation.id, conversation]))
    const remoteById = new Map(remoteConversations.map(conversation => [conversation.id, conversation]))
    const uploadIds = new Set<string>()
    const ids = new Set([...localById.keys(), ...remoteById.keys()])

    const merged = [...ids].map((id) => {
      const localConversation = localById.get(id)
      const remoteConversation = remoteById.get(id)

      if (!remoteConversation && localConversation) {
        if (!shouldUploadLocalOnlyConversation(localConversation, remoteConversations, syncMeta)) {
          return null
        }
        uploadIds.add(id)
        return cloneConversation(localConversation)
      }

      if (!localConversation && remoteConversation) {
        return cloneConversation(remoteConversation)
      }

      const mergedConversation = mergeConversation(localConversation, remoteConversation!)
      if (
        localConversation &&
        remoteConversation &&
        new Date(localConversation.updatedAt).getTime() > new Date(remoteConversation.updatedAt).getTime()
      ) {
        uploadIds.add(id)
      }
      return mergedConversation
    }).filter((conversation): conversation is Conversation => conversation !== null)
      .sort((a, b) => compareDates(b.updatedAt, a.updatedAt))
      .slice(0, MAX_PERSISTED_CONVERSATIONS)

    return { merged, uploadIds }
  }

  function writeConversationsToLocalStorage() {
    try {
      localStorage.setItem(CONVERSATIONS_KEY, serializeConversations())
    } catch {
      // localStorage full or unavailable - silently ignore
    }
  }

  function loadConversationSyncMeta(): ConversationSyncMeta {
    try {
      const raw = localStorage.getItem(AI_SYNC_META_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as ConversationSyncMeta
      return {
        lastRemoteSyncAt: typeof parsed.lastRemoteSyncAt === 'string' ? parsed.lastRemoteSyncAt : undefined,
        knownRemoteIds: Array.isArray(parsed.knownRemoteIds) ? parsed.knownRemoteIds.filter(id => typeof id === 'string') : [],
        deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds.filter(id => typeof id === 'string') : [],
      }
    } catch {
      return {}
    }
  }

  function writeConversationSyncMeta(meta: ConversationSyncMeta) {
    try {
      localStorage.setItem(AI_SYNC_META_KEY, JSON.stringify({
        lastRemoteSyncAt: meta.lastRemoteSyncAt,
        knownRemoteIds: [...new Set(meta.knownRemoteIds || [])],
        deletedIds: [...new Set(meta.deletedIds || [])],
      }))
    } catch {
      // localStorage full or unavailable - silently ignore
    }
  }

  function rememberRemoteSync(remoteConversations: Conversation[]) {
    const previous = loadConversationSyncMeta()
    writeConversationSyncMeta({
      ...previous,
      lastRemoteSyncAt: new Date().toISOString(),
      knownRemoteIds: remoteConversations.map(conversation => conversation.id),
    })
  }

  function rememberConversationDelete(conversationId: string) {
    const previous = loadConversationSyncMeta()
    const deletedIds = new Set(previous.deletedIds || [])
    deletedIds.add(conversationId)
    const knownRemoteIds = new Set(previous.knownRemoteIds || [])
    knownRemoteIds.delete(conversationId)
    writeConversationSyncMeta({
      ...previous,
      knownRemoteIds: [...knownRemoteIds],
      deletedIds: [...deletedIds],
    })
  }

  function shouldUploadLocalOnlyConversation(
    conversation: Conversation,
    remoteConversations: Conversation[],
    syncMeta: ConversationSyncMeta
  ): boolean {
    const deletedIds = new Set(syncMeta.deletedIds || [])
    if (deletedIds.has(conversation.id)) return false

    const knownRemoteIds = new Set(syncMeta.knownRemoteIds || [])
    if (knownRemoteIds.has(conversation.id)) return false

    const isWelcomeOnlyNewChat =
      conversation.title === 'New Chat' &&
      conversation.messages.length === 1 &&
      conversation.messages[0]?.role === 'assistant' &&
      conversation.messages[0]?.content === WELCOME_MESSAGE

    if (remoteConversations.length > 0 && isWelcomeOnlyNewChat) return false

    if (!syncMeta.lastRemoteSyncAt) return true

    return new Date(conversation.updatedAt).getTime() > new Date(syncMeta.lastRemoteSyncAt).getTime()
  }

  /**
   * Save conversations to localStorage (debounced).
   * Also triggers a debounced Supabase save for the active conversation.
   */
  function debouncedSaveConversations() {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      writeConversationsToLocalStorage()

      if (isApplyingRemoteConversation) return

      // Also save active conversation to Supabase (VPS-first architecture)
      const activeConv = conversations.value.find(c => c.id === activeConversationId.value)
      if (activeConv) {
        debouncedSupabaseSave(activeConv)
      }
    }, SAVE_DEBOUNCE_MS)
  }

  /**
   * Save a single conversation to Supabase (debounced 2s).
   * Silently fails — localStorage remains the fallback.
   */
  function debouncedSupabaseSave(conversation: Conversation) {
    if (supabaseSaveTimeout) clearTimeout(supabaseSaveTimeout)
    supabaseSaveTimeout = setTimeout(() => {
      flushConversationToSupabase(conversation).catch(() => {})
    }, 2000)
  }

  async function flushConversationToSupabase(conversation: Conversation): Promise<boolean> {
    syncStatus.value = 'syncing'
    const saved = await saveConversationToSupabase(conversation)
    syncStatus.value = saved ? 'synced' : 'error'
    return saved
  }

  async function flushConversationSync(conversationId = activeConversationId.value): Promise<boolean> {
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (!conversation) return false
    return flushConversationToSupabase(conversation)
  }

  async function uploadMergedConversations(uploadIds: Set<string>): Promise<boolean> {
    let allSaved = true
    for (const id of uploadIds) {
      const conversation = conversations.value.find(c => c.id === id)
      if (conversation) {
        const saved = await flushConversationToSupabase(conversation)
        allSaved = allSaved && saved
      }
    }
    return allSaved
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
  function saveSettings(settings: PersistedAISettings) {
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
  function loadPersistedSettings(): PersistedAISettings | null {
    try {
      const raw = localStorage.getItem(AI_SETTINGS_KEY)
      if (!raw) return null
      return JSON.parse(raw) as PersistedAISettings
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

    if (isInitialized.value && !isApplyingRemoteConversation) {
      writeConversationsToLocalStorage()
      flushConversationToSupabase(conv).catch(() => {})
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
    rememberConversationDelete(id)

    // Mirror deletion in Supabase (silently fails if offline)
    syncStatus.value = 'syncing'
    deleteConversationFromSupabase(id)
      .then((deleted) => { syncStatus.value = deleted ? 'synced' : 'error' })
      .catch(() => { syncStatus.value = 'error' })

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
      flushConversationToSupabase(conv).catch(() => {})
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
    flushConversationSync().catch(() => {})
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
    flushConversationSync().catch(() => {})
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
    flushConversationSync().catch(() => {})
  }

  /**
   * Clear error state.
   */
  function clearError() {
    error.value = null
  }

  function applyRemoteConversation(remoteConversation: Conversation) {
    const localConversation = conversations.value.find(c => c.id === remoteConversation.id)

    if (
      localConversation &&
      activeConversationId.value === remoteConversation.id &&
      localConversation.messages.some(message => message.isStreaming)
    ) {
      return
    }

    isApplyingRemoteConversation = true
    try {
      const mergedConversation = mergeConversation(localConversation, remoteConversation)
      if (localConversation) {
        const index = conversations.value.findIndex(c => c.id === remoteConversation.id)
        conversations.value[index] = mergedConversation
      } else {
        conversations.value.push(mergedConversation)
      }
      conversations.value = [...conversations.value]
        .sort((a, b) => compareDates(b.updatedAt, a.updatedAt))
        .slice(0, MAX_PERSISTED_CONVERSATIONS)

      if (!activeConversationId.value) {
        activeConversationId.value = conversations.value[0]?.id || null
      }
      writeConversationsToLocalStorage()
      syncStatus.value = 'synced'
    } finally {
      isApplyingRemoteConversation = false
    }
  }

  function applyRemoteConversationDelete(conversationId: string) {
    isApplyingRemoteConversation = true
    try {
      conversations.value = conversations.value.filter(conversation => conversation.id !== conversationId)
      rememberConversationDelete(conversationId)
      if (activeConversationId.value === conversationId) {
        activeConversationId.value = sortedConversations.value[0]?.id || null
      }
      writeConversationsToLocalStorage()
      syncStatus.value = 'synced'
    } finally {
      isApplyingRemoteConversation = false
    }
  }

  async function startConversationRealtimeSync() {
    if (conversationSyncSubscription) return

    try {
      conversationSyncSubscription = await subscribeToAIConversationChanges({
        onUpsert: applyRemoteConversation,
        onDelete: applyRemoteConversationDelete,
        onStatus: (status) => {
          if (status === 'SUBSCRIBED') syncStatus.value = 'synced'
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') syncStatus.value = 'error'
        },
      })
    } catch (err) {
      console.warn('[AIChat] Failed to start conversation realtime sync:', err)
      syncStatus.value = 'error'
    }
  }

  /**
   * Reconcile local chat history with Supabase after auth becomes available.
   *
   * Electron can initialize the AI store before the async disk-backed Supabase
   * session has finished loading. In that state the first load/realtime attempt
   * returns unauthenticated and the store falls back to localStorage. This retry
   * path lets auth events converge Electron, localhost, and PWA later in the same
   * session without requiring a restart.
   */
  async function syncConversationsWithSupabaseNow(): Promise<boolean> {
    const remoteConversations = await loadConversationsFromSupabase()
    if (!remoteConversations) {
      syncStatus.value = 'error'
      return false
    }

    const merged = mergeConversationSets(conversations.value, remoteConversations)

    isApplyingRemoteConversation = true
    try {
      conversations.value = merged.merged
      if (!activeConversationId.value || !conversations.value.find(c => c.id === activeConversationId.value)) {
        activeConversationId.value = conversations.value[0]?.id || null
      }
      writeConversationsToLocalStorage()
      rememberRemoteSync(remoteConversations)
    } finally {
      isApplyingRemoteConversation = false
    }

    const uploaded = await uploadMergedConversations(merged.uploadIds)
    await startConversationRealtimeSync()
    syncStatus.value = uploaded ? 'synced' : 'error'
    return uploaded
  }

  /**
   * Initialize the chat (called on app startup).
   * Merges Supabase and localStorage so every app surface converges on the same history.
   * Migrates old localStorage format if needed.
   */
  async function initialize() {
    if (isInitialized.value) return

    // Load persisted settings
    persistedSettings.value = loadPersistedSettings()

    // Restore chat direction from persisted settings (backward-compatible: defaults to 'auto')
    if (persistedSettings.value?.chatDirection) {
      chatDirection.value = persistedSettings.value.chatDirection
    }
    // Restore assistant reply language from persisted settings (backward-compatible: defaults to 'auto')
    if (persistedSettings.value?.chatLanguage) {
      chatLanguage.value = persistedSettings.value.chatLanguage
    } else if (persistedSettings.value?.chatDirection === 'rtl') {
      // Legacy migration: older settings only stored chatDirection. RTL users had
      // no reply-language preference — infer Hebrew so the reply language matches.
      chatLanguage.value = 'he'
      saveSettings({ ...persistedSettings.value, chatLanguage: 'he' })
    }

    const persisted = loadPersistedConversations()
    const supabaseConversations = await loadConversationsFromSupabase()

    if (supabaseConversations && supabaseConversations.length > 0) {
      const merged = mergeConversationSets(persisted.conversations, supabaseConversations)
      conversations.value = merged.merged
      // Restore last active conversation (from localStorage, since Supabase doesn't store it)
      activeConversationId.value = persisted.activeId || conversations.value[0]?.id || null
      // Validate active conversation ID still exists in the loaded set
      if (activeConversationId.value && !conversations.value.find(c => c.id === activeConversationId.value)) {
        activeConversationId.value = conversations.value[0]?.id || null
      }
      writeConversationsToLocalStorage()
      rememberRemoteSync(supabaseConversations)
      await uploadMergedConversations(merged.uploadIds)
      console.log(`[AIChat] Merged ${supabaseConversations.length} Supabase conversations with ${persisted.conversations.length} local conversations`)
    } else {
      // --- Fallback: localStorage ---
      if (persisted.conversations.length > 0) {
        // New localStorage format found
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

      await uploadMergedConversations(new Set(conversations.value.map(conversation => conversation.id)))
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

    // Start usage sync to Supabase
    startUsageSync()
    await startConversationRealtimeSync()

    isInitialized.value = true
  }

  /**
   * Reset the store (for logout/testing).
   * Clears all conversations and localStorage.
   */
  function reset() {
    if (conversationSyncSubscription) {
      conversationSyncSubscription.unsubscribe().catch(() => {})
      conversationSyncSubscription = null
    }
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
    activityEvents.value = []
    try {
      localStorage.removeItem(CONVERSATIONS_KEY)
      localStorage.removeItem(CHAT_HISTORY_KEY)
      localStorage.removeItem(AI_SETTINGS_KEY)
    } catch {
      // silently ignore
    }
  }

  // ============================================================================
  // Activity Timeline
  // ============================================================================

  function addActivityEvent(event: Omit<AIActivityEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): string {
    const id = event.id || `ai-activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const existingIndex = activityEvents.value.findIndex((item) => item.id === id)
    if (existingIndex !== -1) {
      activityEvents.value[existingIndex] = {
        ...activityEvents.value[existingIndex],
        ...event,
        id,
        timestamp: event.timestamp || Date.now(),
        metadata: {
          ...activityEvents.value[existingIndex].metadata,
          ...event.metadata,
        },
      }
      return id
    }
    activityEvents.value.unshift({
      ...event,
      id,
      timestamp: event.timestamp || Date.now(),
    })
    activityEvents.value = activityEvents.value.slice(0, 8)
    return id
  }

  function updateActivityEvent(id: string, patch: Partial<Omit<AIActivityEvent, 'id'>>): void {
    const index = activityEvents.value.findIndex((event) => event.id === id)
    if (index === -1) return
    activityEvents.value[index] = {
      ...activityEvents.value[index],
      ...patch,
      timestamp: patch.timestamp || Date.now(),
      metadata: {
        ...activityEvents.value[index].metadata,
        ...patch.metadata,
      },
    }
  }

  function clearActivityEvents(): void {
    activityEvents.value = []
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
    saveSettings({ ...settings, chatDirection: chatDirection.value, chatLanguage: chatLanguage.value })
  }

  /**
   * Get the persisted AI settings.
   */
  function getPersistedSettings(): PersistedAISettings | null {
    return persistedSettings.value
  }

  /**
   * Set and persist chat text direction.
   */
  function setChatDirection(dir: ChatDirection) {
    chatDirection.value = dir
    if (persistedSettings.value) {
      saveSettings({ ...persistedSettings.value, chatDirection: dir })
    } else {
      saveSettings({ provider: 'auto', model: '', chatDirection: dir, chatLanguage: chatLanguage.value })
    }
  }

  /**
   * Set and persist assistant reply language.
   */
  function setChatLanguage(language: ChatLanguage) {
    chatLanguage.value = language
    // Hebrew reply implies RTL text — but only when the user hasn't explicitly
    // chosen a direction yet (still 'auto'). Direction stays an independent setting.
    if (language === 'he' && chatDirection.value === 'auto') {
      chatDirection.value = 'rtl'
    }
    if (persistedSettings.value) {
      saveSettings({ ...persistedSettings.value, chatLanguage: language, chatDirection: chatDirection.value })
    } else {
      saveSettings({ provider: 'auto', model: '', chatDirection: chatDirection.value, chatLanguage: language })
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
    syncStatus,
    activityEvents,

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
    flushConversationSync,
    syncConversationsWithSupabaseNow,
    applyRemoteConversation,
    applyRemoteConversationDelete,
    addActivityEvent,
    updateActivityEvent,
    clearActivityEvents,

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

    // Chat Language
    chatLanguage,
    setChatLanguage,
  }
})
