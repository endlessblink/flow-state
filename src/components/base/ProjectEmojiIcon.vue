<template>
  <div
    class="project-emoji-icon"
    :class="{
      'project-emoji-icon--native': shouldUseNative,
      'project-emoji-icon--clickable': clickable,
      'project-emoji-icon--default': variant === 'default',
      'project-emoji-icon--plain': variant === 'plain'
    }"
    :style="customStyles"
    :title="title"
    :aria-label="title"
    role="img"
    @click="$emit('click', $event)"
  >
    <!-- Native emoji first with Noto Color Emoji font -->
    <span
      v-if="shouldUseNative"
      class="project-emoji-icon__native"
      :style="nativeStyles"
      aria-hidden="true"
    >
      {{ emoji }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  emoji: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: string
  clickable?: boolean
  title?: string
  variant?: 'default' | 'plain' // 'default' has background/border, 'plain' is just the emoji
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  color: undefined,
  clickable: false,
  title: '',
  variant: 'plain' // Default to plain (no background/border) to avoid gray dots
})

const _emit = defineEmits<{
  click: [event: MouseEvent]
}>()

// Always use native emoji rendering with Noto Color Emoji
const shouldUseNative = computed(() => true)

// Size calculations
const sizeMap = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32
}

const containerSize = computed(() => sizeMap[props.size])

// Dynamic styles
const customStyles = computed(() => ({
  width: `${containerSize.value}px`,
  height: `${containerSize.value}px`
}))

const nativeStyles = computed(() => ({
  fontSize: `${Math.max(12, Math.floor(containerSize.value * 0.65))}px`,
  lineHeight: '1'
}))

// Computed title if not provided
const _computedTitle = computed(() => {
  if (props.title) return props.title
  return `Project emoji: ${props.emoji}`
})
</script>

<style scoped>
.project-emoji-icon {
  /* Container with perfect centering using CSS Grid */
  display: grid;
  place-items: center;
  transition: all var(--duration-fast) var(--spring-smooth);
  position: relative;
  overflow: hidden;
  /* Hardware acceleration for smooth animations */
  transform: translateZ(0);
  will-change: transform;
}

/* Default variant with background and border */
.project-emoji-icon--default {
  border-radius: var(--radius-full);
  background-color: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
}

/* Plain variant - just the emoji, no background or border */
.project-emoji-icon--plain {
  /* No background, border, or borderRadius - just the emoji */
}

.project-emoji-icon--clickable {
  cursor: pointer;
}

.project-emoji-icon--default.project-emoji-icon--clickable:hover {
  transform: scale(1.05);
  border-color: var(--border-medium);
  background-color: var(--surface-hover);
  box-shadow: var(--shadow-sm);
}

.project-emoji-icon--plain.project-emoji-icon--clickable:hover {
  transform: scale(1.1);
  /* No background changes for plain variant */
}

/* Native emoji styles - optimized for Noto Color Emoji */
.project-emoji-icon__native {
  display: block;
  text-align: center;
  /* Enhanced emoji rendering */
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  /* Prevent baseline issues */
  line-height: 1;
  /* Prioritize Noto Color Emoji for consistency */
  font-family: "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", "EmojiSymbols", system-ui, sans-serif;
  /* Ensure consistent sizing */
  width: 1em;
  height: 1em;
  /* Force colorful emoji rendering */
  font-style: normal;
  font-weight: normal;
  /* Ensure proper emoji display */
  -webkit-text-stroke-width: 0;
  -webkit-text-stroke-color: transparent;
}

/* Theme integration - only for default variant */
.project-emoji-icon--default:hover {
  background-color: var(--surface-elevated);
  border-color: var(--brand-border-subtle);
}

/* Size variants */
.project-emoji-icon[data-size="xs"] {
  /* 16px container - minimal */
}

.project-emoji-icon[data-size="sm"] {
  /* 20px container - standard */
}

.project-emoji-icon[data-size="md"] {
  /* 24px container - larger */
}

.project-emoji-icon[data-size="lg"] {
  /* 32px container - prominent */
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .project-emoji-icon {
    transition: none;
  }
}

/* Focus styles for accessibility */
.project-emoji-icon--clickable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>