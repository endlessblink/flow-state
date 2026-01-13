<template>
  <DragHandleVisuals
    :size="size"
    :disabled="disabled"
    :is-dragging="isDragging"
    :is-hovered="isHovered"
    :is-focused="isFocused"
    :show-touch-feedback="showTouchFeedback"
    :show-keyboard-navigation="showKeyboardNavigation"
    :aria-label="enhancedAriaLabel"
    :title="enhancedTitle"
    :data-title="enhancedTitle"
    
    @mouse-down="handleMouseDown"
    @touch-start="handleTouchStart"
    @hover-start="isHovered = true"
    @hover-end="isHovered = false"
    @keydown="handleKeyDown"
    @arrow-key="handleArrowKey"
    @focus="isFocused = true"
    @blur="isFocused = false"
  >
    <!-- Screen Reader Status -->
    <template #sr-status>
      <span id="drag-status" class="sr-only">
        {{ dragStatusText }}
      </span>
    </template>

    <!-- Hints -->
    <DragHandleHints 
      :show-drag-hints="showDragHints"
      :is-hovered="isHovered"
      :size="size"
    />

    <!-- Ghost (Preview) -->
    <DragHandleGhost
      :is-dragging="isDragging"
      :is-visible="dragGhost"
      :position="currentPosition"
    />
  </DragHandleVisuals>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Logic Components & Composables
import DragHandleVisuals from './drag-handle/DragHandleVisuals.vue'
import DragHandleHints from './drag-handle/DragHandleHints.vue'
import DragHandleGhost from './drag-handle/DragHandleGhost.vue'
import { useDragHandleState } from '@/composables/ui/drag-handle/useDragHandleState'
import { useDragHandleInteraction } from '@/composables/ui/drag-handle/useDragHandleInteraction'

// Props
interface Props {
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  title?: string
  ariaLabel?: string
  showDragHints?: boolean
  showKeyboardNavigation?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'md',
  title: 'Drag to move',
  ariaLabel: 'Drag handle',
  showDragHints: false,
  showKeyboardNavigation: true
})

// Emits (Passthrough)
const emit = defineEmits<{
  (e: 'dragStart', event: MouseEvent | TouchEvent): void
  (e: 'dragEnd', event: MouseEvent | TouchEvent): void
  (e: 'dragMove', event: MouseEvent | TouchEvent, deltaX: number, deltaY: number): void
  (e: 'keyboardMove', direction: 'up' | 'down' | 'left' | 'right'): void
  (e: 'hoverStart'): void
  (e: 'hoverEnd'): void
}>()

// 1. State Management
const state = useDragHandleState()

// 2. Interaction Logic
const {
  handleMouseDown,
  handleTouchStart,
  handleKeyDown,
  handleArrowKey,
  startDragOperation,
  endDragOperation
} = useDragHandleInteraction(props, state, emit)

// 3. Computed Helpers (Accessibility)
const { isDragging, isHovered, isFocused, showTouchFeedback, dragGhost, currentPosition } = state

const enhancedAriaLabel = computed(() => {
  const dragState = isDragging.value ? 'dragging in progress' : 'drag to move'
  const keyboardInfo = props.showKeyboardNavigation ? ', keyboard navigation available' : ''
  const hintsInfo = props.showDragHints ? ', hints available' : ''
  return `${props.ariaLabel}, ${dragState}${keyboardInfo}${hintsInfo}${props.disabled ? ', disabled' : ''}`
})

const enhancedTitle = computed(() => {
  let title = props.title
  if (props.showKeyboardNavigation) {
    title += ' (Use arrow keys to move, Escape to cancel)'
  }
  return title
})

const dragStatusText = computed(() => {
  if (isDragging.value) {
    return 'Dragging in progress. Use arrow keys to move or Escape to cancel.'
  }
  return 'Drag to move item. Click and drag or press Enter to start.'
})

// 4. Exposed Methods (for Templates)
defineExpose({
  startDrag: () => {
    if (!props.disabled && !isDragging.value) {
      const syntheticEvent = new MouseEvent('mousedown')
      startDragOperation(syntheticEvent)
    }
  },
  endDrag: () => {
    if (isDragging.value) {
      endDragOperation(new MouseEvent('mouseup'))
    }
  },
  focus: () => {
    const element = document.querySelector('.drag-handle') as HTMLElement
    element?.focus()
  },
  blur: () => {
    const element = document.querySelector('.drag-handle') as HTMLElement
    element?.blur()
  },
  isDragging: () => isDragging.value,
  position: () => currentPosition.value
})
</script>

<style>
/* Utilities */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>