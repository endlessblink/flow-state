<script setup lang="ts">
/**
 * ArenaPostProcessing.vue — Post-processing effects chain
 * Bloom + ChromaticAberration + Vignette + Noise
 * Intensities reactive to game phase (combat/boss/victory)
 * Gracefully degrades if WebGL2 or post-processing unavailable
 */
import { ref, computed, onMounted } from 'vue'
import { Vector2 } from 'three'
import {
  EffectComposer,
  UnrealBloom,
  ChromaticAberrationPmndrs,
  VignettePmndrs,
  NoisePmndrs,
} from '@tresjs/post-processing'
import { useArenaRenderer } from '@/composables/arena/useArenaRenderer'

const {
  bloomIntensity,
  chromaticAberration,
  vignetteIntensity,
  noiseOpacity,
} = useArenaRenderer()

const aberrationOffset = computed(() =>
  new Vector2(chromaticAberration.value, chromaticAberration.value)
)

const postProcessingAvailable = ref(true)

onMounted(() => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) {
      postProcessingAvailable.value = false
    }
  } catch {
    postProcessingAvailable.value = false
  }
})
</script>

<template>
  <EffectComposer v-if="postProcessingAvailable">
    <UnrealBloom
      :intensity="bloomIntensity"
      :threshold="0.2"
      :radius="0.85"
    />
    <ChromaticAberrationPmndrs
      :offset="aberrationOffset"
    />
    <VignettePmndrs
      :darkness="vignetteIntensity"
      :offset="0.3"
    />
    <NoisePmndrs
      :opacity="noiseOpacity"
    />
  </EffectComposer>
</template>
