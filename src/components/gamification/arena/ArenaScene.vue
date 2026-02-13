<script setup lang="ts">
/**
 * ArenaScene.vue — TresJS 3D canvas with all arena objects
 * Camera: top-down isometric (Ruiner-style), follows player with smooth lerp
 * Contains: environment, player, enemies, projectiles, game engine, post-processing
 */
import { computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { useArenaStore } from '@/stores/arena'
import { useArenaRenderer } from '@/composables/arena/useArenaRenderer'
import ArenaEnvironment from './ArenaEnvironment.vue'
import ArenaPlayer from './ArenaPlayer.vue'
import ArenaEnemy from './ArenaEnemy.vue'
import ArenaProjectile from './ArenaProjectile.vue'
import ArenaPostProcessing from './ArenaPostProcessing.vue'
import ArenaGameEngine from './ArenaGameEngine.vue'

const arenaStore = useArenaStore()
const { cameraPosition, screenShake, themeColors } = useArenaRenderer()

// Camera offset includes screen shake
const camX = computed(() => cameraPosition.value.x + screenShake.value.x)
const camY = computed(() => cameraPosition.value.y)
const camZ = computed(() => cameraPosition.value.z + screenShake.value.y)

// Camera look-at targets the player position (not always origin)
const lookAtX = computed(() => arenaStore.player?.position.x ?? 0)
const lookAtZ = computed(() => arenaStore.player?.position.z ?? 0)
</script>

<template>
  <TresCanvas
    :clear-color="themeColors.ambientColor"
    :alpha="false"
    shadows
    window-size
  >
    <!-- Camera: follows player with screen shake -->
    <TresPerspectiveCamera
      :position="[camX, camY, camZ]"
      :look-at="[lookAtX, 0, lookAtZ]"
      :fov="50"
      :near="0.1"
      :far="100"
    />

    <!-- Lighting (Ruiner-style cyberpunk) -->
    <TresAmbientLight :color="themeColors.fogColor" :intensity="0.3" />
    <TresDirectionalLight
      :position="[5, 15, 5]"
      :intensity="0.6"
      color="#8888ff"
      cast-shadow
    />
    <!-- Magenta point light -->
    <TresPointLight
      :position="[-8, 4, -8]"
      color="#ff0066"
      :intensity="2"
      :distance="20"
    />
    <!-- Cyan point light -->
    <TresPointLight
      :position="[8, 4, -8]"
      color="#00ffff"
      :intensity="2"
      :distance="20"
    />
    <!-- Purple point light -->
    <TresPointLight
      :position="[0, 4, 8]"
      color="#8800ff"
      :intensity="1.5"
      :distance="20"
    />

    <!-- Fog -->
    <TresFog :color="themeColors.fogColor" :near="10" :far="40" />

    <!-- Environment (floor, grid, boundary) -->
    <ArenaEnvironment />

    <!-- Player -->
    <ArenaPlayer v-if="arenaStore.player" />

    <!-- Enemies -->
    <ArenaEnemy
      v-for="enemy in arenaStore.activeEnemies"
      :key="enemy.id"
      :enemy="enemy"
    />

    <!-- Projectiles -->
    <ArenaProjectile
      v-for="proj in arenaStore.projectiles"
      :key="proj.id"
      :projectile="proj"
    />

    <!-- Game engine (invisible — drives game loop) -->
    <ArenaGameEngine />

    <!-- Post-processing -->
    <ArenaPostProcessing />
  </TresCanvas>
</template>
