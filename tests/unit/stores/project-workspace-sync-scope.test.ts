import { describe, expect, it } from 'vitest'
import { filterProjectsForWorkspaceSync } from '@/stores/projects'
import type { Project } from '@/types/tasks'

function project(id: string, workspaceId?: string | null): Project {
  return {
    id,
    name: id,
    color: '#4ECDC4',
    colorType: 'hex',
    viewType: 'status',
    parentId: null,
    createdAt: new Date('2026-06-23T00:00:00.000Z'),
    updatedAt: new Date('2026-06-23T00:00:00.000Z'),
    ...(workspaceId !== undefined ? { workspaceId } : {}),
  } as Project
}

describe('project workspace sync scope', () => {
  it('keeps personal bulk saves from including shared workspace projects', () => {
    const scoped = filterProjectsForWorkspaceSync([
      project('legacy-personal'),
      project('explicit-personal', null),
      project('shared', 'workspace-1'),
    ], null)

    expect(scoped.map(p => p.id)).toEqual(['legacy-personal', 'explicit-personal'])
  })

  it('keeps shared workspace bulk saves from including personal or other workspace projects', () => {
    const scoped = filterProjectsForWorkspaceSync([
      project('legacy-personal'),
      project('explicit-personal', null),
      project('current-shared', 'workspace-1'),
      project('other-shared', 'workspace-2'),
    ], 'workspace-1')

    expect(scoped.map(p => p.id)).toEqual(['current-shared'])
  })
})
