<template>
  <div class="auth-status-notice">
    <div class="notice-content">
      <div class="header">
        <div class="icon">
          <svg
            width="24"
            height="24"
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
        <h3>Local-First Productivity</h3>
      </div>

      <div class="description">
        <p>FlowState runs entirely on your device. No sign-up required, no data stored in the cloud.</p>
      </div>

      <div class="features">
        <div class="feature">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M20 6L9 17L4 12" />
          </svg>
          <span>Private & Secure</span>
        </div>
        <div class="feature">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M20 6L9 17L4 12" />
          </svg>
          <span>Works Offline</span>
        </div>
        <div class="feature">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M20 6L9 17L4 12" />
          </svg>
          <span>No Account Required</span>
        </div>
      </div>

      <div class="actions">
        <button class="primary-btn" @click="startProductivity">
          Start Using FlowState
        </button>
        <button class="secondary-btn" @click="learnMore">
          Learn More
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// defineEmits is a compiler macro - no import needed

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
  background: var(--glass-bg-light);
  backdrop-filter: var(--blur-lg);
  -webkit-backdrop-filter: var(--blur-lg);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-lg);
  padding: var(--space-6);
  max-width: 440px;
  margin: 0 auto;
}

.notice-content {
  text-align: center;
}

.header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-4);
}

.icon {
  color: var(--brand-primary);
  margin-right: var(--space-3);
  display: flex;
}

h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.description {
  margin-bottom: var(--space-6);
}

.description p {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.features {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.feature {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.feature svg {
  color: var(--color-success);
  flex-shrink: 0;
}

.feature span {
  text-align: left;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  justify-content: center;
}

@media (min-width: 640px) {
  .actions {
    flex-direction: row;
  }
}

.primary-btn {
  background: var(--brand-primary);
  color: white;
  font-weight: var(--font-medium);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal);
}

.primary-btn:hover {
  background: var(--brand-hover);
  transform: translateY(-1px);
}

.secondary-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal);
}

.secondary-btn:hover {
  background: var(--glass-border);
  color: var(--text-primary);
}
</style>