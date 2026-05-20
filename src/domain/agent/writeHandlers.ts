import type { Project, Task } from '@/types/tasks'
import type {
  AgentAddTaskCommentInput,
  AgentCompleteTaskInput,
  AgentCommandResult,
  AgentCreateTaskInput,
  AgentMoveTaskToProjectInput,
  AgentReadModel,
  AgentSoftDeleteTaskInput,
  AgentUpdateTaskInput,
  AgentWorkspaceScope,
  AgentWriteContext,
  ResolvedAgentWorkspaceScope,
} from './types'

const personalWorkspace: ResolvedAgentWorkspaceScope = { type: 'personal', workspaceId: null, label: 'Personal' }

type WriteCommand = 'flowstate_create_task' | 'flowstate_update_task' | 'flowstate_complete_task' | 'flowstate_move_task_to_project' | 'flowstate_add_task_comment' | 'flowstate_soft_delete_task'

function resolveWorkspaceScope(
  scope: AgentWorkspaceScope,
  model: Pick<AgentReadModel, 'activeWorkspaceId' | 'workspaces'>
): { ok: true; workspace: ResolvedAgentWorkspaceScope } | { ok: false; message: string } {
  if (scope.type === 'personal') return { ok: true, workspace: personalWorkspace }

  const workspaceId = scope.type === 'active' ? model.activeWorkspaceId : scope.workspaceId
  if (!workspaceId) return { ok: true, workspace: personalWorkspace }

  const workspace = model.workspaces.find(w => w.id === workspaceId)
  if (!workspace) return { ok: false, message: `Workspace ${workspaceId} is not available to the current user` }

  return { ok: true, workspace: { type: 'workspace', workspaceId, label: workspace.name } }
}

function isInWorkspace(entity: { workspaceId?: string | null }, workspace: ResolvedAgentWorkspaceScope): boolean {
  if (workspace.type === 'personal') return entity.workspaceId == null
  return entity.workspaceId === workspace.workspaceId
}

function isVisibleTask(task: Task): boolean {
  return task._soft_deleted !== true
}

function validationResult(command: WriteCommand, workspace: ResolvedAgentWorkspaceScope, code: string, message: string): AgentCommandResult {
  return {
    status: 'validation_error',
    command,
    operation: 'dry_run',
    workspace,
    audit: { operation: 'dry_run', command, workspace, affectedEntityIds: [] },
    error: { code, message },
  }
}

function deniedResult(command: WriteCommand, message: string): AgentCommandResult {
  return {
    status: 'denied',
    command,
    operation: 'denied',
    workspace: personalWorkspace,
    audit: { operation: 'denied', command, workspace: personalWorkspace, affectedEntityIds: [] },
    error: { code: 'workspace_denied', message },
  }
}

function notFoundResult(command: WriteCommand, workspace: ResolvedAgentWorkspaceScope, taskId: string): AgentCommandResult {
  return {
    status: 'not_found',
    command,
    operation: 'dry_run',
    workspace,
    audit: { operation: 'dry_run', command, workspace, affectedEntityType: 'task', affectedEntityIds: [taskId] },
    error: { code: 'task_not_found', message: `Task ${taskId} was not found in the requested workspace` },
  }
}

function dryRunResult<TData>(
  command: WriteCommand,
  workspace: ResolvedAgentWorkspaceScope,
  data: TData,
  diff: AgentCommandResult['diff'],
  affectedEntityType: AgentCommandResult['audit']['affectedEntityType'],
  affectedEntityIds: string[]
): AgentCommandResult<TData> {
  return {
    status: 'success',
    command,
    operation: 'dry_run',
    workspace,
    data,
    diff,
    audit: { operation: 'dry_run', command, workspace, affectedEntityType, affectedEntityIds },
  }
}

function requireDryRun(context: AgentWriteContext, command: WriteCommand, workspace: ResolvedAgentWorkspaceScope): AgentCommandResult | null {
  if (!context.dryRun) {
    return validationResult(command, workspace, 'dry_run_required', 'Agent writes must run as dry-run until approval UI is available.')
  }
  if (!context.idempotencyKey?.trim()) {
    return validationResult(command, workspace, 'idempotency_key_required', 'Agent dry-run writes require an idempotency key.')
  }
  return null
}

function getWorkspaceOrResult(context: AgentWriteContext, command: WriteCommand, model: AgentReadModel): ResolvedAgentWorkspaceScope | AgentCommandResult {
  const resolved = resolveWorkspaceScope(context.workspace, model)
  return resolved.ok ? resolved.workspace : deniedResult(command, resolved.message)
}

function findTask(model: AgentReadModel, workspace: ResolvedAgentWorkspaceScope, taskId: string): Task | null {
  return model.tasks.find(task => task.id === taskId && isVisibleTask(task) && isInWorkspace(task, workspace)) ?? null
}

function findProject(model: AgentReadModel, workspace: ResolvedAgentWorkspaceScope, projectId: string | null | undefined): Project | null {
  if (!projectId) return null
  return model.projects.find(project => project.id === projectId && isInWorkspace(project, workspace)) ?? null
}

