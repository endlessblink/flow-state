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

          const sections: string[] = []
          sections.push('Create a short, personalized daily plan. Write ONE connecting sentence per section. Do NOT repeat the facts — they are shown below and the user can see them.')
          sections.push('')

          // Pre-digested overdue section
          if (overdue && Array.isArray(overdue) && overdue.length > 0) {
            sections.push(`## OVERDUE (${overdue.length} tasks need attention):`)
            for (const t of overdue.slice(0, 5)) {
              const days = t.daysOverdue || '?'
              const pri = t.priority ? ` [${t.priority}]` : ''
              sections.push(`- "${t.title}" — ${days} days late${pri}`)
            }
            sections.push('→ Write 1 sentence about urgency.')
          } else {
            sections.push('## No overdue tasks — good!')
          }

          sections.push('')

          // Pre-digested today section
          if (summary) {
            const due = summary.dueToday ?? summary.tasksDueToday ?? 0
            const done = summary.completedToday ?? 0
            const inProg = summary.inProgress ?? 0
            sections.push(`## TODAY: ${due} due, ${done} completed, ${inProg} in progress`)
          }

          sections.push('')

          // Pre-digested suggestions
          if (suggested && Array.isArray(suggested) && suggested.length > 0) {
            sections.push('## RECOMMENDED ORDER:')
            for (let i = 0; i < Math.min(suggested.length, 3); i++) {
              const t = suggested[i]
              sections.push(`${i + 1}. "${t.title}"${t.reason ? ` — ${t.reason}` : ''}${t.estimatedMinutes ? ` (~${t.estimatedMinutes}min)` : ''}`)
            }
            sections.push('→ Write 1 sentence motivating the user to start with #1.')
          }

          return sections.join('\n')
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

          const sections: string[] = []
          sections.push('Write a 3-sentence end-of-day summary. Use the FACTS below — do NOT invent numbers.')
          sections.push('')

          // Pre-digested stats
          if (stats) {
            const completed = stats.todayCompleted ?? stats.completedToday ?? 0
            const pomodoros = stats.todayPomodoros ?? stats.pomodorosToday ?? 0
            const streak = stats.currentStreak ?? 0
            sections.push(`## ACCOMPLISHMENTS: ${completed} tasks completed, ${pomodoros} pomodoros${streak > 0 ? `, ${streak}-day streak` : ''}`)

            if (stats.statusBreakdown) {
              const sb = stats.statusBreakdown
              const total = Object.values(sb).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0)
              const remaining = total - (sb.done || 0)
              sections.push(`## REMAINING: ${remaining} tasks still open out of ${total} total`)
            }
          }

          sections.push('')

          // Weekly context
          if (weekly) {
            const weekCompleted = weekly.completedThisWeek ?? 0
            const focusMins = weekly.totalFocusMinutes ?? 0
            const focusHrs = Math.floor(focusMins / 60)
            const focusRemMins = focusMins % 60
            sections.push(`## WEEK SO FAR: ${weekCompleted} tasks done, ${focusHrs}h ${focusRemMins}m focus time`)
          }

          sections.push('')

          // Gamification
          if (gamification) {
            const level = gamification.level ?? gamification.currentLevel ?? '?'
            const xp = gamification.xp ?? gamification.currentXP ?? 0
            sections.push(`## LEVEL: ${level} (${xp} XP)`)
          }

          sections.push('')
          sections.push('→ Sentence 1: Summarize what was accomplished today (use specific numbers).')
          sections.push('→ Sentence 2: Note what carries over to tomorrow.')
          sections.push('→ Sentence 3: Brief motivational close referencing their streak or level.')

          return sections.join('\n')
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

          const sections: string[] = []
          sections.push('Present this weekly plan briefly. The detailed plan card renders below your message, so keep your text SHORT (3-4 sentences max).')
          sections.push('CRITICAL: Respond in the SAME LANGUAGE the user\'s app is in.')
          sections.push('')

          // Pre-digested situation
          if (overdue && Array.isArray(overdue) && overdue.length > 0) {
            sections.push(`## OVERDUE (address first): ${overdue.length} tasks`)
            for (const t of overdue.slice(0, 3)) {
              sections.push(`- "${t.title}" — ${t.daysOverdue || '?'} days late`)
            }
          }

          if (daily) {
            sections.push(`## TODAY: ${daily.dueToday || 0} due, ${daily.completedToday || 0} done, ${daily.inProgress || 0} in progress`)
          }

          sections.push('')

          // Pre-digested plan summary (don't dump the full JSON)
          if (weeklyPlan && typeof weeklyPlan === 'object') {
            const plan = weeklyPlan.plan || weeklyPlan
            if (plan && typeof plan === 'object') {
              const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
              let totalPlanned = 0
              for (const day of days) {
                const dayTasks = plan[day]
                if (Array.isArray(dayTasks)) {
                  totalPlanned += dayTasks.length
                }
              }
              sections.push(`## PLAN: ${totalPlanned} tasks distributed across the week`)
              if (weeklyPlan.reasoning) {
                sections.push(`Reasoning: ${typeof weeklyPlan.reasoning === 'string' ? weeklyPlan.reasoning.slice(0, 200) : ''}`)
              }
            }
          } else {
            sections.push('## Plan generation failed — tell the user to try again.')
          }

          sections.push('')
          sections.push('→ Sentence 1: Highlight any overdue tasks that need immediate attention.')
          sections.push('→ Sentence 2: Summarize the distribution (e.g., "X tasks spread across 5 days").')
          sections.push('→ Sentence 3: Brief motivational close.')

          return sections.join('\n')
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
