/**
 * AI Proactive Nudges
 *
 * Watches user activity and pushes contextual suggestions to the AI chat.
 * Uses localStorage for cooldown tracking to avoid spam.
 *
 * @see TASK-1283 in MASTER_PLAN.md
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAIChatStore } from '@/stores/aiChat'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useGamificationStore } from '@/stores/gamification'
import { useChallengesStore } from '@/stores/challenges'

// ============================================================================
// Constants
// ============================================================================

const NUDGE_STORAGE_KEY = 'flowstate-nudge-cooldowns'
const CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/** Cooldowns in milliseconds */
const COOLDOWNS = {
  morning: 24 * 60 * 60 * 1000,       // 1x/day
  evening: 24 * 60 * 60 * 1000,       // 1x/day
  idle: 2 * 60 * 60 * 1000,           // 1x/2hr
  taskCompleted: 5 * 60 * 1000,       // 1x/5min
  streakAtRisk: 24 * 60 * 60 * 1000,  // 1x/day
  challengeExpiring: 2 * 60 * 60 * 1000, // 1x/2hr
} as const

type NudgeType = keyof typeof COOLDOWNS

// ============================================================================
// Cooldown Storage
// ============================================================================

function getCooldowns(): Record<string, number> {
  try {
    const raw = localStorage.getItem(NUDGE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setCooldown(type: NudgeType) {
  try {
    const cooldowns = getCooldowns()
    cooldowns[type] = Date.now()
    localStorage.setItem(NUDGE_STORAGE_KEY, JSON.stringify(cooldowns))
  } catch {
    // silently ignore
  }
}

function canNudge(type: NudgeType): boolean {
  const cooldowns = getCooldowns()
  const lastTime = cooldowns[type]
  if (!lastTime) return true
  return Date.now() - lastTime > COOLDOWNS[type]
}

// ============================================================================
// Composable
// ============================================================================

export function useAIProactiveNudges() {
  const isActive = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null
  let lastActivityTime = Date.now()

  // Track user activity for idle detection
  function onUserActivity() {
    lastActivityTime = Date.now()
  }

  /**
   * Push a nudge message to the AI chat.
   */
  function pushNudge(type: NudgeType, content: string, actions?: Array<{ label: string; handler: () => void }>) {
    if (!canNudge(type)) return

    const chatStore = useAIChatStore()
    if (!chatStore.isInitialized || !chatStore.isPanelOpen) return

    const nudgeActions = actions?.map((a, i) => ({
      id: `nudge_${type}_${Date.now()}_${i}`,
      label: a.label,
      variant: 'secondary' as const,
      handler: async () => a.handler(),
      completed: false,
    }))

    chatStore.addAssistantMessage(content, {
      actions: nudgeActions,
      metadata: { model: 'system' },
    })

    setCooldown(type)
  }

  /**
   * Check all nudge conditions and push any that trigger.
   */
  function checkNudges() {
    const hour = new Date().getHours()

    // ── Morning greeting (6-10am) ──
    if (hour >= 6 && hour < 10 && canNudge('morning')) {
      try {
        const taskStore = useTaskStore()
        const todayStr = new Date().toISOString().split('T')[0]
        const normDate = (d: string) => d.includes('T') ? d.split('T')[0] : d

        const overdue = taskStore.tasks.filter(t =>
          t.dueDate && normDate(t.dueDate) < todayStr && t.status !== 'done'
        ).length

        const dueToday = taskStore.tasks.filter(t =>
          t.dueDate && normDate(t.dueDate) === todayStr && t.status !== 'done'
        ).length

        if (overdue > 0 || dueToday > 0) {
          const parts: string[] = []
          if (overdue > 0) parts.push(`${overdue} overdue`)
          if (dueToday > 0) parts.push(`${dueToday} due today`)

          pushNudge(
            'morning',
            `Good morning! You have ${parts.join(' and ')}. Plan your day?`,
            [
              { label: 'Plan my day', handler: () => sendChatMessage('Plan my day — what should I focus on?') },
              { label: "What's overdue?", handler: () => sendChatMessage("What's overdue?") },
            ]
          )
        }
      } catch { /* stores not available */ }
    }

    // ── Evening review (5-9pm) ──
    if (hour >= 17 && hour < 21 && canNudge('evening')) {
      try {
        const taskStore = useTaskStore()
        const todayStr = new Date().toISOString().split('T')[0]

        const completedToday = taskStore.tasks.filter(t => {
          if (t.status !== 'done') return false
          const completedDate = t.completedAt
            ? new Date(t.completedAt).toISOString().split('T')[0]
            : new Date(t.updatedAt).toISOString().split('T')[0]
          return completedDate === todayStr
        }).length

        if (completedToday > 0) {
          pushNudge(
            'evening',
            `End of day! You completed ${completedToday} task${completedToday > 1 ? 's' : ''}. Review your day?`,
            [
              { label: 'Show my summary', handler: () => sendChatMessage('Give me my daily summary') },
            ]
          )
        }
      } catch { /* stores not available */ }
    }

    // ── Idle detection (>30 min) ──
    const idleMinutes = (Date.now() - lastActivityTime) / 60000
    if (idleMinutes > 30 && canNudge('idle')) {
      try {
        const timerStore = useTimerStore()
        if (!timerStore.isTimerActive) {
          pushNudge(
            'idle',
            "Been a while — want a task suggestion?",
            [
              { label: 'Suggest next task', handler: () => sendChatMessage('Suggest my next task') },
            ]
          )
        }
      } catch { /* timer store not available */ }
    }

    // ── Streak at risk ──
    if (canNudge('streakAtRisk')) {
      try {
        const gamStore = useGamificationStore()
        if (gamStore.isInitialized && gamStore.streakInfo.streakAtRisk && gamStore.streakInfo.currentStreak > 0) {
          pushNudge(
            'streakAtRisk',
            `Your ${gamStore.streakInfo.currentStreak}-day streak is at risk! Complete one more task.`,
            [
              { label: 'Suggest a quick task', handler: () => sendChatMessage('Suggest a quick task I can complete right now') },
            ]
          )
        }
      } catch { /* gamification not available */ }
    }

    // ── Challenge expiring ──
    if (canNudge('challengeExpiring')) {
      try {
        const challengeStore = useChallengesStore()
        if (challengeStore.isInitialized) {
          const expiring = challengeStore.activeDailies.find(c => {
            const timeRemaining = Math.max(0, (c.expiresAt.getTime() - Date.now()) / 60000)
            return timeRemaining < 120 && timeRemaining > 0 && c.objectiveCurrent < c.objectiveTarget
          })

          if (expiring) {
            const progress = Math.round((expiring.objectiveCurrent / expiring.objectiveTarget) * 100)
            const timeLeft = Math.round((expiring.expiresAt.getTime() - Date.now()) / 60000)
            const timeStr = timeLeft > 60 ? `${Math.floor(timeLeft / 60)}h` : `${timeLeft}m`

            pushNudge(
              'challengeExpiring',
              `Your "${expiring.title}" challenge expires in ${timeStr}. ${progress}% done.`,
              [
                { label: 'Show challenges', handler: () => sendChatMessage('Show my active challenges') },
              ]
            )
          }
        }
      } catch { /* challenges not available */ }
    }
  }

  /**
   * Push a task-completed nudge.
   * Call this from the task completion flow.
   */
  function onTaskCompleted(xpEarned?: number) {
    if (!canNudge('taskCompleted')) return

    try {
      const taskStore = useTaskStore()
      const todayStr = new Date().toISOString().split('T')[0]
      const remaining = taskStore.tasks.filter(t => {
        if (t.status === 'done') return false
        const normDate = (d: string) => d.includes('T') ? d.split('T')[0] : d
        return t.dueDate && normDate(t.dueDate) === todayStr
      }).length

      const xpStr = xpEarned ? ` +${xpEarned}XP earned.` : ''
      const remainStr = remaining > 0 ? ` ${remaining} task${remaining > 1 ? 's' : ''} left today.` : ''

      pushNudge(
        'taskCompleted',
        `Nice!${xpStr}${remainStr}`,
        remaining > 0
          ? [{ label: 'What\'s next?', handler: () => sendChatMessage('Suggest my next task') }]
          : undefined
      )
    } catch { /* stores not available */ }
  }

  /**
   * Helper to send a message via the chat.
   */
  function sendChatMessage(content: string) {
    const chatStore = useAIChatStore()
    chatStore.inputText = content
    // The chat panel's send handler will pick this up
    // We dispatch a custom event for AIChatPanel to handle
    window.dispatchEvent(new CustomEvent('ai-nudge-send', { detail: { content } }))
  }

  function start() {
    if (isActive.value) return
    isActive.value = true

    // Initial check after brief delay (let app load)
    setTimeout(checkNudges, 10_000)

    // Periodic checks
    intervalId = setInterval(checkNudges, CHECK_INTERVAL_MS)

    // Track activity
    window.addEventListener('mousemove', onUserActivity, { passive: true })
    window.addEventListener('keydown', onUserActivity, { passive: true })
    window.addEventListener('click', onUserActivity, { passive: true })
  }

  function stop() {
    isActive.value = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    window.removeEventListener('mousemove', onUserActivity)
    window.removeEventListener('keydown', onUserActivity)
    window.removeEventListener('click', onUserActivity)
  }

  return {
    isActive,
    start,
    stop,
    checkNudges,
    onTaskCompleted,
  }
}
