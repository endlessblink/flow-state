/**
 * AI Challenge Narrator Composable
 * TASK-1238: Watches gamification events and pushes narrative messages into AI chat
 *
 * This composable monitors gamification state for challenge completions, level ups,
 * streak milestones, and boss defeats, then automatically narrates them as assistant
 * messages in the AI chat panel.
 *
 * Architecture:
 * - Client-side narrative templates (no AI model call - instant, works offline)
 * - Cooldowns prevent spam
 * - Watches reactive state in gamification/challenges stores
 * - Messages appear as assistant messages with narrator: true metadata
 */

import { watch, ref, type Ref } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import { useChallengesStore } from '@/stores/challenges'
import { useAIChatStore } from '@/stores/aiChat'

// ============================================================================
// Types
// ============================================================================

type NarratorEventType =
  | 'challenge_complete'
  | 'challenge_fail'
  | 'level_up'
  | 'streak_milestone'
  | 'boss_defeat'

interface NarratorEvent {
  type: NarratorEventType
  data: Record<string, unknown>
  timestamp: number
}

// ============================================================================
// Constants
// ============================================================================

/** Cooldowns to prevent spam (in ms) */
const COOLDOWNS: Record<NarratorEventType, number> = {
  challenge_complete: 30_000,    // 30s between challenge complete narrations
  challenge_fail: 60_000,        // 1min between challenge fail narrations
  level_up: 0,                   // always narrate level ups
  streak_milestone: 0,           // always narrate streak milestones
  boss_defeat: 0,                // always narrate boss defeats
}

/** Streak milestones that trigger narration */
const STREAK_MILESTONES = [5, 10, 25, 50, 100]

// ============================================================================
// Composable
// ============================================================================

export function useAIChallengeNarrator() {
  const gamificationStore = useGamificationStore()
  const challengesStore = useChallengesStore()
  const chatStore = useAIChatStore()

  const lastEventTimes = ref<Record<string, number>>({})
  const isEnabled = ref(true)
  const stopWatchers: Array<() => void> = []

  /**
   * Check if we can narrate an event type (respects cooldowns).
   */
  function canNarrate(type: NarratorEventType): boolean {
    const cooldown = COOLDOWNS[type] ?? 30_000
    const lastTime = lastEventTimes.value[type] || 0
    return Date.now() - lastTime > cooldown
  }

  /**
   * Record that an event type was narrated (for cooldown tracking).
   */
  function recordEvent(type: NarratorEventType) {
    lastEventTimes.value[type] = Date.now()
  }

  /**
   * Generate a short narrative message for an event.
   * These are client-side templates (no AI model call needed).
   */
  function generateNarration(event: NarratorEvent): string {
    switch (event.type) {
      case 'challenge_complete': {
        const title = (event.data.title as string) || 'a challenge'
        const xp = (event.data.rewardXp as number) || 0
        return `**Challenge Complete!** You conquered "${title}" and earned **+${xp} XP**. Keep pushing!`
      }
      case 'challenge_fail': {
        const title = (event.data.title as string) || 'a challenge'
        return `**Challenge Expired:** "${title}" didn't make it this time. New challenges await tomorrow.`
      }
      case 'level_up': {
        const level = (event.data.level as number) || 1
        return `**Level Up!** You reached **Level ${level}**! New abilities unlocked on the Grid.`
      }
      case 'streak_milestone': {
        const streak = (event.data.streak as number) || 0
        return `**Streak Milestone!** ${streak} days of consistent productivity. You're on fire!`
      }
      case 'boss_defeat': {
        const title = (event.data.title as string) || 'the Boss'
        const xp = (event.data.rewardXp as number) || 0
        return `**Boss Defeated!** You took down "${title}" and claimed **+${xp} XP**. Legendary.`
      }
      default:
        return ''
    }
  }

  /**
   * Push a narration to the AI chat.
   */
  function pushNarration(event: NarratorEvent) {
    if (!isEnabled.value) return
    if (!canNarrate(event.type)) return

    const message = generateNarration(event)
    if (!message) return

    recordEvent(event.type)

    // Push as system-like assistant message with narrator metadata
    chatStore.addAssistantMessage(message, {
      metadata: {
        narrator: true,
        eventType: event.type,
      } as any,
    })
  }

  /**
   * Start watching gamification events.
   */
  function start() {
    // Watch for level changes
    const stopLevel = watch(
      () => gamificationStore.profile?.level,
      (newLevel, oldLevel) => {
        if (oldLevel !== undefined && newLevel !== undefined && newLevel > oldLevel) {
          pushNarration({
            type: 'level_up',
            data: { level: newLevel },
            timestamp: Date.now(),
          })
        }
      }
    )
    stopWatchers.push(stopLevel)

    // Watch for streak milestones
    const stopStreak = watch(
      () => gamificationStore.profile?.currentStreak,
      (newStreak, oldStreak) => {
        if (
          oldStreak !== undefined &&
          newStreak !== undefined &&
          newStreak > oldStreak &&
          STREAK_MILESTONES.includes(newStreak)
        ) {
          pushNarration({
            type: 'streak_milestone',
            data: { streak: newStreak },
            timestamp: Date.now(),
          })
        }
      }
    )
    stopWatchers.push(stopStreak)

    // Watch the challenges store for completed challenges
    // The completedTodayCount will increase when a challenge completes
    const stopChallengeComplete = watch(
      () => challengesStore.completedTodayCount,
      (newCount, oldCount) => {
        if (oldCount !== undefined && newCount > oldCount) {
          // Find the most recently completed challenge
          const completed = challengesStore.activeChallenges.find(
            c => c.status === 'completed' && isToday(c.completedAt)
          )
          if (completed) {
            pushNarration({
              type: completed.challengeType === 'boss' ? 'boss_defeat' : 'challenge_complete',
              data: { title: completed.title, rewardXp: completed.rewardXp },
              timestamp: Date.now(),
            })
          }
        }
      }
    )
    stopWatchers.push(stopChallengeComplete)

    // Watch for challenge failures (status change to 'expired' or 'failed')
    // We can detect this by watching the activeChallenges array for failed challenges
    const stopChallengeFail = watch(
      () => challengesStore.activeChallenges.filter(c => c.status === 'expired' || c.status === 'failed').length,
      (newCount, oldCount) => {
        if (oldCount !== undefined && newCount > oldCount) {
          // Find the most recently failed challenge
          const failed = challengesStore.activeChallenges.find(
            c => (c.status === 'expired' || c.status === 'failed')
          )
          if (failed) {
            pushNarration({
              type: 'challenge_fail',
              data: { title: failed.title },
              timestamp: Date.now(),
            })
          }
        }
      }
    )
    stopWatchers.push(stopChallengeFail)
  }

  /**
   * Stop watching gamification events.
   */
  function stop() {
    stopWatchers.forEach(fn => fn())
    stopWatchers.length = 0
  }

  /**
   * Enable/disable narration.
   */
  function setEnabled(enabled: boolean) {
    isEnabled.value = enabled
  }

  /**
   * Helper to check if a date is today.
   */
  function isToday(date: Date | undefined): boolean {
    if (!date) return false
    const today = new Date()
    const dateToCheck = new Date(date)
    return (
      dateToCheck.getFullYear() === today.getFullYear() &&
      dateToCheck.getMonth() === today.getMonth() &&
      dateToCheck.getDate() === today.getDate()
    )
  }

  return {
    start,
    stop,
    isEnabled,
    setEnabled,
  }
}
