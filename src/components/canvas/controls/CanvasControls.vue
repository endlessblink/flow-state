<template>
  <div class="canvas-controls">
    <!-- Zoom Controls -->
    <div class="zoom-controls zoom-dropdown-container">
      <!-- Zoom In Button -->
      <button
        @click="zoomIn"
        :disabled="isZoomAtMax"
        class="zoom-button"
        title="Zoom In (Ctrl/Cmd +)"
        :class="{ 'opacity-50 cursor-not-allowed': isZoomAtMax }"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>

      <!-- Zoom Level Display -->
      <div class="zoom-display">
        <button
          @click="toggleZoomDropdown"
          class="zoom-level-button"
          title="Current zoom level - click for presets"
        >
          {{ zoomPercentage }}%
        </button>

        <!-- Zoom Dropdown -->
        <div
          v-if="showZoomDropdown"
          class="zoom-dropdown absolute top-full left-0 mt-1 bg-glass-base border border-glass-border rounded-lg shadow-lg z-50 min-w-[120px]"
        >
          <div class="zoom-presets">
            <button
              v-for="preset in zoomPresets"
              :key="preset.value"
              @click="applyZoomPreset(preset.value)"
              class="zoom-preset-button"
              :class="{ 'bg-primary/20': currentZoomLevel === preset.value }"
              :title="preset.description"
            >
              {{ preset.label }}
            </button>
          </div>

          <div class="zoom-divider border-t border-glass-border my-1"></div>

          <div class="zoom-actions">
            <button
              @click="fitView"
              class="zoom-action-button"
              title="Fit to screen (F)"
            >
              Fit to Screen
            </button>
            <button
              @click="resetZoom"
              class="zoom-action-button"
              title="Reset zoom (Ctrl/Cmd + 0)"
            >
              Reset Zoom
            </button>
          </div>
        </div>
      </div>

      <!-- Zoom Out Button -->
      <button
        @click="zoomOut"
        :disabled="isZoomAtMin"
        class="zoom-button"
        title="Zoom Out (Ctrl/Cmd -)"
        :class="{ 'opacity-50 cursor-not-allowed': isZoomAtMin }"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
        </svg>
      </button>
    </div>

    <!-- Additional Controls (can be extended) -->
    <div class="additional-controls">
      <!-- Fit View Button -->
      <button
        @click="fitView"
        class="control-button"
        title="Fit to screen (F)"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
        </svg>
      </button>

      <!-- Center Canvas Button -->
      <button
        @click="centerCanvas"
        class="control-button"
        title="Center canvas"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasControls } from '@/composables/canvas/useCanvasControls'
import { onClickOutside } from '@vueuse/core'

// Use the canvas controls composable
const {
  // State
  showZoomDropdown,
  zoomPresets,
  currentZoomLevel,
  isZoomAtMin,
  isZoomAtMax,
  zoomPercentage,

  // Controls
  fitView,
  zoomIn,
  zoomOut,
  resetZoom,
  centerCanvas,
  applyZoomPreset,
  toggleZoomDropdown,
  closeZoomDropdown
} = useCanvasControls()

// Close zoom dropdown when clicking outside
const zoomDropdownRef = ref<HTMLElement | null>(null)
onClickOutside(zoomDropdownRef, () => {
  if (showZoomDropdown.value) {
    closeZoomDropdown()
  }
})

// Expose methods to parent component if needed
defineExpose({
  fitView,
  zoomIn,
  zoomOut,
  resetZoom,
  centerCanvas,
  applyZoomPreset,
  handleKeyboardShortcuts: useCanvasControls().handleKeyboardShortcuts
})
</script>

<style scoped>
.canvas-controls {
  @apply flex items-center gap-2 p-2 bg-glass-base/80 backdrop-blur-md border border-glass-border rounded-lg shadow-lg;
}

.zoom-controls {
  @apply flex items-center gap-1 relative;
}

.zoom-button {
  @apply p-2 rounded-md bg-glass-surface hover:bg-glass-hover border border-glass-border transition-all duration-200 flex items-center justify-center;
  @apply hover:scale-105 active:scale-95;
}

.zoom-display {
  @apply relative;
}

.zoom-level-button {
  @apply px-3 py-2 rounded-md bg-glass-surface hover:bg-glass-hover border border-glass-border transition-all duration-200 min-w-[80px] text-sm font-medium;
  @apply hover:scale-105 active:scale-95;
}

.zoom-dropdown {
  @apply z-50;
}

.zoom-presets {
  @apply p-1;
}

.zoom-preset-button {
  @apply w-full text-left px-3 py-2 rounded-md hover:bg-glass-hover transition-colors duration-150 text-sm;
  @apply flex items-center justify-between;
}

.zoom-preset-button:hover {
  @apply bg-primary/10;
}

.zoom-preset-button.bg-primary\/20 {
  @apply bg-primary/20 text-primary;
}

.zoom-divider {
  @apply my-1;
}

.zoom-actions {
  @apply p-1;
}

.zoom-action-button {
  @apply w-full text-left px-3 py-2 rounded-md hover:bg-glass-hover transition-colors duration-150 text-sm;
}

.control-button {
  @apply p-2 rounded-md bg-glass-surface hover:bg-glass-hover border border-glass-border transition-all duration-200 flex items-center justify-center;
  @apply hover:scale-105 active:scale-95;
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .canvas-controls {
    @apply bg-glass-base/90;
  }
}

/* Glass morphism enhancements */
.canvas-controls {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.zoom-button,
.zoom-level-button,
.control-button {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* Animation transitions */
.zoom-dropdown-enter-active,
.zoom-dropdown-leave-active {
  transition: all 0.2s ease;
}

.zoom-dropdown-enter-from,
.zoom-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Focus styles for accessibility */
.zoom-button:focus,
.zoom-level-button:focus,
.control-button:focus,
.zoom-preset-button:focus,
.zoom-action-button:focus {
  @apply ring-2 ring-primary ring-opacity-50 outline-none;
}

/* Disabled state styles */
.zoom-button:disabled {
  @apply opacity-50 cursor-not-allowed hover:scale-100 active:scale-100;
}
</style>