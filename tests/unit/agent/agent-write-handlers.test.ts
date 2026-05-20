import { describe, expect, it } from 'vitest'
import { createAgentWriteHandlers, type AgentReadModel, type AgentWriteContext } from '@/domain/agent'
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
    projectId: 'project-a',
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    isInInbox: true,
    workspaceId: 'workspace-a',
    ...overrides,
  }
}

function project(overrides: Partial<Project>): Project {
  return {
    id: 'project-a',
    name: 'Project A',
    color: '#4ECDC4',
    colorType: 'hex',
    viewType: 'status',
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    workspaceId: 'workspace-a',
    ...overrides,
  }
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
      project({ id: 'project-a', workspaceId: 'workspace-a' }),
      project({ id: 'project-personal', workspaceId: null }),
    ],
    tasks: [
      task({ id: 'workspace-task', workspaceId: 'workspace-a', projectId: 'project-a' }),
      task({ id: 'personal-task', workspaceId: null, projectId: 'project-personal' }),
      task({ id: 'deleted-task', workspaceId: 'workspace-a', _soft_deleted: true }),
    ],
  }
}

const context: AgentWriteContext = {
  requestId: 'request-1',
  actor: { id: 'agent-1', name: 'Local Agent', transport: 'stdio' },
  workspace: { type: 'active' },
  dryRun: true,
  idempotencyKey: 'idem-1',
}

describe('agent dry-run write handlers', () => {
  it('creates task previews with diffs without mutating model state', () => {
    const readModel = model()
    const beforeCount = readModel.tasks.length
    const result = createAgentWriteHandlers(readModel).createTask(context, {
      workspace: { type: 'active' },
      title: ' Draft launch ',
      projectId: 'project-a',
      priority: 'high',
    })

    expect(result.status).toBe('success')
    expect(result.operation).toBe('dry_run')
    expect(result.command).toBe('flowstate_create_task')
    expect(result.data?.task).toMatchObject({
      id: 'agent-preview-idem-1',
      title: 'Draft launch',
      projectId: 'project-a',
      workspaceId: 'workspace-a',
    })
    expect(result.diff).toEqual([{ path: '/tasks/-', before: null, after: result.data?.task }])
    expect(readModel.tasks).toHaveLength(beforeCount)
  })

  it('requires dry-run mode and an idempotency key', () => {
    const handlers = createAgentWriteHandlers(model())

    expect(handlers.updateTask({ ...context, dryRun: false }, {
      workspace: { type: 'active' },
      taskId: 'workspace-task',
      changes: { title: 'New title' },
    }).error?.code).toBe('dry_run_required')

    expect(handlers.updateTask({ ...context, idempotencyKey: '' }, {
      workspace: { type: 'active' },
      taskId: 'workspace-task',
      changes: { title: 'New title' },
    }).error?.code).toBe('idempotency_key_required')
  })

  it('returns before/after diffs for updates and completion with the correct command', () => {
    const handlers = createAgentWriteHandlers(model())

    const update = handlers.updateTask(context, {
      workspace: { type: 'active' },
      taskId: 'workspace-task',
      changes: { title: 'New title', priority: 'low' },
    })
    expect(update.command).toBe('flowstate_update_task')
    expect(update.diff).toEqual([
      { path: '/tasks/workspace-task/title', before: 'Task', after: 'New title' },
      { path: '/tasks/workspace-task/priority', before: 'medium', after: 'low' },
    ])

    const complete = handlers.completeTask(context, { workspace: { type: 'active' }, taskId: 'workspace-task' })
    expect(complete.command).toBe('flowstate_complete_task')
    expect(complete.diff).toEqual([{ path: '/tasks/workspace-task/status', before: 'todo', after: 'done' }])
  })

  it('denies cross-workspace task and project access', () => {
    const handlers = createAgentWriteHandlers(model())

    const personalTask = handlers.updateTask(context, {
      workspace: { type: 'active' },
      taskId: 'personal-task',
      changes: { title: 'Leak' },
    })
    expect(personalTask.status).toBe('not_found')

    const personalProject = handlers.createTask(context, {
      workspace: { type: 'active' },
      title: 'Wrong project',
      projectId: 'project-personal',
    })
    expect(personalProject.status).toBe('validation_error')
    expect(personalProject.error?.code).toBe('project_not_found')
  })

  it('produces dry-run diffs for move, comment, and soft delete', () => {
    const handlers = createAgentWriteHandlers(model())

    expect(handlers.moveTaskToProject(context, {
      workspace: { type: 'active' },
      taskId: 'workspace-task',
      projectId: null,
    }).diff).toEqual([{ path: '/tasks/workspace-task/projectId', before: 'project-a', after: '' }])

    expect(handlers.addTaskComment(context, {
      workspace: { type: 'active' },
      taskId: 'workspace-task',
      content: ' Looks good ',
    }).diff).toEqual([{ path: '/tasks/workspace-task/comments/-', before: null, after: { content: 'Looks good' } }])

    const softDelete = handlers.softDeleteTask(context, { workspace: { type: 'active' }, taskId: 'workspace-task' })
    expect(softDelete.command).toBe('flowstate_soft_delete_task')
    expect(softDelete.diff).toEqual([
      { path: '/tasks/workspace-task/_soft_deleted', before: false, after: true },
      { path: '/tasks/workspace-task/deletedAt', before: null, after: 'pending_approval' },
    ])
  })
})
