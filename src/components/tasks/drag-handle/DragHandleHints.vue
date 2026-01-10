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
  transform: translateX(-50%) translateY(10px);
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 1000;
  pointer-events: none;
  min-width: 140px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Tooltip Arrow */
.drag-handle__hints::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 0 6px 6px 6px;
  border-style: solid;
  border-color: transparent transparent rgba(0, 0, 0, 0.9) transparent;
}

.drag-hints-fade-enter-active,
.drag-hints-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.drag-hints-fade-enter-from,
.drag-hints-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(15px);
}

.hint-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}

kbd {
  background: rgba(255, 255, 255, 0.15);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 10px;
  color: #fff;
}
</style>
