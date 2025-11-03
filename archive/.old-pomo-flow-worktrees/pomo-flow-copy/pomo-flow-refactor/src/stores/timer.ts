import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useTaskStore } from './tasks'
import { useDatabase } from '@/composables/useDatabase'

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
  // Load settings from localStorage
  const loadSettings = () => {
    const saved = localStorage.getItem('pomo-flow-settings')
    if (saved) {
      return JSON.parse(saved)
    }
    return {
      workDuration: 20 * 60, // 20 minutes in seconds
      shortBreakDuration: 5 * 60, // 5 minutes
      longBreakDuration: 15 * 60, // 15 minutes
      autoStartBreaks: true,
      autoStartPomodoros: true,
      playNotificationSounds: true
    }
  }

  // State
  const currentSession = ref<PomodoroSession | null>(null)
  const completedSessions = ref<PomodoroSession[]>([])
  const timerInterval = ref<NodeJS.Timeout | null>(null)

  // Settings with localStorage persistence
  const settings = ref(loadSettings())

  // Computed
  const isTimerActive = computed(() =>
    currentSession.value?.isActive && !currentSession.value?.isPaused
  )

  const isPaused = computed(() =>
    currentSession.value?.isPaused || false
  )

  const currentTaskId = computed(() =>
    currentSession.value?.taskId || null
  )

  const displayTime = computed(() => {
    if (!currentSession.value) {
      const minutes = Math.floor(settings.value.workDuration / 60)
      return `${minutes.toString().padStart(2, '0')}:00`
    }

    const minutes = Math.floor(currentSession.value.remainingTime / 60)
    const seconds = currentSession.value.remainingTime % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const currentTaskName = computed(() => {
    if (!currentSession.value || !currentSession.value.taskId) return null

    if (currentSession.value.isBreak) {
      return currentSession.value.taskId === 'break' ? 'Break Time' : 'Short Break'
    }

    if (currentSession.value.taskId === 'general') return 'Focus Session'

    const taskStore = useTaskStore()
    const task = taskStore.tasks.find(t => t.id === currentSession.value.taskId)
    return task?.title || 'Unknown Task'
  })

  const sessionTypeIcon = computed(() => {
    if (!currentSession.value) return '🍅'
    return currentSession.value.isBreak ? '🧎' : '🍅'
  })

  // Tab-friendly computed properties
  const tabDisplayTime = computed(() => {
    if (!currentSession.value) return ''
    const minutes = Math.floor(currentSession.value.remainingTime / 60)
    const seconds = currentSession.value.remainingTime % 60
    const result = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    console.log('🍅 DEBUG tabDisplayTime computed:', result)
    return result
  })

  const sessionStatusText = computed(() => {
    if (!currentSession.value) return ''
    if (currentSession.value.isBreak) {
      return currentSession.value.taskId === 'break' ? 'Short Break' : 'Long Break'
    }
    if (currentSession.value.taskId === 'general') return 'Focus Session'

    const taskStore = useTaskStore()
    const task = taskStore.tasks.find(t => t.id === currentSession.value.taskId)
    const result = task?.title || 'Work Session'
    console.log('🍅 DEBUG sessionStatusText computed:', result)
    return result
  })

  const timerPercentage = computed(() => {
    if (!currentSession.value) return 0
    const totalDuration = currentSession.value.duration
    const remainingTime = currentSession.value.remainingTime
    const result = Math.round(((totalDuration - remainingTime) / totalDuration) * 100)
    console.log('🍅 DEBUG timerPercentage computed:', result)
    return result
  })

  const faviconStatus = computed(() => {
    if (!currentSession.value) return 'inactive'
    const result = currentSession.value.isBreak ? 'break' : 'work'
    console.log('🍅 DEBUG faviconStatus computed:', result)
    return result
  })

  const tabTitleWithTimer = computed(() => {
    const baseTitle = 'Pomo-Flow'
    if (!currentSession.value || !isTimerActive.value) {
      console.log('🍅 DEBUG tabTitleWithTimer: No active session, returning base title:', baseTitle)
      return baseTitle
    }

    const time = tabDisplayTime.value
    const icon = currentSession.value.isBreak ? '🧎' : '🍅'
    const status = sessionStatusText.value
    const result = `${status} - ${time} ${icon} | ${baseTitle}`
    console.log('🍅 DEBUG tabTitleWithTimer computed:', {
      result,
      time,
      icon,
      status,
      isActive: isTimerActive.value,
      hasSession: !!currentSession.value,
      sessionDetails: currentSession.value
    })
    return result
  })

  // Actions
  const startTimer = (taskId: string, duration?: number, isBreak: boolean = false) => {
    console.log('🍅 DEBUG startTimer called:', { taskId, duration, isBreak })

    // Stop any existing timer
    if (currentSession.value) {
      console.log('🍅 DEBUG: Stopping existing timer')
      stopTimer()
    }

    const sessionDuration = duration || settings.value.workDuration

    currentSession.value = {
      id: Date.now().toString(),
      taskId,
      startTime: new Date(),
      duration: sessionDuration,
      remainingTime: sessionDuration,
      isActive: true,
      isPaused: false,
      isBreak
    }

    console.log('🍅 DEBUG: Timer session created:', {
      id: currentSession.value.id,
      taskId,
      duration: sessionDuration,
      remainingTime: sessionDuration,
      isActive: true,
      isPaused: false,
      isBreak,
      computedIsActive: isTimerActive.value
    })

    // Play start sound
    playStartSound()

    // Start countdown
    timerInterval.value = setInterval(() => {
      if (currentSession.value && currentSession.value.isActive && !currentSession.value.isPaused) {
        currentSession.value.remainingTime -= 1

        if (currentSession.value.remainingTime <= 0) {
          completeSession()
        }
      }
    }, 1000)
  }

  const pauseTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = true
    }
  }

  const resumeTimer = () => {
    if (currentSession.value) {
      currentSession.value.isPaused = false
    }
  }

  const stopTimer = () => {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    if (currentSession.value) {
      // Save incomplete session
      completedSessions.value.push({
        ...currentSession.value,
        isActive: false,
        completedAt: new Date()
      })

      currentSession.value = null
    }
  }

  const completeSession = () => {
    if (!currentSession.value) return

    // Clear interval
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    // Mark session as completed
    const completedSession = {
      ...currentSession.value,
      isActive: false,
      completedAt: new Date()
    }

    completedSessions.value.push(completedSession)

    // Store session info for auto-transition
    const wasBreakSession = currentSession.value.isBreak
    const lastTaskId = currentSession.value.taskId
    const sessionType = wasBreakSession ? 'Break' : 'Work session'

    // Update task pomodoro count if this was a work session
    if (currentSession.value.taskId && currentSession.value.taskId !== 'general' && !currentSession.value.isBreak) {
      const taskStore = useTaskStore()
      const task = taskStore.tasks.find(t => t.id === currentSession.value.taskId)

      if (task) {
        const newCount = task.completedPomodoros + 1
        const newProgress = Math.min(100, Math.round((newCount / task.estimatedPomodoros) * 100))

        taskStore.updateTask(currentSession.value.taskId, {
          completedPomodoros: newCount,
          progress: newProgress
        })

        console.log(`Pomodoro completed for "${task.title}": ${newCount}/${task.estimatedPomodoros}`)
      }
    }

    currentSession.value = null

    // Play completion sound
    playEndSound()

    // Show notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${sessionType} Complete! 🍅`, {
        body: wasBreakSession ? 'Ready to get back to work?' : 'Great work! Time for a break.',
        icon: '/favicon.ico'
      })
    }

    // Auto-transition: Work → Break → Work
    if (settings.value.autoStartBreaks && !wasBreakSession) {
      // Just completed work session, start break
      setTimeout(() => {
        startTimer('break', settings.value.shortBreakDuration, true)
      }, 2000) // 2-second delay for notification
    } else if (settings.value.autoStartPomodoros && wasBreakSession && lastTaskId !== 'break') {
      // Just completed break, restart work timer for same task
      setTimeout(() => {
        startTimer(lastTaskId, settings.value.workDuration, false)
      }, 2000)
    }
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  // Sound effects using Web Audio API
  const playStartSound = () => {
    if (!settings.value.playNotificationSounds) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Pleasant ascending chime for start
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime) // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1) // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2) // G5

      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.log('Audio not available:', error)
    }
  }

  const playEndSound = () => {
    if (!settings.value.playNotificationSounds) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Gentle completion bell
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime) // G5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.15) // E5
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime + 0.3) // C5

      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.6)
    } catch (error) {
      console.log('Audio not available:', error)
    }
  }

  // Persistence for timer session
  const saveTimerSession = () => {
    if (currentSession.value) {
      const sessionData = {
        ...currentSession.value,
        startTime: currentSession.value.startTime.toISOString(),
        completedAt: currentSession.value.completedAt?.toISOString()
      }
      localStorage.setItem('pomo-flow-timer-session', JSON.stringify(sessionData))
    } else {
      localStorage.removeItem('pomo-flow-timer-session')
    }
  }

  const loadTimerSession = () => {
    const saved = localStorage.getItem('pomo-flow-timer-session')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        currentSession.value = {
          ...data,
          startTime: new Date(data.startTime),
          completedAt: data.completedAt ? new Date(data.completedAt) : undefined
        }

        // Restart interval if timer was active
        if (currentSession.value.isActive && !currentSession.value.isPaused) {
          timerInterval.value = setInterval(() => {
            if (currentSession.value && currentSession.value.isActive && !currentSession.value.isPaused) {
              currentSession.value.remainingTime -= 1
              if (currentSession.value.remainingTime <= 0) {
                completeSession()
              }
            }
          }, 1000)
        }
      } catch (error) {
        console.log('Failed to load timer session:', error)
      }
    }
  }

  // Watch for session changes and save
  watch(currentSession, () => {
    saveTimerSession()
  }, { deep: true })

  // Load session on mount
  loadTimerSession()

  return {
    // State
    currentSession,
    completedSessions,
    settings,

    // Computed
    isTimerActive,
    isPaused,
    currentTaskId,
    displayTime,
    currentTaskName,
    sessionTypeIcon,

    // Tab-friendly computed properties
    tabDisplayTime,
    sessionStatusText,
    timerPercentage,
    faviconStatus,
    tabTitleWithTimer,

    // Actions
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    completeSession,
    requestNotificationPermission,
    playStartSound,
    playEndSound
  }
})