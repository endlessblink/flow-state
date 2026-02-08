<template>
  <transition name="drag-hints-fade" appear>
    <div v-if="showDragHints && isHovered" class="drag-handle__hints" :class="hintsClasses">
      <div class="hint-item">
        <kbd>Click</kbd>
        <span>Start drag</span>
      </div>
      <div class="hint-item">
        <kbd>↑↓←→</kbd>
        <span>Move</span>
      </div>
      <div class="hint-item">
        <kbd>Esc</kbd>
        <span>Cancel</span>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  showDragHints: boolean
  isHovered: boolean
  size: 'sm' | 'md' | 'lg'
}>()

const hintsClasses = computed(() => [
  'drag-handle__hints',
  `drag-handle__hints--${props.size}`,
  {
    'drag-handle__hints--visible': true
  }
])
</script>

<style scoped>
.drag-handle__hints {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(var(--space-2_5));
  background: var(--tooltip-bg);
  border: 1px solid var(--glass-border);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  z-index: var(--z-tooltip);
  pointer-events: none;
  min-width: var(--space-35);
  box-shadow: var(--shadow-lg);
}

/* Tooltip Arrow */
.drag-handle__hints::before {
  content: '';
  position: absolute;
  top: calc(-1 * var(--space-1_5));
  left: 50%;
  transform: translateX(-50%);
  border-width: 0 var(--space-1_5) var(--space-1_5) var(--space-1_5);
  border-style: solid;
  border-color: transparent transparent var(--tooltip-bg) transparent;
}

.drag-hints-fade-enter-active,
.drag-hints-fade-leave-active {
  transition: opacity var(--duration-normal) var(--var(--ease-out)-out), transform var(--duration-normal) ease;
}

.drag-hints-fade-enter-from,
.drag-hints-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(var(--space-3_75));
}

.hint-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-xs);
  color: var(--text-on-tooltip);
}

kbd {
  background: var(--glass-border-hover);
  padding: var(--space-0_25) var(--space-1);
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-on-primary);
}
</style>
