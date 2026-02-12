<script setup lang="ts">
/**
 * ArenaEnemy.vue — Single enemy entity in the 3D arena
 * Click = SHOOT (deals damage + targets)
 * Shows tier via geometry: grunt=octahedron, standard=dodecahedron,
 * elite=icosahedron, boss=large icosahedron with emissive pulse
 */
import { ref } from 'vue'
import { useLoop } from '@tresjs/core'
import type { EnemyEntity } from '@/types/arena'
import { useArenaStore } from '@/stores/arena'

const props = defineProps<{
  enemy: EnemyEntity
}>()

const arenaStore = useArenaStore()

// Rotation animation
const rotationY = ref(0)
const bossEmissiveIntensity = ref(1)

// Hit flash effect
const hitFlash = ref(false)

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta }) => {
  rotationY.value += delta * 0.8

  if (props.enemy.tier === 'boss') {
    bossEmissiveIntensity.value = 1.5 + Math.sin(Date.now() * 0.003) * 0.8
  }
})

function handleClick(e: Event) {
  e.stopPropagation?.()
  if (props.enemy.state === 'dead' || props.enemy.state === 'dying') return

  // SHOOT the enemy (deals damage + targets)
  arenaStore.shootEnemy(props.enemy.id)

  // Hit flash
  hitFlash.value = true
  setTimeout(() => { hitFlash.value = false }, 150)
}

function getEmissiveIntensity(): number {
  if (hitFlash.value) return 3.0 // Bright flash on hit
  if (props.enemy.tier === 'boss') return bossEmissiveIntensity.value
  return 0.6
}

function getOpacity(): number {
  return props.enemy.state === 'dying' ? 0.3 : 1.0
}
</script>

<template>
  <TresGroup
    :position="[enemy.position.x, enemy.position.y, enemy.position.z]"
    :scale="[enemy.scale, enemy.scale, enemy.scale]"
    @click="handleClick"
  >
    <!-- Rotate inner group -->
    <TresGroup :rotation="[0, rotationY, 0]">
      <!-- Grunt: small octahedron -->
      <TresMesh v-if="enemy.tier === 'grunt'" :visible="true">
        <TresOctahedronGeometry :args="[0.5, 0]" />
        <TresMeshStandardMaterial
          :color="hitFlash ? '#ffffff' : enemy.glowColor"
          :emissive="hitFlash ? '#ffffff' : enemy.glowColor"
          :emissive-intensity="getEmissiveIntensity()"
          :opacity="getOpacity()"
          :transparent="enemy.state === 'dying'"
          :metalness="0.7"
          :roughness="0.3"
        />
      </TresMesh>

      <!-- Standard: medium dodecahedron -->
      <TresMesh v-if="enemy.tier === 'standard'" :visible="true">
        <TresDodecahedronGeometry :args="[0.6, 0]" />
        <TresMeshStandardMaterial
          :color="hitFlash ? '#ffffff' : enemy.glowColor"
          :emissive="hitFlash ? '#ffffff' : enemy.glowColor"
          :emissive-intensity="getEmissiveIntensity()"
          :opacity="getOpacity()"
          :transparent="enemy.state === 'dying'"
          :metalness="0.7"
          :roughness="0.3"
        />
      </TresMesh>

      <!-- Elite: large icosahedron -->
      <TresMesh v-if="enemy.tier === 'elite'" :visible="true">
        <TresIcosahedronGeometry :args="[0.7, 0]" />
        <TresMeshStandardMaterial
          :color="hitFlash ? '#ffffff' : enemy.glowColor"
          :emissive="hitFlash ? '#ffffff' : enemy.glowColor"
          :emissive-intensity="getEmissiveIntensity()"
          :opacity="getOpacity()"
          :transparent="enemy.state === 'dying'"
          :metalness="0.8"
          :roughness="0.2"
        />
      </TresMesh>

      <!-- Boss: extra-large icosahedron -->
      <TresMesh v-if="enemy.tier === 'boss'" :visible="true">
        <TresIcosahedronGeometry :args="[1.0, 1]" />
        <TresMeshStandardMaterial
          :color="hitFlash ? '#ffffff' : enemy.glowColor"
          :emissive="hitFlash ? '#ffffff' : enemy.glowColor"
          :emissive-intensity="getEmissiveIntensity()"
          :opacity="getOpacity()"
          :transparent="enemy.state === 'dying'"
          :metalness="0.9"
          :roughness="0.1"
        />
      </TresMesh>

      <!-- Eye (small red sphere) -->
      <TresMesh :position="[0, 0.6, 0]">
        <TresSphereGeometry :args="[0.1, 8, 8]" />
        <TresMeshStandardMaterial
          color="#ff0033"
          emissive="#ff0033"
          :emissive-intensity="1.2"
        />
      </TresMesh>
    </TresGroup>

    <!-- Targeting ring -->
    <TresMesh
      v-if="arenaStore.targetedEnemyId === enemy.id"
      :position="[0, 0.05, 0]"
      :rotation="[-Math.PI / 2, 0, 0]"
    >
      <TresRingGeometry :args="[0.8, 1.0, 32]" />
      <TresMeshStandardMaterial
        color="#00ffff"
        emissive="#00ffff"
        :emissive-intensity="1.5"
        :transparent="true"
        :opacity="0.6"
        :side="2"
      />
    </TresMesh>
  </TresGroup>
</template>
