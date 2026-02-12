<script setup lang="ts">
/**
 * ArenaScene.vue — TresJS 3D canvas with all arena objects
 * Camera: top-down isometric (Ruiner-style), looking at origin
 * Contains: environment, player, enemies, post-processing
 */
import { TresCanvas } from '@tresjs/core'
import { useArenaStore } from '@/stores/arena'
import { useArenaRenderer } from '@/composables/arena/useArenaRenderer'
import ArenaEnvironment from './ArenaEnvironment.vue'
import ArenaPlayer from './ArenaPlayer.vue'
import ArenaEnemy from './ArenaEnemy.vue'
import ArenaPostProcessing from './ArenaPostProcessing.vue'
import ArenaGameEngine from './ArenaGameEngine.vue'

const arenaStore = useArenaStore()
const { cameraPosition, themeColors } = useArenaRenderer()
</script>

<template>
  <TresCanvas
    :clear-color="themeColors.ambientColor"
    :alpha="false"
    shadows
    window-size
  >
    <!-- Camera -->
    <TresPerspectiveCamera
      :position="[cameraPosition.x, cameraPosition.y, cameraPosition.z]"
      :look-at="[0, 0, 0]"
      :fov="50"
      :near="0.1"
      :far="100"
    />

    <!-- Fixed camera — no orbit controls, Ruiner-style isometric lock -->

    <!-- Lighting -->
    <TresAmbientLight :color="themeColors.ambientColor" :intensity="0.3" />
    <TresDirectionalLight
      :position="[5, 15, 5]"
      :intensity="0.6"
      color="#8888ff"
      cast-shadow
    />
    <!-- Colored point lights for cyberpunk atmosphere -->
    <TresPointLight
      :position="[-8, 4, -8]"
      color="#ff0066"
      :intensity="2"
      :distance="20"
    />
    <TresPointLight
      :position="[8, 4, -8]"
      color="#00ffff"
      :intensity="2"
      :distance="20"
    />
    <TresPointLight
      :position="[0, 4, 8]"
      color="#8800ff"
      :intensity="1.5"
      :distance="20"
    />

    <!-- Fog -->
    <TresFog :color="themeColors.fogColor" :near="10" :far="40" />

    <!-- Environment (floor, grid, pillars) -->
    <ArenaEnvironment />

    <!-- Player -->
    <ArenaPlayer v-if="arenaStore.player" />

    <!-- Enemies -->
    <ArenaEnemy
      v-for="enemy in arenaStore.activeEnemies"
      :key="enemy.id"
      :enemy="enemy"
    />

    <!-- Game engine (invisible — drives auto-attack, enemy movement) -->
    <ArenaGameEngine />

    <!-- Post-processing -->
    <ArenaPostProcessing />
  </TresCanvas>
</template>
