import { ref } from 'vue'

export function useRegisterSW(options: any = {}) {
    const needRefresh = ref(false)
    const offlineReady = ref(false)

    const updateServiceWorker = async (reloadPage = true) => {
        // Mock implementation
        return Promise.resolve()
    }

    return {
        needRefresh,
        offlineReady,
        updateServiceWorker
    }
}
