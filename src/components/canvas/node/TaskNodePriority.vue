<template>
  <div class="priority-indicator" />
</template>

<style scoped>
.priority-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--space-2_5);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  z-index: 1;
  transition: all var(--duration-fast) var(--spring-smooth);
}

:global(.priority-high) .priority-indicator {
  background: linear-gradient(180deg, var(--color-priority-high) 0%, var(--color-danger-soft) 100%);
  box-shadow:
    0 var(--space-0_5) var(--space-2) var(--color-danger-soft),
    0 0 var(--space-4) var(--color-danger-soft),
    inset 0 var(--space-0_5) 0 var(--glass-border-subtle);
}

:global(.priority-medium) .priority-indicator {
  background: linear-gradient(180deg, var(--color-priority-medium) 0%, var(--color-orange-soft) 100%);
  box-shadow:
    0 var(--space-0_5) var(--space-2) var(--color-orange-soft),
    0 0 var(--space-4) var(--color-orange-soft),
    inset 0 var(--space-0_5) 0 var(--glass-border-subtle);
}

:global(.priority-low) .priority-indicator {
  background: linear-gradient(180deg, var(--color-priority-low) 0%, var(--color-blue-soft) 100%);
  box-shadow:
    0 var(--space-0_5) var(--space-2) var(--color-blue-soft),
    0 0 var(--space-4) var(--color-blue-soft),
    inset 0 var(--space-0_5) 0 var(--glass-border-subtle);
}

:global(.timer-active) .priority-indicator {
  background: linear-gradient(180deg, var(--brand-primary) 0%, rgba(var(--brand-primary-rgb), 0.7) 100%) !important;
  box-shadow:
    0 var(--space-0_5) var(--space-2) rgba(var(--brand-primary-rgb), 0.5),
    0 0 var(--space-4) rgba(var(--brand-primary-rgb), 0.4) !important;
  animation: priorityPulse 2s ease-in-out infinite;
}

@keyframes priorityPulse {
  0%, 100% {
    box-shadow:
      0 var(--space-0_5) var(--space-2) rgba(var(--brand-primary-rgb), 0.5),
      0 0 var(--space-4) rgba(var(--brand-primary-rgb), 0.4);
  }
  50% {
    box-shadow:
      0 var(--space-0_5) var(--space-3) rgba(var(--brand-primary-rgb), 0.7),
      0 0 var(--space-6) rgba(var(--brand-primary-rgb), 0.6);
  }
}
</style>
