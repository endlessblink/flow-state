/**
 * Challenge System Types for Cyberflow RPG
 * FEATURE-1132: AI Game Master Challenge System
 *
 * This file defines types for:
 * - Challenge objectives and structure
 * - Challenge generation context (sent to AI)
 * - Boss fight mechanics
 * - Database mappers
 */

// =============================================================================
// Challenge Objective Types
// =============================================================================

/**
 * Valid objective types for challenges.
 * Each maps to a specific tracking mechanism in the app.
 */
export type ChallengeObjective =
  | 'complete_tasks'          // Complete N tasks
  | 'complete_pomodoros'      // Complete N pomodoro sessions
  | 'clear_overdue'           // Clear N overdue tasks
  | 'focus_time_minutes'      // Accumulate N minutes of focus time
  | 'complete_high_priority'  // Complete N high-priority tasks
  | 'complete_project_tasks'  // Complete N tasks in a specific project
  | 'complete_before_hour'    // Complete N tasks before a specific hour
  | 'complete_variety'        // Complete tasks across N different projects

/**
 * Challenge types (daily, weekly, boss, special events)
 */
export type ChallengeType = 'daily' | 'weekly' | 'boss' | 'special'

/**
 * Challenge difficulty levels
 */
export type ChallengeDifficulty = 'easy' | 'normal' | 'hard' | 'boss'

/**
 * Challenge status
 */
export type ChallengeStatus = 'active' | 'completed' | 'failed' | 'expired'

// =============================================================================
// Challenge Interface
// =============================================================================

/**
 * Main challenge structure
 */
export interface Challenge {
  id: string
  userId: string
  challengeType: ChallengeType
  title: string
  description: string

  // Objective
  objectiveType: ChallengeObjective
  objectiveTarget: number
  objectiveCurrent: number
  objectiveContext?: ChallengeObjectiveContext

  // Rewards and penalties
  rewardXp: number
  rewardBonus?: ChallengeRewardBonus
  penaltyXp: number

  // Difficulty and narrative
  difficulty: ChallengeDifficulty
  narrativeFlavor?: string

  // Status tracking
  status: ChallengeStatus
  generatedAt: Date
  expiresAt: Date
  completedAt?: Date

  // AI context (for debugging)
  aiContext?: Record<string, unknown>
}

/**
 * Context for objective types that need additional info
 * e.g., which project for 'complete_project_tasks'
 */
export interface ChallengeObjectiveContext {
  projectId?: string
  projectName?: string
  hour?: number  // For 'complete_before_hour'
}

/**
 * Bonus rewards beyond XP
 */
export interface ChallengeRewardBonus {
  streakMultiplier?: number  // Bonus to streak multiplier
  shopDiscount?: number      // Percentage discount in shop
  cosmetic?: string          // Unlock a cosmetic item
}

// =============================================================================
// Challenge Generation Types
// =============================================================================

/**
 * Context sent to AI for challenge generation.
 * Contains user's current stats, patterns, and preferences.
 */
export interface ChallengeGenerationContext {
  // Current stats
  stats: {
    tasksCompleted: number
    overdueCount: number
    focusTimeToday: number
    pomodorosToday: number
  }

  // Streak information
  streak: {
    current: number
    longest: number
    isActive: boolean
  }

  // Corruption level
  corruption: {
    level: number
    trend: 'rising' | 'falling' | 'stable'
  }

  // Recent challenge performance (last 14 days)
  recentChallenges: {
    completed: number
    failed: number
    types: ChallengeObjective[]
  }

  // User's projects
  projects: {
    id: string
    name: string
    taskCount: number
    overdueCount: number
  }[]

  // Time context
  timeContext: {
    hour: number
    dayOfWeek: number
    isWeekend: boolean
  }

  // Behavioral patterns
  patterns: {
    averageTasksPerDay: number
    averagePomodorosPerDay: number
    preferredHours: number[]
    topProjects: string[]
  }

  // Pre-calculated difficulty based on completion rate
  difficulty: ChallengeDifficulty
}

/**
 * AI-generated challenge response (before mapping to Challenge)
 */
export interface AIGeneratedChallenge {
  title: string
  description: string
  objective_type: ChallengeObjective
  objective_target: number
  reward_xp: number
  penalty_xp: number
  difficulty: ChallengeDifficulty
  narrative_flavor: string
  // Optional for project-specific objectives
  project_name?: string
  hour?: number
}

/**
 * AI response structure for challenge generation
 */
export interface AIGenerateChallengesResponse {
  daily_missions: AIGeneratedChallenge[]
  weekly_boss?: AIGeneratedChallenge & {
    total_hp: number
    special_reward?: string
  }
}

// =============================================================================
// Boss Fight Types
// =============================================================================

/**
 * Extended challenge for boss fights
 */
export interface BossFight extends Challenge {
  challengeType: 'boss'

  // Boss-specific fields
  totalHp: number
  currentHp: number
  damageDealt: number

