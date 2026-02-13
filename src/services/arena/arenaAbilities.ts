// Arena abilities — 4 abilities with effect objects (Rewritten from scratch)
import type { EnemyEntity, Buff, AbilityType } from '@/types/arena'
import { ABILITY_DEFINITIONS } from '@/types/arena'

// ─── Ability Availability Check ───

export function canActivateAbility(
  abilityType: AbilityType,
  charges: number,
  cooldowns: Map<AbilityType, number>
): boolean {
  const def = ABILITY_DEFINITIONS.find(a => a.type === abilityType)
  if (!def) return false
  if (charges < def.chargeCost) return false
  const cooldownEnd = cooldowns.get(abilityType)
  if (cooldownEnd && Date.now() < cooldownEnd) return false
  return true
}

// ─── Effect Types ───

export interface EmpBlastEffect {
  type: 'emp_blast'
  affectedEnemyIds: string[]
  damagePerEnemy: number
}

export interface FirewallEffect {
  type: 'firewall'
  buff: Buff
}

export interface OverclockEffect {
  type: 'overclock'
  buff: Buff
}

export interface PurgeEffect {
  type: 'purge'
  killedEnemyId: string | null
}

export type AbilityEffect = EmpBlastEffect | FirewallEffect | OverclockEffect | PurgeEffect

// ─── Activation ───

export function activateEmpBlast(
  enemies: EnemyEntity[],
  playerX: number,
  playerZ: number
): EmpBlastEffect {
  const def = ABILITY_DEFINITIONS.find(a => a.id === 'emp_blast')!
  const radius = def.radius
  const damage = def.damage

  const affected = enemies.filter(e => {
    if (e.state === 'dying' || e.state === 'dead') return false
    const dx = e.position.x - playerX
    const dz = e.position.z - playerZ
    return Math.sqrt(dx * dx + dz * dz) <= radius
  })

  return {
    type: 'emp_blast',
    affectedEnemyIds: affected.map(e => e.id),
    damagePerEnemy: damage,
  }
}

export function activateFirewall(): FirewallEffect {
  const def = ABILITY_DEFINITIONS.find(a => a.id === 'firewall')!
  return {
    type: 'firewall',
    buff: {
      id: `buff-firewall-${Date.now()}`,
      type: 'firewall',
      duration: def.duration,
      startTime: Date.now(),
      multiplier: 0,
    },
  }
}

export function activateOverclock(): OverclockEffect {
  const def = ABILITY_DEFINITIONS.find(a => a.id === 'overclock')!
  return {
    type: 'overclock',
    buff: {
      id: `buff-overclock-${Date.now()}`,
      type: 'overclock',
      duration: def.duration,
      startTime: Date.now(),
      multiplier: 2,
    },
  }
}

export function activatePurge(enemies: EnemyEntity[]): PurgeEffect {
  const alive = enemies
    .filter(e => e.state !== 'dying' && e.state !== 'dead')
    .sort((a, b) => a.health - b.health)

  return {
    type: 'purge',
    killedEnemyId: alive.length > 0 ? alive[0].id : null,
  }
}
