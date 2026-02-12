// Arena renderer composable — TresJS scene management (camera, post-processing, screen shake)
import { ref, computed } from 'vue'
import { useArenaStore } from '@/stores/arena'

/**
 * Manages 3D rendering parameters: camera, post-processing intensities,
 * screen shake, and theme colors. Reactive to arena store state.
 */
export function useArenaRenderer() {
  const arenaStore = useArenaStore()

  // Camera position (top-down isometric view)
  const cameraPosition = ref({ x: 0, y: 12, z: 8 })
  const cameraLookAt = ref({ x: 0, y: 0, z: 0 })

  // ─── Post-processing intensities (reactive to game state) ───

  const bloomIntensity = computed(() => {
    const base = 1.2
    if (arenaStore.isBossPhase) return base * 1.8
    if (arenaStore.isWaveActive) return base * 1.2
    if (arenaStore.isVictory) return base * 2.0
    return base
  })

  const chromaticAberration = computed(() => {
    const base = 0.003
    if (arenaStore.isBossPhase) return base * 3
    return base + arenaStore.corruption * 0.01
  })

  const vignetteIntensity = computed(() => {
    return 0.5 + arenaStore.corruption * 0.3
  })

  const noiseOpacity = computed(() => {
    return 0.04 + arenaStore.corruption * 0.08
  })

  // ─── Screen shake ───

  const screenShake = ref({ x: 0, y: 0 })

  function triggerScreenShake(intensity = 0.3, durationMs = 200) {
    const start = Date.now()
    const shake = () => {
      const elapsed = Date.now() - start
      if (elapsed > durationMs) {
        screenShake.value = { x: 0, y: 0 }
        return
      }
      const decay = 1 - elapsed / durationMs
      screenShake.value = {
        x: (Math.random() - 0.5) * intensity * decay,
        y: (Math.random() - 0.5) * intensity * decay,
      }
      requestAnimationFrame(shake)
    }
    requestAnimationFrame(shake)
  }

  // ─── Theme colors (reactive to corruption level) ───

  const themeColors = computed(() => {
    const corrupted = arenaStore.corruption > 0.5
    return {
      ambientColor: corrupted ? '#1a0a0a' : '#0a0a1a',
      fogColor: corrupted ? '#2b0d0d' : '#0d0d2b',
      neonPrimary: corrupted ? '#ff2040' : '#00ffff',
      neonSecondary: '#ff0066',
    }
  })

  return {
    cameraPosition,
    cameraLookAt,
    bloomIntensity,
    chromaticAberration,
    vignetteIntensity,
    noiseOpacity,
    screenShake,
    triggerScreenShake,
    themeColors,
  }
}
