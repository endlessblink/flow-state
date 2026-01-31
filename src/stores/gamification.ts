/**
 * Gamification Store - "Cyberflow" System
 * FEATURE-1118: XP, levels, streaks, achievements, and cosmetic shop
 *
 * This store manages all gamification state including:
 * - User profile (XP, level, streak, equipped theme)
 * - Achievement tracking and unlocking
 * - Shop purchases and theme application
 * - XP awarding with multipliers
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase } from '@/services/auth/supabase'
import { useAuthStore } from '@/stores/auth'
import type {
  UserGamification,
  UserStats,
  XpLog,
  XpAwardResult,
  XpMultiplier,
  Achievement,
  AchievementWithProgress,
  AchievementUnlockResult,
  ShopItem,
  ShopItemWithOwnership,
  PurchaseResult,
  StreakInfo,
  StreakUpdateResult,
  LevelInfo,
  GamificationToast,
  GamificationSettings,
  DbUserGamification,
  DbXpLog,
  DbAchievement,
  DbUserAchievement,
  DbShopItem,
  DbUserPurchase,
  DbUserStats,
  XP_VALUES,
  XP_MULTIPLIERS,
  STREAK_CONFIG,
} from '@/types/gamification'

// =============================================================================
// Type Mappers (Database snake_case <-> App camelCase)
// =============================================================================

function mapDbToUserGamification(db: DbUserGamification): UserGamification {
  return {
    userId: db.user_id,
    totalXp: db.total_xp,
    availableXp: db.available_xp,
    level: db.level,
    currentStreak: db.current_streak,
    longestStreak: db.longest_streak,
    streakFreezes: db.streak_freezes,
    lastActivityDate: db.last_activity_date ? new Date(db.last_activity_date) : null,
    xpDecayDate: db.xp_decay_date ? new Date(db.xp_decay_date) : null,
    unlockedThemes: db.unlocked_themes || [],
    equippedTheme: db.equipped_theme,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  }
}

function mapDbToAchievement(db: DbAchievement): Achievement {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    icon: db.icon,
    category: db.category,
    xpReward: db.xp_reward,
    conditionType: db.condition_type,
    conditionValue: db.condition_value,
    conditionKey: db.condition_key || undefined,
    isSecret: db.is_secret,
    tier: db.tier,
  }
}

function mapDbToShopItem(db: DbShopItem): ShopItem {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    category: db.category,
    priceXp: db.price_xp,
    previewCss: db.preview_css || {},
    isPermanent: db.is_permanent,
    isAvailable: db.is_available,
    requiredLevel: db.required_level,
  }
}

function mapDbToUserStats(db: DbUserStats): UserStats {
  return {
    userId: db.user_id,
    tasksCompleted: db.tasks_completed,
    pomodorosCompleted: db.pomodoros_completed,
    totalFocusMinutes: db.total_focus_minutes,
    tasksCompletedOnTime: db.tasks_completed_on_time,
    tasksCompletedHighPriority: db.tasks_completed_high_priority,
    midnightTasks: db.midnight_tasks,
    speedCompletions: db.speed_completions,
    viewsUsed: db.views_used || {},
    featuresUsed: db.features_used || {},
    updatedAt: new Date(db.updated_at),
  }
}

// =============================================================================
// Level Calculation Utilities
// =============================================================================

/**
 * Calculate XP required to reach a specific level from level 1
 * Level curve:
 * - Levels 1-5: 100 XP each
 * - Levels 6-10: 250 XP increment (starting at 750)
 * - Levels 11+: 500 XP increment (starting at 2250)
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  if (level <= 5) {
    // Levels 2-5: 100, 200, 300, 400, 500 cumulative
    return (level - 1) * 100
  }
  if (level <= 10) {
    // Levels 2-5 = 500 XP, then 250 per level
    const base = 500
    return base + (level - 5) * 250
  }
  // Level 11+: 500 + 1250 (for 6-10) + 500 per level
  const base = 500 + 1250
  return base + (level - 10) * 500
}

/**
 * Calculate XP needed for JUST the current level (not cumulative)
 */
