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
  streak: 0,
  message: undefined
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
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  line-height: 1;
}

.progress-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.streak-info {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-3);
  background: var(--amber-bg-light);
  border: 1px solid var(--amber-border);
  border-radius: var(--radius-xl);
}

.streak-icon {
  font-size: var(--text-base);
  line-height: 1;
}

.streak-count {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-warning);
}

.progress-bar-container {
  width: 100%;
}

.progress-bar-track {
  position: relative;
  height: var(--space-5);
  background: var(--glass-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  backdrop-filter: var(--blur-light);
}

.progress-bar-fill {
  position: relative;
  height: 100%;
  background: linear-gradient(90deg, var(--color-blue) 0%, var(--color-purple) 50%, var(--color-pink) 100%);
  border-radius: var(--radius-sm);
  transition: width var(--duration-slower) var(--ease-out);
  min-width: 0;
  box-shadow: var(--glow-blue-subtle);
}

.progress-percentage {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--text-2xs);
  font-weight: var(--font-bold);
  color: var(--text-on-primary);
  text-shadow: var(--text-shadow-sm);
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
