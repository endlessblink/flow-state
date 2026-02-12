// Arena game mode store — manages 3D cyberpunk arena state
// FEATURE: Cyberflow Arena — tasks become enemies, productivity = combat
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  GamePhase,
  PlayerEntity,
  EnemyEntity,
  AbilityType,
  ArenaRunData,
} from '@/types/arena'
import { BASE_PLAYER_STATS, ABILITY_DEFINITIONS } from '@/types/arena'
import { generateEnemyWave, generateDailySeed } from '@/services/arena/arenaGenerator'
import { arenaEventBus } from '@/services/arena/arenaEventBus'
import { createArenaStateMachine } from '@/services/arena/arenaStateMachine'
import {
  applyDamageToEnemy,
  calculateAutoAttackDamage,
  calculateFocusDamage,
  calculateLoot,
} from '@/services/arena/arenaCombat'
import {
  canActivateAbility,
  activateAbility as activateAbilityService,
} from '@/services/arena/arenaAbilities'
import { useTaskStore } from '@/stores/tasks'
import { useGamificationStore } from '@/stores/gamification'

const DEATH_ANIMATION_MS = 1000
const ARENA_RADIUS = 10 // Movement boundary
const COMBAT_LOG_MAX = 50

export interface CombatLogEntry {
  id: string
  message: string
  type: 'damage' | 'kill' | 'ability' | 'system' | 'xp'
  time: number
}

