/**
 * Unit Tests for Simple Timer Service
 * Tests direct store access pattern and business logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTimerServiceSimple } from '@/services/timerServiceSimple'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'

// Mock the stores for isolated testing
vi.mock('@/stores/tasks', () => ({
  useTaskStore: vi.fn()
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: vi.fn()
}))

describe('useTimerServiceSimple', () => {
  let mockTaskStore: any
  let mockTimerStore: any
  let timerService: ReturnType<typeof useTimerServiceSimple>

  beforeEach(() => {
    setActivePinia(createPinia())

    // Create mock task store
    mockTaskStore = {
      getTaskById: vi.fn(),
      updateTaskWithUndo: vi.fn()
    }

    // Create mock timer store
    mockTimerStore = {
      settings: {
        workDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        longBreakInterval: 4,
        autoStartBreaks: false,
        autoStartWork: false,
        notificationSound: true,
        notificationDesktop: true
      },
      currentSession: null,
      sessionHistory: [],
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
      skipTimer: vi.fn(),
      completePomodoro: vi.fn(),
      updateSettings: vi.fn(),
      clearSessionHistory: vi.fn()
    }

    // Mock stores
    const { useTaskStore } = require('@/stores/tasks')
    const { useTimerStore } = require('@/stores/timer')
    useTaskStore.mockReturnValue(mockTaskStore)
    useTimerStore.mockReturnValue(mockTimerStore)

    timerService = useTimerServiceSimple()
  })

  describe('startTimer', () => {
    it('should start work timer with default duration', async () => {
      const type = 'work' as const
      const mockSession = {
        id: 'session-1',
        type: 'work',
        duration: 25,
        startTime: new Date(),
        completedPomodoros: 0
      }

      mockTimerStore.startTimer.mockResolvedValue(mockSession)

      const result = await timerService.startTimer(type)

      expect(mockTimerStore.startTimer).toHaveBeenCalledWith({
        id: expect.stringMatching(/^session_\d+_\w+$/),
        type: 'work',
        duration: 25,
        startTime: expect.any(Date),
        completedPomodoros: 0
      })
      expect(result).toEqual(mockSession)
    })

    it('should start timer with custom duration', async () => {
      const type = 'work' as const
      const duration = 30
      const mockSession = {
        id: 'session-1',
        type: 'work',
        duration: 30,
        startTime: new Date(),
        completedPomodoros: 0
      }

      mockTimerStore.startTimer.mockResolvedValue(mockSession)

      const result = await timerService.startTimer(type, duration)

      expect(mockTimerStore.startTimer).toHaveBeenCalledWith({
        id: expect.stringMatching(/^session_\d+_\w+$/),
        type: 'work',
        duration: 30,
        startTime: expect.any(Date),
        completedPomodoros: 0
      })
      expect(result).toEqual(mockSession)
    })

    it('should start timer with associated task', async () => {
      const type = 'work' as const
      const taskId = 'task-1'
      const mockSession = {
        id: 'session-1',
        type: 'work',
        duration: 25,
        startTime: new Date(),
        completedPomodoros: 0,
        taskId: 'task-1'
      }

      mockTimerStore.startTimer.mockResolvedValue(mockSession)

      const result = await timerService.startTimer(type, undefined, taskId)

      expect(mockTimerStore.startTimer).toHaveBeenCalledWith({
        id: expect.stringMatching(/^session_\d+_\w+$/),
        type: 'work',
        duration: 25,
        startTime: expect.any(Date),
        completedPomodoros: 0,
        taskId: 'task-1'
      })
      expect(result).toEqual(mockSession)
    })

    it('should start short break timer', async () => {
      const type = 'shortBreak' as const
      const mockSession = {
        id: 'session-1',
        type: 'shortBreak',
        duration: 5,
        startTime: new Date(),
        completedPomodoros: 0
      }

      mockTimerStore.startTimer.mockResolvedValue(mockSession)

      const result = await timerService.startTimer(type)

      expect(mockTimerStore.startTimer).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'shortBreak',
        duration: 5,
        startTime: expect.any(Date),
        completedPomodoros: 0
      })
      expect(result).toEqual(mockSession)
    })

    it('should start long break timer', async () => {
      const type = 'longBreak' as const
      const mockSession = {
        id: 'session-1',
        type: 'longBreak',
        duration: 15,
        startTime: new Date(),
        completedPomodoros: 0
      }

      mockTimerStore.startTimer.mockResolvedValue(mockSession)

      const result = await timerService.startTimer(type)

      expect(mockTimerStore.startTimer).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'longBreak',
        duration: 15,
        startTime: expect.any(Date),
        completedPomodoros: 0
      })
      expect(result).toEqual(mockSession)
    })
  })

  describe('stopTimer', () => {
    it('should stop current timer and update task pomodoros', async () => {
      const mockSession = {
        id: 'session-1',
        taskId: 'task-1',
        type: 'work',
        completedPomodoros: 2,
        endTime: new Date()
      }

      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        completedPomodoros: 5
      }

      mockTimerStore.stopTimer.mockResolvedValue(mockSession)
      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(mockTask)

      const result = await timerService.stopTimer()

      expect(mockTimerStore.stopTimer).toHaveBeenCalled()
      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('task-1')
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith('task-1', {
        completedPomodoros: 7 // 5 + 2
      })
      expect(result).toEqual(mockSession)
    })

    it('should stop timer without updating task if no task associated', async () => {
      const mockSession = {
        id: 'session-1',
        type: 'work',
        completedPomodoros: 2,
        endTime: new Date()
      }

      mockTimerStore.stopTimer.mockResolvedValue(mockSession)

      const result = await timerService.stopTimer()

      expect(mockTimerStore.stopTimer).toHaveBeenCalled()
      expect(mockTaskStore.updateTaskWithUndo).not.toHaveBeenCalled()
      expect(result).toEqual(mockSession)
    })

    it('should handle null session', async () => {
      mockTimerStore.stopTimer.mockResolvedValue(null)

      const result = await timerService.stopTimer()

      expect(mockTimerStore.stopTimer).toHaveBeenCalled()
      expect(mockTaskStore.updateTaskWithUndo).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe('pauseTimer', () => {
    it('should pause current timer', async () => {
      mockTimerStore.pauseTimer.mockResolvedValue()

      await timerService.pauseTimer()

      expect(mockTimerStore.pauseTimer).toHaveBeenCalled()
    })
  })

  describe('resumeTimer', () => {
    it('should resume paused timer', async () => {
      mockTimerStore.resumeTimer.mockResolvedValue()

      await timerService.resumeTimer()

      expect(mockTimerStore.resumeTimer).toHaveBeenCalled()
    })
  })

  describe('skipTimer', () => {
    it('should skip current timer', async () => {
      mockTimerStore.skipTimer.mockResolvedValue()

      await timerService.skipTimer()

      expect(mockTimerStore.skipTimer).toHaveBeenCalled()
    })
  })

  describe('updateSettings', () => {
    it('should update timer settings', async () => {
      const settings = {
        workDuration: 30,
        shortBreakDuration: 10
      }

      mockTimerStore.updateSettings.mockResolvedValue()

      await timerService.updateSettings(settings)

      expect(mockTimerStore.updateSettings).toHaveBeenCalledWith(settings)
    })
  })

  describe('getSettings', () => {
    it('should return current timer settings', () => {
      const result = timerService.getSettings()

      expect(result).toBe(mockTimerStore.settings)
      expect(result.workDuration).toBe(25)
      expect(result.shortBreakDuration).toBe(5)
    })
  })

  describe('getCurrentSession', () => {
    it('should return current timer session', () => {
      const result = timerService.getCurrentSession()

      expect(result).toBe(mockTimerStore.currentSession)
    })
  })

  describe('getSessionHistory', () => {
    it('should return session history', () => {
      const result = timerService.getSessionHistory()

      expect(result).toBe(mockTimerStore.sessionHistory)
    })
  })

  describe('startTaskTimer', () => {
    it('should start timer for specific task', async () => {
      const taskId = 'task-1'
      const mockTask = { id: taskId, title: 'Test Task' }
      const mockSession = {
        id: 'session-1',
        type: 'work',
        duration: 25,
        taskId: 'task-1'
      }

      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTimerStore.startTimer.mockResolvedValue(mockSession)

      const result = await timerService.startTaskTimer(taskId)

      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('task-1')
      expect(mockTimerStore.startTimer).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'work',
        duration: undefined,
        startTime: expect.any(Date),
        completedPomodoros: 0,
        taskId: 'task-1'
      })
      expect(result).toEqual(mockSession)
    })

    it('should throw error for non-existent task', async () => {
      const taskId = 'non-existent'

      mockTaskStore.getTaskById.mockReturnValue(undefined)

      await expect(timerService.startTaskTimer(taskId)).rejects.toThrow('Task with ID non-existent not found')
      expect(mockTimerStore.startTimer).not.toHaveBeenCalled()
    })
  })

  describe('completePomodoro', () => {
    it('should complete pomodoro and update task', async () => {
      const currentSession = {
        id: 'session-1',
        taskId: 'task-1',
        type: 'work'
      }

      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        completedPomodoros: 5
      }

      mockTimerStore.currentSession = currentSession
      mockTimerStore.completePomodoro.mockResolvedValue()
      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(mockTask)

      await timerService.completePomodoro()

      expect(mockTimerStore.completePomodoro).toHaveBeenCalled()
      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('task-1')
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith('task-1', {
        completedPomodoros: 6
      })
    })

    it('should complete pomodoro without updating task if no current session', async () => {
      mockTimerStore.currentSession = null
      mockTimerStore.completePomodoro.mockResolvedValue()

      await timerService.completePomodoro()

      expect(mockTimerStore.completePomodoro).toHaveBeenCalled()
      expect(mockTaskStore.updateTaskWithUndo).not.toHaveBeenCalled()
    })

    it('should complete pomodoro without updating task if no task in session', async () => {
      const currentSession = {
        id: 'session-1',
        type: 'work'
      }

      mockTimerStore.currentSession = currentSession
      mockTimerStore.completePomodoro.mockResolvedValue()

      await timerService.completePomodoro()

      expect(mockTimerStore.completePomodoro).toHaveBeenCalled()
      expect(mockTaskStore.updateTaskWithUndo).not.toHaveBeenCalled()
    })
  })

  describe('getTodayPomodoroCount', () => {
    it('should count today work sessions with completed pomodoros', () => {
      const today = new Date().toDateString()
      const todaySessions = [
        {
          id: 'session-1',
          type: 'work',
          startTime: new Date(today),
          completedPomodoros: 2
        },
        {
          id: 'session-2',
          type: 'shortBreak',
          startTime: new Date(today),
          completedPomodoros: 0
        },
        {
          id: 'session-3',
          type: 'work',
          startTime: new Date(today),
          completedPomodoros: 1
        }
      ]

      const yesterdaySession = {
        id: 'session-old',
        type: 'work',
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        completedPomodoros: 3
      }

      mockTimerStore.sessionHistory = [...todaySessions, yesterdaySession]

      const result = timerService.getTodayPomodoroCount()

      expect(result).toBe(3) // 2 + 1 from today work sessions
    })

    it('should return 0 if no sessions today', () => {
      const yesterdaySession = {
        id: 'session-old',
        type: 'work',
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        completedPomodoros: 3
      }

      mockTimerStore.sessionHistory = [yesterdaySession]

      const result = timerService.getTodayPomodoroCount()

      expect(result).toBe(0)
    })
  })

  describe('getTaskPomodoroCount', () => {
    it('should return pomodoro count for specific task', () => {
      const taskId = 'task-1'
      const mockTask = {
        id: taskId,
        title: 'Test Task',
        completedPomodoros: 7
      }

      mockTaskStore.getTaskById.mockReturnValue(mockTask)

      const result = timerService.getTaskPomodoroCount(taskId)

      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('task-1')
      expect(result).toBe(7)
    })

    it('should return 0 for non-existent task', () => {
      const taskId = 'non-existent'

      mockTaskStore.getTaskById.mockReturnValue(undefined)

      const result = timerService.getTaskPomodoroCount(taskId)

      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('non-existent')
      expect(result).toBe(0)
    })
  })

  describe('clearSessionHistory', () => {
    it('should clear session history', async () => {
      mockTimerStore.clearSessionHistory.mockResolvedValue()

      await timerService.clearSessionHistory()

      expect(mockTimerStore.clearSessionHistory).toHaveBeenCalled()
    })
  })

  describe('getStatistics', () => {
    it('should return timer statistics', () => {
      const today = new Date().toDateString()
      const todayDate = new Date(today)
      const weekAgo = new Date(todayDate.getTime() - 7 * 24 * 60 * 60 * 1000)

      mockTimerStore.sessionHistory = [
        {
          id: 'session-1',
          type: 'work',
          startTime: todayDate,
          duration: 25,
          completedPomodoros: 2
        },
        {
          id: 'session-2',
          type: 'shortBreak',
          startTime: todayDate,
          duration: 5,
          completedPomodoros: 0
        },
        {
          id: 'session-3',
          type: 'work',
          startTime: weekAgo,
          duration: 25,
          completedPomodoros: 1
        }
      ]

      const result = timerService.getStatistics()

      expect(result).toEqual({
        todayPomodoros: 2,
        todayFocusTime: 50, // 2 * 25 minutes
        weekPomodoros: 3,
        weekFocusTime: 75, // 3 * 25 minutes
        totalSessions: 3,
        totalPomodoros: 3
      })
    })

    it('should return zero statistics for empty history', () => {
      mockTimerStore.sessionHistory = []

      const result = timerService.getStatistics()

      expect(result).toEqual({
        todayPomodoros: 0,
        todayFocusTime: 0,
        weekPomodoros: 0,
        weekFocusTime: 0,
        totalSessions: 0,
        totalPomodoros: 0
      })
    })
  })

  describe('store access', () => {
    it('should provide direct access to task store', () => {
      expect(timerService.taskStore).toBe(mockTaskStore)
    })

    it('should provide direct access to timer store', () => {
      expect(timerService.timerStore).toBe(mockTimerStore)
    })
  })
})

describe('DEFAULT_TIMER_SETTINGS', () => {
  it('should have correct default values', () => {
    const { DEFAULT_TIMER_SETTINGS } = require('@/services/timerServiceSimple')

    expect(DEFAULT_TIMER_SETTINGS).toEqual({
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4,
      autoStartBreaks: false,
      autoStartWork: false,
      notificationSound: true,
      notificationDesktop: true
    })
  })
})