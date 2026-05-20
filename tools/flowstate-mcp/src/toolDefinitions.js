const WORKSPACE_SCOPE = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['active', 'personal', 'workspace'] },
    workspaceId: { type: 'string' },
  },
  required: ['type'],
  additionalProperties: false,
}

const BASE_DRY_RUN_PROPERTIES = {
  workspace: { $ref: '#/$defs/workspaceScope' },
  dryRun: { type: 'boolean', const: true, description: 'Required. MCP write tools are dry-run only until in-app approval is available.' },
  idempotencyKey: { type: 'string', minLength: 1 },
}

const BASE_DEFS = {
  workspaceScope: WORKSPACE_SCOPE,
}

export const READ_ONLY_TOOLS = [
  {
    name: 'flowstate_get_context',
    title: 'Get FlowState Context',
    description: 'Read the current FlowState app context, active workspace, available workspaces, and sync status. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { $ref: '#/$defs/workspaceScope' },
      },
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
  {
    name: 'flowstate_list_workspaces',
    title: 'List FlowState Workspaces',
    description: 'List workspaces available to the current FlowState user. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'flowstate_get_active_workspace',
    title: 'Get Active FlowState Workspace',
    description: 'Read the currently selected FlowState workspace. Personal workspace is represented explicitly. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'flowstate_search_tasks',
    title: 'Search FlowState Tasks',
    description: 'Search visible tasks in an explicit FlowState workspace scope. Soft-deleted tasks are excluded. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { $ref: '#/$defs/workspaceScope' },
        query: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'done', 'all'] },
        projectId: { type: ['string', 'null'] },
        limit: { type: 'number', minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
  {
    name: 'flowstate_get_task',
    title: 'Get FlowState Task',
    description: 'Read one visible task by ID in the requested workspace scope. Soft-deleted tasks are not returned. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { $ref: '#/$defs/workspaceScope' },
        taskId: { type: 'string' },
      },
      required: ['taskId'],
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
  {
    name: 'flowstate_list_projects',
    title: 'List FlowState Projects',
    description: 'List projects in the requested FlowState workspace scope. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { $ref: '#/$defs/workspaceScope' },
      },
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
  {
    name: 'flowstate_get_today',
    title: 'Get FlowState Today',
    description: 'Read tasks scheduled or due today in the requested workspace scope. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { $ref: '#/$defs/workspaceScope' },
        date: { type: 'string', description: 'Optional YYYY-MM-DD date override for deterministic tests.' },
      },
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
  {
    name: 'flowstate_get_sync_status',
    title: 'Get FlowState Sync Status',
    description: 'Read the current FlowState sync/offline status. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

export const DRY_RUN_WRITE_TOOLS = [
  {
    name: 'flowstate_create_task',
    title: 'Dry Run Create FlowState Task',
    description: 'Preview creating a task in a FlowState workspace. Dry-run only; requires later in-app approval before any write can happen.',
    inputSchema: {
      type: 'object',
      properties: {
        ...BASE_DRY_RUN_PROPERTIES,
        title: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        projectId: { type: ['string', 'null'] },
        priority: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] },
        dueDate: { type: 'string' },
      },
      required: ['workspace', 'dryRun', 'idempotencyKey', 'title'],
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
  {
    name: 'flowstate_update_task',
    title: 'Dry Run Update FlowState Task',
    description: 'Preview updating task fields. Dry-run only; returns before/after diffs and does not mutate data.',
    inputSchema: {
      type: 'object',
      properties: {
        ...BASE_DRY_RUN_PROPERTIES,
        taskId: { type: 'string', minLength: 1 },
        changes: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['todo', 'done'] },
            priority: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] },
            dueDate: { type: 'string' },
            projectId: { type: ['string', 'null'] },
            assignedTo: { type: ['string', 'null'] },
          },
          additionalProperties: false,
        },
      },
      required: ['workspace', 'dryRun', 'idempotencyKey', 'taskId', 'changes'],
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
  {
    name: 'flowstate_complete_task',
    title: 'Dry Run Complete FlowState Task',
    description: 'Preview marking a task done. Dry-run only; returns before/after diffs and does not mutate data.',
    inputSchema: {
      type: 'object',
      properties: { ...BASE_DRY_RUN_PROPERTIES, taskId: { type: 'string', minLength: 1 } },
      required: ['workspace', 'dryRun', 'idempotencyKey', 'taskId'],
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
  {
    name: 'flowstate_move_task_to_project',
    title: 'Dry Run Move FlowState Task To Project',
    description: 'Preview moving a task to a project in the same workspace. Dry-run only.',
    inputSchema: {
      type: 'object',
      properties: { ...BASE_DRY_RUN_PROPERTIES, taskId: { type: 'string', minLength: 1 }, projectId: { type: ['string', 'null'] } },
      required: ['workspace', 'dryRun', 'idempotencyKey', 'taskId', 'projectId'],
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
  {
    name: 'flowstate_add_task_comment',
    title: 'Dry Run Add FlowState Task Comment',
    description: 'Preview adding a task comment. Dry-run only; returns a comment diff and does not mutate data.',
    inputSchema: {
      type: 'object',
      properties: { ...BASE_DRY_RUN_PROPERTIES, taskId: { type: 'string', minLength: 1 }, content: { type: 'string', minLength: 1 } },
      required: ['workspace', 'dryRun', 'idempotencyKey', 'taskId', 'content'],
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
  {
    name: 'flowstate_soft_delete_task',
    title: 'Dry Run Soft Delete FlowState Task',
    description: 'Preview soft-deleting a task. Dry-run only; permanent delete is not available to agents.',
    inputSchema: {
      type: 'object',
      properties: { ...BASE_DRY_RUN_PROPERTIES, taskId: { type: 'string', minLength: 1 } },
      required: ['workspace', 'dryRun', 'idempotencyKey', 'taskId'],
      additionalProperties: false,
      $defs: BASE_DEFS,
    },
  },
]

export const FLOWSTATE_TOOLS = [...READ_ONLY_TOOLS, ...DRY_RUN_WRITE_TOOLS]

export function getToolByName(name) {
  return FLOWSTATE_TOOLS.find(tool => tool.name === name) ?? null
}
