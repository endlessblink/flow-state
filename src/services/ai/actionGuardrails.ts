import type { Lane, Subtask, Task, TaskInstance } from '@/types/tasks'

export type AIActionDuplicateDecision =
  | 'create'
  | 'reuse_existing'
  | 'create_anyway_requires_explicit_user_intent'

export interface AIActionIdentity {
  kind: 'task.create' | 'task.subtask.create' | 'lane.create' | 'calendar.schedule_task'
  sourceMessageId: string | null
  targetEntityId: string | null
  scope: string
  fingerprint: string
}

export interface AIActionDuplicateResult<T> {
  decision: AIActionDuplicateDecision
  identity: AIActionIdentity
  existing: T | null
}

export function normalizeAIActionText(value: string | null | undefined): string {
  return (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function normalizeDate(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 10) : ''
}

function stableFingerprint(parts: Record<string, unknown>): string {
  return JSON.stringify(Object.keys(parts).sort().reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = parts[key]
    return acc
  }, {}))
}

function isActiveTask(task: Task): boolean {
  return !task._soft_deleted && task.status !== 'done'
}

function isActiveSubtask(subtask: Subtask): boolean {
  return !subtask.isCompleted
}

function isActiveLane(lane: Lane): boolean {
  const laneRecord = lane as Lane & { is_deleted?: boolean; isDeleted?: boolean }
  return laneRecord.is_deleted !== true && laneRecord.isDeleted !== true
}

export function buildAITaskCreateIdentity(input: {
  sourceMessageId?: unknown
  title: string
  dueDate?: unknown
  parentTaskId?: unknown
  projectId?: unknown
  scope?: string
}): AIActionIdentity {
  const normalizedTitle = normalizeAIActionText(input.title)
  const normalizedDueDate = normalizeDate(input.dueDate)
  const targetEntityId = typeof input.parentTaskId === 'string' && input.parentTaskId
    ? input.parentTaskId
    : null
  const scope = input.scope || (targetEntityId ? `task:${targetEntityId}` : 'tasks')
  return {
    kind: 'task.create',
    sourceMessageId: typeof input.sourceMessageId === 'string' ? input.sourceMessageId : null,
    targetEntityId,
    scope,
    fingerprint: stableFingerprint({
      kind: 'task.create',
      scope,
      targetEntityId,
      title: normalizedTitle,
      dueDate: normalizedDueDate,
      projectId: typeof input.projectId === 'string' ? input.projectId : '',
    }),
  }
}

export function decideAITaskCreate(input: {
  tasks: Task[]
  title: string
  dueDate?: unknown
  parentTaskId?: unknown
  projectId?: unknown
  sourceMessageId?: unknown
  scope?: string
}): AIActionDuplicateResult<Task> {
  const identity = buildAITaskCreateIdentity(input)
  const normalizedTitle = normalizeAIActionText(input.title)
  const normalizedDueDate = normalizeDate(input.dueDate)
  const parentTaskId = typeof input.parentTaskId === 'string' ? input.parentTaskId : null
  const projectId = typeof input.projectId === 'string' ? input.projectId : null
  const existing = input.tasks.find(task => {
    if (!isActiveTask(task)) return false
    if (normalizeAIActionText(task.title) !== normalizedTitle) return false
    if (parentTaskId && task.parentTaskId !== parentTaskId) return false
    if (!parentTaskId && task.parentTaskId) return false
    if (normalizedDueDate && normalizeDate(task.dueDate) !== normalizedDueDate) return false
    if (projectId && task.projectId !== projectId) return false
    return true
  }) ?? null

  return {
    decision: existing ? 'reuse_existing' : 'create',
    identity,
    existing,
  }
}

export function buildAISubtaskCreateIdentity(input: {
  sourceMessageId?: unknown
  parentTaskId: string
  title: string
  scope?: string
}): AIActionIdentity {
  const scope = input.scope || `task:${input.parentTaskId}:subtasks`
  return {
    kind: 'task.subtask.create',
    sourceMessageId: typeof input.sourceMessageId === 'string' ? input.sourceMessageId : null,
    targetEntityId: input.parentTaskId,
    scope,
    fingerprint: stableFingerprint({
      kind: 'task.subtask.create',
      scope,
      targetEntityId: input.parentTaskId,
      title: normalizeAIActionText(input.title),
    }),
  }
}

