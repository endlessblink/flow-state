<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="popover-overlay"
      :class="{ 'no-overlay': variant === 'tooltip' }"
      @click="handleOverlayClick"
      @contextmenu.prevent
    >
      <div
        ref="popoverRef"
        class="base-popover"
        :class="[`variant-${variant}`, `position-${computedPosition}`]"
        :style="popoverStyle"
        @click.stop
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

export type PopoverPosition = 'auto' | 'top' | 'bottom' | 'left' | 'right'
export type PopoverVariant = 'menu' | 'tooltip' | 'dropdown'

interface Props {
  isVisible: boolean
  x: number
  y: number
  position?: PopoverPosition
  variant?: PopoverVariant
  offset?: number
  closeOnClickOutside?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  position: 'auto',
  variant: 'menu',
  offset: 8,
  closeOnClickOutside: true
})

const emit = defineEmits<{
  close: []
}>()

const popoverRef = ref<HTMLElement>()
const computedPosition = ref<PopoverPosition>(props.position)

const popoverStyle = ref({
  left: '0px',
  top: '0px'
})

const calculatePosition = () => {
  if (!popoverRef.value) return

  const popover = popoverRef.value
  const popoverRect = popover.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let x = props.x
  let y = props.y
  let finalPosition = props.position

  if (props.position === 'auto') {
    // Auto-detect best position based on available space
    const spaceRight = viewportWidth - x
    const spaceBottom = viewportHeight - y
    const spaceLeft = x
    const spaceTop = y

    if (spaceRight >= popoverRect.width + props.offset) {
      finalPosition = 'right'
    } else if (spaceLeft >= popoverRect.width + props.offset) {
      finalPosition = 'left'
    } else if (spaceBottom >= popoverRect.height + props.offset) {
      finalPosition = 'bottom'
    } else if (spaceTop >= popoverRect.height + props.offset) {
      finalPosition = 'top'
    } else {
      // Default to bottom-right if no space is ideal
      finalPosition = 'bottom'
    }
  }

  // Calculate position based on final position
  switch (finalPosition) {
    case 'top':
      x = x - popoverRect.width / 2
      y = y - popoverRect.height - props.offset
      break
    case 'bottom':
      x = x - popoverRect.width / 2
      y = y + props.offset
      break
    case 'left':
      x = x - popoverRect.width - props.offset
      y = y - popoverRect.height / 2
      break
    case 'right':
      x = x + props.offset
      y = y - popoverRect.height / 2
      break
  }

  // Adjust horizontal position if popover would overflow
  if (x + popoverRect.width > viewportWidth) {
    x = viewportWidth - popoverRect.width - 16
  }

  // Adjust vertical position if popover would overflow
  if (y + popoverRect.height > viewportHeight) {
    y = viewportHeight - popoverRect.height - 16
  }

  // Ensure minimum padding from edges
  x = Math.max(16, x)
  y = Math.max(16, y)

  computedPosition.value = finalPosition

  popoverStyle.value = {
    left: `${x}px`,
    top: `${y}px`
  }
}

const handleOverlayClick = () => {
  if (props.closeOnClickOutside) {
    close()
  }
}

const close = () => {
  emit('close')
}

const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isVisible) {
    close()
  }
}

watch(() => props.isVisible, async (visible) => {
  if (visible) {
    await nextTick()
    calculatePosition()
  }
})

// Recalculate on window resize
const handleResize = () => {
  if (props.isVisible) {
    calculatePosition()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.popover-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: transparent;
}

.popover-overlay.no-overlay {
  pointer-events: none;
}

.base-popover {
  position: fixed;
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-xl);
  box-shadow:
    0 16px 32px var(--shadow-strong),
    0 8px 16px var(--shadow-md),
    inset 0 1px 0 var(--glass-border-soft);
  z-index: 3001;
  animation: popoverSlideIn var(--duration-fast) var(--spring-bounce);
  pointer-events: all;
}

/* Variant: Menu */
.variant-menu {
  min-width: 200px;
  padding: var(--space-2);
}

/* Variant: Tooltip */
.variant-tooltip {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  max-width: 300px;
  border-radius: var(--radius-md);
}

/* Variant: Dropdown */
.variant-dropdown {
  min-width: 240px;
  max-height: 400px;
  overflow-y: auto;
  padding: var(--space-2);
}

/* Position-specific animations */
@keyframes popoverSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.position-top {
  animation: popoverSlideInTop var(--duration-fast) var(--spring-bounce);
}

@keyframes popoverSlideInTop {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.position-left {
  animation: popoverSlideInLeft var(--duration-fast) var(--spring-bounce);
}

@keyframes popoverSlideInLeft {
  from {
    opacity: 0;
    transform: scale(0.95) translateX(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateX(0);
  }
}

.position-right {
  animation: popoverSlideInRight var(--duration-fast) var(--spring-bounce);
}

@keyframes popoverSlideInRight {
  from {
    opacity: 0;
    transform: scale(0.95) translateX(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateX(0);
  }
}

/* Scrollbar styling for dropdown variant */
.variant-dropdown::-webkit-scrollbar {
  width: 8px;
}

.variant-dropdown::-webkit-scrollbar-track {
  background: var(--glass-bg-soft);
  border-radius: var(--radius-full);
}

.variant-dropdown::-webkit-scrollbar-thumb {
  background: var(--glass-border-strong);
  border-radius: var(--radius-full);
}

.variant-dropdown::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
