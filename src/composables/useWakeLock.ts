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

        try {
            wakeLock.value = await navigator.wakeLock.request('screen')
            console.log('💡 [WakeLock] Screen wake lock is active')

            wakeLock.value.addEventListener('release', () => {
                console.log('💡 [WakeLock] Screen wake lock was released')
                wakeLock.value = null
            })
        } catch (err) {
            console.error('⚠️ [WakeLock] Failed to request wake lock:', err)
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
