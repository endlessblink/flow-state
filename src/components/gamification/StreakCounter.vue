<script setup lang="ts">
/**
 * Streak Counter Component
 * FEATURE-1118: Displays current streak with flame animation
 * Live shield flash animation for timer bonus application
 */
import { computed, ref, watch } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import { Flame, ShieldCheck, AlertTriangle, Shield } from 'lucide-vue-next'
import type { XpAnimationEvent } from '@/composables/useXpAnimations'

const props = withDefaults(defineProps<{
  showFreezes?: boolean
  compact?: boolean
  shieldEvent?: XpAnimationEvent | undefined
}>(), {
  showFreezes: true,
  compact: false,
  shieldEvent: undefined
})

const gamificationStore = useGamificationStore()
const streakInfo = computed(() => gamificationStore.streakInfo)

const streakClass = computed(() => {
  const streak = streakInfo.value.currentStreak
  if (streak >= 100) return 'streak--legendary'
  if (streak >= 30) return 'streak--epic'
  if (streak >= 7) return 'streak--hot'
  return 'streak--normal'
})

const showShieldFlash = ref(false)

watch(() => props.shieldEvent, (event) => {
  if (event && event.type === 'shielded') {
    showShieldFlash.value = true
    setTimeout(() => { showShieldFlash.value = false }, 1500)
  }
})
</script>

<template>
  <div
    class="streak-counter"
    :class="[streakClass, { compact }]"
  >
    <div class="streak-main">
      <Flame
        class="streak-icon"
        :class="{ 'streak-icon--animated': streakInfo.isActiveToday }"
        :size="compact ? 16 : 20"
      />
      <!-- Shield flash when timer bonus applies -->
      <Transition name="shield-flash">
        <Shield v-if="showShieldFlash" :size="compact ? 14 : 16" class="shield-flash-icon" />
      </Transition>
      <span class="streak-number">{{ streakInfo.currentStreak }}</span>
      <span
        v-if="!compact"
        class="streak-label"
      >day{{ streakInfo.currentStreak !== 1 ? 's' : '' }}</span>
    </div>

    <div
      v-if="showFreezes && !compact && streakInfo.streakFreezes > 0"
      class="streak-freezes"
      :title="`${streakInfo.streakFreezes} streak freeze${streakInfo.streakFreezes !== 1 ? 's' : ''} available`"
    >
      <ShieldCheck
        :size="14"
        class="freeze-icon"
      />
      <span>{{ streakInfo.streakFreezes }}</span>
    </div>

    <div
      v-if="streakInfo.streakAtRisk && !compact"
      class="streak-warning"
      title="Complete a task today to keep your streak!"
    >
      <AlertTriangle
        :size="14"
        class="warning-icon"
      />
    </div>
  </div>
</template>

<style scoped>
.streak-counter {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: rgba(var(--color-slate-800), 0.6);
  border-radius: var(--radius-md);
  border: 1px solid var(--orange-bg-medium);
}

.streak-counter.compact {
  padding: var(--space-1);
  gap: var(--space-1);
}

.streak-main {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.streak-icon {
  color: var(--streak-flame-color);
  filter: drop-shadow(0 0 var(--space-1) var(--cf-orange-50));
}

.streak-icon--animated {
  animation: streakFlame 1s ease-in-out infinite;
}

/* Shield flash animation */
.shield-flash-icon {
  position: absolute;
  left: -4px;
  top: -4px;
  color: var(--cf-cyan);
  filter: drop-shadow(0 0 6px var(--cf-cyan-80));
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .shield-flash-icon {
    animation: shieldFlash 1.5s ease-out forwards;
  }

  @keyframes shieldFlash {
    0% { opacity: 0; transform: scale(0.5); }
    20% { opacity: 1; transform: scale(1.2); }
    60% { opacity: 0.8; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.8); }
  }

  .shield-flash-enter-active {
    animation: shieldFlash 1.5s ease-out forwards;
  }

  .shield-flash-leave-active {
    display: none;
  }
}

.streak-number {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--streak-text-color);
  text-shadow: 0 0 var(--space-2) var(--cf-orange-40);
}

.compact .streak-number {
  font-size: var(--text-sm);
}

.streak-label {
  font-size: var(--text-sm);
  color: var(--gamification-text-secondary);
}

.streak-freezes {
  display: flex;
  align-items: center;
  gap: var(--space-0_5);
  padding: var(--space-0_5) var(--space-1_5);
  background: var(--cf-cyan-10);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--cf-cyan-90);
}

.freeze-icon {
  color: var(--cf-cyan-80);
}

.streak-warning {
  display: flex;
  align-items: center;
  animation: pulse 1.5s ease-in-out infinite;
}

.warning-icon {
  color: var(--amber-text);
}

/* Streak tier styles */
.streak--hot .streak-icon {
  color: var(--cf-orange);
}

.streak--epic .streak-icon {
  color: var(--cf-orange);
  filter: drop-shadow(0 0 var(--space-1_5) var(--cf-orange-60));
}

.streak--epic .streak-number {
  color: var(--cf-orange);
}

.streak--legendary .streak-icon {
  color: var(--cf-magenta);
  filter: drop-shadow(0 0 var(--space-2) var(--cf-magenta-70));
}

.streak--legendary .streak-number {
  background: linear-gradient(90deg, var(--cf-cyan), var(--cf-magenta));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.streak--legendary {
  border-color: var(--cf-magenta-40);
  box-shadow: 0 0 var(--space-3) var(--cf-magenta-20);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
