import { useProjectStore } from '@/stores/projects'
import { useSyncStatusStore } from '@/stores/syncStatus'
import { useTaskStore } from '@/stores/tasks'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAgentApprovalQueueStore } from '@/stores/agent/approvalQueue'
import type { Task } from '@/types/tasks'
import { recordAgentAudit } from './auditLog'
import { createAgentReadHandlers } from './readHandlers'
import { READ_ONLY_AGENT_COMMANDS, WRITE_AGENT_COMMANDS, type AgentCommandContext, type AgentCommandName, type AgentCommandResult, type AgentReadModel, type AgentWorkspaceScope, type AgentWriteContext, type WriteAgentCommandName } from './types'
import { createAgentWriteHandlers } from './writeHandlers'

interface RendererAgentRequest {
  requestId: string
  command: AgentCommandName
  arguments?: Record<string, unknown>
}

interface ElectronAgentApi {
  onAgentReadRequest?: (callback: (payload: unknown) => Promise<unknown> | unknown) => void
}

const readOnlyCommands = new Set<string>(READ_ONLY_AGENT_COMMANDS)
const writeCommands = new Set<string>(WRITE_AGENT_COMMANDS)
const localAgentActor = { id: 'local-mcp-agent', name: 'Local MCP Agent', transport: 'stdio' } as const

function isAgentWorkspaceScope(value: unknown): value is AgentWorkspaceScope {
  if (!value || typeof value !== 'object') return false
  const scope = value as Partial<AgentWorkspaceScope>
  if (scope.type === 'active' || scope.type === 'personal') return true
  return scope.type === 'workspace' && typeof scope.workspaceId === 'string'
}

function getWorkspaceScope(args: Record<string, unknown> | undefined): { ok: true; workspace: AgentWorkspaceScope } | { ok: false; message: string } {
  if (!args || args.workspace === undefined) return { ok: true, workspace: { type: 'active' } }
  if (isAgentWorkspaceScope(args.workspace)) return { ok: true, workspace: args.workspace }
  return { ok: false, message: 'Agent request included an invalid workspace scope.' }
}

function getStringArg(args: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = args?.[key]
  return typeof value === 'string' ? value : undefined
}

