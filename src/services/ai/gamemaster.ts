/**
 * ARIA Game Master Service for Cyberflow RPG
 * FEATURE-1132: AI-driven challenge generation
 *
 * ARIA (Autonomous Runtime Intelligence Agent) is the Game Master AI
 * that generates personalized daily missions and weekly boss fights
 * based on user behavior and stats.
 */

import type { ChatMessage } from './types'
import type {
  ChallengeGenerationContext,
  ChallengeDifficulty,
  AIGeneratedChallenge,
  AIGenerateChallengesResponse,
  ChallengeObjective,
} from '@/types/challenges'
import {
  generateDailyChallengesFromTemplates,
  generateBossFightFromTemplate,
  type TemplateGenerationContext,
} from './challengeTemplates'

// =============================================================================
// ARIA Persona
// =============================================================================

/**
 * Build ARIA's system prompt for challenge generation
 */
function buildARIASystemPrompt(): string {
  return `You are ARIA (Autonomous Runtime Intelligence Agent), the Game Master AI for a cyberpunk productivity RPG called Cyberflow.

Your role is to generate personalized daily missions and weekly boss fights for netrunners (users) based on their productivity patterns.

PERSONALITY:
- Ship's computer aesthetic (think HAL 9000 meets Cortana)
- Short, punchy sentences
- Technical jargon mixed with game terms
- Use "netrunner" for the player, "Grid" for their workspace
- "Sectors" for projects, "hacks" for tasks, "data packets" for work items
- Be encouraging but not sycophantic
- Create urgency without stress

VALID OBJECTIVE TYPES (you MUST use ONLY these):
- complete_tasks: Complete N tasks
- complete_pomodoros: Complete N pomodoro sessions
- clear_overdue: Clear N overdue tasks
- focus_time_minutes: Accumulate N minutes of focus time
- complete_high_priority: Complete N high-priority tasks
- complete_project_tasks: Complete N tasks in a specific project (include project_name)
- complete_before_hour: Complete N tasks before a specific hour (include hour, 1-24)
- complete_variety: Complete tasks across N different projects

OBJECTIVE CONSTRAINTS:
- complete_tasks: 1-10
- complete_pomodoros: 1-6
- clear_overdue: 1-5
- focus_time_minutes: 15-120
- complete_high_priority: 1-3
- complete_project_tasks: 1-5
- complete_before_hour: 1-3
- complete_variety: 2-4

XP REWARDS BY DIFFICULTY:
- easy: 15-30 XP
- normal: 25-50 XP
- hard: 40-75 XP
- boss: 100-200 XP

RULES:
1. Generate EXACTLY the number of missions requested
2. Use DIVERSE objective types (don't repeat the same type)
3. Scale objective_target based on user's patterns and difficulty
4. Make titles creative but short (max 50 chars)
5. Descriptions should be max 150 chars
6. narrative_flavor should be in ARIA's voice (max 100 chars)
7. Respond ONLY with valid JSON - no markdown, no code fences, no explanations

OUTPUT FORMAT:
{
  "daily_missions": [
    {
      "title": "string",
      "description": "string",
      "objective_type": "string (from allowed list)",
      "objective_target": number,
      "reward_xp": number,
      "penalty_xp": number,
      "difficulty": "easy|normal|hard",
      "narrative_flavor": "string"
    }
  ]
}`
}

/**
 * Build ARIA's system prompt for boss fight generation
 */
