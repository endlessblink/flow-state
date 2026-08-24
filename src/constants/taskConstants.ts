export const TASK_STATUS = {
  TODO: 'todo',
  DONE: 'done',
} as const

export type TaskStatusValue = typeof TASK_STATUS[keyof typeof TASK_STATUS]

export const TASK_PRIORITY = {
  IMMEDIATE: 'immediate',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  RELAXED: 'relaxed',
} as const

export type TaskPriorityValue = typeof TASK_PRIORITY[keyof typeof TASK_PRIORITY]

export const TASK_STATUS_OPTIONS = Object.values(TASK_STATUS)
export const TASK_PRIORITY_OPTIONS = Object.values(TASK_PRIORITY)
