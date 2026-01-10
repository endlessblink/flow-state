import { defineStore } from 'pinia'
import { ref, computed, reactive, onUnmounted } from 'vue'
import { useTaskStore } from './tasks'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabaseV2'
import { useSettingsStore } from './settings'
import { formatTime } from '@/utils/timer/formatTime'
import { getCrossTabSync } from '@/composables/useCrossTabSync'
import { useIntervalFn } from '@vueuse/core'

/**
 * Timer Session Interface
 */
export interface PomodoroSession {
  id: string
  taskId: string
  startTime: Date
  duration: number
  remainingTime: number
  isActive: boolean
  isPaused: boolean
  isBreak: boolean
  completedAt?: Date
}

export const useTimerStore = defineStore('timer', () => {
  // Initialize database composable
  const {
    fetchActiveTimerSession,
    saveActiveTimerSession,
    initRealtimeSubscription
  } = useSupabaseDatabase()

  const settingsStore = useSettingsStore()
  const taskStore = useTaskStore()

  // Constants for device synchronization
  const DEVICE_HEARTBEAT_INTERVAL_MS = 10000 // 10 seconds
  const DEVICE_LEADER_TIMEOUT_MS = 30000 // 30 seconds

  // Bridge to settingsStore for backward compatibility
  const settings = reactive({
    get workDuration() { return settingsStore.workDuration },
    set workDuration(val) { settingsStore.updateSetting('workDuration', val) },
    get shortBreakDuration() { return settingsStore.shortBreakDuration },
    set shortBreakDuration(val) { settingsStore.updateSetting('shortBreakDuration', val) },
    get longBreakDuration() { return settingsStore.longBreakDuration },
    set longBreakDuration(val) { settingsStore.updateSetting('longBreakDuration', val) },
    get autoStartBreaks() { return settingsStore.autoStartBreaks },
    set autoStartBreaks(val) { settingsStore.updateSetting('autoStartBreaks', val) },
    get autoStartPomodoros() { return settingsStore.autoStartPomodoros },
    set autoStartPomodoros(val) { settingsStore.updateSetting('autoStartPomodoros', val) },
    get playNotificationSounds() { return settingsStore.playNotificationSounds },
    set playNotificationSounds(val) { settingsStore.updateSetting('playNotificationSounds', val) }
  })

  // State
  const currentSession = ref<PomodoroSession | null>(null)
  const completedSessions = ref<PomodoroSession[]>([])
  const sessions = computed(() => completedSessions.value)
  const isLeader = ref(false)
  const isDeviceLeader = ref(false)
  const deviceId = crypto.randomUUID()

  // Cross-tab sync integration
  const crossTabSync = getCrossTabSync()

  // Intervals
  const { pause: pauseTimerInterval, resume: resumeTimerInterval } = useIntervalFn(() => {
    if (currentSession.value && currentSession.value.isActive && !currentSession.value.isPaused) {
      currentSession.value.remainingTime -= 1
      if (currentSession.value.remainingTime % 5 === 0 && isDeviceLeader.value) broadcastSession()
      if (currentSession.value.remainingTime <= 0) completeSession()
    }
  }, 1000, { immediate: false })

  const { pause: pauseHeartbeat, resume: resumeHeartbeat } = useIntervalFn(async () => {
    if (!currentSession.value || !isDeviceLeader.value) { pauseHeartbeat(); return }
    await saveTimerSessionWithLeadership()
  }, DEVICE_HEARTBEAT_INTERVAL_MS, { immediate: false })

  // Computed
  const isTimerActive = computed(() => currentSession.value?.isActive || false)
  const isPaused = computed(() => currentSession.value?.isPaused || false)
  const currentTaskId = computed(() => currentSession.value?.taskId || null)

  const displayTime = computed(() => {
    if (!currentSession.value) {
      return formatTime(settings.workDuration)
    }
    return formatTime(currentSession.value.remainingTime)
  })

  const currentTaskName = computed(() => {
    const session = currentSession.value
    if (!session?.taskId) return null
    if (session.isBreak) return session.taskId === 'break' ? 'Break Time' : 'Short Break'
    if (session.taskId === 'general') return 'Focus Session'
    const task = taskStore.tasks.find(t => t.id === session.taskId)
    return task?.title || 'Unknown Task'
  })

  const sessionTypeIcon = computed(() => currentSession.value?.isBreak ? '🧎' : '🍅')

  const tabDisplayTime = computed(() => {
    if (!currentSession.value) return ''
    return formatTime(currentSession.value.remainingTime)
  })

  const sessionStatusText = computed(() => {
    const session = currentSession.value
    if (!session) return ''
    if (session.isBreak) return session.taskId === 'break' ? 'Short Break' : 'Long Break'
    if (session.taskId === 'general') return 'Focus Session'
    const task = taskStore.tasks.find(t => t.id === session.taskId)
    return task?.title || 'Work Session'
  })

  const timerPercentage = computed(() => {
    if (!currentSession.value) return 0
    const totalDuration = currentSession.value.duration
    const remainingTime = currentSession.value.remainingTime
    return Math.round(((totalDuration - remainingTime) / totalDuration) * 100)
  })

  const faviconStatus = computed(() => {
    if (!currentSession.value) return 'inactive'
    return currentSession.value.isBreak ? 'break' : 'work'
  })

  const tabTitleWithTimer = computed(() => {
    const baseTitle = 'Pomo-Flow'
    if (!currentSession.value || !isTimerActive.value) return baseTitle
    const time = tabDisplayTime.value
    const icon = currentSession.value.isBreak ? '🧎' : '🍅'
    return `${icon} ${time} | ${baseTitle}`
  })

  // Leadership Helpers
  const broadcastSession = () => {
    if (currentSession.value) {
      crossTabSync.broadcastTimerSession(currentSession.value)
    }
  }

  const handleRemoteTimerUpdate = (newDoc: any) => {
    if (!newDoc) {
      currentSession.value = null
      pauseTimerInterval()
      return
    }

    if (isDeviceLeader.value && newDoc.device_leader_id === deviceId) return

    const lastSeen = new Date(newDoc.device_leader_last_seen).getTime()
    if (Date.now() - lastSeen < DEVICE_LEADER_TIMEOUT_MS) {
      isDeviceLeader.value = false
      pauseHeartbeat()

      const session = {
        id: newDoc.id,
        taskId: newDoc.task_id,
        startTime: new Date(newDoc.start_time),
        duration: newDoc.duration,
        remainingTime: newDoc.remaining_time,
        isActive: newDoc.is_active,
        isPaused: newDoc.is_paused,
        isBreak: newDoc.is_break,
        completedAt: newDoc.completed_at ? new Date(newDoc.completed_at) : undefined,
        deviceLeaderId: newDoc.device_leader_id,
        deviceLeaderLastSeen: lastSeen
      }

      // Calculate adjusted remaining time based on drift
      const now = Date.now()
      const drift = Math.floor((now - lastSeen) / 1000)
      if (session.isActive && !session.isPaused) {
        session.remainingTime = Math.max(0, session.remainingTime - drift)
      }

      currentSession.value = session as PomodoroSession
      if (session.isActive && !session.isPaused) {
        resumeTimerInterval()
      } else {
        pauseTimerInterval()
      }
    }
  }

  const saveTimerSessionWithLeadership = async () => {
    if (!currentSession.value) return
    if (currentSession.value.id.length < 10) {
      currentSession.value.id = crypto.randomUUID()
    }
    await saveActiveTimerSession(currentSession.value, deviceId)
  }

  const checkForActiveDeviceLeader = async (): Promise<boolean> => {
    try {
      const existing = await fetchActiveTimerSession()
      if (existing?.deviceLeaderId && existing.deviceLeaderId !== deviceId) {
        if (Date.now() - (existing.deviceLeaderLastSeen || 0) < DEVICE_LEADER_TIMEOUT_MS) return true
      }
      return false
    } catch (_e) { return false }
  }

  // Timer Control Actions
  const startTimer = async (taskId: string, duration?: number, isBreak: boolean = false) => {
    if (await checkForActiveDeviceLeader()) return

    if (!crossTabSync.claimTimerLeadership()) return
    isLeader.value = true

    const sessionDuration = duration || settings.workDuration
    currentSession.value = {
      id: crypto.randomUUID(),
      taskId,
      startTime: new Date(),
      duration: sessionDuration,
      remainingTime: sessionDuration,
      isActive: true,
      isPaused: false,
      isBreak
    }

    isDeviceLeader.value = true
    resumeHeartbeat()
    broadcastSession()
    await saveTimerSessionWithLeadership()
    playStartSound()
    resumeTimerInterval()
  }

  const pauseTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = true
      pauseTimerInterval()
      broadcastSession()
    }
  }

  const resumeTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = false
      resumeTimerInterval()
      broadcastSession()
    }
  }

  const stopTimer = async () => {
    pauseTimerInterval()
    pauseHeartbeat()
    isDeviceLeader.value = false
    if (currentSession.value) {
      completedSessions.value.push({ ...currentSession.value, isActive: false, completedAt: new Date() })
      currentSession.value = null
      broadcastSession()
    }
  }

  const completeSession = async () => {
    const session = currentSession.value
    if (!session) return
    pauseTimerInterval()
    pauseHeartbeat()

    const completedSession = { ...session, isActive: false, completedAt: new Date() }
    completedSessions.value.push(completedSession)

    const wasBreak = session.isBreak
    const lastTaskId = session.taskId

    if (session.taskId && session.taskId !== 'general' && !session.isBreak) {
      const task = taskStore.tasks.find(t => t.id === session.taskId)
      if (task) {
        const newCount = (task.completedPomodoros || 0) + 1
        taskStore.updateTask(session.taskId, {
          completedPomodoros: newCount,
          progress: Math.min(100, Math.round((newCount / (task.estimatedPomodoros || 1)) * 100))
        })
      }
    }

    currentSession.value = null
    broadcastSession()
    playEndSound()

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Session Complete! 🍅`, {
        body: wasBreak ? 'Ready to work?' : 'Time for a break!',
        icon: '/favicon.ico'
      })
    }

    if (settings.autoStartBreaks && !wasBreak) {
      isDeviceLeader.value = false
      setTimeout(() => startTimer('break', settings.shortBreakDuration, true), 2000)
    } else if (settings.autoStartPomodoros && wasBreak && lastTaskId !== 'break') {
      isDeviceLeader.value = false
      setTimeout(() => startTimer(lastTaskId, settings.workDuration, false), 2000)
    } else {
      isDeviceLeader.value = false
    }
  }

  const playStartSound = () => {
    if (!settings.playNotificationSounds) return
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.connect(gain); gain.connect(audioContext.destination)
      osc.frequency.setValueAtTime(523, audioContext.currentTime)
      osc.frequency.setValueAtTime(659, audioContext.currentTime + 0.1)
      gain.gain.setValueAtTime(0.1, audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      osc.start(); osc.stop(audioContext.currentTime + 0.3)
    } catch (_e) { }
  }

  const playEndSound = () => {
    if (!settings.playNotificationSounds) return
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.connect(gain); gain.connect(audioContext.destination)
      osc.frequency.setValueAtTime(783, audioContext.currentTime)
      osc.frequency.setValueAtTime(523, audioContext.currentTime + 0.3)
      gain.gain.setValueAtTime(0.1, audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6)
      osc.start(); osc.stop(audioContext.currentTime + 0.6)
    } catch (_e) { }
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    return Notification.permission === 'granted'
  }

  const initializeStore = async () => {
    const saved = await fetchActiveTimerSession()
    if (saved && saved.isActive) {
      currentSession.value = { ...saved, startTime: new Date(saved.startTime) }
      if (saved.deviceLeaderId === deviceId) {
        isDeviceLeader.value = true
        resumeHeartbeat()
        resumeTimerInterval()
      } else {
        isDeviceLeader.value = false
        // Followers should also update their local countdown
        resumeTimerInterval()
      }
    }

    // Set cross-tab callbacks
    crossTabSync.setTimerCallbacks({
      onSessionUpdate: (session: any) => {
        if (!isDeviceLeader.value) {
          currentSession.value = session
          if (session?.isActive && !session?.isPaused) {
            resumeTimerInterval()
          } else {
            pauseTimerInterval()
          }
        }
      },
      onBecomeLeader: () => {
        isLeader.value = true
        isDeviceLeader.value = true
        resumeHeartbeat()
      },
      onLoseLeadership: () => {
        isLeader.value = false
        isDeviceLeader.value = false
        pauseHeartbeat()
      }
    })

    initRealtimeSubscription(() => { }, () => { }, handleRemoteTimerUpdate)
  }

  // Cleanup
  onUnmounted(() => {
    pauseTimerInterval()
    pauseHeartbeat()
  })

  initializeStore()

  return {
    currentSession, completedSessions, sessions, settings,
    isLeader, isDeviceLeader,
    isTimerActive, isPaused, currentTaskId, displayTime, currentTaskName,
    sessionTypeIcon, tabDisplayTime, sessionStatusText,
    timerPercentage, faviconStatus, tabTitleWithTimer,
    startTimer, pauseTimer, resumeTimer, stopTimer, completeSession,
    requestNotificationPermission, playStartSound, playEndSound
  }
}, {
  share: { enable: false }
})