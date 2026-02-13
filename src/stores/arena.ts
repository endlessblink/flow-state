// Arena store — Pinia setup store for Cyberflow Arena (Rewritten from scratch)
// Manages game state, entities, combat, abilities
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  GamePhase,
  PlayerEntity,
  EnemyEntity,
  ProjectileEntity,
  Buff,
  CombatLogEntry,
  ArenaRun,
} from '@/types/arena'
import { BASE_PLAYER_STATS, ABILITY_DEFINITIONS } from '@/types/arena'
import { canTransition } from '@/services/arena/arenaStateMachine'
import { arenaEventBus } from '@/services/arena/arenaEventBus'
import { generateEnemyWave } from '@/services/arena/arenaGenerator'
import {
  calculateAutoAttackDamage,
  calculateManualShotDamage,
  calculateFocusDamage,
  calculateCorruptionFromReach,
  calculateLoot,
} from '@/services/arena/arenaCombat'
import {
  activateEmpBlast,
  activateFirewall,
  activateOverclock,
  activatePurge,
} from '@/services/arena/arenaAbilities'
import type { Task } from '@/types/tasks'

const ARENA_RADIUS = 10
const COMBAT_LOG_MAX = 50
const SPAWN_INTERVAL = 2000
const DEATH_ANIMATION_MS = 800
const LOG_COLORS: Record<CombatLogEntry['type'], string> = {
  damage: '#14b8ff',
  kill: '#00ff88',
  ability: '#f60056',
  system: '#888888',
}

