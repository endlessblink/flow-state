import { describe, expect, it } from 'vitest'
import { createAgentReadHandlers, type AgentCommandContext, type AgentReadModel } from '@/domain/agent'
import type { Project, Task } from '@/types/tasks'

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: 'project-personal',
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    isInInbox: true,
    workspaceId: null,
    ...overrides,
  }
}

function project(overrides: Partial<Project>): Project {
  return {
    id: 'project-personal',
    name: 'Personal Project',
    color: '#4ECDC4',
    colorType: 'hex',
    viewType: 'status',
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    workspaceId: null,
    ...overrides,
  }
}

const context: AgentCommandContext = {
  requestId: 'request-1',
  actor: { id: 'agent-1', name: 'Local Agent', transport: 'stdio' },
  workspace: { type: 'active' },
}

function model(overrides: Partial<AgentReadModel> = {}): AgentReadModel {
  return {
    activeWorkspaceId: null,
    syncStatus: 'synced',
    pendingSyncCount: 0,
    workspaces: [
      { id: 'workspace-a', name: 'Workspace A', ownerId: 'user-1', color: '#4ECDC4', createdAt: '2026-05-19', updatedAt: '2026-05-19' },
    ],
    projects: [
      project({ id: 'project-personal', name: 'Personal Project', workspaceId: null }),
      project({ id: 'project-workspace', name: 'Workspace Project', workspaceId: 'workspace-a' }),
    ],
    tasks: [
      task({ id: 'personal-visible', title: 'Buy milk', workspaceId: null, projectId: 'project-personal' }),
      task({ id: 'personal-deleted', title: 'Deleted personal', workspaceId: null, _soft_deleted: true, projectId: 'project-personal' }),
      task({ id: 'workspace-visible', title: 'Plan launch', workspaceId: 'workspace-a', projectId: 'project-workspace', dueDate: '2026-05-19' }),
    ],
    ...overrides,
  }
}

describe('agent read handlers', () => {
  it('treats active personal workspace as workspace_id null only', () => {
    const handlers = createAgentReadHandlers(model({ activeWorkspaceId: null }))
    const result = handlers.searchTasks(context)

    expect(result.status).toBe('success')
    expect(result.workspace).toEqual({ type: 'personal', workspaceId: null, label: 'Personal' })
    expect(result.data?.tasks.map(t => t.id)).toEqual(['personal-visible'])
  })

  it('scopes active shared workspace reads to the active workspace only', () => {
    const handlers = createAgentReadHandlers(model({ activeWorkspaceId: 'workspace-a' }))
    const result = handlers.searchTasks(context)

    expect(result.status).toBe('success')
    expect(result.workspace).toEqual({ type: 'workspace', workspaceId: 'workspace-a', label: 'Workspace A' })
    expect(result.data?.tasks.map(t => t.id)).toEqual(['workspace-visible'])
  })

  it('denies explicit workspace reads when the workspace is unavailable', () => {
    const handlers = createAgentReadHandlers(model())
    const result = handlers.searchTasks({ ...context, workspace: { type: 'workspace', workspaceId: 'workspace-b' } })

    expect(result.status).toBe('denied')
    expect(result.operation).toBe('denied')
    expect(result.error?.code).toBe('workspace_denied')
  })

  it('excludes soft-deleted tasks from task detail reads', () => {
    const handlers = createAgentReadHandlers(model())
    const result = handlers.getTask(context, 'personal-deleted')

    expect(result.status).toBe('not_found')
    expect(result.error?.code).toBe('task_not_found')
  })

  it('never returns soft-deleted tasks from search results', () => {
    const handlers = createAgentReadHandlers(model())
    const result = handlers.searchTasks(context, { query: 'deleted' })

    expect(result.status).toBe('success')
    expect(result.data?.tasks).toEqual([])
    expect(result.audit.affectedEntityIds).toEqual([])
  })

  it('filters today to the resolved workspace and date', () => {
    const handlers = createAgentReadHandlers(model({ activeWorkspaceId: 'workspace-a' }))
    const result = handlers.getToday(context, new Date('2026-05-19T12:00:00.000Z'))

    expect(result.status).toBe('success')
    expect(result.data).toEqual({
      date: '2026-05-19',
      tasks: [expect.objectContaining({ id: 'workspace-visible' })],
    })
  })

  it('returns sync status without exposing task data', () => {
    const handlers = createAgentReadHandlers(model({ syncStatus: 'pending', pendingSyncCount: 3 }))
    const result = handlers.getSyncStatus(context)

    expect(result.status).toBe('success')
    expect(result.data).toEqual({ syncStatus: 'pending', pendingSyncCount: 3 })
    expect(result.audit.affectedEntityType).toBe('sync')
    expect(result.audit.affectedEntityIds).toEqual([])
  })
})
