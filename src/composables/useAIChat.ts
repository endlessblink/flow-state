/**
 * AI Chat Composable
 *
 * Provides a unified interface for AI chat functionality including:
 * - Sending messages with streaming responses
 * - Context-aware prompts with timer & task statistics
 * - Tool result feedback with undo support
 * - Rate limiting (MAX_TOOLS_PER_RESPONSE)
 * - Confirmation flow for destructive tools
 * - Action button handlers wired to tools
 * - Settings persistence (provider/model)
 *
 * @see TASK-1120, TASK-1186 in MASTER_PLAN.md
 */

import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAIChatStore, type ChatAction, type ChatContext } from '@/stores/aiChat'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useTimerStore } from '@/stores/timer'
import { type TaskType, type RouterProviderType } from '@/services/ai'
import { getSharedRouter } from '@/services/ai/routerFactory'
import type { ChatMessage as RouterChatMessage } from '@/services/ai/types'
import {
  parseToolCalls,
  executeTool,
  buildOpenAITools,
  buildNativeToolsBehaviorPrompt,
  MAX_TOOLS_PER_RESPONSE,
  AI_TOOLS,
  type ToolCall,
  type ToolResult,
} from '@/services/ai/tools'
import type { NativeToolCall } from '@/services/ai/types'
import { useAgentChains } from './useAgentChains'
import { getAIUserContext } from '@/services/ai/userContext'

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
  /** Enable multi-step ReAct (Reasoning + Acting) loop for cloud providers */
  useReAct?: boolean
}

/**
 * A quick action button that can optionally call a tool directly
 * (bypassing AI model call — works with Ollama and other local models).
 */
export interface QuickAction {
  label: string
  message: string
  /** If set, the tool is called directly instead of sending to AI */
  directTool?: ToolCall | null
}

// ============================================================================
// Router Instance
// ============================================================================

// TASK-1350: Use shared router singleton (reads user's API key from settings)
async function getRouter() {
  return getSharedRouter()
}

// Active provider tracking
const activeProviderRef = ref<string | null>(null)

// AI Personality mode
const aiPersonality = ref<'professional' | 'grid_handler'>('professional')

/**
 * Set the AI personality mode.
 */
function setPersonality(p: 'professional' | 'grid_handler') {
  aiPersonality.value = p
}

/**
 * Get the system prompt prefix for the current personality.
 * Returns empty string for 'professional' (uses default prompt).
 */
function getPersonalitySystemPrompt(): string {
  if (aiPersonality.value === 'grid_handler') {
    return 'You are the Grid Handler, a netrunner AI embedded in the FlowState productivity matrix. You speak in cyberpunk hacker slang. Tasks are \'ops\' or \'jobs\'. Completing work is \'executing\'. The timer is your \'neural clock\'. XP is \'data fragments\'. Challenges are \'contracts\'. You reference \'the Grid\', \'data streams\', and \'neural pathways\'. Keep it fun but still helpful — you\'re assisting a runner with their daily ops. Use short, punchy sentences. Occasionally reference system corruption levels if gamification data is available.'
  }
  return ''
}

// ============================================================================
// ReAct Loop Configuration
// ============================================================================

/** Maximum reasoning steps before the circuit breaker stops the ReAct loop */
const MAX_REACT_STEPS = 5

/** AbortController for cancelling an in-progress ReAct loop */
const reactAbortController = ref<AbortController | null>(null)

/**
 * Abort an in-progress ReAct loop.
 * Safe to call even if no loop is running.
 */
function abortReAct() {
  reactAbortController.value?.abort()
  reactAbortController.value = null
}

// Provider/model selection state
const selectedProvider = ref<'ollama' | 'groq' | 'openrouter' | 'auto'>('auto')
const selectedModel = ref<string | null>(null)
const availableOllamaModels = ref<string[]>([])
const isLoadingModels = ref(false)
const providerModelMemory = ref<Record<string, string | null>>({})

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
// Helpers
// ============================================================================

/**
 * Strip tool JSON blocks from displayed content so users don't see raw JSON.
 */
