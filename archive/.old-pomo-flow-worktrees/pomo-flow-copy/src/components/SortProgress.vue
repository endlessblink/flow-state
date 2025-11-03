<template>
  <div class="sort-progress">
    <!-- Progress Header -->
    <div class="progress-header">
      <div class="progress-info">
        <span class="progress-count">{{ current }} of {{ total }}</span>
        <span class="progress-label">tasks sorted</span>
      </div>

      <div class="streak-info" v-if="streak > 0">
        <span class="streak-icon">🔥</span>
        <span class="streak-count">{{ streak }} day streak</span>
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

    <!-- Motivational Message -->
    <div class="motivational-message" aria-live="polite">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  current: number
  total: number
  message: string
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
  gap: 16px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.progress-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.progress-count {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary, #ffffff);
  line-height: 1;
}

.progress-label {
  font-size: 14px;
  color: var(--color-text-secondary, rgba(255, 255, 255, 0.7));
}

.streak-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(251, 146, 60, 0.15);
  border: 1px solid rgba(251, 146, 60, 0.3);
  border-radius: 20px;
}

.streak-icon {
  font-size: 16px;
  line-height: 1;
}

.streak-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-warning, #fb923c);
}

.progress-bar-container {
  width: 100%;
}

.progress-bar-track {
  position: relative;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.progress-bar-fill {
  position: relative;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
  border-radius: 6px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

.progress-percentage {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.motivational-message {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary, #ffffff);
  padding: 12px 20px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15));
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 12px;
  backdrop-filter: blur(10px);
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
    font-size: 20px;
  }

  .motivational-message {
    font-size: 16px;
  }
}
</style>
