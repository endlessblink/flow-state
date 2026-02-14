/**
 * Agent Chains - Deterministic Multi-Step AI Workflows
 *
 * Predefined sequences of tool calls + AI prompts that work reliably
 * with ALL providers including Ollama (no native function calling needed).
 *
 * Unlike free-form chat, these follow a fixed script:
 * 1. Execute tool calls in sequence
 * 2. Build final prompt from tool results
 * 3. Return prompt for AI to process
 *
 * @see TASK-1236 in MASTER_PLAN.md
 */

import { ref } from 'vue'
import { executeTool, type ToolCall, type ToolResult } from '@/services/ai/tools'

// ============================================================================
// Types
// ============================================================================

export interface AgentChain {
  id: string
  name: string
  description: string
  icon: string // lucide icon name
  steps: AgentChainStep[]
}

export interface AgentChainStep {
  type: 'tool' | 'prompt'
  // For 'tool' type:
  tool?: string
  parameters?: Record<string, unknown>
  /** Extract data from previous step results. Receives all prior results. */
  parametersFn?: (priorResults: ToolResult[]) => Record<string, unknown> | null
  // For 'prompt' type:
  promptFn?: (priorResults: ToolResult[]) => string
  /** If true, skip this step if parametersFn returns null */
  optional?: boolean
}

export interface ChainExecution {
  chainId: string
  isRunning: boolean
  currentStep: number
  totalSteps: number
  results: ToolResult[]
  error: string | null
}

// ============================================================================
// Chain Definitions
// ============================================================================

const chains: AgentChain[] = [
  // ── Chain 1: Plan My Day ──────────────────────────────────────────────
  {
    id: 'plan_my_day',
    name: 'Plan My Day',
    description: 'Get a prioritized plan for today based on your tasks and schedule',
    icon: 'Calendar',
    steps: [
      {
        type: 'tool',
        tool: 'get_daily_summary',
        parameters: {},
      },
      {
        type: 'tool',
        tool: 'get_overdue_tasks',
        parameters: {},
      },
      {
        type: 'tool',
        tool: 'suggest_next_task',
        parameters: {},
      },
      {
        type: 'prompt',
        promptFn: (results) => {
          const summary = results[0]?.data as any
          const overdue = results[1]?.data as any
          const suggested = results[2]?.data as any

          const parts = [
            'Based on today\'s data, create a prioritized plan for my day. Be concise and actionable. Use bullet points.',
            '',
            '## Today\'s Summary',
            summary ? JSON.stringify(summary, null, 2) : 'No summary available',
            '',
            '## Overdue Tasks',
            overdue && Array.isArray(overdue) && overdue.length > 0
              ? overdue.map((t: any) => `- ${t.title} (due: ${t.dueDate}, ${t.daysOverdue} days overdue)`).join('\n')
              : 'No overdue tasks',
            '',
            '## Suggested Next Tasks',
            suggested && Array.isArray(suggested) && suggested.length > 0
              ? suggested.map((t: any) => `- ${t.title} (${t.reason}, priority: ${t.priority})`).join('\n')
              : 'No suggestions available',
          ]

          return parts.join('\n')
        },
      },
    ],
  },

  // ── Chain 2: End of Day Review ────────────────────────────────────────
  {
    id: 'end_of_day_review',
    name: 'End of Day Review',
    description: 'Summarize what you accomplished today and what\'s left',
    icon: 'Sunset',
    steps: [
      {
        type: 'tool',
        tool: 'get_productivity_stats',
        parameters: {},
      },
      {
        type: 'tool',
        tool: 'get_weekly_summary',
        parameters: {},
      },
      {
        type: 'tool',
        tool: 'get_gamification_status',
        parameters: {},
      },
      {
        type: 'prompt',
        promptFn: (results) => {
          const stats = results[0]?.data as any
          const weekly = results[1]?.data as any
          const gamification = results[2]?.data as any

          const parts = [
            'Summarize my day: what I accomplished, what\'s left, and give me a motivational note. Keep it brief (2-3 sentences).',
            '',
            '## Today\'s Stats',
            stats ? JSON.stringify(stats, null, 2) : 'No stats available',
            '',
            '## Weekly Summary',
            weekly ? JSON.stringify(weekly, null, 2) : 'No weekly data available',
            '',
            '## Gamification Status',
            gamification ? JSON.stringify(gamification, null, 2) : 'No gamification data available',
          ]

          return parts.join('\n')
        },
      },
    ],
  },

  // ── Chain 3: Focus Mode Setup ─────────────────────────────────────────
  {
    id: 'focus_mode_setup',
    name: 'Focus Mode Setup',
    description: 'Find your top task and start a focus session with a pep talk',
    icon: 'Target',
    steps: [
      {
        type: 'tool',
        tool: 'suggest_next_task',
        parameters: {},
      },
      {
        type: 'tool',
        tool: 'start_timer',
        parametersFn: (priorResults) => {
          const suggestion = priorResults[0]?.data as any
          if (!suggestion || !Array.isArray(suggestion) || suggestion.length === 0) {
            return null // No task found → skip timer start
          }
          const topTask = suggestion[0]
          return { taskId: topTask.id, duration: 25 }
        },
        optional: true,
      },
      {
        type: 'prompt',
        promptFn: (priorResults) => {
          const suggestion = priorResults[0]?.data as any
          const timerResult = priorResults[1] // might be null if skipped

          if (!suggestion || !Array.isArray(suggestion) || suggestion.length === 0) {
            return 'You don\'t have any actionable tasks right now. Take a break or create some new tasks to work on!'
          }

          const topTask = suggestion[0]
          const taskTitle = topTask.title

          if (timerResult?.success) {
            return `I've started a focus session on "${taskTitle}". Give me a 2-sentence pep talk to stay focused and crush this task.`
          } else {
            return `Your top priority task is "${taskTitle}". Give me a 2-sentence pep talk to get started on it.`
          }
        },
      },
    ],
  },

  // ── Chain 4: Plan My Week ──────────────────────────────────────────────
  {
    id: 'plan_my_week',
    name: 'Plan My Week',
    description: 'Generate an AI-powered weekly plan distributing your tasks across the week',
    icon: 'CalendarDays',
    steps: [
      {
        type: 'tool',
        tool: 'get_overdue_tasks',
        parameters: {},
      },
      {
        type: 'tool',
        tool: 'get_daily_summary',
        parameters: {},
      },
      {
        type: 'tool',
        tool: 'generate_weekly_plan',
        parameters: {},
      },
      {
        type: 'prompt',
        promptFn: (results) => {
          const overdue = results[0]?.data as any
          const daily = results[1]?.data as any
          const weeklyPlan = results[2]?.data as any

          const parts = [
            'Present this weekly plan to the user in a friendly, encouraging way.',
            'CRITICAL: Respond in the SAME LANGUAGE the user\'s app is in. If context suggests Hebrew, respond in Hebrew.',
            '',
            '## Current Situation',
            overdue && Array.isArray(overdue) && overdue.length > 0
              ? `${overdue.length} overdue tasks need attention`
              : 'No overdue tasks',
            daily ? `Today: ${daily.dueToday || 0} due, ${daily.completedToday || 0} completed, ${daily.inProgress || 0} in progress` : '',
            '',
            '## Weekly Plan',
            weeklyPlan ? JSON.stringify(weeklyPlan, null, 2) : 'Plan generation failed',
            '',
            'Instructions:',
            '- Summarize the plan day-by-day with task names',
            '- Highlight overdue tasks that need priority attention',
            '- Add a brief motivational note',
            '- Keep it concise — the detailed plan card renders below your message',
          ]

          return parts.join('\n')
        },
      },
    ],
  },
]