function stripToolBlocks(content: string): string {
  // Strip code-fenced tool blocks
  let cleaned = content.replace(/```(?:tool|json)?\s*\n?\{[\s\S]*?"tool"\s*:[\s\S]*?\}\n?```/g, '')
  // Strip bare JSON tool calls (models sometimes omit code fences)
  cleaned = cleaned.replace(/\{\s*"tool"\s*:\s*"[^"]+"\s*,\s*"parameters"\s*:\s*\{[^}]*\}\s*\}/g, '')
  return cleaned.trim()
}

/**
 * Check whether a tool definition requires user confirmation before execution.
 */
function toolRequiresConfirmation(toolName: string): boolean {
  const def = AI_TOOLS.find(t => t.name === toolName)
  return def?.requiresConfirmation === true
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
    canSend,
    chatDirection
  } = storeToRefs(store)

  // Pending confirmation flow: stores a tool call awaiting user approval
  const pendingConfirmation = ref<ToolCall | null>(null)

  // Agent chains integration
  const agentChains = useAgentChains()

  // ============================================================================
  // Text-Based Tool Call Helpers (Fallback for models that don't use native API)
  // ============================================================================

  /**
   * Parse tool calls from model text output.
   * Detects patterns like: tool_name(), tool_name({...}), tool_name(param1, param2)
   * Used as fallback when model doesn't use native function calling.
   */
  function parseTextToolCalls(content: string): ToolCall[] {
    const calls: ToolCall[] = []
    const toolNames = AI_TOOLS.map(t => t.name)

    for (const name of toolNames) {
      // Match: tool_name() or tool_name({...}) or tool_name(anything)
      const pattern = new RegExp(`\\b${name}\\s*\\(([^)]*)\\)`, 'g')
      let match
      while ((match = pattern.exec(content)) !== null) {
        let parameters: Record<string, unknown> = {}
        const argsStr = match[1].trim()
        if (argsStr) {
          try {
            parameters = JSON.parse(argsStr)
          } catch {
            // Not JSON args — tool will use defaults
          }
        }
        // Avoid duplicates
        if (!calls.some(c => c.tool === name)) {
          calls.push({ tool: name, parameters })
        }
      }
    }

    // Also try the existing parseToolCalls for JSON-format tool calls
    if (calls.length === 0) {
      const jsonCalls = parseToolCalls(content)
      calls.push(...jsonCalls)
    }

    return calls.slice(0, MAX_TOOLS_PER_RESPONSE)
  }

  /**
   * Strip text-based tool call patterns from displayed message content.
   * Removes patterns like: generate_weekly_plan(), list_tasks({...})
   */
  function stripTextToolCalls(content: string): string {
    const toolNames = AI_TOOLS.map(t => t.name)
    let cleaned = content
    for (const name of toolNames) {
      // Remove: tool_name() or tool_name({...})
      const pattern = new RegExp(`\\b${name}\\s*\\([^)]*\\)`, 'g')
      cleaned = cleaned.replace(pattern, '')
    }
    // Clean up trailing whitespace and dots
    return cleaned.replace(/\s*\.{3,}\s*$/, '').replace(/\n{3,}/g, '\n\n').trim()
  }

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
  async function buildMessagesForAI(userMessage: string): Promise<RouterChatMessage[]> {
    const ctx = buildContext()
    const aiMessages: RouterChatMessage[] = []

    // System prompt with context
    const systemPrompt = await buildSystemPrompt(ctx)
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
   * Includes timer state, task statistics, and additional context.
   */
  async function buildSystemPrompt(ctx: ChatContext): Promise<string> {
    // Prepend personality prompt if active
    const personalityPrompt = getPersonalitySystemPrompt()

    const parts: string[] = [
      personalityPrompt || 'You are FlowState AI, a friendly assistant for a productivity app.',
      '',
      '## CRITICAL RULES:',
      '1. LANGUAGE RULE (ABSOLUTE): Respond ENTIRELY in the SAME LANGUAGE the user writes. If they write Hebrew, ALL your text must be Hebrew — including status updates, acknowledgments, and summaries. NEVER mix languages. Examples: Hebrew user → "אני מכין את התוכנית השבועית שלך..." (NOT "...generating weekly plan"). English user → "Generating your weekly plan..." (NOT Hebrew text).',
      '2. Be conversational and natural. Have a normal chat.',
      '3. Use WRITE tools (create, update, delete) ONLY when the user explicitly asks to create, add, modify, or delete something.',
      '4. Use READ tools (get_overdue_tasks, list_tasks, search_tasks, get_task_details, get_daily_summary, get_timer_status, list_projects, list_groups) ALWAYS when the user asks about their tasks, schedule, what is overdue, timer status, or any data query. These tools return rich interactive results the user can click on. NEVER answer task data questions from memory — ALWAYS call the tool.',
      '5. If the user just says "hi" or has a general question unrelated to their tasks, just respond normally - NO tools needed.',
      '6. Never show JSON to the user or explain tool syntax. Just do the action silently.',
      '7. When using read tools, keep your text response SHORT (1 sentence summary) — the tool results will show the detailed data with clickable links.',
      '',
      buildNativeToolsBehaviorPrompt(),
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

    // Enhanced context: Timer state
    try {
      const timerStore = useTimerStore()
      if (timerStore.isTimerActive) {
        const taskName = timerStore.currentTaskName || 'Unknown'
        const remaining = timerStore.displayTime || '??:??'
        parts.push(`Timer: Running for "${taskName}" (${remaining} left)`)
      } else {
        parts.push('Timer: Not running')
      }
    } catch {
      // Timer store not available
    }

    // Enhanced context: Task statistics
    try {
      const allTasks = taskStore.tasks
      const today = new Date().toISOString().split('T')[0]
      const byStatus = {
        planned: 0,
        in_progress: 0,
        done: 0,
        backlog: 0,
        on_hold: 0,
      }
      let overdueCount = 0
      for (const t of allTasks) {
        if (t.status && t.status in byStatus) {
          byStatus[t.status as keyof typeof byStatus]++
        }
        if (t.dueDate && t.dueDate < today && t.status !== 'done') {
          overdueCount++
        }
      }
      parts.push(
        `Tasks: ${allTasks.length} total, ${byStatus.planned} planned, ${byStatus.in_progress} in progress, ${byStatus.done} done, ${overdueCount} overdue`
      )
    } catch {
      // Task store not available
    }

    // Additional context (from ChatContext)
    if (ctx.additionalContext) {
      parts.push('')
      parts.push(ctx.additionalContext)
    }

    // Add capabilities
    parts.push('')
    parts.push('You can help with:')
    parts.push('- Breaking down tasks into subtasks')
    parts.push('- Suggesting how to organize tasks into groups')
    parts.push('- Managing timers and Pomodoro sessions')
    parts.push('- Answering questions about task management')
    parts.push('- Providing productivity tips')
    parts.push('')
    parts.push('## Planning Behavior')
    parts.push('When the user asks to plan their week, schedule tasks, or organize upcoming work:')
    parts.push('- Use the generate_weekly_plan tool to create an AI-powered weekly plan')
    parts.push('- Present the plan day-by-day with task names and priorities')
    parts.push('- Be encouraging and practical in your summary')
    parts.push('- IMPORTANT: Your acknowledgment text before/during tool execution must match the user\'s language (e.g., Hebrew user → "בדיוק, אני מתכנן את השבוע שלך..." NOT "generating weekly plan...")')

    // Add centralized AI user context
    const userContext = await getAIUserContext('chat')
    return parts.join('\n') + userContext
  }

  // ============================================================================
  // Message Sending
  // ============================================================================

  /**
   * Send a message and get a streaming response.
   * All providers use native tool calling — the AI model decides which tools to invoke.
   */
  async function sendMessage(
    content: string,
    options: SendMessageOptions = {}
  ): Promise<void> {
    if (!content.trim()) return
    if (store.isGenerating) return

    // Always use ReAct — the model decides if/when to call tools via native function calling.
    // No hardcoded keyword routing. If the model doesn't call tools, the loop exits on iteration 1.
    return sendMessageWithReAct(content, options)
  }

  // Dead code below kept for reference — sendMessage always routes to ReAct now.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function _sendMessageLegacy(
    content: string,
    options: SendMessageOptions = {}
  ): Promise<void> {
    const useNativeTools = true

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
      const aiMessages = await buildMessagesForAI(content)

      // Determine task type from content
      const taskType = options.taskType ?? inferTaskType(content)

      // Stream the response, collecting native tool calls if available
      let fullContent = ''
      let nativeToolCalls: NativeToolCall[] | undefined

      for await (const chunk of router.chatStream(aiMessages, {
        taskType,
        systemPrompt: options.systemPrompt,
        forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
        model: selectedModel.value || undefined,
        ...(useNativeTools && {
          tools: buildOpenAITools(),
          toolChoice: 'auto' as const,
        }),
      })) {
        store.appendStreamingContent(chunk.content)
        fullContent += chunk.content
        // Collect native tool calls from final chunk
        if (chunk.toolCalls && chunk.toolCalls.length > 0) {
          nativeToolCalls = chunk.toolCalls
        }
      }

      // After successful stream, update badge to show the ACTUAL provider used
      try {
        const currentRouter = await getRouter()
        const lastUsed = currentRouter.getLastUsedProvider()
        if (lastUsed) {
          activeProviderRef.value = lastUsed
        }
      } catch { /* ignore */ }

      // Parse tool calls: prefer native API tool_calls, fallback to regex for Ollama
      let allToolCalls: ToolCall[]
      let wasRateLimited = false

      if (nativeToolCalls && nativeToolCalls.length > 0) {
        console.log('[AIChat] Using native tool calls:', nativeToolCalls.length)
        allToolCalls = nativeToolCalls
          .map(tc => {
            try {
              const params = JSON.parse(tc.function.arguments)
              return { tool: tc.function.name, parameters: params } as ToolCall
            } catch (e) {
              console.warn('[AIChat] Failed to parse native tool call arguments:', tc.function.arguments, e)
              return null
            }
          })
          .filter((tc): tc is ToolCall => tc !== null)
        // Enforce rate limit
        if (allToolCalls.length > MAX_TOOLS_PER_RESPONSE) {
          console.warn(`[AIChat] Truncating native tool calls from ${allToolCalls.length} to ${MAX_TOOLS_PER_RESPONSE}`)
          wasRateLimited = true
          allToolCalls = allToolCalls.slice(0, MAX_TOOLS_PER_RESPONSE)
        }
      } else {
        // Fallback: regex-based parsing (for Ollama and models that don't support native tools)
        allToolCalls = parseToolCalls(fullContent)

        // Rate limiting: parseToolCalls already truncates to MAX_TOOLS_PER_RESPONSE,
        // but we detect if the original content had more calls for a user warning
        const toolBlockCount = (fullContent.match(/```(?:tool|json)?\s*\n?[\s\S]*?\n?```/g) || []).length
        wasRateLimited = toolBlockCount > MAX_TOOLS_PER_RESPONSE
      }

      // Strip tool JSON blocks from the displayed message content
      const cleanContent = stripToolBlocks(fullContent)
      const lastMsg = store.messages[store.messages.length - 1]
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.content = cleanContent
        store.streamingContent = cleanContent
      }

      // Separate tools needing confirmation vs immediate execution
      const immediateTools: ToolCall[] = []
      const confirmationTools: ToolCall[] = []
      for (const call of allToolCalls) {
        if (toolRequiresConfirmation(call.tool)) {
          confirmationTools.push(call)
        } else {
          immediateTools.push(call)
        }
      }

      // Execute immediate tools
      const toolResults: ToolResult[] = []
      for (const call of immediateTools) {
        console.log('[AIChat] Executing tool:', call.tool, call.parameters)
        const result = await executeTool(call)
        toolResults.push(result)
        console.log('[AIChat] Tool result:', result)

        // Push undo entry if the tool returned an undoAction
        if (result.success && result.undoAction) {
          store.pushUndoEntry({
            toolName: call.tool,
            timestamp: Date.now(),
            params: call.parameters,
            undoAction: result.undoAction,
            description: result.message,
          })
        }
      }

      // Handle tool result feedback
      if (toolResults.length > 0) {
        const failedTools = toolResults.filter(r => !r.success)

        if (failedTools.length > 0) {
          store.appendStreamingContent('\n\n---\n' + failedTools.map(r => `Error: ${r.message}`).join('\n'))
        }

        // Store tool results in message metadata (include data for rich rendering)
        if (lastMsg) {
          lastMsg.metadata = {
            ...lastMsg.metadata,
            toolResults: toolResults.map((r, i) => ({
              success: r.success,
              message: r.message,
              data: r.data,
              tool: immediateTools[i]?.tool || 'unknown',
              type: AI_TOOLS.find(t => t.name === immediateTools[i]?.tool)?.category || 'read',
            })),
          } as any
        }
      }

      // Rate limit warning
      if (wasRateLimited) {
        store.appendStreamingContent(
          `\n\n---\nTool limit reached (${MAX_TOOLS_PER_RESPONSE} per response). Some tool calls were skipped.`
        )
      }

      // Handle confirmation tools: queue the first one for user approval
      if (confirmationTools.length > 0) {
        const confirmCall = confirmationTools[0]
        pendingConfirmation.value = confirmCall

        // Find a human-readable description for the confirmation prompt
        const toolDef = AI_TOOLS.find(t => t.name === confirmCall.tool)
        const toolDesc = toolDef?.description || confirmCall.tool
        const paramSummary = confirmCall.tool === 'delete_task'
          ? `task "${confirmCall.parameters.taskId}"`
          : confirmCall.tool === 'bulk_update_status'
            ? `${(confirmCall.parameters.taskIds as string[])?.length || 0} tasks to "${confirmCall.parameters.status}"`
            : JSON.stringify(confirmCall.parameters)

        store.appendStreamingContent(
          `\n\n**Confirmation required:** ${toolDesc} (${paramSummary})`
        )
      }

      // Build actions (including confirmation buttons if needed)
      const actions = buildMessageActions(fullContent, confirmationTools)
      store.completeStreamingMessage({ actions })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response'
      store.failStreamingMessage(errorMessage)
      console.error('[AIChat] Error:', err)
    }
  }

  // ============================================================================
  // ReAct (Reasoning + Acting) Loop
  // ============================================================================

  /**
   * Send a message using the ReAct (Reasoning + Acting) multi-step loop.
   *
   * The AI reasons about what to do, calls tools, receives results,
   * then reasons again — repeating until it provides a final answer
   * (no more tool calls) or the circuit breaker fires (MAX_REACT_STEPS).
   *
   * Only supported for cloud providers (Groq/OpenRouter) with native
   * function calling. Falls back to regular sendMessage for local providers.
   *
   * @see TASK-1237 in MASTER_PLAN.md
   */
  async function sendMessageWithReAct(
    content: string,
    options: SendMessageOptions = {}
  ): Promise<void> {
    if (!content.trim()) return
    if (store.isGenerating) return

    // Set up abort controller for this ReAct session
    const abortController = new AbortController()
    reactAbortController.value = abortController

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
      const conversationMessages: RouterChatMessage[] = await buildMessagesForAI(content)
      const taskType = options.taskType ?? inferTaskType(content)

      let stepCount = 0
      let continueLoop = true

      while (continueLoop && stepCount < MAX_REACT_STEPS) {
        // Check if aborted
        if (abortController.signal.aborted) {
          store.appendStreamingContent('\n\n---\n*ReAct loop aborted by user.*')
          break
        }

        stepCount++

        let fullContent = ''
        let nativeToolCalls: NativeToolCall[] | undefined

        // Stream the response
        for await (const chunk of router.chatStream(conversationMessages, {
          taskType,
          systemPrompt: options.systemPrompt,
          forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
          model: selectedModel.value || undefined,
          tools: buildOpenAITools(),
          toolChoice: 'auto' as const,
        })) {
          // Check abort between chunks
          if (abortController.signal.aborted) {
            break
          }
          store.appendStreamingContent(chunk.content)
          fullContent += chunk.content
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            nativeToolCalls = chunk.toolCalls
          }
        }

        // If aborted during streaming, exit
        if (abortController.signal.aborted) {
          store.appendStreamingContent('\n\n---\n*ReAct loop aborted by user.*')
          break
        }

        // Check for tool calls
        if (nativeToolCalls && nativeToolCalls.length > 0) {
          // Parse native tool calls into ToolCall format
          const toolCalls = nativeToolCalls
            .map(tc => {
              try {
                return { tool: tc.function.name, parameters: JSON.parse(tc.function.arguments) } as ToolCall
              } catch {
                return null
              }
            })
            .filter((tc): tc is ToolCall => tc !== null)
            .slice(0, MAX_TOOLS_PER_RESPONSE)

          // Separate confirmation vs immediate tools
          const immediateTools = toolCalls.filter(c => !toolRequiresConfirmation(c.tool))
          const confirmationTools = toolCalls.filter(c => toolRequiresConfirmation(c.tool))

          // Execute immediate tools
          const toolResults: ToolResult[] = []
          for (const call of immediateTools) {
            console.log(`[AIChat] ReAct step ${stepCount} - executing tool:`, call.tool, call.parameters)
            const result = await executeTool(call)
            toolResults.push(result)

            // Push undo if available
            if (result.success && result.undoAction) {
              store.pushUndoEntry({
                toolName: call.tool,
                timestamp: Date.now(),
                params: call.parameters,
                undoAction: result.undoAction,
                description: result.message,
              })
            }
          }

          // Accumulate tool results in message metadata
          const lastMsg = store.messages[store.messages.length - 1]
          if (lastMsg) {
            const existingResults = ((lastMsg.metadata as Record<string, unknown>)?.toolResults as unknown[]) || []
            lastMsg.metadata = {
              ...lastMsg.metadata,
              toolResults: [
                ...existingResults,
                ...toolResults.map((r, i) => ({
                  success: r.success,
                  message: r.message,
                  data: r.data,
                  tool: immediateTools[i]?.tool || 'unknown',
                  type: AI_TOOLS.find(t => t.name === immediateTools[i]?.tool)?.category || 'read',
                })),
              ],
            } as Record<string, unknown>
          }

          // If there are confirmation tools, stop the loop (need user input)
          if (confirmationTools.length > 0) {
            pendingConfirmation.value = confirmationTools[0]
            const toolDef = AI_TOOLS.find(t => t.name === confirmationTools[0].tool)
            const toolDesc = toolDef?.description || confirmationTools[0].tool
            store.appendStreamingContent(
              `\n\n**Confirmation required:** ${toolDesc}`
            )
            continueLoop = false
            break
          }

          // Feed tool results back to AI for next reasoning step
          conversationMessages.push({
            role: 'assistant',
            content: fullContent || '',
          })

          // Add tool results as a user message so the AI can reason about them
          const toolResultsSummary = toolResults
            .map(r => {
              const base = `[${r.success ? 'OK' : 'ERROR'}] ${r.message}`
              if (r.data) {
                // For weekly plan, include the full reasoning but cap data
                const dataStr = JSON.stringify(r.data)
                return `${base}\nData: ${dataStr.slice(0, 2000)}`
              }
              return base
            })
            .join('\n\n')

          conversationMessages.push({
            role: 'user',
            content: `Tool results:\n${toolResultsSummary}\n\nPresent the results to the user in a friendly, encouraging way. Highlight key priorities, suggest what to focus on first, and mention any overdue items that need immediate attention. Respond in the user's language.`,
          })

          // Add step indicator to streaming content
          store.appendStreamingContent(
            `\n\n---\n*Step ${stepCount}: executed ${toolResults.length} tool(s)*\n\n`
          )

        } else {
          // No native tool calls — try text-based fallback
          // Models sometimes output tool names as text instead of using the API
          const textToolCalls = parseTextToolCalls(fullContent)

          if (textToolCalls.length > 0) {
            console.log(`[AIChat] ReAct step ${stepCount} - detected ${textToolCalls.length} text-based tool call(s)`)

            // Execute text-based tool calls the same way as native ones
            const immediateTools = textToolCalls.filter(c => !toolRequiresConfirmation(c.tool))
            const confirmationTools = textToolCalls.filter(c => toolRequiresConfirmation(c.tool))

            const toolResults: ToolResult[] = []
            for (const call of immediateTools) {
              console.log(`[AIChat] ReAct step ${stepCount} - executing text-detected tool:`, call.tool, call.parameters)
              const result = await executeTool(call)
              toolResults.push(result)

              if (result.success && result.undoAction) {
                store.pushUndoEntry({
                  toolName: call.tool,
                  timestamp: Date.now(),
                  params: call.parameters,
                  undoAction: result.undoAction,
                  description: result.message,
                })
              }
            }

            // Accumulate tool results in message metadata
            const lastMsg = store.messages[store.messages.length - 1]
            if (lastMsg) {
              const existingResults = ((lastMsg.metadata as Record<string, unknown>)?.toolResults as unknown[]) || []
              lastMsg.metadata = {
                ...lastMsg.metadata,
                toolResults: [
                  ...existingResults,
                  ...toolResults.map((r, i) => ({
                    success: r.success,
                    message: r.message,
                    data: r.data,
                    tool: immediateTools[i]?.tool || 'unknown',
                    type: AI_TOOLS.find(t => t.name === immediateTools[i]?.tool)?.category || 'read',
                  })),
                ],
              } as Record<string, unknown>
            }

            if (confirmationTools.length > 0) {
              pendingConfirmation.value = confirmationTools[0]
              const toolDef = AI_TOOLS.find(t => t.name === confirmationTools[0].tool)
              const toolDesc = toolDef?.description || confirmationTools[0].tool
              store.appendStreamingContent(`\n\n**Confirmation required:** ${toolDesc}`)
              continueLoop = false
              break
            }

            // Feed results back for next reasoning step
            conversationMessages.push({ role: 'assistant', content: fullContent || '' })
            const toolResultsSummary = toolResults
              .map(r => {
                const base = `[${r.success ? 'OK' : 'ERROR'}] ${r.message}`
                if (r.data) {
                  // For weekly plan, include the full reasoning but cap data
                  const dataStr = JSON.stringify(r.data)
                  return `${base}\nData: ${dataStr.slice(0, 2000)}`
                }
                return base
              })
              .join('\n\n')
            conversationMessages.push({
              role: 'user',
              content: `Tool results:\n${toolResultsSummary}\n\nPresent the results to the user in a friendly, encouraging way. Highlight key priorities, suggest what to focus on first, and mention any overdue items that need immediate attention. Respond in the user's language.`,
            })

            // Strip the raw tool call text from the displayed message
            const lastMsgClean = store.messages[store.messages.length - 1]
            if (lastMsgClean && lastMsgClean.isStreaming) {
              lastMsgClean.content = stripTextToolCalls(lastMsgClean.content || '')
              store.streamingContent = lastMsgClean.content
            }

            store.appendStreamingContent(`\n\n---\n*Step ${stepCount}: executed ${toolResults.length} tool(s)*\n\n`)
          } else {
            // Truly no tool calls = final answer, exit loop
            continueLoop = false
          }
        }
      }

      // If we hit the circuit breaker
      if (stepCount >= MAX_REACT_STEPS && continueLoop) {
        store.appendStreamingContent(
          `\n\n---\n*Reached maximum reasoning steps (${MAX_REACT_STEPS}). Stopping.*`
        )
      }

      // Clean up: strip any lingering tool blocks from the final message
      const lastMsg = store.messages[store.messages.length - 1]
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.content = stripToolBlocks(lastMsg.content || '')
      }

      store.completeStreamingMessage()

      // Update provider badge
      try {
        const currentRouter = await getRouter()
        const lastUsed = currentRouter.getLastUsedProvider()
        if (lastUsed) activeProviderRef.value = lastUsed
      } catch { /* ignore */ }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response'
      store.failStreamingMessage(errorMessage)
      console.error('[AIChat] ReAct error:', err)
    } finally {
      // Clean up abort controller
      if (reactAbortController.value === abortController) {
        reactAbortController.value = null
      }
    }
  }

  /**
   * Build action buttons for a message, including confirmation buttons and
   * content-based actions wired to real tools.
   */
  function buildMessageActions(
    content: string,
    confirmationTools: ToolCall[]
  ): ChatAction[] | undefined {
    const actions: ChatAction[] = []

    // Confirmation actions for destructive tools
    if (confirmationTools.length > 0) {
      actions.push({
        id: 'confirm_action',
        label: 'Confirm',
        variant: 'danger',
        handler: async () => {
          await confirmPendingAction()
        },
      })
      actions.push({
        id: 'cancel_action',
        label: 'Cancel',
        variant: 'secondary',
        handler: async () => {
          cancelPendingAction()
        },
      })
    }

    // Content-based actions wired to real tools
    const parsedActions = parseActionsFromResponse(content)
    if (parsedActions) {
      actions.push(...parsedActions)
    }

    return actions.length > 0 ? actions : undefined
  }

  /**
   * Confirm and execute the pending destructive tool action.
   */
  async function confirmPendingAction(): Promise<void> {
    const call = pendingConfirmation.value
    if (!call) return

    pendingConfirmation.value = null

    // Force confirmed=true for destructive tools
    const confirmedCall: ToolCall = {
      tool: call.tool,
      parameters: { ...call.parameters, confirmed: true },
    }

    console.log('[AIChat] Executing confirmed tool:', confirmedCall.tool, confirmedCall.parameters)
    const result = await executeTool(confirmedCall)
    console.log('[AIChat] Confirmed tool result:', result)

    if (result.success && result.undoAction) {
      store.pushUndoEntry({
        toolName: call.tool,
        timestamp: Date.now(),
        params: call.parameters,
        undoAction: result.undoAction,
        description: result.message,
      })
    }

    // Add result message to chat
    store.addAssistantMessage(
      result.success ? result.message : `Error: ${result.message}`
    )
  }

  /**
   * Cancel the pending destructive tool action.
   */
  function cancelPendingAction(): void {
    pendingConfirmation.value = null
    store.addAssistantMessage('Action cancelled.')
  }

  /**
   * Infer task type is no longer used for routing — the model decides via native tool calling.
   * Kept only for provider selection hints (local vs cloud preference).
   */
  function inferTaskType(_content: string): TaskType {
    return 'chat'
  }

  /**
   * Parse action buttons from AI response.
   * Actions are wired to real tool calls (create_subtasks, create_group).
   */
  function parseActionsFromResponse(content: string): ChatAction[] | undefined {
    const actions: ChatAction[] = []

    // Check for task breakdown patterns - wire to create_subtasks tool
    if (content.includes('subtask') || content.includes('breakdown')) {
      actions.push({
        id: 'create_subtasks',
        label: 'Create Subtasks',
        variant: 'primary',
        handler: async () => {
          const selectedTask = store.context.selectedTask
          if (!selectedTask) {
            store.addAssistantMessage('Please select a task first to create subtasks for.')
            return
          }

          // Parse subtask titles from the AI response
          // Look for numbered lists (1. Title, 2. Title, etc.) or bullet points (- Title)
          const subtaskTitles = parseSubtaskTitlesFromContent(content)
          if (subtaskTitles.length === 0) {
            store.addAssistantMessage('Could not find subtask suggestions in the response. Try asking again.')
            return
          }

          const call: ToolCall = {
            tool: 'create_subtasks',
            parameters: {
              parentTaskId: selectedTask.id,
              subtasks: subtaskTitles.map(title => ({ title })),
            },
          }

          const result = await executeTool(call)
          store.addAssistantMessage(
            result.success ? result.message : `Error: ${result.message}`
          )
        },
      })
    }

    // Check for grouping patterns - wire to create_group tool
    if (content.includes('group') && content.includes('suggest')) {
      actions.push({
        id: 'create_group',
        label: 'Create Group',
        variant: 'primary',
        handler: async () => {
          // Parse group name from the AI response
          const groupName = parseGroupNameFromContent(content)
          if (!groupName) {
            store.addAssistantMessage('Could not determine a group name from the suggestion. Try asking again.')
            return
          }

          const call: ToolCall = {
            tool: 'create_group',
            parameters: { name: groupName },
          }

          const result = await executeTool(call)
          store.addAssistantMessage(
            result.success ? result.message : `Error: ${result.message}`
          )
        },
      })
    }

    return actions.length > 0 ? actions : undefined
  }

  /**
   * Extract subtask titles from AI response content.
   * Looks for numbered lists (1. Title) or bullet points (- Title).
   */
  function parseSubtaskTitlesFromContent(content: string): string[] {
    const titles: string[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      // Match "1. Title", "2. Title", etc.
      const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)/)
      // Match "- Title" or "* Title"
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)/)

      const match = numberedMatch || bulletMatch
      if (match) {
        // Clean up: remove trailing punctuation, markdown bold, etc.
        const title = match[1].replace(/\*\*/g, '').trim()
        // Skip lines that look like descriptions rather than titles (too long)
        if (title.length > 0 && title.length <= 120) {
          titles.push(title)
        }
      }
    }

    return titles
  }

  /**
   * Extract a group name from AI response content.
   * Looks for quoted names or bold text near "group" keyword.
   */
  function parseGroupNameFromContent(content: string): string | null {
    // Try: "group called "Name"" or "group: "Name""
    const quotedMatch = content.match(/group\s*(?:called|named|:)\s*[""](.+?)[""]/i)
    if (quotedMatch) return quotedMatch[1]

    // Try: bold text near "group" keyword ("**Name**")
    const boldMatch = content.match(/group.*?\*\*(.+?)\*\*/i)
    if (boldMatch) return boldMatch[1]

    // Try: first quoted string in the response
    const anyQuoted = content.match(/[""](.+?)[""]/i)
    if (anyQuoted) return anyQuoted[1]

    return null
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
    await executeAgentChain('plan_my_week')
  }

  /**
   * Execute a tool directly (bypassing AI).
   * Used for quick actions that map 1:1 to a tool.
   */
  async function executeDirectTool(label: string, toolCall: ToolCall): Promise<void> {
    if (!toolCall) return

    // Add user message to show action
    store.addUserMessage(label)

    // Start assistant response
    store.startStreamingMessage()
    store.appendStreamingContent(`Executing ${label}...`)

    try {
      console.log('[AIChat] Executing direct tool:', toolCall.tool, toolCall.parameters)
      const result = await executeTool(toolCall)
      console.log('[AIChat] Direct tool result:', result)

      if (result.success && result.undoAction) {
        store.pushUndoEntry({
          toolName: toolCall.tool,
          timestamp: Date.now(),
          params: toolCall.parameters,
          undoAction: result.undoAction,
          description: result.message,
        })
      }

      // Update message with result
      const resultMsg = result.success ? result.message : `Error: ${result.message}`
      store.appendStreamingContent(`\n\n${resultMsg}`)

      // Add tool result metadata
      const lastMsg = store.messages[store.messages.length - 1]
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.metadata = {
          ...lastMsg.metadata,
          toolResults: [{
            success: result.success,
            message: result.message,
            data: result.data,
            tool: toolCall.tool,
            type: AI_TOOLS.find(t => t.name === toolCall.tool)?.category || 'read',
          }],
        } as any
      }

      store.completeStreamingMessage()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Action failed'
      store.failStreamingMessage(errorMessage)
    }
  }

  // ============================================================================
  // Agent Chains
  // ============================================================================

  /**
   * Execute a predefined agent chain.
   * Runs tool steps sequentially, shows progress, and sends final prompt to AI.
   */
  async function executeAgentChain(chainId: string): Promise<void> {
    if (store.isGenerating) return

    const chain = agentChains.chains.find((c) => c.id === chainId)
    if (!chain) {
      store.addAssistantMessage(`Chain not found: ${chainId}`)
      return
    }

    // Clear input and add user message
    store.inputText = ''
    store.clearError()
    store.addUserMessage(chain.name)

    // Start streaming message to show progress
    store.startStreamingMessage()

    try {
      // Execute the chain
      console.log(`[AIChat] Starting agent chain: ${chain.name}`)
      const { results, finalPrompt } = await agentChains.executeChain(chainId)

      // Show tool results as they come in (add to message metadata)
      const lastMsg = store.messages[store.messages.length - 1]
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.metadata = {
          ...lastMsg.metadata,
          toolResults: results.map((r, i) => {
            const step = chain.steps[i]
            const toolName = step.type === 'tool' ? step.tool : 'prompt'
            return {
              success: r.success,
              message: r.message,
              data: r.data,
              tool: toolName || 'unknown',
              type: 'read' as const,
            }
          }),
        } as any
      }

      // If there's a final prompt, send it to the AI
      if (finalPrompt) {
        // Update streaming content with a loading message
        store.appendStreamingContent('Analyzing results...')

        // Send the prompt through the AI
        const router = await getRouter()
        const aiMessages: RouterChatMessage[] = [
          { role: 'system', content: 'You are FlowState AI, a friendly productivity assistant. Respond concisely.' },
          { role: 'user', content: finalPrompt },
        ]

        let fullResponse = ''
        for await (const chunk of router.chatStream(aiMessages, {
          taskType: 'chat',
          forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
          model: selectedModel.value || undefined,
        })) {
          fullResponse += chunk.content
        }

        // Replace loading message with AI response
        const cleanResponse = stripToolBlocks(fullResponse)
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = cleanResponse
          store.streamingContent = cleanResponse
        }
      } else {
        // No final prompt — just show tool results
        const summary = `Completed chain "${chain.name}" with ${results.length} steps.`
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = summary
          store.streamingContent = summary
        }
      }

      store.completeStreamingMessage()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Chain execution failed'
      store.failStreamingMessage(errorMessage)
      console.error('[AIChat] Agent chain error:', err)
    }
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
   * Persists the selection to localStorage via the store.
   */
  async function setProvider(provider: 'ollama' | 'groq' | 'openrouter' | 'auto') {
    // Save current model for the outgoing provider
    providerModelMemory.value[selectedProvider.value] = selectedModel.value

    // Switch provider
    selectedProvider.value = provider

    // Restore saved model for the incoming provider (or null if none saved)
    selectedModel.value = providerModelMemory.value[provider] ?? null

    store.updatePersistedSettings({
      provider,
      model: selectedModel.value || '',
    })

    // Update active provider badge
    if (provider === 'auto') {
      try {
        const router = await getRouter()
        const detectedProvider = await router.getActiveProvider()
        activeProviderRef.value = detectedProvider
      } catch {
        activeProviderRef.value = null
      }
    } else {
      activeProviderRef.value = provider
    }

    if (provider === 'ollama' && availableOllamaModels.value.length === 0) {
      refreshOllamaModels()
    }
  }

  /**
   * Set the model to use (null = default for provider).
   * Persists the selection to localStorage via the store.
   */
  function setModel(model: string | null) {
    selectedModel.value = model
    store.updatePersistedSettings({
      provider: selectedProvider.value,
      model: model || '',
    })
  }

  /**
   * Initialize the AI chat system.
   * Loads persisted provider/model settings from store.
   */
  async function initialize() {
    store.initialize()

    // Load persisted settings
    const savedSettings = store.getPersistedSettings()
    if (savedSettings) {
      if (['ollama', 'groq', 'openrouter', 'auto'].includes(savedSettings.provider)) {
        selectedProvider.value = savedSettings.provider as typeof selectedProvider.value
      }
      if (savedSettings.model) {
        // Validate persisted model matches persisted provider
        // Groq models contain '-' and numbers (e.g. llama-3.3-70b-versatile)
        // Ollama models contain ':' (e.g. llama3.2:latest)
        const model = savedSettings.model
        const provider = selectedProvider.value
        const looksLikeOllama = model.includes(':')
        const looksLikeGroq = /\d/.test(model) && model.includes('-') && !model.includes(':')

        if (provider === 'groq' && looksLikeOllama) {
          // Ollama model persisted but provider is Groq — reset
          selectedModel.value = null
        } else if (provider === 'ollama' && looksLikeGroq) {
          // Groq model persisted but provider is Ollama — reset
          selectedModel.value = null
        } else {
          selectedModel.value = model
        }
      }
    }

    // Pre-initialize the router
    try {
      const routerInstance = await getRouter()
      // Only auto-detect active provider when in auto mode.
      // If user explicitly selected a provider, respect their choice.
      if (selectedProvider.value === 'auto') {
        const provider = await routerInstance!.getActiveProvider()
        activeProviderRef.value = provider
      } else {
        activeProviderRef.value = selectedProvider.value
      }
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

    // Confirmation flow
    pendingConfirmation,
    confirmPendingAction,
    cancelPendingAction,

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
    sendMessageWithReAct,
    abortReAct,
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

    // Personality
    aiPersonality,
    setPersonality,

    // Agent chains
    executeAgentChain,
    agentChains: agentChains.chains,
    chainExecution: agentChains.currentExecution,
    abortChain: agentChains.abortChain,

    // Chat Direction
    chatDirection,
    setChatDirection: store.setChatDirection,

    // Lifecycle
    initialize,
    handleKeyboardShortcut,
    executeDirectTool
  }
}
