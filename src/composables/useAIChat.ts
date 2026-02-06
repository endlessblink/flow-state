/**
 * AI Chat Composable
 *
 * Provides a unified interface for AI chat functionality including:
 * - Sending messages with streaming responses
 * - Context-aware prompts
 * - Action handling
 *
 * @see TASK-1120 in MASTER_PLAN.md
 */

import { computed, watch, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAIChatStore, type ChatAction, type ChatContext } from '@/stores/aiChat'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { createAIRouter, type TaskType, type RouterProviderType } from '@/services/ai'
import type { ChatMessage as RouterChatMessage } from '@/services/ai/types'

// ============================================================================
// Types
// ============================================================================

export interface SendMessageOptions {
  /** Task type for routing */
  taskType?: TaskType
  /** System prompt override */
  systemPrompt?: string
  /** Skip adding to message history */
  skipHistory?: boolean
}

// ============================================================================
// Router Instance
// ============================================================================

let routerInstance: ReturnType<typeof createAIRouter> | null = null
let routerInitPromise: Promise<void> | null = null

/**
 * Get or initialize the AI router.
 */
async function getRouter() {
  if (!routerInstance) {
    routerInstance = createAIRouter({ debug: true })
    routerInitPromise = routerInstance.initialize()
  }
  await routerInitPromise
  return routerInstance
}

// Active provider tracking
const activeProviderRef = ref<string | null>(null)

// Provider/model selection state
const selectedProvider = ref<'ollama' | 'groq' | 'auto'>('auto')
const selectedModel = ref<string | null>(null)
const availableOllamaModels = ref<string[]>([])
const isLoadingModels = ref(false)

/**
 * Fetch available models from local Ollama instance.
 */
async function fetchOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags')
    if (!response.ok) return []
    const data = await response.json()
    return data.models?.map((m: { name: string }) => m.name) || []
  } catch {
    return []
  }
}

// ============================================================================
// Composable
// ============================================================================

