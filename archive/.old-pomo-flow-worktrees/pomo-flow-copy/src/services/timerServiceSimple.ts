/**
 * Simple Timer Service - Direct Store Access Pattern
 *
 * This service provides a clean interface for Pomodoro timer operations with DIRECT access
 * to Pinia stores for optimal performance and instant sync across all views.
 */

import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'

export interface TimerSession {
  id: string
  taskId?: string
  type: 'work' | 'shortBreak' | 'longBreak'
  duration: number // in minutes
  startTime: Date
  endTime?: Date
  completedPomodoros: number
  notes?: string
}

export interface TimerSettings {
  workDuration: number // minutes
  shortBreakDuration: number // minutes
  longBreakDuration: number // minutes
  longBreakInterval: number // number of work sessions before long break
  autoStartBreaks: boolean
  autoStartWork: boolean
  notificationSound: boolean
  notificationDesktop: boolean
}

/**
 * Simple Timer Service - Business logic with DIRECT store access
 *
 * Follows the two-layer architecture:
 * Layer 1: Direct Pinia Store (state + persistence)
 * Layer 2: Simple Service (business logic only)
 */
export function useTimerServiceSimple() {
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()

  /**
   * Start a timer session
   */
  const startTimer = async (
    type: TimerSession['type'],
    duration?: number,
    taskId?: string
  ): Promise<TimerSession> => {
    try {
      // Get appropriate duration
      let sessionDuration = duration
      if (!sessionDuration) {
        const settings = timerStore.settings
        switch (type) {
          case 'work':
            sessionDuration = settings.workDuration
            break
          case 'shortBreak':
            sessionDuration = settings.shortBreakDuration
            break
          case 'longBreak':
            sessionDuration = settings.longBreakDuration
            break
        }
      }

      const session: TimerSession = {
        id: generateSessionId(),
        type,
        duration: sessionDuration,
        startTime: new Date(),
        completedPomodoros: 0,
        taskId
      }

      // Start timer in store
      await timerStore.startTimer(session)

      console.log(`✅ SimpleTimerService: Started ${type} timer (${sessionDuration}min)${taskId ? ` for task ${taskId}` : ''}`)
      return session
    } catch (error) {
      console.error(`❌ SimpleTimerService: Failed to start timer`, error)
      throw error
    }
  }

  /**
   * Stop the current timer session
   */
  const stopTimer = async (): Promise<TimerSession | null> => {
    try {
      const session = await timerStore.stopTimer()

      if (session) {
        // Update task pomodoros if associated with a task
        if (session.taskId && session.type === 'work' && session.completedPomodoros > 0) {
          await updateTaskPomodoros(session.taskId, session.completedPomodoros)
        }

        console.log(`✅ SimpleTimerService: Stopped timer session (${session.completedPomodoros} pomodoros)`)
      }

      return session
    } catch (error) {
      console.error(`❌ SimpleTimerService: Failed to stop timer`, error)
      throw error
    }
  }

  /**
   * Pause the current timer
   */
  const pauseTimer = async (): Promise<void> => {
    try {
      await timerStore.pauseTimer()
      console.log(`✅ SimpleTimerService: Paused timer`)
    } catch (error) {
      console.error(`❌ SimpleTimerService: Failed to pause timer`, error)
      throw error
    }
  }

  /**
   * Resume the paused timer
   */
  const resumeTimer = async (): Promise<void> => {
    try {
      await timerStore.resumeTimer()
      console.log(`✅ SimpleTimerService: Resumed timer`)
    } catch (error) {
      console.error(`❌ SimpleTimerService: Failed to resume timer`, error)
      throw error
    }
  }

  /**
   * Skip the current timer session
   */
  const skipTimer = async (): Promise<void> => {
    try {
      await timerStore.skipTimer()
      console.log(`✅ SimpleTimerService: Skipped timer session`)
    } catch (error) {
      console.error(`❌ SimpleTimerService: Failed to skip timer`, error)
      throw error
    }
  }

  /**
   * Update timer settings
   */
  const updateSettings = async (settings: Partial<TimerSettings>): Promise<void> => {
    try {
      await timerStore.updateSettings(settings)
      console.log(`✅ SimpleTimerService: Updated timer settings`)
    } catch (error) {
      console.error(`❌ SimpleTimerService: Failed to update settings`, error)
      throw error
    }
  }

  /**
   * Get current timer settings
   */
  const getSettings = (): TimerSettings => {
    return timerStore.settings
  }

  /**
   * Get current timer session
   */
  const getCurrentSession = (): TimerSession | null => {
    return timerStore.currentSession
  }

  /**
   * Get timer session history
   */
  const getSessionHistory = (): TimerSession[] => {
    return timerStore.sessionHistory
  }

  /**
   * Start timer for specific task
   */
  const startTaskTimer = async (taskId: string): Promise<TimerSession> => {
    try {
      const task = taskStore.getTaskById(taskId)
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`)
      }

      return await startTimer('work', undefined, taskId)
    } catch (error) {
      console.error(`❌ SimpleTimerService: Failed to start task timer`, error)
      throw error
    }
  }

  /**
   * Complete a pomodoro (increment count)
   */
  const completePomodoro = async (): Promise<void> => {
    try {
      await timerStore.completePomodoro()

      const currentSession = timerStore.currentSession
      if (currentSession && currentSession.taskId) {
        await updateTaskPomodoros(currentSession.taskId, 1)
      }

      console.log(`✅ SimpleTimerService: Completed pomodoro`)
    } catch (error) {
      console.error(`❌ SimpleTimerService: Failed to complete pomodoro`, error)
      throw error
    }
  }

  /**
   * Get today's pomodoro count
   */
  const getTodayPomodoroCount = (): number => {
    const today = new Date().toDateString()
    return timerStore.sessionHistory.filter(session => {
      return session.type === 'work' &&
             session.startTime.toDateString() === today &&
             session.completedPomodoros > 0
    }).reduce((total, session) => total + session.completedPomodoros, 0)
  }

  /**
   * Get pomodoro count for specific task
   */
  const getTaskPomodoroCount = (taskId: string): number => {
    const task = taskStore.getTaskById(taskId)
    return task?.completedPomodoros || 0
  }

  /**
   * Clear session history
   */
  const clearSessionHistory = async (): Promise<void> => {
    try {
      await timerStore.clearSessionHistory()
      console.log(`✅ SimpleTimerService: Cleared session history`)
    } catch (error) {
      console.error(`❌ SimpleTimerService: Failed to clear session history`, error)
      throw error
    }
  }

  /**
   * Get timer statistics
   */
  const getStatistics = () => {
    const history = timerStore.sessionHistory
    const today = new Date().toDateString()

    const todaySessions = history.filter(session =>
      session.startTime.toDateString() === today
    )

    const thisWeek = history.filter(session => {
      const sessionDate = new Date(session.startTime)
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return sessionDate >= weekAgo
    })

    return {
      todayPomodoros: todaySessions.reduce((total, session) =>
        total + (session.type === 'work' ? session.completedPomodoros : 0), 0
      ),
      todayFocusTime: todaySessions.reduce((total, session) =>
        total + (session.type === 'work' ? session.duration * session.completedPomodoros : 0), 0
      ),
      weekPomodoros: thisWeek.reduce((total, session) =>
        total + (session.type === 'work' ? session.completedPomodoros : 0), 0
      ),
      weekFocusTime: thisWeek.reduce((total, session) =>
        total + (session.type === 'work' ? session.duration * session.completedPomodoros : 0), 0
      ),
      totalSessions: history.length,
      totalPomodoros: history.reduce((total, session) =>
        total + (session.type === 'work' ? session.completedPomodoros : 0), 0
      )
    }
  }

  // Private helper functions

  /**
   * Update task pomodoro count
   */
  const updateTaskPomodoros = async (taskId: string, additionalPomodoros: number): Promise<void> => {
    try {
      const task = taskStore.getTaskById(taskId)
      if (!task) return

      const newCompletedPomodoros = task.completedPomodoros + additionalPomodoros

      await taskStore.updateTaskWithUndo(taskId, {
        completedPomodoros: newCompletedPomodoros
      })

      console.log(`✅ SimpleTimerService: Updated task ${taskId} pomodoros to ${newCompletedPomodoros}`)
    } catch (error) {
      console.error(`❌ SimpleTimerService: Failed to update task pomodoros`, error)
      throw error
    }
  }

  /**
   * Generate unique session ID
   */
  const generateSessionId = (): string => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  return {
    // Timer control operations
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    skipTimer,

    // Task-specific timer operations
    startTaskTimer,
    completePomodoro,

    // Settings operations
    updateSettings,
    getSettings,

    // Query operations
    getCurrentSession,
    getSessionHistory,
    getTodayPomodoroCount,
    getTaskPomodoroCount,
    getStatistics,

    // Utility operations
    clearSessionHistory,

    // Direct store access for reading (components should use computed properties)
    taskStore,
    timerStore
  }
}

/**
 * Default timer settings
 */
export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  notificationSound: true,
  notificationDesktop: true
}