function buildBossSystemPrompt(): string {
  return `You are ARIA (Autonomous Runtime Intelligence Agent), the Game Master AI for Cyberflow RPG.

Generate a WEEKLY BOSS FIGHT. Bosses are major challenges that take a full week to defeat.

BOSS PERSONALITY IDEAS:
- THE PROCRASTINATOR: Born from neglected tasks
- SCOPE CREEP: Ever-expanding nightmare
- THE DISTRACTION DAEMON: Fragments attention
- DEADLINE REAPER: Harvests missed deadlines
- BURNOUT BEAST: Drains energy
- ENTROPY INCARNATE: Embodiment of chaos
- THE BLOCKER: Immovable obstacle
- ANALYSIS PARALYSIS: Freezes decisions

Create a unique boss with:
- Threatening name (ALL CAPS)
- Menacing description (what it represents)
- How to defeat it (via objectives)
- Total HP (sum of objective targets × 10)

Use objectives appropriate for a week-long battle.

OUTPUT FORMAT:
{
  "weekly_boss": {
    "title": "THE BOSS NAME",
    "description": "What this boss represents...",
    "objective_type": "complete_tasks",
    "objective_target": number (weekly target),
    "reward_xp": 100-200,
    "penalty_xp": 20-40,
    "difficulty": "boss",
    "narrative_flavor": "ARIA's warning about this boss",
    "total_hp": number,
    "special_reward": "cosmetic unlock name"
  }
}`
}

// =============================================================================
// Context Building
// =============================================================================

/**
 * Build the user context message for AI
 */
function buildContextMessage(context: ChallengeGenerationContext): string {
  return `NETRUNNER PROFILE:
- Tasks completed today: ${context.stats.tasksCompleted}
- Overdue tasks: ${context.stats.overdueCount}
- Focus time today: ${context.stats.focusTimeToday} minutes
- Pomodoros today: ${context.stats.pomodorosToday}

STREAK STATUS:
- Current streak: ${context.streak.current} days
- Longest streak: ${context.streak.longest} days
- Active today: ${context.streak.isActive ? 'Yes' : 'No'}

CORRUPTION LEVEL: ${context.corruption.level}% (${context.corruption.trend})

RECENT CHALLENGE PERFORMANCE:
- Completed: ${context.recentChallenges.completed}
- Failed: ${context.recentChallenges.failed}
- Recent types: ${context.recentChallenges.types.join(', ') || 'none'}

ACTIVE SECTORS (Projects):
${context.projects.map(p => `- ${p.name}: ${p.taskCount} tasks (${p.overdueCount} overdue)`).join('\n') || '- No active projects'}

BEHAVIORAL PATTERNS:
- Average tasks/day: ${context.patterns.averageTasksPerDay}
- Average pomodoros/day: ${context.patterns.averagePomodorosPerDay}
- Peak hours: ${context.patterns.preferredHours.join(', ') || 'unknown'}
- Top projects: ${context.patterns.topProjects.join(', ') || 'none'}

TIME CONTEXT:
- Current hour: ${context.timeContext.hour}:00
- Day: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][context.timeContext.dayOfWeek]}
- Weekend: ${context.timeContext.isWeekend ? 'Yes' : 'No'}

DIFFICULTY LEVEL: ${context.difficulty.toUpperCase()}

Generate 3 daily missions appropriate for this netrunner's profile and difficulty level.
Scale targets based on their average performance and the difficulty multiplier:
- easy: 50% of average
- normal: 100% of average
- hard: 150% of average`
}

/**
 * Build boss fight context message
 */
function buildBossContextMessage(context: ChallengeGenerationContext): string {
  return `NETRUNNER WEEKLY STATS:
- Average tasks/day: ${context.patterns.averageTasksPerDay}
- Average pomodoros/day: ${context.patterns.averagePomodorosPerDay}
- Projected weekly capacity: ~${Math.round(context.patterns.averageTasksPerDay * 7)} tasks

CURRENT STATE:
- Corruption level: ${context.corruption.level}%
- Streak: ${context.streak.current} days
- Overdue tasks: ${context.stats.overdueCount}

Generate a WEEKLY BOSS FIGHT. The boss should:
1. Have a thematic name related to productivity challenges
2. Be defeatable with ~${Math.round(context.patterns.averageTasksPerDay * 7 * 1.5)} task completions over 7 days
3. Offer 150-200 XP reward
4. Have total HP = objective_target × 10`
}

// =============================================================================
// Difficulty Calculation
// =============================================================================

/**
 * Calculate difficulty based on recent challenge completion rate
 */
