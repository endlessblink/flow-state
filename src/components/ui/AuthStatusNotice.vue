<template>
  <div class="auth-status-notice">
    <div class="notice-content">
      <div class="header">
        <div class="icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
            <path d="M2 17L12 22L22 17"/>
            <path d="M2 12L12 17L22 12"/>
          </svg>
        </div>
        <h3>Local-First Productivity</h3>
      </div>

      <div class="description">
        <p>Pomo-Flow runs entirely on your device. No sign-up required, no data stored in the cloud.</p>
      </div>

      <div class="features">
        <div class="feature">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17L4 12"/>
          </svg>
          <span>Private & Secure</span>
        </div>
        <div class="feature">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17L4 12"/>
          </svg>
          <span>Works Offline</span>
        </div>
        <div class="feature">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17L4 12"/>
          </svg>
          <span>No Account Required</span>
        </div>
      </div>

      <div class="actions">
        <button @click="startProductivity" class="primary-btn">
          Start Using Pomo-Flow
        </button>
        <button @click="learnMore" class="secondary-btn">
          Learn More
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineEmits } from 'vue'

const emit = defineEmits<{
  close: []
  learnMore: []
}>()

const startProductivity = () => {
  emit('close')
}

const learnMore = () => {
  emit('learnMore')
}
</script>

<style scoped>
.auth-status-notice {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 max-w-md mx-auto;
}

.notice-content {
  @apply text-center;
}

.header {
  @apply flex items-center justify-center mb-4;
}

.icon {
  @apply text-blue-600 dark:text-blue-400 mr-3;
}

h3 {
  @apply text-lg font-semibold text-gray-900 dark:text-gray-100;
}

.description {
  @apply mb-6;
}

.description p {
  @apply text-gray-600 dark:text-gray-400 text-sm leading-relaxed;
}

.features {
  @apply space-y-2 mb-6;
}

.feature {
  @apply flex items-center justify-center text-sm text-gray-700 dark:text-gray-300;
}

.feature svg {
  @apply text-green-500 mr-2 flex-shrink-0;
}

.feature span {
  @apply text-left;
}

.actions {
  @apply flex flex-col sm:flex-row gap-3 justify-center;
}

.primary-btn {
  @apply bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors;
}

.secondary-btn {
  @apply bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-4 rounded-md transition-colors;
}
</style>