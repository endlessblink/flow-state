<script setup lang="ts">
/**
 * ArenaGameEngine.vue — Invisible component that runs the game loop
 * Must be placed INSIDE TresCanvas to access useLoop()
 * Drives: WASD movement, enemy approach, auto-attack, projectile movement
 */
import { useArenaGameLoop } from '@/composables/arena/useArenaGameLoop'

// Initialize the game loop — hooks into TresJS render loop
// Cleanup is handled via Vue lifecycle (onUnmounted) inside the composable
useArenaGameLoop()
</script>

<template>
  <!-- Invisible — game logic only -->
</template>
