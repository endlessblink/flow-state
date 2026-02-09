/**
 * ARIA-voice narrative text generator for gamification tooltip content
 * TASK-1287: Rich hover tooltips with RPG narrative style
 *
 * Returns context-aware phrases memoized per 30s to avoid recalculation
 * on rapid hover in/out cycles.
 */
// Memoization cache: key -> { text, timestamp }
const narrativeCache = new Map<string, { text: string; ts: number }>()
const CACHE_TTL_MS = 30_000

function pickCached(key: string, pool: string[]): string {
  const cached = narrativeCache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.text
  }
  const text = pool[Math.floor(Math.random() * pool.length)]
  narrativeCache.set(key, { text, ts: Date.now() })
  return text
}

// ---------------------------------------------------------------------------
// Level Narratives
// ---------------------------------------------------------------------------

const LEVEL_NARRATIVES_HIGH_PROGRESS = [
  'Neural breakthrough imminent.',
  'Synaptic threshold approaching, netrunner.',
  'Level barrier weakening. Push through.',
  'Almost there. The Grid remembers persistence.',
  'One more push and the circuits align.',
]

const LEVEL_NARRATIVES_MID_PROGRESS = [
  'Neural pathways expanding, netrunner.',
  'The Grid recognizes your progress.',
  'Steady data flow. Keep building.',
  'Circuits warming up nicely.',
  'Progress logged. Continue your run.',
]

const LEVEL_NARRATIVES_LOW_PROGRESS = [
  'A new level begins. Fresh circuits await.',
  'The Grid has reset. Time to climb.',
  'Clean slate, netrunner. Make it count.',
  'New level unlocked. Data streams await.',
  'Fresh run initiated. Build momentum.',
]

export function getLevelNarrative(level: number, progressPercent: number): string {
  if (progressPercent >= 75) {
    return pickCached(`level-high-${level}`, LEVEL_NARRATIVES_HIGH_PROGRESS)
  }
  if (progressPercent >= 30) {
    return pickCached(`level-mid-${level}`, LEVEL_NARRATIVES_MID_PROGRESS)
  }
  return pickCached(`level-low-${level}`, LEVEL_NARRATIVES_LOW_PROGRESS)
}

// ---------------------------------------------------------------------------
// XP Narratives
// ---------------------------------------------------------------------------

const XP_NARRATIVES_MULTIPLIER = [
  'Amplified signal detected. Data flows faster.',
  'Multiplier online. Maximum throughput engaged.',
  'Bonus circuits activated, netrunner.',
  'Enhanced data rates confirmed.',
  'Signal boost locked in.',
]

const XP_NARRATIVES_SHIELDED = [
  'Firewall active. Data flows stronger.',
  'Shield protocols engaged. XP secured.',
  'Protected session. Every byte counts.',
  'Timer shield online. Earning boosted.',
  'Defensive subroutines holding.',
]

const XP_NARRATIVES_DEFAULT = [
  'Data streams flowing strong.',
  'XP pipeline nominal, netrunner.',
  'Steady accumulation detected.',
  'The Grid rewards consistency.',
  'Processing cycles locked in.',
  'Data harvest proceeding as planned.',
]

export function getXpNarrative(multiplierActive: boolean, shielded: boolean): string {
  if (multiplierActive) {
    return pickCached('xp-multiplier', XP_NARRATIVES_MULTIPLIER)
  }
  if (shielded) {
    return pickCached('xp-shielded', XP_NARRATIVES_SHIELDED)
  }
  return pickCached('xp-default', XP_NARRATIVES_DEFAULT)
}

// ---------------------------------------------------------------------------
// Streak Narratives
// ---------------------------------------------------------------------------

const STREAK_NARRATIVES_ACTIVE = [
  'Grid connection holding.',
  'Neural link stable. Keep the signal alive.',
  'Consecutive sessions logged. Impressive.',
  'Uptime confirmed. The Grid approves.',
  'Streak integrity verified.',
  'Connection persists. Well done, netrunner.',
]

const STREAK_NARRATIVES_AT_RISK = [
  'Complete a task to continue your run.',
  'Signal fading. Reconnect before timeout.',
  'The Grid awaits your return, netrunner.',
  'Streak buffer running low.',
  'One task keeps the connection alive.',
]

const STREAK_NARRATIVES_INACTIVE = [
  'Ready to reconnect to the Grid.',
  'New session available. Start your run.',
  'The Grid is waiting, netrunner.',
  'Initiate connection when ready.',
  'Standing by for your next session.',
]

export function getStreakNarrative(
  streak: number,
  isActiveToday: boolean,
  atRisk: boolean
): string {
  if (isActiveToday) {
    return pickCached(`streak-active-${streak}`, STREAK_NARRATIVES_ACTIVE)
  }
  if (atRisk) {
    return pickCached('streak-risk', STREAK_NARRATIVES_AT_RISK)
  }
  return pickCached('streak-inactive', STREAK_NARRATIVES_INACTIVE)
}

// ---------------------------------------------------------------------------
// Challenge Narratives
// ---------------------------------------------------------------------------

const CHALLENGE_NARRATIVES_BOSS = [
  'Target locked, netrunner.',
  'Boss entity detected. Engage with caution.',
  'High-priority target on the Grid.',
  'Boss protocol active. Stay sharp.',
  'The Grid demands a champion.',
]

const CHALLENGE_NARRATIVES_ALL_COMPLETE = [
  'All missions complete. Outstanding work.',
  'Daily objectives cleared. The Grid is pleased.',
  'Mission log: all green. Well done.',
  'Full sweep confirmed, netrunner.',
  'Perfect run. Rest well.',
]

const CHALLENGE_NARRATIVES_IN_PROGRESS = [
  'The Grid demands more, netrunner.',
  'Missions in progress. Keep pushing.',
  'Objectives remain. Stay on target.',
  'Partial completion. Finish the run.',
  'Active missions detected. Continue.',
]

const CHALLENGE_NARRATIVES_NONE = [
  'No active missions. Check back soon.',
  'Mission queue empty. Standby.',
  'The Grid is generating new challenges.',
  'Awaiting mission briefing.',
]

export function getChallengeNarrative(
  completed: number,
  total: number,
  hasBoss: boolean
): string {
  if (hasBoss) {
    return pickCached('challenge-boss', CHALLENGE_NARRATIVES_BOSS)
  }
  if (total === 0) {
    return pickCached('challenge-none', CHALLENGE_NARRATIVES_NONE)
  }
  if (completed >= total) {
    return pickCached('challenge-complete', CHALLENGE_NARRATIVES_ALL_COMPLETE)
  }
  return pickCached('challenge-progress', CHALLENGE_NARRATIVES_IN_PROGRESS)
}
