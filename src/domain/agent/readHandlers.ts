import type { Project, Task } from '@/types/tasks'
import type { Workspace } from '@/types/workspace'
import type {
  AgentAppContextSnapshot,
  AgentCommandContext,
  AgentCommandName,
  AgentCommandResult,
  AgentProjectListResult,
  AgentReadModel,
  AgentTaskSearchQuery,
  AgentTaskSearchResult,
  AgentTodayResult,
  AgentWorkspaceScope,
  ResolvedAgentWorkspaceScope,
} from './types'

const DEFAULT_SEARCH_LIMIT = 25
const MAX_SEARCH_LIMIT = 100

type AgentTaskSummary = AgentTaskSearchResult['tasks'][number]

function resolveWorkspaceScope(
  scope: AgentWorkspaceScope,
  model: Pick<AgentReadModel, 'activeWorkspaceId' | 'workspaces'>
): { ok: true; workspace: ResolvedAgentWorkspaceScope } | { ok: false; message: string } {
  if (scope.type === 'personal') {
    return { ok: true, workspace: { type: 'personal', workspaceId: null, label: 'Personal' } }
  }

  const workspaceId = scope.type === 'active' ? model.activeWorkspaceId : scope.workspaceId
  if (!workspaceId) {
    return { ok: true, workspace: { type: 'personal', workspaceId: null, label: 'Personal' } }
  }

  const workspace = model.workspaces.find(w => w.id === workspaceId)
  if (!workspace) {
    return { ok: false, message: `Workspace ${workspaceId} is not available to the current user` }
  }

  return { ok: true, workspace: { type: 'workspace', workspaceId, label: workspace.name } }
}

function isInWorkspace(entity: { workspaceId?: string | null }, workspace: ResolvedAgentWorkspaceScope): boolean {
  if (workspace.type === 'personal') return entity.workspaceId == null
  return entity.workspaceId === workspace.workspaceId
}

function isVisibleTask(task: Task): boolean {
  return task._soft_deleted !== true
}

function toTaskSummary(task: Task): AgentTaskSummary {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    projectId: task.projectId,
    workspaceId: task.workspaceId,
  }
}

function toProjectSummary(project: Project): AgentProjectListResult['projects'][number] {
  return {
    id: project.id,
    name: project.name,
    workspaceId: project.workspaceId,
    parentId: project.parentId,
  }
}

function readResult<TData>(
  command: AgentCommandName,
  workspace: ResolvedAgentWorkspaceScope,
  data: TData,
  affectedEntityType: AgentCommandResult['audit']['affectedEntityType'],
  affectedEntityIds: string[] = []
): AgentCommandResult<TData> {
  return {
    status: 'success',
    command,
    operation: 'read',
    workspace,
    data,
    audit: {
      operation: 'read',
      command,
      workspace,
      affectedEntityType,
      affectedEntityIds,
    },
  }
}

function deniedResult<TData>(
  command: AgentCommandName,
  workspace: ResolvedAgentWorkspaceScope,
  message: string
): AgentCommandResult<TData> {
  return {
    status: 'denied',
    command,
    operation: 'denied',
    workspace,
    audit: {
      operation: 'denied',
      command,
      workspace,
      affectedEntityIds: [],
    },
    error: {
      code: 'workspace_denied',
      message,
    },
  }
}

