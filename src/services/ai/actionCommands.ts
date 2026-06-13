import type { Lane, Subtask, Task } from '@/types/tasks'
import type { useLaneStore } from '@/stores/lanes'
import type { useTaskStore } from '@/stores/tasks'
import {
  decideAILaneCreate,
  decideAISubtaskCreate,
  decideAITaskCreate,
  type AIActionIdentity,
} from './actionGuardrails'
import {
  clearAICommandAuditStoreForTests,
  getLocalAICommandAuditTrail,
  loadAICommandAuditTrail,
  loadAICommandRollbackSnapshot,
  persistAICommandAuditEntry,
  persistAICommandRollbackSnapshot,
  type AICommandAuditQuery,
  type AICommandRollbackSnapshot,
} from './actionCommandAuditStore'

export type AICommandKind = 'task.create' | 'task.subtask.create' | 'lane.create'
export type AICommandImpact = 'low' | 'medium' | 'high'

export type AITaskCreateCommand = {
  id: string
  kind: 'task.create'
  title: string
  priority?: Task['priority']
  description?: string
  dueDate?: string
  parentTaskId?: string | null
  projectId?: string | null
  confidence?: number
  impact?: AICommandImpact
}

export type AISubtaskCreateCommand = {
  id: string
  kind: 'task.subtask.create'
  parentTaskId: string
  title: string
  description?: string
  confidence?: number
  impact?: AICommandImpact
}

export type AILaneCreateCommand = {
  id: string
  kind: 'lane.create'
  name: string
  color?: string
  workspaceId?: string | null
  confidence?: number
  impact?: AICommandImpact
}

export type AICommand = AITaskCreateCommand | AISubtaskCreateCommand | AILaneCreateCommand

export type AICommandDiff = {
  entityType: 'task' | 'subtask' | 'lane'
  before: Record<string, unknown> | null
  after: Record<string, unknown>
}

export type AICommandPreviewItem = {
  id: string
  kind: AICommandKind
  status: 'will_create' | 'will_reuse_existing' | 'blocked_requires_approval'
  identity: AIActionIdentity
  diff: AICommandDiff
  duplicateOf?: string
  requiresExplicitApproval: boolean
}

export type AICommandBatch = {
  id: string
  sourcePrompt: string
  sourceRunId: string
  sourceMessageId: string
  dataUsed: Record<string, unknown>
  commands: AICommand[]
  preview: {
    commands: AICommandPreviewItem[]
  }
  createdAt: string
}

export type AppliedAICommand = AICommandPreviewItem & {
  result: 'created' | 'reused_existing'
  entityId: string
}

export type RejectedAICommand = AICommandPreviewItem & {
  reason: 'not_selected' | 'requires_explicit_approval'
}

export type AICommandAuditEntry = {
  batchId: string
  sourcePrompt: string
  sourceRunId: string
  sourceMessageId: string
  dataUsed: Record<string, unknown>
  commandsApplied: AppliedAICommand[]
  commandsRejected: RejectedAICommand[]
  timestamp: string
  rollbackPointer: string
}

export type AICommandApplyResult = AICommandAuditEntry & {
  appliedCommands: AppliedAICommand[]
  rejectedCommands: RejectedAICommand[]
}

type TaskStore = ReturnType<typeof useTaskStore>
type LaneStore = ReturnType<typeof useLaneStore>

export {
  clearAICommandAuditStoreForTests,
  loadAICommandAuditTrail,
  type AICommandAuditQuery,
  type AICommandRollbackSnapshot,
}

function cloneTask(task: Task): Task {
  return JSON.parse(JSON.stringify(task)) as Task
}

function cloneTasks(tasks: Task[]): Task[] {
  return tasks.map(cloneTask)
}

function cloneLane(lane: Lane): Lane {
  return JSON.parse(JSON.stringify(lane)) as Lane
}

function cloneLanes(lanes: Lane[]): Lane[] {
  return lanes.map(cloneLane)
}

