<script setup lang="ts">
/**
 * ArenaPlayer.vue — Player character in the 3D arena
 * WASD-controlled position from store. Cyan sphere body + blue cone visor + attack beam.
 */
import { computed, ref } from 'vue'
import { useLoop } from '@tresjs/core'
import { useArenaStore } from '@/stores/arena'
import { useTimerStore } from '@/stores/timer'

const arenaStore = useArenaStore()
const timerStore = useTimerStore()

// Player position from store (WASD driven)
const playerX = computed(() => arenaStore.player?.position.x ?? 0)
const playerZ = computed(() => arenaStore.player?.position.z ?? 0)

// Idle bob animation
const bobY = ref(0)

const { onBeforeRender } = useLoop()

onBeforeRender(() => {
  bobY.value = Math.sin(Date.now() * 0.002) * 0.1
})

// Calculate beam direction toward targeted enemy (relative to player position)
const targetedEnemy = computed(() => arenaStore.targetedEnemy)

const showBeam = computed(() =>
  (arenaStore.isWaveActive || arenaStore.isBossPhase) && targetedEnemy.value && beamLength.value > 0.5
)

// Beam color: magenta during pomodoro focus, cyan for auto-attack
const beamColor = computed(() => {
  if (timerStore.isTimerActive && targetedEnemy.value?.taskId === timerStore.currentTaskId) {
    return '#ff00ff'
  }
  return '#00ffff'
})

const beamLength = computed(() => {
  if (!targetedEnemy.value || !arenaStore.player) return 0
  const dx = targetedEnemy.value.position.x - playerX.value
  const dz = targetedEnemy.value.position.z - playerZ.value
  return Math.sqrt(dx * dx + dz * dz)
})

const beamRotationY = computed(() => {
  if (!targetedEnemy.value || !arenaStore.player) return 0
  const dx = targetedEnemy.value.position.x - playerX.value
  const dz = targetedEnemy.value.position.z - playerZ.value
  return Math.atan2(dx, dz)
})
</script>

<template>
  <TresGroup :position="[playerX, bobY, playerZ]">
    <!-- Body: cyan sphere -->
    <TresMesh :position="[0, 0.5, 0]">
      <TresSphereGeometry :args="[0.5, 16, 16]" />
      <TresMeshStandardMaterial
        color="#00ddff"
        emissive="#00ffff"
        :emissive-intensity="0.4"
        :metalness="0.6"
        :roughness="0.3"
      />
    </TresMesh>

    <!-- Visor: blue cone on top -->
    <TresMesh :position="[0, 1.15, 0]">
      <TresConeGeometry :args="[0.2, 0.35, 8]" />
      <TresMeshStandardMaterial
        color="#0044ff"
        emissive="#0066ff"
        :emissive-intensity="0.6"
        :metalness="0.8"
        :roughness="0.2"
      />
    </TresMesh>

    <!-- Base glow ring -->
    <TresMesh :position="[0, 0.02, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresRingGeometry :args="[0.5, 0.7, 32]" />
      <TresMeshStandardMaterial
        color="#00ffff"
        emissive="#00ffff"
        :emissive-intensity="0.8"
        :transparent="true"
        :opacity="0.3"
        :side="2"
      />
    </TresMesh>

    <!-- Attack beam toward targeted enemy (only during active wave) -->
    <TresGroup
      v-if="showBeam"
      :rotation="[0, beamRotationY, 0]"
    >
      <TresMesh
        :position="[0, 0.5, beamLength / 2]"
        :rotation="[Math.PI / 2, 0, 0]"
      >
        <TresCylinderGeometry :args="[0.02, 0.02, beamLength, 4]" />
        <TresMeshStandardMaterial
          :color="beamColor"
          :emissive="beamColor"
          :emissive-intensity="2.0"
          :transparent="true"
          :opacity="0.7"
        />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
