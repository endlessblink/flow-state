/**
 * Electron Updater Composable
 *
 * Provides auto-update functionality for the Electron desktop app.
 * Uses electron-updater with generic provider pointing to VPS.
 * Electron auto-updater state for settings surfaces.
 */

import { ref, computed, onMounted } from 'vue'
import { isElectron } from '@/utils/platform'

export interface UpdateInfo {
  version: string
  currentVersion: string
  body: string | null
  date: string | null
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'up-to-date'

// Access electronAPI safely without global type augmentation
function getElectronAPI(): any | null {
  return (window as any).electronAPI ?? null
}

export function useElectronUpdater() {
  const status = ref<UpdateStatus>('idle')
  const updateInfo = ref<UpdateInfo | null>(null)
  const error = ref<string | null>(null)
  const downloadProgress = ref<number>(0)

  const hasUpdate = computed(() => status.value === 'available' || status.value === 'ready')
  const isChecking = computed(() => status.value === 'checking')
  const isDownloading = computed(() => status.value === 'downloading')

  // Listen for IPC events from main process
  function setupListeners() {
    const api = getElectronAPI()
    if (!isElectron() || !api) return

    api.onUpdateAvailable((info: any) => {
      console.log('[ElectronUpdater] Update available:', info)
      status.value = 'available'
      updateInfo.value = {
        version: info?.version || 'unknown',
        currentVersion: (window as any).__APP_VERSION__ || 'unknown',
        body: info?.releaseNotes || info?.releaseName || null,
        date: info?.releaseDate || null,
      }
    })

    api.onUpdateDownloadProgress((progress: any) => {
      status.value = 'downloading'
      downloadProgress.value = Math.round(progress?.percent || 0)
    })

    api.onUpdateDownloaded(() => {
      console.log('[ElectronUpdater] Update downloaded, ready to install')
      status.value = 'ready'
      downloadProgress.value = 100
    })
  }

  onMounted(setupListeners)

  async function checkForUpdates(): Promise<boolean> {
    const api = getElectronAPI()
    if (!isElectron() || !api) {
      console.log('[ElectronUpdater] Not in Electron environment')
      return false
    }

    status.value = 'checking'
    error.value = null

    try {
      await api.checkForUpdates()
      // If no update-available event fires, we're up to date
      // Give the IPC event a moment to arrive
      await new Promise(resolve => setTimeout(resolve, 2000))
      if (status.value as string === 'checking') {
        status.value = 'up-to-date'
      }
      return (status.value as string) === 'available'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ElectronUpdater] Check failed:', msg)
      status.value = 'error'
      error.value = msg
      return false
    }
  }

  async function downloadAndInstall(): Promise<boolean> {
    const api = getElectronAPI()
    if (!isElectron() || !api || status.value !== 'available') {
      return false
    }

    status.value = 'downloading'
    downloadProgress.value = 0

    try {
      await api.downloadUpdate()
      // Status will be set to 'ready' by the onUpdateDownloaded listener
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ElectronUpdater] Download failed:', msg)
      status.value = 'error'
      error.value = msg
      return false
    }
  }

  async function restart(): Promise<void> {
    const api = getElectronAPI()
    if (!isElectron() || !api) return

    try {
      await api.installUpdate()
    } catch (err) {
      console.error('[ElectronUpdater] Install failed:', err)
      error.value = String(err)
    }
  }

  return {
    status,
    updateInfo,
    error,
    downloadProgress,
    hasUpdate,
    isChecking,
    isDownloading,

    checkForUpdates,
    downloadAndInstall,
    restart,
  }
}
