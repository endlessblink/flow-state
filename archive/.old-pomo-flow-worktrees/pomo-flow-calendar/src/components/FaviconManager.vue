<template>
  <div class="favicon-manager" style="display: none;">
    <!-- Hidden canvas for favicon generation -->
    <canvas
      ref="faviconCanvas"
      :width="canvasSize"
      :height="canvasSize"
      style="display: none;"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTabVisibility } from '@/composables/useTabVisibility'

interface FaviconConfig {
  size: number
  backgroundColor: string
  workColor: string
  breakColor: string
  inactiveColor: string
  lineWidth: number
  iconSize: number
}

const props = withDefaults(defineProps<{
  config?: Partial<FaviconConfig>
}>(), {
  config: () => ({})
})

const timerStore = useTimerStore()
const { isVisible } = useTabVisibility()

// Canvas ref
const faviconCanvas = ref<HTMLCanvasElement>()

// Default configuration
const defaultConfig: FaviconConfig = {
  size: 32,
  backgroundColor: 'transparent',
  workColor: '#ef4444', // red-500
  breakColor: '#22c55e', // green-500
  inactiveColor: '#6b7280', // gray-500
  lineWidth: 3,
  iconSize: 16
}

// Merge default config with props
const config = computed<FaviconConfig>(() => ({
  ...defaultConfig,
  ...props.config
}))

const canvasSize = computed(() => config.value.size)

// Draw progress ring
const drawProgressRing = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  percentage: number,
  color: string
) => {
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + (2 * Math.PI * percentage / 100)

  // Background ring
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
  ctx.strokeStyle = color + '20' // Add transparency for background
  ctx.lineWidth = config.value.lineWidth
  ctx.stroke()

  // Progress ring
  if (percentage > 0) {
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, startAngle, endAngle)
    ctx.strokeStyle = color
    ctx.lineWidth = config.value.lineWidth
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

// Draw icon (emoji or text)
const drawIcon = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  icon: string
) => {
  ctx.font = `${config.value.iconSize}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(icon, centerX, centerY)
}

// Generate favicon with timer status
const generateFavicon = (percentage: number, status: 'work' | 'break' | 'inactive'): string => {
  if (!faviconCanvas.value) return '/favicon.ico'

  const ctx = faviconCanvas.value.getContext('2d')
  if (!ctx) return '/favicon.ico'

  const { size, workColor, breakColor, inactiveColor, backgroundColor } = config.value
  const centerX = size / 2
  const centerY = size / 2
  const radius = (size / 2) - 4

  // Clear canvas
  ctx.clearRect(0, 0, size, size)

  // Set background
  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, size, size)
  }

  // Draw progress ring if timer is active
  if (status !== 'inactive') {
    const color = status === 'work' ? workColor : breakColor
    drawProgressRing(ctx, centerX, centerY, radius, percentage, color)
  }

  // Draw icon
  const icon = status === 'work' ? '🍅' : status === 'break' ? '🧎' : '🍅'
  drawIcon(ctx, centerX, centerY, icon)

  // Convert to data URL
  try {
    return faviconCanvas.value.toDataURL('image/x-icon')
  } catch (error) {
    console.warn('Failed to generate favicon data URL:', error)
    return '/favicon.ico'
  }
}

// Update browser favicon
const updateFavicon = (href: string) => {
  if (typeof document === 'undefined') return

  try {
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
    if (!favicon) {
      favicon = document.createElement('link')
      favicon.rel = 'icon'
      document.head.appendChild(favicon)
    }
    favicon.href = href
  } catch (error) {
    console.warn('Failed to update favicon:', error)
  }
}

// Handle timer updates
const handleTimerUpdate = () => {
  // Only update favicon if tab is visible (performance optimization)
  if (!isVisible.value) return

  const favicon = generateFavicon(
    timerStore.timerPercentage,
    timerStore.faviconStatus
  )
  updateFavicon(favicon)
}

// Watch for timer changes
const stopTimerWatcher = watch(
  () => [
    timerStore.timerPercentage,
    timerStore.faviconStatus
  ],
  handleTimerUpdate,
  { immediate: true }
)

// Watch for tab visibility changes
const stopVisibilityWatcher = watch(isVisible, (visible) => {
  if (visible) {
    // Tab became visible - update favicon immediately
    handleTimerUpdate()
  }
  // When tab becomes hidden, we don't update favicon (performance optimization)
})

// Fallback for browsers that don't support visibility API
let fallbackInterval: NodeJS.Timeout | null = null

const setupFallbackUpdate = () => {
  // Only set up fallback if visibility API is not supported
  if (typeof document !== 'undefined' && 'hidden' in document) return

  // Update favicon every 5 seconds when timer is active
  fallbackInterval = setInterval(() => {
    if (timerStore.isTimerActive) {
      handleTimerUpdate()
    }
  }, 5000)
}

const cleanupFallbackUpdate = () => {
  if (fallbackInterval) {
    clearInterval(fallbackInterval)
    fallbackInterval = null
  }
}

// Initialize
onMounted(() => {
  setupFallbackUpdate()
  handleTimerUpdate() // Initial update
})

onUnmounted(() => {
  stopTimerWatcher?.()
  stopVisibilityWatcher?.()
  cleanupFallbackUpdate()

  // Restore original favicon
  updateFavicon('/favicon.ico')
})

// Expose methods for external use
defineExpose({
  generateFavicon,
  updateFavicon,
  handleTimerUpdate
})
</script>

<style scoped>
.favicon-manager {
  /* Component is intentionally hidden - used only for canvas operations */
}
</style>