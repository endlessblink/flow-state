/**
 * TASK-1664: Workspace Store Tests (10 tests)
 *
 * Tests for:
 * 1. Initial state: personal workspace, no members
 * 2. isPersonalWorkspace default true
 * 3. activeWorkspaceId initially null
 * 4. loadWorkspaces: handles missing table gracefully (PGRST205)
 * 5. switchWorkspace: updates activeWorkspaceId
 * 6. Personal workspace routes: canvas, quick-sort, etc. accessible
 * 7. Shared workspace: personal-only routes blocked
 * 8. Workspace member list populated
 * 9. Invite flow: creates invite record
 * 10. Leave workspace: clears state
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// ============================================================================
// Module-level mocks
// ============================================================================

const mockSupabaseFrom = vi.fn();
const mockRpc = vi.fn();
const mockForceSync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/services/auth/supabase", () => ({
  supabase: {
    from: mockSupabaseFrom,
    rpc: mockRpc,
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: { id: "user-123", email: "test@example.com" },
  }),
}));

// Mock stores that switchWorkspace loads dynamically
vi.mock("@/stores/tasks", () => ({
  useTaskStore: () => ({
    loadFromDatabase: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@/stores/projects", () => ({
  useProjectStore: () => ({
    loadProjectsFromDatabase: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@/stores/canvas", () => ({
  useCanvasStore: () => ({
    loadFromDatabase: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@/composables/sync/useSyncOrchestrator", () => ({
  useSyncOrchestrator: () => ({ forceSync: mockForceSync }),
}));
vi.mock("@/composables/supabase/_infrastructure", () => ({
  invalidateCache: { all: vi.fn() },
  supabase: null,
  getSupabase: vi.fn(() => null),
}));

// ============================================================================
// Helpers
// ============================================================================

function buildSelectChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: undefined as unknown,
  };
  // Allow awaiting the chain directly
  Object.defineProperty(chain, Symbol.for("__PROMISE__"), {
    get: () => Promise.resolve(result),
  });
  (chain as unknown as { [k: string]: unknown })["_result"] = result;
  return chain;
}

// ============================================================================
// Tests
// ============================================================================

describe("useWorkspaceStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("1. initial state: workspaces empty, members empty Map", async () => {
    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    expect(store.workspaces).toHaveLength(0);
    expect(store.members.size).toBe(0);
    expect(store.isLoading).toBe(false);
    expect(store.isSwitchingWorkspace).toBe(false);
  });

  it("2. isPersonalWorkspace is true by default", async () => {
    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    expect(store.isPersonalWorkspace).toBe(true);
  });

  it("3. activeWorkspaceId is null initially", async () => {
    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    expect(store.activeWorkspaceId).toBeNull();
    expect(store.activeWorkspace).toBeNull();
  });

  it("4. loadWorkspaces handles missing table error (PGRST205) gracefully", async () => {
    const pgrst205Error = {
      code: "PGRST205",
      message: "Relation not found",
      details: null,
      hint: null,
    };

    const errorChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: pgrst205Error }),
    };
    mockSupabaseFrom.mockReturnValue(errorChain);

    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    // Should not throw, just log and return
    await expect(store.loadWorkspaces()).resolves.toBeUndefined();
    expect(store.workspaces).toHaveLength(0);
    expect(store.isLoading).toBe(false);
  });

  it("5. switchWorkspace updates activeWorkspaceId", async () => {
    // Mock member load for the switch
    const memberChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockSupabaseFrom.mockReturnValue(memberChain);

    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    // Seed a workspace directly
    store.workspaces.push({
      id: "ws-abc",
      name: "Team Alpha",
      ownerId: "user-123",
      color: "#4ECDC4",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await store.switchWorkspace("ws-abc");

    expect(store.activeWorkspaceId).toBe("ws-abc");
    expect(store.isPersonalWorkspace).toBe(false);
  });

  it("resumes durable writes immediately after a workspace switch completes", async () => {
    const memberChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockSupabaseFrom.mockReturnValue(memberChain);

    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    await store.switchWorkspace("ws-durable");

    expect(store.isSwitchingWorkspace).toBe(false);
    expect(mockForceSync).toHaveBeenCalledTimes(1);
  });

  it("6. personal workspace: activeMembers is empty (no shared members)", async () => {
    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    // In personal mode (null workspace), activeMembers returns []
    expect(store.activeWorkspaceId).toBeNull();
    expect(store.activeMembers).toHaveLength(0);
  });

  it("7. shared workspace: userRole computed when member exists", async () => {
    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    const wsId = "ws-shared";
    store.workspaces.push({
      id: wsId,
      name: "Shared Workspace",
      ownerId: "other-user",
      color: "#FF6B6B",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Manually populate members
    store.members.set(wsId, [
      {
        id: "member-1",
        workspaceId: wsId,
        userId: "user-123",
        role: "member",
        joinedAt: new Date().toISOString(),
        displayName: "user-123",
      },
    ]);
    store.activeWorkspaceId = wsId;

    expect(store.userRole).toBe("member");
    expect(store.activeMembers).toHaveLength(1);
  });

  it("8. loadMembers populates the members Map for a given workspace", async () => {
    const memberRows = [
      {
        id: "m1",
        workspace_id: "ws-1",
        user_id: "user-456",
        role: "owner",
        joined_at: new Date().toISOString(),
      },
    ];
    const memberChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: memberRows, error: null }),
    };
    mockSupabaseFrom.mockReturnValue(memberChain);

    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    await store.loadMembers("ws-1");

    expect(store.members.has("ws-1")).toBe(true);
    const loaded = store.members.get("ws-1")!;
    expect(loaded).toHaveLength(1);
    expect(loaded[0].role).toBe("owner");
    expect(loaded[0].userId).toBe("user-456");
  });

  it("9. generateInviteLink creates an invite record and returns a link", async () => {
    const inviteRow = { token: "inv-tok-xyz" };
    const inviteChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: inviteRow, error: null }),
    };
    mockSupabaseFrom.mockReturnValue(inviteChain);

    // Provide window.location.origin
    Object.defineProperty(window, "location", {
      value: { origin: "https://app.example.com" },
      writable: true,
    });

    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    const link = await store.generateInviteLink(
      "ws-abc",
      "colleague@example.com",
      "member",
    );

    expect(inviteChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: "ws-abc",
        invited_email: "colleague@example.com",
        role: "member",
      }),
    );
    expect(link).toContain("inv-tok-xyz");
    expect(link).toContain("/#/invite/");
  });

  it("10. clearAll resets all workspace state", async () => {
    const { useWorkspaceStore } = await import("@/stores/workspace");
    const store = useWorkspaceStore();

    store.workspaces.push({
      id: "ws-to-clear",
      name: "To Be Cleared",
      ownerId: "user-123",
      color: "#4ECDC4",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    store.activeWorkspaceId = "ws-to-clear";
    store.members.set("ws-to-clear", []);
    localStorage.setItem("flowstate-last-workspace", "ws-to-clear");

    store.clearAll();

    expect(store.workspaces).toHaveLength(0);
    expect(store.activeWorkspaceId).toBeNull();
    expect(store.members.size).toBe(0);
    expect(localStorage.getItem("flowstate-last-workspace")).toBeNull();
  });
});
