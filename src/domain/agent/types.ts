import type { Project, Task } from '@/types/tasks'
import type { Workspace } from '@/types/workspace'

export const READ_ONLY_AGENT_COMMANDS = [
  'flowstate_get_context',
  'flowstate_list_workspaces',
  'flowstate_get_active_workspace',
  'flowstate_search_tasks',
  'flowstate_get_task',
  'flowstate_list_projects',
  'flowstate_get_today',
  'flowstate_get_sync_status',
] as const

export const WRITE_AGENT_COMMANDS = [
  'flowstate_create_task',
  'flowstate_update_task',
  'flowstate_complete_task',
  'flowstate_move_task_to_project',
  'flowstate_add_task_comment',
  'flowstate_soft_delete_task',
] as const

export const FORBIDDEN_AGENT_CAPABILITIES = [
  'supabase_service_role_key',
  'raw_sql',
  'direct_supabase_write',
  'direct_indexeddb_write',
  'direct_localstorage_write',
  'direct_raw_pinia_mutation',
  'permanent_delete',
  'unscoped_workspace_access',
] as const

export type ReadOnlyAgentCommandName = typeof READ_ONLY_AGENT_COMMANDS[number]
export type WriteAgentCommandName = typeof WRITE_AGENT_COMMANDS[number]
export type AgentCommandName = ReadOnlyAgentCommandName | WriteAgentCommandName
export type ForbiddenAgentCapability = typeof FORBIDDEN_AGENT_CAPABILITIES[number]

export type AgentWorkspaceScope =
  | { type: 'active' }
  | { type: 'personal' }
  | { type: 'workspace'; workspaceId: string }

export type ResolvedAgentWorkspaceScope =
  | { type: 'personal'; workspaceId: null; label: 'Personal' }
  | { type: 'workspace'; workspaceId: string; label: string }

export type AgentOperationType = 'read' | 'dry_run' | 'write' | 'denied'
export type AgentCommandStatus = 'success' | 'denied' | 'validation_error' | 'not_found' | 'conflict' | 'error'
export type AgentRiskLevel = 'low' | 'medium' | 'high'

export interface AgentActor {
  id: string
  name: string
  transport: 'stdio' | 'loopback' | 'electron-ipc'
}

export interface AgentCommandContext {
  requestId: string
  actor: AgentActor
  workspace: AgentWorkspaceScope
}

export interface AgentWriteContext extends AgentCommandContext {
  dryRun: boolean
  idempotencyKey: string
  confirmed?: boolean
}

export interface AgentCommandPolicy {
  operation: AgentOperationType
  risk: AgentRiskLevel
  requiresApproval: boolean
  supportsDryRun: boolean
  requiresIdempotencyKey: boolean
  destructive: boolean
}

export const AGENT_COMMAND_POLICIES = {
  flowstate_get_context: {
    operation: 'read',
    risk: 'low',
    requiresApproval: false,
    supportsDryRun: false,
    requiresIdempotencyKey: false,
    destructive: false,
  },
  flowstate_list_workspaces: {
    operation: 'read',
    risk: 'low',
    requiresApproval: false,
    supportsDryRun: false,
    requiresIdempotencyKey: false,
    destructive: false,
  },
  flowstate_get_active_workspace: {
    operation: 'read',
    risk: 'low',
    requiresApproval: false,
    supportsDryRun: false,
    requiresIdempotencyKey: false,
    destructive: false,
  },
  flowstate_search_tasks: {
    operation: 'read',
    risk: 'low',
    requiresApproval: false,
    supportsDryRun: false,
    requiresIdempotencyKey: false,
    destructive: false,
  },
  flowstate_get_task: {
    operation: 'read',
    risk: 'low',
    requiresApproval: false,
    supportsDryRun: false,
    requiresIdempotencyKey: false,
    destructive: false,
  },
  flowstate_list_projects: {
    operation: 'read',
    risk: 'low',
    requiresApproval: false,
    supportsDryRun: false,
    requiresIdempotencyKey: false,
    destructive: false,
  },
  flowstate_get_today: {
    operation: 'read',
    risk: 'low',
    requiresApproval: false,
    supportsDryRun: false,
    requiresIdempotencyKey: false,
    destructive: false,
  },
  flowstate_get_sync_status: {
    operation: 'read',
    risk: 'low',
    requiresApproval: false,
    supportsDryRun: false,
    requiresIdempotencyKey: false,
    destructive: false,
  },
  flowstate_create_task: {
    operation: 'dry_run',
    risk: 'medium',
    requiresApproval: true,
    supportsDryRun: true,
    requiresIdempotencyKey: true,
    destructive: false,
  },
  flowstate_update_task: {
    operation: 'dry_run',
    risk: 'medium',
    requiresApproval: true,
    supportsDryRun: true,
    requiresIdempotencyKey: true,
    destructive: false,
  },
  flowstate_complete_task: {
    operation: 'dry_run',
    risk: 'medium',
    requiresApproval: true,
    supportsDryRun: true,
    requiresIdempotencyKey: true,
    destructive: false,
  },
  flowstate_move_task_to_project: {
    operation: 'dry_run',
    risk: 'medium',
    requiresApproval: true,
    supportsDryRun: true,
    requiresIdempotencyKey: true,
    destructive: false,
  },
  flowstate_add_task_comment: {
    operation: 'dry_run',
    risk: 'low',
    requiresApproval: true,
    supportsDryRun: true,
    requiresIdempotencyKey: true,
    destructive: false,
  },
  flowstate_soft_delete_task: {
    operation: 'dry_run',
    risk: 'high',
    requiresApproval: true,
    supportsDryRun: true,
    requiresIdempotencyKey: true,
    destructive: true,
  },
} as const satisfies Record<AgentCommandName, AgentCommandPolicy>

