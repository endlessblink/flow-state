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
  width: 48px;
  height: 48px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: var(--radius-md);
  backdrop-filter: blur(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform var(--duration-instant) cubic-bezier(0.2, 0, 0.2, 1);
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
  width: 4px;
  height: 4px;
  background: rgba(59, 130, 246, 0.8);
  border-radius: 50%;
  box-shadow: 0 0 2px rgba(59, 130, 246, 0.4);
}
</style>
