import { defineStore } from 'pinia'
import { ref, computed, watch, reactive } from 'vue'
import { useTaskStore } from './tasks'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabaseV2'
import { useSettingsStore } from './settings'

// Cross-tab sync imports - for timer synchronization across browser tabs
import {
  useCrossTabSync,
  type TimerSessionSync as _TimerSessionSync
} from '@/composables/useCrossTabSync'

export interface PomodoroSession {
  id: string
  taskId: string
  startTime: Date
  duration: number // in seconds
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
  const sessions = ref<PomodoroSession[]>([])
  const timerInterval = ref<NodeJS.Timeout | null>(null)

  // Cross-tab sync state
  let crossTabSync: ReturnType<typeof useCrossTabSync> | null = null
  const isLeader = ref(false)
  let crossTabInitialized = false

  const getDeviceId = (): string => {
    if (typeof window === 'undefined') return 'server'
    const stored = localStorage.getItem('pomoflow-device-id')
    if (stored) return stored
    const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('pomoflow-device-id', newId)
    return newId
  }

  const deviceId = getDeviceId()
  const isDeviceLeader = ref(false)
  let deviceHeartbeatInterval: ReturnType<typeof setInterval> | null = null
  let lastLeaderTimestamp = 0

  // Computed
  const isTimerActive = computed(() => currentSession.value?.isActive && !currentSession.value?.isPaused)
  const isPaused = computed(() => currentSession.value?.isPaused || false)
  const currentTaskId = computed(() => currentSession.value?.taskId || null)