export interface AgentDiffEntry {
  path: string
  before: unknown
  after: unknown
}

export interface AgentAuditSummary {
  operation: AgentOperationType
  command: AgentCommandName
  workspace: ResolvedAgentWorkspaceScope
  affectedEntityType?: 'task' | 'project' | 'workspace' | 'comment' | 'sync' | 'context'
  affectedEntityIds: string[]
}

export interface AgentCommandResult<TData = unknown> {
  status: AgentCommandStatus
  command: AgentCommandName
  operation: AgentOperationType
  workspace: ResolvedAgentWorkspaceScope
  data?: TData
  diff?: AgentDiffEntry[]
  audit: AgentAuditSummary
  error?: {
    code: string
    message: string
  }
}

export type AgentApprovalStatus = 'pending' | 'approved' | 'denied'

export interface AgentApprovalRequest {
  id: string
  requestId: string
  command: WriteAgentCommandName
  risk: AgentRiskLevel
  workspace: ResolvedAgentWorkspaceScope
  affectedEntityType?: AgentAuditSummary['affectedEntityType']
  affectedEntityIds: string[]
  diff: AgentDiffEntry[]
  data?: unknown
  idempotencyKey: string
  resultFingerprint: string
  syncStatus: AgentAppContextSnapshot['syncStatus']
  pendingSyncCount?: number
  requestedAt: string
  status: AgentApprovalStatus
  resolvedAt?: string
}

export interface AgentAppContextSnapshot {
  activeWorkspace: ResolvedAgentWorkspaceScope
  workspaces: Workspace[]
  syncStatus: 'synced' | 'syncing' | 'pending' | 'offline' | 'error'
  pendingSyncCount?: number
  readOnly: boolean
}

export interface AgentReadModel {
  tasks: Task[]
  projects: Project[]
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  syncStatus: AgentAppContextSnapshot['syncStatus']
  pendingSyncCount?: number
}

export interface AgentTaskSearchQuery {
  workspace: AgentWorkspaceScope
  query?: string
  status?: Task['status'] | 'all'
  projectId?: string | null
  includeSoftDeleted?: false
  limit?: number
}

export interface AgentTaskSearchResult {
  tasks: Pick<Task, 'id' | 'title' | 'status' | 'priority' | 'dueDate' | 'projectId' | 'workspaceId'>[]
  total: number
  truncated: boolean
}

export interface AgentTodayResult {
  date: string
  tasks: AgentTaskSearchResult['tasks']
}

export interface AgentProjectListResult {
  projects: Pick<Project, 'id' | 'name' | 'workspaceId' | 'parentId'>[]
}

export interface AgentCreateTaskInput {
  workspace: AgentWorkspaceScope
  title: string
  description?: string
  projectId?: string | null
  priority?: Task['priority']
  dueDate?: string
}

export interface AgentUpdateTaskInput {
  workspace: AgentWorkspaceScope
  taskId: string
  changes: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueDate' | 'projectId' | 'assignedTo'>>
}

export interface AgentCompleteTaskInput {
  workspace: AgentWorkspaceScope
  taskId: string
}

export interface AgentMoveTaskToProjectInput {
  workspace: AgentWorkspaceScope
  taskId: string
  projectId: string | null
}

export interface AgentAddTaskCommentInput {
  workspace: AgentWorkspaceScope
  taskId: string
  content: string
}

export interface AgentSoftDeleteTaskInput {
  workspace: AgentWorkspaceScope
  taskId: string
}
