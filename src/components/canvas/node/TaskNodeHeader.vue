<template>
  <div class="task-node-header">
    <!-- Title -->
    <div class="task-title" :class="alignmentClasses" :title="title">
      {{ displayTitle }}
    </div>

    <!-- Timer Active Badge -->
    <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
      <Timer :size="14" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Timer } from 'lucide-vue-next'
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
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  background: var(--brand-primary);
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  box-shadow: 0 var(--space-0_5) var(--space-2) var(--brand-primary);
  animation: timerPulse 2s ease-in-out infinite;
  border: var(--space-0_5) solid white;
}

@keyframes timerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 var(--space-0_5) var(--space-2) var(--brand-primary);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 var(--space-0_5) var(--space-3) var(--brand-primary), 0 0 var(--space-4) var(--blue-border-medium);
  }
}
</style>
