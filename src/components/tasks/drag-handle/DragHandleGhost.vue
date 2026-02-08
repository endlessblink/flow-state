<template>
  <teleport to="body">
    <div
      v-if="isDragging && isVisible"
      class="drag-handle__ghost"
      :style="ghostStyle"
      aria-hidden="true"
    >
      <div class="drag-handle__ghost-content">
        <div class="drag-handle__ghost-dots">
          <div v-for="n in 6" :key="n" class="drag-handle__ghost-dot" />
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isDragging: boolean
  isVisible: boolean
  position: { x: number, y: number }
}>()

const ghostStyle = computed(() => ({
  position: 'fixed' as const,
  top: `${props.position.y}px`,
  left: `${props.position.x}px`,
  zIndex: 9999,
  pointerEvents: 'none' as const,
  transform: 'translate(-50%, -50%) scale(1.1)',
  opacity: 0.8
}))
</script>

<style scoped>
.drag-handle__ghost {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-12);
  height: var(--space-12);
  background: var(--blue-bg-light);
  border: 1px solid var(--blue-border-medium);
  border-radius: var(--radius-md);
  backdrop-filter: var(--blur-light);
  box-shadow: var(--shadow-md);
  transition: transform var(--duration-instant) var(--ease-out);
}

.drag-handle__ghost-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.drag-handle__ghost-dots {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-1);
}

.drag-handle__ghost-dot {
  width: var(--space-1);
  height: var(--space-1);
  background: var(--color-blue);
  border-radius: var(--radius-full);
  box-shadow: var(--glow-blue-subtle);
}
</style>
