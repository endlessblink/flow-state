// Cyberflow Arena — Complete Type System (Rewritten from scratch)
// Pure TypeScript, no framework dependencies

// ─── Primitives ───

export interface Vector3 {
  x: number
  y: number
  z: number
}

// ─── Enums / Unions ───

export type EntityType = 'player' | 'enemy' | 'projectile'
export type EnemyTier = 'grunt' | 'standard' | 'elite' | 'boss'

export type GamePhase =
  | 'idle'
  | 'loading'
  | 'briefing'
  | 'wave_active'
  | 'wave_cleared'
  | 'boss_phase'
  | 'victory'
  | 'defeat'

export type EnemyState = 'approaching' | 'combat' | 'dying' | 'dead'
export type BuffType = 'firewall' | 'overclock'

// ─── Entities ───

export interface PlayerEntity {
  position: Vector3
  health: number
  maxHealth: number
  attackDamage: number
  attackSpeed: number
  focusDamage: number
}

export interface EnemyEntity {
  id: string
  taskId: string
  tier: EnemyTier
  position: Vector3
  health: number
  maxHealth: number
  glowColor: string
  approachSpeed: number
  daysOverdue: number
  isOverdue: boolean
  size: number
  state: EnemyState
}

export interface ProjectileEntity {
  id: string
  fromX: number
  fromZ: number
  toX: number
  toZ: number
  targetEnemyId: string
  speed: number
  progress: number
  color: string
  damage: number
}

// ─── Buffs ───

export interface Buff {
  id: string
  type: BuffType
  duration: number
  startTime: number
  multiplier: number
}

// ─── Combat Log ───

export type CombatLogType = 'damage' | 'kill' | 'ability' | 'system'

export interface CombatLogEntry {
  id: string
  message: string
  type: CombatLogType
  timestamp: number
  color: string
}

// ─── Run Data ───

export interface ArenaRun {
  date: string
  seed: number
  enemyCount: number
  enemiesKilled: number
  bossDefeated: boolean
  abilitiesUsed: number
  totalXpEarned: number
  maxCorruptionReached: number
  status: 'active' | 'completed' | 'abandoned'
}

// ─── Abilities ───

export interface AbilityDefinition {
  id: string
  name: string
  key: number
  damage: number
  radius: number
  duration: number
  chargeCost: number
  cooldown: number
  description: string
}

export const ABILITY_DEFINITIONS: AbilityDefinition[] = [
  {
    id: 'emp_blast',
    name: 'EMP Blast',
    key: 1,
    damage: 100,
    radius: 6,
    duration: 0,
    chargeCost: 1,
    cooldown: 30_000,
    description: 'AOE damage to all enemies within radius',
  },
  {
    id: 'firewall',
    name: 'Firewall',
    key: 2,
    damage: 0,
    radius: 0,
    duration: 60_000,
    chargeCost: 1,
    cooldown: 45_000,
    description: 'Freeze corruption gain for 60 seconds',
  },
  {
    id: 'overclock',
    name: 'Overclock',
    key: 3,
    damage: 0,
    radius: 0,
    duration: 30_000,
    chargeCost: 1,
    cooldown: 60_000,
    description: '2x damage for 30 seconds from all sources',
  },
  {
    id: 'purge',
    name: 'Purge',
    key: 4,
    damage: 999999,
    radius: 0,
    duration: 0,
    chargeCost: 2,
    cooldown: 90_000,
    description: 'Instant kill weakest enemy',
  },
]

// ─── Enemy Config ───

export interface EnemyTierConfig {
  hpBase: number
  size: number
  glowColor: string
  approachSpeed: number
}

export const ENEMY_CONFIG: Record<EnemyTier, EnemyTierConfig> = {
  grunt: {
    hpBase: 50,
    size: 0.4,
    glowColor: '#00ff88',
    approachSpeed: 0.05,
  },
  standard: {
    hpBase: 100,
    size: 0.6,
    glowColor: '#ffaa00',
    approachSpeed: 0.08,
  },
  elite: {
    hpBase: 200,
    size: 0.8,
    glowColor: '#ff3333',
    approachSpeed: 0.12,
  },
  boss: {
    hpBase: 500,
    size: 1.2,
    glowColor: '#aa0000',
    approachSpeed: 0.15,
  },
}

// ─── Base Player Stats ───

export const BASE_PLAYER_STATS = {
  health: 1000,
  maxHealth: 1000,
  attackDamage: 15,
  attackSpeed: 4,
  focusDamage: 75,
} as const

// ─── Event Bus Types ───

export interface ArenaEventMap {
  enemy_spawned: { enemyId: string; tier: EnemyTier }
  enemy_damaged: { enemyId: string; damage: number; remainingHp: number }
  enemy_killed: { enemyId: string; taskId: string; xp: number }
  enemy_targeted: { enemyId: string | null }
  player_damaged: { damage: number; source: string }
  ability_activated: { abilityId: string; name: string }
  projectile_impact: { projectileId: string; enemyId: string; damage: number }
  wave_cleared: { waveNumber: number; enemiesKilled: number }
  boss_spawned: { enemyId: string }
  corruption_changed: { corruption: number; delta: number }
  victory: { totalXp: number; enemiesKilled: number }
  defeat: { corruption: number; enemiesKilled: number }
}
