// Gamification System "Cyberflow" Type Definitions
// FEATURE-1118: XP, levels, streaks, achievements, and cosmetic shop

// =============================================================================
// Core Profile Types
// =============================================================================

export interface UserGamification {
  userId: string
  totalXp: number
  availableXp: number // Spendable XP (totalXp - spent on purchases)
  level: number
  currentStreak: number
  longestStreak: number
  streakFreezes: number
  lastActivityDate: Date | null
  xpDecayDate: Date | null // When decay starts (30 days after last activity)
  unlockedThemes: string[]
  equippedTheme: string
  createdAt: Date
  updatedAt: Date
}

export interface UserStats {
  userId: string
  tasksCompleted: number
  pomodorosCompleted: number
  totalFocusMinutes: number
  tasksCompletedOnTime: number
  tasksCompletedHighPriority: number
  midnightTasks: number
  speedCompletions: number
  viewsUsed: Record<string, boolean>
  featuresUsed: Record<string, boolean>
  updatedAt: Date
}

// =============================================================================
// XP System Types
// =============================================================================

export type XpType = 'earned' | 'spent' | 'decay'

export type XpReason =
  | 'task_complete'
  | 'pomodoro_complete'
  | 'streak_bonus'
  | 'achievement'
  | 'purchase'
  | 'daily_decay'
  | 'level_up_bonus'
  | 'comeback_bonus'

export interface XpLog {
  id: string
  userId: string
  xpAmount: number
  xpType: XpType
  reason: XpReason | string
  taskId?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface XpAwardResult {
  xpAwarded: number
  newTotalXp: number
  newAvailableXp: number
  newLevel: number
  leveledUp: boolean
  previousLevel: number
  multipliers: XpMultiplier[]
}

export interface XpMultiplier {
  name: string
  value: number
  reason: string
}

// =============================================================================
// Achievement Types
// =============================================================================

export type AchievementCategory =
  | 'productivity'
  | 'consistency'
  | 'mastery'
  | 'exploration'
  | 'secret'

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export type AchievementConditionType = 'count' | 'streak' | 'milestone' | 'special'

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string // Lucide icon name
  category: AchievementCategory
  xpReward: number
  conditionType: AchievementConditionType
  conditionValue: number
  conditionKey?: string // What counter to check
  isSecret: boolean
  tier: AchievementTier
}

export interface UserAchievement {
  id: string
  userId: string
  achievementId: string
  progress: number
  earnedAt: Date | null
  notifiedAt: Date | null
}

export interface AchievementWithProgress extends Achievement {
  progress: number
  isEarned: boolean
  earnedAt: Date | null
}

export interface AchievementUnlockResult {
  achievement: Achievement
  xpAwarded: number
  isNewUnlock: boolean
}

// =============================================================================
// Shop Types
// =============================================================================

export type ShopCategory = 'theme' | 'badge_style' | 'animation' | 'sound'

export interface ShopItem {
  id: string
  name: string
  description: string
  category: ShopCategory
  priceXp: number
  previewCss: Record<string, string>
  isPermanent: boolean
  isAvailable: boolean
  requiredLevel: number
}

export interface ShopItemWithOwnership extends ShopItem {
  isOwned: boolean
  purchasedAt: Date | null
}

export interface PurchaseResult {
  success: boolean
  item: ShopItem
  xpSpent: number
  newAvailableXp: number
  error?: string
}

// =============================================================================
// Streak Types
// =============================================================================

export interface StreakInfo {
  currentStreak: number
  longestStreak: number
  streakFreezes: number
  lastActivityDate: Date | null
  isActiveToday: boolean
  streakAtRisk: boolean // True if no activity yesterday
  daysUntilDecay: number // Days until XP decay starts
}

export interface StreakUpdateResult {
  newStreak: number
  streakBroken: boolean
  freezeUsed: boolean
  streakMilestone: number | null // e.g., 7, 30, 100 if milestone reached
  xpBonusAwarded: number
}

// =============================================================================
// Level System Types
// =============================================================================

export interface LevelInfo {
  level: number
  currentXp: number
  xpForCurrentLevel: number
  xpForNextLevel: number
  progressPercent: number
  totalXpRequired: number // Total XP needed to reach current level from 0
}

// =============================================================================
// Notification/Toast Types
// =============================================================================

