/**
 * XP Animation Event System
 * FEATURE-1118 Cyberflow: Replace toast notifications with live widget animations
 *
 * This composable watches the gamification store for XP changes and emits
 * animation events that are consumed by header widgets (XpBar, LevelBadge, StreakCounter).
 */

import { ref, watch, computed } from 'vue'
import { useGamificationStore } from '@/stores/gamification'

export interface XpAnimationEvent {
  id: string
  type: 'xp_gain' | 'level_up' | 'shielded' | 'achievement' | 'streak'
  amount?: number          // XP amount for floater
  color: string            // CSS color for the animation
  timestamp: number
}

export function useXpAnimations() {
  const gamificationStore = useGamificationStore()

  const activeEvents = ref<XpAnimationEvent[]>([])
  const isAnimating = ref(false)
  const lastXpTotal = ref(gamificationStore.totalXp)
  const lastLevel = ref(gamificationStore.currentLevel)

  // Watch totalXp for changes — when it goes up, trigger animation
  watch(() => gamificationStore.totalXp, (newXp, oldXp) => {
    if (newXp > oldXp) {
      const gained = newXp - oldXp
      triggerEvent({
        type: 'xp_gain',
        amount: gained,
        color: 'rgba(var(--neon-cyan), 1)'
      })
    }
    lastXpTotal.value = newXp
  })

  // Watch level for level-up
  watch(() => gamificationStore.currentLevel, (newLevel, oldLevel) => {
    if (newLevel > oldLevel) {
      triggerEvent({
        type: 'level_up',
        amount: newLevel,
        color: 'rgba(var(--neon-magenta), 1)'
      })
    }
    lastLevel.value = newLevel
  })

  // Watch toastQueue for shielded/achievement events (consume and convert to animations)
  watch(() => gamificationStore.toastQueue, (queue) => {
    for (const toast of queue) {
      if (toast.type === 'exposure' && toast.title === 'SHIELDED') {
        triggerEvent({
          type: 'shielded',
          color: 'rgba(var(--neon-cyan), 1)'
        })
        // Auto-dismiss the toast since we're handling it as animation
        gamificationStore.dismissToast(toast.id)
      } else if (toast.type === 'achievement') {
        triggerEvent({
          type: 'achievement',
          amount: toast.xpAmount,
          color: 'var(--cf-gold, rgba(255, 215, 0, 1))'
        })
        // Keep achievement toasts — they're important enough to show
      } else if (toast.type === 'xp') {
        // XP toasts are now handled by the counter animation
        gamificationStore.dismissToast(toast.id)
      } else if (toast.type === 'level_up') {
        // Level-up handled by badge animation
        gamificationStore.dismissToast(toast.id)
      }
    }
  }, { deep: true })

  function triggerEvent(partial: Omit<XpAnimationEvent, 'id' | 'timestamp'>) {
    const event: XpAnimationEvent = {
      ...partial,
      id: `anim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now()
    }
    activeEvents.value.push(event)
    isAnimating.value = true

    // Clean up event after animation completes
    setTimeout(() => {
      activeEvents.value = activeEvents.value.filter(e => e.id !== event.id)
      if (activeEvents.value.length === 0) {
        isAnimating.value = false
      }
    }, 2000)
  }

  // Get the most recent event for each component to react to
  const latestXpEvent = computed(() => {
    const events = activeEvents.value.filter(e => e.type === 'xp_gain')
    return events[events.length - 1]
  })
  const latestLevelEvent = computed(() => {
    const events = activeEvents.value.filter(e => e.type === 'level_up')
    return events[events.length - 1]
  })
  const latestShieldEvent = computed(() => {
    const events = activeEvents.value.filter(e => e.type === 'shielded')
    return events[events.length - 1]
  })

  return {
    activeEvents,
    isAnimating,
    latestXpEvent,
    latestLevelEvent,
    latestShieldEvent,
    triggerEvent,
  }
}
