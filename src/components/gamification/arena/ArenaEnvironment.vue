<script setup lang="ts">
/**
 * ArenaEnvironment.vue — Arena floor, grid, and atmosphere
 * Dark cyberpunk arena with neon boundary ring
 */
import { useArenaRenderer } from '@/composables/arena/useArenaRenderer'

const { themeColors } = useArenaRenderer()
</script>

<template>
  <TresGroup>
    <!-- Floor: large dark plane -->
    <TresMesh :position="[0, 0, 0]" :rotation="[-Math.PI / 2, 0, 0]" receive-shadow>
      <TresPlaneGeometry :args="[40, 40]" />
      <TresMeshStandardMaterial
        color="#0a0a15"
        :roughness="0.9"
        :metalness="0.1"
      />
    </TresMesh>

    <!-- Grid lines: wireframe overlay for floor grid effect -->
    <TresMesh :position="[0, 0.01, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresPlaneGeometry :args="[40, 40, 40, 40]" />
      <TresMeshStandardMaterial
        :color="themeColors.neonPrimary"
        :wireframe="true"
        :transparent="true"
        :opacity="0.05"
      />
    </TresMesh>

    <!-- Arena boundary ring: neon cyan at radius 12 -->
    <TresMesh :position="[0, 0.02, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresRingGeometry :args="[11.8, 12.2, 64]" />
      <TresMeshStandardMaterial
        color="#00ffff"
        emissive="#00ffff"
        :emissive-intensity="1.0"
        :transparent="true"
        :opacity="0.3"
        :side="2"
      />
    </TresMesh>

    <!-- Center hex marker (subtle spawn point indicator) -->
    <TresMesh :position="[0, 0.015, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresRingGeometry :args="[0.8, 1.0, 6]" />
      <TresMeshStandardMaterial
        :color="themeColors.neonPrimary"
        :emissive="themeColors.neonPrimary"
        :emissive-intensity="0.5"
        :transparent="true"
        :opacity="0.15"
        :side="2"
      />
    </TresMesh>
  </TresGroup>
</template>
