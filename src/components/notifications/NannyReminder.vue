<script setup lang="ts">
/**
 * NannyReminder.vue
 *
 * Shows a persistent reminder when the user hasn't started a Pomodoro
 * session for too long. Provides snooze (30m, 1hr) and stop-today options.
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { Timer, X, BellOff } from 'lucide-vue-next'

const props = defineProps<{
  minutes: number
}>()

const emit = defineEmits<{
  snooze: [minutes: number]
  stopToday: []
  dismiss: []
}>()

// Auto-dismiss after 60 seconds
const autoDismissTimer = ref<ReturnType<typeof setTimeout> | null>(null)

onMounted(() => {
  autoDismissTimer.value = setTimeout(() => {
    emit('dismiss')
  }, 60000)
})

onUnmounted(() => {
  if (autoDismissTimer.value) {
    clearTimeout(autoDismissTimer.value)
  }
})
</script>

<template>
  <Transition name="slide-up">
    <div class="nanny-reminder">
      <div class="reminder-card">
        <!-- Dismiss X -->
        <button
          class="dismiss-btn"
          aria-label="Dismiss"
          title="Dismiss"
          @click="emit('dismiss')"
        >
          <X :size="14" />
        </button>

        <!-- Icon + Message -->
        <div class="reminder-body">
          <div class="icon-wrapper">
            <Timer :size="20" />
          </div>

          <div class="text-content">
            <span class="title">Time to pick a task!</span>
            <span class="description">
              {{ minutes > 0 ? `${minutes}+ min without a focused session` : 'No active Pomodoro session' }}
              — pick a task to stay on track.
            </span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="actions">
          <button class="action-btn snooze-btn" @click="emit('snooze', 30)">
            Snooze 30m
          </button>
          <button class="action-btn snooze-btn" @click="emit('snooze', 60)">
            Snooze 1hr
          </button>
          <button class="action-btn stop-btn" @click="emit('stopToday')">
            <BellOff :size="12" />
            Stop today
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.nanny-reminder {
  position: fixed;
  bottom: var(--space-6);
  inset-inline-end: var(--space-6);
  z-index: var(--z-toast);
  max-width: 380px;
  width: calc(100% - calc(var(--space-6) * 2));
}

.reminder-card {
  position: relative;
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-inline-start: 3px solid var(--color-warning, #F59E0B);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.dismiss-btn {
  position: absolute;
  top: var(--space-2);
  inset-inline-end: var(--space-2);
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--duration-fast);
}

.dismiss-btn:hover {
  color: var(--text-primary);
}

.reminder-body {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding-inline-end: var(--space-4);
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-9);
  height: var(--space-9);
  border-radius: var(--radius-full);
  flex-shrink: 0;
  background: rgba(245, 158, 11, 0.15);
  color: var(--color-warning, #F59E0B);
}

.text-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.description {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: var(--leading-normal);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-1);
  border-top: 1px solid var(--glass-border);
}

.action-btn {
  font-size: var(--text-xs);
  font-weight: 500;
  padding: var(--space-1_5) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast);
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.snooze-btn {
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  border-color: var(--glass-border);
}

.snooze-btn:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.stop-btn {
  background: transparent;
  color: var(--text-tertiary);
  margin-inline-start: auto;
}

.stop-btn:hover {
  color: var(--color-danger);
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all var(--duration-slow) var(--spring-bounce);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(var(--space-5)) scale(0.95);
}
</style>
