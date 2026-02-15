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
      console.log('[Updater] Not in Tauri environment, skipping update check')
      return false
    }

    console.log('[Updater] Checking for updates...')
    status.value = 'checking'
    error.value = null

    try {
      // Dynamic import to avoid errors in web mode
      const { check } = await import('@tauri-apps/plugin-updater')
      console.log('[Updater] Plugin loaded, calling check()')
      const update = await check()

      if (update) {
        console.log('[Updater] Update available:', {
          version: update.version,
          currentVersion: update.currentVersion,
          date: update.date,
          bodyLength: update.body?.length || 0
        })
        status.value = 'available'
        updateInfo.value = {
          version: update.version,
          currentVersion: update.currentVersion,
          body: update.body || null,
          date: update.date || null
        }
        return true
      } else {
        console.log('[Updater] App is up-to-date')
        status.value = 'up-to-date'
        return false
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error('[Updater] Check failed:', errorMsg)
      console.error('[Updater] Full error:', err)
      status.value = 'error'
      error.value = errorMsg
      return false
    }
  }

  /**
   * Download and install the available update
   */
  async function downloadAndInstall(): Promise<boolean> {
    if (!isTauri() || status.value !== 'available') {
      console.log('[Updater] Cannot download: not in Tauri or no update available')
      return false
    }

    console.log('[Updater] Starting download and install...')
    status.value = 'downloading'
    downloadProgress.value = 0

    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()

      if (!update) {
        console.error('[Updater] No update found during download phase')
        status.value = 'error'
        error.value = 'No update available'
        return false
      }

      console.log('[Updater] Downloading version:', update.version)

      // Download with progress tracking
      let downloaded = 0
      let totalSize = 0
      await update.downloadAndInstall((event: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => {
        switch (event.event) {
          case 'Started':
            totalSize = event.data?.contentLength || 0
            console.log('[Updater] Download started, size:', totalSize, 'bytes')
            downloadProgress.value = 0
            downloaded = 0
            break
          case 'Progress':
            downloaded += event.data?.chunkLength || 0
            if (totalSize > 0) {
              downloadProgress.value = Math.round((downloaded / totalSize) * 100)
              if (downloadProgress.value % 10 === 0) {
                console.log('[Updater] Progress:', downloadProgress.value + '%')
              }
            }
            break
          case 'Finished':
            console.log('[Updater] Download finished, installing...')
            downloadProgress.value = 100
            break
        }
      })

      console.log('[Updater] Update ready for restart')
      status.value = 'ready'
      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error('[Updater] Download/install failed:', errorMsg)
      console.error('[Updater] Full error:', err)

      // Provide more helpful error messages
      if (errorMsg.includes('invalid updater binary format')) {
        error.value = 'Update file format invalid. This can happen if:\n' +
          '1. The installed app has an outdated signing key\n' +
          '2. The update file was corrupted during download\n' +
          'Try reinstalling the latest version from the website.'
      } else if (errorMsg.includes('signature')) {
        error.value = 'Update signature verification failed. ' +
          'The installed app may have an outdated signing key.'
      } else {
        error.value = errorMsg
      }

      status.value = 'error'
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
