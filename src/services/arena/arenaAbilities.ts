// Arena ability system — activation logic and cooldown management
import type { AbilityType, PlayerEntity, EnemyEntity, AbilityResult } from '@/types/arena'
import { ABILITY_DEFINITIONS } from '@/types/arena'
import { calculateAbilityDamage } from '@/services/arena/arenaCombat'

/**
 * Check if an ability can be activated (has charges and is off cooldown).
 */
export function canActivateAbility(
  type: AbilityType,
  charges: number,
  cooldowns: Map<AbilityType, number>
): boolean {
  if (charges <= 0) return false
  const cooldownEnd = cooldowns.get(type) ?? 0
  return Date.now() >= cooldownEnd
}

/**
 * Get remaining cooldown time in ms for an ability. Returns 0 if ready.
 */
export function getAbilityCooldownRemaining(
  type: AbilityType,
  cooldowns: Map<AbilityType, number>
): number {
  const cooldownEnd = cooldowns.get(type) ?? 0
  return Math.max(0, cooldownEnd - Date.now())
}

/**
 * Activate an ability. Returns result describing what happened.
 */
export function activateAbility(
  type: AbilityType,
  player: PlayerEntity,
  enemies: EnemyEntity[]
): AbilityResult {
  const definition = ABILITY_DEFINITIONS.find((d) => d.type === type)
  if (!definition) {
    return { affectedEnemies: [], damageDealt: 0 }
  }

  switch (type) {
    case 'aoe_blast': {
      const damage = calculateAbilityDamage('aoe_blast', player)
      const affected = enemies
        .filter((e) => e.state !== 'dead' && e.state !== 'dying')
        .map((e) => e.id)
      return {
        affectedEnemies: affected,
        damageDealt: damage * affected.length,
        playerEffect: 'AOE Blast unleashed!',
      }
    }

    case 'shield': {
      return {
        affectedEnemies: [],
        damageDealt: 0,
        playerEffect: 'Shield active — corruption frozen',
        duration: definition.duration,
      }
    }

    case 'overclock': {
      return {
        affectedEnemies: [],
        damageDealt: 0,
        playerEffect: 'Overclock active — 2x damage',
        duration: definition.duration,
      }
    }

    case 'heal': {
      const healAmount = Math.floor(player.maxHealth * 0.2)
      return {
        affectedEnemies: [],
        damageDealt: 0,
        playerEffect: `Healed ${healAmount} HP`,
      }
    }

    default:
      return { affectedEnemies: [], damageDealt: 0 }
  }
}
