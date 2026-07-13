import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { scopeTaskQuery } = require(resolve(process.cwd(), 'server/local-api/task-scope.cjs'))

function queryHarness() {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  query.eq = vi.fn(() => query)
  query.is = vi.fn(() => query)
  return query
}

describe('canonical Local API task scope', () => {
  it('scopes personal reads to both the signed-in user and null workspace', () => {
    const query = queryHarness()

    expect(scopeTaskQuery({ userId: 'user-1', activeWorkspaceId: null }, query)).toBe(query)
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(query.is).toHaveBeenCalledWith('workspace_id', null)
  })

  it('scopes shared reads to the active workspace and leaves collaborator visibility to RLS', () => {
    const query = queryHarness()

    expect(scopeTaskQuery({ userId: 'collaborator-1', activeWorkspaceId: 'workspace-1' }, query)).toBe(query)
    expect(query.eq).toHaveBeenCalledOnce()
    expect(query.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1')
    expect(query.is).not.toHaveBeenCalled()
  })
})
