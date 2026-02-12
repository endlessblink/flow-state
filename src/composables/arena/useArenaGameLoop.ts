// Arena game loop — drives WASD movement, enemy approach, slow auto-attack
// Must be called inside TresCanvas context (uses useLoop from @tresjs/core)
import { ref, onMounted, onUnmounted } from 'vue'
import { useLoop } from '@tresjs/core'
import { useArenaStore } from '@/stores/arena'
import {
  calculateAutoAttackDamage,
  updateEnemyApproach,
  calculateCorruptionFromReach,
} from '@/services/arena/arenaCombat'

const PLAYER_SPEED = 5.0 // units per second
const AUTO_ATTACK_INTERVAL = 4.0 // seconds (slow supplemental auto-attack)

export function useArenaGameLoop() {
  const arenaStore = useArenaStore()

  // ─── Keyboard state ───
  const keys = ref<Set<string>>(new Set())

  function onKeyDown(e: KeyboardEvent) {
    // Don't capture if user is typing in an input
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
    keys.value.add(e.key.toLowerCase())
  }

  function onKeyUp(e: KeyboardEvent) {
    keys.value.delete(e.key.toLowerCase())
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  })

  // Auto-attack timing
  const attackCooldown = ref(0)

  const { onBeforeRender } = useLoop()

  onBeforeRender(({ delta }) => {
    if (arenaStore.phase !== 'wave_active' && arenaStore.phase !== 'boss_phase') {
      return
    }
    if (!arenaStore.player) return

    const player = arenaStore.player

    // ─── 1. WASD Player Movement ───
    let dx = 0
    let dz = 0
    if (keys.value.has('w') || keys.value.has('arrowup')) dz -= 1
    if (keys.value.has('s') || keys.value.has('arrowdown')) dz += 1
    if (keys.value.has('a') || keys.value.has('arrowleft')) dx -= 1
    if (keys.value.has('d') || keys.value.has('arrowright')) dx += 1

    if (dx !== 0 || dz !== 0) {
      // Normalize diagonal movement
      const len = Math.sqrt(dx * dx + dz * dz)
      dx = (dx / len) * PLAYER_SPEED * delta
      dz = (dz / len) * PLAYER_SPEED * delta
      arenaStore.movePlayer(dx, dz)
    }

    // ─── 2. Move enemies toward center ───
    let enemiesUpdated = false
    const updatedEnemies = arenaStore.enemies.map(enemy => {
      if (enemy.state !== 'approaching') return enemy

      const updated = updateEnemyApproach(enemy, delta * 1000)
      if (updated !== enemy) enemiesUpdated = true

      // Enemy reached center
      if (updated.state === 'combat' && enemy.state === 'approaching') {
        const corruptionAmount = calculateCorruptionFromReach()
        arenaStore.addCorruption(corruptionAmount)

        if (player) {
          arenaStore.player = {
            ...player,
            health: Math.max(0, player.health - updated.damageOnReach),
          }
        }
        arenaStore.addLog(`"${enemy.taskTitle}" reached the core! +10% corruption`, 'system')
      }

      return updated
    })

    if (enemiesUpdated) {
      arenaStore.enemies = updatedEnemies
    }

    // ─── 3. Slow supplemental auto-attack ───
    attackCooldown.value -= delta
    if (attackCooldown.value <= 0) {
      attackCooldown.value = AUTO_ATTACK_INTERVAL

      const aliveEnemies = arenaStore.enemies.filter(
        e => e.state !== 'dead' && e.state !== 'dying'
      )
      if (aliveEnemies.length === 0) return

      // Auto-target nearest if no target
      let targetId = arenaStore.targetedEnemyId
      if (!targetId || !aliveEnemies.find(e => e.id === targetId)) {
        let nearestDist = Infinity
        for (const e of aliveEnemies) {
          const dist = Math.sqrt(e.position.x ** 2 + e.position.y ** 2 + e.position.z ** 2)
          if (dist < nearestDist) {
            nearestDist = dist
            targetId = e.id
          }
        }
        if (targetId) arenaStore.targetEnemy(targetId)
      }

      if (targetId) {
        const damage = Math.floor(calculateAutoAttackDamage(player))
        arenaStore.damageEnemy(targetId, damage)
      }
    }
  })
}
