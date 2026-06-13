import type { CanvasGroup } from '@/types/canvas'
import type { AIContextEntity, AIMemoryPatch, AIRecommendationFeedback, AIRecommendationFeedbackInput } from '@/types/aiMemory'
import type { Lane, Subtask, Task, TaskInstance } from '@/types/tasks'

export type AIActionDuplicateDecision =
  | 'create'
  | 'reuse_existing'
  | 'create_anyway_requires_explicit_user_intent'

export interface AIActionIdentity {
  kind: 'task.create' | 'task.update' | 'task.subtask.create' | 'lane.create' | 'calendar.schedule_task' | 'canvas.group.create' | 'canvas.node.move' | 'memory.patch' | 'memory.feedback.record'
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

function normalizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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

function isActiveCanvasGroup(group: CanvasGroup): boolean {
  const groupRecord = group as CanvasGroup & { is_deleted?: boolean; isDeleted?: boolean }
  return groupRecord.is_deleted !== true && groupRecord.isDeleted !== true && group.isVisible !== false
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

export type AITaskUpdateFields = Pick<Task, 'status' | 'priority' | 'dueDate' | 'projectId' | 'laneId' | 'parentTaskId' | 'description' | 'title'>

function normalizeTaskUpdateValue(value: unknown): unknown {
  if (typeof value === 'string') return value.trim()
  if (value === undefined) return null
  return value
}

function normalizeTaskUpdates(updates: Partial<AITaskUpdateFields>): Partial<AITaskUpdateFields> {
  return Object.keys(updates).sort().reduce<Partial<AITaskUpdateFields>>((acc, key) => {
    const typedKey = key as keyof AITaskUpdateFields
    acc[typedKey] = normalizeTaskUpdateValue(updates[typedKey]) as never
    return acc
  }, {})
}

export function buildAITaskUpdateIdentity(input: {
  sourceMessageId?: unknown
  taskId: string
  updates: Partial<AITaskUpdateFields>
  scope?: string
}): AIActionIdentity {
  const scope = input.scope || `task:${input.taskId}:metadata`
  return {
    kind: 'task.update',
    sourceMessageId: typeof input.sourceMessageId === 'string' ? input.sourceMessageId : null,
    targetEntityId: input.taskId,
    scope,
    fingerprint: stableFingerprint({
      kind: 'task.update',
      scope,
      targetEntityId: input.taskId,
      updates: normalizeTaskUpdates(input.updates),
    }),
  }
}

export function decideAITaskUpdate(input: {
  task: Task | null
  taskId: string
  updates: Partial<AITaskUpdateFields>
  sourceMessageId?: unknown
  scope?: string
}): AIActionDuplicateResult<Task> {
  const identity = buildAITaskUpdateIdentity(input)
  const normalizedUpdates = normalizeTaskUpdates(input.updates)
  const existing = input.task && Object.entries(normalizedUpdates).every(([key, value]) =>
    normalizeTaskUpdateValue(input.task?.[key as keyof Task]) === value
  )
    ? input.task
    : null

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

export function buildAICanvasGroupCreateIdentity(input: {
  sourceMessageId?: unknown
  name: string
  workspaceId?: unknown
  scope?: string
}): AIActionIdentity {
  const workspaceId = typeof input.workspaceId === 'string' ? input.workspaceId : ''
  const scope = input.scope || (workspaceId ? `workspace:${workspaceId}:canvas:groups` : 'canvas:groups')
  return {
    kind: 'canvas.group.create',
    sourceMessageId: typeof input.sourceMessageId === 'string' ? input.sourceMessageId : null,
    targetEntityId: workspaceId || null,
    scope,
    fingerprint: stableFingerprint({
      kind: 'canvas.group.create',
      scope,
      name: normalizeAIActionText(input.name),
      workspaceId,
    }),
  }
}

export function decideAICanvasGroupCreate(input: {
  canvasGroups: CanvasGroup[]
  name: string
  workspaceId?: unknown
  sourceMessageId?: unknown
  scope?: string
}): AIActionDuplicateResult<CanvasGroup> {
  const identity = buildAICanvasGroupCreateIdentity(input)
  const normalizedName = normalizeAIActionText(input.name)
  const workspaceId = typeof input.workspaceId === 'string' ? input.workspaceId : null
  const existing = input.canvasGroups.find(group => {
    if (!isActiveCanvasGroup(group)) return false
    if (normalizeAIActionText(group.name) !== normalizedName) return false
    const groupWorkspaceId = (group as CanvasGroup & { workspaceId?: string | null }).workspaceId
    if (workspaceId && groupWorkspaceId !== workspaceId) return false
    return true
  }) ?? null

  return {
    decision: existing ? 'reuse_existing' : 'create',
    identity,
    existing,
  }
}

type AICanvasNodeMovePosition = {
  x: number
  y: number
  width?: number
  height?: number
}

type AICanvasNodeMoveTarget = Task | CanvasGroup

function normalizeCanvasMovePosition(position: AICanvasNodeMovePosition): Record<string, number | null> {
  return {
    x: normalizeNumber(position.x),
    y: normalizeNumber(position.y),
    width: normalizeNumber(position.width),
    height: normalizeNumber(position.height),
  }
}

function positionMatches(current: {
  x?: number
  y?: number
  width?: number
  height?: number
} | null | undefined, target: AICanvasNodeMovePosition): boolean {
  if (!current) return false
  if (current.x !== target.x || current.y !== target.y) return false
  if (target.width !== undefined && current.width !== target.width) return false
  if (target.height !== undefined && current.height !== target.height) return false
  return true
}

export function buildAICanvasNodeMoveIdentity(input: {
  sourceMessageId?: unknown
  nodeType: 'task' | 'group'
  nodeId: string
  position: AICanvasNodeMovePosition
  parentId?: unknown
  parentGroupId?: unknown
  scope?: string
}): AIActionIdentity {
  const scope = input.scope || `canvas:${input.nodeType}:${input.nodeId}`
  return {
    kind: 'canvas.node.move',
    sourceMessageId: typeof input.sourceMessageId === 'string' ? input.sourceMessageId : null,
    targetEntityId: input.nodeId,
    scope,
    fingerprint: stableFingerprint({
      kind: 'canvas.node.move',
      scope,
      nodeType: input.nodeType,
      targetEntityId: input.nodeId,
      parentId: typeof input.parentId === 'string' ? input.parentId : input.parentId === null ? null : '',
      parentGroupId: typeof input.parentGroupId === 'string' ? input.parentGroupId : input.parentGroupId === null ? null : '',
      ...normalizeCanvasMovePosition(input.position),
    }),
  }
}

export function decideAICanvasNodeMove(input: {
  task?: Task | null
  group?: CanvasGroup | null
  nodeType: 'task' | 'group'
  nodeId: string
  position: AICanvasNodeMovePosition
  parentId?: unknown
  parentGroupId?: unknown
  sourceMessageId?: unknown
  scope?: string
}): AIActionDuplicateResult<AICanvasNodeMoveTarget> {
  const identity = buildAICanvasNodeMoveIdentity(input)
  const existing = input.nodeType === 'task'
    ? input.task
    : input.group
  const isAlreadyMoved = input.nodeType === 'task'
    ? Boolean(
      input.task &&
      positionMatches(input.task.canvasPosition, input.position) &&
      (!('parentId' in input) || input.task.parentId === (input.parentId ?? undefined))
    )
    : Boolean(
      input.group &&
      positionMatches(input.group.position, input.position) &&
      (!('parentGroupId' in input) || input.group.parentGroupId === (input.parentGroupId ?? null))
    )

  return {
    decision: isAlreadyMoved ? 'reuse_existing' : 'create',
    identity,
    existing: isAlreadyMoved ? existing ?? null : null,
  }
}

function aiMemoryEntityKey(patch: AIMemoryPatch): string {
  if (/^(project|task|week|preference|synthetic|workflow):/.test(patch.entityId)) return patch.entityId
  if (patch.entityType === 'synthetic_group') return `synthetic:${patch.entityId}`
  return `${patch.entityType}:${patch.entityId}`
}

function normalizedMemoryValue(value: unknown): string {
  return JSON.stringify(value ?? null)
}

function memoryPatchAlreadyApplied(entity: AIContextEntity | null, patch: AIMemoryPatch): boolean {
  if (!entity) return false
  const current = entity.facts?.[patch.field]
  if (patch.operation === 'confirm') return true
  if (patch.operation === 'set') return normalizedMemoryValue(current) === normalizedMemoryValue(patch.value)
  const currentValues = Array.isArray(current) ? current.map(String) : current === undefined ? [] : [String(current)]
  const patchValues = Array.isArray(patch.value) ? patch.value.map(String) : [String(patch.value)]
  if (patch.operation === 'append') return patchValues.every(value => currentValues.includes(value))
  if (patch.operation === 'deprecate') return patchValues.every(value => currentValues.includes(`Deprecated: ${value}`))
  if (patch.operation === 'reject') return patchValues.every(value => currentValues.includes(`Rejected: ${value}`))
  return false
}

export function buildAIMemoryPatchIdentity(input: {
  sourceMessageId?: unknown
  patch: AIMemoryPatch
  scope?: string
}): AIActionIdentity {
  const entityKey = aiMemoryEntityKey(input.patch)
  const scope = input.scope || `memory:${input.patch.entityType}:${input.patch.entityId}`
  return {
    kind: 'memory.patch',
    sourceMessageId: typeof input.sourceMessageId === 'string' ? input.sourceMessageId : null,
    targetEntityId: input.patch.entityId,
    scope,
    fingerprint: stableFingerprint({
      kind: 'memory.patch',
      scope,
      entityKey,
      entityType: input.patch.entityType,
      entityId: input.patch.entityId,
      operation: input.patch.operation,
      field: input.patch.field,
      value: normalizedMemoryValue(input.patch.value),
      source: input.patch.source,
    }),
  }
}

export function decideAIMemoryPatch(input: {
  memoryEntities: AIContextEntity[]
  patch: AIMemoryPatch
  sourceMessageId?: unknown
  scope?: string
}): AIActionDuplicateResult<AIContextEntity> {
  const identity = buildAIMemoryPatchIdentity(input)
  const entityKey = aiMemoryEntityKey(input.patch)
  const existingEntity = input.memoryEntities.find(entity => entity.entityKey === entityKey) ?? null
  const existing = memoryPatchAlreadyApplied(existingEntity, input.patch) ? existingEntity : null
  return {
    decision: existing ? 'reuse_existing' : 'create',
    identity,
    existing,
  }
}

export function buildAIRecommendationFeedbackIdentity(input: {
  sourceMessageId?: unknown
  feedback: AIRecommendationFeedbackInput
  scope?: string
}): AIActionIdentity {
  const scope = input.scope || (input.feedback.entityKey
    ? `memory:feedback:${input.feedback.entityKey}`
    : input.feedback.taskId
      ? `memory:feedback:task:${input.feedback.taskId}`
      : 'memory:feedback')
  return {
    kind: 'memory.feedback.record',
    sourceMessageId: typeof input.sourceMessageId === 'string' ? input.sourceMessageId : null,
    targetEntityId: input.feedback.taskId ?? input.feedback.entityKey ?? input.feedback.recommendationId,
    scope,
    fingerprint: stableFingerprint({
      kind: 'memory.feedback.record',
      scope,
      generatedPlanId: input.feedback.generatedPlanId ?? '',
      recommendationId: input.feedback.recommendationId,
      taskId: input.feedback.taskId ?? '',
      entityKey: input.feedback.entityKey ?? '',
      action: input.feedback.action,
      reasonCategory: input.feedback.reasonCategory ?? '',
      freeText: normalizeAIActionText(input.feedback.freeText),
      revisitAt: typeof input.feedback.revisitAt === 'string' ? input.feedback.revisitAt : '',
      implicitPositive: Boolean(input.feedback.implicitPositive),
    }),
  }
}

export function decideAIRecommendationFeedback(input: {
  recommendationFeedback: AIRecommendationFeedback[]
  feedback: AIRecommendationFeedbackInput
  sourceMessageId?: unknown
  scope?: string
}): AIActionDuplicateResult<AIRecommendationFeedback> {
  const identity = buildAIRecommendationFeedbackIdentity(input)
  const existing = input.recommendationFeedback.find(feedback => {
    if (feedback.recommendationId !== input.feedback.recommendationId) return false
    if (feedback.action !== input.feedback.action) return false
    if ((feedback.taskId ?? null) !== (input.feedback.taskId ?? null)) return false
    if ((feedback.entityKey ?? null) !== (input.feedback.entityKey ?? null)) return false
    if ((feedback.reasonCategory ?? null) !== (input.feedback.reasonCategory ?? null)) return false
    if (normalizeAIActionText(feedback.freeText) !== normalizeAIActionText(input.feedback.freeText)) return false
    return true
  }) ?? null

  return {
    decision: existing ? 'reuse_existing' : 'create',
    identity,
    existing,
  }
}

export { aiMemoryEntityKey as buildAIMemoryEntityKey }
