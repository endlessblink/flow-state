<script setup lang="ts">
/**
 * ArenaEnvironment.vue — Arena platform geometry
 * Hexagonal floor + wireframe grid + neon boundary ring + corner pillars
 * Cyberpunk style with dark metallic surfaces and neon accents
 */
import { useArenaRenderer } from '@/composables/arena/useArenaRenderer'

const { themeColors } = useArenaRenderer()

// Corner pillar positions (hexagonal layout)
const pillarPositions: [number, number, number][] = [
  [10, 1.5, 0],
  [-10, 1.5, 0],
  [5, 1.5, 8.66],
  [-5, 1.5, 8.66],
  [5, 1.5, -8.66],
  [-5, 1.5, -8.66],
]
</script>

<template>
  <TresGroup>
    <!-- Hexagonal floor (CircleGeometry with 6 segments = hexagon) -->
    <TresMesh :position="[0, 0, 0]" :rotation="[-Math.PI / 2, 0, 0]" receive-shadow>
      <TresCircleGeometry :args="[12, 6]" />
      <TresMeshStandardMaterial
        color="#0a0a14"
        :metalness="0.9"
        :roughness="0.4"
      />
    </TresMesh>

    <!-- Grid overlay (wireframe plane for floor grid effect) -->
    <TresMesh :position="[0, 0.01, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresPlaneGeometry :args="[24, 24, 24, 24]" />
      <TresMeshStandardMaterial
        :color="themeColors.neonPrimary"
        :wireframe="true"
        :transparent="true"
        :opacity="0.06"
      />
    </TresMesh>

    <!-- Neon boundary ring -->
    <TresMesh :position="[0, 0.02, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresRingGeometry :args="[11.5, 12, 6]" />
      <TresMeshStandardMaterial
        :color="themeColors.neonPrimary"
        :emissive="themeColors.neonPrimary"
        :emissive-intensity="1.2"
        :transparent="true"
        :opacity="0.7"
        :side="2"
      />
    </TresMesh>

    <!-- Corner pillars with neon caps -->
    <TresGroup v-for="(pos, i) in pillarPositions" :key="i">
      <!-- Pillar body -->
      <TresMesh :position="pos" cast-shadow>
        <TresBoxGeometry :args="[0.4, 3, 0.4]" />
        <TresMeshStandardMaterial
          color="#0d0d1a"
          :metalness="0.95"
          :roughness="0.3"
        />
      </TresMesh>

      <!-- Neon cap on top -->
      <TresMesh :position="[pos[0], 3.1, pos[2]]">
        <TresBoxGeometry :args="[0.5, 0.15, 0.5]" />
        <TresMeshStandardMaterial
          :color="themeColors.neonPrimary"
          :emissive="themeColors.neonPrimary"
          :emissive-intensity="1.5"
        />
      </TresMesh>

      <!-- Neon cap light source -->
      <TresPointLight
        :position="[pos[0], 3.5, pos[2]]"
        :color="themeColors.neonPrimary"
        :intensity="0.5"
        :distance="6"
      />
    </TresGroup>

    <!-- Center hex marker (subtle) -->
    <TresMesh :position="[0, 0.015, 0]" :rotation="[-Math.PI / 2, 0, 0]">
      <TresRingGeometry :args="[0.8, 1.0, 6]" />
      <TresMeshStandardMaterial
        :color="themeColors.neonPrimary"
        :emissive="themeColors.neonPrimary"
        :emissive-intensity="0.5"
        :transparent="true"
        :opacity="0.2"
        :side="2"
      />
    </TresMesh>
  </TresGroup>
</template>
