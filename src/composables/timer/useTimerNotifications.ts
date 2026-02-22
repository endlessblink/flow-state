/**
 * useTimerNotifications — Browser notifications + Service Worker handlers
 * Extracted from src/stores/timer.ts (TASK-1406)
 */
import { isTauri } from '@/composables/useTauriStartup'

export interface TimerNotificationsDeps {
  startTimer: (taskId: string, duration: number, isBreak: boolean) => Promise<void>
  getSettings: () => { shortBreakDuration: number; workDuration: number }
  findTaskTitle: (taskId: string) => string | undefined
}

export function useTimerNotifications(deps: TimerNotificationsDeps) {
  // TASK-1009: Handle messages from Service Worker (notification action clicks)
  // BUG-1178: Enhanced with detailed logging to debug message delivery issues
  const handleServiceWorkerMessage = (event: MessageEvent) => {
    const data = event.data
    if (!data || !data.type) return

    switch (data.type) {
      case 'START_BREAK':
        // Start a break session
        deps.startTimer('break', deps.getSettings().shortBreakDuration, true)
        break

      case 'START_WORK': {
        // Start a work session (continue with the same task if available)
        const taskId = data.taskId && data.taskId !== 'break' ? data.taskId : 'general'
        deps.startTimer(taskId, deps.getSettings().workDuration, false)
        break
      }

      case 'POSTPONE_5MIN': {
        // Add 5 minutes and restart timer
        // Create a new session with 5 minutes
        const postponeTaskId = data.taskId || 'general'
        const isBreak = postponeTaskId === 'break'
        deps.startTimer(postponeTaskId, 5 * 60, isBreak) // 5 minutes
        break
      }
    }
  }

  // TASK-1009: Service Worker Notification with Action Buttons
  // BUG-1112: Enhanced to always show notification and log issues
  const showTimerNotification = async (sessionId: string, wasBreak: boolean, taskId: string, kdeActive: boolean = false) => {
    // Get task name for notification body
    let taskName: string | undefined
    if (taskId && taskId !== 'general' && taskId !== 'break') {
      taskName = deps.findTaskTitle(taskId)
    }

    const notificationBody = wasBreak
      ? (taskName ? `Break finished! Ready to work on "${taskName}"?` : 'Break finished! Ready to work?')
      : (taskName ? `Great work on "${taskName}"! Time for a break.` : 'Great work! Time for a break.')

    // BUG-1112: Only show notification when KDE widget is NOT active
    if (isTauri() && kdeActive) {
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] KDE widget is active, skipping notification (widget handles it)')
      }
      return
    }

    // BUG-1318: Try Service Worker notification FIRST (has action buttons: Start Break, +5 min)
    // This works in both browser AND Tauri webview (WebKitGTK supports SW)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'TIMER_COMPLETE',
        sessionId,
        wasBreak,
        taskId,
        taskName
      })
      if (import.meta.env.DEV) {
        console.log('🍅 [TIMER] Sent TIMER_COMPLETE to service worker (has action buttons)')
      }
      return
    }

    // BUG-1318: Fallback to basic Notification API (no action buttons, but has dedup tag)
    // BUG-1112: Log when SW is not available (common in dev mode)
    console.log('🍅 [TIMER] Service Worker not available, using fallback notification')

    if (!('Notification' in window)) {
      console.warn('🍅 [TIMER] Notifications not supported in this browser')
      return
    }

    if (Notification.permission === 'granted') {
      new Notification('Session Complete! 🍅', {
        body: notificationBody,
        icon: '/favicon.ico',
        tag: `timer-complete-${sessionId}`,
        requireInteraction: true,
        silent: false
      })
      console.log('🍅 [TIMER] Showed fallback notification with dedup tag')
    } else if (Notification.permission === 'default') {
      console.log('🍅 [TIMER] Notification permission not granted, requesting...')
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        new Notification('Session Complete! 🍅', {
          body: notificationBody,
          icon: '/favicon.ico',
          tag: `timer-complete-${sessionId}`,
          requireInteraction: true,
          silent: false
        })
      }
    } else {
      console.warn('🍅 [TIMER] Notification permission denied by user')
    }
  }

  const requestNotificationPermission = async () => {
    // BUG-1303: Skip browser Notification.requestPermission() in Tauri — WebKitGTK
    // can hang indefinitely on this call. Tauri uses its own notification plugin.
    const isTauriRuntime = typeof window !== 'undefined' && '__TAURI__' in window
    if (!isTauriRuntime && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    return !isTauriRuntime && 'Notification' in window && Notification.permission === 'granted'
  }

  // BUG-1178: Setup Service Worker message listener with proper initialization
  // Previous code registered listener before SW was ready, causing messages to be missed
  const setupServiceWorkerListener = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('🍅 [TIMER] Service Worker not available')
      return
    }

    try {
      // Wait for SW to be ready (guarantees controller is available)
      const registration = await navigator.serviceWorker.ready
      console.log('🍅 [TIMER] SW ready, registering message listener', {
        scope: registration.scope,
        active: !!registration.active
      })

      // Register the message listener
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
      console.log('🍅 [TIMER] SW message listener registered successfully')
    } catch (err) {
      console.error('🍅 [TIMER] Failed to setup SW listener:', err)
    }
  }

  const cleanupServiceWorkerListener = () => {
    // TASK-1009: Remove SW message listener
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
    }
  }

  return {
    showTimerNotification,
    requestNotificationPermission,
    setupServiceWorkerListener,
    cleanupServiceWorkerListener
  }
}