export function decideAISubtaskCreate(input: {
  parentTask: Task
  title: string
  sourceMessageId?: unknown
  scope?: string
}): AIActionDuplicateResult<Subtask> {
  const identity = buildAISubtaskCreateIdentity({
    parentTaskId: input.parentTask.id,
    title: input.title,
    sourceMessageId: input.sourceMessageId,
    scope: input.scope,
  })
  const normalizedTitle = normalizeAIActionText(input.title)
  const existing = (input.parentTask.subtasks || []).find(subtask =>
    isActiveSubtask(subtask) && normalizeAIActionText(subtask.title) === normalizedTitle
  ) ?? null

  return {
    decision: existing ? 'reuse_existing' : 'create',
    identity,
    existing,
  }
}

export function buildAILaneCreateIdentity(input: {
  sourceMessageId?: unknown
  name: string
  workspaceId?: unknown
  scope?: string
}): AIActionIdentity {
  const workspaceId = typeof input.workspaceId === 'string' ? input.workspaceId : ''
  const scope = input.scope || (workspaceId ? `workspace:${workspaceId}:lanes` : 'lanes')
  return {
    kind: 'lane.create',
    sourceMessageId: typeof input.sourceMessageId === 'string' ? input.sourceMessageId : null,
    targetEntityId: workspaceId || null,
    scope,
    fingerprint: stableFingerprint({
      kind: 'lane.create',
      scope,
      name: normalizeAIActionText(input.name),
      workspaceId,
    }),
  }
}

export function decideAILaneCreate(input: {
  lanes: Lane[]
  name: string
  workspaceId?: unknown
  sourceMessageId?: unknown
  scope?: string
}): AIActionDuplicateResult<Lane> {
  const identity = buildAILaneCreateIdentity(input)
  const normalizedName = normalizeAIActionText(input.name)
  const workspaceId = typeof input.workspaceId === 'string' ? input.workspaceId : null
  const existing = input.lanes.find(lane => {
    if (!isActiveLane(lane)) return false
    if (normalizeAIActionText(lane.name) !== normalizedName) return false
    if (workspaceId && lane.workspaceId !== workspaceId) return false
    return true
  }) ?? null

  return {
    decision: existing ? 'reuse_existing' : 'create',
    identity,
    existing,
  }
}

function normalizeTime(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 5)
}

export function buildAICalendarScheduleTaskIdentity(input: {
  sourceMessageId?: unknown
  taskId: string
  scheduledDate: string
  scheduledTime: string
  duration?: unknown
  scope?: string
}): AIActionIdentity {
  const scope = input.scope || `task:${input.taskId}:calendar`
  return {
    kind: 'calendar.schedule_task',
    sourceMessageId: typeof input.sourceMessageId === 'string' ? input.sourceMessageId : null,
    targetEntityId: input.taskId,
    scope,
    fingerprint: stableFingerprint({
      kind: 'calendar.schedule_task',
      scope,
      targetEntityId: input.taskId,
      scheduledDate: normalizeDate(input.scheduledDate),
      scheduledTime: normalizeTime(input.scheduledTime),
      duration: typeof input.duration === 'number' ? input.duration : 60,
    }),
  }
}

export function decideAICalendarScheduleTask(input: {
  task: Task | null
  taskId: string
  scheduledDate: string
  scheduledTime: string
  duration?: unknown
  sourceMessageId?: unknown
  scope?: string
}): AIActionDuplicateResult<TaskInstance> {
  const duration = typeof input.duration === 'number'
    ? input.duration
    : input.task?.estimatedDuration || 60
  const identity = buildAICalendarScheduleTaskIdentity({
    ...input,
    duration,
  })
  const normalizedDate = normalizeDate(input.scheduledDate)
  const normalizedTime = normalizeTime(input.scheduledTime)
  const existing = input.task?.instances?.find(instance =>
    normalizeDate(instance.scheduledDate) === normalizedDate &&
    normalizeTime(instance.scheduledTime) === normalizedTime &&
    (instance.duration || 60) === duration &&
    instance.status !== 'completed' &&
    instance.status !== 'skipped'
  ) ?? null

  return {
    decision: existing ? 'reuse_existing' : 'create',
    identity,
    existing,
  }
}
