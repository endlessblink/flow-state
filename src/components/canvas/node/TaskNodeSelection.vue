<template>
  <div class="selection-indicator">
    <div class="selection-corner top-left" />
    <div class="selection-corner top-right" />
    <div class="selection-corner bottom-left" />
    <div class="selection-corner bottom-right" />
  </div>
</template>

<style scoped>
.selection-indicator {
  position: absolute;
  top: -var(--space-2);
  left: -var(--space-2);
  right: -var(--space-2);
  bottom: -var(--space-2);
  pointer-events: none;
  z-index: 10;
}

.selection-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--brand-primary);
  border: 3px solid white;
  border-radius: var(--radius-xs);
  box-shadow: 0 2px 4px var(--shadow-md);
}

.selection-corner.top-left { top: 0; left: 0; }
.selection-corner.top-right { top: 0; right: 0; }
.selection-corner.bottom-left { bottom: 0; left: 0; }
.selection-corner.bottom-right { bottom: 0; right: 0; }
</style>
