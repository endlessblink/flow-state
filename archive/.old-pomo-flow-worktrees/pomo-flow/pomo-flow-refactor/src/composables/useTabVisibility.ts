import { ref, readonly, onMounted, onUnmounted } from 'vue'

export function useTabVisibility() {
  const isVisible = ref(true)
  const isSupported = ref(false)

  // Check if Page Visibility API is supported
  const checkVisibilitySupport = (): boolean => {
    if (typeof document === 'undefined') return false

    isSupported.value = !!(
      document.hidden !== undefined ||
      document.visibilityState !== undefined ||
      ('webkitHidden' in document) ||
      ('mozHidden' in document) ||
      ('msHidden' in document)
    )

    return isSupported.value
  }

  // Get current visibility state
  const getVisibilityState = (): boolean => {
    if (!isSupported.value || typeof document === 'undefined') return true

    // Modern browsers
    if (document.visibilityState !== undefined) {
      return document.visibilityState === 'visible'
    }

    // Legacy browser support
    return !(
      (document as any).webkitHidden ||
      (document as any).mozHidden ||
      (document as any).msHidden ||
      document.hidden
    )
  }

  // Handle visibility change event
  const handleVisibilityChange = () => {
    const wasVisible = isVisible.value
    isVisible.value = getVisibilityState()

    console.log(`Tab visibility changed: ${wasVisible ? 'visible' : 'hidden'} → ${isVisible.value ? 'visible' : 'hidden'}`)
  }

  // Get the correct visibility change event name for current browser
  const getVisibilityEventName = (): string => {
    if (typeof document === 'undefined') return 'visibilitychange'

    // Check for vendor prefixes
    if ('hidden' in document) return 'visibilitychange'
    if ('webkitHidden' in document) return 'webkitvisibilitychange'
    if ('mozHidden' in document) return 'mozvisibilitychange'
    if ('msHidden' in document) return 'msvisibilitychange'

    return 'visibilitychange' // Fallback
  }

  // Add event listeners with vendor prefix support
  const addVisibilityListeners = () => {
    if (!isSupported.value || typeof document === 'undefined') return

    const eventName = getVisibilityEventName()
    document.addEventListener(eventName, handleVisibilityChange)

    // Also add fallback listeners for older browsers
    const fallbackEvents = ['visibilitychange', 'webkitvisibilitychange', 'mozvisibilitychange', 'msvisibilitychange']
    fallbackEvents.forEach(event => {
      if (event !== eventName) {
        document.addEventListener(event, handleVisibilityChange, { passive: true })
      }
    })

    console.log(`Added tab visibility listeners for: ${eventName}`)
  }

  // Remove event listeners
  const removeVisibilityListeners = () => {
    if (typeof document === 'undefined') return

    const events = ['visibilitychange', 'webkitvisibilitychange', 'mozvisibilitychange', 'msvisibilitychange']
    events.forEach(event => {
      document.removeEventListener(event, handleVisibilityChange)
    })
  }

  // Performance optimization callback
  const onVisibilityChange = (callback: (visible: boolean) => void) => {
    return {
      // Immediately call with current state
      current: () => callback(isVisible.value),
      // Setup listener for future changes
      listener: handleVisibilityChange
    }
  }

  // Initialize on mount
  const initialize = () => {
    if (!checkVisibilitySupport()) {
      console.log('Page Visibility API not supported - tab will always be considered visible')
      isVisible.value = true
      return
    }

    // Set initial state
    isVisible.value = getVisibilityState()
    console.log(`Initial tab visibility: ${isVisible.value ? 'visible' : 'hidden'}`)

    // Add listeners
    addVisibilityListeners()
  }

  // Setup on component mount
  onMounted(() => {
    initialize()
  })

  // Cleanup on component unmount
  onUnmounted(() => {
    removeVisibilityListeners()
  })

  return {
    isVisible: readonly(isVisible),
    isSupported: readonly(isSupported),
    getVisibilityState,
    onVisibilityChange
  }
}