export interface GamificationToast {
  id: string
  type: 'xp' | 'level_up' | 'achievement' | 'streak' | 'purchase' | 'exposure'
  title: string
  description?: string
  xpAmount?: number
  icon?: string
  tier?: AchievementTier
  duration?: number // ms, default 3000
}

// =============================================================================
// Settings Types
// =============================================================================

export interface GamificationSettings {
  enabled: boolean
  showXpNotifications: boolean
  showAchievementNotifications: boolean
  intensity: 'minimal' | 'moderate' | 'intense'
  soundEnabled: boolean
}

// =============================================================================
// Database Mappers (Supabase snake_case to camelCase)
// =============================================================================

export interface DbUserGamification {
  user_id: string
  total_xp: number
  available_xp: number
  level: number
  current_streak: number
  longest_streak: number
  streak_freezes: number
  last_activity_date: string | null
  xp_decay_date: string | null
  unlocked_themes: string[]
  equipped_theme: string
  corruption_level: number
  active_multiplier: number
  character_class: string
  daily_challenges_completed: number
  weekly_challenges_completed: number
  boss_fights_won: number
  total_challenges_completed: number
  last_daily_generation: string | null
  last_weekly_generation: string | null
  created_at: string
  updated_at: string
}

export interface DbXpLog {
  id: string
  user_id: string
  xp_amount: number
  xp_type: XpType
  reason: string
  task_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DbAchievement {
  id: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  xp_reward: number
  condition_type: AchievementConditionType
  condition_value: number
  condition_key: string | null
  is_secret: boolean
  tier: AchievementTier
}

export interface DbUserAchievement {
  id: string
  user_id: string
  achievement_id: string
  progress: number
  earned_at: string | null
  notified_at: string | null
}

export interface DbShopItem {
  id: string
  name: string
  description: string
  category: ShopCategory
  price_xp: number
  preview_css: Record<string, string>
  is_permanent: boolean
  is_available: boolean
  required_level: number
}

export interface DbUserPurchase {
  id: string
  user_id: string
  item_id: string
  purchased_at: string
  xp_spent: number
}

export interface DbUserStats {
  user_id: string
  tasks_completed: number
  pomodoros_completed: number
  total_focus_minutes: number
  tasks_completed_on_time: number
  tasks_completed_high_priority: number
  midnight_tasks: number
  speed_completions: number
  views_used: Record<string, boolean>
  features_used: Record<string, boolean>
  updated_at: string
}

// =============================================================================
// Constants
// =============================================================================

export const XP_VALUES = {
  TASK_COMPLETE_BASE: 10,
  POMODORO_COMPLETE_BASE: 25,
  STREAK_MILESTONE_7: 50,
  STREAK_MILESTONE_30: 150,
  STREAK_MILESTONE_100: 300,
  STREAK_MILESTONE_365: 500,
  COMEBACK_BONUS: 25,
} as const

export const XP_MULTIPLIERS = {
  HIGH_PRIORITY: 1.5,
  MEDIUM_PRIORITY: 1.25,
  OVERDUE_PENALTY: 0.9,
  CONSECUTIVE_POMODORO_BONUS: 0.1, // +10% per consecutive session
  MAX_CONSECUTIVE_BONUS: 0.5, // Cap at +50%
} as const

export const EXPOSURE_SYSTEM = {
  // When completing tasks WITHOUT a timer running
  EXPOSED_XP_PENALTY: 0.75,      // 25% XP reduction
  EXPOSED_CORRUPTION_DELTA: 3,    // Corruption increases

  // When completing tasks WITH a timer running
  SHIELDED_XP_BONUS: 1.1,        // 10% XP boost
  SHIELDED_CORRUPTION_DELTA: -2,  // Corruption decreases
} as const

export const STREAK_CONFIG = {
  GRACE_PERIOD_HOURS: 24, // Hours after midnight to still count as same day
  MAX_FREEZES: 5,
  FREEZE_REFILL_DAYS: 30, // Days to earn a new freeze
  DECAY_START_DAYS: 30, // Days of inactivity before XP decay
  DECAY_RATE_PERCENT: 1, // % of total XP per day
  DECAY_MAX_PER_DAY: 100, // Cap daily decay
} as const

export const TIER_COLORS = {
  bronze: { r: 205, g: 127, b: 50 },
  silver: { r: 192, g: 192, b: 192 },
  gold: { r: 255, g: 215, b: 0 },
  platinum: { r: 229, g: 228, b: 226 },
} as const
