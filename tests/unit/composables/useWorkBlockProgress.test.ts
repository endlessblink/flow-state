import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useWorkBlockProgress } from '@/composables/tasks/useWorkBlockProgress'
import type { Task } from '@/types/tasks'

const timerState = vi.hoisted(() => ({
  sessions: [] as Array<{
    taskId: string
    duration: number
    isBreak: boolean
    completedAt?: Date
  }>,
  currentSession: null as null | {
    taskId: string
    duration: number
    remainingTime: number
    isBreak: boolean
  }
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: () => timerState
}))

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Work block task',
  description: '',
  status: 'todo',
  priority: 'medium',
  progress: 0,
  completedPomodoros: 0,
  subtasks: [],
  dueDate: '',
  projectId: 'project-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

describe('useWorkBlockProgress', () => {
  it('marks a task as enough for today when completed work sessions meet the block', () => {
    timerState.sessions = [{ taskId: 'task-1', duration: 30 * 60, isBreak: false, completedAt: new Date() }]
    timerState.currentSession = null

    const task = ref(makeTask({ estimatedDuration: 30 }))
    const { workedMinutesToday, isEnoughForToday } = useWorkBlockProgress(task)

    expect(workedMinutesToday.value).toBe(30)
    expect(isEnoughForToday.value).toBe(true)
  })

  it('ignores break sessions, other tasks, and sessions from other days', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    timerState.sessions = [
      { taskId: 'task-1', duration: 30 * 60, isBreak: true, completedAt: new Date() },
      { taskId: 'task-2', duration: 30 * 60, isBreak: false, completedAt: new Date() },
      { taskId: 'task-1', duration: 30 * 60, isBreak: false, completedAt: yesterday },
      { taskId: 'task-1', duration: 15 * 60, isBreak: false, completedAt: new Date() }
    ]
    timerState.currentSession = null

    const task = ref(makeTask({ estimatedDuration: 30 }))
    const { workedMinutesToday, isEnoughForToday } = useWorkBlockProgress(task)

    expect(workedMinutesToday.value).toBe(15)
    expect(isEnoughForToday.value).toBe(false)
  })

  it('includes elapsed time from the active work session', () => {
    timerState.sessions = []
    timerState.currentSession = { taskId: 'task-1', duration: 30 * 60, remainingTime: 10 * 60, isBreak: false }

    const task = ref(makeTask({ estimatedDuration: 20 }))
    const { workedMinutesToday, isEnoughForToday } = useWorkBlockProgress(task)

    expect(workedMinutesToday.value).toBe(20)
    expect(isEnoughForToday.value).toBe(true)
  })
})
