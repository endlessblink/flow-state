<template>
  <div class="task-node-header">
    <!-- Title -->
    <div class="task-title" :class="alignmentClasses">
      {{ title || 'Untitled Task' }}
    </div>

    <!-- Timer Active Badge -->
    <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
      <Timer :size="14" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Timer } from 'lucide-vue-next'

defineProps<{
  title: string
  isTimerActive: boolean
  alignmentClasses: string
}>()
</script>

<style scoped>
.task-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  line-height: 1.4;
  word-break: break-word;
}

/* RTL Support */
.task-title.text-right {
  text-align: right;
  direction: rtl;
}
.task-title.text-left {
  text-align: left;
  direction: ltr;
}

.timer-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: var(--brand-primary);
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  box-shadow: 0 2px 8px var(--brand-primary);
  animation: timerPulse 2s ease-in-out infinite;
  border: 2px solid white;
}

@keyframes timerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 8px var(--brand-primary);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 2px 12px var(--brand-primary), 0 0 16px var(--blue-border-medium);
  }
}
</style>