  // Multi-objective bosses
  objectives?: BossFightObjective[]

  // Special reward on victory
  specialReward?: string
}

/**
 * Individual objective within a boss fight
 */
export interface BossFightObjective {
  type: ChallengeObjective
  target: number
  current: number
  damage: number  // Damage dealt when completed
}

// =============================================================================
// Challenge Progress Event
// =============================================================================

/**
 * Event fired when progress should be checked against challenges
 */
export interface ChallengeProgressEvent {
  type: ChallengeObjective
  amount?: number  // Default 1 if not specified
  context?: {
    projectId?: string
    priority?: string
    hour?: number
    wasOverdue?: boolean
  }
}

// =============================================================================
// Corruption Types
// =============================================================================

/**
 * Corruption tier for visual effects
 */
export type CorruptionTier = 'clean' | 'mild' | 'moderate' | 'heavy' | 'critical'

/**
 * Corruption tier configuration
 */
export interface CorruptionTierConfig {
  tier: CorruptionTier
  minLevel: number
  maxLevel: number
  filter: string
  noiseOpacity: number
  scanlineOpacity: number
  glitchIntensity: number
}

// =============================================================================
// Database Types (snake_case)
// =============================================================================

export interface DbChallenge {
  id: string
  user_id: string
  challenge_type: ChallengeType
  title: string
  description: string
  objective_type: ChallengeObjective
  objective_target: number
  objective_current: number
  objective_context: Record<string, unknown> | null
  reward_xp: number
  reward_bonus: Record<string, unknown> | null
  penalty_xp: number
  difficulty: ChallengeDifficulty
  narrative_flavor: string | null
  status: ChallengeStatus
  generated_at: string
  expires_at: string
  completed_at: string | null
  ai_context: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface DbChallengeHistory {
  id: string
  user_id: string
  challenge_type: ChallengeType
  objective_type: ChallengeObjective
  difficulty: ChallengeDifficulty
  status: 'completed' | 'failed' | 'expired'
  xp_earned: number
  xp_lost: number
  completion_rate: number | null
  generated_at: string | null
  resolved_at: string
  time_to_complete_minutes: number | null
  created_at: string
}

// Extended user_gamification fields
export interface DbUserGamificationChallengeFields {
  corruption_level: number
  active_multiplier: number
  character_class: string
  daily_challenges_completed: number
  weekly_challenges_completed: number
  boss_fights_won: number
  last_daily_generation: string | null
  last_weekly_generation: string | null
}

// Challenge history entry (app type)
export interface ChallengeHistoryEntry {
  id: string
  userId: string
  challengeId?: string
  challengeType: ChallengeType
  objectiveType: ChallengeObjective
  difficulty: ChallengeDifficulty
  status: 'completed' | 'failed' | 'expired'
  xpEarned: number
  xpLost: number
  objectiveTarget: number
  objectiveAchieved: number
  completionRate: number
  generatedAt?: Date
  resolvedAt: Date
}

/**
 * Map database history row to ChallengeHistoryEntry
 */
export function mapDbChallengeHistory(row: DbChallengeHistory & { objective_target?: number; objective_achieved?: number }): ChallengeHistoryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    challengeType: row.challenge_type,
    objectiveType: row.objective_type,
    difficulty: row.difficulty,
    status: row.status,
    xpEarned: row.xp_earned,
    xpLost: row.xp_lost,
    objectiveTarget: row.objective_target || 0,
    objectiveAchieved: row.objective_achieved || 0,
    completionRate: row.completion_rate || 0,
    generatedAt: row.generated_at ? new Date(row.generated_at) : undefined,
    resolvedAt: new Date(row.resolved_at),
  }
}

// =============================================================================
// Type Mappers
// =============================================================================

/**
 * Map database row to Challenge type
 */
