// Arena game loop — WASD input, enemy approach, projectile movement,
// auto-attack, buff expiry, defeat check.
// MUST be called inside a component that is a child of <TresCanvas>.
import { onMounted, onUnmounted } from 'vue'
import { useLoop } from '@tresjs/core'
import { useArenaStore } from '@/stores/arena'
import { calculateAutoAttackDamage } from '@/services/arena/arenaCombat'

const PLAYER_SPEED = 5 // units per second
const AUTO_ATTACK_INTERVAL = 4 // seconds

export function useArenaGameLoop() {
  const store = useArenaStore()

  // ─── Keyboard Input ───

  const pressed = new Set<string>()

  function onKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    pressed.add(e.key.toLowerCase())

    // Ability keys 1-4
    const num = parseInt(e.key, 10)
    if (num >= 1 && num <= 4) {
      store.activateAbility(num - 1)
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    pressed.delete(e.key.toLowerCase())
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    pressed.clear()
  })

  // ─── Timers ───

  let autoAttackTimer = 0

  // ─── Game Loop ───

  const { onBeforeRender } = useLoop()

  onBeforeRender(({ delta }) => {
    const phase = store.phase
    if (phase !== 'wave_active' && phase !== 'boss_phase') return

    // 1. WASD Player Movement
    let dx = 0
    let dz = 0
    if (pressed.has('w') || pressed.has('arrowup')) dz -= 1
    if (pressed.has('s') || pressed.has('arrowdown')) dz += 1
    if (pressed.has('a') || pressed.has('arrowleft')) dx -= 1
    if (pressed.has('d') || pressed.has('arrowright')) dx += 1

    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz)
      dx = (dx / len) * PLAYER_SPEED * delta
      dz = (dz / len) * PLAYER_SPEED * delta
      store.movePlayer(dx, dz)
    }

    // 2. Enemy Movement — each enemy approaches center (0,0) at its approachSpeed
    for (let i = 0; i < store.enemies.length; i++) {
      const enemy = store.enemies[i]
      if (enemy.state !== 'approaching') continue

      const ex = enemy.position.x
      const ez = enemy.position.z
      const dist = Math.sqrt(ex * ex + ez * ez)

      if (dist < 0.5) {
        // Enemy reached center — add corruption, mark as combat
        store.enemies[i] = { ...enemy, state: 'combat' }
        store.addCorruption(0.05)
        store.addLog('Hostile reached the core! +5% corruption', 'system')
        continue
      }

      // Move toward origin (0,0)
      const step = enemy.approachSpeed * delta
      const ratio = Math.min(step / dist, 1)
      store.enemies[i] = {
        ...enemy,
        position: {
          x: ex * (1 - ratio),
          y: enemy.position.y,
          z: ez * (1 - ratio),
        },
      }
    }

    // 3. Projectile Movement — update progress, trigger impact on arrival
    for (let i = store.projectiles.length - 1; i >= 0; i--) {
      const proj = store.projectiles[i]
      const pdx = proj.toX - proj.fromX
      const pdz = proj.toZ - proj.fromZ
      const totalDist = Math.sqrt(pdx * pdx + pdz * pdz)

      if (totalDist === 0) {
        store.handleProjectileImpact(proj.id)
        continue
      }

      const newProgress = proj.progress + (proj.speed * delta) / totalDist
      if (newProgress >= 1.0) {
        store.handleProjectileImpact(proj.id)
      } else {
        store.projectiles[i] = { ...proj, progress: newProgress }
      }
    }

    // 4. Auto-Attack — every 4 seconds, deal direct damage to nearest enemy
    //    (15 HP base, boosted by overclock). This is chip damage, not a projectile.
    autoAttackTimer += delta
    if (autoAttackTimer >= AUTO_ATTACK_INTERVAL) {
      autoAttackTimer -= AUTO_ATTACK_INTERVAL

      const alive = store.enemies.filter(
        e => e.state !== 'dead' && e.state !== 'dying'
      )
      if (alive.length > 0) {
        const px = store.player.position.x
        const pz = store.player.position.z
        let nearest = alive[0]
        let nearestDistSq = Infinity

        for (const e of alive) {
          const edx = e.position.x - px
          const edz = e.position.z - pz
          const dSq = edx * edx + edz * edz
          if (dSq < nearestDistSq) {
            nearestDistSq = dSq
            nearest = e
          }
        }

        const damage = calculateAutoAttackDamage(store.player, store.buffs)
        store.damageEnemy(nearest.id, damage)
      }
    }

    // 5. Buff Expiry
    store.checkBuffExpiry()

    // 6. Defeat Check — store.addCorruption handles the phase transition,
    //    but guard against edge cases where corruption was set externally.
    if (store.corruption >= 1 && store.phase !== 'defeat') {
      store.addCorruption(0)
    }
  })
}
