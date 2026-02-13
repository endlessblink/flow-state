// Arena wave generator — maps tasks to enemy entities (Rewritten from scratch)
import type { Task } from '@/types/tasks'
import type { EnemyEntity, EnemyTier } from '@/types/arena'
import { ENEMY_CONFIG } from '@/types/arena'

const MAX_ENEMIES = 15
const SPAWN_RADIUS = 8

// ─── Date Helpers ───

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false
  const due = new Date(task.dueDate)
  due.setHours(0, 0, 0, 0)
  return due < startOfToday()
}

function isDueToday(task: Task): boolean {
  if (!task.dueDate) return false
  const due = new Date(task.dueDate)
  const today = new Date()
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  )
}

function daysOverdue(task: Task): number {
  if (!task.dueDate) return 0
  const due = new Date(task.dueDate)
  due.setHours(0, 0, 0, 0)
  const diff = startOfToday().getTime() - due.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

// ─── Task → Tier Mapping ───

function tierFromPriority(priority: Task['priority']): EnemyTier {
  if (priority === 'high') return 'elite'
  if (priority === 'medium') return 'standard'
  return 'grunt'
}

// ─── Overdue Scaling ───

function overdueScaling(days: number): { sizeMult: number; hpMult: number; glowColor: string } {
  if (days === 0) return { sizeMult: 1.0, hpMult: 1.0, glowColor: '' }
  if (days === 1) return { sizeMult: 1.1, hpMult: 1.0, glowColor: '#ff9500' }
  if (days <= 3) return { sizeMult: 1.3, hpMult: 1.5, glowColor: '#ff3b30' }
  if (days <= 7) return { sizeMult: 1.6, hpMult: 2.0, glowColor: '#af0fff' }
  return { sizeMult: 2.0, hpMult: 3.0, glowColor: '#aa0000' }
}

// ─── Main Generator ───

export function generateEnemyWave(tasks: Task[]): EnemyEntity[] {
  // Filter to ONLY overdue + due today, exclude done and deleted
  const eligible = tasks.filter(t => {
    if (t.status === 'done') return false
    if (t._soft_deleted) return false
    return isOverdue(t) || isDueToday(t)
  })

  // Sort: overdue first (most days overdue DESC), then by priority
  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 }
  eligible.sort((a, b) => {
    const aOver = daysOverdue(a)
    const bOver = daysOverdue(b)
    if (aOver !== bOver) return bOver - aOver
    return (priorityWeight[b.priority ?? 'low'] ?? 0) - (priorityWeight[a.priority ?? 'low'] ?? 0)
  })

  // Cap at MAX_ENEMIES
  const selected = eligible.slice(0, MAX_ENEMIES)

  // Detect boss: highest priority task among selected, or critical priority
  const bossTaskId = selected.length > 0 ? selected[0].id : null

  return selected.map((task, index) => {
    const days = daysOverdue(task)
    const isBoss = task.id === bossTaskId && (task.priority === 'high' || days >= 7)
    const tier: EnemyTier = isBoss ? 'boss' : tierFromPriority(task.priority)
    const config = ENEMY_CONFIG[tier]
    const scaling = overdueScaling(days)

    // HP: base from tier config, scaled by overdue and estimated pomodoros
    const pomodoroMult = Math.max(1, task.estimatedPomodoros ?? 1)
    const hp = Math.round(config.hpBase * scaling.hpMult * pomodoroMult)

    // Size: base from config, scaled by overdue
    const size = config.size * scaling.sizeMult

    // Glow: overdue color overrides tier color
    const glowColor = days > 0 && scaling.glowColor ? scaling.glowColor : config.glowColor

    // Semicircle spawn placement
    const angle = selected.length === 1
      ? 0
      : ((index / (selected.length - 1)) * Math.PI - Math.PI / 2)
    const x = Math.cos(angle) * SPAWN_RADIUS
    const z = Math.sin(angle) * (SPAWN_RADIUS * 0.6)

    return {
      id: `enemy-${task.id}`,
      taskId: task.id,
      tier,
      position: { x, y: 0, z },
      health: hp,
      maxHealth: hp,
      glowColor,
      approachSpeed: config.approachSpeed,
      daysOverdue: days,
      isOverdue: days > 0,
      size,
      state: 'approaching' as const,
    }
  })
}
