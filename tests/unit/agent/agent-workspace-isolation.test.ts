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
    projectId: null,
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    isInInbox: true,
    workspaceId: null,
    ...overrides,
  }
}

function project(overrides: Partial<Project>): Project {
  return {
    id: 'project-1',
    name: 'Project',
    color: '#4ECDC4',
    colorType: 'hex',
    viewType: 'status',
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    workspaceId: null,
    ...overrides,
  }
}

const baseContext: AgentCommandContext = {
  requestId: 'request-1',
  actor: { id: 'agent-1', name: 'Local Agent', transport: 'stdio' },
  workspace: { type: 'active' },
}

function model(): AgentReadModel {
  return {
    activeWorkspaceId: 'workspace-a',
    syncStatus: 'synced',
    pendingSyncCount: 0,
    workspaces: [
      { id: 'workspace-a', name: 'Workspace A', ownerId: 'user-1', color: '#4ECDC4', createdAt: '2026-05-19', updatedAt: '2026-05-19' },
    ],
    projects: [
      project({ id: 'project-personal', workspaceId: null }),
      project({ id: 'project-a', workspaceId: 'workspace-a' }),
      project({ id: 'project-b', workspaceId: 'workspace-b' }),
    ],
    tasks: [
      task({ id: 'personal-task', workspaceId: null, projectId: 'project-personal' }),
      task({ id: 'workspace-a-task', workspaceId: 'workspace-a', projectId: 'project-a' }),
      task({ id: 'workspace-b-task', workspaceId: 'workspace-b', projectId: 'project-b' }),
    ],
  }
}

describe('agent workspace isolation', () => {
  it('does not expose personal rows while active shared workspace is selected', () => {
    const result = createAgentReadHandlers(model()).searchTasks(baseContext)

    expect(result.status).toBe('success')
    expect(result.data?.tasks.map(task => task.id)).toEqual(['workspace-a-task'])
  })

  it('does not expose shared workspace rows when personal scope is requested', () => {
    const result = createAgentReadHandlers(model()).searchTasks({ ...baseContext, workspace: { type: 'personal' } })

    expect(result.status).toBe('success')
    expect(result.data?.tasks.map(task => task.id)).toEqual(['personal-task'])
  })

  it('denies direct reads for a workspace outside the available membership snapshot', () => {
    const result = createAgentReadHandlers(model()).getTask(
      { ...baseContext, workspace: { type: 'workspace', workspaceId: 'workspace-b' } },
      'workspace-b-task'
    )

    expect(result.status).toBe('denied')
    expect(result.error?.code).toBe('workspace_denied')
    expect(result.audit.affectedEntityIds).toEqual([])
  })

  it('does not leak cross-workspace projects', () => {
    const result = createAgentReadHandlers(model()).listProjects(baseContext)

    expect(result.status).toBe('success')
    expect(result.data?.projects.map(project => project.id)).toEqual(['project-a'])
  })
})
