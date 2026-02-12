// Arena game mode types — Phase 1 MVP
// Pure TypeScript, no 3D framework dependencies

// ─── Primitives ───

export interface Vector3 {
  x: number
  y: number
  z: number
}

// ─── Enums / Unions ───

export type EntityType = 'player' | 'enemy' | 'projectile' | 'effect'
export type EntityState = 'idle' | 'spawning' | 'approaching' | 'combat' | 'dying' | 'dead' | 'victory'
export type EnemyTier = 'grunt' | 'standard' | 'elite' | 'boss'
export type AbilityType = 'aoe_blast' | 'shield' | 'overclock' | 'heal'
export type GamePhase = 'idle' | 'loading' | 'briefing' | 'wave_active' | 'wave_cleared' | 'boss_phase' | 'victory'

// ─── Entities ───

export interface GameEntity {
  id: string
  type: EntityType
  position: Vector3
  rotation: Vector3
  health: number
  maxHealth: number
  modelPath: string
  state: EntityState
  scale: number
  metadata: Record<string, any>
}

export interface EnemyEntity extends GameEntity {
  type: 'enemy'
  taskId: string
  taskTitle: string
  difficulty: number // 1-5
  tier: EnemyTier
  faction: string // project color/name
  isOverdue: boolean
  daysOverdue: number
  approachSpeed: number
  damageOnReach: number
  baseHp: number
  currentDamage: number // accumulated damage taken
  glowColor: string
  sizeMultiplier: number
}

export interface PlayerEntity extends GameEntity {
  type: 'player'
  level: number
  totalXp: number
  attackDamage: number
  attackSpeed: number
  focusDamage: number // pomodoro focus multiplier
  activeAbilities: AbilityType[]
  abilityCharges: number
  streakMultiplier: number
}

// ─── Abilities ───

export interface AbilityDefinition {
  type: AbilityType
  name: string
  description: string
  cooldownMs: number
  duration: number // ms, 0 for instant
  charges: number // max charges
  iconName: string // lucide icon name
  effect: string // human-readable effect description
}

export interface AbilityResult {
  affectedEnemies: string[]
  damageDealt: number
  playerEffect?: string
  duration?: number
}

// ─── Loot ───

export interface LootDrop {
  xpAmount: number
  abilityCharges: number
  message: string
}

// ─── Events (discriminated union) ───

export type GameEvent =
  | { type: 'enemy_spawned'; enemyId: string; tier: EnemyTier; taskTitle: string }
  | { type: 'enemy_damaged'; enemyId: string; damage: number; remainingHp: number }
  | { type: 'enemy_killed'; enemyId: string; loot: LootDrop; taskId: string }
  | { type: 'player_damaged'; damage: number; remainingHp: number; source: string }
  | { type: 'ability_activated'; ability: AbilityType; result: AbilityResult }
  | { type: 'wave_cleared'; waveNumber: number; enemiesKilled: number }
  | { type: 'boss_spawned'; enemyId: string; taskTitle: string }
  | { type: 'victory'; totalXp: number; enemiesKilled: number; timeTakenMs: number }
  | { type: 'corruption_changed'; corruption: number; delta: number }
  | { type: 'pomodoro_started'; taskId: string }
  | { type: 'pomodoro_completed'; taskId: string; focusDamage: number }
  | { type: 'task_completed'; taskId: string; enemyId: string }
  | { type: 'enemy_targeted'; enemyId: string | null }

// ─── Config ───

export interface EnemyMappingConfig {
  priority: {
    high: { tier: EnemyTier; hpMultiplier: number; modelPath: string }
    medium: { tier: EnemyTier; hpMultiplier: number; modelPath: string }
    low: { tier: EnemyTier; hpMultiplier: number; modelPath: string }
  }
  overdueScaling: Array<{
    minDays: number
    maxDays: number
    sizeMultiplier: number
    glowColor: string
    damageMultiplier: number
  }>
  boss: {
    hpMultiplier: number
    modelPath: string
    phases: number
  }
}

// ─── Run Data ───

export interface ArenaRunData {
  id: string
  userId: string
  runDate: string // YYYY-MM-DD
  seed: number
  enemyCount: number
  enemiesKilled: number
  bossDefeated: boolean
  abilitiesUsed: number
  totalXpEarned: number
  maxCorruptionReached: number
  status: 'active' | 'completed' | 'abandoned'
  startedAt: string
  completedAt: string | null
  metadata: Record<string, any>
}

// ─── Arena State ───

export interface ArenaState {
  phase: GamePhase
  player: PlayerEntity | null
  enemies: EnemyEntity[]
  targetedEnemyId: string | null
  corruption: number // 0-1
  waveNumber: number
  currentRun: ArenaRunData | null
  abilityCooldowns: Map<AbilityType, number>
  arenaTheme: string
}

// ─── Constants ───

export const ENEMY_CONFIG: EnemyMappingConfig = {
  priority: {
    high: { tier: 'elite', hpMultiplier: 2.0, modelPath: '/models/enemy_elite.glb' },
    medium: { tier: 'standard', hpMultiplier: 1.0, modelPath: '/models/enemy_standard.glb' },
    low: { tier: 'grunt', hpMultiplier: 0.5, modelPath: '/models/enemy_grunt.glb' },
  },
  overdueScaling: [
    { minDays: 1, maxDays: 3, sizeMultiplier: 1.1, glowColor: '#ff9500', damageMultiplier: 1.2 },
    { minDays: 4, maxDays: 7, sizeMultiplier: 1.3, glowColor: '#ff3b30', damageMultiplier: 1.5 },
    { minDays: 8, maxDays: Infinity, sizeMultiplier: 1.6, glowColor: '#af0fff', damageMultiplier: 2.0 },
  ],
  boss: {
    hpMultiplier: 5.0,
    modelPath: '/models/enemy_boss.glb',
    phases: 3,
  },
}

export const ABILITY_DEFINITIONS: AbilityDefinition[] = [
  {
    type: 'aoe_blast',
    name: 'AOE Blast',
    description: 'Damages all enemies in the arena',
    cooldownMs: 30_000,
    duration: 0,
    charges: 3,
    iconName: 'Zap',
    effect: 'Deals 50% of player attack damage to all enemies',
  },
  {
    type: 'shield',
    name: 'Shield',
    description: 'Freezes corruption buildup',
    cooldownMs: 45_000,
    duration: 30_000,
    charges: 2,
    iconName: 'Shield',
    effect: 'Corruption cannot increase for 30 seconds',
  },
  {
    type: 'overclock',
    name: 'Overclock',
    description: 'Doubles all damage output',
    cooldownMs: 60_000,
    duration: 60_000,
    charges: 2,
    iconName: 'Cpu',
    effect: '2x damage multiplier for 60 seconds',
  },
  {
    type: 'heal',
    name: 'Heal',
    description: 'Restores player health',
    cooldownMs: 20_000,
    duration: 0,
    charges: 3,
    iconName: 'Heart',
    effect: 'Restores 20% of max HP',
  },
]

export const BASE_PLAYER_STATS = {
  health: 1000,
  maxHealth: 1000,
  attackDamage: 25,
  attackSpeed: 1.0, // attacks per second
  focusDamage: 125, // 5x base for pomodoro focus
  abilityCharges: 3,
  streakMultiplier: 1.0,
} as const
