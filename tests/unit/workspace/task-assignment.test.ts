/**
 * TASK-1552: Unit tests for task assignment feature
 *
 * Covers:
 * 1. useAssignmentFilter — module-level singleton behaviour
 * 2. useAssignmentFilter — filter modes (all / mine / unassigned / edge cases)
 * 3. assignTask — delegates to taskStore.updateTask correctly
 * 4. getAssignableMembers — personal vs shared workspace, no-auth edge case
 * 5. AssigneeAvatar — initials computation, hashUserId determinism, member lookup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
import type { WorkspaceMember } from '@/types/workspace'

// ============================================================================
// Shared mock state (declared before vi.mock hoisting)
// ============================================================================

const mockUpdateTask = vi.fn().mockResolvedValue(undefined)

// Auth store — can be swapped per test by mutating these refs
const authUser = ref<{ id: string; email: string } | null>({
  id: 'user-123',
  email: 'test@example.com',
})

// Workspace store
const mockMembersMap = ref(new Map<string, WorkspaceMember[]>())
const mockActiveWorkspaceId = ref<string | null>(null)

// ============================================================================
// Module-level mocks
// ============================================================================

vi.mock('@/services/auth/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get isAuthenticated() { return authUser.value !== null },
    get user() { return authUser.value },
  }),
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    updateTask: mockUpdateTask,
  }),
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    get activeWorkspaceId() { return mockActiveWorkspaceId.value },
    isPersonalWorkspace: computed(() => mockActiveWorkspaceId.value === null),
    activeMembers: computed(() =>
      mockActiveWorkspaceId.value
        ? mockMembersMap.value.get(mockActiveWorkspaceId.value) ?? []
        : []
    ),
    // Expose the raw Map so composable can call .get() on it directly
    get members() { return mockMembersMap.value },
  }),
}))

// Peer-store mocks required by useTaskStore internals
vi.mock('@/stores/projects', () => ({ useProjectStore: () => ({}) }))
vi.mock('@/stores/canvas', () => ({ useCanvasStore: () => ({}) }))
vi.mock('@/composables/supabase/_infrastructure', () => ({
  invalidateCache: { all: vi.fn() },
  supabase: null,
  getSupabase: vi.fn(() => null),
}))

// ============================================================================
// Helpers
// ============================================================================

function makeMember(overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: 'member-1',
    workspaceId: 'ws-1',
    userId: 'user-456',
    role: 'member',
    joinedAt: new Date().toISOString(),
    displayName: 'Alice Example',
    avatarUrl: undefined,
    email: 'alice@example.com',
    ...overrides,
  }
}

// ============================================================================
// 1 & 2 — useAssignmentFilter
// ============================================================================

describe('useAssignmentFilter', () => {
  // Import lazily inside tests so the module-level _filterMode singleton is
  // shared across all tests but can be reset via setFilterMode.
  let useAssignmentFilter: Awaited<typeof import('@/composables/workspace/useTaskAssignment')>['useAssignmentFilter']

  beforeEach(async () => {
    // Reset to known defaults
    authUser.value = { id: 'user-123', email: 'test@example.com' }
    ;({ useAssignmentFilter } = await import('@/composables/workspace/useTaskAssignment'))
    // Reset singleton to 'all' before every test
    useAssignmentFilter().setFilterMode('all')
  })

  // ── Singleton behaviour ─────────────────────────────────────────────────────

  describe('singleton behaviour', () => {
    it('two separate calls share the same filterMode ref', () => {
      const a = useAssignmentFilter()
      const b = useAssignmentFilter()

      expect(a.filterMode).toBe(b.filterMode)
    })

    it('changing filterMode via one instance is visible to another', () => {
      const a = useAssignmentFilter()
      const b = useAssignmentFilter()

      a.setFilterMode('mine')

      expect(b.filterMode.value).toBe('mine')
    })

    it('setFilterMode on either instance updates the shared ref', () => {
      const a = useAssignmentFilter()
      const b = useAssignmentFilter()

      b.setFilterMode('unassigned')

      expect(a.filterMode.value).toBe('unassigned')
    })
  })

  // ── Filter mode: 'all' ──────────────────────────────────────────────────────

  describe("mode = 'all'", () => {
    it('returns true for a task with an assignee', () => {
      const { filterFn, setFilterMode } = useAssignmentFilter()
      setFilterMode('all')

      expect(filterFn.value({ assignedTo: 'user-123' })).toBe(true)
    })

    it('returns true for a task without an assignee', () => {
      const { filterFn, setFilterMode } = useAssignmentFilter()
      setFilterMode('all')

      expect(filterFn.value({ assignedTo: null })).toBe(true)
    })

    it('returns true for a task with undefined assignedTo', () => {
      const { filterFn, setFilterMode } = useAssignmentFilter()
      setFilterMode('all')

      expect(filterFn.value({})).toBe(true)
    })
  })

  // ── Filter mode: 'mine' ─────────────────────────────────────────────────────

  describe("mode = 'mine'", () => {
    it('returns true when task.assignedTo matches the current user', () => {
      const { filterFn, setFilterMode } = useAssignmentFilter()
      setFilterMode('mine')

      expect(filterFn.value({ assignedTo: 'user-123' })).toBe(true)
    })

    it('returns false when task is assigned to a different user', () => {
      const { filterFn, setFilterMode } = useAssignmentFilter()
      setFilterMode('mine')

      expect(filterFn.value({ assignedTo: 'user-999' })).toBe(false)
    })

    it('returns false for unassigned tasks', () => {
      const { filterFn, setFilterMode } = useAssignmentFilter()
      setFilterMode('mine')

      expect(filterFn.value({ assignedTo: null })).toBe(false)
    })

    it('returns false for all tasks when there is no authenticated user', () => {
      authUser.value = null
      const { filterFn, setFilterMode } = useAssignmentFilter()
      setFilterMode('mine')

      expect(filterFn.value({ assignedTo: 'user-123' })).toBe(false)
      expect(filterFn.value({ assignedTo: null })).toBe(false)
    })
  })

  // ── Filter mode: 'unassigned' ───────────────────────────────────────────────

  describe("mode = 'unassigned'", () => {
    it('returns true when task.assignedTo is null', () => {
      const { filterFn, setFilterMode } = useAssignmentFilter()
      setFilterMode('unassigned')

      expect(filterFn.value({ assignedTo: null })).toBe(true)
    })

    it('returns true when task.assignedTo is undefined', () => {
      const { filterFn, setFilterMode } = useAssignmentFilter()
      setFilterMode('unassigned')

      expect(filterFn.value({})).toBe(true)
    })

    it('returns false when task has an assignee', () => {
      const { filterFn, setFilterMode } = useAssignmentFilter()
      setFilterMode('unassigned')

      expect(filterFn.value({ assignedTo: 'user-123' })).toBe(false)
    })
  })
})

// ============================================================================
// 3 — assignTask
// ============================================================================

describe('assignTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser.value = { id: 'user-123', email: 'test@example.com' }
  })

  it('calls taskStore.updateTask with the given userId in assignedTo', async () => {
    const { assignTask } = await import('@/composables/workspace/useTaskAssignment')

    await assignTask('task-abc', 'user-456')

    expect(mockUpdateTask).toHaveBeenCalledOnce()
    expect(mockUpdateTask).toHaveBeenCalledWith('task-abc', { assignedTo: 'user-456' })
  })

  it('passes null to assignedTo to unassign a task', async () => {
    const { assignTask } = await import('@/composables/workspace/useTaskAssignment')

    await assignTask('task-abc', null)

    expect(mockUpdateTask).toHaveBeenCalledWith('task-abc', { assignedTo: null })
  })

  it('awaits the updateTask promise (returns void on success)', async () => {
    const { assignTask } = await import('@/composables/workspace/useTaskAssignment')

    await expect(assignTask('task-xyz', 'user-123')).resolves.toBeUndefined()
  })
})

// ============================================================================
// 4 — getAssignableMembers
// ============================================================================

describe('getAssignableMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser.value = { id: 'user-123', email: 'test@example.com' }
    mockActiveWorkspaceId.value = null
    mockMembersMap.value = new Map()
  })

  it('personal workspace (null): returns one synthetic member for the current user', async () => {
    const { getAssignableMembers } = await import('@/composables/workspace/useTaskAssignment')

    const members = getAssignableMembers(null)

    expect(members).toHaveLength(1)
    expect(members[0].userId).toBe('user-123')
    expect(members[0].role).toBe('owner')
  })

  it('personal workspace: synthetic member id is prefixed with "personal-"', async () => {
    const { getAssignableMembers } = await import('@/composables/workspace/useTaskAssignment')

    const members = getAssignableMembers(null)

    expect(members[0].id).toBe('personal-user-123')
  })

  it('personal workspace: displayName is derived from email local-part', async () => {
    const { getAssignableMembers } = await import('@/composables/workspace/useTaskAssignment')

    const members = getAssignableMembers(null)

    expect(members[0].displayName).toBe('test')
  })

  it('no auth: personal workspace returns empty array', async () => {
    authUser.value = null
    const { getAssignableMembers } = await import('@/composables/workspace/useTaskAssignment')

    const members = getAssignableMembers(null)

    expect(members).toHaveLength(0)
  })

  it('shared workspace: returns members from workspace store', async () => {
    const wsMembers = [makeMember({ userId: 'user-A' }), makeMember({ id: 'member-2', userId: 'user-B' })]
    mockMembersMap.value.set('ws-shared', wsMembers)

    const { getAssignableMembers } = await import('@/composables/workspace/useTaskAssignment')

    const members = getAssignableMembers('ws-shared')

    expect(members).toHaveLength(2)
    expect(members.map(m => m.userId)).toEqual(['user-A', 'user-B'])
  })

  it('shared workspace: returns empty array when workspace has no loaded members', async () => {
    const { getAssignableMembers } = await import('@/composables/workspace/useTaskAssignment')

    const members = getAssignableMembers('ws-not-loaded')

    expect(members).toHaveLength(0)
  })
})

// ============================================================================
// 5 — AssigneeAvatar logic (unit-tested via extracted functions)
//
// The component is a .vue SFC and requires a full mount to test computed
// properties. We extract the deterministic pure functions inline here to
// verify correctness without needing jsdom component mounting.
// ============================================================================

describe('AssigneeAvatar — pure logic', () => {
  // ── initials computation (mirrors component logic exactly) ──────────────────

  function computeInitials(displayName: string): string {
    const name = displayName
    if (!name) return '?'

    const trimmed = name.trim()
    const atIdx = trimmed.indexOf('@')

    if (atIdx > 0) {
      return trimmed.slice(0, Math.min(2, atIdx)).toUpperCase()
    }

    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return trimmed.slice(0, 2).toUpperCase()
  }

  // ── hashUserId (mirrors component logic exactly) ────────────────────────────

  function hashUserId(id: string): number {
    let h = 0
    for (let i = 0; i < id.length; i++) {
      h = (h * 31 + id.charCodeAt(i)) >>> 0
    }
    return h % 8
  }

  describe('initials computation', () => {
    it('"John Doe" → "JD"', () => {
      expect(computeInitials('John Doe')).toBe('JD')
    })

    it('"alice" (single word) → "AL"', () => {
      expect(computeInitials('alice')).toBe('AL')
    })

    it('"bob@test.com" (email) → "BO"', () => {
      expect(computeInitials('bob@test.com')).toBe('BO')
    })

    it('empty string → "?"', () => {
      expect(computeInitials('')).toBe('?')
    })

    it('multi-word name uses first and last word initials', () => {
      expect(computeInitials('Anna Maria Lopez')).toBe('AL')
    })

    it('single-char email username → single char uppercased', () => {
      // "x@y.com" — atIdx=1, slice(0, Math.min(2,1)) = "x"
      expect(computeInitials('x@y.com')).toBe('X')
    })
  })

  describe('hashUserId determinism', () => {
    it('same userId always produces the same palette index', () => {
      const id = 'user-123'
      const first = hashUserId(id)
      const second = hashUserId(id)
      const third = hashUserId(id)

      expect(first).toBe(second)
      expect(second).toBe(third)
    })

    it('result is always in range [0, 7]', () => {
      const ids = ['user-1', 'user-abc', 'a0eebc99-9c0b-4ef8-bb6d', '', 'z']
      for (const id of ids) {
        const idx = hashUserId(id)
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThanOrEqual(7)
      }
    })

    it('different userIds can produce different indices', () => {
      // Verify the function isn't constant — collect a set of values
      const indices = new Set(
        ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'].map(hashUserId)
      )
      // With 8 distinct strings we expect at least 2 distinct palette slots
      expect(indices.size).toBeGreaterThan(1)
    })
  })

  describe('member lookup (tooltipText fallback)', () => {
    // Simulate the component's tooltipText = displayName || userId logic

    function resolveTooltipText(
      activeMembers: WorkspaceMember[],
      allMembersMap: Map<string, WorkspaceMember[]>,
      userId: string
    ): string {
      // Mirrors component member computed
      const fromActive = activeMembers.find(m => m.userId === userId)
      if (fromActive) {
        const dn = fromActive.displayName || fromActive.email || ''
        return dn || userId
      }
      for (const memberList of allMembersMap.values()) {
        const found = memberList.find(m => m.userId === userId)
        if (found) {
          const dn = found.displayName || found.email || ''
          return dn || userId
        }
      }
      return userId
    }

    it('member found in activeMembers → uses their displayName', () => {
      const members: WorkspaceMember[] = [makeMember({ userId: 'user-A', displayName: 'Alice' })]
      const tooltip = resolveTooltipText(members, new Map(), 'user-A')
      expect(tooltip).toBe('Alice')
    })

    it('member not found in activeMembers but in members map → uses displayName from map', () => {
      const memberMap = new Map<string, WorkspaceMember[]>([
        ['ws-1', [makeMember({ userId: 'user-B', displayName: 'Bob' })]],
      ])
      const tooltip = resolveTooltipText([], memberMap, 'user-B')
      expect(tooltip).toBe('Bob')
    })

    it('member not found anywhere → falls back to userId', () => {
      const tooltip = resolveTooltipText([], new Map(), 'unknown-user-xyz')
      expect(tooltip).toBe('unknown-user-xyz')
    })

    it('member found but has no displayName → falls back to email', () => {
      const members: WorkspaceMember[] = [
        makeMember({ userId: 'user-C', displayName: undefined, email: 'carol@example.com' }),
      ]
      const tooltip = resolveTooltipText(members, new Map(), 'user-C')
      expect(tooltip).toBe('carol@example.com')
    })

    it('member found but has no displayName and no email → falls back to userId', () => {
      const members: WorkspaceMember[] = [
        makeMember({ userId: 'user-D', displayName: undefined, email: undefined }),
      ]
      const tooltip = resolveTooltipText(members, new Map(), 'user-D')
      expect(tooltip).toBe('user-D')
    })
  })
})