export function calculateDifficulty(
  completedCount: number,
  failedCount: number
): ChallengeDifficulty {
  const total = completedCount + failedCount
  if (total === 0) return 'normal' // New user

  const completionRate = completedCount / total

  if (completionRate < 0.4) return 'easy'
  if (completionRate < 0.7) return 'normal'
  if (completionRate < 0.9) return 'hard'
  return 'boss' // 90%+ completion rate
}

// =============================================================================
// JSON Parsing
// =============================================================================

/**
 * Safely parse AI response as JSON
 * Handles markdown code fences and partial JSON
 */
function parseAIResponse(content: string): unknown {
  // Remove markdown code fences if present
  let cleaned = content.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  try {
    return JSON.parse(cleaned)
  } catch (e) {
    // Try to find JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch {
        // Fall through
      }
    }
    throw new Error(`Failed to parse AI response as JSON: ${e}`)
  }
}

/**
 * Validate and sanitize AI-generated challenge
 */
function validateChallenge(
  challenge: Record<string, unknown>,
  difficulty: ChallengeDifficulty
): AIGeneratedChallenge | null {
  const validTypes: ChallengeObjective[] = [
    'complete_tasks',
    'complete_pomodoros',
    'clear_overdue',
    'focus_time_minutes',
    'complete_high_priority',
    'complete_project_tasks',
    'complete_before_hour',
    'complete_variety',
  ]

  const objectiveType = challenge.objective_type as ChallengeObjective
  if (!validTypes.includes(objectiveType)) {
    console.warn(`[GameMaster] Invalid objective type: ${objectiveType}`)
    return null
  }

  const title = String(challenge.title || 'Untitled Mission').slice(0, 50)
  const description = String(challenge.description || 'Complete the objective.').slice(0, 150)
  const narrativeFlavor = String(challenge.narrative_flavor || 'The Grid awaits.').slice(0, 100)

  const objectiveTarget = Math.max(1, Math.round(Number(challenge.objective_target) || 1))
  const rewardXp = Math.max(10, Math.min(200, Math.round(Number(challenge.reward_xp) || 25)))
  const penaltyXp = Math.max(0, Math.min(50, Math.round(Number(challenge.penalty_xp) || 0)))

  return {
    title,
    description,
    objective_type: objectiveType,
    objective_target: objectiveTarget,
    reward_xp: rewardXp,
    penalty_xp: penaltyXp,
    difficulty,
    narrative_flavor: narrativeFlavor,
    project_name: challenge.project_name as string | undefined,
    hour: challenge.hour as number | undefined,
  }
}

// =============================================================================
// Main API
// =============================================================================

export interface GameMasterOptions {
  /** AI router chat function */
  chat: (messages: ChatMessage[], options?: { taskType?: string }) => Promise<{ content: string }>
  /** Whether AI is available */
  aiAvailable: boolean
}

/**
 * Generate daily challenges using AI or fallback templates
 */
export async function generateDailyChallenges(
  context: ChallengeGenerationContext,
  options: GameMasterOptions
): Promise<AIGeneratedChallenge[]> {
  // Try AI generation first
  if (options.aiAvailable) {
    try {
      const systemPrompt = buildARIASystemPrompt()
      const userMessage = buildContextMessage(context)

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ]

      const response = await options.chat(messages, { taskType: 'planning' })
      const parsed = parseAIResponse(response.content) as { daily_missions?: unknown[] }

      if (parsed.daily_missions && Array.isArray(parsed.daily_missions)) {
        const validated = parsed.daily_missions
          .map(c => validateChallenge(c as Record<string, unknown>, context.difficulty))
          .filter((c): c is AIGeneratedChallenge => c !== null)

        if (validated.length >= 3) {
          console.log('[GameMaster] AI-generated challenges:', validated.length)
          return validated.slice(0, 3)
        }
      }

      console.warn('[GameMaster] AI response invalid, falling back to templates')
    } catch (error) {
      console.warn('[GameMaster] AI generation failed, using templates:', error)
    }
  }

  // Fallback to templates
  console.log('[GameMaster] Using template-based generation')
  const templateContext: TemplateGenerationContext = {
    averageTasksPerDay: context.patterns.averageTasksPerDay,
    averagePomodorosPerDay: context.patterns.averagePomodorosPerDay,
    overdueCount: context.stats.overdueCount,
    topProjects: context.projects.map(p => ({ id: p.id, name: p.name })),
  }

  return generateDailyChallengesFromTemplates(context.difficulty, templateContext, 3)
}

