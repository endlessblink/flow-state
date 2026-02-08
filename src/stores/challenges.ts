/**
 * Challenges Store for Cyberflow RPG
 * FEATURE-1132: AI-driven challenge system with daily missions and weekly bosses
 *
 * This store manages:
 * - Active challenges (3 dailies + 1 weekly boss)
 * - Challenge progress tracking
 * - Expiry and penalty handling
 * - Corruption level updates
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase } from '@/services/auth/supabase'
import { useAuthStore } from '@/stores/auth'
import { useGamificationStore } from '@/stores/gamification'
import type {
  Challenge,
  ChallengeType,
  ChallengeStatus,
  ChallengeObjective,
  ChallengeProgressEvent,
  DbChallenge,
  CorruptionTierConfig,
} from '@/types/challenges'
import {
  mapDbChallenge,
  mapChallengeToDb,
  getCorruptionTier,
  CORRUPTION_DELTAS,
} from '@/types/challenges'
import {
  generateDailyChallenges,
  generateWeeklyBoss,
  buildGenerationContext,
  type GameMasterOptions,
} from '@/services/ai/gamemaster'
import {
  getCompletionNarrative,
  getFailureNarrative,
} from '@/services/ai/challengeTemplates'

// =============================================================================
// Helper: Get local date string for timezone-safe comparisons
// =============================================================================

function getLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// =============================================================================
// Store Definition
// =============================================================================

export const useChallengesStore = defineStore('challenges', () => {
  const authStore = useAuthStore()
  const gamificationStore = useGamificationStore()

  // ===========================================================================
  // State
  // ===========================================================================

  const activeChallenges = ref<Challenge[]>([])
  const isGenerating = ref(false)
  const isLoading = ref(false)
  const isInitialized = ref(false)
  const lastDailyGeneration = ref<string | null>(null)
  const lastWeeklyGeneration = ref<string | null>(null)
  const corruptionLevel = ref(0)
  const activeMultiplier = ref(1.0)

  // Progress tracking mutex to prevent race conditions
  const progressInProgress = ref(false)

  // Midnight refresh timeout
  let midnightTimeout: ReturnType<typeof setTimeout> | null = null

  // ===========================================================================
  // Computed
  // ===========================================================================

  const activeDailies = computed(() =>
    activeChallenges.value.filter(
      c => c.challengeType === 'daily' && c.status === 'active'
    )
  )

  const activeBoss = computed(() =>
    activeChallenges.value.find(
      c => c.challengeType === 'boss' && c.status === 'active'
    )
  )

  const completedTodayCount = computed(() =>
    activeChallenges.value.filter(
      c => c.status === 'completed' && isToday(c.completedAt)
    ).length
  )

  const hasActiveChallenges = computed(() => activeDailies.value.length > 0)

  const corruptionTier = computed((): CorruptionTierConfig =>
    getCorruptionTier(corruptionLevel.value)
  )

  const allDailiesComplete = computed(() =>
    activeDailies.value.length === 0 &&
    activeChallenges.value.filter(
      c => c.challengeType === 'daily' && c.status === 'completed' && isToday(c.completedAt)
    ).length >= 3
  )

  // ===========================================================================
  // Initialization
  // ===========================================================================

  async function initialize() {
    if (!supabase || !authStore.isAuthenticated || !authStore.user?.id) {
      console.log('[Challenges] Skipping init - no auth')
      return
    }

    if (isInitialized.value) {
      console.log('[Challenges] Already initialized')
      return
    }

    isLoading.value = true
    const userId = authStore.user.id

    try {
      console.log('[Challenges] Initializing for user:', userId.slice(0, 8))

      // Load active challenges
      await loadActiveChallenges(userId)

      // Load corruption level from user_gamification
      await loadCorruptionState(userId)

      // Check for expired challenges and apply penalties
      await processExpiredChallenges()

      // Check if we need new dailies
      const today = getLocalDateString()
      if (lastDailyGeneration.value !== today && activeDailies.value.length === 0) {
        console.log('[Challenges] Need to generate daily challenges')
        // Don't auto-generate here - let the UI trigger it
      }

      // Check if we need a weekly boss (Monday)
      const now = new Date()
      const isMonday = now.getDay() === 1
      const weekStart = getWeekStartString()
      if (isMonday && lastWeeklyGeneration.value !== weekStart && !activeBoss.value) {
        console.log('[Challenges] Need to generate weekly boss')
        // Don't auto-generate here - let the UI trigger it
      }

      // Set up midnight refresh
      scheduleMidnightRefresh()

      isInitialized.value = true
      console.log('[Challenges] Initialized successfully')
    } catch (e) {
      console.error('[Challenges] Initialization failed:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function loadActiveChallenges(userId: string) {
    const { data, error } = await supabase
      .from('user_challenges')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'completed'])
      .order('generated_at', { ascending: false })

    if (error) throw error

    activeChallenges.value = (data || []).map((row: DbChallenge) => mapDbChallenge(row))

    // Determine last generation dates
    const dailies = activeChallenges.value.filter(c => c.challengeType === 'daily')
    const bosses = activeChallenges.value.filter(c => c.challengeType === 'boss')

    if (dailies.length > 0) {
      lastDailyGeneration.value = getLocalDateString(dailies[0].generatedAt)
    }
    if (bosses.length > 0) {
      lastWeeklyGeneration.value = getWeekStartString(bosses[0].generatedAt)
    }
  }

  async function loadCorruptionState(userId: string) {
    const { data, error } = await supabase
      .from('user_gamification')
      .select('corruption_level, active_multiplier')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.warn('[Challenges] Failed to load corruption state:', error)
      return
    }

    if (data) {
      corruptionLevel.value = data.corruption_level ?? 0
      activeMultiplier.value = data.active_multiplier ?? 1.0
    }
  }

  // ===========================================================================
  // Challenge Generation
  // ===========================================================================

  async function generateDailyChallengesAction(
    aiOptions: GameMasterOptions
  ): Promise<Challenge[]> {
    if (!authStore.user?.id) throw new Error('Not authenticated')
    if (isGenerating.value) throw new Error('Generation already in progress')

    isGenerating.value = true
    const userId = authStore.user.id
    const today = getLocalDateString()

    try {
      // Build context from current state
      const context = await buildContextFromState()

      // Generate challenges via AI or templates
      const generated = await generateDailyChallenges(context, aiOptions)

      // Calculate expiry (midnight tonight)
      const expiresAt = new Date()
      expiresAt.setHours(23, 59, 59, 999)

      // Save to database
      const challenges: Challenge[] = []
      for (const gen of generated) {
        const challenge: Partial<Challenge> = {
          userId,
          challengeType: 'daily',
          title: gen.title,
          description: gen.description,
          objectiveType: gen.objective_type,
          objectiveTarget: gen.objective_target,
          objectiveCurrent: 0,
          objectiveContext: gen.project_name || gen.hour
            ? { projectName: gen.project_name, hour: gen.hour }
            : undefined,
          rewardXp: gen.reward_xp,
          penaltyXp: gen.penalty_xp,
          difficulty: gen.difficulty,
          narrativeFlavor: gen.narrative_flavor,
          status: 'active',
          generatedAt: new Date(),
          expiresAt,
          aiContext: context as unknown as Record<string, unknown>,
        }

        const { data, error } = await supabase
          .from('user_challenges')
          .insert(mapChallengeToDb(challenge))
          .select()
          .single()

        if (error) throw error
        challenges.push(mapDbChallenge(data))
      }

      // Update state
      activeChallenges.value = [...challenges, ...activeChallenges.value]
      lastDailyGeneration.value = today

      // Update last_daily_generation in user_gamification
      await supabase
        .from('user_gamification')
        .update({ last_daily_generation: today })
        .eq('user_id', userId)

      // Set active multiplier (challenges active = 2x XP)
      await updateActiveMultiplier(2.0)

      console.log('[Challenges] Generated', challenges.length, 'daily challenges')
      return challenges
    } finally {
      isGenerating.value = false
    }
  }

  async function generateWeeklyBossAction(
    aiOptions: GameMasterOptions
  ): Promise<Challenge> {
    if (!authStore.user?.id) throw new Error('Not authenticated')
    if (isGenerating.value) throw new Error('Generation already in progress')

    isGenerating.value = true
    const userId = authStore.user.id
    const weekStart = getWeekStartString()

    try {
      // Build context from current state
      const context = await buildContextFromState()

      // Generate boss via AI or templates
      const generated = await generateWeeklyBoss(context, aiOptions)

      // Calculate expiry (end of week - Sunday 23:59:59)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + (7 - expiresAt.getDay()))
      expiresAt.setHours(23, 59, 59, 999)

      const challenge: Partial<Challenge> = {
        userId,
        challengeType: 'boss',
        title: generated.title,
        description: generated.description,
        objectiveType: generated.objective_type,
        objectiveTarget: generated.objective_target,
        objectiveCurrent: 0,
        rewardXp: generated.reward_xp,
        rewardBonus: generated.special_reward
          ? { cosmetic: generated.special_reward }
          : undefined,
        penaltyXp: generated.penalty_xp,
        difficulty: 'boss',
        narrativeFlavor: generated.narrative_flavor,
        status: 'active',
        generatedAt: new Date(),
        expiresAt,
        aiContext: {
          ...(context as unknown as Record<string, unknown>),
          total_hp: generated.total_hp,
        },
      }

      const { data, error } = await supabase
        .from('user_challenges')
        .insert(mapChallengeToDb(challenge))
        .select()
        .single()

      if (error) throw error

      const boss = mapDbChallenge(data)
      activeChallenges.value = [boss, ...activeChallenges.value]
      lastWeeklyGeneration.value = weekStart

      // Update last_weekly_generation in user_gamification
      await supabase
        .from('user_gamification')
        .update({ last_weekly_generation: weekStart })
        .eq('user_id', userId)

      console.log('[Challenges] Generated weekly boss:', boss.title)
      return boss
    } finally {
      isGenerating.value = false
    }
  }

  // ===========================================================================
  // Progress Tracking
  // ===========================================================================

  async function checkChallengeProgress(
    event: ChallengeProgressEvent
  ): Promise<{ completed: Challenge[]; updated: Challenge[] }> {
    if (!authStore.user?.id || progressInProgress.value) {
      return { completed: [], updated: [] }
    }

    progressInProgress.value = true
    const completed: Challenge[] = []
    const updated: Challenge[] = []

    try {
      // Find matching active challenges
      const matching = activeChallenges.value.filter(c =>
        c.status === 'active' && matchesObjective(c, event)
      )

      for (const challenge of matching) {
        const increment = event.amount ?? 1
        const newCurrent = challenge.objectiveCurrent + increment

        // Update in database (atomic)
        const { data, error } = await supabase
          .from('user_challenges')
          .update({
            objective_current: newCurrent,
            updated_at: new Date().toISOString(),
          })
          .eq('id', challenge.id)
          .select()
          .single()

        if (error) {
          console.warn('[Challenges] Failed to update progress:', error)
          continue
        }

        const updatedChallenge = mapDbChallenge(data)

        // Check for completion
        if (updatedChallenge.objectiveCurrent >= updatedChallenge.objectiveTarget) {
          await completeChallenge(updatedChallenge)
          completed.push(updatedChallenge)
        } else {
          updated.push(updatedChallenge)
        }

        // Update local state
        const index = activeChallenges.value.findIndex(c => c.id === challenge.id)
        if (index !== -1) {
          activeChallenges.value[index] = updatedChallenge
        }
      }

      return { completed, updated }
    } finally {
      progressInProgress.value = false
    }
  }

  function matchesObjective(challenge: Challenge, event: ChallengeProgressEvent): boolean {
    if (challenge.objectiveType !== event.type) return false

    // Check context-specific matches
    if (challenge.objectiveType === 'complete_project_tasks') {
      if (challenge.objectiveContext?.projectName && event.context?.projectId) {
        // Would need to look up project name from ID
        // For now, match any project task
        return true
      }
    }

    if (challenge.objectiveType === 'complete_before_hour') {
      const currentHour = new Date().getHours()
      const targetHour = challenge.objectiveContext?.hour ?? 12
      if (currentHour >= targetHour) return false
    }

    if (challenge.objectiveType === 'complete_high_priority') {
      if (event.context?.priority !== 'high') return false
    }

    if (challenge.objectiveType === 'clear_overdue') {
      if (!event.context?.wasOverdue) return false
    }

    return true
  }

  // ===========================================================================
  // Challenge Completion
  // ===========================================================================

  async function completeChallenge(challenge: Challenge): Promise<void> {
    if (!authStore.user?.id) return

    const now = new Date()
    const userId = authStore.user.id

    // Update challenge status in DB
    const { error: updateError } = await supabase
      .from('user_challenges')
      .update({
        status: 'completed',
        completed_at: now.toISOString(),
      })
      .eq('id', challenge.id)

    if (updateError) {
      console.warn('[Challenges] Failed to complete challenge:', updateError)
      return
    }

    // Award XP
    await gamificationStore.awardXp(challenge.rewardXp, 'challenge_complete', {
      metadata: { challengeId: challenge.id, challengeTitle: challenge.title },
    })

    // Update corruption (decrease)
    const corruptionDelta = challenge.challengeType === 'boss'
      ? CORRUPTION_DELTAS.BOSS_COMPLETED
      : CORRUPTION_DELTAS.DAILY_COMPLETED
    await updateCorruption(corruptionDelta)

    // DB trigger archive_challenge_to_history handles history insertion automatically

    // Update stats counters
    await updateChallengeCounters(challenge.challengeType, 'completed')

    // Check for all-dailies bonus
    const completedDailiesCount = activeChallenges.value.filter(
      c => c.challengeType === 'daily' && c.status === 'completed' && isToday(c.completedAt)
    ).length + 1 // Include this one

    if (completedDailiesCount >= 3) {
      // All 3 dailies completed - bonus!
      await updateCorruption(CORRUPTION_DELTAS.ALL_DAILIES_BONUS)
      console.log('[Challenges] All dailies complete! Bonus corruption reduction applied')
    }

    // Update local state
    const index = activeChallenges.value.findIndex(c => c.id === challenge.id)
    if (index !== -1) {
      activeChallenges.value[index] = { ...challenge, status: 'completed', completedAt: now }
    }

    console.log('[Challenges] Completed:', challenge.title, '+', challenge.rewardXp, 'XP')
  }

  // ===========================================================================
  // Expiry and Penalties
  // ===========================================================================

  async function processExpiredChallenges(): Promise<void> {
    const now = new Date()
    const expired = activeChallenges.value.filter(
      c => c.status === 'active' && c.expiresAt < now
    )

    for (const challenge of expired) {
      await failChallenge(challenge, 'expired')
    }
  }

  async function failChallenge(
    challenge: Challenge,
    reason: 'expired' | 'failed'
  ): Promise<void> {
    if (!authStore.user?.id) return

    // Update status in DB
    const { error: updateError } = await supabase
      .from('user_challenges')
      .update({ status: reason })
      .eq('id', challenge.id)

    if (updateError) {
      console.warn('[Challenges] Failed to fail challenge:', updateError)
      return
    }

    // Apply XP penalty if any
    if (challenge.penaltyXp > 0) {
      try {
        await gamificationStore.awardXp(-challenge.penaltyXp, 'challenge_penalty', {
          metadata: { challengeId: challenge.id, challengeTitle: challenge.title },
        })
      } catch (e) {
        console.warn('[Challenges] Failed to apply XP penalty:', e)
      }
    }

    // Update corruption (increase)
    const corruptionDelta = challenge.challengeType === 'boss'
      ? CORRUPTION_DELTAS.BOSS_FAILED
      : CORRUPTION_DELTAS.DAILY_FAILED
    await updateCorruption(corruptionDelta)

    // DB trigger archive_challenge_to_history handles history insertion automatically

    // Update stats counters
    await updateChallengeCounters(challenge.challengeType, 'failed')

    // Update local state
    const index = activeChallenges.value.findIndex(c => c.id === challenge.id)
    if (index !== -1) {
      activeChallenges.value[index] = { ...challenge, status: reason as ChallengeStatus }
    }

    console.log('[Challenges] Failed:', challenge.title, 'Corruption +', corruptionDelta)
  }

  // ===========================================================================
  // Corruption Management
  // ===========================================================================

  async function updateCorruption(delta: number): Promise<void> {
    if (!authStore.user?.id) return

    const newLevel = Math.max(0, Math.min(100, corruptionLevel.value + delta))
    corruptionLevel.value = newLevel

    // Update in DB
    const { error } = await supabase
      .from('user_gamification')
      .update({ corruption_level: newLevel })
      .eq('user_id', authStore.user.id)

    if (error) {
      console.warn('[Challenges] Failed to update corruption:', error)
    }

    // Update CSS custom properties for visual effects
    updateCorruptionCSSProperties(newLevel)
  }

  async function updateActiveMultiplier(multiplier: number): Promise<void> {
    if (!authStore.user?.id) return

    activeMultiplier.value = multiplier

    const { error } = await supabase
      .from('user_gamification')
      .update({ active_multiplier: multiplier })
      .eq('user_id', authStore.user.id)

    if (error) {
      console.warn('[Challenges] Failed to update multiplier:', error)
    }
  }

  function updateCorruptionCSSProperties(level: number): void {
    const tier = getCorruptionTier(level)
    const root = document.documentElement

    root.style.setProperty('--corruption-level', String(level))
    root.style.setProperty('--corruption-filter', tier.filter)
    root.style.setProperty('--corruption-noise-opacity', String(tier.noiseOpacity))
    root.style.setProperty('--corruption-scanline-opacity', String(tier.scanlineOpacity))
    root.style.setProperty('--corruption-glitch-intensity', String(tier.glitchIntensity))
  }

  // ===========================================================================
  // History and Stats
  // ===========================================================================

  async function archiveToHistory(
    challenge: Challenge,
    status: 'completed' | 'failed' | 'expired'
  ): Promise<void> {
    if (!authStore.user?.id) return

    const completionRate = challenge.objectiveCurrent / challenge.objectiveTarget
    const now = new Date()

    const { error } = await supabase.from('challenge_history').insert({
      user_id: authStore.user.id,
      challenge_id: challenge.id,
      challenge_type: challenge.challengeType,
      objective_type: challenge.objectiveType,
      difficulty: challenge.difficulty,
      status,
      xp_earned: status === 'completed' ? challenge.rewardXp : 0,
      xp_lost: status !== 'completed' ? challenge.penaltyXp : 0,
      objective_target: challenge.objectiveTarget,
      objective_achieved: challenge.objectiveCurrent,
      generated_at: challenge.generatedAt.toISOString(),
      resolved_at: now.toISOString(),
    })

    if (error) {
      console.warn('[Challenges] Failed to archive to history:', error)
    }
  }

  async function updateChallengeCounters(
    type: ChallengeType,
    result: 'completed' | 'failed'
  ): Promise<void> {
    if (!authStore.user?.id || result === 'failed') return

    try {
      const { data } = await supabase
        .from('user_gamification')
        .select('total_challenges_completed, daily_challenges_completed, weekly_challenges_completed, boss_fights_won')
        .eq('user_id', authStore.user.id)
        .single()
      if (!data) return

      const updates: Record<string, number> = {
        total_challenges_completed: (data.total_challenges_completed ?? 0) + 1,
      }
      if (type === 'daily') {
        updates.daily_challenges_completed = (data.daily_challenges_completed ?? 0) + 1
      } else if (type === 'weekly' || type === 'boss') {
        updates.weekly_challenges_completed = (data.weekly_challenges_completed ?? 0) + 1
        if (type === 'boss') {
          updates.boss_fights_won = (data.boss_fights_won ?? 0) + 1
        }
      }

      const { error } = await supabase
        .from('user_gamification')
        .update(updates)
        .eq('user_id', authStore.user.id)
      if (error) console.warn('[Challenges] Failed to update counters:', error)
    } catch (e) {
      console.warn('[Challenges] Counter update failed:', e)
    }
  }

  // ===========================================================================
  // Helper Functions
  // ===========================================================================

  async function buildContextFromState() {
    const stats = gamificationStore.stats
    const profile = gamificationStore.profile
    const streakInfo = gamificationStore.streakInfo

    // Get recent challenge history for difficulty calculation
    let recentCompleted = 0
    let recentFailed = 0
    let recentTypes: ChallengeObjective[] = []

    if (authStore.user?.id) {
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

      const { data } = await supabase
        .from('challenge_history')
        .select('status, objective_type')
        .eq('user_id', authStore.user.id)
        .gte('resolved_at', twoWeeksAgo.toISOString())

      if (data) {
        recentCompleted = data.filter((h: { status: string }) => h.status === 'completed').length
        recentFailed = data.filter((h: { status: string }) => h.status !== 'completed').length
        recentTypes = data.map((h: { objective_type: ChallengeObjective }) => h.objective_type)
      }
    }

    // Get projects (from task store would be ideal, but simplified for now)
    const projects: { id: string; name: string; taskCount: number; overdueCount: number }[] = []

    return buildGenerationContext({
      tasksCompleted: stats?.tasksCompleted ?? 0,
      overdueCount: 0, // Would need task store integration
      focusTimeToday: stats?.totalFocusMinutes ?? 0,
      pomodorosToday: stats?.pomodorosCompleted ?? 0,
      currentStreak: streakInfo.currentStreak,
      longestStreak: streakInfo.longestStreak,
      isStreakActive: streakInfo.isActiveToday,
      corruptionLevel: corruptionLevel.value,
      recentCompleted,
      recentFailed,
      recentTypes,
      projects,
      averageTasksPerDay: Math.max(5, Math.round((stats?.tasksCompleted ?? 0) / 30)),
      averagePomodorosPerDay: Math.max(3, Math.round((stats?.pomodorosCompleted ?? 0) / 30)),
      preferredHours: [9, 10, 11, 14, 15],
      topProjects: [],
    })
  }

  function isToday(date: Date | undefined): boolean {
    if (!date) return false
    return getLocalDateString(date) === getLocalDateString()
  }

  function getWeekStartString(date: Date = new Date()): string {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay()) // Go to Sunday
    return getLocalDateString(d)
  }

  function scheduleMidnightRefresh(): void {
    if (midnightTimeout) {
      clearTimeout(midnightTimeout)
    }

    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 1, 0)

    const msUntilMidnight = tomorrow.getTime() - now.getTime()

    midnightTimeout = setTimeout(() => {
      console.log('[Challenges] Midnight refresh triggered')
      processExpiredChallenges()
      // Reset multiplier if no challenges active
      if (activeDailies.value.length === 0) {
        updateActiveMultiplier(1.0)
      }
      scheduleMidnightRefresh() // Schedule next
    }, msUntilMidnight)

    console.log('[Challenges] Midnight refresh scheduled in', Math.round(msUntilMidnight / 60000), 'minutes')
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  function dispose(): void {
    if (midnightTimeout) {
      clearTimeout(midnightTimeout)
      midnightTimeout = null
    }
    isInitialized.value = false
    activeChallenges.value = []
  }

  // ===========================================================================
  // Watch for Auth Changes
  // ===========================================================================

  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth && !isInitialized.value) {
        initialize()
      } else if (!isAuth) {
        dispose()
      }
    },
    { immediate: true }
  )

  // Watch corruption level and update CSS
  watch(corruptionLevel, (level) => {
    updateCorruptionCSSProperties(level)
  }, { immediate: true })

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    // State
    activeChallenges,
    isGenerating,
    isLoading,
    isInitialized,
    lastDailyGeneration,
    lastWeeklyGeneration,
    corruptionLevel,
    activeMultiplier,

    // Computed
    activeDailies,
    activeBoss,
    completedTodayCount,
    hasActiveChallenges,
    corruptionTier,
    allDailiesComplete,

    // Actions
    initialize,
    generateDailyChallengesAction,
    generateWeeklyBossAction,
    checkChallengeProgress,
    completeChallenge,
    failChallenge,
    processExpiredChallenges,
    updateCorruption,

    // Narratives
    getCompletionNarrative,
    getFailureNarrative,

    // Cleanup
    dispose,
  }
})
