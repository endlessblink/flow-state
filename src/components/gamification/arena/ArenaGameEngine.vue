<script setup lang="ts">
/**
 * ArenaGameEngine.vue — Invisible component that runs the game loop
 * Must be placed INSIDE TresCanvas to access useLoop()
 * Drives: auto-attack, enemy movement, corruption, auto-targeting
 */
import { useArenaGameLoop } from '@/composables/arena/useArenaGameLoop'

// Initialize the game loop — this hooks into TresJS render loop
useArenaGameLoop()
</script>

<template>
  <!-- Invisible — game logic only, no rendering -->
</template>
