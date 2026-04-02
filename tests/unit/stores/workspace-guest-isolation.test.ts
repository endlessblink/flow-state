/**
 * TASK-1550: Workspace Guest Mode Isolation Tests (7 tests)
 *
 * Verifies that workspace store returns empty/disabled state when !isAuthenticated:
 * 1. isGuestMode is true when unauthenticated
 * 2. loadWorkspaces no-ops in guest mode
 * 3. switchWorkspace no-ops in guest mode (no DB loads triggered)
 * 4. loadMembers no-ops in guest mode
 * 5. deleteWorkspace returns false in guest mode
 * 6. createWorkspace returns null in guest mode
 * 7. clearAll works correctly even in guest mode
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ============================================================================
// Module-level mocks — guest mode (isAuthenticated = false)
// ============================================================================

const mockSupabaseFrom = vi.fn()

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    from: mockSupabaseFrom,
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    user: null,
  }),
}))

const mockTaskStoreLoadFromDatabase = vi.fn().mockResolvedValue(undefined)
const mockProjectStoreLoadFromDatabase = vi.fn().mockResolvedValue(undefined)
const mockCanvasStoreLoadFromDatabase = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({ loadFromDatabase: mockTaskStoreLoadFromDatabase }),
}))
vi.mock('@/stores/projects', () => ({
  useProjectStore: () => ({ loadProjectsFromDatabase: mockProjectStoreLoadFromDatabase }),
}))
vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({ loadFromDatabase: mockCanvasStoreLoadFromDatabase }),
}))
vi.mock('@/composables/supabase/_infrastructure', () => ({
  invalidateCache: { all: vi.fn() },
  supabase: null,
  getSupabase: vi.fn(() => null),
}))

// ============================================================================
// Tests
// ============================================================================

describe('useWorkspaceStore — Guest Mode Isolation (TASK-1550)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('1. isGuestMode is true when user is not authenticated', async () => {
    const { useWorkspaceStore } = await import('@/stores/workspace')
    const store = useWorkspaceStore()

    expect(store.isGuestMode).toBe(true)
    expect(store.isPersonalWorkspace).toBe(true)
  })

  it('2. loadWorkspaces no-ops — does not call supabase', async () => {
    const { useWorkspaceStore } = await import('@/stores/workspace')
    const store = useWorkspaceStore()

    await store.loadWorkspaces()

    expect(mockSupabaseFrom).not.toHaveBeenCalled()
    expect(store.workspaces).toHaveLength(0)
    expect(store.isLoading).toBe(false)
  })

  it('3. switchWorkspace no-ops — does not trigger downstream DB loads', async () => {
    const { useWorkspaceStore } = await import('@/stores/workspace')
    const store = useWorkspaceStore()

    await store.switchWorkspace('ws-should-not-switch')

    // activeWorkspaceId should remain null (personal)
    expect(store.activeWorkspaceId).toBeNull()
    // Downstream stores should NOT be called
    expect(mockTaskStoreLoadFromDatabase).not.toHaveBeenCalled()
    expect(mockProjectStoreLoadFromDatabase).not.toHaveBeenCalled()
    expect(mockCanvasStoreLoadFromDatabase).not.toHaveBeenCalled()
  })

  it('4. loadMembers no-ops — does not call supabase', async () => {
    const { useWorkspaceStore } = await import('@/stores/workspace')
    const store = useWorkspaceStore()

    await store.loadMembers('ws-some-id')

    expect(mockSupabaseFrom).not.toHaveBeenCalled()
    expect(store.members.size).toBe(0)
  })

  it('5. deleteWorkspace returns false — does not call supabase', async () => {
    const { useWorkspaceStore } = await import('@/stores/workspace')
    const store = useWorkspaceStore()

    const result = await store.deleteWorkspace('ws-fake')

    expect(result).toBe(false)
    expect(mockSupabaseFrom).not.toHaveBeenCalled()
  })

  it('6. createWorkspace returns null — user.id is null', async () => {
    const { useWorkspaceStore } = await import('@/stores/workspace')
    const store = useWorkspaceStore()

    const result = await store.createWorkspace('My Workspace')

    expect(result).toBeNull()
    expect(mockSupabaseFrom).not.toHaveBeenCalled()
  })

  it('7. clearAll works correctly in guest mode', async () => {
    const { useWorkspaceStore } = await import('@/stores/workspace')
    const store = useWorkspaceStore()

    // Simulate stale state from a previous session
    localStorage.setItem('flowstate-last-workspace', 'ws-stale')

    store.clearAll()

    expect(store.workspaces).toHaveLength(0)
    expect(store.activeWorkspaceId).toBeNull()
    expect(store.members.size).toBe(0)
    expect(localStorage.getItem('flowstate-last-workspace')).toBeNull()
  })
})