export function createAgentWriteHandlers(model: AgentReadModel) {
  function createTask(context: AgentWriteContext, input: AgentCreateTaskInput): AgentCommandResult<{ task: Partial<Task> }> {
    const workspace = getWorkspaceOrResult({ ...context, workspace: input.workspace }, 'flowstate_create_task', model)
    if ('status' in workspace) return workspace

    const dryRunError = requireDryRun(context, 'flowstate_create_task', workspace)
    if (dryRunError) return dryRunError

    const title = input.title.trim()
    if (!title) return validationResult('flowstate_create_task', workspace, 'title_required', 'Task title is required.')
    if (input.projectId && !findProject(model, workspace, input.projectId)) {
      return validationResult('flowstate_create_task', workspace, 'project_not_found', `Project ${input.projectId} was not found in the requested workspace.`)
    }

    const previewTaskId = `agent-preview-${context.idempotencyKey}`
    const taskPreview: Partial<Task> = {
      id: previewTaskId,
      title,
      description: input.description ?? '',
      status: 'todo',
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate ?? '',
      projectId: input.projectId ?? '',
      workspaceId: workspace.workspaceId,
      isInInbox: true,
    }

    return dryRunResult(
      'flowstate_create_task',
      workspace,
      { task: taskPreview },
      [{ path: '/tasks/-', before: null, after: taskPreview }],
      'task',
      [previewTaskId]
    )
  }

  function updateTaskDryRun(command: WriteCommand, context: AgentWriteContext, input: AgentUpdateTaskInput): AgentCommandResult<{ taskId: string }> {
    const workspace = getWorkspaceOrResult({ ...context, workspace: input.workspace }, command, model)
    if ('status' in workspace) return workspace

    const dryRunError = requireDryRun(context, command, workspace)
    if (dryRunError) return dryRunError

    const task = findTask(model, workspace, input.taskId)
    if (!task) return notFoundResult(command, workspace, input.taskId)
    if (input.changes.projectId && !findProject(model, workspace, input.changes.projectId)) {
      return validationResult(command, workspace, 'project_not_found', `Project ${input.changes.projectId} was not found in the requested workspace.`)
    }

    const diff = Object.entries(input.changes)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({ path: `/tasks/${task.id}/${key}`, before: task[key as keyof Task], after: value }))

    if (diff.length === 0) return validationResult(command, workspace, 'empty_changes', 'At least one task field must change.')
    return dryRunResult(command, workspace, { taskId: task.id }, diff, 'task', [task.id])
  }

  function updateTask(context: AgentWriteContext, input: AgentUpdateTaskInput): AgentCommandResult<{ taskId: string }> {
    return updateTaskDryRun('flowstate_update_task', context, input)
  }

  function completeTask(context: AgentWriteContext, input: AgentCompleteTaskInput): AgentCommandResult<{ taskId: string }> {
    return updateTaskDryRun('flowstate_complete_task', context, { workspace: input.workspace, taskId: input.taskId, changes: { status: 'done' } })
  }

  function moveTaskToProject(context: AgentWriteContext, input: AgentMoveTaskToProjectInput): AgentCommandResult<{ taskId: string }> {
    return updateTaskDryRun('flowstate_move_task_to_project', context, { workspace: input.workspace, taskId: input.taskId, changes: { projectId: input.projectId ?? '' } })
  }

  function addTaskComment(context: AgentWriteContext, input: AgentAddTaskCommentInput): AgentCommandResult<{ taskId: string; commentPreview: { content: string } }> {
    const workspace = getWorkspaceOrResult({ ...context, workspace: input.workspace }, 'flowstate_add_task_comment', model)
    if ('status' in workspace) return workspace

    const dryRunError = requireDryRun(context, 'flowstate_add_task_comment', workspace)
    if (dryRunError) return dryRunError

    const task = findTask(model, workspace, input.taskId)
    if (!task) return notFoundResult('flowstate_add_task_comment', workspace, input.taskId)
    const content = input.content.trim()
    if (!content) return validationResult('flowstate_add_task_comment', workspace, 'comment_required', 'Comment content is required.')

    const commentPreview = { content }
    return dryRunResult(
      'flowstate_add_task_comment',
      workspace,
      { taskId: task.id, commentPreview },
      [{ path: `/tasks/${task.id}/comments/-`, before: null, after: commentPreview }],
      'comment',
      [task.id]
    )
  }

  function softDeleteTask(context: AgentWriteContext, input: AgentSoftDeleteTaskInput): AgentCommandResult<{ taskId: string }> {
    const workspace = getWorkspaceOrResult({ ...context, workspace: input.workspace }, 'flowstate_soft_delete_task', model)
    if ('status' in workspace) return workspace

    const dryRunError = requireDryRun(context, 'flowstate_soft_delete_task', workspace)
    if (dryRunError) return dryRunError

    const task = findTask(model, workspace, input.taskId)
    if (!task) return notFoundResult('flowstate_soft_delete_task', workspace, input.taskId)

    return dryRunResult(
      'flowstate_soft_delete_task',
      workspace,
      { taskId: task.id },
      [
        { path: `/tasks/${task.id}/_soft_deleted`, before: task._soft_deleted === true, after: true },
        { path: `/tasks/${task.id}/deletedAt`, before: task.deletedAt ?? null, after: 'pending_approval' },
      ],
      'task',
      [task.id]
    )
  }

  return { createTask, updateTask, completeTask, moveTaskToProject, addTaskComment, softDeleteTask }
}
