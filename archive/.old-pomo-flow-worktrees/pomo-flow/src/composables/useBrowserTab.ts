import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'

export function useBrowserTab() {
  const timerStore = useTimerStore()
  const isSupported = ref(true)
  const originalTitle = ref('')

  // Check if browser tab APIs are supported
  const checkBrowserSupport = () => {
    if (typeof document === 'undefined') {
      isSupported.value = false
      return false
    }

    isSupported.value = true
    return true
  }

  // Update browser tab title
  const updateTabTitle = (title: string) => {
    if (!isSupported.value || typeof document === 'undefined') return

    try {
      document.title = title
    } catch (error) {
      console.warn('Failed to update tab title:', error)
    }
  }

  // Update favicon
  const updateFavicon = (href: string) => {
    if (!isSupported.value || typeof document === 'undefined') return

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

  // Generate data URL for canvas favicon
  const generateFaviconDataUrl = (canvas: HTMLCanvasElement): string => {
    try {
      return canvas.toDataURL('image/x-icon')
    } catch (error) {
      console.warn('Failed to generate favicon data URL:', error)
      return '/favicon.ico'
    }
  }

  // Create favicon with timer progress
  const createTimerFavicon = (percentage: number, status: 'work' | 'break' | 'inactive'): string => {
    if (typeof document === 'undefined') return '/favicon.ico'

    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')

    if (!ctx) return '/favicon.ico'

    // Clear canvas
    ctx.clearRect(0, 0, 32, 32)

    // Draw progress ring
    if (status !== 'inactive') {
      const centerX = 16
      const centerY = 16
      const radius = 14
      const startAngle = -Math.PI / 2
      const endAngle = startAngle + (2 * Math.PI * percentage / 100)

      // Progress ring background
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.strokeStyle = status === 'work' ? '#fee2e2' : '#dcfce7'
      ctx.lineWidth = 3
      ctx.stroke()

      // Progress ring fill
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.strokeStyle = status === 'work' ? '#ef4444' : '#22c55e'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // Draw icon
    ctx.font = '16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(status === 'work' ? '🍅' : status === 'break' ? '🧎' : '🍅', 16, 16)

    return generateFaviconDataUrl(canvas)
  }

  // Initialize browser tab management
  const initialize = () => {
    if (!checkBrowserSupport()) return

    // Store original title
    if (typeof document !== 'undefined') {
      originalTitle.value = document.title
    }
  }

  // Handle timer updates
  const handleTimerUpdate = () => {
    if (!isSupported.value) return

    // Update tab title
    const newTitle = timerStore.tabTitleWithTimer
    updateTabTitle(newTitle)

    // Debug logging
    console.log('🍅 Browser Tab Update:', {
      title: newTitle,
      percentage: timerStore.timerPercentage,
      status: timerStore.faviconStatus,
      isActive: timerStore.isTimerActive
    })

    // Update favicon with progress
    const favicon = createTimerFavicon(
      timerStore.timerPercentage,
      timerStore.faviconStatus
    )
    updateFavicon(favicon)
  }

  // Restore original tab state
  const restoreTabState = () => {
    if (!isSupported.value) return

    updateTabTitle(originalTitle.value || 'Pomo-Flow')
    updateFavicon('/favicon.ico')
  }

  // Watch for timer changes
  const stopWatcher = watch(
    () => [
      timerStore.tabTitleWithTimer,
      timerStore.timerPercentage,
      timerStore.faviconStatus
    ],
    handleTimerUpdate,
    { immediate: true }
  )

  // Setup on mount
  onMounted(() => {
    initialize()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    restoreTabState()
    stopWatcher?.()
  })

  return {
    isSupported,
    originalTitle,
    updateTabTitle,
    updateFavicon,
    createTimerFavicon,
    restoreTabState
  }
}