export function useAIChat() {
  const store = useAIChatStore()
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()

  const {
    isPanelOpen,
    messages,
    inputText,
    isGenerating,
    streamingContent,
    context,
    pendingSuggestionCount,
    error,
    visibleMessages,
    canSend
  } = storeToRefs(store)

  // ============================================================================
  // Context Management
  // ============================================================================

  /**
   * Build the current context for AI requests.
   */
  function buildContext(): ChatContext {
    const currentContext = store.context

    // Get visible tasks if on canvas - use nodes from canvas store
    let visibleTaskIds: string[] | undefined
    if (currentContext.currentView === 'canvas') {
      // Canvas nodes with type 'taskNode' contain task data
      visibleTaskIds = canvasStore.nodes
        .filter((n: { type?: string }) => n.type === 'taskNode' || n.type === 'task')
        .map((n: { id: string }) => n.id)
    }

    return {
      ...currentContext,
      visibleTaskIds
    }
  }

  /**
   * Build messages for the AI including context.
   */
  function buildMessagesForAI(userMessage: string): RouterChatMessage[] {
    const ctx = buildContext()
    const aiMessages: RouterChatMessage[] = []

    // System prompt with context
    const systemPrompt = buildSystemPrompt(ctx)
    aiMessages.push({ role: 'system', content: systemPrompt })

    // Add recent message history (last 10 messages)
    const recentMessages = store.messages.slice(-10)
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        aiMessages.push({
          role: msg.role,
          content: msg.content
        })
      }
    }

    // Add current message
    aiMessages.push({ role: 'user', content: userMessage })

    return aiMessages
  }

  /**
   * Build the system prompt with context awareness.
   */
  function buildSystemPrompt(ctx: ChatContext): string {
    const parts: string[] = [
      'You are FlowState AI, a helpful assistant for a productivity app.',
      'You help users organize tasks, break down complex work, and suggest canvas groupings.',
      'Be concise and actionable in your responses.',
      'When suggesting actions, be specific about what will happen.',
      ''
    ]

    // Add view context
    parts.push(`Current view: ${ctx.currentView}`)

    // Add selected task context
    if (ctx.selectedTask) {
      parts.push(`Selected task: "${ctx.selectedTask.title}" (ID: ${ctx.selectedTask.id})`)
      if (ctx.selectedTask.description) {
        parts.push(`Task description: ${ctx.selectedTask.description}`)
      }
    }

    // Add visible tasks summary
    if (ctx.visibleTaskIds && ctx.visibleTaskIds.length > 0) {
      parts.push(`There are ${ctx.visibleTaskIds.length} tasks visible on the canvas.`)
    }

    // Add capabilities
    parts.push('')
    parts.push('You can help with:')
    parts.push('- Breaking down tasks into subtasks')
    parts.push('- Suggesting how to organize tasks into groups')
    parts.push('- Answering questions about task management')
    parts.push('- Providing productivity tips')

    return parts.join('\n')
  }

  // ============================================================================
  // Message Sending
  // ============================================================================

  /**
   * Send a message and get a streaming response.
   */
  async function sendMessage(
    content: string,
    options: SendMessageOptions = {}
  ): Promise<void> {
    if (!content.trim()) return
    if (store.isGenerating) return

    // Clear input
    store.inputText = ''
    store.clearError()

    // Add user message
    if (!options.skipHistory) {
      store.addUserMessage(content)
    }

    // Start streaming response
    store.startStreamingMessage()

    try {
      const router = await getRouter()
      const aiMessages = buildMessagesForAI(content)

      // Determine task type from content
      const taskType = options.taskType ?? inferTaskType(content)

      // Stream the response
      let fullContent = ''
      for await (const chunk of router.chatStream(aiMessages, {
        taskType,
        systemPrompt: options.systemPrompt,
        forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
        model: selectedModel.value || undefined
      })) {
        store.appendStreamingContent(chunk.content)
        fullContent += chunk.content
      }

      // Complete the message
      const actions = parseActionsFromResponse(fullContent)
      store.completeStreamingMessage({ actions })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response'
      store.failStreamingMessage(errorMessage)
      console.error('[AIChat] Error:', err)
    }
  }

  /**
   * Infer task type from message content.
   */
  function inferTaskType(content: string): TaskType {
    const lower = content.toLowerCase()

    if (lower.includes('break down') || lower.includes('breakdown') || lower.includes('subtask')) {
      return 'task_breakdown'
    }
    if (lower.includes('organize') || lower.includes('group') || lower.includes('canvas')) {
      return 'canvas_analysis'
    }
    if (lower.includes('plan') || lower.includes('schedule') || lower.includes('week')) {
      return 'planning'
    }
    if (lower.includes('suggest') || lower.includes('recommend')) {
      return 'suggestion'
    }

    return 'chat'
  }

  /**
   * Parse action buttons from AI response.
   * Looks for patterns like [Action: Label] in the response.
   */
  function parseActionsFromResponse(content: string): ChatAction[] | undefined {
    // For now, we'll add actions based on content patterns
    // In the future, the AI could output structured action data
    const actions: ChatAction[] = []

    // Check for task breakdown patterns
    if (content.includes('subtask') || content.includes('breakdown')) {
      actions.push({
        id: 'create_subtasks',
        label: 'Create Subtasks',
        variant: 'primary',
        handler: async () => {
          // TODO: Implement subtask creation
          console.log('Creating subtasks...')
        }
      })
    }

    // Check for grouping patterns
    if (content.includes('group') && content.includes('suggest')) {
      actions.push({
        id: 'create_group',
        label: 'Create Group',
        variant: 'primary',
        handler: async () => {
          // TODO: Implement group creation
          console.log('Creating group...')
        }
      })
    }

    return actions.length > 0 ? actions : undefined
  }

  // ============================================================================
  // Quick Actions
  // ============================================================================

  /**
   * Quick action: Organize my canvas.
   */
  async function organizeCanvas(): Promise<void> {
    await sendMessage(
      'Analyze my canvas and suggest how to organize my tasks into groups.',
      { taskType: 'canvas_analysis' }
    )
  }

  /**
   * Quick action: Break down selected task.
   */
  async function breakdownSelectedTask(): Promise<void> {
    const task = store.context.selectedTask
    if (!task) {
      store.addAssistantMessage(
        'Please select a task first, then ask me to break it down.'
      )
      return
    }

    await sendMessage(
      `Break down the task "${task.title}" into actionable subtasks.`,
      { taskType: 'task_breakdown' }
    )
  }

  /**
   * Quick action: Plan my week.
   */
  async function planWeek(): Promise<void> {
    await sendMessage(
      'Help me plan my week. Look at my tasks and deadlines and suggest a schedule.',
      { taskType: 'planning' }
    )
  }

  // ============================================================================
  // Panel Management
  // ============================================================================

  /**
   * Open panel with a specific context.
   */
  function openWithContext(ctx: Partial<ChatContext>) {
    store.updateContext(ctx)
    store.openPanel()
  }

  /**
   * Open panel for a specific task.
   */
  function openForTask(task: { id: string; title: string }) {
    const fullTask = taskStore.getTask(task.id)
    store.setSelectedTask(fullTask)
    store.openPanel()
  }

  // ============================================================================
  // Keyboard Shortcut
  // ============================================================================

  /**
   * Handle keyboard shortcut (Ctrl+/).
   */
  function handleKeyboardShortcut(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === '/') {
      event.preventDefault()
      store.togglePanel()
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Refresh available Ollama models.
   */
  async function refreshOllamaModels() {
    isLoadingModels.value = true
    try {
      availableOllamaModels.value = await fetchOllamaModels()
    } finally {
      isLoadingModels.value = false
    }
  }

  /**
   * Set the active provider (auto, groq, or ollama).
   */
  function setProvider(provider: 'ollama' | 'groq' | 'auto') {
    selectedProvider.value = provider
    if (provider === 'ollama' && availableOllamaModels.value.length === 0) {
      refreshOllamaModels()
    }
  }

  /**
   * Set the model to use (null = default for provider).
   */
  function setModel(model: string | null) {
    selectedModel.value = model
  }

  /**
   * Initialize the AI chat system.
   */
  async function initialize() {
    store.initialize()

    // Pre-initialize the router
    try {
      const routerInstance = await getRouter()
      const provider = await routerInstance!.getActiveProvider()
      activeProviderRef.value = provider
      // Fetch available Ollama models
      availableOllamaModels.value = await fetchOllamaModels()
    } catch (err) {
      console.warn('[AIChat] Router initialization failed, will retry on first use:', err)
    }
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State (from store)
    isPanelOpen,
    messages,
    inputText,
    isGenerating,
    streamingContent,
    context,
    pendingSuggestionCount,
    error,
    activeProvider: activeProviderRef,

    // Provider/model selection
    selectedProvider,
    selectedModel,
    availableOllamaModels,
    isLoadingModels,
    setProvider,
    setModel,
    refreshOllamaModels,

    // Computed
    visibleMessages,
    canSend,

    // Panel actions
    togglePanel: store.togglePanel,
    openPanel: store.openPanel,
    closePanel: store.closePanel,
    openWithContext,
    openForTask,

    // Message actions
    sendMessage,
    clearMessages: store.clearMessages,
    clearError: store.clearError,

    // Quick actions
    organizeCanvas,
    breakdownSelectedTask,
    planWeek,

    // Context
    setCurrentView: store.setCurrentView,
    setSelectedTask: store.setSelectedTask,
    updateContext: store.updateContext,

    // Lifecycle
    initialize,
    handleKeyboardShortcut
  }
}
