<template>
  <div class="sort-progress">
    <!-- Progress Header -->
    <div class="progress-header">
      <div class="progress-info">
        <span class="progress-count">{{ current }}/{{ total }}</span>
        <span class="progress-label">sorted</span>
      </div>

      <div v-if="streak > 0" class="streak-info">
        <span class="streak-icon">🔥</span>
        <span class="streak-count">{{ streak }} day{{ streak > 1 ? 's' : '' }}</span>
      </div>
    </div>

    <!-- Progress Bar -->
    <div
      class="progress-bar-container"
      role="progressbar"
      :aria-valuenow="percentage"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-label="`Progress: ${percentage}% complete`"
    >
      <div class="progress-bar-track">
        <div class="progress-bar-fill" :style="{ width: `${percentage}%` }">
          <span class="progress-percentage">{{ percentage }}%</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  current: number
  total: number
  message?: string  // Kept for API compatibility, but no longer displayed
  streak?: number
}

const props = withDefaults(defineProps<Props>(), {
  streak: 0
})

const percentage = computed(() => {
  if (props.total === 0) return 100
  return Math.round((props.current / props.total) * 100)
})
</script>

<style scoped>
.sort-progress {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: transparent !important; /* Override global tauri styles */
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.progress-info {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.progress-count {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary, #ffffff);
  line-height: 1;
}

.progress-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary, rgba(255, 255, 255, 0.7));
}

.streak-info {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-3);
  background: rgba(251, 146, 60, 0.15);
  border: 1px solid rgba(251, 146, 60, 0.3);
  border-radius: var(--radius-xl);
}

.streak-icon {
  font-size: var(--text-base);
  line-height: 1;
}

.streak-count {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-warning, #fb923c);
}

.progress-bar-container {
  width: 100%;
}

.progress-bar-track {
  position: relative;
  height: 8px;
  background: var(--glass-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.progress-bar-fill {
  position: relative;
  height: 100%;
  background: linear-gradient(90deg, var(--color-blue) 0%, #8b5cf6 50%, #ec4899 100%);
  border-radius: var(--radius-sm);
  transition: width var(--duration-slower) cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

.progress-percentage {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  font-size: 9px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Animations */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.progress-bar-fill {
  animation: pulse 2s ease-in-out infinite;
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  .progress-bar-fill {
    transition: none !important;
    animation: none !important;
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .progress-count {
    font-size: var(--text-base);
  }
}
</style>