/**
 * Generate weekly boss fight using AI or fallback templates
 */
export async function generateWeeklyBoss(
  context: ChallengeGenerationContext,
  options: GameMasterOptions
): Promise<AIGeneratedChallenge & { total_hp: number; special_reward?: string }> {
  // Try AI generation first
  if (options.aiAvailable) {
    try {
      const systemPrompt = buildBossSystemPrompt()
      const userMessage = buildBossContextMessage(context)

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ]

      const response = await options.chat(messages, { taskType: 'planning' })
      const parsed = parseAIResponse(response.content) as { weekly_boss?: Record<string, unknown> }

      if (parsed.weekly_boss) {
        const boss = parsed.weekly_boss
        const validated = validateChallenge(boss, 'boss')

        if (validated) {
          const totalHp = Math.max(100, Math.round(Number(boss.total_hp) || validated.objective_target * 10))
          const specialReward = String(boss.special_reward || 'boss_victor_badge')

          console.log('[GameMaster] AI-generated boss fight:', validated.title)
          return {
            ...validated,
            total_hp: totalHp,
            special_reward: specialReward,
          }
        }
      }

      console.warn('[GameMaster] AI boss response invalid, falling back to templates')
    } catch (error) {
      console.warn('[GameMaster] AI boss generation failed, using templates:', error)
    }
  }

  // Fallback to templates
  console.log('[GameMaster] Using template-based boss generation')
  const templateContext: TemplateGenerationContext = {
    averageTasksPerDay: context.patterns.averageTasksPerDay,
    averagePomodorosPerDay: context.patterns.averagePomodorosPerDay,
    overdueCount: context.stats.overdueCount,
    topProjects: context.projects.map(p => ({ id: p.id, name: p.name })),
  }

  return generateBossFightFromTemplate(templateContext)
}

/**
 * Build challenge generation context from app state
 */
export function buildGenerationContext(params: {
  tasksCompleted: number
  overdueCount: number
  focusTimeToday: number
  pomodorosToday: number
  currentStreak: number
  longestStreak: number
  isStreakActive: boolean
  corruptionLevel: number
  recentCompleted: number
  recentFailed: number
  recentTypes: ChallengeObjective[]
  projects: { id: string; name: string; taskCount: number; overdueCount: number }[]
  averageTasksPerDay: number
  averagePomodorosPerDay: number
  preferredHours: number[]
  topProjects: string[]
}): ChallengeGenerationContext {
  const now = new Date()

  // Determine corruption trend
  let corruptionTrend: 'rising' | 'falling' | 'stable' = 'stable'
  if (params.recentFailed > params.recentCompleted) {
    corruptionTrend = 'rising'
  } else if (params.recentCompleted > params.recentFailed) {
    corruptionTrend = 'falling'
  }

  // Calculate difficulty
  const difficulty = calculateDifficulty(params.recentCompleted, params.recentFailed)

  return {
    stats: {
      tasksCompleted: params.tasksCompleted,
      overdueCount: params.overdueCount,
      focusTimeToday: params.focusTimeToday,
      pomodorosToday: params.pomodorosToday,
    },
    streak: {
      current: params.currentStreak,
      longest: params.longestStreak,
      isActive: params.isStreakActive,
    },
    corruption: {
      level: params.corruptionLevel,
      trend: corruptionTrend,
    },
    recentChallenges: {
      completed: params.recentCompleted,
      failed: params.recentFailed,
      types: params.recentTypes,
    },
    projects: params.projects,
    timeContext: {
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
    },
    patterns: {
      averageTasksPerDay: params.averageTasksPerDay || 5,
      averagePomodorosPerDay: params.averagePomodorosPerDay || 3,
      preferredHours: params.preferredHours,
      topProjects: params.topProjects,
    },
    difficulty,
  }
}