export function xpForCurrentLevel(level: number): number {
  if (level <= 5) return 100
  if (level <= 10) return 250
  return 500
}

/**
 * Calculate level from total XP
 */
export function levelFromXp(totalXp: number): number {
  let level = 1
  let xpRemaining = totalXp

  // Levels 1-5
  while (level < 5 && xpRemaining >= 100) {
    xpRemaining -= 100
    level++
  }

  // Levels 6-10
  while (level >= 5 && level < 10 && xpRemaining >= 250) {
    xpRemaining -= 250
    level++
  }

  // Levels 11+
  while (level >= 10 && xpRemaining >= 500) {
    xpRemaining -= 500
    level++
  }

  return level
}

/**
 * Get detailed level info for UI display
 */
export function getLevelInfo(totalXp: number): LevelInfo {
  const level = levelFromXp(totalXp)
  const xpForCurrent = xpForLevel(level)
  const xpForNext = xpForLevel(level + 1)
  const currentLevelXp = totalXp - xpForCurrent
  const xpNeeded = xpForNext - xpForCurrent

  return {
    level,
    currentXp: currentLevelXp,
    xpForCurrentLevel: 0, // XP at start of current level
    xpForNextLevel: xpNeeded,
    progressPercent: Math.min(100, Math.round((currentLevelXp / xpNeeded) * 100)),
    totalXpRequired: xpForCurrent,
  }
}

// =============================================================================
// Store Definition
// =============================================================================