function getNumberArg(args: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = args?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getTaskStatusArg(args: Record<string, unknown> | undefined): Task['status'] | 'all' | undefined {
  const status = args?.status
  return status === 'todo' || status === 'done' || status === 'all'
    ? status
    : undefined
}

function getPriorityArg(args: Record<string, unknown> | undefined): Task['priority'] | undefined {
  const priority = args?.priority
  return priority === 'low' || priority === 'medium' || priority === 'high' || priority === null ? priority : undefined
}

function getBooleanArg(args: Record<string, unknown> | undefined, key: string): boolean | undefined {
  const value = args?.[key]
  return typeof value === 'boolean' ? value : undefined
}

function getRecordArg(args: Record<string, unknown> | undefined, key: string): Record<string, unknown> {
  const value = args?.[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function getAgentReadModel(): AgentReadModel {
  const taskStore = useTaskStore()
  const projectStore = useProjectStore()
  const workspaceStore = useWorkspaceStore()
  const syncStatusStore = useSyncStatusStore()

  return {
    tasks: taskStore.rawTasks,
    projects: projectStore.projects,
    workspaces: workspaceStore.workspaces,
    activeWorkspaceId: workspaceStore.activeWorkspaceId,
    syncStatus: syncStatusStore.status,
    pendingSyncCount: syncStatusStore.pendingCount,
  }
}

export async function handleRendererAgentReadRequest(payload: unknown) {
  const request = payload as Partial<RendererAgentRequest>
  if (!request.requestId || !request.command || (!readOnlyCommands.has(request.command) && !writeCommands.has(request.command))) {
    const result = {
      status: 'denied',
      code: 'agent_command_denied',
      message: 'Only registered FlowState agent commands are available through this bridge.',
    } as const
    recordAgentAudit({
      requestId: request.requestId ?? 'unknown-request',
      actor: localAgentActor,
      command: request.command ?? 'unknown-command',
      requestedWorkspace: null,
      result,
    })
    return result
  }

  const args = request.arguments ?? {}
  const isWriteCommand = writeCommands.has(request.command)
  const workspace = isWriteCommand && args.workspace === undefined
    ? { ok: false as const, message: 'MCP write tools require an explicit workspace scope.' }
    : getWorkspaceScope(args)
  if (!workspace.ok) {
    const result = {
      status: 'denied',
      code: 'invalid_workspace_scope',
      message: workspace.message,
    } as const
    recordAgentAudit({
      requestId: request.requestId,
      actor: localAgentActor,
      command: request.command,
      requestedWorkspace: null,
      result,
    })
    return result
  }

  const context: AgentCommandContext = {
    requestId: request.requestId,
    actor: localAgentActor,
    workspace: workspace.workspace,
  }

  const model = getAgentReadModel()
  const handlers = createAgentReadHandlers(model)

  switch (request.command) {
    case 'flowstate_get_context':
      return recordAndReturn(context, request.command, handlers.getContext(context))
    case 'flowstate_list_workspaces':
      return recordAndReturn(context, request.command, handlers.listWorkspaces(context))
    case 'flowstate_get_active_workspace':
      return recordAndReturn(context, request.command, handlers.getActiveWorkspace(context))
    case 'flowstate_search_tasks':
      return recordAndReturn(context, request.command, handlers.searchTasks(context, {
        query: getStringArg(args, 'query'),
        status: getTaskStatusArg(args),
        projectId: getStringArg(args, 'projectId'),
        limit: getNumberArg(args, 'limit'),
      }))
    case 'flowstate_get_task':
      return recordAndReturn(context, request.command, handlers.getTask(context, getStringArg(args, 'taskId') ?? ''))
    case 'flowstate_list_projects':
      return recordAndReturn(context, request.command, handlers.listProjects(context))
    case 'flowstate_get_today':
      return recordAndReturn(context, request.command, handlers.getToday(context))
    case 'flowstate_get_sync_status':
      return recordAndReturn(context, request.command, handlers.getSyncStatus(context))
    case 'flowstate_create_task':
    case 'flowstate_update_task':
    case 'flowstate_complete_task':
    case 'flowstate_move_task_to_project':
    case 'flowstate_add_task_comment':
    case 'flowstate_soft_delete_task':
      return handleWriteCommand(model, context, request.command, args)
  }
}

function getWriteContext(context: AgentCommandContext, args: Record<string, unknown>): AgentWriteContext {
  return {
    ...context,
    dryRun: getBooleanArg(args, 'dryRun') === true,
    idempotencyKey: getStringArg(args, 'idempotencyKey') ?? '',
  }
}

function handleWriteCommand(model: AgentReadModel, context: AgentCommandContext, command: WriteAgentCommandName, args: Record<string, unknown>) {
  const handlers = createAgentWriteHandlers(model)
  const writeContext = getWriteContext(context, args)

  switch (command) {
    case 'flowstate_create_task':
      return recordWriteAndReturn(writeContext, command, handlers.createTask(writeContext, {
        workspace: context.workspace,
        title: getStringArg(args, 'title') ?? '',
        description: getStringArg(args, 'description'),
        projectId: getStringArg(args, 'projectId') ?? null,
        priority: getPriorityArg(args),
        dueDate: getStringArg(args, 'dueDate'),
      }))
    case 'flowstate_update_task': {
      const changes = getRecordArg(args, 'changes')
      return recordWriteAndReturn(writeContext, command, handlers.updateTask(writeContext, {
        workspace: context.workspace,
        taskId: getStringArg(args, 'taskId') ?? '',
        changes: {
          title: getStringArg(changes, 'title'),
          description: getStringArg(changes, 'description'),
          status: getTaskStatusArg(changes) === 'all' ? undefined : getTaskStatusArg(changes),
          priority: getPriorityArg(changes),
          dueDate: getStringArg(changes, 'dueDate'),
          projectId: getStringArg(changes, 'projectId') ?? (changes.projectId === null ? null : undefined),
          assignedTo: getStringArg(changes, 'assignedTo') ?? (changes.assignedTo === null ? null : undefined),
        },
      }))
    }
    case 'flowstate_complete_task':
      return recordWriteAndReturn(writeContext, command, handlers.completeTask(writeContext, { workspace: context.workspace, taskId: getStringArg(args, 'taskId') ?? '' }))
    case 'flowstate_move_task_to_project':
      return recordWriteAndReturn(writeContext, command, handlers.moveTaskToProject(writeContext, {
        workspace: context.workspace,
        taskId: getStringArg(args, 'taskId') ?? '',
        projectId: getStringArg(args, 'projectId') ?? null,
      }))
    case 'flowstate_add_task_comment':
      return recordWriteAndReturn(writeContext, command, handlers.addTaskComment(writeContext, {
        workspace: context.workspace,
        taskId: getStringArg(args, 'taskId') ?? '',
        content: getStringArg(args, 'content') ?? '',
      }))
    case 'flowstate_soft_delete_task':
      return recordWriteAndReturn(writeContext, command, handlers.softDeleteTask(writeContext, { workspace: context.workspace, taskId: getStringArg(args, 'taskId') ?? '' }))
  }
}

function recordWriteAndReturn<T extends AgentCommandResult>(context: AgentWriteContext, command: WriteAgentCommandName, result: T): T | AgentCommandResult {
  if (result.status === 'success' && result.operation === 'dry_run') {
    const approvalQueue = useAgentApprovalQueueStore()
    const idempotencyConflict = approvalQueue.getIdempotencyConflict(context, command, result)
    if (idempotencyConflict) {
      return recordAndReturn(context, command, conflictResult(command, result, 'idempotency_conflict', 'This idempotency key is already attached to a different dry-run request.'))
    }

    const pendingWriteConflictIds = getPendingWriteConflictIds(result)
    if (pendingWriteConflictIds.length > 0) {
      return recordAndReturn(context, command, conflictResult(command, result, 'pending_write_conflict', 'One or more affected tasks already have pending local writes.', pendingWriteConflictIds))
    }

    const recorded = recordAndReturn(context, command, result)
    const syncStatusStore = useSyncStatusStore()
    approvalQueue.enqueueDryRun(context, command, recorded, {
      syncStatus: syncStatusStore.status,
      pendingSyncCount: syncStatusStore.pendingCount,
    })
    return recorded
  }

  return recordAndReturn(context, command, result)
}

function conflictResult(command: WriteAgentCommandName, result: AgentCommandResult, code: string, message: string, affectedEntityIds = result.audit.affectedEntityIds): AgentCommandResult {
  return {
    status: 'conflict',
    command,
    operation: 'dry_run',
    workspace: result.workspace,
    audit: {
      operation: 'dry_run',
      command,
      workspace: result.workspace,
      affectedEntityType: result.audit.affectedEntityType,
      affectedEntityIds,
    },
    error: { code, message },
  }
}

function getPendingWriteConflictIds(result: AgentCommandResult) {
  const taskStore = useTaskStore()
  return result.audit.affectedEntityType === 'task' || result.audit.affectedEntityType === 'comment'
    ? result.audit.affectedEntityIds.filter(id => !id.startsWith('agent-preview-') && taskStore.isPendingWrite(id))
    : []
}

function recordAndReturn<T>(context: AgentCommandContext, command: AgentCommandName, result: T): T {
  recordAgentAudit({
    requestId: context.requestId,
    actor: context.actor,
    command,
    requestedWorkspace: context.workspace,
    result: result as never,
  })
  return result
}

export function registerRendererAgentBridge() {
  const api = (window as unknown as { electronAPI?: ElectronAgentApi }).electronAPI
  api?.onAgentReadRequest?.(handleRendererAgentReadRequest)
}
