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
    <div class="handle-inner"></div>
    <div class="handle-hitzone" @mouseenter="onHover" @mouseleave="onLeave"></div>
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
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--brand-primary);
  border: 2px solid var(--surface-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
  z-index: 100;
  pointer-events: auto;
}

.handle-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--surface-primary);
  transition: all 0.15s ease;
}

.handle-hitzone {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: inherit;
}

/* Position classes for each handle type */
.handle-top-left {
  top: -8px;
  left: -8px;
}

.handle-top-right {
  top: -8px;
  right: -8px;
}

.handle-bottom-left {
  bottom: -8px;
  left: -8px;
}

.handle-bottom-right {
  bottom: -8px;
  right: -8px;
}

.handle-top {
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
}

.handle-bottom {
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
}

.handle-left {
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
}

.handle-right {
  right: -8px;
  top: 50%;
  transform: translateY(-50%);
}

.handle-se {
  bottom: -8px;
  right: -8px;
}

/* Hover and active states */
.custom-resize-handle-component:hover,
.custom-resize-handle-component.is-resizing {
  background-color: var(--accent-primary);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
  transform: scale(1.2);
}

.custom-resize-handle-component:hover .handle-inner,
.custom-resize-handle-component.is-resizing .handle-inner {
  width: 8px;
  height: 8px;
  background-color: rgba(255, 255, 255, 0.9);
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