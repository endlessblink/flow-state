/**
 * Example: Complete Task Interface with All Required Properties
 * This shows what the Task interface should look like after restoration
 */

export interface Task {
  // Core Properties
  id: string
  title: string
  description: string

  // Status and Priority
  status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | null

  // Progress Tracking
  progress: number
  completedPomodoros: number

  // Subtasks
  subtasks: Subtask[]

  // Scheduling Properties (Previously Missing)
  dueDate: string
  scheduledDate: string  // ADD: Was missing
  scheduledTime: string  // ADD: Was missing
  estimatedDuration: number  // ADD: Was missing (in minutes)
  estimatedPomodoros: number  // ADD: Was missing

  // Project Organization
  projectId: string
  parentTaskId?: string | null

  // Task Lifecycle
  isUncategorized: boolean  // ADD: Was missing
  isInInbox?: boolean  // Canvas specific

  // Task Dependencies
  dependsOn?: string[]

  // Calendar Integration (Previously Missing)
  instances?: TaskInstance[]  // ADD: Was missing

  // Canvas Positioning
  canvasPosition?: { x: number; y: number }

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface Subtask {
  id: string
  title: string
  description: string
  isCompleted: boolean
  completedPomodoros: number
  createdAt: Date
  updatedAt: Date
}

export interface TaskInstance {
  id: string
  taskId: string
  scheduledDate: string
  scheduledTime: string
  duration: number
  completedPomodoros: number
  isCompleted: boolean
  createdAt: Date
  updatedAt: Date
}

// Example usage in components:
const exampleTask: Task = {
  id: 'task-123',
  title: 'Complete TypeScript fixes',
  description: 'Fix all TypeScript compilation errors',
  status: 'planned',
  priority: 'high',
  progress: 0,
  completedPomodoros: 0,
  subtasks: [],
  dueDate: '2025-11-10',
  scheduledDate: '2025-11-08',
  scheduledTime: '14:00',
  estimatedDuration: 60,
  estimatedPomodoros: 2,
  isUncategorized: true,
  projectId: 'project-1',
  instances: [
    {
      id: 'instance-456',
      taskId: 'task-123',
      scheduledDate: '2025-11-08',
      scheduledTime: '14:00',
      duration: 60,
      completedPomodoros: 0,
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  dependsOn: ['task-789'],
  canvasPosition: { x: 100, y: 200 },
  createdAt: new Date(),
  updatedAt: new Date()
}