// ============================================================================
// Composable
// ============================================================================

export function useAgentChains() {
  const currentExecution = ref<ChainExecution | null>(null)
  const abortController = ref<AbortController | null>(null)

  /**
   * Execute an agent chain by ID.
   * Returns tool results and final prompt for the AI to process.
   */
  async function executeChain(chainId: string): Promise<{
    results: ToolResult[]
    finalPrompt: string | null
  }> {
    const chain = chains.find((c) => c.id === chainId)
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`)
    }

    // Initialize execution state
    currentExecution.value = {
      chainId,
      isRunning: true,
      currentStep: 0,
      totalSteps: chain.steps.length,
      results: [],
      error: null,
    }

    // Create abort controller
    abortController.value = new AbortController()

    const results: ToolResult[] = []
    let finalPrompt: string | null = null

    try {
      for (let i = 0; i < chain.steps.length; i++) {
        // Check for abort
        if (abortController.value.signal.aborted) {
          currentExecution.value.error = 'Chain aborted by user'
          break
        }

        currentExecution.value.currentStep = i + 1

        const step = chain.steps[i]

        if (step.type === 'tool') {
          // Build tool call parameters
          let parameters = step.parameters || {}
          if (step.parametersFn) {
            const dynamicParams = step.parametersFn(results)
            if (dynamicParams === null && step.optional) {
              // Skip optional step if parametersFn returns null
              console.log(`[AgentChains] Skipping optional step ${i + 1}: ${step.tool}`)
              results.push({
                success: true,
                message: `Skipped optional step: ${step.tool}`,
                data: null,
              })
              continue
            }
            parameters = dynamicParams || {}
          }

          // Execute tool
          const call: ToolCall = {
            tool: step.tool!,
            parameters,
          }

          console.log(`[AgentChains] Executing step ${i + 1}/${chain.steps.length}:`, call.tool, call.parameters)
          const result = await executeTool(call)
          console.log(`[AgentChains] Step ${i + 1} result:`, result)

          results.push(result)

          // Stop execution if tool failed (unless optional)
          if (!result.success && !step.optional) {
            currentExecution.value.error = `Tool execution failed: ${result.message}`
            break
          }
        } else if (step.type === 'prompt') {
          // Build final prompt from results
          if (step.promptFn) {
            finalPrompt = step.promptFn(results)
            console.log(`[AgentChains] Generated final prompt:`, finalPrompt.substring(0, 200) + '...')
          }
        }
      }

      currentExecution.value.results = results
      currentExecution.value.isRunning = false

      return { results, finalPrompt }
    } catch (error) {
      currentExecution.value.error = error instanceof Error ? error.message : 'Unknown error'
      currentExecution.value.isRunning = false
      throw error
    } finally {
      abortController.value = null
    }
  }

  /**
   * Abort the currently running chain.
   */
  function abortChain() {
    if (abortController.value) {
      abortController.value.abort()
    }
  }

  return {
    chains,
    currentExecution,
    executeChain,
    abortChain,
  }
}