export const useArenaStore = defineStore('arena', () => {
  const taskStore = useTaskStore()
  const gamificationStore = useGamificationStore()

  // ─── Internal State Machine ───
  const stateMachine = createArenaStateMachine()

  // ─── Reactive State ───
  const phase = ref<GamePhase>('idle')
  const player = ref<PlayerEntity | null>(null)
  const enemies = ref<EnemyEntity[]>([])
  const targetedEnemyId = ref<string | null>(null)
  const corruption = ref(0)
  const waveNumber = ref(0)
  const currentRun = ref<ArenaRunData | null>(null)
  const abilityCooldowns = ref<Map<AbilityType, number>>(new Map())
  const arenaTheme = ref('default')
  const isInitialized = ref(false)

  // ─── Combat Log ───
  const combatLog = ref<CombatLogEntry[]>([])

  function addLog(message: string, type: CombatLogEntry['type']) {
    combatLog.value.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message,
      type,
      time: Date.now(),
    })
    if (combatLog.value.length > COMBAT_LOG_MAX) {
      combatLog.value = combatLog.value.slice(0, COMBAT_LOG_MAX)
    }
  }

  // ─── Computed ───
  const activeEnemies = computed(() =>
    enemies.value.filter(e => e.state !== 'dead')
  )

  const targetedEnemy = computed(() =>
    targetedEnemyId.value
      ? enemies.value.find(e => e.id === targetedEnemyId.value) ?? null
      : null
  )

  const enemiesKilled = computed(() =>
    enemies.value.filter(e => e.state === 'dead')
  )

  const isWaveActive = computed(() => phase.value === 'wave_active')
  const isBossPhase = computed(() => phase.value === 'boss_phase')
  const isVictory = computed(() => phase.value === 'victory')
  const corruptionPercent = computed(() => corruption.value * 100)

  // Enemy breakdown for briefing
  const enemyBreakdown = computed(() => {
    const counts = { grunt: 0, standard: 0, elite: 0, boss: 0 }
    const overdueCount = enemies.value.filter(e => e.isOverdue).length
    for (const e of enemies.value) {
      counts[e.tier]++
    }
    return { ...counts, overdue: overdueCount, total: enemies.value.length }
  })

  // ─── Phase Transitions ───
  function setPhase(newPhase: GamePhase): boolean {
    const ok = stateMachine.transition(newPhase)
    if (ok) {
      phase.value = newPhase
    }
    return ok
  }

  // ─── Player Movement (WASD) ───
  function movePlayer(dx: number, dz: number) {
    if (!player.value) return
    const newX = Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, player.value.position.x + dx))
    const newZ = Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, player.value.position.z + dz))
    player.value = {
      ...player.value,
      position: { x: newX, y: player.value.position.y, z: newZ },
    }
  }

  // ─── Shoot Enemy (click to attack) ───
  function shootEnemy(enemyId: string) {
    if (!player.value) return
    const enemy = enemies.value.find(e => e.id === enemyId)
    if (!enemy || enemy.state === 'dead' || enemy.state === 'dying') return

    // Target + damage
    targetedEnemyId.value = enemyId
    const damage = Math.floor(calculateAutoAttackDamage(player.value))
    damageEnemy(enemyId, damage)
    addLog(`Shot "${enemy.taskTitle}" → -${damage} HP`, 'damage')
  }

  // ─── Actions ───

  function initializeArena() {
    // Build player from gamification data
    const level = gamificationStore.currentLevel ?? 1
    const streak = gamificationStore.streakInfo?.currentStreak ?? 0
    const totalXp = gamificationStore.totalXp ?? 0

    const streakMultiplier = 1.0 + Math.min(streak, 10) * 0.05

    player.value = {
      id: 'player',
      type: 'player',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: BASE_PLAYER_STATS.health,
      maxHealth: BASE_PLAYER_STATS.maxHealth,
      modelPath: '/models/player.glb',
      state: 'idle',
      scale: 1.0,
      metadata: {},
      level,
      totalXp,
      attackDamage: BASE_PLAYER_STATS.attackDamage + Math.floor(level * 2),
      attackSpeed: BASE_PLAYER_STATS.attackSpeed,
      focusDamage: BASE_PLAYER_STATS.focusDamage + Math.floor(level * 5),
      activeAbilities: ABILITY_DEFINITIONS.map(a => a.type),
      abilityCharges: BASE_PLAYER_STATS.abilityCharges,
      streakMultiplier,
    }

    // Generate enemies from tasks
    const seed = generateDailySeed()
    const rawTasks = taskStore._rawTasks ?? []
    enemies.value = generateEnemyWave(rawTasks, level, seed)

    // Initialize run data
    currentRun.value = {
      id: `run-${Date.now()}`,
      userId: '',
      runDate: new Date().toISOString().split('T')[0],
      seed,
      enemyCount: enemies.value.length,
      enemiesKilled: 0,
      bossDefeated: false,
      abilitiesUsed: 0,
      totalXpEarned: 0,
      maxCorruptionReached: 0,
      status: 'active',
      startedAt: new Date().toISOString(),
      completedAt: null,
      metadata: {},
    }

    // Reset state
    corruption.value = 0
    waveNumber.value = 1
    targetedEnemyId.value = null
    abilityCooldowns.value = new Map()
    arenaTheme.value = 'default'
    combatLog.value = []

    // Transition: idle → loading → briefing
    stateMachine.reset()
    setPhase('loading')
    setPhase('briefing')

    isInitialized.value = true
    addLog('ARIA: Arena initialized. Threats detected.', 'system')
  }

  function startWave() {
    if (!setPhase('wave_active')) return

    enemies.value = enemies.value.map(e =>
      e.state === 'spawning' ? { ...e, state: 'approaching' as const } : e
    )

    addLog(`WAVE ${waveNumber.value} — ${enemies.value.length} hostiles approaching!`, 'system')
    addLog('Use WASD to move. Click enemies to shoot.', 'system')
  }

  function damageEnemy(enemyId: string, damage: number) {
    const idx = enemies.value.findIndex(e => e.id === enemyId)
    if (idx === -1) return

    const enemy = enemies.value[idx]
    if (enemy.state === 'dead' || enemy.state === 'dying') return

    const result = applyDamageToEnemy(enemy, damage)
    enemies.value[idx] = result.enemy

    arenaEventBus.emit({
      type: 'enemy_damaged',
      enemyId,
      damage,
      remainingHp: result.enemy.health,
    })

    if (result.killed) {
      killEnemy(enemyId)
    }
  }

  function killEnemy(enemyId: string) {
    const idx = enemies.value.findIndex(e => e.id === enemyId)
    if (idx === -1) return

    const enemy = enemies.value[idx]
    if (enemy.state === 'dead') return

    enemies.value[idx] = { ...enemy, state: 'dying' }

    const loot = calculateLoot(enemy)

    gamificationStore.awardXp(loot.xpAmount, 'arena_kill', {
      taskId: enemy.taskId,
    })

    if (loot.abilityCharges > 0 && player.value) {
      player.value = {
        ...player.value,
        abilityCharges: player.value.abilityCharges + loot.abilityCharges,
      }
    }

    if (currentRun.value) {
      currentRun.value = {
        ...currentRun.value,
        enemiesKilled: currentRun.value.enemiesKilled + 1,
        totalXpEarned: currentRun.value.totalXpEarned + loot.xpAmount,
      }
    }

    addLog(`ELIMINATED: "${enemy.taskTitle}" → +${loot.xpAmount} XP`, 'kill')
    if (loot.abilityCharges > 0) {
      addLog(`+${loot.abilityCharges} ability charge${loot.abilityCharges > 1 ? 's' : ''}!`, 'xp')
    }

    arenaEventBus.emit({ type: 'enemy_killed', enemyId, loot, taskId: enemy.taskId })

    setTimeout(() => {
      const i = enemies.value.findIndex(e => e.id === enemyId)
      if (i !== -1) {
        enemies.value[i] = { ...enemies.value[i], state: 'dead' }
      }
      checkWaveCleared()
    }, DEATH_ANIMATION_MS)
  }

  function targetEnemy(enemyId: string | null) {
    targetedEnemyId.value = enemyId
    arenaEventBus.emit({ type: 'enemy_targeted', enemyId })
  }

  function activateAbility(type: AbilityType) {
    if (!player.value) return

    if (!canActivateAbility(type, player.value.abilityCharges, abilityCooldowns.value)) {
      return
    }

    const result = activateAbilityService(type, player.value, enemies.value)

    player.value = {
      ...player.value,
      abilityCharges: player.value.abilityCharges - 1,
    }

    const definition = ABILITY_DEFINITIONS.find(d => d.type === type)
    if (definition) {
      abilityCooldowns.value.set(type, Date.now() + definition.cooldownMs)
      addLog(`ABILITY: ${definition.name} activated!`, 'ability')
    }

    if (type === 'aoe_blast' && result.affectedEnemies.length > 0) {
      const damagePerEnemy = Math.floor(result.damageDealt / result.affectedEnemies.length)
      for (const eid of result.affectedEnemies) {
        damageEnemy(eid, damagePerEnemy)
      }
      addLog(`AOE hit ${result.affectedEnemies.length} enemies for ${damagePerEnemy} each!`, 'ability')
    }

    if (type === 'heal' && player.value) {
      const healAmount = Math.floor(player.value.maxHealth * 0.2)
      player.value = {
        ...player.value,
        health: Math.min(player.value.maxHealth, player.value.health + healAmount),
      }
      addLog(`Healed +${healAmount} HP`, 'ability')
    }

    if (currentRun.value) {
      currentRun.value = {
        ...currentRun.value,
        abilitiesUsed: currentRun.value.abilitiesUsed + 1,
      }
    }

    arenaEventBus.emit({ type: 'ability_activated', ability: type, result })
  }

  function handleTaskCompleted(taskId: string) {
    const enemy = enemies.value.find(e => e.taskId === taskId)
    if (enemy && enemy.state !== 'dead' && enemy.state !== 'dying') {
      damageEnemy(enemy.id, enemy.health)
      addLog(`TASK COMPLETED → "${enemy.taskTitle}" instantly destroyed!`, 'kill')
    }
  }

  function handlePomodoroStart(taskId: string) {
    const enemy = enemies.value.find(e => e.taskId === taskId)
    if (enemy && enemy.state !== 'dead' && enemy.state !== 'dying') {
      targetEnemy(enemy.id)
      addLog(`FOCUS MODE: Pomodoro started → targeting "${enemy.taskTitle}"`, 'system')
    }
  }

  function handlePomodoroComplete(taskId: string) {
    if (!player.value) return
    const enemy = targetedEnemy.value
    if (enemy && enemy.taskId === taskId && enemy.state !== 'dead' && enemy.state !== 'dying') {
      const damage = calculateFocusDamage(player.value)
      damageEnemy(enemy.id, damage)
      addLog(`FOCUS STRIKE: "${enemy.taskTitle}" → -${damage} HP!`, 'damage')
    }
  }

  function addCorruption(amount: number) {
    const prev = corruption.value
    corruption.value = Math.max(0, Math.min(1, corruption.value + amount))

    if (currentRun.value && corruption.value > currentRun.value.maxCorruptionReached) {
      currentRun.value = { ...currentRun.value, maxCorruptionReached: corruption.value }
    }

    if (corruption.value > 0.5 && prev <= 0.5) {
      arenaTheme.value = 'corrupted'
      addLog('WARNING: Corruption exceeding 50%!', 'system')
    } else if (corruption.value <= 0.5 && prev > 0.5) {
      arenaTheme.value = 'default'
    }

    arenaEventBus.emit({ type: 'corruption_changed', corruption: corruption.value, delta: amount })
  }

  function checkWaveCleared() {
    const alive = enemies.value.filter(e => e.state !== 'dead' && e.state !== 'dying')
    if (alive.length > 0) return

    setPhase('wave_cleared')

    arenaEventBus.emit({
      type: 'wave_cleared',
      waveNumber: waveNumber.value,
      enemiesKilled: enemiesKilled.value.length,
    })

    if (phase.value === 'wave_cleared') {
      setPhase('victory')

      if (currentRun.value) {
        currentRun.value = {
          ...currentRun.value,
          status: 'completed',
          completedAt: new Date().toISOString(),
        }
      }

      addLog('ALL THREATS ELIMINATED — SECTOR CLEARED!', 'system')
      addLog(`Total XP earned: ${currentRun.value?.totalXpEarned ?? 0}`, 'xp')
    }
  }

  function cleanup() {
    phase.value = 'idle'
    player.value = null
    enemies.value = []
    targetedEnemyId.value = null
    corruption.value = 0
    waveNumber.value = 0
    currentRun.value = null
    abilityCooldowns.value = new Map()
    arenaTheme.value = 'default'
    isInitialized.value = false
    combatLog.value = []
    arenaEventBus.clear()
    stateMachine.reset()
  }

  return {
    phase, player, enemies, targetedEnemyId, corruption, waveNumber,
    currentRun, abilityCooldowns, arenaTheme, isInitialized, combatLog,
    activeEnemies, targetedEnemy, enemiesKilled, isWaveActive, isBossPhase,
    isVictory, corruptionPercent, enemyBreakdown,
    initializeArena, startWave, damageEnemy, killEnemy, targetEnemy,
    activateAbility, handleTaskCompleted, handlePomodoroStart,
    handlePomodoroComplete, addCorruption, checkWaveCleared, cleanup,
    movePlayer, shootEnemy, addLog,
  }
})
