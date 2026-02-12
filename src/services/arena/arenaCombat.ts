// Arena combat logic — pure functions, no side effects
import type { PlayerEntity, EnemyEntity, AbilityType, LootDrop } from '@/types/arena'

/**
 * Base auto-attack damage per tick (called every attackSpeed interval).
 */
export function calculateAutoAttackDamage(player: PlayerEntity): number {
  return player.attackDamage * player.streakMultiplier
}

/**
 * Focus damage during active pomodoro (5x multiplier).
 */
export function calculateFocusDamage(player: PlayerEntity): number {
  return player.focusDamage * player.streakMultiplier
}

/**
 * Ability damage based on type.
 */
export function calculateAbilityDamage(ability: AbilityType, player: PlayerEntity): number {
  switch (ability) {
    case 'aoe_blast':
      return Math.floor(player.attackDamage * 0.5 * player.streakMultiplier)
    case 'overclock':
      return 0 // overclock is a buff, not direct damage
    case 'shield':
      return 0 // defensive
    case 'heal':
      return 0 // healing
    default:
      return 0
  }
}

/**
 * Apply damage to an enemy. Returns updated enemy and whether it was killed.
 */
export function applyDamageToEnemy(
  enemy: EnemyEntity,
  damage: number
): { enemy: EnemyEntity; killed: boolean } {
  const newDamage = enemy.currentDamage + damage
  const newHealth = Math.max(0, enemy.maxHealth - newDamage)
  const killed = newHealth <= 0

  return {
    enemy: {
      ...enemy,
      currentDamage: newDamage,
      health: newHealth,
      state: killed ? 'dying' : enemy.state,
    },
    killed,
  }
}

/**
 * Calculate loot from a killed enemy.
 */
export function calculateLoot(enemy: EnemyEntity): LootDrop {
  const tierXp: Record<string, number> = {
    grunt: 10,
    standard: 25,
    elite: 50,
    boss: 200,
  }

  const baseXp = tierXp[enemy.tier] ?? 10
  const overdueBonus = enemy.isOverdue ? Math.min(enemy.daysOverdue * 5, 50) : 0
  const xpAmount = baseXp + overdueBonus

  const abilityCharges = enemy.tier === 'boss' ? 2 : enemy.tier === 'elite' ? 1 : 0

  const messages: Record<string, string> = {
    grunt: `Dispatched ${enemy.taskTitle}`,
    standard: `Defeated ${enemy.taskTitle}`,
    elite: `Crushed elite ${enemy.taskTitle}!`,
    boss: `BOSS DEFEATED: ${enemy.taskTitle}!`,
  }

  return {
    xpAmount,
    abilityCharges,
    message: messages[enemy.tier] ?? `Killed ${enemy.taskTitle}`,
  }
}

/**
 * Move an enemy toward the center (0,0,0) based on its approach speed.
 */
export function updateEnemyApproach(
  enemy: EnemyEntity,
  deltaMs: number
): EnemyEntity {
  if (enemy.state !== 'approaching') return enemy

  const deltaSeconds = deltaMs / 1000
  const { x, y, z } = enemy.position
  const distance = Math.sqrt(x * x + y * y + z * z)

  // Enemy has reached the center
  if (distance < 0.5) {
    return { ...enemy, position: { x: 0, y: 0, z: 0 }, state: 'combat' }
  }

  // Move toward origin
  const moveAmount = enemy.approachSpeed * deltaSeconds
  const ratio = Math.max(0, 1 - moveAmount / distance)

  return {
    ...enemy,
    position: {
      x: x * ratio,
      y: y * ratio,
      z: z * ratio,
    },
  }
}

/**
 * Corruption increase when an enemy reaches the center.
 */
export function calculateCorruptionFromReach(): number {
  return 0.1 // 10% corruption per enemy reaching center
}
