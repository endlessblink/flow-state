import { ref, onUnmounted } from 'vue'

/**
 * Composable for Screen Wake Lock API
 * Prevents screen from dimming/sleeping on mobile during active sessions (e.g. Timer)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
 */
export function useWakeLock() {
    const wakeLock = ref<WakeLockSentinel | null>(null)
    const isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator

    const requestWakeLock = async () => {
        if (!isSupported || wakeLock.value) return

        // BUG-1320: Guard against requesting wake lock when tab is hidden
        // Browser rejects WakeLock requests when document is not visible,
        // causing hundreds of DOMException spam from Realtime heartbeats
        if (document.visibilityState === 'hidden') return

        try {
            wakeLock.value = await navigator.wakeLock.request('screen')
            console.log('💡 [WakeLock] Screen wake lock is active')

            wakeLock.value.addEventListener('release', () => {
                console.log('💡 [WakeLock] Screen wake lock was released')
                wakeLock.value = null
            })
        } catch (err) {
            // Only warn once - this can happen during rapid visibility transitions
            console.debug('💡 [WakeLock] Wake lock request failed (tab may be hidden):', (err as Error).message)
        }
    }

    const releaseWakeLock = async () => {
        if (!wakeLock.value) return

        try {
            await wakeLock.value.release()
            wakeLock.value = null
        } catch (err) {
            console.error('⚠️ [WakeLock] Failed to release wake lock:', err)
        }
    }

    // Handle visibility change (re-request wake lock if tab becomes visible again)
    const handleVisibilityChange = async () => {
        if (wakeLock.value !== null && document.visibilityState === 'visible') {
            await requestWakeLock()
        }
    }

    if (typeof window !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    onUnmounted(() => {
        releaseWakeLock()
        if (typeof window !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    })

    return {
        isSupported,
        isActive: !!wakeLock.value,
        requestWakeLock,
        releaseWakeLock
    }
}
