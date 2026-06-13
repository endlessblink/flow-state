import type { Subtask, Task } from '@/types/tasks'
import type { useTaskStore } from '@/stores/tasks'
import {
  decideAISubtaskCreate,
  decideAITaskCreate,
  type AIActionIdentity,
} from './actionGuardrails'

const AI_COMMAND_AUDIT_KEY = 'flowstate-ai-command-audit-trail'
const AI_COMMAND_ROLLBACK_KEY = 'flowstate-ai-command-rollback-snapshots'

export type AICommandKind = 'task.create' | 'task.subtask.create'
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

export type AICommand = AITaskCreateCommand | AISubtaskCreateCommand

export type AICommandDiff = {
  entityType: 'task' | 'subtask'
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

type RollbackSnapshot = {
  rollbackPointer: string
  tasksBefore: Task[]
  appliedEntityIds: string[]
}

function readJsonArray<T>(key: string): T[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T[] : []
  } catch {
    return []
  }
}

function writeJsonArray<T>(key: string, value: T[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function cloneTask(task: Task): Task {
  return JSON.parse(JSON.stringify(task)) as Task
}

function cloneTasks(tasks: Task[]): Task[] {
  return tasks.map(cloneTask)
}

function commandRequiresApproval(command: AICommand): boolean {
  return (command.confidence !== undefined && command.confidence < 0.5) || command.impact === 'high'
}

function generateBatchId(sourceRunId: string, sourceMessageId: string): string {
  return `ai-batch:${sourceRunId}:${sourceMessageId}:${Date.now()}`
}

function previewCommand(command: AICommand, tasks: Task[], sourceMessageId: string): AICommandPreviewItem {
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
}): AICommandBatch {
  return {
    id: generateBatchId(input.sourceRunId, input.sourceMessageId),
    sourcePrompt: input.sourcePrompt,
    sourceRunId: input.sourceRunId,
    sourceMessageId: input.sourceMessageId,
    dataUsed: input.dataUsed,
    commands: input.commands,
    preview: {
      commands: input.commands.map(command => previewCommand(command, input.tasks, input.sourceMessageId)),
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
  const preview = previewCommand(command, taskStore.tasks, sourceMessageId)
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
  const preview = previewCommand(command, taskStore.tasks, sourceMessageId)
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

function persistAudit(entry: AICommandAuditEntry): void {
  const entries = readJsonArray<AICommandAuditEntry>(AI_COMMAND_AUDIT_KEY)
  entries.unshift(entry)
  writeJsonArray(AI_COMMAND_AUDIT_KEY, entries.slice(0, 50))
}

function persistRollback(snapshot: RollbackSnapshot): void {
  const snapshots = readJsonArray<RollbackSnapshot>(AI_COMMAND_ROLLBACK_KEY)
  snapshots.unshift(snapshot)
  writeJsonArray(AI_COMMAND_ROLLBACK_KEY, snapshots.slice(0, 20))
}

export async function applyAICommandBatch(batch: AICommandBatch, options: {
  selectedCommandIds: string[]
  taskStore: TaskStore
  explicitApproval?: boolean
}): Promise<AICommandApplyResult> {
  const selected = new Set(options.selectedCommandIds)
  const tasksBefore = cloneTasks(options.taskStore.tasks)
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
      : await applySubtaskCreate(command, options.taskStore, batch.sourceMessageId)
    appliedCommands.push(applied)
  }

  const rollbackPointer = `ai-rollback:${batch.id}:${Date.now()}`
  persistRollback({
    rollbackPointer,
    tasksBefore,
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
  persistAudit(auditEntry)
  return {
    ...auditEntry,
    appliedCommands,
    rejectedCommands,
  }
}

export function getAICommandAuditTrail(): AICommandAuditEntry[] {
  return readJsonArray<AICommandAuditEntry>(AI_COMMAND_AUDIT_KEY)
}

export async function rollbackAICommandBatch(rollbackPointer: string, options: {
  taskStore: TaskStore
}): Promise<void> {
  const snapshots = readJsonArray<RollbackSnapshot>(AI_COMMAND_ROLLBACK_KEY)
  const snapshot = snapshots.find(item => item.rollbackPointer === rollbackPointer)
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
}