export function createAgentReadHandlers(model: AgentReadModel) {
  const personalWorkspace: ResolvedAgentWorkspaceScope = { type: 'personal', workspaceId: null, label: 'Personal' }

  function resolveOrDeny<TData>(
    command: AgentCommandName,
    scope: AgentWorkspaceScope
  ): ResolvedAgentWorkspaceScope | AgentCommandResult<TData> {
    const resolved = resolveWorkspaceScope(scope, model)
    if (resolved.ok) return resolved.workspace
    return deniedResult<TData>(command, personalWorkspace, resolved.message)
  }

  function getContext(context: AgentCommandContext): AgentCommandResult<AgentAppContextSnapshot> {
    const workspace = resolveOrDeny<AgentAppContextSnapshot>('flowstate_get_context', context.workspace)
    if ('status' in workspace) return workspace

    return readResult(
      'flowstate_get_context',
      workspace,
      {
        activeWorkspace: workspace,
        workspaces: model.workspaces,
        syncStatus: model.syncStatus,
        pendingSyncCount: model.pendingSyncCount,
        readOnly: true,
      },
      'context'
    )
  }

  function listWorkspaces(context: AgentCommandContext): AgentCommandResult<{ workspaces: Workspace[] }> {
    const workspace = resolveOrDeny<{ workspaces: Workspace[] }>('flowstate_list_workspaces', context.workspace)
    if ('status' in workspace) return workspace

    return readResult('flowstate_list_workspaces', workspace, { workspaces: model.workspaces }, 'workspace', model.workspaces.map(w => w.id))
  }

  function getActiveWorkspace(context: AgentCommandContext): AgentCommandResult<{ workspace: ResolvedAgentWorkspaceScope }> {
    const workspace = resolveOrDeny<{ workspace: ResolvedAgentWorkspaceScope }>('flowstate_get_active_workspace', context.workspace)
    if ('status' in workspace) return workspace

    return readResult('flowstate_get_active_workspace', workspace, { workspace }, 'workspace', workspace.workspaceId ? [workspace.workspaceId] : [])
  }

  function searchTasks(
    context: AgentCommandContext,
    query: Omit<AgentTaskSearchQuery, 'workspace'> = {}
  ): AgentCommandResult<AgentTaskSearchResult> {
    const workspace = resolveOrDeny<AgentTaskSearchResult>('flowstate_search_tasks', context.workspace)
    if ('status' in workspace) return workspace

    const normalizedQuery = query.query?.trim().toLowerCase()
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_SEARCH_LIMIT, 1), MAX_SEARCH_LIMIT)
    const matches = model.tasks
      .filter(isVisibleTask)
      .filter(task => isInWorkspace(task, workspace))
      .filter(task => !normalizedQuery || [task.title, task.description, ...(task.tags ?? [])].some(value => value?.toLowerCase().includes(normalizedQuery)))
      .filter(task => !query.status || query.status === 'all' || task.status === query.status)
      .filter(task => query.projectId === undefined || task.projectId === query.projectId)

    const tasks = matches.slice(0, limit).map(toTaskSummary)

    return readResult(
      'flowstate_search_tasks',
      workspace,
      { tasks, total: matches.length, truncated: matches.length > tasks.length },
      'task',
      tasks.map(task => task.id)
    )
  }

  function getTask(context: AgentCommandContext, taskId: string): AgentCommandResult<{ task: Task }> {
    const workspace = resolveOrDeny<{ task: Task }>('flowstate_get_task', context.workspace)
    if ('status' in workspace) return workspace

    const task = model.tasks.find(candidate => candidate.id === taskId && isVisibleTask(candidate) && isInWorkspace(candidate, workspace))
    if (!task) {
      return {
        status: 'not_found',
        command: 'flowstate_get_task',
        operation: 'read',
        workspace,
        audit: {
          operation: 'read',
          command: 'flowstate_get_task',
          workspace,
          affectedEntityType: 'task',
          affectedEntityIds: [taskId],
        },
        error: { code: 'task_not_found', message: `Task ${taskId} was not found in the requested workspace` },
      }
    }

    return readResult('flowstate_get_task', workspace, { task }, 'task', [task.id])
  }

  function listProjects(context: AgentCommandContext): AgentCommandResult<AgentProjectListResult> {
    const workspace = resolveOrDeny<AgentProjectListResult>('flowstate_list_projects', context.workspace)
    if ('status' in workspace) return workspace

    const projects = model.projects.filter(project => isInWorkspace(project, workspace)).map(toProjectSummary)
    return readResult('flowstate_list_projects', workspace, { projects }, 'project', projects.map(project => project.id))
  }

  function getToday(context: AgentCommandContext, date = new Date()): AgentCommandResult<AgentTodayResult> {
    const workspace = resolveOrDeny<AgentTodayResult>('flowstate_get_today', context.workspace)
    if ('status' in workspace) return workspace

    const day = date.toISOString().slice(0, 10)
    const tasks = model.tasks
      .filter(isVisibleTask)
      .filter(task => isInWorkspace(task, workspace))
      .filter(task => task.dueDate === day || task.scheduledDate === day || task.instances?.some(instance => instance.scheduledDate === day))
      .map(toTaskSummary)

    return readResult('flowstate_get_today', workspace, { date: day, tasks }, 'task', tasks.map(task => task.id))
  }

  function getSyncStatus(context: AgentCommandContext): AgentCommandResult<Pick<AgentAppContextSnapshot, 'syncStatus' | 'pendingSyncCount'>> {
    const workspace = resolveOrDeny<Pick<AgentAppContextSnapshot, 'syncStatus' | 'pendingSyncCount'>>('flowstate_get_sync_status', context.workspace)
    if ('status' in workspace) return workspace

    return readResult(
      'flowstate_get_sync_status',
      workspace,
      { syncStatus: model.syncStatus, pendingSyncCount: model.pendingSyncCount },
      'sync'
    )
  }

  return {
    getContext,
    listWorkspaces,
    getActiveWorkspace,
    searchTasks,
    getTask,
    listProjects,
    getToday,
    getSyncStatus,
  }
}
