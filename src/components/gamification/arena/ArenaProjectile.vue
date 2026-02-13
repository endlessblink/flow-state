<script setup lang="ts">
/**
 * ArenaProjectile.vue — Visible projectile traveling from player to target enemy
 * Interpolates position using projectile.progress (0 to 1)
 * Small bright sphere with trail effect
 */
import { computed } from 'vue'
import type { ProjectileEntity } from '@/types/arena'

const props = defineProps<{
  projectile: ProjectileEntity
}>()

// Interpolate position between from and to using progress
const posX = computed(() =>
  props.projectile.fromX + (props.projectile.toX - props.projectile.fromX) * props.projectile.progress
)
const posZ = computed(() =>
  props.projectile.fromZ + (props.projectile.toZ - props.projectile.fromZ) * props.projectile.progress
)

// Trail position (slightly behind the main projectile)
const trailProgress = computed(() => Math.max(0, props.projectile.progress - 0.08))
const trailX = computed(() =>
  props.projectile.fromX + (props.projectile.toX - props.projectile.fromX) * trailProgress.value
)
const trailZ = computed(() =>
  props.projectile.fromZ + (props.projectile.toZ - props.projectile.fromZ) * trailProgress.value
)
</script>

<template>
  <TresGroup>
    <!-- Main projectile sphere -->
    <TresMesh :position="[posX, 0.5, posZ]">
      <TresSphereGeometry :args="[0.08, 8, 8]" />
      <TresMeshStandardMaterial
        :color="projectile.color"
        :emissive="projectile.color"
        :emissive-intensity="3.0"
      />
    </TresMesh>

    <!-- Trail: smaller sphere behind -->
    <TresMesh
      v-if="projectile.progress > 0.08"
      :position="[trailX, 0.5, trailZ]"
    >
      <TresSphereGeometry :args="[0.05, 6, 6]" />
      <TresMeshStandardMaterial
        :color="projectile.color"
        :emissive="projectile.color"
        :emissive-intensity="2.0"
        :transparent="true"
        :opacity="0.5"
      />
    </TresMesh>
  </TresGroup>
</template>
