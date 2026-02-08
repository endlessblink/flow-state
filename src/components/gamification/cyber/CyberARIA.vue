<script setup lang="ts">
/**
 * CyberARIA Component
 * FEATURE-1132: ARIA game master message bubble with terminal/holographic styling
 *
 * Cyberpunk-themed version of ARIAMessage.vue for the Cyberflow RPG Hub.
 * Uses augmented-ui frames, design tokens, and intensity-aware animations.
 */
import { computed } from 'vue'
import { useCyberflowTheme } from '@/composables/useCyberflowTheme'

const props = withDefaults(defineProps<{
  message: string
  variant?: 'info' | 'warning' | 'success' | 'danger'
}>(), {
  variant: 'info',
})

const { showAtIntensity } = useCyberflowTheme()

const variantColor = computed(() => {
  switch (props.variant) {
    case 'warning': return 'var(--cf-orange)'
    case 'success': return 'var(--cf-lime)'
    case 'danger': return 'var(--cf-magenta)'
    default: return 'var(--cf-cyan)'
  }
})

const variantColorDim = computed(() => {
  switch (props.variant) {
    case 'warning': return 'var(--cf-orange-20)'
    case 'success': return 'var(--cf-lime-20)'
    case 'danger': return 'var(--cf-magenta-20)'
    default: return 'var(--cf-cyan-20)'
  }
})
</script>

<template>
  <div
    class="cyber-aria"
    :style="{
      '--aria-accent': variantColor,
      '--aria-accent-dim': variantColorDim,
    }"
  >
    <!-- Left accent border -->
    <div class="cyber-aria__accent" />

    <!-- Message container with corner-cut clip-path -->
    <div class="cyber-aria__body cf-corner-cut-sm">
      <!-- Prefix line -->
      <div class="cyber-aria__prefix">
        <span class="cyber-aria__label">ARIA://</span>
        <span class="cyber-aria__status" />
      </div>

      <!-- Message text -->
      <p
        class="cyber-aria__text"
        :class="{ 'cf-terminal-reveal': showAtIntensity('intense') }"
        :style="showAtIntensity('intense') ? { '--terminal-steps': String(message.length) } : undefined"
      >
        {{ message }}
      </p>

      <!-- Scanline overlay at intense level -->
      <div
        v-if="showAtIntensity('intense')"
        class="cyber-aria__scanline"
      />
    </div>
  </div>
</template>

<style scoped>
.cyber-aria {
  display: flex;
  gap: 0;
  position: relative;
}

.cyber-aria__accent {
  width: 3px;
  flex-shrink: 0;
  background: var(--aria-accent);
  border-radius: 1px;
  box-shadow: 0 0 6px var(--aria-accent);
}

.cyber-aria__body {
  flex: 1;
  background: var(--cf-dark-3);
  border: 1px solid var(--aria-accent-dim);
  border-left: none;
  padding: 0.625rem 0.875rem;
  position: relative;
  overflow: hidden;
}

.cyber-aria__prefix {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.25rem;
}

.cyber-aria__label {
  font-family: var(--font-cyber-data);
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--cf-cyan);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cyber-aria__status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--aria-accent);
  box-shadow: 0 0 4px var(--aria-accent);
  animation: aria-blink 2s ease-in-out infinite;
}

.cyber-aria__text {
  margin: 0;
  font-family: var(--font-cyber-data);
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.5;
  letter-spacing: 0.02em;
}

/* Scanline overlay */
.cyber-aria__scanline {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 50%,
    rgba(0, 0, 0, 0.15) 50%
  );
  background-size: 100% 4px;
  pointer-events: none;
  opacity: 0.4;
  animation: cf-scanline-drift 8s linear infinite;
}

@keyframes aria-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@media (prefers-reduced-motion: reduce) {
  .cyber-aria__status {
    animation: none;
  }

  .cyber-aria__scanline {
    animation: none;
  }

  .cyber-aria__text.cf-terminal-reveal {
    animation: none;
    width: auto;
    overflow: visible;
    white-space: normal;
    border-right: none;
  }
}
</style>
