<script setup lang="ts">
/**
 * ARIAMessage Component
 * FEATURE-1132: Styled game master message bubble
 *
 * Displays messages from ARIA in a distinctive cyberpunk style.
 */
import { computed } from 'vue'
import { Bot, AlertTriangle, CheckCircle, Info, Loader2 } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  message: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'loading'
  showAvatar?: boolean
}>(), {
  type: 'info',
  showAvatar: true,
})

const typeStyles = computed(() => {
  switch (props.type) {
    case 'success':
      return 'aria-message--success'
    case 'warning':
      return 'aria-message--warning'
    case 'error':
      return 'aria-message--error'
    case 'loading':
      return 'aria-message--loading'
    default:
      return 'aria-message--info'
  }
})

const IconComponent = computed(() => {
  switch (props.type) {
    case 'success':
      return CheckCircle
    case 'warning':
      return AlertTriangle
    case 'error':
      return AlertTriangle
    case 'loading':
      return Loader2
    default:
      return Info
  }
})
</script>

<template>
  <div class="aria-message" :class="typeStyles">
    <!-- Avatar -->
    <div v-if="showAvatar" class="aria-avatar">
      <Bot :size="20" />
    </div>

    <!-- Message bubble -->
    <div class="aria-bubble">
      <div class="aria-header">
        <span class="aria-name">ARIA</span>
        <component
          :is="IconComponent"
          :class="{ spinning: type === 'loading' }"
          :size="14"
        />
      </div>
      <p class="aria-text">{{ message }}</p>
    </div>
  </div>
</template>

<style scoped>
.aria-message {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
}

.aria-avatar {
  flex-shrink: 0;
  width: var(--space-8);
  height: var(--space-8);
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-primary-600), var(--color-accent-cyan));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  box-shadow: 0 0 var(--space-3) var(--brand-bg-subtle);
}

.aria-bubble {
  flex: 1;
  background: var(--glass-bg-weak);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}

.aria-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.aria-name {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-accent-cyan);
}

.aria-text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  line-height: var(--leading-normal);
}

/* Type variations */
.aria-message--success .aria-bubble {
  background: var(--success-bg-light);
  border-color: var(--success-border);
}

.aria-message--success .aria-name {
  color: var(--color-success-400);
}

.aria-message--success .aria-header svg {
  color: var(--color-success-400);
}

.aria-message--warning .aria-bubble {
  background: var(--orange-bg-light);
  border-color: var(--color-priority-medium-border-medium);
}

.aria-message--warning .aria-name {
  color: var(--color-warning-400);
}

.aria-message--warning .aria-header svg {
  color: var(--color-warning-400);
}

.aria-message--error .aria-bubble {
  background: var(--danger-bg-subtle);
  border-color: var(--danger-border-subtle);
}

.aria-message--error .aria-name {
  color: var(--color-error-400);
}

.aria-message--error .aria-header svg {
  color: var(--color-error-400);
}

.aria-message--loading .aria-header svg {
  color: var(--color-primary-400);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
