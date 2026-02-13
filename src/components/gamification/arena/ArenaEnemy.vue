<script setup lang="ts">
/**
 * ArenaEnemy.vue — Single enemy entity in the 3D arena
 * Click on enemy = shootEnemy (fires visible projectile)
 * Tier determines geometry: grunt=octahedron, standard=dodecahedron, elite=icosahedron, boss=large icosahedron
 * Hit flash on damage, pulsing red glow when overdue, scale-down on dying
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useLoop } from '@tresjs/core'
import type { EnemyEntity } from '@/types/arena'
import { useArenaStore } from '@/stores/arena'
import { arenaEventBus } from '@/services/arena/arenaEventBus'

const props = defineProps<{
  enemy: EnemyEntity
}>()

const arenaStore = useArenaStore()

// Rotation animation
const rotationY = ref(0)

// Boss emissive pulsing
const bossEmissiveIntensity = ref(1.0)

// Hit flash: briefly white on damage
const isHit = ref(false)

// Overdue pulsing glow
const overdueGlow = ref(0.6)

// Dying scale (1.0 -> 0.0 over 300ms)
const dyingScale = ref(1.0)
let dyingStart = 0

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta }) => {
  // Slow rotation
  rotationY.value += delta * 0.8

  // Boss emissive pulse
  if (props.enemy.tier === 'boss') {
    bossEmissiveIntensity.value = 1.5 + Math.sin(Date.now() * 0.003) * 0.8
  }

  // Overdue red glow oscillation
  if (props.enemy.isOverdue) {
    overdueGlow.value = 0.6 + Math.sin(Date.now() * 0.004) * 0.4
  }

  // Dying scale-down animation
  if (props.enemy.state === 'dying') {
    if (dyingStart === 0) dyingStart = Date.now()
    const elapsed = Date.now() - dyingStart
    dyingScale.value = Math.max(0, 1 - elapsed / 300)
  }
})

// Subscribe to enemy_damaged event for hit flash on THIS enemy
function onEnemyDamaged(payload: { enemyId: string; damage: number; remainingHp: number }) {
  if (payload.enemyId === props.enemy.id) {
    isHit.value = true
    setTimeout(() => { isHit.value = false }, 150)
  }
}

onMounted(() => {
  arenaEventBus.on('enemy_damaged', onEnemyDamaged)
})

onUnmounted(() => {
  arenaEventBus.off('enemy_damaged', onEnemyDamaged)
})

// Click handler: fire projectile at this enemy
function handleClick(e: Event) {
  e.stopPropagation?.()
  if (props.enemy.state === 'dead' || props.enemy.state === 'dying') return
  arenaStore.shootEnemy(props.enemy.id)
}

// Computed material properties
const materialColor = computed(() => isHit.value ? '#ffffff' : props.enemy.glowColor)
const emissiveColor = computed(() => isHit.value ? '#ffffff' : props.enemy.glowColor)

const emissiveIntensity = computed(() => {
  if (isHit.value) return 3.0
  if (props.enemy.tier === 'boss') return bossEmissiveIntensity.value
  if (props.enemy.isOverdue) return overdueGlow.value
  return 0.6
})

const isDying = computed(() => props.enemy.state === 'dying')
const materialOpacity = computed(() => isDying.value ? 0.3 : 1.0)

// Health bar width (0-1 ratio)
const healthRatio = computed(() =>
  props.enemy.maxHealth > 0 ? props.enemy.health / props.enemy.maxHealth : 0
)

// Scale: enemy.size adjusted by dying animation
const enemyScale = computed(() => {
  const base = props.enemy.size
  return isDying.value ? base * dyingScale.value : base
})
</script>

<template>
  <TresGroup
    :position="[enemy.position.x, 0, enemy.position.z]"
    :scale="[enemyScale, enemyScale, enemyScale]"
    @click="handleClick"
  >
    <!-- Rotating inner group -->
    <TresGroup :rotation="[0, rotationY, 0]">
      <!-- Grunt: octahedron -->
      <TresMesh v-if="enemy.tier === 'grunt'">
        <TresOctahedronGeometry :args="[1, 0]" />
        <TresMeshStandardMaterial
          :color="materialColor"
          :emissive="emissiveColor"
          :emissive-intensity="emissiveIntensity"
          :opacity="materialOpacity"
          :transparent="isDying"
          :metalness="0.7"
          :roughness="0.3"
        />
      </TresMesh>

      <!-- Standard: dodecahedron -->
      <TresMesh v-if="enemy.tier === 'standard'">
        <TresDodecahedronGeometry :args="[1, 0]" />
        <TresMeshStandardMaterial
          :color="materialColor"
          :emissive="emissiveColor"
          :emissive-intensity="emissiveIntensity"
          :opacity="materialOpacity"
          :transparent="isDying"
          :metalness="0.7"
          :roughness="0.3"
        />
      </TresMesh>

      <!-- Elite: icosahedron -->
      <TresMesh v-if="enemy.tier === 'elite'">
        <TresIcosahedronGeometry :args="[1, 0]" />
        <TresMeshStandardMaterial
          :color="materialColor"
          :emissive="emissiveColor"
          :emissive-intensity="emissiveIntensity"
          :opacity="materialOpacity"
          :transparent="isDying"
          :metalness="0.8"
          :roughness="0.2"
        />
      </TresMesh>

      <!-- Boss: large icosahedron with subdivision -->
      <TresMesh v-if="enemy.tier === 'boss'">
        <TresIcosahedronGeometry :args="[1, 1]" />
        <TresMeshStandardMaterial
          :color="materialColor"
          :emissive="emissiveColor"
          :emissive-intensity="emissiveIntensity"
          :opacity="materialOpacity"
          :transparent="isDying"
          :metalness="0.9"
          :roughness="0.1"
        />
      </TresMesh>

      <!-- Eye (small red sphere) -->
      <TresMesh :position="[0, 0.6, 0]">
        <TresSphereGeometry :args="[0.12, 8, 8]" />
        <TresMeshStandardMaterial
          color="#ff0033"
          emissive="#ff0033"
          :emissive-intensity="1.2"
        />
      </TresMesh>
    </TresGroup>

    <!-- Targeting ring (visible when this enemy is targeted) -->
    <TresMesh
      v-if="arenaStore.targetedEnemyId === enemy.id"
      :position="[0, 0.05, 0]"
      :rotation="[-Math.PI / 2, 0, 0]"
    >
      <TresRingGeometry :args="[1.1, 1.3, 32]" />
      <TresMeshStandardMaterial
        color="#00ffff"
        emissive="#00ffff"
        :emissive-intensity="1.5"
        :transparent="true"
        :opacity="0.6"
        :side="2"
      />
    </TresMesh>

    <!-- Health bar background (dark bar above enemy) -->
    <TresMesh :position="[0, 1.8, 0]" :rotation="[0, 0, 0]">
      <TresPlaneGeometry :args="[1.2, 0.1]" />
      <TresMeshBasicMaterial
        color="#1a1a2e"
        :transparent="true"
        :opacity="0.8"
      />
    </TresMesh>

    <!-- Health bar fill (colored, scaled by health ratio) -->
    <TresMesh
      :position="[-0.6 * (1 - healthRatio) * 0.5, 1.8, 0.001]"
      :scale="[healthRatio, 1, 1]"
    >
      <TresPlaneGeometry :args="[1.2, 0.08]" />
      <TresMeshBasicMaterial
        :color="enemy.glowColor"
      />
    </TresMesh>
  </TresGroup>
</template>
