<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMorningDashboard } from '@/composables/useMorningDashboard'

const { greetingText, todayFormatted, dailyQuote } = useMorningDashboard()

const visible = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    visible.value = true
  })
})
</script>

<template>
  <div class="morning-greeting" :class="{ 'morning-greeting--visible': visible }">
    <h1 class="greeting-text">{{ greetingText }}</h1>
    <p class="date-text">{{ todayFormatted }}</p>
    <p class="quote-text">{{ dailyQuote }}</p>
  </div>
</template>

<style scoped>
.morning-greeting {
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity 0.5s var(--ease-out),
    transform 0.5s var(--ease-out);
}

.morning-greeting--visible {
  opacity: 1;
  transform: translateY(0);
}

.greeting-text {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
  line-height: 1.2;
}

.date-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 var(--space-2) 0;
  transition: opacity 0.6s var(--ease-out) 0.1s;
}

.morning-greeting:not(.morning-greeting--visible) .date-text {
  opacity: 0;
}

.morning-greeting--visible .date-text {
  opacity: 1;
}

.quote-text {
  font-size: 0.8rem;
  font-style: italic;
  color: var(--text-muted);
  margin: 0;
  transition: opacity 0.6s var(--ease-out) 0.2s;
}

.morning-greeting:not(.morning-greeting--visible) .quote-text {
  opacity: 0;
}

.morning-greeting--visible .quote-text {
  opacity: 1;
}
</style>
