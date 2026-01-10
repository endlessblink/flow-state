<template>
  <div class="priority-indicator" />
</template>

<style scoped>
.priority-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  border-radius: 0;
  z-index: 1;
}

:global(.priority-high) .priority-indicator {
  background: var(--color-priority-high);
  box-shadow: var(--priority-high-glow);
}

:global(.priority-medium) .priority-indicator {
  background: var(--color-priority-medium);
  box-shadow: var(--priority-medium-glow);
}

:global(.priority-low) .priority-indicator {
  background: var(--color-priority-low);
  box-shadow: var(--priority-low-glow);
}

:global(.timer-active) .priority-indicator {
  background: var(--brand-primary) !important;
  box-shadow: 0 0 12px var(--brand-primary) !important;
  animation: priorityPulse 2s ease-in-out infinite;
}

@keyframes priorityPulse {
  0%, 100% {
    box-shadow: var(--brand-primary-glow);
  }
  50% {
    box-shadow: 0 0 20px var(--brand-primary), 0 0 30px var(--blue-border-medium);
  }
}
</style>
