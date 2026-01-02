
import { ref, type Ref } from 'vue'

export class NetworkMonitorService {
    private isOnline: Ref<boolean>
    private listeners: { online: () => void; offline: () => void } | null = null

    constructor() {
        this.isOnline = ref(navigator.onLine)
    }

    public getStatus(): Ref<boolean> {
        return this.isOnline
    }

    public setupListeners(
        onOnline?: () => void,
        onOffline?: () => void
    ) {
        if (this.listeners) {
            this.cleanup()
        }

        const handleOnline = () => {
            console.log('🌐 [NetworkMonitor] App is ONLINE')
            this.isOnline.value = true
            onOnline?.()
        }

        const handleOffline = () => {
            console.warn('🔌 [NetworkMonitor] App is OFFLINE')
            this.isOnline.value = false
            onOffline?.()
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        this.listeners = { online: handleOnline, offline: handleOffline }

        // Initial check
        this.isOnline.value = navigator.onLine
    }

    public cleanup() {
        if (this.listeners) {
            window.removeEventListener('online', this.listeners.online)
            window.removeEventListener('offline', this.listeners.offline)
            this.listeners = null
        }
    }
}

// Singleton instance
export const networkMonitor = new NetworkMonitorService()