  const displayTime = computed(() => {
    if (!currentSession.value) {
      const minutes = Math.floor(settings.workDuration / 60)
      return `${minutes.toString().padStart(2, '0')}:00`
    }
    const minutes = Math.floor(currentSession.value.remainingTime / 60)
    const seconds = currentSession.value.remainingTime % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const currentTaskName = computed(() => {
    const session = currentSession.value
    if (!session?.taskId) return null
    if (session.isBreak) return session.taskId === 'break' ? 'Break Time' : 'Short Break'
    if (session.taskId === 'general') return 'Focus Session'
    const taskStore = useTaskStore()
    const task = taskStore.tasks.find(t => t.id === session.taskId)
    return task?.title || 'Unknown Task'
  })

  const sessionTypeIcon = computed(() => currentSession.value?.isBreak ? '🧎' : '🍅')

  const tabDisplayTime = computed(() => {
    if (!currentSession.value) return ''
    const minutes = Math.floor(currentSession.value.remainingTime / 60)
    const seconds = currentSession.value.remainingTime % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const sessionStatusText = computed(() => {
    const session = currentSession.value
    if (!session) return ''
    if (session.isBreak) return session.taskId === 'break' ? 'Short Break' : 'Long Break'
    if (session.taskId === 'general') return 'Focus Session'
    const taskStore = useTaskStore()
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
    const status = sessionStatusText.value
    return `${status} - ${time} ${icon} | ${baseTitle}`
  })

  // Timer logic helpers
  const calculateRemainingTime = (
    session: { startTime: Date; duration: number; isPaused: boolean; remainingTime?: number },
    leaderTimestamp?: number
  ): number => {
    if (session.isPaused && session.remainingTime !== undefined) return session.remainingTime
    const now = Date.now()
    if (leaderTimestamp && leaderTimestamp > 0) {
      const timeSinceSave = now - leaderTimestamp
      const leaderElapsedAtSave = leaderTimestamp - session.startTime.getTime()
      const totalElapsed = leaderElapsedAtSave + timeSinceSave
      return Math.max(0, session.duration - Math.floor(totalElapsed / 1000))
    }
    const elapsedSeconds = Math.floor((now - session.startTime.getTime()) / 1000)
    return Math.max(0, session.duration - elapsedSeconds)
  }

  const startFollowerInterval = () => {
    if (timerInterval.value) clearInterval(timerInterval.value)
    timerInterval.value = setInterval(() => {
      if (currentSession.value && currentSession.value.isActive && !currentSession.value.isPaused && !isDeviceLeader.value) {
        currentSession.value.remainingTime = calculateRemainingTime(currentSession.value, lastLeaderTimestamp)
      }
    }, 1000)
  }

  // Cross-tab sync actions
  const initCrossTabSync = () => {
    if (crossTabInitialized || typeof window === 'undefined') return
    try {
      crossTabSync = useCrossTabSync()
      crossTabSync.setTimerCallbacks({
        onSessionUpdate: (rawSession: any) => {
          if (!isLeader.value && rawSession) {
            currentSession.value = { ...rawSession, startTime: new Date(rawSession.startTime) }
          } else if (!isLeader.value && rawSession === null) {
            if (timerInterval.value) { clearInterval(timerInterval.value); timerInterval.value = null }
            currentSession.value = null
          }
        },
        onBecomeLeader: () => { isLeader.value = true },
        onLoseLeadership: () => {
          isLeader.value = false
          if (timerInterval.value) { clearInterval(timerInterval.value); timerInterval.value = null }
        }
      })
      crossTabInitialized = true
    } catch (e) { console.warn('Cross-tab sync init failed', e) }
  }

  const broadcastSession = () => {
    if (!crossTabSync || !isLeader.value) return
    const sessionData = currentSession.value ? { ...currentSession.value, startTime: currentSession.value.startTime.toISOString() } : null
    crossTabSync.broadcastTimerSession(sessionData)
  }

  // Supabase Sync Actions
  const handleRemoteTimerUpdate = async (payload: any) => {
    const { new: newDoc, eventType } = payload
    if (eventType === 'DELETE' || !newDoc?.is_active) {
      currentSession.value = null
      if (timerInterval.value) { clearInterval(timerInterval.value); timerInterval.value = null }
      return
    }

    if (isDeviceLeader.value && newDoc.device_leader_id === deviceId) return

    const lastSeen = new Date(newDoc.device_leader_last_seen).getTime()
    if (Date.now() - lastSeen < DEVICE_LEADER_TIMEOUT_MS) {
      isDeviceLeader.value = false
      stopDeviceHeartbeat()
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
      lastLeaderTimestamp = lastSeen
      session.remainingTime = calculateRemainingTime(session, lastLeaderTimestamp)
      currentSession.value = session
      if (session.isActive && !session.isPaused) startFollowerInterval()
    }
  }

  const saveTimerSessionWithLeadership = async () => {
    if (!currentSession.value) return
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(currentSession.value.id)) {
      currentSession.value.id = crypto.randomUUID()
    }
    await saveActiveTimerSession(currentSession.value, deviceId)
  }

  const startDeviceHeartbeat = () => {
    if (deviceHeartbeatInterval) clearInterval(deviceHeartbeatInterval)
    deviceHeartbeatInterval = setInterval(async () => {
      if (!currentSession.value || !isDeviceLeader.value) { stopDeviceHeartbeat(); return }
      await saveTimerSessionWithLeadership()
    }, DEVICE_HEARTBEAT_INTERVAL_MS)
  }

  const stopDeviceHeartbeat = () => {
    if (deviceHeartbeatInterval) { clearInterval(deviceHeartbeatInterval); deviceHeartbeatInterval = null }
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
    initCrossTabSync()
    if (await checkForActiveDeviceLeader()) return

    if (crossTabSync) {
      if (!crossTabSync.claimTimerLeadership()) return
      isLeader.value = true
    }

    if (timerInterval.value) clearInterval(timerInterval.value)

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
    startDeviceHeartbeat()
    broadcastSession()
    await saveTimerSessionWithLeadership()
    playStartSound()

    timerInterval.value = setInterval(() => {
      const session = currentSession.value
      if (session && session.isActive && !session.isPaused) {
        session.remainingTime -= 1
        if (session.remainingTime % 5 === 0) broadcastSession()
        if (session.remainingTime <= 0) completeSession()
      }
    }, 1000)
  }

  const pauseTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = true
      broadcastSession()
    }
  }

  const resumeTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = false
      broadcastSession()
    }
  }

  const stopTimer = async () => {
    if (timerInterval.value) { clearInterval(timerInterval.value); timerInterval.value = null }
    stopDeviceHeartbeat()
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
    if (timerInterval.value) { clearInterval(timerInterval.value); timerInterval.value = null }
    stopDeviceHeartbeat()

    const completedSession = { ...session, isActive: false, completedAt: new Date() }
    completedSessions.value.push(completedSession)

    const wasBreak = session.isBreak
    const lastTaskId = session.taskId

    if (session.taskId && session.taskId !== 'general' && !session.isBreak) {
      const taskStore = useTaskStore()
      const task = taskStore.tasks.find(t => t.id === session.taskId)
      if (task) {
        const newCount = task.completedPomodoros + 1
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
        startDeviceHeartbeat()
        timerInterval.value = setInterval(() => {
          if (currentSession.value && currentSession.value.isActive && !currentSession.value.isPaused) {
            currentSession.value.remainingTime -= 1
            if (currentSession.value.remainingTime <= 0) completeSession()
          }
        }, 1000)
      } else {
        isDeviceLeader.value = false
        startFollowerInterval()
      }
    }
    initCrossTabSync()
    initRealtimeSubscription(() => { }, () => { }, handleRemoteTimerUpdate)
  }

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