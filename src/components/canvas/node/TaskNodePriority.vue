<template>
  <div class="priority-indicator" />
</template>

<style scoped>
.priority-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 10px;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  z-index: 1;
  transition: all var(--duration-fast) var(--spring-smooth);
}

:global(.priority-high) .priority-indicator {
  background: linear-gradient(180deg, var(--color-priority-high) 0%, rgba(239, 68, 68, 0.7) 100%);
  box-shadow:
    0 2px 8px rgba(239, 68, 68, 0.5),
    0 0 16px rgba(239, 68, 68, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

:global(.priority-medium) .priority-indicator {
  background: linear-gradient(180deg, var(--color-priority-medium) 0%, rgba(245, 158, 11, 0.7) 100%);
  box-shadow:
    0 2px 8px rgba(245, 158, 11, 0.5),
    0 0 16px rgba(245, 158, 11, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

:global(.priority-low) .priority-indicator {
  background: linear-gradient(180deg, var(--color-priority-low) 0%, rgba(59, 130, 246, 0.7) 100%);
  box-shadow:
    0 2px 8px rgba(59, 130, 246, 0.5),
    0 0 16px rgba(59, 130, 246, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

:global(.timer-active) .priority-indicator {
  background: linear-gradient(180deg, var(--brand-primary) 0%, rgba(78, 205, 196, 0.7) 100%) !important;
  box-shadow:
    0 2px 8px rgba(78, 205, 196, 0.5),
    0 0 16px rgba(78, 205, 196, 0.4) !important;
  animation: priorityPulse 2s ease-in-out infinite;
}

@keyframes priorityPulse {
  0%, 100% {
    box-shadow:
      0 2px 8px rgba(78, 205, 196, 0.5),
      0 0 16px rgba(78, 205, 196, 0.4);
  }
  50% {
    box-shadow:
      0 2px 12px rgba(78, 205, 196, 0.7),
      0 0 24px rgba(78, 205, 196, 0.6);
  }
}
</style>
