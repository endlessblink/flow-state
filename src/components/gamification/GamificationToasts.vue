<script setup lang="ts">
/**
 * Gamification Toasts Container
 * FEATURE-1118: Renders all active gamification toast notifications
 */
import { useGamificationStore } from '@/stores/gamification'
import AchievementToast from './AchievementToast.vue'

const gamificationStore = useGamificationStore()

function handleDismiss(id: string) {
  gamificationStore.dismissToast(id)
}
</script>

<template>
  <div class="toasts-container">
    <TransitionGroup name="toast-list">
      <AchievementToast
        v-for="toast in gamificationStore.toastQueue"
        :key="toast.id"
        :toast="toast"
        @dismiss="handleDismiss"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: 9999;
  pointer-events: none;
}

.toasts-container > * {
  pointer-events: auto;
}

/* TransitionGroup list animations */
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.3s ease;
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-list-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-list-move {
  transition: transform 0.3s ease;
}
</style>
