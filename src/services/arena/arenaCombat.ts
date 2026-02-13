// Arena combat — pure damage/loot functions (Rewritten from scratch)
import type { PlayerEntity, Buff } from '@/types/arena'

function getOverclockMultiplier(buffs: Buff[]): number {
  const now = Date.now()
  const overclock = buffs.find(
    b => b.type === 'overclock' && now - b.startTime < b.duration
  )
  return overclock ? overclock.multiplier : 1
}

export function calculateAutoAttackDamage(player: PlayerEntity, buffs: Buff[]): number {
  return Math.floor(player.attackDamage * getOverclockMultiplier(buffs))
}

export function calculateManualShotDamage(player: PlayerEntity, buffs: Buff[]): number {
  return Math.floor(50 * getOverclockMultiplier(buffs))
}

export function calculateFocusDamage(player: PlayerEntity, buffs: Buff[]): number {
  return Math.floor(player.focusDamage * getOverclockMultiplier(buffs))
}

export function calculateCorruptionFromReach(): number {
  return 0.05
}

export function calculateLoot(enemy: { tier: string; isOverdue: boolean; daysOverdue: number }): {
  xp: number
  charges: number
} {
  const tierXp: Record<string, number> = {
    grunt: 10,
    standard: 25,
    elite: 50,
    boss: 200,
  }

  const baseXp = tierXp[enemy.tier] ?? 10
  const overdueBonus = enemy.isOverdue ? Math.min(enemy.daysOverdue * 5, 50) : 0

  return {
    xp: baseXp + overdueBonus,
    charges: enemy.tier === 'boss' ? 2 : enemy.tier === 'elite' ? 1 : 0,
  }
}
