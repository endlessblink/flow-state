<template>
  <div class="done-toggle">
    <DoneToggleVisuals
      v-model:is-hovered="isHovered"
      v-model:is-focused="isFocused"
      :is-completed="completed"
      :disabled="disabled"
      :ripples="ripples"
      
      :show-celebration="showCelebration"
      :show-touch-feedback="showTouchFeedback"
      :size="size"
      :variant="variant"
      :title="title"
      :aria-label="ariaLabel"
      :show-hints="showHints"
      :show-progress="showProgress"
      
      :progress-percentage="progressPercentage"
      :celebration-particles="celebrationParticles"
      
      @click="handleClick"
      @keydown="handleKeyDown"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    />
  </div>
</template>

<script setup lang="ts">
import DoneToggleVisuals from './done-toggle/DoneToggleVisuals.vue'
import { useDoneToggleInteraction } from '@/composables/ui/done-toggle/useDoneToggleInteraction'

// Props
interface Props {
  completed?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'subtle' | 'prominent' | 'minimal' | 'simple'
  title?: string
  ariaLabel?: string
  showHints?: boolean
  showProgress?: boolean
  progressPercentage?: number
  celebrationParticles?: number
}

const props = withDefaults(defineProps<Props>(), {
  completed: false,
  disabled: false,
  size: 'md',
  variant: 'default',
  title: 'Mark task as done',
  ariaLabel: 'Toggle task completion',
  showHints: true,
  showProgress: false,
  progressPercentage: 0,
  celebrationParticles: 8
})

// Emits
const emit = defineEmits<{
  (e: 'toggle', completed: boolean): void
  (e: 'click', event: MouseEvent | KeyboardEvent): void
  (e: 'celebrationStart'): void
  (e: 'celebrationEnd'): void
}>()

// Interaction Logic
const {
  ripples,
  isHovered,
  isFocused,
  showCelebration,
  showTouchFeedback,
  handleClick,
  handleKeyDown,
  handleTouchStart,
  handleTouchEnd
} = useDoneToggleInteraction(props, emit)
</script>

<style scoped>
.done-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
</style>