<script setup lang="ts">
/**
 * GamificationTooltipWrapper
 * TASK-1287: Lightweight hover wrapper for per-widget rich tooltips.
 * Shows BasePopover (variant="tooltip") on mouseenter with 200ms delay.
 * Force-hides when gamification panel is open.
 */
import { ref, watch, onBeforeUnmount } from 'vue'
import BasePopover from '@/components/base/BasePopover.vue'

const props = withDefaults(defineProps<{
  disabled?: boolean
  panelOpen?: boolean
}>(), {
  disabled: false,
  panelOpen: false,
})

const isHovering = ref(false)
const showTooltip = ref(false)
const wrapperRef = ref<HTMLElement>()
const tooltipX = ref(0)
const tooltipY = ref(0)
let hoverTimeout: ReturnType<typeof setTimeout> | null = null

function onMouseEnter() {
  if (props.disabled || props.panelOpen) return
  isHovering.value = true
  hoverTimeout = setTimeout(() => {
    if (isHovering.value && !props.panelOpen) {
      updatePosition()
      showTooltip.value = true
    }
  }, 200)
}

function onMouseLeave() {
  isHovering.value = false
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
  showTooltip.value = false
}

function updatePosition() {
  if (!wrapperRef.value) return
  const rect = wrapperRef.value.getBoundingClientRect()
  tooltipX.value = rect.left + rect.width / 2
  tooltipY.value = rect.bottom
}

// Force-hide when panel opens
watch(() => props.panelOpen, (open) => {
  if (open) {
    showTooltip.value = false
    isHovering.value = false
  }
})

onBeforeUnmount(() => {
  if (hoverTimeout) clearTimeout(hoverTimeout)
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="gamification-tooltip-wrapper"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <slot />

    <BasePopover
      :is-visible="showTooltip && !disabled && !panelOpen"
      :x="tooltipX"
      :y="tooltipY"
      position="bottom"
      variant="tooltip"
      :offset="8"
      :close-on-click-outside="false"
      @close="showTooltip = false"
    >
      <slot name="tooltip" />
    </BasePopover>
  </div>
</template>

<style scoped>
.gamification-tooltip-wrapper {
  display: inline-flex;
  align-items: center;
}
</style>
