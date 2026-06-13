import type { Subtask, Task } from '@/types/tasks'

export type AIActionDuplicateDecision =
  | 'create'
  | 'reuse_existing'
  | 'create_anyway_requires_explicit_user_intent'

export interface AIActionIdentity {
  kind: 'task.create' | 'task.subtask.create'
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