function commandRequiresApproval(command: AICommand): boolean {
  return (command.confidence !== undefined && command.confidence < 0.5) || command.impact === 'high'
}

function generateBatchId(sourceRunId: string, sourceMessageId: string): string {
  return `ai-batch:${sourceRunId}:${sourceMessageId}:${Date.now()}`
}

function previewCommand(command: AICommand, input: {
  tasks: Task[]
  lanes: Lane[]
  sourceMessageId: string
}): AICommandPreviewItem {
  const { tasks, lanes, sourceMessageId } = input
  const requiresExplicitApproval = commandRequiresApproval(command)
  if (command.kind === 'task.create') {
    const decision = decideAITaskCreate({
      tasks,
      title: command.title,
      dueDate: command.dueDate,
      parentTaskId: command.parentTaskId,
      projectId: command.projectId,
      sourceMessageId,
    })
    return {
      id: command.id,
      kind: command.kind,
      status: requiresExplicitApproval
        ? 'blocked_requires_approval'
        : decision.existing ? 'will_reuse_existing' : 'will_create',
      identity: decision.identity,
      duplicateOf: decision.existing?.id,
      requiresExplicitApproval,
      diff: {
        entityType: 'task',
        before: decision.existing ? { id: decision.existing.id, title: decision.existing.title } : null,
        after: {
          title: command.title,
          priority: command.priority || 'medium',
          description: command.description || '',
          dueDate: command.dueDate || '',
          parentTaskId: command.parentTaskId || null,
          projectId: command.projectId || undefined,
        },
      },
    }
  }

  if (command.kind === 'lane.create') {
    const decision = decideAILaneCreate({
      lanes,
      name: command.name,
      workspaceId: command.workspaceId,
      sourceMessageId,
    })
    return {
      id: command.id,
      kind: command.kind,
      status: requiresExplicitApproval
        ? 'blocked_requires_approval'
        : decision.existing ? 'will_reuse_existing' : 'will_create',
      identity: decision.identity,
      duplicateOf: decision.existing?.id,
      requiresExplicitApproval,
      diff: {
        entityType: 'lane',
        before: decision.existing ? { id: decision.existing.id, name: decision.existing.name } : null,
        after: {
          name: command.name,
          color: command.color || '#4ECDC4',
          workspaceId: command.workspaceId ?? null,
        },
      },
    }
  }

  const parentTask = tasks.find(task => task.id === command.parentTaskId)
  const decision = parentTask
    ? decideAISubtaskCreate({
      parentTask,
      title: command.title,
      sourceMessageId,
    })
    : null
  return {
    id: command.id,
    kind: command.kind,
    status: requiresExplicitApproval
      ? 'blocked_requires_approval'
      : decision?.existing ? 'will_reuse_existing' : 'will_create',
    identity: decision?.identity ?? {
      kind: 'task.subtask.create',
      sourceMessageId,
      targetEntityId: command.parentTaskId,
      scope: `task:${command.parentTaskId}:subtasks`,
      fingerprint: JSON.stringify({
        kind: command.kind,
        parentTaskId: command.parentTaskId,
        title: command.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase(),
      }),
    },
    duplicateOf: decision?.existing?.id,
    requiresExplicitApproval,
    diff: {
      entityType: 'subtask',
      before: decision?.existing ? { id: decision.existing.id, title: decision.existing.title } : null,
      after: {
        parentTaskId: command.parentTaskId,
        title: command.title,
        description: command.description || '',
      },
    },
  }
}

export function buildAICommandBatchPreview(input: {
  sourcePrompt: string
  sourceRunId: string
  sourceMessageId: string
  dataUsed: Record<string, unknown>
  commands: AICommand[]
  tasks: Task[]
  lanes?: Lane[]
}): AICommandBatch {
  return {
    id: generateBatchId(input.sourceRunId, input.sourceMessageId),
    sourcePrompt: input.sourcePrompt,
    sourceRunId: input.sourceRunId,
    sourceMessageId: input.sourceMessageId,
    dataUsed: input.dataUsed,
    commands: input.commands,
    preview: {
      commands: input.commands.map(command => previewCommand(command, {
        tasks: input.tasks,
        lanes: input.lanes || [],
        sourceMessageId: input.sourceMessageId,
      })),
    },
    createdAt: new Date().toISOString(),
  }
}

