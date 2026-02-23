<template>
  <div class="task-node-header">
    <!-- Title -->
    <div class="task-title" :class="alignmentClasses" :title="title">
      {{ displayTitle }}
    </div>

    <!-- Timer Active Badge -->
    <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
      <Clock :size="12" :stroke-width="2.5" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Clock } from 'lucide-vue-next'
import { truncateUrlsInText } from '@/utils/urlTruncate'

const props = defineProps<{
  title: string
  isTimerActive: boolean
  alignmentClasses: object | string
}>()

const displayTitle = computed(() => truncateUrlsInText(props.title) || 'Untitled Task')
</script>

<style scoped>
.task-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: break-word;
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
  top: var(--space-2);
  right: var(--space-2);
  width: var(--space-6);
  height: var(--space-6);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  border: 2px solid var(--brand-primary);
  backdrop-filter: blur(8px);
  box-shadow: 0 0 var(--space-2) var(--brand-primary);
  animation: timerPulse 2s ease-in-out infinite;
}

@keyframes timerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 var(--space-2) var(--brand-primary);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 var(--space-3) var(--brand-primary), 0 0 var(--space-4) var(--brand-primary);
  }
}
</style>
