<template>
  <Transition name="banner-fade">
    <div v-if="showBanner" class="day-rotation-banner">
      <Sun :size="16" />
      <span>{{ t('canvas.dayRotation.updated', { count: rotatedGroupsCount }) }}</span>
      <button class="dismiss-btn" @click="$emit('dismiss')">
        <X :size="14" />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Sun, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  showBanner: boolean
  rotatedGroupsCount: number
}>()

defineEmits<{
  dismiss: []
}>()
</script>

<style scoped>
.day-rotation-banner {
  position: absolute;
  top: var(--space-4);
  left: var(--space-4);
  z-index: var(--z-popover);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.dismiss-btn {
  display: flex;
  align-items: center;
  padding: var(--space-1);
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.dismiss-btn:hover {
  color: var(--text-primary);
  background: var(--glass-bg-medium);
}

.banner-fade-enter-active,
.banner-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
