/**
 * BUG-1874: Auth-token storage adapter for the Supabase client.
 *
 * Resolves its backend at CALL TIME, not at module-eval. The earlier design froze the
 * Electron-vs-web choice when the auth module was first imported; if the preload contextBridge
 * hadn't injected `window.electronAPI` yet, every auth read/write went to volatile `localStorage`
 * for the whole session and the token was lost on the next launch. Checking the bridge per call
 * (a cheap property read) means the session always lands in the durable IPC store once the bridge
 * is present, and a detection flip between runs can't strand the token.
 *
 * Supabase auth-js supports async storage — getItem/setItem/removeItem may return Promises.
 */

interface ElectronStoreBridge {
    isElectron?: boolean
    storeGet: (key: string) => Promise<unknown>
    storeSet: (key: string, value: unknown) => Promise<void>
}

export interface AsyncAuthStorage {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<void>
    removeItem(key: string): Promise<void>
}

function electronBridge(): ElectronStoreBridge | null {
    if (typeof window === 'undefined') return null
    const api = (window as unknown as { electronAPI?: ElectronStoreBridge }).electronAPI
    return api?.isElectron ? api : null
}

/**
 * Returns the lazy auth storage adapter, or null when there is no `window` (SSR/tests without DOM).
 */
export function createLazyAuthStorage(): AsyncAuthStorage | null {
    if (typeof window === 'undefined') return null
    return {
        getItem: async (key: string): Promise<string | null> => {
            const api = electronBridge()
            if (api) {
                const value = await api.storeGet(key)
                return typeof value === 'string' ? value : null
            }
            return window.localStorage.getItem(key)
        },
        setItem: async (key: string, value: string): Promise<void> => {
            const api = electronBridge()
            if (api) {
                await api.storeSet(key, value)
                return
            }
            window.localStorage.setItem(key, value)
        },
        // removeItem on Electron stores null (storeSet(key, null)); getItem's `typeof === 'string'`
        // guard then returns null for the absent key.
        removeItem: async (key: string): Promise<void> => {
            const api = electronBridge()
            if (api) {
                await api.storeSet(key, null)
                return
            }
            window.localStorage.removeItem(key)
        },
    }
}
