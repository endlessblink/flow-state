<template>
  <div class="time-display">
    <div class="time-info">
      <time :datetime="isoTime" class="current-time">
        {{ currentTime }}
      </time>
      <time :datetime="isoDate" class="current-date">
        {{ currentDate }}
      </time>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const currentTime = ref('')
const currentDate = ref('')
const isoTime = ref('')
const isoDate = ref('')

const updateTime = () => {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  isoDate.value = `${year}-${month}-${day}`

  // Create an ISO 8601 string but in local time format (without Z)
  // This matches what the user actually sees on their local device
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  isoTime.value = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`

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
