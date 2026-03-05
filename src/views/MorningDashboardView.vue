<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { X } from 'lucide-vue-next'
import MorningGreeting from '@/components/morning-dashboard/MorningGreeting.vue'
import MorningScore from '@/components/morning-dashboard/MorningScore.vue'
import BigThreeCard from '@/components/morning-dashboard/BigThreeCard.vue'
import MorningMissions from '@/components/morning-dashboard/MorningMissions.vue'
import MorningNews from '@/components/morning-dashboard/MorningNews.vue'
import MorningQuickCapture from '@/components/morning-dashboard/MorningQuickCapture.vue'

const router = useRouter()
const isVisible = ref(false)

function dismiss() {
  isVisible.value = false
  setTimeout(() => router.push('/'), 300)
}

onMounted(() => {
  // Trigger enter animation
  requestAnimationFrame(() => { isVisible.value = true })
})
</script>

<template>
  <Teleport to="body">
    <Transition name="morning-overlay">
      <div v-if="isVisible" class="morning-overlay" @click.self="dismiss">
        <!-- Dismiss button -->
        <button class="morning-dismiss" @click="dismiss" aria-label="Close morning dashboard">
          <X :size="20" />
        </button>

        <!-- Centered modal card -->
        <div class="morning-modal">
          <div class="morning-header">
            <MorningGreeting />
            <MorningScore />
          </div>

          <BigThreeCard />

          <div class="morning-bottom">
            <MorningMissions />
            <MorningNews />
          </div>

          <MorningQuickCapture />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.morning-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--space-8) var(--space-6);
  overflow-y: auto;

  /* Blurred glass overlay — app visible behind */
  background: var(--overlay-component-bg-lighter);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
}

.morning-dismiss {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 1001;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
}

.morning-dismiss:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

.morning-modal {
  width: 100%;
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-bottom: var(--space-6);
}

.morning-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.morning-bottom {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

/* Enter/leave transitions */
.morning-overlay-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.morning-overlay-leave-active {
  transition: all 0.3s var(--ease-in);
}

.morning-overlay-enter-from {
  opacity: 0;
}

.morning-overlay-enter-from .morning-modal {
  transform: translateY(20px) scale(0.97);
  opacity: 0;
}

.morning-overlay-leave-to {
  opacity: 0;
}

.morning-overlay-leave-to .morning-modal {
  transform: translateY(-10px) scale(0.98);
  opacity: 0;
}

/* Modal content animation */
.morning-modal {
  animation: modal-slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes modal-slide-up {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .morning-modal {
    animation: none;
  }
  .morning-overlay-enter-active,
  .morning-overlay-leave-active {
    transition: none;
  }
}

@media (max-width: 768px) {
  .morning-overlay {
    padding: var(--space-3);
    align-items: flex-start;
    padding-top: var(--space-10);
  }

  .morning-header {
    flex-direction: column;
  }

  .morning-bottom {
    grid-template-columns: 1fr;
  }
}
</style>