export const useArenaStore = defineStore('arena', () => {
  // ─── Core State ───
  const phase = ref<GamePhase>('idle')
  const player = ref<PlayerEntity>({
    position: { x: 0, y: 0, z: 0 },
    health: BASE_PLAYER_STATS.health,
    maxHealth: BASE_PLAYER_STATS.maxHealth,
    attackDamage: BASE_PLAYER_STATS.attackDamage,
    attackSpeed: BASE_PLAYER_STATS.attackSpeed,
    focusDamage: BASE_PLAYER_STATS.focusDamage,
  })
  const enemies = ref<EnemyEntity[]>([])
  const projectiles = ref<ProjectileEntity[]>([])
  const buffs = ref<Buff[]>([])
  const combatLog = ref<CombatLogEntry[]>([])
  const corruption = ref(0)
  const waveNumber = ref(1)
  const currentRun = ref<ArenaRun | null>(null)
  const targetedEnemyId = ref<string | null>(null)

  // ─── Spawn Queue ───
  const spawnQueue = ref<EnemyEntity[]>([])
  const spawnTimer = ref<ReturnType<typeof setInterval> | null>(null)

  // ─── Ability Tracking ───
  const abilityCharges = ref(3)
  const abilityCooldowns = ref<Record<string, number>>({})

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
    enemies.value.filter(e => e.state === 'dead').length
  )

  const isWaveActive = computed(() => phase.value === 'wave_active')
  const isBossPhase = computed(() => phase.value === 'boss_phase')
  const isVictory = computed(() => phase.value === 'victory')
  const isDefeated = computed(() => phase.value === 'defeat')

  const corruptionPercent = computed(() => Math.round(corruption.value * 100))

  const enemyBreakdown = computed(() => {
    const counts = { grunt: 0, standard: 0, elite: 0, boss: 0, overdue: 0, total: 0 }
    for (const e of enemies.value) {
      counts[e.tier]++
      if (e.isOverdue) counts.overdue++
      counts.total++
    }
    return counts
  })

  // ─── Active Buff ───
  const activeBuff = computed(() => {
    const now = Date.now()
    return buffs.value.find(b => now - b.startTime < b.duration) ?? null
  })

  const hasFirewall = computed(() => {
    const now = Date.now()
    return buffs.value.some(b => b.type === 'firewall' && now - b.startTime < b.duration)
  })

  // ─── Phase Transitions ───
  function setPhase(newPhase: GamePhase): boolean {
    if (!canTransition(phase.value, newPhase)) {
      console.warn(`[Arena] Invalid transition: ${phase.value} → ${newPhase}`)
      return false
    }
    phase.value = newPhase
    return true
  }

  // ─── Combat Log ───
  function addLog(message: string, type: CombatLogEntry['type'], color?: string) {
    combatLog.value.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message,
      type,
      timestamp: Date.now(),
      color: color ?? LOG_COLORS[type],
    })
    if (combatLog.value.length > COMBAT_LOG_MAX) {
      combatLog.value = combatLog.value.slice(0, COMBAT_LOG_MAX)
    }
  }

  // ─── Initialize ───
  function initializeArena(tasks: Task[]) {
    // Reset everything
    enemies.value = []
    projectiles.value = []
    buffs.value = []
    combatLog.value = []
    corruption.value = 0
    waveNumber.value = 1
    targetedEnemyId.value = null
    abilityCharges.value = 3
    abilityCooldowns.value = {}
    if (spawnTimer.value) {
      clearInterval(spawnTimer.value)
      spawnTimer.value = null
    }

    // Reset player
    player.value = {
      position: { x: 0, y: 0, z: 0 },
      health: BASE_PLAYER_STATS.health,
      maxHealth: BASE_PLAYER_STATS.maxHealth,
      attackDamage: BASE_PLAYER_STATS.attackDamage,
      attackSpeed: BASE_PLAYER_STATS.attackSpeed,
      focusDamage: BASE_PLAYER_STATS.focusDamage,
    }

    // Generate enemies from tasks and put into spawn queue
    const generated = generateEnemyWave(tasks)
    spawnQueue.value = generated

    // Initialize run
    currentRun.value = {
      date: new Date().toISOString().split('T')[0],
      seed: Date.now(),
      enemyCount: generated.length,
      enemiesKilled: 0,
      bossDefeated: false,
      abilitiesUsed: 0,
      totalXpEarned: 0,
      maxCorruptionReached: 0,
      status: 'active',
    }

    // Transition to briefing
    phase.value = 'idle'
    setPhase('loading')
    setPhase('briefing')

    addLog(`ARIA: ${generated.length} hostile signatures detected.`, 'system')
  }

  // ─── Start Wave ───
  function startWave() {
    if (!setPhase('wave_active')) return

    addLog(`WAVE ${waveNumber.value} — ENGAGE!`, 'system')

    // Start staggered spawning
    spawnTimer.value = setInterval(() => {
      spawnNextEnemy()
    }, SPAWN_INTERVAL)

    // Spawn first enemy immediately
    spawnNextEnemy()
  }

  // ─── Spawn Next Enemy ───
  function spawnNextEnemy() {
    if (spawnQueue.value.length === 0) {
      if (spawnTimer.value) {
        clearInterval(spawnTimer.value)
        spawnTimer.value = null
      }
      return
    }

    const enemy = spawnQueue.value.shift()!
    enemies.value.push(enemy)

    arenaEventBus.emit('enemy_spawned', { enemyId: enemy.id, tier: enemy.tier })
    addLog(`Hostile spawned: ${enemy.tier} tier`, 'system')

    if (enemy.tier === 'boss') {
      arenaEventBus.emit('boss_spawned', { enemyId: enemy.id })
    }
  }

  // ─── Shoot Enemy (click-to-shoot) ───
  function shootEnemy(enemyId: string) {
    const enemy = enemies.value.find(e => e.id === enemyId)
    if (!enemy || enemy.state === 'dead' || enemy.state === 'dying') return
    if (phase.value !== 'wave_active' && phase.value !== 'boss_phase') return

    const p = player.value
    const damage = calculateManualShotDamage(p, buffs.value)

    // Create projectile — damage applied on arrival in game loop
    const projectile: ProjectileEntity = {
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fromX: p.position.x,
      fromZ: p.position.z,
      toX: enemy.position.x,
      toZ: enemy.position.z,
      targetEnemyId: enemyId,
      speed: 20,
      progress: 0,
      color: '#14b8ff',
      damage,
    }

    projectiles.value.push(projectile)
    targetedEnemyId.value = enemyId

    arenaEventBus.emit('enemy_targeted', { enemyId })
  }

  // ─── Projectile Impact ───
  function handleProjectileImpact(projectileId: string) {
    const idx = projectiles.value.findIndex(p => p.id === projectileId)
    if (idx === -1) return

    const proj = projectiles.value[idx]
    projectiles.value.splice(idx, 1)

    // Apply damage
    damageEnemy(proj.targetEnemyId, proj.damage)

    arenaEventBus.emit('projectile_impact', {
      projectileId: proj.id,
      enemyId: proj.targetEnemyId,
      damage: proj.damage,
    })
  }

  // ─── Damage Enemy ───
  function damageEnemy(enemyId: string, amount: number) {
    const idx = enemies.value.findIndex(e => e.id === enemyId)
    if (idx === -1) return

    const enemy = enemies.value[idx]
    if (enemy.state === 'dead' || enemy.state === 'dying') return

    const newHealth = Math.max(0, enemy.health - amount)
    enemies.value[idx] = { ...enemy, health: newHealth }

    arenaEventBus.emit('enemy_damaged', {
      enemyId,
      damage: amount,
      remainingHp: newHealth,
    })

    addLog(`Hit ${enemy.tier} → -${amount} HP (${newHealth} left)`, 'damage')

    if (newHealth <= 0) {
      killEnemy(enemyId)
    }
  }

  // ─── Kill Enemy ───
  function killEnemy(enemyId: string) {
    const idx = enemies.value.findIndex(e => e.id === enemyId)
    if (idx === -1) return

    const enemy = enemies.value[idx]
    if (enemy.state === 'dead' || enemy.state === 'dying') return

    // Set dying state
    enemies.value[idx] = { ...enemy, state: 'dying', health: 0 }

    const loot = calculateLoot(enemy)

    // Update run stats
    if (currentRun.value) {
      currentRun.value = {
        ...currentRun.value,
        enemiesKilled: currentRun.value.enemiesKilled + 1,
        totalXpEarned: currentRun.value.totalXpEarned + loot.xp,
        bossDefeated: currentRun.value.bossDefeated || enemy.tier === 'boss',
      }
    }

    // Award ability charges
    if (loot.charges > 0) {
      abilityCharges.value += loot.charges
      addLog(`+${loot.charges} ability charge${loot.charges > 1 ? 's' : ''}`, 'ability')
    }

    addLog(`ELIMINATED: ${enemy.tier} → +${loot.xp} XP`, 'kill')

    arenaEventBus.emit('enemy_killed', {
      enemyId,
      taskId: enemy.taskId,
      xp: loot.xp,
    })

    // Transition to dead after animation
    setTimeout(() => {
      const i = enemies.value.findIndex(e => e.id === enemyId)
      if (i !== -1) {
        enemies.value[i] = { ...enemies.value[i], state: 'dead' }
      }
      checkWaveCleared()
    }, DEATH_ANIMATION_MS)
  }

  // ─── Player Movement (WASD) ───
  function movePlayer(dx: number, dz: number) {
    const p = player.value
    player.value = {
      ...p,
      position: {
        x: Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, p.position.x + dx)),
        y: p.position.y,
        z: Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, p.position.z + dz)),
      },
    }
  }

  // ─── Activate Ability (1-4 keys) ───
  function activateAbility(index: number) {
    if (index < 0 || index >= ABILITY_DEFINITIONS.length) return
    const def = ABILITY_DEFINITIONS[index]

    // Check charges
    if (abilityCharges.value < def.chargeCost) {
      addLog(`Not enough charges for ${def.name}`, 'system')
      return
    }

    // Check cooldown
    const cooldownEnd = abilityCooldowns.value[def.id] ?? 0
    if (Date.now() < cooldownEnd) {
      addLog(`${def.name} on cooldown`, 'system')
      return
    }

    // Spend charges and set cooldown
    abilityCharges.value -= def.chargeCost
    abilityCooldowns.value[def.id] = Date.now() + def.cooldown

    if (currentRun.value) {
      currentRun.value = {
        ...currentRun.value,
        abilitiesUsed: currentRun.value.abilitiesUsed + 1,
      }
    }

    // Execute ability
    switch (def.id) {
      case 'emp_blast': {
        const effect = activateEmpBlast(enemies.value, player.value.position.x, player.value.position.z)
        for (const eid of effect.affectedEnemyIds) {
          damageEnemy(eid, effect.damagePerEnemy)
        }
        addLog(`EMP BLAST → ${effect.affectedEnemyIds.length} enemies hit for ${effect.damagePerEnemy} each`, 'ability')
        break
      }
      case 'firewall': {
        const effect = activateFirewall()
        buffs.value.push(effect.buff)
        addLog('FIREWALL → Corruption frozen for 60s', 'ability')
        break
      }
      case 'overclock': {
        const effect = activateOverclock()
        buffs.value.push(effect.buff)
        addLog('OVERCLOCK → 2x damage for 30s', 'ability')
        break
      }
      case 'purge': {
        const effect = activatePurge(enemies.value)
        if (effect.killedEnemyId) {
          killEnemy(effect.killedEnemyId)
          addLog('PURGE → Weakest enemy instantly killed', 'ability')
        } else {
          addLog('PURGE → No targets', 'system')
        }
        break
      }
    }

    arenaEventBus.emit('ability_activated', { abilityId: def.id, name: def.name })
  }

  // ─── Task/Pomodoro Integration (called by sync composable) ───
  function handleTaskCompleted(taskId: string) {
    const enemy = enemies.value.find(e => e.taskId === taskId && e.state !== 'dead' && e.state !== 'dying')
    if (enemy) {
      damageEnemy(enemy.id, enemy.health)
      addLog(`TASK COMPLETED → Enemy instantly destroyed!`, 'kill')
    }
  }

  function handlePomodoroStart(taskId: string) {
    const enemy = enemies.value.find(e => e.taskId === taskId && e.state !== 'dead' && e.state !== 'dying')
    if (enemy) {
      targetedEnemyId.value = enemy.id
      addLog('FOCUS MODE → Targeting enemy', 'system')
    }
  }

  function handlePomodoroComplete() {
    const enemy = targetedEnemy.value
    if (enemy && enemy.state !== 'dead' && enemy.state !== 'dying') {
      const damage = calculateFocusDamage(player.value, buffs.value)
      damageEnemy(enemy.id, damage)
      addLog(`FOCUS STRIKE → -${damage} HP!`, 'damage')
    }
  }

  // ─── Corruption ───
  function addCorruption(amount: number) {
    if (hasFirewall.value) return

    const prev = corruption.value
    corruption.value = Math.max(0, Math.min(1, corruption.value + amount))

    if (currentRun.value && corruption.value > currentRun.value.maxCorruptionReached) {
      currentRun.value = { ...currentRun.value, maxCorruptionReached: corruption.value }
    }

    arenaEventBus.emit('corruption_changed', { corruption: corruption.value, delta: amount })

    if (corruption.value >= 1 && prev < 1) {
      // Defeat
      setPhase('defeat')
      if (currentRun.value) {
        currentRun.value = { ...currentRun.value, status: 'abandoned' }
      }
      addLog('SYSTEM CORRUPTED — DEFEAT', 'system', '#ff0000')
      arenaEventBus.emit('defeat', {
        corruption: corruption.value,
        enemiesKilled: enemiesKilled.value,
      })
    }
  }

  // ─── Wave Check ───
  function checkWaveCleared() {
    if (spawnQueue.value.length > 0) return

    const alive = enemies.value.filter(e => e.state !== 'dead' && e.state !== 'dying')
    if (alive.length > 0) return

    if (!setPhase('wave_cleared')) return

    arenaEventBus.emit('wave_cleared', {
      waveNumber: waveNumber.value,
      enemiesKilled: enemiesKilled.value,
    })

    // Go to victory
    setPhase('victory')

    if (currentRun.value) {
      currentRun.value = { ...currentRun.value, status: 'completed' }
    }

    addLog('ALL THREATS ELIMINATED — SECTOR CLEARED!', 'system', '#00ff88')
    arenaEventBus.emit('victory', {
      totalXp: currentRun.value?.totalXpEarned ?? 0,
      enemiesKilled: enemiesKilled.value,
    })
  }

  // ─── Buff Management ───
  function applyBuff(buff: Buff) {
    buffs.value.push(buff)
  }

  function checkBuffExpiry() {
    const now = Date.now()
    buffs.value = buffs.value.filter(b => now - b.startTime < b.duration)
  }

  // ─── Cleanup ───
  function cleanup() {
    if (spawnTimer.value) {
      clearInterval(spawnTimer.value)
      spawnTimer.value = null
    }
    phase.value = 'idle'
    player.value = {
      position: { x: 0, y: 0, z: 0 },
      health: BASE_PLAYER_STATS.health,
      maxHealth: BASE_PLAYER_STATS.maxHealth,
      attackDamage: BASE_PLAYER_STATS.attackDamage,
      attackSpeed: BASE_PLAYER_STATS.attackSpeed,
      focusDamage: BASE_PLAYER_STATS.focusDamage,
    }
    enemies.value = []
    projectiles.value = []
    buffs.value = []
    combatLog.value = []
    corruption.value = 0
    waveNumber.value = 1
    currentRun.value = null
    targetedEnemyId.value = null
    spawnQueue.value = []
    abilityCharges.value = 3
    abilityCooldowns.value = {}
    arenaEventBus.clear()
  }

  return {
    // State
    phase,
    player,
    enemies,
    projectiles,
    buffs,
    combatLog,
    corruption,
    waveNumber,
    currentRun,
    targetedEnemyId,
    spawnQueue,
    spawnTimer,
    abilityCharges,
    abilityCooldowns,

    // Computed
    activeEnemies,
    targetedEnemy,
    enemiesKilled,
    isWaveActive,
    isBossPhase,
    isVictory,
    isDefeated,
    corruptionPercent,
    enemyBreakdown,
    activeBuff,
    hasFirewall,

    // Actions
    initializeArena,
    startWave,
    shootEnemy,
    handleProjectileImpact,
    damageEnemy,
    killEnemy,
    movePlayer,
    activateAbility,
    handleTaskCompleted,
    handlePomodoroStart,
    handlePomodoroComplete,
    addCorruption,
    checkWaveCleared,
    spawnNextEnemy,
    applyBuff,
    checkBuffExpiry,
    cleanup,
    addLog,
  }
})
