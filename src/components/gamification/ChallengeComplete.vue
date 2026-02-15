<script setup lang="ts">
/**
 * ChallengeComplete Component
 * FEATURE-1132: Victory animation + rewards toast
 *
 * Displayed when a challenge is completed.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import type { Challenge } from '@/types/challenges'
import { Trophy, Zap, TrendingDown, Sparkles } from 'lucide-vue-next'

const props = defineProps<{
  challenge: Challenge
  xpAwarded: number
  corruptionReduction: number
  narrative?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Animation state
const isVisible = ref(false)
const showContent = ref(false)

// Auto-close timer
let closeTimeout: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  // Trigger entrance animation
  requestAnimationFrame(() => {
    isVisible.value = true
    setTimeout(() => {
      showContent.value = true
    }, 200)
  })

  // Auto-close after 5 seconds
  closeTimeout = setTimeout(() => {
    handleClose()
  }, 5000)
})

onUnmounted(() => {
  if (closeTimeout) {
    clearTimeout(closeTimeout)
  }
})

function handleClose() {
  showContent.value = false
  setTimeout(() => {
    isVisible.value = false
    setTimeout(() => {
      emit('close')
    }, 300)
  }, 200)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div
        v-if="isVisible"
        class="challenge-complete-overlay"
        @click.self="handleClose"
      >
        <Transition name="content">
          <div v-if="showContent" class="challenge-complete-card">
            <!-- Decorative sparkles -->
            <div class="sparkles">
              <Sparkles
                v-for="i in 5"
                :key="i"
                class="sparkle"
                :style="{
                  '--delay': `${i * 0.1}s`,
                  '--offset-x': `${(i - 3) * 30}px`,
                }"
                :size="16"
              />
            </div>

            <!-- Trophy icon -->
            <div class="trophy-container">
              <Trophy class="trophy-icon" :size="48" />
            </div>

            <!-- Title -->
            <h2 class="complete-title">
              Mission Complete!
            </h2>

            <!-- Challenge name -->
            <p class="challenge-name">
              {{ challenge.title }}
            </p>

            <!-- Rewards -->
            <div class="rewards">
              <div class="reward reward--xp">
                <Zap :size="20" />
                <span class="reward-value">+{{ xpAwarded }}</span>
                <span class="reward-label">XP</span>
              </div>

              <div
                v-if="corruptionReduction > 0"
                class="reward reward--corruption"
              >
                <TrendingDown :size="20" />
                <span class="reward-value">-{{ corruptionReduction }}%</span>
                <span class="reward-label">Corruption</span>
              </div>
            </div>

            <!-- ARIA narrative -->
            <p v-if="narrative" class="aria-narrative">
              "{{ narrative }}"
            </p>

            <!-- Close button -->
            <button class="close-button" @click="handleClose">
              Continue
            </button>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.challenge-complete-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--space-1));
  z-index: var(--z-tooltip);
}

.challenge-complete-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.2) 0%,
    var(--glass-bg-solid) 50%,
    rgba(0, 200, 255, 0.1) 100%
  );
  border: var(--space-px) solid var(--color-success-500);
  border-radius: var(--radius-xl);
  box-shadow:
    0 0 var(--space-10) var(--success-shadow),
    var(--shadow-dark-xl);
  text-align: center;
  max-width: 400px;
  width: 90%;
  overflow: hidden;
}

/* Decorative sparkles */
.sparkles {
  position: absolute;
  top: calc(-1 * var(--space-5));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--space-4);
}

.sparkle {
  color: var(--color-warning-400);
  animation: sparkle-float 1.5s ease-in-out infinite;
  animation-delay: var(--delay, 0s);
  transform: translateX(var(--offset-x, 0));
}

@keyframes sparkle-float {
  0%, 100% {
    transform: translateX(var(--offset-x, 0)) translateY(0) scale(1);
    opacity: 0.5;
  }
  50% {
    transform: translateX(var(--offset-x, 0)) translateY(calc(-1 * var(--space-2_5))) scale(1.2);
    opacity: 1;
  }
}

/* Trophy */
.trophy-container {
  width: var(--space-20);
  height: var(--space-20);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-warning-500), var(--color-warning-400));
  border-radius: var(--radius-full);
  box-shadow: 0 0 var(--space-8) var(--color-warning-500/50);
  animation: trophy-pulse 1s var(--ease-in-out) infinite alternate;
}

@keyframes trophy-pulse {
  from {
    box-shadow: 0 0 var(--space-5) var(--color-warning-500/30);
    transform: scale(1);
  }
  to {
    box-shadow: 0 0 var(--space-10) var(--color-warning-500/60);
    transform: scale(1.05);
  }
}

.trophy-icon {
  color: var(--text-primary);
  animation: trophy-bounce 0.6s var(--ease-in-out) infinite alternate;
}

@keyframes trophy-bounce {
  from { transform: translateY(0) rotate(-5deg); }
  to { transform: translateY(calc(-1 * var(--space-1))) rotate(5deg); }
}

/* Title */
.complete-title {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-success-400);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 0 0 var(--space-5) var(--success-shadow);
}

/* Challenge name */
.challenge-name {
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-tertiary);
  font-weight: var(--font-medium);
}

/* Rewards */
.rewards {
  display: flex;
  gap: var(--space-6);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-weak);
  border-radius: var(--radius-lg);
}

.reward {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.reward svg {
  opacity: 0.8;
}

.reward--xp svg {
  color: var(--color-warning-400);
}

.reward--corruption svg {
  color: var(--color-success-400);
}

.reward-value {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.reward-label {
  font-size: var(--text-xs);
  color: var(--color-gray-500);
  text-transform: uppercase;
}

/* ARIA narrative */
.aria-narrative {
  margin: 0;
  font-size: var(--text-sm);
  font-style: italic;
  color: var(--color-primary-300);
  max-width: 300px;
  line-height: var(--leading-normal);
}

/* Close button */
.close-button {
  padding: var(--space-2) var(--space-6);
  background: linear-gradient(135deg, var(--color-success-600), var(--color-success-500));
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
}

.close-button:hover {
  transform: translateY(calc(-1 * var(--space-px) * 2));
  box-shadow: 0 var(--space-1) var(--space-3) var(--success-shadow);
}

/* Transitions */
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.content-enter-active,
.content-leave-active {
  transition: all var(--duration-slow) var(--ease-out);
}

.content-enter-from {
  opacity: 0;
  transform: scale(0.8) translateY(var(--space-5));
}

.content-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(calc(-1 * var(--space-2_5)));
}
</style>