function getPreview(batch: AICommandBatch, commandId: string): AICommandPreviewItem {
  const preview = batch.preview.commands.find(item => item.id === commandId)
  if (!preview) throw new Error(`Missing preview for AI command ${commandId}`)
  return preview
}

async function applyTaskCreate(command: AITaskCreateCommand, taskStore: TaskStore, sourceMessageId: string): Promise<AppliedAICommand> {
  const decision = decideAITaskCreate({
    tasks: taskStore.tasks,
    title: command.title,
    dueDate: command.dueDate,
    parentTaskId: command.parentTaskId,
    projectId: command.projectId,
    sourceMessageId,
  })
  const preview = previewCommand(command, {
    tasks: taskStore.tasks,
    lanes: [],
    sourceMessageId,
  })
  if (decision.existing) {
    return {
      ...preview,
      result: 'reused_existing',
      entityId: decision.existing.id,
      duplicateOf: decision.existing.id,
    }
  }

  const created = await taskStore.createTask({
    title: command.title,
    priority: command.priority || 'medium',
    description: command.description || '',
    dueDate: command.dueDate || '',
    parentTaskId: command.parentTaskId || undefined,
    projectId: command.projectId || undefined,
  })
  return {
    ...preview,
    result: 'created',
    entityId: created.id,
  }
}

async function applySubtaskCreate(command: AISubtaskCreateCommand, taskStore: TaskStore, sourceMessageId: string): Promise<AppliedAICommand> {
  const parentTask = taskStore.tasks.find(task => task.id === command.parentTaskId)
  if (!parentTask) throw new Error(`Parent task ${command.parentTaskId} not found`)
  const decision = decideAISubtaskCreate({
    parentTask,
    title: command.title,
    sourceMessageId,
  })
  const preview = previewCommand(command, {
    tasks: taskStore.tasks,
    lanes: [],
    sourceMessageId,
  })
  if (decision.existing) {
    return {
      ...preview,
      result: 'reused_existing',
      entityId: decision.existing.id,
      duplicateOf: decision.existing.id,
    }
  }

  const created = await taskStore.createSubtask(command.parentTaskId, {
    title: command.title,
    description: command.description || '',
  })
  if (!created) throw new Error(`Failed to create subtask under ${command.parentTaskId}`)
  return {
    ...preview,
    result: 'created',
    entityId: created.id,
  }
}

async function applyLaneCreate(command: AILaneCreateCommand, laneStore: LaneStore, sourceMessageId: string): Promise<AppliedAICommand> {
  const decision = decideAILaneCreate({
    lanes: laneStore.lanes,
    name: command.name,
    workspaceId: command.workspaceId,
    sourceMessageId,
  })
  const preview = previewCommand(command, {
    tasks: [],
    lanes: laneStore.lanes,
    sourceMessageId,
  })
  if (decision.existing) {
    return {
      ...preview,
      result: 'reused_existing',
      entityId: decision.existing.id,
      duplicateOf: decision.existing.id,
    }
  }

  const created = await laneStore.createLane({
    name: command.name,
    color: command.color || '#4ECDC4',
    workspaceId: command.workspaceId ?? undefined,
  })
  return {
    ...preview,
    result: 'created',
    entityId: created.id,
  }
}

