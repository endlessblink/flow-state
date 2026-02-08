<template>
  <div
    class="custom-resize-handle-component"
    :class="[
      `handle-${direction}`,
      {
        'is-resizing': isResizing,
        'visible': isVisible
      }
    ]"
    :style="handleStyle"
  >
    <div class="handle-inner" />
    <div class="handle-hitzone" @mouseenter="onHover" @mouseleave="onLeave" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  direction?: string
  isVisible?: boolean
  isResizing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'se',
  isVisible: false,
  isResizing: false
})

// Enhanced cursor mapping for each handle position
const cursorMap = {
  'top-left': 'nwse-resize',
  'top-right': 'nesw-resize',
  'bottom-left': 'nesw-resize',
  'bottom-right': 'nwse-resize',
  'top': 'ns-resize',
  'bottom': 'ns-resize',
  'left': 'ew-resize',
  'right': 'ew-resize',
  'se': 'nwse-resize'
}

const handleStyle = computed(() => ({
  cursor: cursorMap[props.direction as keyof typeof cursorMap] || 'nwse-resize',
  opacity: props.isVisible || props.isResizing ? 1 : 0,
  transform: props.isResizing ? 'scale(1.2)' : 'scale(1)'
}))

const onHover = () => {
  // Handle hover effects
}

const onLeave = () => {
  // Handle leave effects
}
</script>

<style scoped>
.custom-resize-handle-component {
  position: absolute;
  width: var(--space-4);
  height: var(--space-4);
  border-radius: 50%;
  background-color: var(--brand-primary);
  border: var(--space-0_5) solid var(--surface-primary);
  box-shadow: var(--shadow-dark-md);
  transition: all var(--duration-normal) var(--ease-out);
  z-index: 100;
  pointer-events: auto;
}

.handle-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: var(--space-1_5);
  height: var(--space-1_5);
  border-radius: 50%;
  background-color: var(--surface-primary);
  transition: all var(--duration-fast) var(--ease-out);
}

.handle-hitzone {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: var(--space-6);
  height: var(--space-6);
  border-radius: 50%;
  cursor: inherit;
}

/* Position classes for each handle type */
.handle-top-left {
  top: -var(--space-2);
  left: -var(--space-2);
}

.handle-top-right {
  top: -var(--space-2);
  right: -var(--space-2);
}

.handle-bottom-left {
  bottom: -var(--space-2);
  left: -var(--space-2);
}

.handle-bottom-right {
  bottom: -var(--space-2);
  right: -var(--space-2);
}

.handle-top {
  top: -var(--space-2);
  left: 50%;
  transform: translateX(-50%);
}

.handle-bottom {
  bottom: -var(--space-2);
  left: 50%;
  transform: translateX(-50%);
}

.handle-left {
  left: -var(--space-2);
  top: 50%;
  transform: translateY(-50%);
}

.handle-right {
  right: -var(--space-2);
  top: 50%;
  transform: translateY(-50%);
}

.handle-se {
  bottom: -var(--space-2);
  right: -var(--space-2);
}

/* Hover and active states */
.custom-resize-handle-component:hover,
.custom-resize-handle-component.is-resizing {
  background-color: var(--brand-active);
  box-shadow: var(--shadow-dark-xl);
  transform: scale(1.2);
}

.custom-resize-handle-component:hover .handle-inner,
.custom-resize-handle-component.is-resizing .handle-inner {
  width: var(--space-2);
  height: var(--space-2);
  background-color: var(--glass-bg-heavy);
}

/* Animation */
.custom-resize-handle-component.visible {
  animation: handle-fade-in 0.2s ease;
}

@keyframes handle-fade-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>