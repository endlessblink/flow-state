/**
 * Tauri Updater Composable
 *
 * Provides auto-update functionality for the Tauri desktop app.
 * Uses GitHub releases as the update source.
 */

import { ref, computed } from 'vue'
import { isTauri } from './useTauriStartup'

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

export function useTauriUpdater() {
  const status = ref<UpdateStatus>('idle')
  const updateInfo = ref<UpdateInfo | null>(null)
  const error = ref<string | null>(null)
  const downloadProgress = ref<number>(0)

  const hasUpdate = computed(() => status.value === 'available' || status.value === 'ready')
  const isChecking = computed(() => status.value === 'checking')
  const isDownloading = computed(() => status.value === 'downloading')

  /**
   * Check for available updates
   */
  async function checkForUpdates(): Promise<boolean> {
    if (!isTauri()) {
      console.log('Not in Tauri environment, skipping update check')
      return false
    }

    status.value = 'checking'
    error.value = null

    try {
      // Dynamic import to avoid errors in web mode
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()

      if (update) {
        status.value = 'available'
        updateInfo.value = {
          version: update.version,
          currentVersion: update.currentVersion,
          body: update.body || null,
          date: update.date || null
        }
        return true
      } else {
        status.value = 'up-to-date'
        return false
      }
    } catch (err) {
      console.error('Failed to check for updates:', err)
      status.value = 'error'
      error.value = String(err)
      return false
    }
  }

  /**
   * Download and install the available update
   */
  async function downloadAndInstall(): Promise<boolean> {
    if (!isTauri() || status.value !== 'available') {
      return false
    }

    status.value = 'downloading'
    downloadProgress.value = 0

    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()

      if (!update) {
        status.value = 'error'
        error.value = 'No update available'
        return false
      }

      // Download with progress tracking
      let downloaded = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await update.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            downloadProgress.value = 0
            downloaded = 0
            break
          case 'Progress':
            if (event.data?.contentLength) {
              downloaded += event.data?.chunkLength || 0
              downloadProgress.value = Math.round(
                (downloaded / event.data.contentLength) * 100
              )
            }
            break
          case 'Finished':
            downloadProgress.value = 100
            break
        }
      })

      status.value = 'ready'
      return true
    } catch (err) {
      console.error('Failed to download update:', err)
      status.value = 'error'
      error.value = String(err)
      return false
    }
  }

  /**
   * Restart the app to apply the update
   */
  async function restart(): Promise<void> {
    if (!isTauri()) return

    try {
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (err) {
      console.error('Failed to restart:', err)
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
    restart
  }
}
