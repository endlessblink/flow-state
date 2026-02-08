<script setup lang="ts">
/**
 * Achievement Toast Component
 * FEATURE-1118: Pop-up notification for XP gains, level ups, and achievements
 */
import { computed, onMounted, ref } from 'vue'
import type { GamificationToast, AchievementTier } from '@/types/gamification'
import { X, Zap, ArrowUp, Award, Flame, ShoppingBag, Shield, ShieldOff } from 'lucide-vue-next'

const props = defineProps<{
  toast: GamificationToast
}>()

const emit = defineEmits<{
  dismiss: [id: string]
}>()

const isVisible = ref(false)
const isExiting = ref(false)

const iconMap: Record<string, any> = {
  xp: Zap,
  level_up: ArrowUp,
  achievement: Award,
  streak: Flame,
  purchase: ShoppingBag,
  exposure: Shield,
}

const IconComponent = computed(() => {
  if (props.toast.type === 'exposure') {
    return props.toast.title === 'SHIELDED' ? Shield : ShieldOff
  }
  return iconMap[props.toast.type] || Zap
})

const tierClass = computed(() => {
  if (props.toast.tier) {
    return `toast--${props.toast.tier}`
  }
  return ''
})

const borderColor = computed(() => {
  if (props.toast.type === 'achievement' && props.toast.tier) {
    const tierMap: Record<AchievementTier, string> = {
      bronze: 'rgba(var(--tier-bronze), 0.5)',
      silver: 'rgba(var(--tier-silver), 0.5)',
      gold: 'rgba(var(--tier-gold), 0.6)',
      platinum: 'rgba(var(--tier-platinum), 0.6)'
    }
    return tierMap[props.toast.tier]
  }
  if (props.toast.type === 'level_up') {
    return 'rgba(var(--neon-magenta), 0.5)'
  }
  if (props.toast.type === 'exposure') {
    return props.toast.title === 'SHIELDED'
      ? 'rgba(var(--neon-cyan), 0.5)'
      : 'rgba(var(--neon-magenta), 0.5)'
  }
  return 'var(--toast-xp-border)'
})

function dismiss() {
  isExiting.value = true
  setTimeout(() => {
    emit('dismiss', props.toast.id)
  }, 300)
}

onMounted(() => {
  // Trigger enter animation
  requestAnimationFrame(() => {
    isVisible.value = true
  })

  // Auto-dismiss after duration
  const duration = props.toast.duration || 3000
  setTimeout(dismiss, duration)
})
</script>

<template>
  <div
    class="achievement-toast"
    :class="[
      tierClass,
      `toast--${toast.type}`,
      { 'toast--visible': isVisible, 'toast--exiting': isExiting,
        'toast--shielded': toast.type === 'exposure' && toast.title === 'SHIELDED',
        'toast--exposed': toast.type === 'exposure' && toast.title === 'EXPOSED' }
    ]"
    :style="{ borderColor }"
    @click="dismiss"
  >
    <div class="toast-icon">
      <component
        :is="IconComponent"
        :size="24"
      />
    </div>

    <div class="toast-content">
      <span class="toast-title">{{ toast.title }}</span>
      <span
        v-if="toast.description"
        class="toast-description"
      >{{ toast.description }}</span>
    </div>

    <div
      v-if="toast.xpAmount"
      class="toast-xp"
    >
      <Zap :size="14" />
      <span>+{{ toast.xpAmount }}</span>
    </div>

    <button
      class="toast-close"
      @click.stop="dismiss"
    >
      <X :size="14" />
    </button>
  </div>
</template>

<style scoped>
.achievement-toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--toast-xp-bg);
  border: 1px solid var(--toast-xp-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transform: translateX(100%) scale(0.9);
  opacity: 0;
  transition: transform var(--toast-animation-duration) ease-out,
              opacity var(--toast-animation-duration) ease-out;
  min-width: 280px;
  max-width: 400px;
}

.toast--visible {
  transform: translateX(0) scale(1);
  opacity: 1;
}

.toast--exiting {
  transform: translateX(100%) scale(0.9);
  opacity: 0;
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  background: rgba(var(--neon-cyan), 0.15);
  border-radius: var(--radius-md);
  color: rgba(var(--neon-cyan), 1);
}

.toast--level_up .toast-icon {
  background: rgba(var(--neon-magenta), 0.15);
  color: rgba(var(--neon-magenta), 1);
  animation: levelUpPulse 1s ease-in-out infinite;
}

.toast--achievement .toast-icon {
  animation: achievementUnlock 0.6s ease-out;
}

.toast--bronze .toast-icon {
  background: rgba(var(--tier-bronze), 0.15);
  color: rgb(var(--tier-bronze));
}

.toast--silver .toast-icon {
  background: rgba(var(--tier-silver), 0.15);
  color: rgb(var(--tier-silver));
}

.toast--gold .toast-icon {
  background: rgba(var(--tier-gold), 0.15);
  color: rgb(var(--tier-gold));
}

.toast--platinum .toast-icon {
  background: rgba(var(--tier-platinum), 0.15);
  color: rgb(var(--tier-platinum));
}

.toast--streak .toast-icon {
  background: rgba(255, 107, 53, 0.15);
  color: var(--streak-flame-color);
  animation: streakFlame 1s ease-in-out infinite;
}

.toast--exposed .toast-icon {
  background: rgba(var(--neon-magenta), 0.15);
  color: rgba(var(--neon-magenta), 1);
}

.toast--shielded .toast-icon {
  background: rgba(var(--neon-cyan), 0.15);
  color: rgba(var(--neon-cyan), 1);
}

.toast-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--gamification-text-primary);
}

.toast-description {
  font-size: var(--text-sm);
  color: var(--gamification-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-xp {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(var(--neon-cyan), 0.15);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: rgba(var(--neon-cyan), 1);
  animation: xpPopIn 0.4s ease-out;
}

.toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--gamification-text-secondary);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s ease, background 0.2s ease;
}

.toast-close:hover {
  opacity: 1;
  background: rgba(var(--color-slate-600), 0.5);
}

/* Hover glow effect */
.achievement-toast:hover {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4),
              0 0 16px rgba(var(--neon-cyan), 0.1);
}

.toast--level_up:hover {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4),
              0 0 16px rgba(var(--neon-magenta), 0.2);
}
</style>
