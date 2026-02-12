// Arena wave generator — maps tasks to enemy entities
import type { Task } from '@/types/tasks'
import type { EnemyEntity, EnemyTier } from '@/types/arena'
import { ENEMY_CONFIG } from '@/types/arena'

/**
 * Generate a deterministic daily seed from today's date.
 */
export function generateDailySeed(): number {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Simple seeded PRNG (mulberry32). Avoids rot.js dependency for Phase 1.
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Helpers ───

export function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false
  const due = new Date(task.dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return due < today
}

export function isDueToday(task: Task): boolean {
  if (!task.dueDate) return false
  const due = new Date(task.dueDate)
  const today = new Date()
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  )
}

export function calculateDaysOverdue(task: Task): number {
  if (!task.dueDate) return 0
  const due = new Date(task.dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = today.getTime() - due.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function getTierForPriority(priority: Task['priority']): { tier: EnemyTier; hpMultiplier: number; modelPath: string } {
  if (priority === 'high') return ENEMY_CONFIG.priority.high
  if (priority === 'medium') return ENEMY_CONFIG.priority.medium
  return ENEMY_CONFIG.priority.low
}

function getOverdueScaling(daysOverdue: number) {
  for (const range of ENEMY_CONFIG.overdueScaling) {
    if (daysOverdue >= range.minDays && daysOverdue <= range.maxDays) {
      return range
    }
  }
  return { sizeMultiplier: 1.0, glowColor: '#00ff88', damageMultiplier: 1.0 }
}

const MAX_ENEMIES = 15

/**
 * Generate an enemy wave from active tasks.
 */
export function generateEnemyWave(
  tasks: Task[],
  playerLevel: number,
  seed: number
): EnemyEntity[] {
  const rng = seededRandom(seed)

  // Filter eligible tasks
  const eligible = tasks.filter((t) => {
    if (t.status === 'done') return false
    if (t._soft_deleted) return false
    return isOverdue(t) || isDueToday(t) || t.status === 'in_progress'
  })

  // Sort: overdue first (most days overdue), then by priority weight
  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 }
  eligible.sort((a, b) => {
    const aOverdue = calculateDaysOverdue(a)
    const bOverdue = calculateDaysOverdue(b)
    if (aOverdue !== bOverdue) return bOverdue - aOverdue
    return (priorityWeight[b.priority ?? 'low'] ?? 0) - (priorityWeight[a.priority ?? 'low'] ?? 0)
  })

  // Cap at MAX_ENEMIES
  const selected = eligible.slice(0, MAX_ENEMIES)

  // Distribute enemies in a semicircle (radius ~8, z from -5 to 5)
  const enemies: EnemyEntity[] = selected.map((task, index) => {
    const tierConfig = getTierForPriority(task.priority)
    const daysOver = calculateDaysOverdue(task)
    const overdueScale = getOverdueScaling(daysOver)

    // Semicircle placement
    const angle = selected.length === 1
      ? 0
      : ((index / (selected.length - 1)) * Math.PI - Math.PI / 2)
    const radius = 8 + rng() * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * 5

    // Speed: shorter estimated duration = faster approach
    const estMinutes = task.estimatedDuration ?? 30
    const approachSpeed = Math.max(0.3, 2.0 - (estMinutes / 60))

    // HP: pomodoros * 100 * tier multiplier * overdue multiplier
    const baseHp = (task.estimatedPomodoros ?? 1) * 100 * tierConfig.hpMultiplier * overdueScale.damageMultiplier

    // Difficulty 1-5 based on tier + overdue
    const tierDiff: Record<EnemyTier, number> = { grunt: 1, standard: 2, elite: 3, boss: 5 }
    const difficulty = Math.min(5, tierDiff[tierConfig.tier] + (daysOver > 3 ? 1 : 0) + (daysOver > 7 ? 1 : 0))

    return {
      id: `enemy-${task.id}`,
      type: 'enemy' as const,
      taskId: task.id,
      taskTitle: task.title,
      difficulty,
      tier: tierConfig.tier,
      faction: task.projectId || 'unassigned',
      isOverdue: daysOver > 0,
      daysOverdue: daysOver,
      approachSpeed,
      damageOnReach: 50 * overdueScale.damageMultiplier,
      baseHp,
      currentDamage: 0,
      glowColor: daysOver > 0 ? overdueScale.glowColor : '#00ff88',
      sizeMultiplier: overdueScale.sizeMultiplier,
      position: { x, y: 0, z },
      rotation: { x: 0, y: 0, z: 0 },
      health: baseHp,
      maxHealth: baseHp,
      modelPath: tierConfig.modelPath,
      state: 'spawning',
      scale: 1.0 * overdueScale.sizeMultiplier,
      metadata: {
        taskStatus: task.status,
        taskPriority: task.priority,
        playerLevel,
      },
    }
  })

  return enemies
}
