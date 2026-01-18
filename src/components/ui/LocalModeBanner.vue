<template>
  <div class="local-mode-banner">
    <div class="banner-content">
      <div class="icon">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 2L2 7L12 12L22 7L12 2Z" />
          <path d="M2 17L12 22L22 17" />
          <path d="M2 12L12 17L22 12" />
        </svg>
      </div>
      <div class="message">
        <strong>Local Mode</strong> - Your data is stored privately on this device
      </div>
      <button
        class="dismiss-btn"
        aria-label="Dismiss banner"
        @click="dismissBanner"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line
            x1="18"
            y1="6"
            x2="6"
            y2="18"
          />
          <line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isVisible = ref(true)

const dismissBanner = () => {
  isVisible.value = false
  localStorage.setItem('flow-state-local-banner-dismissed', 'true')
}

// Check if banner was previously dismissed
if (localStorage.getItem('flow-state-local-banner-dismissed') === 'true') {
  isVisible.value = false
}
</script>

<style scoped>
.local-mode-banner {
  @apply bg-blue-50 border-b border-blue-200 dark:bg-blue-900/20 dark:border-blue-800;
}

.banner-content {
  @apply flex items-center justify-between px-4 py-3 max-w-7xl mx-auto;
}

.icon {
  @apply text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0;
}

.message {
  @apply text-blue-800 dark:text-blue-200 text-sm font-medium flex-1;
}

.dismiss-btn {
  @apply text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors;
}
</style>