<template>
  <div class="canvas-loading-overlay">
    <div class="loading-content">
      <div class="loading-spinner" />
      <span class="loading-text">{{ message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<style scoped>
.canvas-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-light);
  backdrop-filter: var(--overlay-backdrop-blur);
  z-index: 50;
}

.dark .canvas-loading-overlay {
  background: var(--overlay-light);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.loading-spinner {
  width: var(--space-12);
  height: var(--space-12);
  border: var(--space-1) solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  font-size: var(--text-base);
  color: var(--text-secondary);
  font-weight: 500;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