export async function applyAICommandBatch(batch: AICommandBatch, options: {
  selectedCommandIds: string[]
  taskStore: TaskStore
  laneStore?: LaneStore
  explicitApproval?: boolean
}): Promise<AICommandApplyResult> {
  const selected = new Set(options.selectedCommandIds)
  const tasksBefore = cloneTasks(options.taskStore.tasks)
  const lanesBefore = options.laneStore ? cloneLanes(options.laneStore.lanes) : undefined
  const appliedCommands: AppliedAICommand[] = []
  const rejectedCommands: RejectedAICommand[] = []

  for (const command of batch.commands) {
    const preview = getPreview(batch, command.id)
    if (!selected.has(command.id)) {
      rejectedCommands.push({ ...preview, reason: 'not_selected' })
      continue
    }
    if (preview.requiresExplicitApproval && !options.explicitApproval) {
      rejectedCommands.push({ ...preview, reason: 'requires_explicit_approval' })
      continue
    }

    const applied = command.kind === 'task.create'
      ? await applyTaskCreate(command, options.taskStore, batch.sourceMessageId)
      : command.kind === 'task.subtask.create'
        ? await applySubtaskCreate(command, options.taskStore, batch.sourceMessageId)
        : await applyLaneCreate(
          command,
          options.laneStore ?? missingLaneStore(),
          batch.sourceMessageId,
        )
    appliedCommands.push(applied)
  }

  const rollbackPointer = `ai-rollback:${batch.id}:${Date.now()}`
  await persistAICommandRollbackSnapshot({
    rollbackPointer,
    batchId: batch.id,
    createdAt: new Date().toISOString(),
    tasksBefore,
    lanesBefore,
    appliedEntityIds: appliedCommands.map(command => command.entityId),
  })

  const auditEntry: AICommandAuditEntry = {
    batchId: batch.id,
    sourcePrompt: batch.sourcePrompt,
    sourceRunId: batch.sourceRunId,
    sourceMessageId: batch.sourceMessageId,
    dataUsed: batch.dataUsed,
    commandsApplied: appliedCommands,
    commandsRejected: rejectedCommands,
    timestamp: new Date().toISOString(),
    rollbackPointer,
  }
  await persistAICommandAuditEntry(auditEntry)
  return {
    ...auditEntry,
    appliedCommands,
    rejectedCommands,
  }
}

export function getAICommandAuditTrail(): AICommandAuditEntry[] {
  return getLocalAICommandAuditTrail()
}

export async function rollbackAICommandBatch(rollbackPointer: string, options: {
  taskStore: TaskStore
  laneStore?: LaneStore
}): Promise<void> {
  const snapshot = await loadAICommandRollbackSnapshot(rollbackPointer)
  if (!snapshot) throw new Error(`Rollback snapshot ${rollbackPointer} not found`)

  const beforeIds = new Set(snapshot.tasksBefore.map(task => task.id))
  for (const task of [...options.taskStore.tasks]) {
    if (!beforeIds.has(task.id)) {
      await options.taskStore.deleteTask(task.id, 'ai-command-rollback')
    }
  }

  for (const beforeTask of snapshot.tasksBefore) {
    const existing = options.taskStore.tasks.find(task => task.id === beforeTask.id)
    if (existing) {
      await options.taskStore.updateTask(beforeTask.id, cloneTask(beforeTask))
    } else {
      await options.taskStore.createTask(cloneTask(beforeTask))
    }
  }

  if (options.laneStore && snapshot.lanesBefore) {
    const beforeLaneIds = new Set(snapshot.lanesBefore.map(lane => lane.id))
    for (const lane of [...options.laneStore.lanes]) {
      if (!beforeLaneIds.has(lane.id)) {
        await options.laneStore.deleteLane(lane.id)
      }
    }

    for (const beforeLane of snapshot.lanesBefore) {
      const existing = options.laneStore.lanes.find(lane => lane.id === beforeLane.id)
      if (existing) {
        await options.laneStore.updateLane(beforeLane.id, cloneLane(beforeLane))
      } else {
        await options.laneStore.createLane(cloneLane(beforeLane))
      }
    }
  }
}

function missingLaneStore(): LaneStore {
  throw new Error('laneStore is required to apply AI lane commands')
}
