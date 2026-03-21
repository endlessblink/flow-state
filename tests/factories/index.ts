/**
 * Test factories for FlowState unit and integration tests.
 *
 * Usage:
 *   import { createMockTask, createMockProject, createMockTimerSession } from '../factories'
 *
 *   const task = createMockTask({ title: 'Custom title', status: 'done' })
 */

import type { Task, Project } from '@/types/tasks'
import type { PomodoroSession } from '@/stores/timer'

let idCounter = 0
function nextId(prefix = 'mock'): string {
  idCounter++
  return `${prefix}-${String(idCounter).padStart(4, '0')}`
}

// ---------------------------------------------------------------------------
// createMockTask
// ---------------------------------------------------------------------------

/**
 * Returns a full Task object with sensible defaults.
 * Pass overrides to customise specific fields.
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  const id = overrides.id ?? nextId('task')
  const now = new Date()

  return {
    id,
    title: 'Mock Task',
    description: '',
    status: 'todo',
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: nextId('project'),
    createdAt: now,
    updatedAt: now,
    isInInbox: false,
    tags: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// createMockProject
// ---------------------------------------------------------------------------

/**
 * Returns a Project object with sensible defaults.
 * Pass overrides to customise specific fields.
 */
export function createMockProject(overrides: Partial<Project> = {}): Project {
  const id = overrides.id ?? nextId('project')
  const now = new Date()

  return {
    id,
    name: 'Mock Project',
    color: '#4ECDC4',
    colorType: 'hex',
    viewType: 'status',
    parentId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// createMockTimerSession
// ---------------------------------------------------------------------------

/**
 * Returns a PomodoroSession object with sensible defaults.
 * Pass overrides to customise specific fields.
 */
export function createMockTimerSession(
  overrides: Partial<PomodoroSession> = {}
): PomodoroSession {
  const id = overrides.id ?? nextId('session')
  const now = new Date()

  return {
    id,
    taskId: nextId('task'),
    startTime: now,
    duration: 25 * 60,       // 25 minutes in seconds
    remainingTime: 25 * 60,
    isActive: false,
    isPaused: false,
    isBreak: false,
    completedAt: undefined,
    deviceLeaderId: null,
    deviceLeaderLastSeen: null,
    ...overrides,
  }
}
