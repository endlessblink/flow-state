<template>
  <Transition name="banner-slide">
    <div v-if="show" class="morning-banner" role="banner">
      <div class="banner-content">
        <Sun :size="16" class="banner-icon" aria-hidden="true" />
        <span class="banner-text">{{ bannerText }}</span>
        <BaseButton variant="primary" size="sm" @click="$emit('open')">
          <span class="btn-label-full">Plan My Morning</span>
          <span class="btn-label-short" aria-hidden="true">Plan</span>
        </BaseButton>
        <button class="banner-dismiss" aria-label="Dismiss morning banner" @click="$emit('dismiss')">
          <X :size="14" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Sun, X } from 'lucide-vue-next'
import BaseButton from '@/components/base/BaseButton.vue'

defineProps<{
  show: boolean
}>()

defineEmits<{
  open: []
  dismiss: []
}>()

const BANNER_MESSAGES = [
  'Plan your top 3 for today?',
  "Turn today's list into a timeline",
  'What matters most this morning?',
  'Pick 3 tasks. Block your time. Go.',
  'Ready to lock in your morning focus?',
]

const bannerText = computed(() => {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  return BANNER_MESSAGES[dayOfYear % BANNER_MESSAGES.length]
})
</script>

<style scoped>
.morning-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-toast);
  display: flex;
  justify-content: center;
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-soft);
  border-bottom: 1px solid var(--brand-primary);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: 600px;
  width: 100%;
}

.banner-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.banner-text {
  font-size: var(--text-sm);
  color: var(--text-primary);
  flex: 1;
}

.banner-dismiss {
  display: flex;
  align-items: center;
  padding: var(--space-1);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s ease;
}

.banner-dismiss:hover {
  color: var(--text-primary);
}

/* Show short label on mobile, full label on larger screens */
.btn-label-short {
  display: none;
}

/* Transition */
.banner-slide-enter-active,
.banner-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.banner-slide-enter-from,
.banner-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .banner-text {
    font-size: 0.75rem;
  }

  .btn-label-full {
    display: none;
  }

  .btn-label-short {
    display: inline;
  }
}
</style>
