/**
 * Game Master Service for Cyberflow RPG
 * FEATURE-1132: Template-based challenge generation
 */

import type {
  ChallengeGenerationContext,
  ChallengeDifficulty,
  AIGeneratedChallenge,
  ChallengeObjective,
} from '@/types/challenges'
import {
  generateDailyChallengesFromTemplates,
  generateBossFightFromTemplate,
  type TemplateGenerationContext,
} from './challengeTemplates'

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
// Main API
// =============================================================================

/**
 * Generate daily challenges using templates
 */
export async function generateDailyChallenges(
  context: ChallengeGenerationContext
): Promise<AIGeneratedChallenge[]> {
  const templateContext: TemplateGenerationContext = {
    averageTasksPerDay: context.patterns.averageTasksPerDay,
    averagePomodorosPerDay: context.patterns.averagePomodorosPerDay,
    overdueCount: context.stats.overdueCount,
    topProjects: context.projects.map(p => ({ id: p.id, name: p.name })),
  }
  return generateDailyChallengesFromTemplates(context.difficulty, templateContext, 3)
}

/**
 * Generate weekly boss fight using templates
 */
export async function generateWeeklyBoss(
  context: ChallengeGenerationContext
): Promise<AIGeneratedChallenge & { total_hp: number; special_reward?: string }> {
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