export function mapDbChallenge(row: DbChallenge): Challenge {
  return {
    id: row.id,
    userId: row.user_id,
    challengeType: row.challenge_type,
    title: row.title,
    description: row.description,
    objectiveType: row.objective_type,
    objectiveTarget: row.objective_target,
    objectiveCurrent: row.objective_current,
    objectiveContext: row.objective_context as ChallengeObjectiveContext | undefined,
    rewardXp: row.reward_xp,
    rewardBonus: row.reward_bonus as ChallengeRewardBonus | undefined,
    penaltyXp: row.penalty_xp,
    difficulty: row.difficulty,
    narrativeFlavor: row.narrative_flavor || undefined,
    status: row.status,
    generatedAt: new Date(row.generated_at),
    expiresAt: new Date(row.expires_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    aiContext: row.ai_context || undefined,
  }
}

/**
 * Map Challenge to database format
 */
export function mapChallengeToDb(challenge: Partial<Challenge>): Partial<DbChallenge> {
  const result: Partial<DbChallenge> = {}

  if (challenge.id !== undefined) result.id = challenge.id
  if (challenge.userId !== undefined) result.user_id = challenge.userId
  if (challenge.challengeType !== undefined) result.challenge_type = challenge.challengeType
  if (challenge.title !== undefined) result.title = challenge.title
  if (challenge.description !== undefined) result.description = challenge.description
  if (challenge.objectiveType !== undefined) result.objective_type = challenge.objectiveType
  if (challenge.objectiveTarget !== undefined) result.objective_target = challenge.objectiveTarget
  if (challenge.objectiveCurrent !== undefined) result.objective_current = challenge.objectiveCurrent
  if (challenge.objectiveContext !== undefined) result.objective_context = challenge.objectiveContext as Record<string, unknown>
  if (challenge.rewardXp !== undefined) result.reward_xp = challenge.rewardXp
  if (challenge.rewardBonus !== undefined) result.reward_bonus = challenge.rewardBonus as Record<string, unknown>
  if (challenge.penaltyXp !== undefined) result.penalty_xp = challenge.penaltyXp
  if (challenge.difficulty !== undefined) result.difficulty = challenge.difficulty
  if (challenge.narrativeFlavor !== undefined) result.narrative_flavor = challenge.narrativeFlavor
  if (challenge.status !== undefined) result.status = challenge.status
  if (challenge.generatedAt !== undefined) result.generated_at = challenge.generatedAt.toISOString()
  if (challenge.expiresAt !== undefined) result.expires_at = challenge.expiresAt.toISOString()
  if (challenge.completedAt !== undefined) result.completed_at = challenge.completedAt?.toISOString() || null
  if (challenge.aiContext !== undefined) result.ai_context = challenge.aiContext as Record<string, unknown>

  return result
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Objective constraints for anti-gaming
 */
export const OBJECTIVE_CONSTRAINTS: Record<ChallengeObjective, { min: number; max: number }> = {
  complete_tasks: { min: 1, max: 10 },
  complete_pomodoros: { min: 1, max: 6 },
  clear_overdue: { min: 1, max: 5 },
  focus_time_minutes: { min: 15, max: 120 },
  complete_high_priority: { min: 1, max: 3 },
  complete_project_tasks: { min: 1, max: 5 },
  complete_before_hour: { min: 1, max: 3 },
  complete_variety: { min: 2, max: 4 },
}

/**
 * Corruption tier thresholds
 */
export const CORRUPTION_TIERS: CorruptionTierConfig[] = [
  {
    tier: 'clean',
    minLevel: 0,
    maxLevel: 20,
    filter: 'none',
    noiseOpacity: 0,
    scanlineOpacity: 0,
    glitchIntensity: 0,
  },
  {
    tier: 'mild',
    minLevel: 21,
    maxLevel: 40,
    filter: 'saturate(0.85)',
    noiseOpacity: 0.05,
    scanlineOpacity: 0,
    glitchIntensity: 0.1,
  },
  {
    tier: 'moderate',
    minLevel: 41,
    maxLevel: 60,
    filter: 'saturate(0.7)',
    noiseOpacity: 0.15,
    scanlineOpacity: 0.05,
    glitchIntensity: 0.3,
  },
  {
    tier: 'heavy',
    minLevel: 61,
    maxLevel: 80,
    filter: 'saturate(0.6) sepia(0.2)',
    noiseOpacity: 0.25,
    scanlineOpacity: 0.1,
    glitchIntensity: 0.5,
  },
  {
    tier: 'critical',
    minLevel: 81,
    maxLevel: 100,
    filter: 'saturate(0.5) sepia(0.4) hue-rotate(-15deg)',
    noiseOpacity: 0.35,
    scanlineOpacity: 0.2,
    glitchIntensity: 0.8,
  },
]

/**
 * Corruption delta values
 */
export const CORRUPTION_DELTAS = {
  // Increases
  DAILY_FAILED: 5,
  BOSS_FAILED: 15,
  INACTIVE_PER_DAY: 2,  // After 3 days of inactivity

  // Decreases
  DAILY_COMPLETED: -10,
  BOSS_COMPLETED: -25,
  STREAK_MILESTONE: -5,
  ALL_DAILIES_BONUS: -15,  // Completing all 3 dailies
} as const

/**
 * Difficulty scaling multipliers
 */
export const DIFFICULTY_SCALING: Record<ChallengeDifficulty, number> = {
  easy: 0.5,
  normal: 1.0,
  hard: 1.5,
  boss: 2.0,
}

/**
 * XP reward ranges by difficulty
 */
export const XP_REWARDS: Record<ChallengeDifficulty, { min: number; max: number }> = {
  easy: { min: 15, max: 30 },
  normal: { min: 25, max: 50 },
  hard: { min: 40, max: 75 },
  boss: { min: 100, max: 200 },
}

/**
 * Get corruption tier from level
 */
export function getCorruptionTier(level: number): CorruptionTierConfig {
  return CORRUPTION_TIERS.find(t => level >= t.minLevel && level <= t.maxLevel) || CORRUPTION_TIERS[0]
}
