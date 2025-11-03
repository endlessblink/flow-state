<template>
  <div
    class="overflow-tooltip-container"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- The element that might overflow -->
    <div
      ref="elementRef"
      class="overflow-text"
      :class="{
        'is-overflowing': isOverflowing,
        'show-tooltip': showTooltip
      }"
    >
      <slot />
    </div>

    <!-- Tooltip that only shows when text is overflowing -->
    <Transition name="tooltip-fade">
      <div
        v-if="showTooltip && isOverflowing"
        class="overflow-tooltip"
        role="tooltip"
        :aria-hidden="!showTooltip"
      >
        <div class="tooltip-content">
          <slot name="tooltip-content">
            {{ text }}
          </slot>
        </div>
        <div class="tooltip-arrow"></div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, type Ref } from 'vue'
import { useTextOverflow } from '@/composables/useTextOverflow'

interface Props {
  text?: string
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
  tooltipDelay?: number
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  tooltipPosition: 'top',
  tooltipDelay: 0
})

const elementRef = ref<HTMLElement | null>(null)
const textRef = ref(props.text || '')

// Use the text overflow composable
const {
  isOverflowing,
  showTooltip,
  handleMouseEnter,
  handleMouseLeave
} = useTextOverflow(elementRef, textRef)

// Watch for text prop changes
watch(() => props.text, (newText) => {
  textRef.value = newText || ''
})
</script>

<style scoped>
.overflow-tooltip-container {
  position: relative;
  display: contents;
}

.overflow-text {
  width: 100%;
}

.overflow-tooltip {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
  /* Position relative to the container */
  left: 50%;
  transform: translateX(-50%);
  /* Default position - can be overridden by tooltipPosition class */
  bottom: calc(100% + 8px);
  background: var(--surface-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--space-2) var(--space-3);
  max-width: 300px;
  word-wrap: break-word;
  animation: tooltipFadeIn 0.2s ease-out;
}

.tooltip-content {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: 1.4;
  white-space: normal;
}

.tooltip-arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--surface-primary);
  border: 1px solid var(--border-medium);
  border-top: none;
  border-left: none;
  transform: rotate(45deg);
  bottom: -5px;
  left: 50%;
  margin-left: -4px;
}

/* Position variants */
.overflow-tooltip.tooltip-position-bottom {
  bottom: auto;
  top: calc(100% + 8px);
}

.overflow-tooltip.tooltip-position-bottom .tooltip-arrow {
  bottom: auto;
  top: -5px;
  border-top: 1px solid var(--border-medium);
  border-left: none;
  border-bottom: none;
  border-right: 1px solid var(--border-medium);
}

.overflow-tooltip.tooltip-position-left {
  left: auto;
  right: calc(100% + 8px);
  top: 50%;
  bottom: auto;
  transform: translateY(-50%);
}

.overflow-tooltip.tooltip-position-left .tooltip-arrow {
  left: auto;
  right: -5px;
  top: 50%;
  bottom: auto;
  transform: translateY(-50%) rotate(135deg);
}

.overflow-tooltip.tooltip-position-right {
  left: calc(100% + 8px);
  top: 50%;
  bottom: auto;
  transform: translateY(-50%);
}

.overflow-tooltip.tooltip-position-right .tooltip-arrow {
  left: -5px;
  top: 50%;
  bottom: auto;
  transform: translateY(-50%) rotate(-45deg);
}

/* Transitions */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

.tooltip-fade-enter-to,
.tooltip-fade-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* Dark theme support */
.dark-theme .overflow-tooltip {
  background: var(--surface-secondary);
  border-color: var(--border-subtle);
  box-shadow: var(--shadow-xl);
}

.dark-theme .tooltip-content {
  color: var(--text-primary);
}

.dark-theme .tooltip-arrow {
  background: var(--surface-secondary);
  border-color: var(--border-subtle);
}
</style>