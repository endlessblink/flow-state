<template>
  <div class="time-display">
    <div class="time-info">
      <div class="current-time">{{ currentTime }}</div>
      <div class="current-date">{{ currentDate }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const currentTime = ref('')
const currentDate = ref('')

const updateTime = () => {
  const now = new Date()

  // Format time: HH:MM
  currentTime.value = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  // Format date: Day DD/MM
  currentDate.value = now.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit'
  })
}

let intervalId: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // Initial update
  updateTime()

  // Update every minute
  intervalId = setInterval(updateTime, 60000)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>

<style scoped>
.time-display {
  display: flex;
  align-items: center;
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-5);
  min-height: 60px;
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 var(--glass-bg-heavy);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.time-display:hover {
  border-color: var(--glass-border-hover);
  box-shadow:
    var(--shadow-xl),
    inset 0 1px 0 var(--glass-bg-heavy);
}

.time-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.current-time {
  font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  letter-spacing: 0.025em;
  line-height: 1;
}

.current-date {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
  line-height: 1;
}
</style>
