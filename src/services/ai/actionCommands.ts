import type { CanvasGroup } from '@/types/canvas'
import type { AIContextEntity, AIMemoryPatch, AIMemorySnapshot, AIParameterBelief, AIRecommendationFeedback, AIRecommendationFeedbackInput } from '@/types/aiMemory'
import type { Lane, Subtask, Task } from '@/types/tasks'
import type { useCanvasStore } from '@/stores/canvas'
import type { useLaneStore } from '@/stores/lanes'
import type { useTaskStore } from '@/stores/tasks'
import type { PomodoroSession, useTimerStore } from '@/stores/timer'
import {
  buildAITaskDeleteIdentity,
  buildAIMemoryEntityKey,
  decideAICanvasGroupCreate,
  decideAICanvasNodeMove,
  decideAICalendarScheduleTask,
  decideAIFocusTimerStart,
  decideAIFocusTimerStop,
  decideAIMemoryPatch,
  decideAIRecommendationFeedback,
  decideAILaneCreate,
  decideAISubtaskCreate,
  decideAITaskCreate,
  decideAITaskUpdate,
  type AITaskUpdateFields,
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

export type AICommandKind = 'task.create' | 'task.update' | 'task.delete' | 'task.subtask.create' | 'lane.create' | 'calendar.schedule_task' | 'focus.timer.start' | 'focus.timer.stop' | 'canvas.group.create' | 'canvas.node.move' | 'memory.patch' | 'memory.feedback.record'
export type AICommandImpact = 'low' | 'medium' | 'high'

export type AITaskCreateCommand = {
  id: string
  kind: 'task.create'
  title: string
  priority?: Task['priority']
  description?: string
  dueDate?: string
  laneId?: string | null
  parentTaskId?: string | null
  projectId?: string | null
  allowDuplicate?: boolean
  confidence?: number
  impact?: AICommandImpact
}

export type AITaskUpdateCommand = {
  id: string
  kind: 'task.update'
  taskId: string
  updates: Partial<AITaskUpdateFields>
  confidence?: number
  impact?: AICommandImpact
}

export type AITaskDeleteCommand = {
  id: string
  kind: 'task.delete'
  taskId: string
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

export type AICalendarScheduleTaskCommand = {
  id: string
  kind: 'calendar.schedule_task'
  taskId: string
  scheduledDate: string
  scheduledTime: string
  duration?: number
  confidence?: number
  impact?: AICommandImpact
}

export type AIFocusTimerStartCommand = {
  id: string
  kind: 'focus.timer.start'
  taskId: string
  durationMinutes: number
  confidence?: number
  impact?: AICommandImpact
}

export type AIFocusTimerStopCommand = {
  id: string
  kind: 'focus.timer.stop'
  confidence?: number
  impact?: AICommandImpact
}

export type AICanvasGroupCreateCommand = {
  id: string
  kind: 'canvas.group.create'
  name: string
  groupType?: CanvasGroup['type']
  position?: CanvasGroup['position']
  color?: string
  layout?: CanvasGroup['layout']
  workspaceId?: string | null
  confidence?: number
  impact?: AICommandImpact
}

export type AICanvasNodeMoveCommand = {
  id: string
  kind: 'canvas.node.move'
  nodeType: 'task' | 'group'
  nodeId: string
  position: {
    x: number
    y: number
    width?: number
    height?: number
  }
  parentId?: string | null
  parentGroupId?: string | null
  confidence?: number
  impact?: AICommandImpact
}

export type AIMemoryPatchCommand = {
  id: string
  kind: 'memory.patch'
  patch: AIMemoryPatch
  confidence?: number
  impact?: AICommandImpact
}

export type AIRecommendationFeedbackCommand = {
  id: string
  kind: 'memory.feedback.record'
  feedback: AIRecommendationFeedbackInput
  confidence?: number
  impact?: AICommandImpact
}

export type AICommand =
  | AITaskCreateCommand
  | AITaskUpdateCommand
  | AITaskDeleteCommand
  | AISubtaskCreateCommand
  | AILaneCreateCommand
  | AICalendarScheduleTaskCommand
  | AIFocusTimerStartCommand
  | AIFocusTimerStopCommand
  | AICanvasGroupCreateCommand
  | AICanvasNodeMoveCommand
  | AIMemoryPatchCommand
  | AIRecommendationFeedbackCommand

export type AICommandDiff = {
  entityType: 'task' | 'subtask' | 'lane' | 'calendar' | 'focus' | 'canvas_group' | 'canvas_layout' | 'memory' | 'memory_feedback'
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
type CanvasStore = ReturnType<typeof useCanvasStore>
type TimerStore = Pick<ReturnType<typeof useTimerStore>, 'currentSession' | 'isTimerActive' | 'currentTaskName' | 'startTimer' | 'stopTimer'>
export type AICommandMemoryRollbackSnapshot = {
  contextEntities?: AIContextEntity[]
  recommendationFeedback?: AIRecommendationFeedback[]
  parameterBeliefs?: AIParameterBelief[]
  memorySnapshots?: AIMemorySnapshot[]
}
export type AICommandMemoryStore = {
  applyAIMemoryPatch: (patch: AIMemoryPatch) => Promise<void>
  recordAIRecommendationFeedback: (feedback: AIRecommendationFeedbackInput) => Promise<void>
  fetchAIContextEntities?: (entityKeys: string[]) => Promise<AIContextEntity[]>
  fetchAIRecommendationFeedback?: (query: {
    recommendationIds?: string[]
    taskIds?: string[]
    entityKeys?: string[]
    limit?: number
  }) => Promise<AIRecommendationFeedback[]>
  createAICommandMemorySnapshot?: () => Promise<AICommandMemoryRollbackSnapshot>
  restoreAICommandMemorySnapshot?: (snapshot: AICommandMemoryRollbackSnapshot) => Promise<void>
}

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

function cloneCanvasGroup(group: CanvasGroup): CanvasGroup {
  return JSON.parse(JSON.stringify(group)) as CanvasGroup
}

function cloneCanvasGroups(groups: CanvasGroup[]): CanvasGroup[] {
  return groups.map(cloneCanvasGroup)
}

function cloneTimerSession(session: PomodoroSession | null): PomodoroSession | null {
  return session ? JSON.parse(JSON.stringify(session)) as PomodoroSession : null
}

function cloneMemorySnapshot(snapshot: AICommandMemoryRollbackSnapshot): AICommandMemoryRollbackSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as AICommandMemoryRollbackSnapshot
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
  canvasGroups: CanvasGroup[]
  timerSession?: PomodoroSession | null
  memoryEntities: AIContextEntity[]
  recommendationFeedback: AIRecommendationFeedback[]
  sourceMessageId: string
}): AICommandPreviewItem {
  const { tasks, lanes, canvasGroups, memoryEntities, recommendationFeedback, sourceMessageId } = input
  const timerSession = input.timerSession ?? null
  const requiresExplicitApproval = commandRequiresApproval(command)
  if (command.kind === 'task.create') {
    const decision = command.allowDuplicate
      ? null
      : decideAITaskCreate({
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
        : decision?.existing ? 'will_reuse_existing' : 'will_create',
      identity: decision?.identity ?? {
        kind: 'task.create',
        sourceMessageId,
        targetEntityId: null,
        scope: command.parentTaskId ? `task:${command.parentTaskId}:subtasks` : 'tasks:root',
        fingerprint: `manual-duplicate:${command.id}`,
      },
      duplicateOf: decision?.existing?.id,
      requiresExplicitApproval,
      diff: {
        entityType: 'task',
        before: decision?.existing ? { id: decision.existing.id, title: decision.existing.title } : null,
        after: {
          title: command.title,
          priority: command.priority || 'medium',
          description: command.description || '',
          dueDate: command.dueDate || '',
          laneId: command.laneId ?? null,
          parentTaskId: command.parentTaskId || null,
          projectId: command.projectId || undefined,
        },
      },
    }
  }

  if (command.kind === 'task.update') {
    const task = tasks.find(task => task.id === command.taskId) ?? null
    const decision = decideAITaskUpdate({
      task,
      taskId: command.taskId,
      updates: command.updates,
      sourceMessageId,
    })
    const before = task
      ? Object.keys(command.updates).reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = task[key as keyof Task] ?? null
        return acc
      }, { id: task.id, title: task.title })
      : null
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
        before,
        after: {
          id: command.taskId,
          ...command.updates,
        },
      },
    }
  }

  if (command.kind === 'task.delete') {
    const task = tasks.find(task => task.id === command.taskId) ?? null
    const identity = buildAITaskDeleteIdentity({
      taskId: command.taskId,
      sourceMessageId,
    })
    return {
      id: command.id,
      kind: command.kind,
      status: requiresExplicitApproval
        ? 'blocked_requires_approval'
        : task ? 'will_create' : 'will_reuse_existing',
      identity,
      duplicateOf: task ? undefined : command.taskId,
      requiresExplicitApproval,
      diff: {
        entityType: 'task',
        before: task
          ? {
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate || null,
          }
          : null,
        after: {
          id: command.taskId,
          deleted: true,
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

  if (command.kind === 'calendar.schedule_task') {
    const task = tasks.find(task => task.id === command.taskId) ?? null
    const effectiveDuration = command.duration || task?.estimatedDuration || 60
    const decision = decideAICalendarScheduleTask({
      task,
      taskId: command.taskId,
      scheduledDate: command.scheduledDate,
      scheduledTime: command.scheduledTime,
      duration: command.duration,
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
        entityType: 'calendar',
        before: decision.existing
          ? {
            id: decision.existing.id,
            taskId: command.taskId,
            scheduledDate: decision.existing.scheduledDate,
            scheduledTime: decision.existing.scheduledTime,
            duration: decision.existing.duration,
          }
          : null,
        after: {
          taskId: command.taskId,
          scheduledDate: command.scheduledDate,
          scheduledTime: command.scheduledTime,
          duration: effectiveDuration,
          status: 'scheduled',
        },
      },
    }
  }

  if (command.kind === 'focus.timer.start') {
    const task = tasks.find(task => task.id === command.taskId) ?? null
    const durationMinutes = Math.max(1, Math.round(command.durationMinutes || 25))
    const decision = decideAIFocusTimerStart({
      currentSession: timerSession,
      taskId: command.taskId,
      durationMinutes,
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
        entityType: 'focus',
        before: timerSession
          ? {
            id: timerSession.id,
            taskId: timerSession.taskId,
            duration: timerSession.duration,
            remainingTime: timerSession.remainingTime,
            isActive: timerSession.isActive,
            isPaused: timerSession.isPaused,
            isBreak: timerSession.isBreak,
          }
          : null,
        after: {
          taskId: command.taskId,
          taskTitle: task?.title ?? null,
          durationMinutes,
          durationSeconds: durationMinutes * 60,
          status: 'active',
        },
      },
    }
  }

  if (command.kind === 'focus.timer.stop') {
    const decision = decideAIFocusTimerStop({
      currentSession: timerSession,
      sourceMessageId,
    })
    return {
      id: command.id,
      kind: command.kind,
      status: requiresExplicitApproval
        ? 'blocked_requires_approval'
        : timerSession?.isActive ? 'will_create' : 'will_reuse_existing',
      identity: decision.identity,
      duplicateOf: timerSession?.isActive ? undefined : (timerSession?.id ?? 'focus:inactive'),
      requiresExplicitApproval,
      diff: {
        entityType: 'focus',
        before: timerSession
          ? {
            id: timerSession.id,
            taskId: timerSession.taskId,
            duration: timerSession.duration,
            remainingTime: timerSession.remainingTime,
            isActive: timerSession.isActive,
            isPaused: timerSession.isPaused,
            isBreak: timerSession.isBreak,
          }
          : null,
        after: { stopped: true },
      },
    }
  }

  if (command.kind === 'canvas.group.create') {
    const decision = decideAICanvasGroupCreate({
      canvasGroups,
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
        entityType: 'canvas_group',
        before: decision.existing
          ? {
            id: decision.existing.id,
            name: decision.existing.name,
            position: decision.existing.position,
          }
          : null,
        after: {
          name: command.name,
          type: command.groupType || 'custom',
          position: command.position || { x: 0, y: 0, width: 400, height: 300 },
          color: command.color || '#4ECDC4',
          layout: command.layout || 'vertical',
          workspaceId: command.workspaceId ?? null,
        },
      },
    }
  }

  if (command.kind === 'canvas.node.move') {
    const task = command.nodeType === 'task'
      ? tasks.find(task => task.id === command.nodeId) ?? null
      : null
    const group = command.nodeType === 'group'
      ? canvasGroups.find(group => group.id === command.nodeId) ?? null
      : null
    const decision = decideAICanvasNodeMove({
      task,
      group,
      nodeType: command.nodeType,
      nodeId: command.nodeId,
      position: command.position,
      parentId: command.parentId,
      parentGroupId: command.parentGroupId,
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
        entityType: 'canvas_layout',
        before: command.nodeType === 'task'
          ? task
            ? {
              id: task.id,
              nodeType: 'task',
              position: task.canvasPosition ?? null,
              parentId: task.parentId ?? null,
            }
            : null
          : group
            ? {
              id: group.id,
              nodeType: 'group',
              position: group.position,
              parentGroupId: group.parentGroupId ?? null,
            }
            : null,
        after: command.nodeType === 'task'
          ? {
            id: command.nodeId,
            nodeType: command.nodeType,
            position: command.position,
            parentId: command.parentId ?? null,
          }
          : {
            id: command.nodeId,
            nodeType: command.nodeType,
            position: command.position,
            parentGroupId: command.parentGroupId ?? null,
          },
      },
    }
  }

  if (command.kind === 'memory.patch') {
    const entityKey = buildAIMemoryEntityKey(command.patch)
    const existingEntity = memoryEntities.find(entity => entity.entityKey === entityKey) ?? null
    const decision = decideAIMemoryPatch({
      memoryEntities,
      patch: command.patch,
      sourceMessageId,
    })
    return {
      id: command.id,
      kind: command.kind,
      status: requiresExplicitApproval
        ? 'blocked_requires_approval'
        : decision.existing ? 'will_reuse_existing' : 'will_create',
      identity: decision.identity,
      duplicateOf: decision.existing?.id ?? decision.existing?.entityKey,
      requiresExplicitApproval,
      diff: {
        entityType: 'memory',
        before: existingEntity
          ? {
            entityKey: existingEntity.entityKey,
            entityType: existingEntity.entityType,
            field: command.patch.field,
            value: existingEntity.facts?.[command.patch.field] ?? null,
          }
          : null,
        after: {
          entityKey,
          entityType: command.patch.entityType,
          entityId: command.patch.entityId,
          operation: command.patch.operation,
          field: command.patch.field,
          value: command.patch.value,
          confidence: command.patch.confidence,
          source: command.patch.source,
        },
      },
    }
  }

  if (command.kind === 'memory.feedback.record') {
    const decision = decideAIRecommendationFeedback({
      recommendationFeedback,
      feedback: {
        ...command.feedback,
        sourceMessageId: command.feedback.sourceMessageId ?? sourceMessageId,
      },
      sourceMessageId,
    })
    return {
      id: command.id,
      kind: command.kind,
      status: requiresExplicitApproval
        ? 'blocked_requires_approval'
        : decision.existing ? 'will_reuse_existing' : 'will_create',
      identity: decision.identity,
      duplicateOf: decision.existing?.id ?? decision.existing?.recommendationId,
      requiresExplicitApproval,
      diff: {
        entityType: 'memory_feedback',
        before: decision.existing
          ? {
            recommendationId: decision.existing.recommendationId,
            taskId: decision.existing.taskId,
            entityKey: decision.existing.entityKey,
            action: decision.existing.action,
            reasonCategory: decision.existing.reasonCategory,
          }
          : null,
        after: {
          ...command.feedback,
          sourceMessageId: command.feedback.sourceMessageId ?? sourceMessageId,
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
  canvasGroups?: CanvasGroup[]
  timerSession?: PomodoroSession | null
  memoryEntities?: AIContextEntity[]
  recommendationFeedback?: AIRecommendationFeedback[]
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
        canvasGroups: input.canvasGroups || [],
        timerSession: input.timerSession ?? null,
        memoryEntities: input.memoryEntities || [],
        recommendationFeedback: input.recommendationFeedback || [],
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
  const decision = command.allowDuplicate
    ? null
    : decideAITaskCreate({
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
    canvasGroups: [],
    memoryEntities: [],
    recommendationFeedback: [],
    sourceMessageId,
  })
  if (decision?.existing) {
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
    laneId: command.laneId ?? undefined,
    parentTaskId: command.parentTaskId || undefined,
    projectId: command.projectId || undefined,
  })
  return {
    ...preview,
    result: 'created',
    entityId: created.id,
  }
}

async function applyTaskUpdate(command: AITaskUpdateCommand, taskStore: TaskStore, sourceMessageId: string): Promise<AppliedAICommand> {
  const task = taskStore.tasks.find(task => task.id === command.taskId) ?? null
  if (!task) throw new Error(`Task ${command.taskId} not found`)
  const decision = decideAITaskUpdate({
    task,
    taskId: command.taskId,
    updates: command.updates,
    sourceMessageId,
  })
  const preview = previewCommand(command, {
    tasks: taskStore.tasks,
    lanes: [],
    canvasGroups: [],
    memoryEntities: [],
    recommendationFeedback: [],
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

  await taskStore.updateTask(command.taskId, command.updates)
  return {
    ...preview,
    result: 'created',
    entityId: command.taskId,
  }
}

async function applyTaskDelete(command: AITaskDeleteCommand, taskStore: TaskStore, sourceMessageId: string): Promise<AppliedAICommand> {
  const task = taskStore.tasks.find(task => task.id === command.taskId) ?? null
  const preview = previewCommand(command, {
    tasks: taskStore.tasks,
    lanes: [],
    canvasGroups: [],
    memoryEntities: [],
    recommendationFeedback: [],
    sourceMessageId,
  })
  if (!task) {
    return {
      ...preview,
      result: 'reused_existing',
      entityId: command.taskId,
      duplicateOf: command.taskId,
    }
  }

  await taskStore.deleteTask(command.taskId, 'ai-command')
  return {
    ...preview,
    result: 'created',
    entityId: command.taskId,
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
    canvasGroups: [],
    memoryEntities: [],
    recommendationFeedback: [],
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
    canvasGroups: [],
    memoryEntities: [],
    recommendationFeedback: [],
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

async function applyCalendarScheduleTask(command: AICalendarScheduleTaskCommand, taskStore: TaskStore, sourceMessageId: string): Promise<AppliedAICommand> {
  const task = taskStore.tasks.find(task => task.id === command.taskId) ?? null
  if (!task) throw new Error(`Task ${command.taskId} not found`)
  const decision = decideAICalendarScheduleTask({
    task,
    taskId: command.taskId,
    scheduledDate: command.scheduledDate,
    scheduledTime: command.scheduledTime,
    duration: command.duration,
    sourceMessageId,
  })
  const preview = previewCommand(command, {
    tasks: taskStore.tasks,
    lanes: [],
    canvasGroups: [],
    memoryEntities: [],
    recommendationFeedback: [],
    sourceMessageId,
  })
  if (decision.existing) {
    return {
      ...preview,
      result: 'reused_existing',
      entityId: decision.existing.id || `${command.taskId}:${command.scheduledDate}:${command.scheduledTime}`,
      duplicateOf: decision.existing.id,
    }
  }

  const created = await taskStore.createTaskInstance(command.taskId, {
    taskId: command.taskId,
    scheduledDate: command.scheduledDate,
    scheduledTime: command.scheduledTime,
    duration: command.duration || task.estimatedDuration || 60,
    status: 'scheduled',
    isRecurring: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  if (!created) throw new Error(`Failed to schedule task ${command.taskId}`)
  return {
    ...preview,
    result: 'created',
    entityId: created.id || `${command.taskId}:${command.scheduledDate}:${command.scheduledTime}`,
  }
}

async function applyFocusTimerStart(command: AIFocusTimerStartCommand, input: {
  taskStore: TaskStore
  timerStore: TimerStore
  sourceMessageId: string
}): Promise<AppliedAICommand> {
  const task = input.taskStore.tasks.find(task => task.id === command.taskId) ?? null
  if (!task && command.taskId !== 'general') throw new Error(`Task ${command.taskId} not found`)
  const durationMinutes = Math.max(1, Math.round(command.durationMinutes || 25))
  const decision = decideAIFocusTimerStart({
    currentSession: input.timerStore.currentSession,
    taskId: command.taskId,
    durationMinutes,
    sourceMessageId: input.sourceMessageId,
  })
  const preview = previewCommand(command, {
    tasks: input.taskStore.tasks,
    lanes: [],
    canvasGroups: [],
    timerSession: input.timerStore.currentSession,
    memoryEntities: [],
    recommendationFeedback: [],
    sourceMessageId: input.sourceMessageId,
  })
  if (decision.existing) {
    return {
      ...preview,
      result: 'reused_existing',
      entityId: `focus:${decision.existing.id}`,
      duplicateOf: decision.existing.id,
    }
  }

  await input.timerStore.startTimer(command.taskId, durationMinutes * 60, false)
  const sessionId = input.timerStore.currentSession?.id ?? `${command.taskId}:${durationMinutes}`
  return {
    ...preview,
    result: 'created',
    entityId: `focus:${sessionId}`,
  }
}

async function applyFocusTimerStop(command: AIFocusTimerStopCommand, input: {
  taskStore: TaskStore
  timerStore: TimerStore
  sourceMessageId: string
}): Promise<AppliedAICommand> {
  const session = input.timerStore.currentSession
  const preview = previewCommand(command, {
    tasks: input.taskStore.tasks,
    lanes: [],
    canvasGroups: [],
    timerSession: session,
    memoryEntities: [],
    recommendationFeedback: [],
    sourceMessageId: input.sourceMessageId,
  })
  if (!session?.isActive) {
    return {
      ...preview,
      result: 'reused_existing',
      entityId: session?.id ? `focus:${session.id}` : 'focus:inactive',
      duplicateOf: session?.id ?? 'focus:inactive',
    }
  }

  await input.timerStore.stopTimer()
  return {
    ...preview,
    result: 'created',
    entityId: `focus:${session.id}`,
  }
}

async function applyCanvasGroupCreate(command: AICanvasGroupCreateCommand, canvasStore: CanvasStore, sourceMessageId: string): Promise<AppliedAICommand> {
  const decision = decideAICanvasGroupCreate({
    canvasGroups: canvasStore.groups,
    name: command.name,
    workspaceId: command.workspaceId,
    sourceMessageId,
  })
  const preview = previewCommand(command, {
    tasks: [],
    lanes: [],
    canvasGroups: canvasStore.groups,
    memoryEntities: [],
    recommendationFeedback: [],
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

  const created = await canvasStore.createGroup({
    name: command.name,
    type: command.groupType || 'custom',
    position: command.position || { x: 0, y: 0, width: 400, height: 300 },
    color: command.color || '#4ECDC4',
    layout: command.layout || 'vertical',
    isVisible: true,
    isCollapsed: false,
    ...(command.workspaceId ? { workspaceId: command.workspaceId } : {}),
  } as Omit<CanvasGroup, 'id'>)
  return {
    ...preview,
    result: 'created',
    entityId: created.id,
  }
}

async function applyCanvasNodeMove(command: AICanvasNodeMoveCommand, options: {
  taskStore: TaskStore
  canvasStore?: CanvasStore
  sourceMessageId: string
}): Promise<AppliedAICommand> {
  if (command.nodeType === 'task') {
    const task = options.taskStore.tasks.find(task => task.id === command.nodeId) ?? null
    if (!task) throw new Error(`Task ${command.nodeId} not found`)

    const decision = decideAICanvasNodeMove({
      task,
      nodeType: command.nodeType,
      nodeId: command.nodeId,
      position: command.position,
      parentId: command.parentId,
      sourceMessageId: options.sourceMessageId,
    })
    const preview = previewCommand(command, {
      tasks: options.taskStore.tasks,
      lanes: [],
      canvasGroups: [],
      memoryEntities: [],
      recommendationFeedback: [],
      sourceMessageId: options.sourceMessageId,
    })
    if (decision.existing) {
      return {
        ...preview,
        result: 'reused_existing',
        entityId: decision.existing.id,
        duplicateOf: decision.existing.id,
      }
    }

    await options.taskStore.updateTask(command.nodeId, {
      canvasPosition: { x: command.position.x, y: command.position.y },
      positionFormat: 'absolute',
      ...('parentId' in command ? { parentId: command.parentId ?? undefined } : {}),
    })
    return {
      ...preview,
      result: 'created',
      entityId: command.nodeId,
    }
  }

  const canvasStore = options.canvasStore ?? missingCanvasStore()
  const group = canvasStore.groups.find(group => group.id === command.nodeId) ?? null
  if (!group) throw new Error(`Canvas group ${command.nodeId} not found`)

  const decision = decideAICanvasNodeMove({
    group,
    nodeType: command.nodeType,
    nodeId: command.nodeId,
    position: command.position,
    parentGroupId: command.parentGroupId,
    sourceMessageId: options.sourceMessageId,
  })
  const preview = previewCommand(command, {
    tasks: options.taskStore.tasks,
    lanes: [],
    canvasGroups: canvasStore.groups,
    memoryEntities: [],
    recommendationFeedback: [],
    sourceMessageId: options.sourceMessageId,
  })
  if (decision.existing) {
    return {
      ...preview,
      result: 'reused_existing',
      entityId: decision.existing.id,
      duplicateOf: decision.existing.id,
    }
  }

  await canvasStore.updateGroup(command.nodeId, {
    position: { ...group.position, ...command.position },
    ...('parentGroupId' in command ? { parentGroupId: command.parentGroupId ?? null } : {}),
  })
  return {
    ...preview,
    result: 'created',
    entityId: command.nodeId,
  }
}

async function fetchMemoryEntities(memoryStore: AICommandMemoryStore, entityKeys: string[]): Promise<AIContextEntity[]> {
  if (!memoryStore.fetchAIContextEntities) return []
  return memoryStore.fetchAIContextEntities(entityKeys)
}

async function fetchRecommendationFeedback(memoryStore: AICommandMemoryStore, feedback: AIRecommendationFeedbackInput): Promise<AIRecommendationFeedback[]> {
  if (!memoryStore.fetchAIRecommendationFeedback) return []
  return memoryStore.fetchAIRecommendationFeedback({
    recommendationIds: [feedback.recommendationId],
    taskIds: feedback.taskId ? [feedback.taskId] : undefined,
    entityKeys: feedback.entityKey ? [feedback.entityKey] : undefined,
    limit: 20,
  })
}

async function applyMemoryPatch(command: AIMemoryPatchCommand, memoryStore: AICommandMemoryStore, sourceMessageId: string): Promise<AppliedAICommand> {
  const patch = {
    ...command.patch,
    sourceMessageId: command.patch.sourceMessageId ?? sourceMessageId,
  }
  const entityKey = buildAIMemoryEntityKey(patch)
  const memoryEntities = await fetchMemoryEntities(memoryStore, [entityKey])
  const decision = decideAIMemoryPatch({
    memoryEntities,
    patch,
    sourceMessageId,
  })
  const preview = previewCommand({ ...command, patch }, {
    tasks: [],
    lanes: [],
    canvasGroups: [],
    memoryEntities,
    recommendationFeedback: [],
    sourceMessageId,
  })
  if (decision.existing) {
    return {
      ...preview,
      result: 'reused_existing',
      entityId: decision.existing.entityKey,
      duplicateOf: decision.existing.id ?? decision.existing.entityKey,
    }
  }

  await memoryStore.applyAIMemoryPatch(patch)
  return {
    ...preview,
    result: 'created',
    entityId: entityKey,
  }
}

async function applyRecommendationFeedback(command: AIRecommendationFeedbackCommand, memoryStore: AICommandMemoryStore, sourceMessageId: string): Promise<AppliedAICommand> {
  const feedback = {
    ...command.feedback,
    sourceMessageId: command.feedback.sourceMessageId ?? sourceMessageId,
  }
  const recommendationFeedback = await fetchRecommendationFeedback(memoryStore, feedback)
  const decision = decideAIRecommendationFeedback({
    recommendationFeedback,
    feedback,
    sourceMessageId,
  })
  const preview = previewCommand({ ...command, feedback }, {
    tasks: [],
    lanes: [],
    canvasGroups: [],
    memoryEntities: [],
    recommendationFeedback,
    sourceMessageId,
  })
  if (decision.existing) {
    return {
      ...preview,
      result: 'reused_existing',
      entityId: decision.existing.id ?? decision.existing.recommendationId,
      duplicateOf: decision.existing.id ?? decision.existing.recommendationId,
    }
  }

  await memoryStore.recordAIRecommendationFeedback(feedback)
  return {
    ...preview,
    result: 'created',
    entityId: feedback.recommendationId,
  }
}

export async function applyAICommandBatch(batch: AICommandBatch, options: {
  selectedCommandIds: string[]
  taskStore: TaskStore
  laneStore?: LaneStore
  canvasStore?: CanvasStore
  timerStore?: TimerStore
  memoryStore?: AICommandMemoryStore
  explicitApproval?: boolean
}): Promise<AICommandApplyResult> {
  const selected = new Set(options.selectedCommandIds)
  const tasksBefore = cloneTasks(options.taskStore.tasks)
  const lanesBefore = options.laneStore ? cloneLanes(options.laneStore.lanes) : undefined
  const canvasGroupsBefore = options.canvasStore ? cloneCanvasGroups(options.canvasStore.groups) : undefined
  const timerBefore = options.timerStore ? cloneTimerSession(options.timerStore.currentSession) : undefined
  const memoryBefore = options.memoryStore?.createAICommandMemorySnapshot
    ? cloneMemorySnapshot(await options.memoryStore.createAICommandMemorySnapshot())
    : undefined
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
      : command.kind === 'task.update'
        ? await applyTaskUpdate(command, options.taskStore, batch.sourceMessageId)
        : command.kind === 'task.delete'
          ? await applyTaskDelete(command, options.taskStore, batch.sourceMessageId)
          : command.kind === 'task.subtask.create'
            ? await applySubtaskCreate(command, options.taskStore, batch.sourceMessageId)
            : command.kind === 'lane.create'
              ? await applyLaneCreate(
                command,
                options.laneStore ?? missingLaneStore(),
                batch.sourceMessageId,
              )
              : command.kind === 'calendar.schedule_task'
                ? await applyCalendarScheduleTask(command, options.taskStore, batch.sourceMessageId)
                : command.kind === 'focus.timer.start'
                  ? await applyFocusTimerStart(command, {
                    taskStore: options.taskStore,
                    timerStore: options.timerStore ?? missingTimerStore(),
                    sourceMessageId: batch.sourceMessageId,
                  })
                  : command.kind === 'focus.timer.stop'
                    ? await applyFocusTimerStop(command, {
                      taskStore: options.taskStore,
                      timerStore: options.timerStore ?? missingTimerStore(),
                      sourceMessageId: batch.sourceMessageId,
                    })
                    : command.kind === 'canvas.group.create'
                      ? await applyCanvasGroupCreate(
                        command,
                        options.canvasStore ?? missingCanvasStore(),
                        batch.sourceMessageId,
                      )
                      : command.kind === 'canvas.node.move'
                        ? await applyCanvasNodeMove(command, {
                          taskStore: options.taskStore,
                          canvasStore: options.canvasStore,
                          sourceMessageId: batch.sourceMessageId,
                        })
                        : command.kind === 'memory.patch'
                          ? await applyMemoryPatch(
                            command,
                            options.memoryStore ?? missingMemoryStore(),
                            batch.sourceMessageId,
                          )
                          : await applyRecommendationFeedback(
                            command,
                            options.memoryStore ?? missingMemoryStore(),
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
    canvasGroupsBefore,
    timerBefore,
    memoryBefore,
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
  canvasStore?: CanvasStore
  timerStore?: TimerStore
  memoryStore?: AICommandMemoryStore
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

  if (options.canvasStore && snapshot.canvasGroupsBefore) {
    const beforeGroupIds = new Set(snapshot.canvasGroupsBefore.map(group => group.id))
    for (const group of [...options.canvasStore.groups]) {
      if (!beforeGroupIds.has(group.id)) {
        await options.canvasStore.deleteGroup(group.id)
      }
    }

    for (const beforeGroup of snapshot.canvasGroupsBefore) {
      const existing = options.canvasStore.groups.find(group => group.id === beforeGroup.id)
      if (existing) {
        await options.canvasStore.updateGroup(beforeGroup.id, cloneCanvasGroup(beforeGroup))
      } else {
        await options.canvasStore.createGroup(cloneCanvasGroup(beforeGroup))
      }
    }
  }

  if (options.timerStore && snapshot.timerBefore !== undefined) {
    const currentSession = options.timerStore.currentSession
    if (!snapshot.timerBefore) {
      if (currentSession?.isActive) {
        await options.timerStore.stopTimer()
      }
    } else {
      if (currentSession?.isActive) {
        await options.timerStore.stopTimer()
      }
      if (snapshot.timerBefore.isActive) {
        await options.timerStore.startTimer(
          snapshot.timerBefore.taskId,
          snapshot.timerBefore.remainingTime || snapshot.timerBefore.duration,
          snapshot.timerBefore.isBreak,
        )
      }
    }
  }

  if (snapshot.memoryBefore) {
    if (!options.memoryStore?.restoreAICommandMemorySnapshot) {
      throw new Error('memoryStore with restoreAICommandMemorySnapshot is required to roll back AI memory commands')
    }
    await options.memoryStore.restoreAICommandMemorySnapshot(snapshot.memoryBefore)
  }
}

function missingLaneStore(): LaneStore {
  throw new Error('laneStore is required to apply AI lane commands')
}

function missingCanvasStore(): CanvasStore {
  throw new Error('canvasStore is required to apply AI canvas commands')
}

function missingTimerStore(): TimerStore {
  throw new Error('timerStore is required to apply AI focus commands')
}

function missingMemoryStore(): AICommandMemoryStore {
  throw new Error('memoryStore is required to apply AI memory commands')
}
