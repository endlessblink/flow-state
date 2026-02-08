<script setup lang="ts">
/**
 * CorruptionOverlay Component
 * FEATURE-1132: Visual decay based on corruption level
 *
 * A fixed overlay that applies corruption effects to the entire UI.
 * Effects include:
 * - Desaturation filter
 * - Noise texture overlay
 * - Scan lines
 * - Glitch animations
 *
 * The component reads CSS custom properties set by the challenges store.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useChallengesStore } from '@/stores/challenges'
import { storeToRefs } from 'pinia'

// Store
const challengesStore = useChallengesStore()
const { corruptionLevel, corruptionTier } = storeToRefs(challengesStore)

// Animation frame for glitch effect
const glitchOffset = ref({ x: 0, y: 0 })
let animationFrame: number | null = null
let lastGlitchTime = 0

// Only animate when corruption is moderate or higher
const shouldAnimate = computed(() =>
  corruptionLevel.value > 40 && !prefersReducedMotion.value
)

// Check for reduced motion preference
const prefersReducedMotion = ref(false)

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Listen for preference changes
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  mediaQuery.addEventListener('change', (e) => {
    prefersReducedMotion.value = e.matches
  })

  // Start glitch animation loop
  if (shouldAnimate.value) {
    startGlitchAnimation()
  }
})

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
})

function startGlitchAnimation() {
  const animate = (time: number) => {
    // Glitch at random intervals based on corruption intensity
    const glitchChance = corruptionTier.value.glitchIntensity * 0.1
    const timeSinceLastGlitch = time - lastGlitchTime

    if (timeSinceLastGlitch > 500 && Math.random() < glitchChance) {
      const intensity = corruptionTier.value.glitchIntensity
      glitchOffset.value = {
        x: (Math.random() - 0.5) * intensity * 4,
        y: (Math.random() - 0.5) * intensity * 2,
      }
      lastGlitchTime = time

      // Reset after a short delay
      setTimeout(() => {
        glitchOffset.value = { x: 0, y: 0 }
      }, 50 + Math.random() * 100)
    }

    if (shouldAnimate.value) {
      animationFrame = requestAnimationFrame(animate)
    }
  }

  animationFrame = requestAnimationFrame(animate)
}

// Computed styles
const overlayStyle = computed(() => ({
  '--glitch-x': `${glitchOffset.value.x}px`,
  '--glitch-y': `${glitchOffset.value.y}px`,
}))
</script>

<template>
  <div
    class="corruption-overlay"
    :class="[`corruption-tier-${corruptionTier.tier}`]"
    :style="overlayStyle"
    :data-corruption-tier="corruptionTier.tier"
    :data-corruption-level="corruptionLevel"
    aria-hidden="true"
  >
    <!-- Noise texture overlay -->
    <div class="corruption-noise" />

    <!-- Scan lines overlay -->
    <div class="corruption-scanlines" />

    <!-- Vignette effect for high corruption -->
    <div
      v-if="corruptionLevel > 60"
      class="corruption-vignette"
    />
  </div>
</template>

<style scoped>
.corruption-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-tooltip); /* Below modals but above everything else */

  /* Apply the filter from CSS custom properties */
  filter: var(--corruption-filter, none);

  /* Smooth transitions between corruption levels */
  transition: filter 1s var(--ease-out);

  /* Glitch offset */
  transform: translate(var(--glitch-x, 0), var(--glitch-y, 0));
  will-change: transform, filter;
}

/* Noise texture overlay */
.corruption-noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: var(--space-32) var(--space-32);
  opacity: var(--corruption-noise-opacity, 0);
  mix-blend-mode: overlay;
  pointer-events: none;
  transition: opacity 1s var(--ease-out);
}

/* Scan lines overlay */
.corruption-scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent var(--space-px),
    rgba(0, 0, 0, var(--corruption-scanline-opacity, 0)) var(--space-px),
    rgba(0, 0, 0, var(--corruption-scanline-opacity, 0)) var(--space-1)
  );
  pointer-events: none;
}

/* Moving scan line for critical corruption */
.corruption-tier-critical .corruption-scanlines::after {
  content: '';
  position: absolute;
  width: 100%;
  height: var(--space-1);
  background: linear-gradient(
    to bottom,
    transparent,
    var(--danger-border-medium),
    transparent
  );
  animation: scanline-sweep 4s linear infinite;
}

@keyframes scanline-sweep {
  0% {
    top: calc(-1 * var(--space-1));
  }
  100% {
    top: 100%;
  }
}

/* Vignette effect for high corruption */
.corruption-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 50%,
    var(--overlay-dark) 100%
  );
  pointer-events: none;
  opacity: calc((var(--corruption-level, 0) - 60) / 40);
  transition: opacity 1s var(--ease-out);
}

/* Heavy corruption adds a rust/sepia tint */
.corruption-tier-heavy .corruption-overlay,
.corruption-tier-critical .corruption-overlay {
  /* Rust color overlay */
  background: linear-gradient(
    135deg,
    rgba(139, 69, 19, 0.05) 0%,
    transparent 50%,
    rgba(139, 69, 19, 0.05) 100%
  );
}

/* Critical corruption red warning glow at edges */
.corruption-tier-critical::before {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 var(--space-24) var(--danger-border-subtle);
  pointer-events: none;
  animation: warning-pulse 2s var(--ease-in-out) infinite;
}

@keyframes warning-pulse {
  0%, 100% {
    box-shadow: inset 0 0 var(--space-16) var(--danger-bg-subtle);
  }
  50% {
    box-shadow: inset 0 0 var(--space-24) var(--danger-bg-medium);
  }
}

/* Reduced motion - disable all animations */
@media (prefers-reduced-motion: reduce) {
  .corruption-overlay {
    transition: none;
    transform: none;
  }

  .corruption-scanlines::after,
  .corruption-tier-critical::before {
    animation: none;
  }

  .corruption-noise {
    transition: none;
  }
}
</style>