export const useGamificationStore = defineStore('gamification', () => {
  const authStore = useAuthStore()

  // =============================================================================
  // State
  // =============================================================================

  const profile = ref<UserGamification | null>(null)
  const stats = ref<UserStats | null>(null)
  const achievements = ref<Achievement[]>([])
  const userAchievements = ref<Map<string, { progress: number; earnedAt: Date | null }>>(new Map())
  const shopItems = ref<ShopItem[]>([])
  const ownedItems = ref<Set<string>>(new Set())
  const recentXpLogs = ref<XpLog[]>([])
  const toastQueue = ref<GamificationToast[]>([])
  const isLoading = ref(false)
  const isInitialized = ref(false)

  // Settings (persisted locally, synced to user_settings later)
  const settings = ref<GamificationSettings>({
    enabled: true,
    showXpNotifications: true,
    showAchievementNotifications: true,
    intensity: 'moderate',
    soundEnabled: true,
  })

  // =============================================================================
  // Computed
  // =============================================================================

  const isEnabled = computed(() => settings.value.enabled && !!profile.value)

  const totalXp = computed(() => profile.value?.totalXp ?? 0)
  const availableXp = computed(() => profile.value?.availableXp ?? 0)
  const currentLevel = computed(() => profile.value?.level ?? 1)

  const levelInfo = computed((): LevelInfo => getLevelInfo(totalXp.value))

  const streakInfo = computed((): StreakInfo => {
    const p = profile.value
    if (!p) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        streakFreezes: 2,
        lastActivityDate: null,
        isActiveToday: false,
        streakAtRisk: false,
        daysUntilDecay: 30,
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const lastActive = p.lastActivityDate
    const lastActiveDay = lastActive ? new Date(lastActive) : null
    lastActiveDay?.setHours(0, 0, 0, 0)

    const isActiveToday = lastActiveDay?.getTime() === today.getTime()

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const wasActiveYesterday = lastActiveDay?.getTime() === yesterday.getTime()

    const streakAtRisk = !isActiveToday && !wasActiveYesterday && p.currentStreak > 0

    const daysSinceActive = lastActiveDay
      ? Math.floor((today.getTime() - lastActiveDay.getTime()) / (1000 * 60 * 60 * 24))
      : 999

    const daysUntilDecay = Math.max(0, STREAK_CONFIG.DECAY_START_DAYS - daysSinceActive)

    return {
      currentStreak: p.currentStreak,
      longestStreak: p.longestStreak,
      streakFreezes: p.streakFreezes,
      lastActivityDate: p.lastActivityDate,
      isActiveToday,
      streakAtRisk,
      daysUntilDecay,
    }
  })

  const equippedTheme = computed(() => profile.value?.equippedTheme ?? 'default')

  const achievementsWithProgress = computed((): AchievementWithProgress[] => {
    return achievements.value.map((a) => {
      const userProgress = userAchievements.value.get(a.id)
      return {
        ...a,
        progress: userProgress?.progress ?? 0,
        isEarned: userProgress?.earnedAt !== null && userProgress?.earnedAt !== undefined,
        earnedAt: userProgress?.earnedAt ?? null,
      }
    })
  })

  const earnedAchievements = computed(() =>
    achievementsWithProgress.value.filter((a) => a.isEarned)
  )

  const unlockedAchievementsCount = computed(() => earnedAchievements.value.length)

  const shopItemsWithOwnership = computed((): ShopItemWithOwnership[] => {
    return shopItems.value.map((item) => ({
      ...item,
      isOwned: ownedItems.value.has(item.id),
      purchasedAt: null, // Could be fetched if needed
    }))
  })

  // =============================================================================
  // Database Operations
  // =============================================================================

  /**
   * Initialize gamification profile for current user
   * Creates profile if it doesn't exist
   */
  async function initialize() {
    if (!supabase || !authStore.isAuthenticated || !authStore.user?.id) {
      console.log('[Gamification] Skipping init - no auth')
      return
    }

    if (isInitialized.value) {
      console.log('[Gamification] Already initialized')
      return
    }

    isLoading.value = true
    const userId = authStore.user.id

    try {
      console.log('[Gamification] Initializing for user:', userId.slice(0, 8))

      // Load profile (or create if doesn't exist)
      await loadOrCreateProfile(userId)

      // Load achievements, shop items, etc. in parallel
      await Promise.all([
        loadAchievements(),
        loadUserAchievements(userId),
        loadShopItems(),
        loadUserPurchases(userId),
        loadUserStats(userId),
      ])

      // Check and record daily activity
      await recordDailyActivity()

      isInitialized.value = true
      console.log('[Gamification] Initialized successfully')
    } catch (e) {
      console.error('[Gamification] Initialization failed:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function loadOrCreateProfile(userId: string) {
    const { data, error } = await supabase
      .from('user_gamification')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it
      console.log('[Gamification] Creating new profile')
      const { data: newProfile, error: createError } = await supabase
        .from('user_gamification')
        .insert({ user_id: userId })
        .select()
        .single()

      if (createError) throw createError
      profile.value = mapDbToUserGamification(newProfile)
    } else if (error) {
      throw error
    } else {
      profile.value = mapDbToUserGamification(data)
    }
  }

  async function loadAchievements() {
    const { data, error } = await supabase.from('achievements').select('*')

    if (error) throw error
    achievements.value = (data || []).map(mapDbToAchievement)
  }

  async function loadUserAchievements(userId: string) {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    userAchievements.value = new Map(
      (data || []).map((ua: DbUserAchievement) => [
        ua.achievement_id,
        {
          progress: ua.progress,
          earnedAt: ua.earned_at ? new Date(ua.earned_at) : null,
        },
      ])
    )
  }

  async function loadShopItems() {
    const { data, error } = await supabase
      .from('shop_items')
      .select('*')
      .eq('is_available', true)

    if (error) throw error
    shopItems.value = (data || []).map(mapDbToShopItem)
  }

  async function loadUserPurchases(userId: string) {
    const { data, error } = await supabase
      .from('user_purchases')
      .select('item_id')
      .eq('user_id', userId)

    if (error) throw error
    ownedItems.value = new Set((data || []).map((p: { item_id: string }) => p.item_id))
  }

  async function loadUserStats(userId: string) {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code === 'PGRST116') {
      // Stats don't exist, create them
      const { data: newStats, error: createError } = await supabase
        .from('user_stats')
        .insert({ user_id: userId })
        .select()
        .single()

      if (createError) throw createError
      stats.value = mapDbToUserStats(newStats)
    } else if (error) {
      throw error
    } else {
      stats.value = mapDbToUserStats(data)
    }
  }

  // =============================================================================
  // XP System
  // =============================================================================

  /**
   * Award XP to the user with multipliers
   */
  async function awardXp(
    baseAmount: number,
    reason: string,
    options?: {
      taskId?: string
      priority?: 'low' | 'medium' | 'high' | null
      isOverdue?: boolean
      consecutivePomodoros?: number
      metadata?: Record<string, unknown>
    }
  ): Promise<XpAwardResult | null> {
    if (!isEnabled.value || !profile.value || !authStore.user?.id) {
      return null
    }

    const multipliers: XpMultiplier[] = []
    let finalAmount = baseAmount

    // Apply priority multiplier
    if (options?.priority === 'high') {
      multipliers.push({ name: 'High Priority', value: XP_MULTIPLIERS.HIGH_PRIORITY, reason: '+50% XP' })
      finalAmount *= XP_MULTIPLIERS.HIGH_PRIORITY
    } else if (options?.priority === 'medium') {
      multipliers.push({ name: 'Medium Priority', value: XP_MULTIPLIERS.MEDIUM_PRIORITY, reason: '+25% XP' })
      finalAmount *= XP_MULTIPLIERS.MEDIUM_PRIORITY
    }

    // Apply overdue penalty
    if (options?.isOverdue) {
      multipliers.push({ name: 'Overdue', value: XP_MULTIPLIERS.OVERDUE_PENALTY, reason: '-10% XP' })
      finalAmount *= XP_MULTIPLIERS.OVERDUE_PENALTY
    }

    // Apply consecutive pomodoro bonus
    if (options?.consecutivePomodoros && options.consecutivePomodoros > 1) {
      const bonus = Math.min(
        options.consecutivePomodoros * XP_MULTIPLIERS.CONSECUTIVE_POMODORO_BONUS,
        XP_MULTIPLIERS.MAX_CONSECUTIVE_BONUS
      )
      multipliers.push({
        name: 'Focus Streak',
        value: 1 + bonus,
        reason: `+${Math.round(bonus * 100)}% XP`,
      })
      finalAmount *= 1 + bonus
    }

    const xpAwarded = Math.round(finalAmount)
    const previousLevel = profile.value.level
    const newTotalXp = profile.value.totalXp + xpAwarded
    const newAvailableXp = profile.value.availableXp + xpAwarded
    const newLevel = levelFromXp(newTotalXp)
    const leveledUp = newLevel > previousLevel

    try {
      // Insert XP log
      await supabase.from('xp_logs').insert({
        user_id: authStore.user.id,
        xp_amount: xpAwarded,
        xp_type: 'earned',
        reason,
        task_id: options?.taskId || null,
        metadata: {
          multipliers: multipliers.map((m) => ({ name: m.name, value: m.value })),
          ...options?.metadata,
        },
      })

      // Update profile
      const { error } = await supabase
        .from('user_gamification')
        .update({
          total_xp: newTotalXp,
          available_xp: newAvailableXp,
          level: newLevel,
        })
        .eq('user_id', authStore.user.id)

      if (error) throw error

      // Update local state
      profile.value.totalXp = newTotalXp
      profile.value.availableXp = newAvailableXp
      profile.value.level = newLevel

      // Show notification
      if (settings.value.showXpNotifications) {
        showXpToast(xpAwarded, reason, multipliers)
      }

      // Show level up notification
      if (leveledUp && settings.value.showAchievementNotifications) {
        showLevelUpToast(newLevel)
      }

      // Check achievements
      await checkAchievements()

      return {
        xpAwarded,
        newTotalXp,
        newAvailableXp,
        newLevel,
        leveledUp,
        previousLevel,
        multipliers,
      }
    } catch (e) {
      console.error('[Gamification] Failed to award XP:', e)
      return null
    }
  }

  // =============================================================================
  // Streak System
  // =============================================================================

  /**
   * Record daily activity and update streak
   */
  async function recordDailyActivity(): Promise<StreakUpdateResult | null> {
    if (!profile.value || !authStore.user?.id) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const lastActive = profile.value.lastActivityDate
    const lastActiveDay = lastActive ? new Date(lastActive) : null
    lastActiveDay?.setHours(0, 0, 0, 0)

    // Already recorded today
    if (lastActiveDay?.getTime() === today.getTime()) {
      return null
    }

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const wasActiveYesterday = lastActiveDay?.getTime() === yesterday.getTime()

    let newStreak = profile.value.currentStreak
    let streakBroken = false
    let freezeUsed = false
    let streakMilestone: number | null = null

    if (wasActiveYesterday || !lastActiveDay) {
      // Continue or start streak
      newStreak = wasActiveYesterday ? newStreak + 1 : 1
    } else {
      // Streak broken - check for freeze
      const daysMissed = Math.floor(
        (today.getTime() - (lastActiveDay?.getTime() || 0)) / (1000 * 60 * 60 * 24)
      )

      if (daysMissed <= 2 && profile.value.streakFreezes > 0) {
        // Use freeze
        freezeUsed = true
        newStreak = profile.value.currentStreak + 1
        await supabase
          .from('user_gamification')
          .update({ streak_freezes: profile.value.streakFreezes - 1 })
          .eq('user_id', authStore.user.id)
        profile.value.streakFreezes--
      } else {
        // Streak broken
        streakBroken = true
        newStreak = 1
      }
    }

    // Check for streak milestones
    const milestones = [7, 30, 100, 365]
    for (const milestone of milestones) {
      if (newStreak === milestone) {
        streakMilestone = milestone
        break
      }
    }

    // Award streak bonus XP
    let xpBonusAwarded = 0
    if (streakMilestone) {
      const bonusMap: Record<number, number> = {
        7: XP_VALUES.STREAK_MILESTONE_7,
        30: XP_VALUES.STREAK_MILESTONE_30,
        100: XP_VALUES.STREAK_MILESTONE_100,
        365: XP_VALUES.STREAK_MILESTONE_365,
      }
      xpBonusAwarded = bonusMap[streakMilestone] || 0
      if (xpBonusAwarded > 0) {
        await awardXp(xpBonusAwarded, 'streak_bonus', { metadata: { milestone: streakMilestone } })
      }
    }

    // Update profile
    const longestStreak = Math.max(profile.value.longestStreak, newStreak)
    const { error } = await supabase
      .from('user_gamification')
      .update({
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_activity_date: todayStr,
        xp_decay_date: null, // Reset decay timer
      })
      .eq('user_id', authStore.user.id)

    if (error) {
      console.error('[Gamification] Failed to update streak:', error)
      return null
    }

    profile.value.currentStreak = newStreak
    profile.value.longestStreak = longestStreak
    profile.value.lastActivityDate = today

    return {
      newStreak,
      streakBroken,
      freezeUsed,
      streakMilestone,
      xpBonusAwarded,
    }
  }

  // =============================================================================
  // Achievement System
  // =============================================================================

  /**
   * Check all achievements and unlock any that are met
   */
  async function checkAchievements(): Promise<AchievementUnlockResult[]> {
    if (!stats.value || !profile.value || !authStore.user?.id) return []

    const unlocked: AchievementUnlockResult[] = []

    for (const achievement of achievements.value) {
      // Skip already earned
      const userProgress = userAchievements.value.get(achievement.id)
      if (userProgress?.earnedAt) continue

      let currentValue = 0
      let conditionMet = false

      // Get current value based on condition key
      switch (achievement.conditionKey) {
        case 'tasks_completed':
          currentValue = stats.value.tasksCompleted
          break
        case 'pomodoros_completed':
          currentValue = stats.value.pomodorosCompleted
          break
        case 'total_focus_minutes':
          currentValue = stats.value.totalFocusMinutes
          break
        case 'tasks_completed_on_time':
          currentValue = stats.value.tasksCompletedOnTime
          break
        case 'tasks_completed_high_priority':
          currentValue = stats.value.tasksCompletedHighPriority
          break
        case 'current_streak':
          currentValue = profile.value.currentStreak
          break
        case 'total_xp':
          currentValue = profile.value.totalXp
          break
        // Special achievements checked elsewhere
        default:
          continue
      }

      // Check condition
      if (achievement.conditionType === 'count' || achievement.conditionType === 'streak') {
        conditionMet = currentValue >= achievement.conditionValue
      }

      // Update progress
      if (currentValue !== (userProgress?.progress ?? 0)) {
        await updateAchievementProgress(achievement.id, currentValue)
      }

      // Unlock if met
      if (conditionMet) {
        const result = await unlockAchievement(achievement)
        if (result) unlocked.push(result)
      }
    }

    return unlocked
  }

  async function updateAchievementProgress(achievementId: string, progress: number) {
    if (!authStore.user?.id) return

    const existing = userAchievements.value.get(achievementId)

    if (existing) {
      await supabase
        .from('user_achievements')
        .update({ progress })
        .eq('user_id', authStore.user.id)
        .eq('achievement_id', achievementId)
    } else {
      await supabase.from('user_achievements').insert({
        user_id: authStore.user.id,
        achievement_id: achievementId,
        progress,
      })
    }

    userAchievements.value.set(achievementId, {
      progress,
      earnedAt: existing?.earnedAt ?? null,
    })
  }

  async function unlockAchievement(achievement: Achievement): Promise<AchievementUnlockResult | null> {
    if (!authStore.user?.id) return null

    const now = new Date()

    const { error } = await supabase
      .from('user_achievements')
      .upsert({
        user_id: authStore.user.id,
        achievement_id: achievement.id,
        progress: achievement.conditionValue,
        earned_at: now.toISOString(),
      })

    if (error) {
      console.error('[Gamification] Failed to unlock achievement:', error)
      return null
    }

    userAchievements.value.set(achievement.id, {
      progress: achievement.conditionValue,
      earnedAt: now,
    })

    // Award XP for achievement
    if (achievement.xpReward > 0) {
      await awardXp(achievement.xpReward, 'achievement', {
        metadata: { achievementId: achievement.id },
      })
    }

    // Show notification
    if (settings.value.showAchievementNotifications) {
      showAchievementToast(achievement)
    }

    return {
      achievement,
      xpAwarded: achievement.xpReward,
      isNewUnlock: true,
    }
  }

  /**
   * Trigger a special achievement (called from external code)
   */
  async function triggerSpecialAchievement(conditionKey: string) {
    const achievement = achievements.value.find(
      (a) => a.conditionType === 'special' && a.conditionKey === conditionKey
    )

    if (!achievement) return null

    const userProgress = userAchievements.value.get(achievement.id)
    if (userProgress?.earnedAt) return null // Already earned

    return await unlockAchievement(achievement)
  }

  // =============================================================================
  // Stats Tracking
  // =============================================================================

  /**
   * Increment a stat counter
   */
  async function incrementStat(
    statKey: keyof Omit<UserStats, 'userId' | 'viewsUsed' | 'featuresUsed' | 'updatedAt'>,
    amount = 1
  ) {
    if (!stats.value || !authStore.user?.id) return

    const currentValue = stats.value[statKey] as number
    const newValue = currentValue + amount

    const { error } = await supabase
      .from('user_stats')
      .update({ [camelToSnake(statKey)]: newValue })
      .eq('user_id', authStore.user.id)

    if (error) {
      console.error('[Gamification] Failed to increment stat:', error)
      return
    }

    ;(stats.value[statKey] as number) = newValue

    // Check achievements after stat update
    await checkAchievements()
  }

  /**
   * Track view/feature usage
   */
  async function trackViewUsage(viewName: string) {
    if (!stats.value || !authStore.user?.id) return
    if (stats.value.viewsUsed[viewName]) return // Already tracked

    const newViewsUsed = { ...stats.value.viewsUsed, [viewName]: true }

    const { error } = await supabase
      .from('user_stats')
      .update({ views_used: newViewsUsed })
      .eq('user_id', authStore.user.id)

    if (!error) {
      stats.value.viewsUsed = newViewsUsed
      // Check exploration achievements
      await checkAchievements()
    }
  }

  async function trackFeatureUsage(featureName: string) {
    if (!stats.value || !authStore.user?.id) return
    if (stats.value.featuresUsed[featureName]) return

    const newFeaturesUsed = { ...stats.value.featuresUsed, [featureName]: true }

    const { error } = await supabase
      .from('user_stats')
      .update({ features_used: newFeaturesUsed })
      .eq('user_id', authStore.user.id)

    if (!error) {
      stats.value.featuresUsed = newFeaturesUsed
    }
  }

  // =============================================================================
  // Shop System
  // =============================================================================

  /**
   * Purchase an item from the shop
   */
  async function purchaseItem(itemId: string): Promise<PurchaseResult> {
    if (!profile.value || !authStore.user?.id) {
      return { success: false, item: {} as ShopItem, xpSpent: 0, newAvailableXp: 0, error: 'Not logged in' }
    }

    const item = shopItems.value.find((i) => i.id === itemId)
    if (!item) {
      return { success: false, item: {} as ShopItem, xpSpent: 0, newAvailableXp: 0, error: 'Item not found' }
    }

    if (ownedItems.value.has(itemId)) {
      return { success: false, item, xpSpent: 0, newAvailableXp: profile.value.availableXp, error: 'Already owned' }
    }

    if (profile.value.availableXp < item.priceXp) {
      return { success: false, item, xpSpent: 0, newAvailableXp: profile.value.availableXp, error: 'Not enough XP' }
    }

    if (profile.value.level < item.requiredLevel) {
      return {
        success: false,
        item,
        xpSpent: 0,
        newAvailableXp: profile.value.availableXp,
        error: `Requires level ${item.requiredLevel}`,
      }
    }

    const newAvailableXp = profile.value.availableXp - item.priceXp

    try {
      // Insert purchase record
      await supabase.from('user_purchases').insert({
        user_id: authStore.user.id,
        item_id: itemId,
        xp_spent: item.priceXp,
      })

      // Log XP spent
      await supabase.from('xp_logs').insert({
        user_id: authStore.user.id,
        xp_amount: -item.priceXp,
        xp_type: 'spent',
        reason: 'purchase',
        metadata: { itemId, itemName: item.name },
      })

      // Update profile
      const updates: Partial<DbUserGamification> = {
        available_xp: newAvailableXp,
      }

      // Add to unlocked themes if it's a theme
      if (item.category === 'theme') {
        updates.unlocked_themes = [...profile.value.unlockedThemes, itemId]
      }

      await supabase.from('user_gamification').update(updates).eq('user_id', authStore.user.id)

      // Update local state
      profile.value.availableXp = newAvailableXp
      ownedItems.value.add(itemId)
      if (item.category === 'theme') {
        profile.value.unlockedThemes.push(itemId)
      }

      // Check theme purchase achievement
      await triggerSpecialAchievement('theme_purchased')

      return { success: true, item, xpSpent: item.priceXp, newAvailableXp }
    } catch (e) {
      console.error('[Gamification] Purchase failed:', e)
      return { success: false, item, xpSpent: 0, newAvailableXp: profile.value.availableXp, error: 'Purchase failed' }
    }
  }

  /**
   * Equip a theme
   */
  async function equipTheme(themeId: string) {
    if (!profile.value || !authStore.user?.id) return false

    // Must own the theme (or it's 'default')
    if (themeId !== 'default' && !ownedItems.value.has(themeId)) {
      console.warn('[Gamification] Cannot equip unowned theme:', themeId)
      return false
    }

    const { error } = await supabase
      .from('user_gamification')
      .update({ equipped_theme: themeId })
      .eq('user_id', authStore.user.id)

    if (error) {
      console.error('[Gamification] Failed to equip theme:', error)
      return false
    }

    profile.value.equippedTheme = themeId
    applyTheme(themeId)
    return true
  }

  /**
   * Apply theme CSS variables to document
   */
  function applyTheme(themeId: string) {
    const item = shopItems.value.find((i) => i.id === themeId)
    const root = document.documentElement

    // Remove previous custom theme
    root.style.removeProperty('--accent-primary')
    root.style.removeProperty('--accent-glow')

    if (themeId === 'default' || !item?.previewCss) return

    // Apply theme CSS variables
    for (const [key, value] of Object.entries(item.previewCss)) {
      root.style.setProperty(key, value)
    }
  }

  // =============================================================================
  // Toast/Notification System
  // =============================================================================

  function showXpToast(amount: number, reason: string, multipliers: XpMultiplier[]) {
    const toast: GamificationToast = {
      id: `xp-${Date.now()}`,
      type: 'xp',
      title: `+${amount} XP`,
      description: formatXpReason(reason),
      xpAmount: amount,
      duration: 3000,
    }
    toastQueue.value.push(toast)
  }

  function showLevelUpToast(newLevel: number) {
    const toast: GamificationToast = {
      id: `level-${Date.now()}`,
      type: 'level_up',
      title: `Level ${newLevel}!`,
      description: 'Congratulations on leveling up!',
      icon: 'arrow-up',
      duration: 5000,
    }
    toastQueue.value.push(toast)
  }

  function showAchievementToast(achievement: Achievement) {
    const toast: GamificationToast = {
      id: `achievement-${achievement.id}`,
      type: 'achievement',
      title: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      tier: achievement.tier,
      xpAmount: achievement.xpReward,
      duration: 5000,
    }
    toastQueue.value.push(toast)
  }

  function dismissToast(id: string) {
    const index = toastQueue.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toastQueue.value.splice(index, 1)
    }
  }

  // =============================================================================
  // Utilities
  // =============================================================================

  function formatXpReason(reason: string): string {
    const reasonMap: Record<string, string> = {
      task_complete: 'Task completed',
      pomodoro_complete: 'Pomodoro session',
      streak_bonus: 'Streak milestone',
      achievement: 'Achievement unlocked',
    }
    return reasonMap[reason] || reason
  }

  function camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  }

  // =============================================================================
  // Settings
  // =============================================================================

  function updateSettings(newSettings: Partial<GamificationSettings>) {
    settings.value = { ...settings.value, ...newSettings }
    localStorage.setItem('flowstate-gamification-settings', JSON.stringify(settings.value))
  }

  function loadSettings() {
    const saved = localStorage.getItem('flowstate-gamification-settings')
    if (saved) {
      try {
        settings.value = { ...settings.value, ...JSON.parse(saved) }
      } catch (e) {
        console.error('[Gamification] Failed to load settings:', e)
      }
    }
  }

  // =============================================================================
  // Watchers
  // =============================================================================

  // Initialize when auth changes
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth) {
        initialize()
      } else {
        // Reset state on logout
        profile.value = null
        stats.value = null
        userAchievements.value = new Map()
        ownedItems.value = new Set()
        isInitialized.value = false
      }
    },
    { immediate: true }
  )

  // Apply equipped theme on init
  watch(
    () => profile.value?.equippedTheme,
    (themeId) => {
      if (themeId && themeId !== 'default') {
        // Wait for shop items to load
        if (shopItems.value.length > 0) {
          applyTheme(themeId)
        }
      }
    }
  )

  // Load settings on mount
  loadSettings()

  // =============================================================================
  // Return
  // =============================================================================

  return {
    // State
    profile,
    stats,
    achievements,
    userAchievements,
    shopItems,
    ownedItems,
    recentXpLogs,
    toastQueue,
    isLoading,
    isInitialized,
    settings,

    // Computed
    isEnabled,
    totalXp,
    availableXp,
    currentLevel,
    levelInfo,
    streakInfo,
    equippedTheme,
    achievementsWithProgress,
    earnedAchievements,
    unlockedAchievementsCount,
    shopItemsWithOwnership,

    // Actions
    initialize,
    awardXp,
    recordDailyActivity,
    checkAchievements,
    triggerSpecialAchievement,
    incrementStat,
    trackViewUsage,
    trackFeatureUsage,
    purchaseItem,
    equipTheme,
    applyTheme,
    dismissToast,
    updateSettings,

    // Utilities
    getLevelInfo,
    levelFromXp,
    xpForLevel,
  }
})
