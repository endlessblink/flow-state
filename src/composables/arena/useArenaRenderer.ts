// Arena renderer — camera follow, screen shake, theme colors.
// Does NOT require TresCanvas context. Exports updateCamera() for the game engine to call.
import { ref, onUnmounted } from 'vue'
import { useArenaStore } from '@/stores/arena'
import { arenaEventBus } from '@/services/arena/arenaEventBus'

const CAMERA_Y = 15
const CAMERA_Z_OFFSET = 10
const LERP_FACTOR = 0.08

export function useArenaRenderer() {
  const store = useArenaStore()

  // ─── Camera Position (lerps toward player) ───

  const cameraPosition = ref({ x: 0, y: CAMERA_Y, z: CAMERA_Z_OFFSET })
  const cameraOffset = ref({ x: 0, z: 0 })

  function updateCamera(_delta: number) {
    const targetX = store.player.position.x
    const targetZ = store.player.position.z + CAMERA_Z_OFFSET

    cameraPosition.value = {
      x: cameraPosition.value.x + (targetX - cameraPosition.value.x) * LERP_FACTOR,
      y: CAMERA_Y,
      z: cameraPosition.value.z + (targetZ - cameraPosition.value.z) * LERP_FACTOR,
    }
  }

  // ─── Screen Shake ───

  let shakeAnimId = 0

  function triggerScreenShake(intensity: number, duration: number) {
    const startTime = Date.now()

    if (shakeAnimId) cancelAnimationFrame(shakeAnimId)

    const shake = () => {
      const elapsed = Date.now() - startTime
      if (elapsed > duration) {
        cameraOffset.value = { x: 0, z: 0 }
        shakeAnimId = 0
        return
      }
      const decay = 1 - elapsed / duration
      cameraOffset.value = {
        x: (Math.random() - 0.5) * intensity * decay * 0.1,
        z: (Math.random() - 0.5) * intensity * decay * 0.1,
      }
      shakeAnimId = requestAnimationFrame(shake)
    }
    shake()
  }

  // ─── Event Bus Subscriptions ───

  const onEnemyKilled = () => {
    triggerScreenShake(5, 200)
  }

  const onAbilityActivated = () => {
    triggerScreenShake(8, 300)
  }

  arenaEventBus.on('enemy_killed', onEnemyKilled)
  arenaEventBus.on('ability_activated', onAbilityActivated)

  onUnmounted(() => {
    arenaEventBus.off('enemy_killed', onEnemyKilled)
    arenaEventBus.off('ability_activated', onAbilityActivated)
    if (shakeAnimId) cancelAnimationFrame(shakeAnimId)
  })

  // ─── Theme Colors (Ruiner palette) ───

  const themeColors = {
    fogColor: '#0a0520',
    ambientColor: '#050510',
  }

  return {
    cameraPosition,
    cameraOffset,
    updateCamera,
    triggerScreenShake,
    themeColors,
  }
}
